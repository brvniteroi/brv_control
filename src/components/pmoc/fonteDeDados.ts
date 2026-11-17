// Única camada de acesso a dados consumida pelas telas do módulo PMOC.
// Com `USAR_BANCO_PMOC = true` (fase 1 de docs/pmoc.md, 2026-11-16) cada função repassa para `src/services/pmoc.ts`;
// com `false`, volta ao estado em memória de `dadosDemo.ts` (some ao recarregar a página).

import * as real from '../../services/pmoc';
import {
  AMBIENTES_INICIAIS_DEMO,
  EQUIPAMENTOS_INICIAIS_DEMO,
  EXECUCOES_INICIAIS_DEMO,
  MODELOS_TAREFA_INICIAIS,
  OS_MES_META_INICIAIS_DEMO,
  PLANOS_INICIAIS_DEMO,
  TAREFAS_INICIAIS_DEMO,
  type OsMesMetaDemo,
} from './dadosDemo';
import {
  calcularEstadoCelulaExecucao,
  calcularSituacaoPlano,
  gerarMesesDoPlano,
  grandezasExigidasNasTarefas,
  letraEquipamento,
  linkPublicoRelatorioPmoc,
  mesAtualLocal,
  motivoBloqueioConclusaoChecklistPmoc,
  tarefasPrevistasNoMes,
  validarExecucaoAparelhoPmoc,
} from './regrasPmoc';
import type {
  PmocActivityChecklist,
  PmocEnvironment,
  PmocEquipmentMonthExecution,
  PmocEquipmentTask,
  PmocFieldEquipmentChecklist,
  PmocGenerateOsResult,
  PmocGenerateOsScheduleInput,
  PmocMonthlyReport,
  PmocMonthPlanItem,
  PmocMonthPlanStatus,
  PmocMonthSummary,
  PmocPlan,
  PmocPlanEquipment,
  PmocPlanInput,
  PmocPlanSummary,
  PmocPrintLabelsResult,
  PmocPublicEquipmentHistoryItem,
  PmocPublicEquipmentView,
  PmocSaveEquipmentExecutionInput,
  PmocTaskTemplate,
  PmocTaskTemplateRow,
} from '../../types/pmoc';

/** Liga as telas ao banco (tabelas `pmoc_*`). */
export const USAR_BANCO_PMOC = true;

/** Enquanto `true`, as telas exibem a faixa discreta "Dados de demonstração". */
export const FONTE_DADOS_DEMO = !USAR_BANCO_PMOC;

// Estado mutável em memória durante a sessão do navegador
let planosMemoria: PmocPlan[] = structuredClone(PLANOS_INICIAIS_DEMO);
let ambientesMemoria: PmocEnvironment[] = structuredClone(AMBIENTES_INICIAIS_DEMO);
let equipamentosMemoria: PmocPlanEquipment[] = structuredClone(EQUIPAMENTOS_INICIAIS_DEMO);
let tarefasMemoria: PmocEquipmentTask[] = structuredClone(TAREFAS_INICIAIS_DEMO);
let execucoesMemoria: PmocEquipmentMonthExecution[] = structuredClone(EXECUCOES_INICIAIS_DEMO);
let modelosMemoria: PmocTaskTemplate[] = structuredClone(MODELOS_TAREFA_INICIAIS);
let osMesMetaMemoria: OsMesMetaDemo[] = structuredClone(OS_MES_META_INICIAIS_DEMO);

let proximoNumeroPlano = 3;
let proximoNumeroOsDemo = 9100;

