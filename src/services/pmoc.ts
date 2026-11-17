// PMOC no banco (fase 1 de docs/pmoc.md). As telas não chamam este arquivo direto: passam por
// `src/components/pmoc/fonteDeDados.ts`, que escolhe entre o banco e os dados de demonstração.
// Gravação do plano inteiro numa transação só (`pmoc_salvar_plano`); leitura direto das tabelas (RLS: admin e escritório).

import { supabase } from './supabase';
import { compactarImagem, enviarParaHostgator } from './anexos';
import {
  calcularEstadoCelulaExecucao,
  gerarMesesDoPlano,
  letraEquipamento,
  mesAtualLocal,
  tarefasPrevistasNoMes,
} from '../components/pmoc/regrasPmoc';
import { gerarZplEtiquetaPmoc } from '../utils/etiquetaPmoc';
import type {
  PmocActivityChecklist,
  PmocEnvironment,
  PmocEquipmentMonthExecution,
  PmocEquipmentTask,
  PmocFieldEquipmentChecklist,
  PmocGenerateOsResult,
  PmocGenerateOsScheduleInput,
  PmocMeasurementKey,
  PmocMonthlyReport,
  PmocMonthPlanStatus,
  PmocMonthSummary,
  PmocPlan,
  PmocPlanEquipment,
  PmocPlanInput,
  PmocPlanSummary,
  PmocPrintLabelsResult,
  PmocPublicEquipmentView,
  PmocSaveEquipmentExecutionInput,
  PmocTaskTemplate,
} from '../types/pmoc';

function falhar(error: { message: string } | null, contexto: string): void {
  if (error) throw new Error(`${contexto}: ${error.message}`);
}

/**
 * Busca todas as linhas em páginas de 1000 (o Supabase corta em 1000 por consulta; um plano com ~50 aparelhos já passa
 * disso no cronograma, 22 tarefas por aparelho). `montar` recebe o intervalo e devolve a consulta já filtrada e ordenada.
 */
async function todas<T>(
  montar: (de: number, ate: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  contexto: string,
): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montar(de, de + 999);
    falhar(error, contexto);
    const pagina = (data ?? []) as T[];
    linhas.push(...pagina);
    if (pagina.length < 1000) return linhas;
  }
}

/** Erro de regra do banco (RAISE EXCEPTION) chega com a mensagem em português: mostra só ela. */
function erroDoBanco(error: { message: string; code?: string } | null): void {
  if (!error) return;
  if (error.code === '42501' || error.code === '23514' || error.code === '23505') throw new Error(error.message);
  throw new Error(`Não foi possível gravar: ${error.message}`);
}

// ---------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------

type LinhaPlano = Omit<PmocPlan, 'customer_person_type'> & { customer_person_type: 'PF' | 'PJ' };

export async function buscarPlano(id: string): Promise<PmocPlan | null> {
  const { data, error } = await supabase.from('pmoc_plans').select('*').eq('id', id).maybeSingle();
  falhar(error, 'Erro ao carregar o plano');
  return (data as LinhaPlano | null) ?? null;
}

export async function listarAmbientes(planId: string): Promise<PmocEnvironment[]> {
  const { data, error } = await supabase.from('pmoc_environments').select('*').eq('plan_id', planId).order('sort_order');
  falhar(error, 'Erro ao carregar os ambientes');
  return ((data ?? []) as PmocEnvironment[]).map((a) => ({ ...a, area_m2: Number(a.area_m2) }));
}

interface LinhaAparelhoPlano {
  id: string;
  plan_id: string;
  equipment_id: string;
  environment_id: string | null;
  name: string;
  identifier: string;
  photo_url: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  equipment: { category: string; brand: string | null; model: string | null; serial_number: string | null; capacity_btu: number | null; public_token: string | null } | null;
}

const SELECT_APARELHO = '*, equipment:equipments(category, brand, model, serial_number, capacity_btu, public_token)';

