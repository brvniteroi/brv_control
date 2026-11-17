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
import type {
  PmocEnvironment,
  PmocEquipmentMonthExecution,
  PmocEquipmentTask,
  PmocGenerateOsResult,
  PmocMeasurementKey,
  PmocMonthlyReport,
  PmocPlan,
  PmocPlanEquipment,
  PmocPlanInput,
  PmocPlanSummary,
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
  equipment: { category: string; brand: string | null; model: string | null; serial_number: string | null; capacity_btu: number | null } | null;
}

const SELECT_APARELHO = '*, equipment:equipments(category, brand, model, serial_number, capacity_btu)';

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
    photo_urls: [], // fotos da visita: fase 2 (app de campo)
    unattended_reason: l.unattended_reason,
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

/** Relatório mensal: mesma consolidação da tela de demonstração, com os dados do banco. */
export async function buscarRelatorioMensal(planId: string, referenceMonth: string): Promise<PmocMonthlyReport | null> {
  const [plano, ambientes, aparelhos, tarefas, execucoes] = await Promise.all([
    buscarPlano(planId),
    listarAmbientes(planId),
    listarEquipamentosDoPlano(planId),
    buscarCronograma(planId),
    listarExecucoes(planId),
  ]);
  if (!plano) return null;

  const offset = gerarMesesDoPlano(plano.start_date).find((m) => m.referencia === referenceMonth)?.offset ?? 1;
  const nomeAmbiente = new Map(ambientes.map((a) => [a.id, a.name]));
  const atendidos: PmocMonthlyReport['attended_equipments'] = [];
  const naoAtendidos: PmocMonthlyReport['unattended_equipments'] = [];
  let numeroOs: number | null = null;
  let tecnico: string | null = null;
  let executadoEm: string | null = null;

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
    attended_equipments: atendidos,
    unattended_equipments: naoAtendidos,
  };
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

/** A OS do mês entra na fase 2 (docs/pmoc.md): botão com técnico, data e hora escolhidos pelo escritório. */
export async function gerarOsDoMes(): Promise<PmocGenerateOsResult> {
  throw new Error('A geração da OS do mês entra na próxima etapa do PMOC. Por enquanto, agende a visita pela linha do tempo.');
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