function gerarTokenDemo(prefixo: string): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefixo}-${hex}`;
}

function obterOuCriarMetaMesDemo(planId: string, referenceMonth: string): OsMesMetaDemo | undefined {
  const achado = osMesMetaMemoria.find(
    (m) => m.plan_id === planId && m.reference_month === referenceMonth,
  );
  if (achado) return achado;

  const execComOs = execucoesMemoria.find(
    (x) => x.plan_id === planId && x.reference_month === referenceMonth && x.service_order_number,
  );
  if (!execComOs || !execComOs.service_order_number) return undefined;

  const novoMeta: OsMesMetaDemo = {
    plan_id: planId,
    reference_month: referenceMonth,
    service_order_id: execComOs.service_order_id ?? crypto.randomUUID(),
    service_order_number: execComOs.service_order_number,
    task_id: `00000000-0000-4000-8000-00000009${execComOs.service_order_number}`,
    technician_id: execComOs.technician_id ?? '',
    technician_name: execComOs.technician_name ?? 'Técnico BRV (Demo)',
    scheduled_start: execComOs.executed_at ?? `${referenceMonth}-10T09:00:00.000Z`,
    estimated_minutes: 60,
    accompanied_by: execComOs.accompanied_by ?? null,
    report_token: `rel-pmoc-${planId.slice(-3)}-${referenceMonth}`,
  };
  osMesMetaMemoria.push(novoMeta);
  return novoMeta;
}

const pausaSimulada = () => new Promise<void>((resolve) => setTimeout(resolve, 120));

function lerArquivoComoDataUrl(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      if (typeof leitor.result === 'string') resolve(leitor.result);
      else reject(new Error('Não foi possível ler o arquivo selecionado.'));
    };
    leitor.onerror = () => reject(new Error('Falha ao ler o arquivo selecionado.'));
    leitor.readAsDataURL(arquivo);
  });
}

function resumirPlano(plano: PmocPlan): PmocPlanSummary {
  const eqsAtivos = equipamentosMemoria.filter((e) => e.plan_id === plano.id && e.active);
  const meses = gerarMesesDoPlano(plano.start_date);
  const mesHoje = mesAtualLocal();

  let visitasAtrasadas = 0;
  let proximaVisita: string | null = null;

  if (plano.status !== 'encerrado' && eqsAtivos.length > 0) {
    for (const mes of meses) {
      let temPrevista = false;
      let temAtrasadaNoMes = false;

      for (const eq of eqsAtivos) {
        const tarefasDoEq = tarefasMemoria.filter((t) => t.plan_equipment_id === eq.id);
        const qtdNoMes = tarefasPrevistasNoMes(tarefasDoEq, mes.offset).length;
        const exec = execucoesMemoria.find(
          (x) => x.plan_equipment_id === eq.id && x.reference_month === mes.referencia,
        );
        const estado = calcularEstadoCelulaExecucao(qtdNoMes, exec, mes.referencia, mesHoje);
        if (estado === 'atrasada') temAtrasadaNoMes = true;
        if (estado === 'prevista' && !proximaVisita && mes.referencia >= mesHoje) {
          temPrevista = true;
        }
      }

      if (plano.status === 'vigente' && temAtrasadaNoMes) {
        visitasAtrasadas += 1;
      }
      if (temPrevista && !proximaVisita) {
        proximaVisita = mes.referencia;
      }
    }
  }

  return {
    ...structuredClone(plano),
    equipment_count: eqsAtivos.length,
    next_visit_month: proximaVisita,
    overdue_visits_count: visitasAtrasadas,
  };
}

/** Lista todos os planos PMOC com resumo de equipamentos, próxima visita e atrasos. */
export async function listarPlanos(): Promise<PmocPlanSummary[]> {
  if (USAR_BANCO_PMOC) return real.listarPlanos();
  await pausaSimulada();
  return [...planosMemoria]
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
    .map(resumirPlano);
}

/** Busca um plano PMOC pelo `id` (ou `null` quando inexistente). */
export async function buscarPlano(id: string): Promise<PmocPlan | null> {
  if (USAR_BANCO_PMOC) return real.buscarPlano(id);
  await pausaSimulada();
  const achado = planosMemoria.find((p) => p.id === id);
  return achado ? structuredClone(achado) : null;
}

/** Cria ou atualiza os dados gerais de um plano PMOC e devolve o registro salvo. */
export async function salvarPlano(dados: PmocPlanInput): Promise<PmocPlan> {
  await pausaSimulada();
  const agora = new Date().toISOString();

  if (dados.id) {
    const idx = planosMemoria.findIndex((p) => p.id === dados.id);
    if (idx === -1) throw new Error('Plano PMOC não encontrado para atualização.');
    const atualizado: PmocPlan = {
      ...planosMemoria[idx],
      ...structuredClone(dados),
      id: dados.id,
      code: planosMemoria[idx].code,
      created_at: planosMemoria[idx].created_at,
      updated_at: agora,
    };
    planosMemoria[idx] = atualizado;
    return structuredClone(atualizado);
  }

  const ano = dados.start_date.slice(0, 4) || String(new Date().getFullYear());
  proximoNumeroPlano += 1;
  const novo: PmocPlan = {
    ...structuredClone(dados),
    id: crypto.randomUUID(),
    code: `PMOC-${ano}-${String(proximoNumeroPlano).padStart(4, '0')}`,
    created_at: agora,
    updated_at: agora,
  };
  planosMemoria = [novo, ...planosMemoria];
  return structuredClone(novo);
}

/** Lista os ambientes climatizados de um plano na ordem configurada. */
export async function listarAmbientes(planId: string): Promise<PmocEnvironment[]> {
  if (USAR_BANCO_PMOC) return real.listarAmbientes(planId);
  await pausaSimulada();
  return ambientesMemoria
    .filter((a) => a.plan_id === planId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((a) => structuredClone(a));
}

export interface SalvarAmbienteItemInput {
  id?: string;
  name: string;
  code: string;
  fixed_occupants: number;
  floating_occupants: number;
  area_m2: number;
}

/** Substitui/sincroniza a lista de ambientes de um plano (desvinculando aparelhos de ambientes removidos). */
export async function salvarAmbientes(
  planId: string,
  itens: SalvarAmbienteItemInput[],
): Promise<PmocEnvironment[]> {
  await pausaSimulada();
  const agora = new Date().toISOString();
  const atuaisPorId = new Map(
    ambientesMemoria.filter((a) => a.plan_id === planId).map((a) => [a.id, a]),
  );

  const salvos: PmocEnvironment[] = itens.map((item, idx) => {
    const existente = item.id ? atuaisPorId.get(item.id) : undefined;
    return {
      id: existente?.id ?? item.id ?? crypto.randomUUID(),
      plan_id: planId,
      name: item.name.trim(),
      code: item.code.trim().toUpperCase(),
      fixed_occupants: Math.max(0, Math.trunc(item.fixed_occupants)),
      floating_occupants: Math.max(0, Math.trunc(item.floating_occupants)),
      area_m2: Math.max(0, Number(item.area_m2.toFixed(2))),
      sort_order: idx + 1,
      created_at: existente?.created_at ?? agora,
    };
  });

  const idsMantidos = new Set(salvos.map((s) => s.id));

  // Qualquer equipamento do plano cujo ambiente foi excluído passa a ter `environment_id = null`
  equipamentosMemoria = equipamentosMemoria.map((eq) =>
    eq.plan_id === planId && eq.environment_id && !idsMantidos.has(eq.environment_id)
      ? { ...eq, environment_id: null }
      : eq,
  );

  ambientesMemoria = [
    ...ambientesMemoria.filter((a) => a.plan_id !== planId),
    ...salvos,
  ];

  return salvos.map((s) => structuredClone(s));
}

/** Lista os equipamentos vinculados a um plano PMOC na ordem configurada. */
export async function listarEquipamentosDoPlano(planId: string): Promise<PmocPlanEquipment[]> {
  if (USAR_BANCO_PMOC) return real.listarEquipamentosDoPlano(planId);
  await pausaSimulada();
  return equipamentosMemoria
    .filter((e) => e.plan_id === planId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((e) => structuredClone(e));
}

export interface SalvarEquipamentoPlanoInput {
  id?: string;
  equipment_id: string | null;
  environment_id: string | null;
  equipment_type: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  capacity_btu: number;
  identifier: string;
  photo_url: string | null;
  photo_attachment_id: string | null;
  active: boolean;
}

/**
 * Sincroniza os equipamentos de um plano. Novos equipamentos já recebem automaticamente
 * as tarefas do modelo padrão correspondente ao seu `equipment_type` (ou o modelo Split Hi-Wall).
 */
export async function salvarEquipamentosDoPlano(
  planId: string,
  itens: SalvarEquipamentoPlanoInput[],
): Promise<PmocPlanEquipment[]> {
  await pausaSimulada();
  const agora = new Date().toISOString();
  const atuaisPorId = new Map(
    equipamentosMemoria.filter((e) => e.plan_id === planId).map((e) => [e.id, e]),
  );

  const salvos: PmocPlanEquipment[] = itens.map((item, idx) => {
    const existente = item.id ? atuaisPorId.get(item.id) : undefined;
    return {
      id: existente?.id ?? item.id ?? crypto.randomUUID(),
      plan_id: planId,
      equipment_id: item.equipment_id,
      environment_id: item.environment_id,
      equipment_type: item.equipment_type.trim(),
      name: item.name.trim(),
      brand: item.brand,
      model: item.model,
      serial_number: item.serial_number,
      capacity_btu: Math.max(0, Math.round(item.capacity_btu)),
      identifier: item.identifier.trim().toUpperCase(),
      photo_url: item.photo_url,
      photo_attachment_id: item.photo_attachment_id,
      sort_order: idx + 1,
      active: item.active,
      public_token: existente?.public_token ?? gerarTokenDemo('eq-pmoc'),
      created_at: existente?.created_at ?? agora,
    };
  });

  const idsMantidos = new Set(salvos.map((s) => s.id));

  // Remove tarefas e execuções de aparelhos removidos do plano
  tarefasMemoria = tarefasMemoria.filter(
    (t) => t.plan_id !== planId || idsMantidos.has(t.plan_equipment_id),
  );
  execucoesMemoria = execucoesMemoria.filter(
    (x) => x.plan_id !== planId || idsMantidos.has(x.plan_equipment_id),
  );

  // Inicializa cronograma padrão para aparelhos recém-adicionados que ainda não tenham tarefas
  for (const eq of salvos) {
    const jaTemTarefas = tarefasMemoria.some((t) => t.plan_equipment_id === eq.id);
    if (!jaTemTarefas) {
      const modelo = escolherModeloPorTipo(eq.equipment_type);
      if (modelo) {
        const novasTarefas: PmocEquipmentTask[] = modelo.tasks.map((t, idx) => ({
          id: crypto.randomUUID(),
          plan_id: planId,
          plan_equipment_id: eq.id,
          template_item_id: t.id,
          description: t.description,
          periodicity: t.periodicity,
          start_month_offset: t.relative_start_month,
          requires_measurement: t.requires_measurement,
          measurement_fields: [...t.measurement_fields],
          sort_order: idx + 1,
          active: true,
        }));
        tarefasMemoria.push(...novasTarefas);
      }
    }
  }

  equipamentosMemoria = [
    ...equipamentosMemoria.filter((e) => e.plan_id !== planId),
    ...salvos,
  ];

  return salvos.map((s) => structuredClone(s));
}

function escolherModeloPorTipo(tipoEquipamento: string): PmocTaskTemplate | undefined {
  const normalizado = tipoEquipamento.trim().toLowerCase();
  return (
    modelosMemoria.find((m) => m.equipment_type.trim().toLowerCase() === normalizado) ??
    modelosMemoria[0]
  );
}

/** Busca todas as tarefas do cronograma dos equipamentos de um plano. */
export async function buscarCronograma(planId: string): Promise<PmocEquipmentTask[]> {
  if (USAR_BANCO_PMOC) return real.buscarCronograma(planId);
  await pausaSimulada();
  return tarefasMemoria
    .filter((t) => t.plan_id === planId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((t) => structuredClone(t));
}

/** Grava o cronograma completo de tarefas de todos os equipamentos de um plano. */
export async function salvarCronograma(
  planId: string,
  tarefas: PmocEquipmentTask[],
): Promise<PmocEquipmentTask[]> {
  await pausaSimulada();
  // Renumera `sort_order` por equipamento para manter consistência
  const porEquipamento = new Map<string, PmocEquipmentTask[]>();
  for (const t of tarefas) {
    const lista = porEquipamento.get(t.plan_equipment_id) ?? [];
    lista.push(structuredClone(t));
    porEquipamento.set(t.plan_equipment_id, lista);
  }

  const normalizadas: PmocEquipmentTask[] = [];
  for (const [, lista] of porEquipamento) {
    lista.forEach((item, idx) => {
      normalizadas.push({
        ...item,
        id: item.id || crypto.randomUUID(),
        plan_id: planId,
        description: item.description.trim(),
        start_month_offset: Math.min(12, Math.max(1, Math.trunc(item.start_month_offset || 1))),
        sort_order: idx + 1,
      });
    });
  }

  tarefasMemoria = [
    ...tarefasMemoria.filter((t) => t.plan_id !== planId),
    ...normalizadas,
  ];

  return normalizadas.map((t) => structuredClone(t));
}

/** Lista todos os registros de execução mensal de um plano PMOC. */
export async function listarExecucoes(planId: string): Promise<PmocEquipmentMonthExecution[]> {
  if (USAR_BANCO_PMOC) return real.listarExecucoes(planId);
  await pausaSimulada();
  return execucoesMemoria
    .filter((x) => x.plan_id === planId)
    .map((x) => structuredClone(x));
}

/**
 * Gera a Ordem de Serviço preventiva do mês com o técnico, data/hora e duração escolhidos
 * pelo escritório (`Entrega 1`). Não duplica caso o mês já possua OS vinculada.
 */
export async function gerarOsDoMes(
  planId: string,
  referenceMonth: string,
  agendamento: PmocGenerateOsScheduleInput,
): Promise<PmocGenerateOsResult> {
  if (USAR_BANCO_PMOC) return real.gerarOsDoMes(planId, referenceMonth, agendamento);
  await pausaSimulada();
  const plano = planosMemoria.find((p) => p.id === planId);
  if (!plano) throw new Error('Plano PMOC não encontrado.');

  if (!agendamento.technician_id.trim()) {
    throw new Error('Escolha o técnico responsável pela visita.');
  }
  if (!agendamento.scheduled_start || !agendamento.scheduled_start.includes('T')) {
    throw new Error('Informe a data e a hora de início do agendamento.');
  }
  if (!Number.isFinite(agendamento.estimated_minutes) || agendamento.estimated_minutes <= 0) {
    throw new Error('Informe a duração prevista da visita em minutos.');
  }

  const meses = gerarMesesDoPlano(plano.start_date);
  const infoMes = meses.find((m) => m.referencia === referenceMonth);
  if (!infoMes) {
    throw new Error('O mês selecionado está fora do período de vigência deste plano.');
  }

  const eqsAtivos = equipamentosMemoria
    .filter((e) => e.plan_id === planId && e.active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const aplicaveis = eqsAtivos.filter((eq) => {
    const tarefasDoEq = tarefasMemoria.filter((t) => t.plan_equipment_id === eq.id);
    return tarefasPrevistasNoMes(tarefasDoEq, infoMes.offset).length > 0;
  });

  if (aplicaveis.length === 0) {
    throw new Error('Nenhum equipamento possui tarefas ativas previstas para este mês.');
  }

  // Confere se já existe OS vinculada para este mês (não permite gerar outra)
  const metaExistente = obterOuCriarMetaMesDemo(planId, referenceMonth);
  if (metaExistente) {
    return {
      service_order_id: metaExistente.service_order_id,
      service_order_number: metaExistente.service_order_number,
      task_id: metaExistente.task_id,
      reference_month: referenceMonth,
      equipments_included: aplicaveis.length,
      already_existed: true,
      message: `OS #${metaExistente.service_order_number} já gerada para este mês (${infoMes.rotuloExtenso}).`,
    };
  }

  proximoNumeroOsDemo += 1;
  const osNumero = proximoNumeroOsDemo;
  const osId = crypto.randomUUID();
  const taskId = crypto.randomUUID();
  const agora = new Date().toISOString();
  const nomeTecnico =
    agendamento.technician_name?.trim() || plano.responsible_name || 'Técnico de Campo';

  osMesMetaMemoria.push({
    plan_id: planId,
    reference_month: referenceMonth,
    service_order_id: osId,
    service_order_number: osNumero,
    task_id: taskId,
    technician_id: agendamento.technician_id,
    technician_name: nomeTecnico,
    scheduled_start: agendamento.scheduled_start,
    estimated_minutes: Math.round(agendamento.estimated_minutes),
    accompanied_by: null,
    report_token: gerarTokenDemo('rel-pmoc'),
  });

  for (const eq of aplicaveis) {
    const idxExistente = execucoesMemoria.findIndex(
      (x) => x.plan_equipment_id === eq.id && x.reference_month === referenceMonth,
    );
    if (idxExistente >= 0) {
      execucoesMemoria[idxExistente] = {
        ...execucoesMemoria[idxExistente],
        service_order_id: osId,
        service_order_number: osNumero,
        technician_id: agendamento.technician_id,
        technician_name: nomeTecnico,
        updated_at: agora,
      };
    } else {
      execucoesMemoria.push({
        id: crypto.randomUUID(),
        plan_id: planId,
        plan_equipment_id: eq.id,
        reference_month: referenceMonth,
        status: 'pendente',
        service_order_id: osId,
        service_order_number: osNumero,
        technician_id: agendamento.technician_id,
        technician_name: nomeTecnico,
        executed_at: null,
        measurements: {
          current_a: null,
          temp_supply_c: null,
          temp_return_c: null,
          temp_ambient_c: null,
        },
        task_results: [],
        technician_notes: null,
        photo_urls: [],
        unattended_reason: null,
        accompanied_by: null,
        updated_at: agora,
      });
    }
  }

  return {
    service_order_id: osId,
    service_order_number: osNumero,
    task_id: taskId,
    reference_month: referenceMonth,
    equipments_included: aplicaveis.length,
    already_existed: false,
    message: `OS preventiva #${osNumero} gerada e agendada para ${infoMes.rotuloExtenso} (${aplicaveis.length} aparelho(s)).`,
  };
}