function paraAparelho(l: LinhaAparelhoPlano): PmocPlanEquipment {
  return {
    id: l.id,
    plan_id: l.plan_id,
    equipment_id: l.equipment_id,
    environment_id: l.environment_id,
    equipment_type: l.equipment?.category ?? '',
    name: l.name,
    brand: l.equipment?.brand ?? null,
    model: l.equipment?.model ?? null,
    serial_number: l.equipment?.serial_number ?? null,
    capacity_btu: l.equipment?.capacity_btu ?? 0,
    identifier: l.identifier,
    photo_url: l.photo_url,
    photo_attachment_id: null,
    sort_order: l.sort_order,
    active: l.active,
    public_token: l.equipment?.public_token ?? null,
    created_at: l.created_at,
  };
}

export async function listarEquipamentosDoPlano(planId: string): Promise<PmocPlanEquipment[]> {
  const { data, error } = await supabase.from('pmoc_plan_equipments').select(SELECT_APARELHO).eq('plan_id', planId).order('sort_order');
  falhar(error, 'Erro ao carregar os aparelhos do plano');
  return ((data ?? []) as unknown as LinhaAparelhoPlano[]).map(paraAparelho);
}

export async function buscarCronograma(planId: string): Promise<PmocEquipmentTask[]> {
  const linhas = await todas<PmocEquipmentTask>(
    (de, ate) => supabase.from('pmoc_equipment_tasks').select('*').eq('plan_id', planId).order('sort_order').order('id').range(de, ate),
    'Erro ao carregar o cronograma',
  );
  return linhas.map((t) => ({ ...t, measurement_fields: (t.measurement_fields ?? []) as PmocMeasurementKey[] }));
}

interface LinhaExecucao {
  id: string;
  plan_id: string;
  plan_equipment_id: string;
  reference_month: string;
  status: PmocEquipmentMonthExecution['status'];
  service_order_id: string | null;
  technician_id: string | null;
  executed_at: string | null;
  measurements: Partial<PmocEquipmentMonthExecution['measurements']> | null;
  task_results: PmocEquipmentMonthExecution['task_results'] | null;
  technician_notes: string | null;
  unattended_reason: string | null;
  accompanied_by: string | null;
  photo_urls: string[] | null;
  updated_at: string;
  ordem: { number: number } | null;
  tecnico: { name: string } | null;
}

function paraExecucao(l: LinhaExecucao): PmocEquipmentMonthExecution {
  const m = l.measurements ?? {};
  return {
    id: l.id,
    plan_id: l.plan_id,
    plan_equipment_id: l.plan_equipment_id,
    reference_month: l.reference_month,
    status: l.status,
    service_order_id: l.service_order_id,
    service_order_number: l.ordem?.number ?? null,
    technician_id: l.technician_id,
    technician_name: l.tecnico?.name ?? null,
    executed_at: l.executed_at,
    measurements: {
      current_a: m.current_a ?? null,
      temp_supply_c: m.temp_supply_c ?? null,
      temp_return_c: m.temp_return_c ?? null,
      temp_ambient_c: m.temp_ambient_c ?? null,
    },
    task_results: l.task_results ?? [],
    technician_notes: l.technician_notes,
    photo_urls: l.photo_urls ?? [],
    unattended_reason: l.unattended_reason,
    accompanied_by: l.accompanied_by,
    updated_at: l.updated_at,
  };
}

const SELECT_EXECUCAO = '*, ordem:service_orders(number), tecnico:employees(name)';

export async function listarExecucoes(planId: string): Promise<PmocEquipmentMonthExecution[]> {
  const linhas = await todas<LinhaExecucao>(
    (de, ate) => supabase.from('pmoc_executions').select(SELECT_EXECUCAO).eq('plan_id', planId).order('id').range(de, ate),
    'Erro ao carregar as execuções',
  );
  return linhas.map(paraExecucao);
}

/** Lista os planos com o resumo da lista (/pmoc): aparelhos ativos, próxima visita e meses atrasados. */
export async function listarPlanos(): Promise<PmocPlanSummary[]> {
  const [planos, aparelhos, listaTarefas, linhasExecucoes] = await Promise.all([
    todas<PmocPlan>((de, ate) => supabase.from('pmoc_plans').select('*').order('start_date', { ascending: false }).order('id').range(de, ate), 'Erro ao listar os planos'),
    todas<{ id: string; plan_id: string; active: boolean }>(
      (de, ate) => supabase.from('pmoc_plan_equipments').select('id, plan_id, active').order('id').range(de, ate),
      'Erro ao listar os aparelhos dos planos',
    ),
    todas<PmocEquipmentTask>((de, ate) => supabase.from('pmoc_equipment_tasks').select('*').order('id').range(de, ate), 'Erro ao listar os cronogramas'),
    todas<LinhaExecucao>((de, ate) => supabase.from('pmoc_executions').select(SELECT_EXECUCAO).order('id').range(de, ate), 'Erro ao listar as execuções'),
  ]);

  const listaExecucoes = linhasExecucoes.map(paraExecucao);
  const mesHoje = mesAtualLocal();

  return planos.map((plano) => {
    const ativos = aparelhos.filter((e) => e.plan_id === plano.id && e.active);
    let atrasadas = 0;
    let proxima: string | null = null;
    if (plano.status !== 'encerrado' && ativos.length > 0) {
      for (const mes of gerarMesesDoPlano(plano.start_date)) {
        let prevista = false;
        let atrasadaNoMes = false;
        for (const eq of ativos) {
          const qtd = tarefasPrevistasNoMes(listaTarefas.filter((t) => t.plan_equipment_id === eq.id), mes.offset).length;
          const exec = listaExecucoes.find((x) => x.plan_equipment_id === eq.id && x.reference_month === mes.referencia);
          const estado = calcularEstadoCelulaExecucao(qtd, exec, mes.referencia, mesHoje);
          if (estado === 'atrasada') atrasadaNoMes = true;
          if (estado === 'prevista' && mes.referencia >= mesHoje) prevista = true;
        }
        if (plano.status === 'vigente' && atrasadaNoMes) atrasadas += 1;
        if (prevista && !proxima) proxima = mes.referencia;
      }
    }
    return { ...plano, equipment_count: ativos.length, next_visit_month: proxima, overdue_visits_count: atrasadas };
  });
}