/** Consolida os dados do Relatório Mensal de Execução (Entrega 4) de um plano e mês. */
export async function buscarRelatorioMensal(
  planId: string,
  referenceMonth: string,
): Promise<PmocMonthlyReport | null> {
  if (USAR_BANCO_PMOC) return real.buscarRelatorioMensal(planId, referenceMonth);
  await pausaSimulada();
  const plano = planosMemoria.find((p) => p.id === planId);
  if (!plano) return null;

  const meses = gerarMesesDoPlano(plano.start_date);
  const infoMes = meses.find((m) => m.referencia === referenceMonth);
  const monthOffset = infoMes?.offset ?? 1;

  const ambientes = ambientesMemoria
    .filter((a) => a.plan_id === planId)
    .sort((a, b) => a.sort_order - b.sort_order);
  const nomeAmbientePorId = new Map(ambientes.map((a) => [a.id, a.name]));

  const eqs = equipamentosMemoria
    .filter((e) => e.plan_id === planId && e.active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const atendidos: PmocMonthlyReport['attended_equipments'] = [];
  const naoAtendidos: PmocMonthlyReport['unattended_equipments'] = [];

  let osNumeroPrincipal: number | null = null;
  let tecnicoPrincipal: string | null = null;
  let executadoEmPrincipal: string | null = null;

  eqs.forEach((eq, idx) => {
    const letra = letraEquipamento(idx);
    const tarefasDoEq = tarefasMemoria.filter((t) => t.plan_equipment_id === eq.id);
    const previstas = tarefasPrevistasNoMes(tarefasDoEq, monthOffset);
    if (previstas.length === 0) return;

    const exec = execucoesMemoria.find(
      (x) => x.plan_equipment_id === eq.id && x.reference_month === referenceMonth,
    );

    if (exec?.service_order_number && !osNumeroPrincipal) {
      osNumeroPrincipal = exec.service_order_number;
    }
    if (exec?.technician_name && !tecnicoPrincipal) {
      tecnicoPrincipal = exec.technician_name;
    }
    if (exec?.executed_at && !executadoEmPrincipal) {
      executadoEmPrincipal = exec.executed_at;
    }

    const nomeAmb = eq.environment_id ? (nomeAmbientePorId.get(eq.environment_id) ?? null) : null;

    if (exec && exec.status === 'concluida') {
      // Se o registro concluído estiver sem itens detalhados, preenche com as previstas do cronograma
      const execCompleta: PmocEquipmentMonthExecution = {
        ...structuredClone(exec),
        task_results:
          exec.task_results.length > 0
            ? structuredClone(exec.task_results)
            : previstas.map((t) => ({
                equipment_task_id: t.id,
                description: t.description,
                periodicity: t.periodicity,
                result: 'feito',
                notes: null,
              })),
      };
      atendidos.push({
        equipment: structuredClone(eq),
        letter: letra,
        environment_name: nomeAmb,
        execution: execCompleta,
      });
    } else {
      const motivo =
        exec?.unattended_reason?.trim() ||
        (exec?.status === 'pendente'
          ? 'Manutenção prevista na OS, ainda pendente de conclusão em campo.'
          : 'Visita preventiva ainda não registrada para este equipamento no mês.');
      naoAtendidos.push({
        equipment: structuredClone(eq),
        letter: letra,
        environment_name: nomeAmb,
        reason: motivo,
      });
    }
  });

  const metaMes = obterOuCriarMetaMesDemo(planId, referenceMonth);
  const acompanhadoPorRelatorio =
    metaMes?.accompanied_by ??
    execucoesMemoria.find(
      (x) => x.plan_id === planId && x.reference_month === referenceMonth && x.accompanied_by,
    )?.accompanied_by ??
    null;

  return {
    plan: structuredClone(plano),
    environments: structuredClone(ambientes),
    reference_month: referenceMonth,
    month_offset: monthOffset,
    service_order_number: osNumeroPrincipal ?? metaMes?.service_order_number ?? null,
    technician_name: tecnicoPrincipal ?? metaMes?.technician_name ?? null,
    executed_at: executadoEmPrincipal,
    accompanied_by: acompanhadoPorRelatorio,
    public_token: metaMes?.report_token ?? null,
    attended_equipments: atendidos,
    unattended_equipments: naoAtendidos,
  };
}

/** Lista todos os modelos padrão de tarefas por tipo de equipamento (`/pmoc/modelo`). */
export async function listarModelosDeTarefa(): Promise<PmocTaskTemplate[]> {
  if (USAR_BANCO_PMOC) return real.listarModelosDeTarefa();
  await pausaSimulada();
  return [...modelosMemoria]
    .sort((a, b) => a.equipment_type.localeCompare(b.equipment_type, 'pt-BR'))
    .map((m) => structuredClone(m));
}

export interface SalvarModeloDeTarefaInput {
  id?: string;
  equipment_type: string;
  description: string | null;
  tasks: Omit<PmocTaskTemplateRow, 'sort_order'>[];
}

/** Cria ou atualiza o modelo padrão de tarefas de um tipo de equipamento. */
export async function salvarModeloDeTarefa(
  dados: SalvarModeloDeTarefaInput,
): Promise<PmocTaskTemplate> {
  if (USAR_BANCO_PMOC) return real.salvarModeloDeTarefa(dados);
  await pausaSimulada();
  const agora = new Date().toISOString();
  const tipoLimpo = dados.equipment_type.trim();

  const duplicado = modelosMemoria.find(
    (m) => m.id !== dados.id && m.equipment_type.trim().toLowerCase() === tipoLimpo.toLowerCase(),
  );
  if (duplicado) {
    throw new Error(`Já existe um modelo cadastrado para o tipo "${tipoLimpo}".`);
  }

  const linhas: PmocTaskTemplateRow[] = dados.tasks.map((t, idx) => ({
    id: t.id || crypto.randomUUID(),
    description: t.description.trim(),
    periodicity: t.periodicity,
    relative_start_month: Math.min(12, Math.max(1, Math.trunc(t.relative_start_month || 1))),
    requires_measurement: Boolean(t.requires_measurement),
    measurement_fields: t.requires_measurement ? [...t.measurement_fields] : [],
    sort_order: idx + 1,
  }));

  if (dados.id) {
    const idx = modelosMemoria.findIndex((m) => m.id === dados.id);
    if (idx === -1) throw new Error('Modelo de tarefas não encontrado.');
    const atualizado: PmocTaskTemplate = {
      id: dados.id,
      equipment_type: tipoLimpo,
      description: dados.description?.trim() || null,
      tasks: linhas,
      updated_at: agora,
    };
    modelosMemoria[idx] = atualizado;
    return structuredClone(atualizado);
  }

  const novo: PmocTaskTemplate = {
    id: crypto.randomUUID(),
    equipment_type: tipoLimpo,
    description: dados.description?.trim() || null,
    tasks: linhas,
    updated_at: agora,
  };
  modelosMemoria.push(novo);
  return structuredClone(novo);
}

/** O que o editor manda ao clicar em Salvar: o plano inteiro. */
export interface SalvarPlanoCompletoInput {
  plano: PmocPlanInput;
  ambientes: SalvarAmbienteItemInput[];
  equipamentos: SalvarEquipamentoPlanoInput[];
  tarefas: PmocEquipmentTask[];
}

/**
 * Grava dados gerais, ambientes, aparelhos e cronograma e devolve tudo como ficou gravado.
 * No banco é uma transação só (`pmoc_salvar_plano`): ou grava tudo, ou nada.
 */
export async function salvarPlanoCompleto(dados: SalvarPlanoCompletoInput): Promise<{
  plano: PmocPlan;
  ambientes: PmocEnvironment[];
  equipamentos: PmocPlanEquipment[];
  tarefas: PmocEquipmentTask[];
}> {
  if (USAR_BANCO_PMOC) {
    const id = await real.salvarPlanoCompleto(dados);
    const [plano, ambientes, equipamentos, tarefas] = await Promise.all([
      real.buscarPlano(id),
      real.listarAmbientes(id),
      real.listarEquipamentosDoPlano(id),
      real.buscarCronograma(id),
    ]);
    if (!plano) throw new Error('O plano foi gravado, mas não foi possível recarregá-lo.');
    return { plano, ambientes, equipamentos, tarefas };
  }
  const plano = await salvarPlano(dados.plano);
  const ambientes = await salvarAmbientes(plano.id, dados.ambientes);
  const equipamentos = await salvarEquipamentosDoPlano(plano.id, dados.equipamentos);
  const tarefas =
    dados.tarefas.length > 0
      ? await salvarCronograma(plano.id, dados.tarefas.map((t) => ({ ...t, plan_id: plano.id })))
      : await buscarCronograma(plano.id);
  return { plano, ambientes, equipamentos, tarefas };
}

/** Nome, CPF e registro do responsável técnico escolhido (vêm do cadastro do funcionário). */
export async function buscarDadosResponsavel(employeeId: string) {
  if (USAR_BANCO_PMOC) return real.buscarDadosResponsavel(employeeId);
  return null;
}

/** Responsável técnico sugerido no plano novo (o único funcionário com registro profissional). */
export async function responsavelPadrao(): Promise<string | null> {
  if (USAR_BANCO_PMOC) return real.responsavelPadrao();
  return null;
}

/** Processa o envio da foto de identificação de um equipamento do plano (em memória no modo demo). */
export async function enviarFotoEquipamentoPmoc(
  arquivo: File,
): Promise<{ url: string; attachment_id: string | null }> {
  if (USAR_BANCO_PMOC) return real.enviarFotoEquipamentoPmoc(arquivo);
  if (!arquivo.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem (JPG, PNG ou WebP).');
  }
  if (arquivo.size > 10 * 1024 * 1024) {
    throw new Error('A imagem deve ter no máximo 10 MB.');
  }
  await pausaSimulada();
  const url = await lerArquivoComoDataUrl(arquivo);
  return { url, attachment_id: null };
}

/** Processa o envio do PDF ou imagem do TRT/ART do plano (em memória no modo demo). */
export async function enviarAnexoTrtPmoc(
  arquivo: File,
): Promise<{ url: string; file_name: string; mime_type: string }> {
  if (USAR_BANCO_PMOC) return real.enviarAnexoTrtPmoc(arquivo);
  const aceito = arquivo.type === 'application/pdf' || arquivo.type.startsWith('image/');
  if (!aceito) {
    throw new Error('Envie um arquivo PDF ou uma imagem (JPG, PNG, WebP) para o termo.');
  }
  if (arquivo.size > 12 * 1024 * 1024) {
    throw new Error('O arquivo do termo deve ter no máximo 12 MB.');
  }
  await pausaSimulada();
  const url = await lerArquivoComoDataUrl(arquivo);
  return {
    url,
    file_name: arquivo.name,
    mime_type: arquivo.type || 'application/octet-stream',
  };
}

// ============================================================================
// NOVAS FUNÇÕES DAS FASES 2 E 3 (DEMONSTRAÇÃO EM MEMÓRIA + DESVIO P/ CLAUDE)
// ============================================================================

/**
 * Entrega 2: devolve a consolidação do painel "PMOC do mês" e do cartão do Dashboard
 * para o mês `referenceMonth` (`YYYY-MM`).
 */
export async function resumoDoMes(referenceMonth: string): Promise<PmocMonthSummary> {
  if (USAR_BANCO_PMOC) return real.resumoDoMes(referenceMonth);
  await pausaSimulada();

  const mesHoje = mesAtualLocal();
  const planosVigentes = planosMemoria.filter((p) => {
    const sit = calcularSituacaoPlano(p.status, p.end_date).situacao;
    return sit === 'vigente' || sit === 'vencendo';
  });

  const counts = {
    sem_os: 0,
    os_agendada: 0,
    executada: 0,
    atrasada: 0,
  };

  const items: PmocMonthPlanItem[] = [];

  for (const plano of planosVigentes) {
    const meses = gerarMesesDoPlano(plano.start_date);
    const infoMes = meses.find((m) => m.referencia === referenceMonth);
    if (!infoMes) continue;

    const eqsAtivos = equipamentosMemoria
      .filter((e) => e.plan_id === plano.id && e.active)
      .sort((a, b) => a.sort_order - b.sort_order);

    let eqsComTarefa = 0;
    let totalTarefasNoMes = 0;
    let concluidosOuJustificados = 0;

    for (const eq of eqsAtivos) {
      const tarefasEq = tarefasMemoria.filter((t) => t.plan_equipment_id === eq.id);
      const previstas = tarefasPrevistasNoMes(tarefasEq, infoMes.offset);
      if (previstas.length === 0) continue;

      eqsComTarefa += 1;
      totalTarefasNoMes += previstas.length;

      const exec = execucoesMemoria.find(
        (x) => x.plan_equipment_id === eq.id && x.reference_month === referenceMonth,
      );
      if (exec && (exec.status === 'concluida' || exec.status === 'nao_atendido')) {
        concluidosOuJustificados += 1;
      }
    }

    if (eqsComTarefa === 0) continue;

    const meta = obterOuCriarMetaMesDemo(plano.id, referenceMonth);
    const execucoesDoMes = execucoesMemoria.filter(
      (x) => x.plan_id === plano.id && x.reference_month === referenceMonth,
    );

    const osNumero =
      meta?.service_order_number ??
      execucoesDoMes.find((x) => x.service_order_number)?.service_order_number ??
      null;
    const osId =
      meta?.service_order_id ??
      execucoesDoMes.find((x) => x.service_order_id)?.service_order_id ??
      null;
    const tecnicoId =
      meta?.technician_id ??
      execucoesDoMes.find((x) => x.technician_id)?.technician_id ??
      plano.responsible_employee_id;
    const tecnicoNome =
      meta?.technician_name ??
      execucoesDoMes.find((x) => x.technician_name)?.technician_name ??
      (osNumero ? plano.responsible_name : null);
    const executadoEm =
      execucoesDoMes.find((x) => x.executed_at)?.executed_at ?? null;
    const acompanhadoPor =
      meta?.accompanied_by ??
      execucoesDoMes.find((x) => x.accompanied_by)?.accompanied_by ??
      null;

    let status: PmocMonthPlanStatus;
    if (concluidosOuJustificados === eqsComTarefa) {
      status = 'executada';
    } else if (referenceMonth < mesHoje) {
      status = 'atrasada';
    } else if (osNumero) {
      status = 'os_agendada';
    } else {
      status = 'sem_os';
    }

    counts[status] += 1;

    items.push({
      plan_id: plano.id,
      plan_code: plano.code,
      customer_id: plano.customer_id,
      customer_name: plano.customer_name,
      customer_trade_name: plano.customer_trade_name,
      customer_phone: plano.customer_phone,
      address_snapshot: structuredClone(plano.address_snapshot),
      reference_month: referenceMonth,
      month_offset: infoMes.offset,
      equipment_count_in_month: eqsComTarefa,
      task_count_in_month: totalTarefasNoMes,
      status,
      service_order_id: osId,
      service_order_number: osNumero,
      task_id: meta?.task_id ?? null,
      technician_id: tecnicoId,
      technician_name: tecnicoNome,
      scheduled_start: meta?.scheduled_start ?? null,
      executed_at: executadoEm,
      accompanied_by: acompanhadoPor,
      report_token: meta?.report_token ?? null,
    });
  }

  return {
    reference_month: referenceMonth,
    active_plans_total: planosVigentes.length,
    counts,
    items,
  };
}

/**
 * Entrega 3: verifica se uma atividade do técnico (`taskId`) pertence a uma OS de PMOC
 * e devolve os aparelhos e tarefas previstas no mês para preenchimento no celular.
 */
export async function buscarChecklistDaAtividade(
  taskId: string,
): Promise<PmocActivityChecklist> {
  if (USAR_BANCO_PMOC) return real.buscarChecklistDaAtividade(taskId);
  await pausaSimulada();

  // Na demonstração, localiza pelo `task_id` ou `service_order_id`; se o técnico abrir uma atividade qualquer
  // com a demonstração ligada, permite testar também pela OS de novembro do Plano 1 quando `taskId` coincidir.
  const meta =
    osMesMetaMemoria.find(
      (m) => m.task_id === taskId || m.service_order_id === taskId,
    ) ?? osMesMetaMemoria.find((m) => m.reference_month === '2026-11' && m.service_order_number === 9088);

  if (!meta) {
    return {
      is_pmoc: false,
      task_id: taskId,
      service_order_id: null,
      service_order_number: null,
      plan_id: null,
      plan_code: null,
      customer_name: null,
      reference_month: null,
      accompanied_by: null,
      equipments: [],
    };
  }

  const plano = planosMemoria.find((p) => p.id === meta.plan_id);
  if (!plano) {
    return {
      is_pmoc: false,
      task_id: taskId,
      service_order_id: null,
      service_order_number: null,
      plan_id: null,
      plan_code: null,
      customer_name: null,
      reference_month: null,
      accompanied_by: null,
      equipments: [],
    };
  }

  const meses = gerarMesesDoPlano(plano.start_date);
  const infoMes = meses.find((m) => m.referencia === meta.reference_month);
  const offset = infoMes?.offset ?? 1;

  const ambientes = ambientesMemoria.filter((a) => a.plan_id === plano.id);
  const nomeAmbPorId = new Map(ambientes.map((a) => [a.id, a.name]));

  const eqsAtivos = equipamentosMemoria
    .filter((e) => e.plan_id === plano.id && e.active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const aparelhosChecklist: PmocFieldEquipmentChecklist[] = [];

  eqsAtivos.forEach((eq, idx) => {
    const tarefasDoEq = tarefasMemoria.filter((t) => t.plan_equipment_id === eq.id);
    const previstas = tarefasPrevistasNoMes(tarefasDoEq, offset);
    if (previstas.length === 0) return;

    const exec = execucoesMemoria.find(
      (x) => x.plan_equipment_id === eq.id && x.reference_month === meta.reference_month,
    );

    aparelhosChecklist.push({
      plan_equipment_id: eq.id,
      equipment_id: eq.equipment_id,
      letter: letraEquipamento(idx),
      name: eq.name,
      identifier: eq.identifier,
      environment_name: eq.environment_id ? (nomeAmbPorId.get(eq.environment_id) ?? null) : null,
      equipment_type: eq.equipment_type,
      capacity_btu: eq.capacity_btu,
      status: exec?.status ?? 'pendente',
      scheduled_tasks: structuredClone(previstas),
      required_measurements: grandezasExigidasNasTarefas(previstas),
      task_results: exec?.task_results ? structuredClone(exec.task_results) : [],
      measurements: exec?.measurements
        ? structuredClone(exec.measurements)
        : {
            current_a: null,
            temp_supply_c: null,
            temp_return_c: null,
            temp_ambient_c: null,
          },
      technician_notes: exec?.technician_notes ?? null,
      photo_urls: exec?.photo_urls ? [...exec.photo_urls] : [],
      unattended_reason: exec?.unattended_reason ?? null,
      updated_at: exec?.updated_at ?? null,
    });
  });

  return {
    is_pmoc: true,
    task_id: meta.task_id,
    service_order_id: meta.service_order_id,
    service_order_number: meta.service_order_number,
    plan_id: plano.id,
    plan_code: plano.code,
    customer_name: plano.customer_trade_name || plano.customer_name,
    reference_month: meta.reference_month,
    accompanied_by: meta.accompanied_by,
    equipments: aparelhosChecklist,
  };
}

/**
 * Entrega 3: grava o preenchimento de um aparelho individual no checklist de campo.
 */
export async function salvarExecucaoAparelho(
  dados: PmocSaveEquipmentExecutionInput,
): Promise<PmocEquipmentMonthExecution> {
  if (USAR_BANCO_PMOC) return real.salvarExecucaoAparelho(dados);
  await pausaSimulada();

  const plano = planosMemoria.find((p) => p.id === dados.plan_id);
  if (!plano) throw new Error('Plano PMOC não encontrado.');

  const meses = gerarMesesDoPlano(plano.start_date);
  const infoMes = meses.find((m) => m.referencia === dados.reference_month);
  const offset = infoMes?.offset ?? 1;

  const tarefasDoEq = tarefasMemoria.filter(
    (t) => t.plan_equipment_id === dados.plan_equipment_id,
  );
  const previstas = tarefasPrevistasNoMes(tarefasDoEq, offset);

  const erroValidacao = validarExecucaoAparelhoPmoc({
    status: dados.status,
    tarefasPrevistas: previstas,
    resultadosTarefas: dados.task_results,
    medicoes: dados.measurements,
    motivoNaoAtendido: dados.unattended_reason,
  });
  if (erroValidacao) {
    throw new Error(erroValidacao);
  }

  const agora = new Date().toISOString();
  const meta = obterOuCriarMetaMesDemo(dados.plan_id, dados.reference_month);

  const idx = execucoesMemoria.findIndex(
    (x) =>
      x.plan_equipment_id === dados.plan_equipment_id &&
      x.reference_month === dados.reference_month,
  );

  const registro: PmocEquipmentMonthExecution = {
    id: idx >= 0 ? execucoesMemoria[idx].id : crypto.randomUUID(),
    plan_id: dados.plan_id,
    plan_equipment_id: dados.plan_equipment_id,
    reference_month: dados.reference_month,
    status: dados.status,
    service_order_id:
      (idx >= 0 ? execucoesMemoria[idx].service_order_id : null) ??
      meta?.service_order_id ??
      null,
    service_order_number:
      (idx >= 0 ? execucoesMemoria[idx].service_order_number : null) ??
      meta?.service_order_number ??
      null,
    technician_id:
      (idx >= 0 ? execucoesMemoria[idx].technician_id : null) ??
      meta?.technician_id ??
      plano.responsible_employee_id,
    technician_name:
      (idx >= 0 ? execucoesMemoria[idx].technician_name : null) ??
      meta?.technician_name ??
      plano.responsible_name,
    executed_at: agora,
    measurements:
      dados.status === 'concluida'
        ? structuredClone(dados.measurements)
        : {
            current_a: null,
            temp_supply_c: null,
            temp_return_c: null,
            temp_ambient_c: null,
          },
    task_results: dados.status === 'concluida' ? structuredClone(dados.task_results) : [],
    technician_notes: dados.technician_notes?.trim() || null,
    photo_urls: [...dados.photo_urls],
    unattended_reason:
      dados.status === 'nao_atendido' ? (dados.unattended_reason?.trim() ?? null) : null,
    accompanied_by: meta?.accompanied_by ?? null,
    updated_at: agora,
  };

  if (idx >= 0) {
    execucoesMemoria[idx] = registro;
  } else {
    execucoesMemoria.push(registro);
  }

  return structuredClone(registro);
}

/**
 * Entrega 3: conclui o checklist da visita de PMOC gravando o nome obrigatório de quem acompanhou a visita.
 */
export async function concluirChecklist(
  taskId: string,
  acompanhadoPor: string,
): Promise<void> {
  if (USAR_BANCO_PMOC) return real.concluirChecklist(taskId, acompanhadoPor);
  await pausaSimulada();

  const nomeLimpo = acompanhadoPor.trim();
  if (!nomeLimpo) {
    throw new Error('Informe o nome de quem acompanhou a visita.');
  }

  const checklist = await buscarChecklistDaAtividade(taskId);
  if (!checklist.is_pmoc || !checklist.plan_id || !checklist.reference_month) {
    return;
  }

  const bloqueio = motivoBloqueioConclusaoChecklistPmoc(checklist.equipments);
  if (bloqueio) {
    throw new Error(bloqueio);
  }

  const meta = obterOuCriarMetaMesDemo(checklist.plan_id, checklist.reference_month);
  if (meta) {
    meta.accompanied_by = nomeLimpo;
  }

  execucoesMemoria = execucoesMemoria.map((ex) =>
    ex.plan_id === checklist.plan_id && ex.reference_month === checklist.reference_month
      ? { ...ex, accompanied_by: nomeLimpo }
      : ex,
  );
}

/**
 * Entrega 4: obtém (ou cria) o token e link público `/relatorio-pmoc/:token` do relatório mensal.
 */
export async function gerarLinkRelatorio(
  planId: string,
  referenceMonth: string,
): Promise<{ token: string; url: string }> {
  if (USAR_BANCO_PMOC) return real.gerarLinkRelatorio(planId, referenceMonth);
  await pausaSimulada();

  let meta = obterOuCriarMetaMesDemo(planId, referenceMonth);
  if (!meta) {
    const plano = planosMemoria.find((p) => p.id === planId);
    if (!plano) throw new Error('Plano PMOC não encontrado.');
    meta = {
      plan_id: planId,
      reference_month: referenceMonth,
      service_order_id: crypto.randomUUID(),
      service_order_number: 9000,
      task_id: crypto.randomUUID(),
      technician_id: plano.responsible_employee_id ?? '',
      technician_name: plano.responsible_name || 'Técnico BRV',
      scheduled_start: `${referenceMonth}-10T09:00:00.000Z`,
      estimated_minutes: 60,
      accompanied_by: 'Responsável local (Demo)',
      report_token: `rel-pmoc-${planId.slice(-3)}-${referenceMonth}`,
    };
    osMesMetaMemoria.push(meta);
  }

  return {
    token: meta.report_token,
    url: linkPublicoRelatorioPmoc(meta.report_token),
  };
}

/**
 * Entrega 4: busca os dados públicos e higienizados do relatório mensal a partir do `token`
 * (`/relatorio-pmoc/:token`, sem login). Nunca devolve CPF/CNPJ nem observações internas do contrato.
 */
export async function buscarRelatorioPublico(
  token: string,
): Promise<PmocMonthlyReport | null> {
  if (USAR_BANCO_PMOC) return real.buscarRelatorioPublico(token);
  await pausaSimulada();

  const limpo = token.trim();
  if (!limpo) return null;

  let meta = osMesMetaMemoria.find((m) => m.report_token === limpo);

  // Permite abrir também tokens históricos `rel-pmoc-<3digitos>-YYYY-MM` gerados nas páginas públicas
  if (!meta) {
    const casamento = /^rel-pmoc-(\d{3})-(\d{4}-\d{2})$/.exec(limpo);
    if (casamento) {
      const sufixo = casamento[1];
      const mesRef = casamento[2];
      const planoAchado = planosMemoria.find((p) => p.id.endsWith(sufixo));
      if (planoAchado) {
        meta = obterOuCriarMetaMesDemo(planoAchado.id, mesRef);
      }
    }
  }

  if (!meta) return null;

  const relatorio = await buscarRelatorioMensal(meta.plan_id, meta.reference_month);
  if (!relatorio) return null;

  // Sanitiza campos internos/sensíveis antes de entregar à página pública
  return {
    ...relatorio,
    public_token: limpo,
    plan: {
      ...relatorio.plan,
      customer_document: null,
      notes: null,
      responsible_cpf: null,
    },
  };
}

/**
 * Entrega 5: busca os dados públicos e seguros do aparelho pelo `token` do QR Code (`/equipamento/:token`).
 * Nunca expõe CPF/CNPJ, telefone nem endereço completo do cliente.
 */
export async function buscarEquipamentoPublico(
  token: string,
): Promise<PmocPublicEquipmentView | null> {
  if (USAR_BANCO_PMOC) return real.buscarEquipamentoPublico(token);
  await pausaSimulada();

  const limpo = token.trim();
  if (!limpo) return null;

  // Token especial de demonstração para testar aparelho com selo "Sem plano vigente"
  if (limpo === 'eq-pmoc-demo-sem-plano') {
    return {
      token: limpo,
      customer_display_name: 'Edifício Comercial Plaza Demo',
      environment_name: 'Recepção Térreo',
      identifier: 'AR-RT-0001',
      name: 'Split Recepção Térreo',
      equipment_type: 'Split Hi-Wall',
      brand: 'Midea',
      model: 'Liva 18K',
      capacity_btu: 18000,
      has_active_plan: false,
      active_plan: null,
      recent_maintenances: [],
    };
  }

  const eq = equipamentosMemoria.find((e) => e.public_token === limpo);
  if (!eq) return null;

  const plano = planosMemoria.find((p) => p.id === eq.plan_id);
  if (!plano) return null;

  const amb = eq.environment_id
    ? ambientesMemoria.find((a) => a.id === eq.environment_id)
    : undefined;

  const infoSit = calcularSituacaoPlano(plano.status, plano.end_date);
  const temPlanoVigente =
    eq.active && (infoSit.situacao === 'vigente' || infoSit.situacao === 'vencendo');

  const mesesPlano = gerarMesesDoPlano(plano.start_date);
  const offsetPorMes = new Map(mesesPlano.map((m) => [m.referencia, m.offset]));
  const tarefasEq = tarefasMemoria.filter((t) => t.plan_equipment_id === eq.id);

  const execsAparelho = execucoesMemoria
    .filter(
      (x) =>
        x.plan_equipment_id === eq.id &&
        (x.status === 'concluida' || x.status === 'nao_atendido'),
    )
    .sort((a, b) => b.reference_month.localeCompare(a.reference_month))
    .slice(0, 12);

  const historico: PmocPublicEquipmentHistoryItem[] = execsAparelho.map((ex) => {
    const offset = offsetPorMes.get(ex.reference_month) ?? 1;
    const previstas = tarefasPrevistasNoMes(tarefasEq, offset);
    const feitas =
      ex.task_results.length > 0
        ? ex.task_results.filter((r) => r.result === 'feito').length
        : ex.status === 'concluida'
          ? previstas.length
          : 0;
    const meta = obterOuCriarMetaMesDemo(plano.id, ex.reference_month);

    return {
      reference_month: ex.reference_month,
      executed_at: ex.executed_at,
      status: ex.status === 'concluida' ? 'concluida' : 'nao_atendido',
      tasks_done_count: feitas,
      tasks_total_count: previstas.length,
      report_token: meta?.report_token ?? null,
    };
  });

  return {
    token: limpo,
    customer_display_name: plano.customer_trade_name || plano.customer_name,
    environment_name: amb?.name ?? null,
    identifier: eq.identifier,
    name: eq.name,
    equipment_type: eq.equipment_type,
    brand: eq.brand,
    model: eq.model,
    capacity_btu: eq.capacity_btu,
    has_active_plan: temPlanoVigente,
    active_plan: temPlanoVigente
      ? {
          code: plano.code,
          start_date: plano.start_date,
          end_date: plano.end_date,
          responsible_name: plano.responsible_name,
          registration_type: plano.registration_type,
          registration_number: plano.registration_number,
          responsibility_term_number: plano.responsibility_term_number,
        }
      : null,
    recent_maintenances: historico,
  };
}

/**
 * Entrega 5: envia para a fila de impressão as etiquetas QR Code (100 x 50 mm) dos aparelhos
 * selecionados (ou de todos os ativos do plano).
 */
export async function imprimirEtiquetas(
  planId: string,
  idsAparelhos?: string[],
): Promise<PmocPrintLabelsResult> {
  if (USAR_BANCO_PMOC) return real.imprimirEtiquetas(planId, idsAparelhos);
  await pausaSimulada();

  const filtroIds = idsAparelhos && idsAparelhos.length > 0 ? new Set(idsAparelhos) : null;
  const alvos = equipamentosMemoria.filter(
    (e) => e.plan_id === planId && e.active && (!filtroIds || filtroIds.has(e.id)),
  );

  if (alvos.length === 0) {
    throw new Error('Selecione ao menos um equipamento para enviar etiquetas à impressora.');
  }

  // Garante que todos os aparelhos tenham `public_token` gerado
  equipamentosMemoria = equipamentosMemoria.map((e) => {
    if (e.plan_id === planId && (!filtroIds || filtroIds.has(e.id)) && !e.public_token) {
      return { ...e, public_token: gerarTokenDemo('eq-pmoc') };
    }
    return e;
  });

  const qtd = alvos.length;
  return {
    printed_count: qtd,
    message:
      qtd === 1
        ? '1 etiqueta enviada para a impressora'
        : `${qtd} etiquetas enviadas para a impressora`,
  };
}