export async function listarModelosDeTarefa(): Promise<PmocTaskTemplate[]> {
  const { data, error } = await supabase
    .from('pmoc_task_templates')
    .select('id, equipment_type, description, updated_at, tasks:pmoc_task_template_items(*)')
    .order('equipment_type');
  falhar(error, 'Erro ao carregar os modelos de tarefa');
  return ((data ?? []) as unknown as PmocTaskTemplate[]).map((m) => ({
    ...m,
    tasks: [...(m.tasks ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((t) => ({ ...t, measurement_fields: (t.measurement_fields ?? []) as PmocMeasurementKey[] })),
  }));
}

/** Consolida o relatório do mês a partir das peças do plano (a mesma regra vale para a tela interna e para o link público). */
function montarRelatorio(
  plano: PmocPlan,
  ambientes: PmocEnvironment[],
  aparelhos: PmocPlanEquipment[],
  tarefas: PmocEquipmentTask[],
  execucoes: PmocEquipmentMonthExecution[],
  referenceMonth: string,
  publicToken: string | null,
): PmocMonthlyReport {

  const offset = gerarMesesDoPlano(plano.start_date).find((m) => m.referencia === referenceMonth)?.offset ?? 1;
  const nomeAmbiente = new Map(ambientes.map((a) => [a.id, a.name]));
  const atendidos: PmocMonthlyReport['attended_equipments'] = [];
  const naoAtendidos: PmocMonthlyReport['unattended_equipments'] = [];
  let numeroOs: number | null = null;
  let tecnico: string | null = null;
  let executadoEm: string | null = null;
  let acompanhadoPor: string | null = null;

  aparelhos
    .filter((e) => e.active)
    .forEach((eq, idx) => {
      const letra = letraEquipamento(idx);
      const previstas = tarefasPrevistasNoMes(tarefas.filter((t) => t.plan_equipment_id === eq.id), offset);
      if (previstas.length === 0) return;
      const exec = execucoes.find((x) => x.plan_equipment_id === eq.id && x.reference_month === referenceMonth);
      numeroOs ??= exec?.service_order_number ?? null;
      tecnico ??= exec?.technician_name ?? null;
      executadoEm ??= exec?.executed_at ?? null;
      acompanhadoPor ??= exec?.accompanied_by ?? null;
      const ambiente = eq.environment_id ? (nomeAmbiente.get(eq.environment_id) ?? null) : null;

      if (exec?.status === 'concluida') {
        atendidos.push({ equipment: eq, letter: letra, environment_name: ambiente, execution: exec });
      } else {
        naoAtendidos.push({
          equipment: eq,
          letter: letra,
          environment_name: ambiente,
          reason:
            exec?.unattended_reason?.trim() ||
            (exec?.status === 'pendente'
              ? 'Manutenção prevista na OS, ainda pendente de conclusão em campo.'
              : 'Visita preventiva ainda não registrada para este equipamento no mês.'),
        });
      }
    });

  return {
    plan: plano,
    environments: ambientes,
    reference_month: referenceMonth,
    month_offset: offset,
    service_order_number: numeroOs,
    technician_name: tecnico,
    executed_at: executadoEm,
    accompanied_by: acompanhadoPor,
    public_token: publicToken,
    attended_equipments: atendidos,
    unattended_equipments: naoAtendidos,
  };
}

/** Relatório mensal interno (admin/escritório), com os dados do banco. */
export async function buscarRelatorioMensal(planId: string, referenceMonth: string): Promise<PmocMonthlyReport | null> {
  const [plano, ambientes, aparelhos, tarefas, execucoes, link] = await Promise.all([
    buscarPlano(planId),
    listarAmbientes(planId),
    listarEquipamentosDoPlano(planId),
    buscarCronograma(planId),
    listarExecucoes(planId),
    supabase.from('pmoc_report_links').select('token').eq('plan_id', planId).eq('reference_month', referenceMonth).maybeSingle(),
  ]);
  if (!plano) return null;
  return montarRelatorio(plano, ambientes, aparelhos, tarefas, execucoes, referenceMonth, (link.data?.token as string | undefined) ?? null);
}

// ---------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------

export interface PlanoCompletoInput {
  plano: PmocPlanInput;
  ambientes: { id?: string; name: string; code: string; fixed_occupants: number; floating_occupants: number; area_m2: number }[];
  equipamentos: (Omit<PmocPlanEquipment, 'id' | 'plan_id' | 'sort_order' | 'created_at'> & { id?: string })[];
  tarefas: PmocEquipmentTask[];
}

/** Grava dados gerais, ambientes, aparelhos e cronograma de uma vez (tudo ou nada). Devolve o id do plano. */
export async function salvarPlanoCompleto(dados: PlanoCompletoInput): Promise<string> {
  const { data, error } = await supabase.rpc('pmoc_salvar_plano', {
    p_plano: dados.plano,
    p_ambientes: dados.ambientes,
    p_equipamentos: dados.equipamentos,
    p_tarefas: dados.tarefas,
  });
  erroDoBanco(error);
  return data as string;
}

export interface ModeloDeTarefaInput {
  id?: string;
  equipment_type: string;
  description: string | null;
  tasks: Omit<PmocTaskTemplate['tasks'][number], 'sort_order'>[];
}

export async function salvarModeloDeTarefa(dados: ModeloDeTarefaInput): Promise<PmocTaskTemplate> {
  const { data, error } = await supabase.rpc('pmoc_salvar_modelo', { p_modelo: dados });
  erroDoBanco(error);
  const modelo = (await listarModelosDeTarefa()).find((m) => m.id === data);
  if (!modelo) throw new Error('O modelo foi gravado, mas não foi possível recarregá-lo.');
  return modelo;
}

/** Nome, CPF e registro do funcionário escolhido como responsável técnico (o resto dos dados pessoais segue só do admin). */
export async function buscarDadosResponsavel(
  employeeId: string,
): Promise<{ nome: string; cpf: string | null; registro: string | null; email: string | null; telefone: string | null } | null> {
  const { data, error } = await supabase.rpc('pmoc_dados_responsavel', { p_employee: employeeId });
  falhar(error, 'Erro ao buscar os dados do responsável técnico');
  const linha = (data as { nome: string; cpf: string | null; registro: string | null; email: string | null; telefone: string | null }[] | null)?.[0];
  return linha ?? null;
}

/** Responsável sugerido no plano novo: o único funcionário ativo com registro profissional (hoje, o Braulio). */
export async function responsavelPadrao(): Promise<string | null> {
  const { data, error } = await supabase.rpc('pmoc_responsavel_padrao');
  if (error) return null;
  return (data as string | null) ?? null;
}

/** Gera a OS do mês com a atividade já agendada (técnico, início e duração escolhidos pelo escritório). Não duplica. */
export async function gerarOsDoMes(
  planId: string,
  referenceMonth: string,
  agendamento: PmocGenerateOsScheduleInput,
): Promise<PmocGenerateOsResult> {
  const { data, error } = await supabase.rpc('pmoc_gerar_os_mes', {
    p_plano: planId,
    p_mes: referenceMonth,
    p_tecnico: agendamento.technician_id,
    p_inicio: agendamento.scheduled_start,
    p_minutos: Math.round(agendamento.estimated_minutes),
    p_obs: null,
  });
  erroDoBanco(error);
  const r = data as Partial<PmocGenerateOsResult> & { service_order_id: string; service_order_number: number };
  return {
    service_order_id: r.service_order_id,
    service_order_number: Number(r.service_order_number),
    task_id: r.task_id ?? null,
    reference_month: referenceMonth,
    equipments_included: r.equipments_included ?? 0,
    already_existed: r.already_existed ?? false,
    message: r.message ?? `OS ${r.service_order_number} gerada.`,
  };
}

// ---------------------------------------------------------------------
// Painel "PMOC do mês" (admin/escritório)
// ---------------------------------------------------------------------

interface LinhaOsMes {
  plan_id: string;
  plan_equipment_id: string;
  service_order_id: string | null;
  task_id: string | null;
  technician_id: string | null;
  accompanied_by: string | null;
  executed_at: string | null;
  status: PmocEquipmentMonthExecution['status'];
  ordem: { number: number; status: string } | null;
  atividade: { scheduled_start: string | null } | null;
  tecnico: { name: string } | null;
}

/** Situação de cada plano vigente no mês: sem OS, OS agendada, executada ou atrasada. */
export async function resumoDoMes(referenceMonth: string): Promise<PmocMonthSummary> {
  const hoje = mesAtualLocal();
  const planos = await todas<PmocPlan>(
    (de, ate) => supabase.from('pmoc_plans').select('*').eq('status', 'vigente').order('code').range(de, ate),
    'Erro ao listar os planos vigentes',
  );
  const resumo: PmocMonthSummary = {
    reference_month: referenceMonth,
    active_plans_total: planos.length,
    counts: { sem_os: 0, os_agendada: 0, executada: 0, atrasada: 0 },
    items: [],
  };
  if (planos.length === 0) return resumo;

  const ids = planos.map((p) => p.id);
  const [aparelhos, tarefas, execs, links] = await Promise.all([
    todas<{ id: string; plan_id: string }>(
      (de, ate) => supabase.from('pmoc_plan_equipments').select('id, plan_id').in('plan_id', ids).eq('active', true).order('id').range(de, ate),
      'Erro ao listar os aparelhos',
    ),
    todas<PmocEquipmentTask>(
      (de, ate) => supabase.from('pmoc_equipment_tasks').select('*').in('plan_id', ids).eq('active', true).order('id').range(de, ate),
      'Erro ao listar os cronogramas',
    ),
    todas<LinhaOsMes>(
      (de, ate) =>
        supabase
          .from('pmoc_executions')
          .select('plan_id, plan_equipment_id, service_order_id, task_id, technician_id, accompanied_by, executed_at, status, ordem:service_orders(number, status), atividade:tasks(scheduled_start), tecnico:employees(name)')
          .eq('reference_month', referenceMonth)
          .in('plan_id', ids)
          .order('id')
          .range(de, ate),
      'Erro ao listar as execuções do mês',
    ),
    supabase.from('pmoc_report_links').select('plan_id, token').eq('reference_month', referenceMonth).in('plan_id', ids),
  ]);
  falhar(links.error, 'Erro ao buscar os links dos relatórios');
  const tokenDoPlano = new Map(((links.data ?? []) as { plan_id: string; token: string }[]).map((l) => [l.plan_id, l.token]));

  for (const plano of planos) {
    const mes = gerarMesesDoPlano(plano.start_date).find((m) => m.referencia === referenceMonth);
    if (!mes) continue;
    const comTarefa = aparelhos
      .filter((e) => e.plan_id === plano.id)
      .map((e) => ({ id: e.id, qtd: tarefasPrevistasNoMes(tarefas.filter((t) => t.plan_equipment_id === e.id), mes.offset).length }))
      .filter((e) => e.qtd > 0);
    if (comTarefa.length === 0) continue;

    // OS cancelada não conta (dá para gerar outra)
    const doMes = execs.filter((x) => x.plan_id === plano.id && x.ordem?.status !== 'cancelada');
    const comOs = doMes.find((x) => x.service_order_id) ?? null;
    const tudoFeito = comTarefa.every((e) => {
      const x = doMes.find((d) => d.plan_equipment_id === e.id);
      return x?.status === 'concluida' || x?.status === 'nao_atendido';
    });

    let status: PmocMonthPlanStatus;
    if (tudoFeito) status = 'executada';
    else if (referenceMonth < hoje) status = 'atrasada';
    else if (comOs) status = 'os_agendada';
    else status = 'sem_os';
    resumo.counts[status] += 1;

    resumo.items.push({
      plan_id: plano.id,
      plan_code: plano.code,
      customer_id: plano.customer_id,
      customer_name: plano.customer_name,
      customer_trade_name: plano.customer_trade_name,
      customer_phone: plano.customer_phone,
      address_snapshot: plano.address_snapshot,
      reference_month: referenceMonth,
      month_offset: mes.offset,
      equipment_count_in_month: comTarefa.length,
      task_count_in_month: comTarefa.reduce((soma, e) => soma + e.qtd, 0),
      status,
      service_order_id: comOs?.service_order_id ?? null,
      service_order_number: comOs?.ordem?.number ?? null,
      task_id: comOs?.task_id ?? null,
      technician_id: comOs?.technician_id ?? null,
      technician_name: comOs?.tecnico?.name ?? null,
      scheduled_start: comOs?.atividade?.scheduled_start ?? null,
      executed_at: doMes.find((x) => x.executed_at)?.executed_at ?? null,
      accompanied_by: doMes.find((x) => x.accompanied_by)?.accompanied_by ?? null,
      report_token: tokenDoPlano.get(plano.id) ?? null,
    });
  }
  return resumo;
}

// ---------------------------------------------------------------------
// Checklist no app de campo (técnico) e relatório/ficha públicos
// ---------------------------------------------------------------------

type ChecklistBruto = Omit<PmocActivityChecklist, 'equipments'> & {
  equipments: (Omit<PmocFieldEquipmentChecklist, 'letter'> & { letter_idx: number })[];
};

/** Atividade de PMOC: aparelhos e tarefas do mês. Atividade comum devolve `is_pmoc: false`. */
export async function buscarChecklistDaAtividade(taskId: string): Promise<PmocActivityChecklist> {
  const { data, error } = await supabase.rpc('pmoc_checklist_atividade', { p_task: taskId });
  falhar(error, 'Erro ao carregar o checklist do PMOC');
  const c = data as ChecklistBruto;
  return {
    is_pmoc: c.is_pmoc,
    task_id: c.task_id,
    service_order_id: c.service_order_id ?? null,
    service_order_number: c.service_order_number ?? null,
    plan_id: c.plan_id ?? null,
    plan_code: c.plan_code ?? null,
    customer_name: c.customer_name ?? null,
    reference_month: c.reference_month ?? null,
    accompanied_by: c.accompanied_by ?? null,
    equipments: (c.equipments ?? []).map(({ letter_idx, ...a }) => ({
      ...a,
      letter: letraEquipamento(letter_idx),
      photo_urls: a.photo_urls ?? [],
      measurements: {
        current_a: a.measurements?.current_a ?? null,
        temp_supply_c: a.measurements?.temp_supply_c ?? null,
        temp_return_c: a.measurements?.temp_return_c ?? null,
        temp_ambient_c: a.measurements?.temp_ambient_c ?? null,
      },
    })),
  };
}

/** Grava um aparelho da visita (a validação final é do banco). */
export async function salvarExecucaoAparelho(dados: PmocSaveEquipmentExecutionInput): Promise<PmocEquipmentMonthExecution> {
  const { data, error } = await supabase.rpc('pmoc_salvar_execucao', {
    p_task: dados.task_id,
    p_plano_equip: dados.plan_equipment_id,
    p_dados: {
      status: dados.status,
      task_results: dados.task_results,
      measurements: dados.measurements,
      technician_notes: dados.technician_notes,
      photo_urls: dados.photo_urls,
      unattended_reason: dados.unattended_reason,
    },
  });
  erroDoBanco(error);
  const x = data as LinhaExecucao;
  return paraExecucao({ ...x, ordem: null, tecnico: null });
}

/** Conclui o checklist: todos os aparelhos preenchidos e o nome de quem acompanhou a visita. */
export async function concluirChecklist(taskId: string, acompanhadoPor: string): Promise<void> {
  const { error } = await supabase.rpc('pmoc_concluir_checklist', { p_task: taskId, p_acompanhado: acompanhadoPor });
  erroDoBanco(error);
}

/** Token do relatório do mês (cria se ainda não existe) e o link público. */
export async function gerarLinkRelatorio(planId: string, referenceMonth: string): Promise<{ token: string; url: string }> {
  const { data, error } = await supabase.rpc('pmoc_link_relatorio', { p_plano: planId, p_mes: referenceMonth });
  erroDoBanco(error);
  const token = data as string;
  return { token, url: `${window.location.origin}/relatorio-pmoc/${token}` };
}

interface RelatorioPublicoBruto {
  public_token: string;
  reference_month: string;
  plan: Record<string, unknown>;
  environments: PmocEnvironment[];
  equipments: LinhaAparelhoPlano[];
  tasks: PmocEquipmentTask[];
  executions: LinhaExecucao[] & { service_order_number?: number | null; technician_name?: string | null }[];
}

/** Relatório do mês aberto pelo link, sem login. O banco já tirou CPF/CNPJ e observações internas. */
export async function buscarRelatorioPublico(token: string): Promise<PmocMonthlyReport | null> {
  const { data, error } = await supabase.rpc('pmoc_relatorio_publico', { p_token: token.trim() });
  falhar(error, 'Erro ao carregar o relatório');
  if (!data) return null;
  const r = data as RelatorioPublicoBruto;
  const plano = {
    customer_document: null,
    responsible_cpf: null,
    notes: null,
    address_id: null,
    trt_attachment_url: null,
    trt_attachment_name: null,
    trt_attachment_mime: null,
    created_by: null,
    ...r.plan,
  } as unknown as PmocPlan;
  const execucoes = (r.executions as unknown as (LinhaExecucao & { service_order_number: number | null; technician_name: string | null })[]).map(
    (x) => ({ ...paraExecucao({ ...x, ordem: null, tecnico: null }), service_order_number: x.service_order_number, technician_name: x.technician_name }),
  );
  return montarRelatorio(
    plano,
    r.environments.map((a) => ({ ...a, area_m2: Number(a.area_m2) })),
    r.equipments.map(paraAparelho),
    r.tasks.map((t) => ({ ...t, measurement_fields: (t.measurement_fields ?? []) as PmocMeasurementKey[] })),
    execucoes,
    r.reference_month,
    r.public_token,
  );
}

/** Ficha do aparelho aberta pelo QR Code, sem login. */
export async function buscarEquipamentoPublico(token: string): Promise<PmocPublicEquipmentView | null> {
  const { data, error } = await supabase.rpc('pmoc_equipamento_publico', { p_token: token.trim() });
  falhar(error, 'Erro ao carregar a ficha do aparelho');
  return (data as PmocPublicEquipmentView | null) ?? null;
}

/** Manda a etiqueta de cada aparelho (ou de todos os ativos do plano) para a fila da Elgin. */
export async function imprimirEtiquetas(planId: string, idsAparelhos?: string[]): Promise<PmocPrintLabelsResult> {
  const [plano, ambientes, aparelhos] = await Promise.all([buscarPlano(planId), listarAmbientes(planId), listarEquipamentosDoPlano(planId)]);
  if (!plano) throw new Error('Plano PMOC não encontrado.');
  const filtro = idsAparelhos && idsAparelhos.length > 0 ? new Set(idsAparelhos) : null;
  const alvos = aparelhos.filter((e) => e.active && (!filtro || filtro.has(e.id)));
  if (alvos.length === 0) throw new Error('Selecione ao menos um aparelho para imprimir a etiqueta.');
  if (alvos.some((e) => !e.public_token)) throw new Error('Aparelho sem código para o QR. Salve o plano e tente de novo.');

  const nomeAmbiente = new Map(ambientes.map((a) => [a.id, a.name]));
  const pedidos = alvos.map((e) => ({
    kind: 'etiqueta_pmoc',
    payload: gerarZplEtiquetaPmoc({
      identificador: e.identifier,
      cliente: plano.customer_trade_name || plano.customer_name,
      ambiente: e.environment_id ? (nomeAmbiente.get(e.environment_id) ?? '') : '',
      equipamento: [e.equipment_type, e.capacity_btu ? `${e.capacity_btu} BTU` : ''].filter(Boolean).join(' '),
      plano: plano.code,
      token: e.public_token as string,
    }),
    copies: 1,
  }));
  const { error } = await supabase.from('print_jobs').insert(pedidos);
  erroDoBanco(error);
  const qtd = alvos.length;
  return {
    printed_count: qtd,
    message: qtd === 1 ? '1 etiqueta enviada para a impressora' : `${qtd} etiquetas enviadas para a impressora`,
  };
}

// ---------------------------------------------------------------------
// Arquivos (HostGator)
// ---------------------------------------------------------------------

export async function enviarFotoEquipamentoPmoc(arquivo: File): Promise<{ url: string; attachment_id: string | null }> {
  if (!arquivo.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem (JPG, PNG ou WebP).');
  const enviado = await enviarParaHostgator(await compactarImagem(arquivo));
  return { url: enviado.public_url, attachment_id: null };
}

/** Termo TRT/ART: PDF vai como está (até 10 MB); imagem é compactada como as fotos. */
export async function enviarAnexoTrtPmoc(arquivo: File): Promise<{ url: string; file_name: string; mime_type: string }> {
  const ehPdf = arquivo.type === 'application/pdf' || /\.pdf$/i.test(arquivo.name);
  if (!ehPdf && !arquivo.type.startsWith('image/')) throw new Error('Envie um arquivo PDF ou uma imagem (JPG, PNG, WebP) para o termo.');
  if (ehPdf && arquivo.size > 10 * 1024 * 1024) throw new Error('O PDF do termo deve ter no máximo 10 MB.');
  const paraEnviar = ehPdf ? new File([arquivo], arquivo.name.replace(/\.[^.]*$/, '') + '.pdf', { type: 'application/pdf' }) : await compactarImagem(arquivo);
  const enviado = await enviarParaHostgator(paraEnviar);
  return { url: enviado.public_url, file_name: arquivo.name, mime_type: ehPdf ? 'application/pdf' : enviado.mime_type };
}
