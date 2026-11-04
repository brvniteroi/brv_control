// Única camada de acesso a dados consumida pelas telas do módulo PMOC.
// Hoje opera sobre o estado em memória inicializado a partir de `dadosDemo.ts`.
// Quando o Claude criar as tabelas/migrations e `src/services/pmoc.ts`, basta trocar o corpo
// destas funções e passar `FONTE_DADOS_DEMO` para `false`, sem precisar alterar os componentes visuais.

import {
  AMBIENTES_INICIAIS_DEMO,
  EQUIPAMENTOS_INICIAIS_DEMO,
  EXECUCOES_INICIAIS_DEMO,
  MODELOS_TAREFA_INICIAIS,
  PLANOS_INICIAIS_DEMO,
  TAREFAS_INICIAIS_DEMO,
} from './dadosDemo';
import {
  calcularEstadoCelulaExecucao,
  gerarMesesDoPlano,
  letraEquipamento,
  mesAtualLocal,
  tarefasPrevistasNoMes,
} from './regrasPmoc';
import type {
  PmocEnvironment,
  PmocEquipmentMonthExecution,
  PmocEquipmentTask,
  PmocGenerateOsResult,
  PmocMonthlyReport,
  PmocPlan,
  PmocPlanEquipment,
  PmocPlanInput,
  PmocPlanSummary,
  PmocTaskTemplate,
  PmocTaskTemplateRow,
} from '../../types/pmoc';

/** Enquanto `true`, as telas exibem a faixa discreta "Dados de demonstração". */
export const FONTE_DADOS_DEMO = true;

// Estado mutável em memória durante a sessão do navegador
let planosMemoria: PmocPlan[] = structuredClone(PLANOS_INICIAIS_DEMO);
let ambientesMemoria: PmocEnvironment[] = structuredClone(AMBIENTES_INICIAIS_DEMO);
let equipamentosMemoria: PmocPlanEquipment[] = structuredClone(EQUIPAMENTOS_INICIAIS_DEMO);
let tarefasMemoria: PmocEquipmentTask[] = structuredClone(TAREFAS_INICIAIS_DEMO);
let execucoesMemoria: PmocEquipmentMonthExecution[] = structuredClone(EXECUCOES_INICIAIS_DEMO);
let modelosMemoria: PmocTaskTemplate[] = structuredClone(MODELOS_TAREFA_INICIAIS);

let proximoNumeroPlano = 2;
let proximoNumeroOsDemo = 9100;

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
  await pausaSimulada();
  return [...planosMemoria]
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
    .map(resumirPlano);
}

/** Busca um plano PMOC pelo `id` (ou `null` quando inexistente). */
export async function buscarPlano(id: string): Promise<PmocPlan | null> {
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
  await pausaSimulada();
  return execucoesMemoria
    .filter((x) => x.plan_id === planId)
    .map((x) => structuredClone(x));
}

/**
 * Gera (ou reaproveita) a Ordem de Serviço preventiva para todos os equipamentos do plano
 * que possuam tarefas previstas no mês de referência (`YYYY-MM`).
 */
export async function gerarOsDoMes(
  planId: string,
  referenceMonth: string,
): Promise<PmocGenerateOsResult> {
  await pausaSimulada();
  const plano = planosMemoria.find((p) => p.id === planId);
  if (!plano) throw new Error('Plano PMOC não encontrado.');

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

  // Confere se já existe OS vinculada para este mês
  const execExistenteComOs = execucoesMemoria.find(
    (x) => x.plan_id === planId && x.reference_month === referenceMonth && x.service_order_number,
  );

  if (execExistenteComOs && execExistenteComOs.service_order_number) {
    const agora = new Date().toISOString();
    let adicionados = 0;
    for (const eq of aplicaveis) {
      const jaTem = execucoesMemoria.some(
        (x) => x.plan_equipment_id === eq.id && x.reference_month === referenceMonth,
      );
      if (!jaTem) {
        adicionados += 1;
        execucoesMemoria.push({
          id: crypto.randomUUID(),
          plan_id: planId,
          plan_equipment_id: eq.id,
          reference_month: referenceMonth,
          status: 'pendente',
          service_order_id: execExistenteComOs.service_order_id,
          service_order_number: execExistenteComOs.service_order_number,
          technician_id: plano.responsible_employee_id,
          technician_name: plano.responsible_name || null,
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
          updated_at: agora,
        });
      }
    }

    return {
      service_order_id: execExistenteComOs.service_order_id ?? crypto.randomUUID(),
      service_order_number: execExistenteComOs.service_order_number,
      reference_month: referenceMonth,
      equipments_included: aplicaveis.length,
      already_existed: adicionados === 0,
      message:
        adicionados === 0
          ? `A OS #${execExistenteComOs.service_order_number} já estava gerada para ${infoMes.rotuloExtenso} (${aplicaveis.length} equipamento(s)).`
          : `OS #${execExistenteComOs.service_order_number} atualizada com mais ${adicionados} equipamento(s) para ${infoMes.rotuloExtenso}.`,
    };
  }

  proximoNumeroOsDemo += 1;
  const osNumero = proximoNumeroOsDemo;
  const osId = crypto.randomUUID();
  const agora = new Date().toISOString();

  for (const eq of aplicaveis) {
    const idxExistente = execucoesMemoria.findIndex(
      (x) => x.plan_equipment_id === eq.id && x.reference_month === referenceMonth,
    );
    if (idxExistente >= 0) {
      execucoesMemoria[idxExistente] = {
        ...execucoesMemoria[idxExistente],
        service_order_id: osId,
        service_order_number: osNumero,
        technician_id: execucoesMemoria[idxExistente].technician_id ?? plano.responsible_employee_id,
        technician_name:
          execucoesMemoria[idxExistente].technician_name ?? (plano.responsible_name || null),
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
        technician_id: plano.responsible_employee_id,
        technician_name: plano.responsible_name || null,
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
        updated_at: agora,
      });
    }
  }

  return {
    service_order_id: osId,
    service_order_number: osNumero,
    reference_month: referenceMonth,
    equipments_included: aplicaveis.length,
    already_existed: false,
    message: `OS preventiva #${osNumero} gerada para ${infoMes.rotuloExtenso} com ${aplicaveis.length} equipamento(s).`,
  };
}

/** Consolida os dados do Relatório Mensal de Execução (Entrega 4) de um plano e mês. */
export async function buscarRelatorioMensal(
  planId: string,
  referenceMonth: string,
): Promise<PmocMonthlyReport | null> {
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

  return {
    plan: structuredClone(plano),
    environments: structuredClone(ambientes),
    reference_month: referenceMonth,
    month_offset: monthOffset,
    service_order_number: osNumeroPrincipal,
    technician_name: tecnicoPrincipal,
    executed_at: executadoEmPrincipal,
    attended_equipments: atendidos,
    unattended_equipments: naoAtendidos,
  };
}

/** Lista todos os modelos padrão de tarefas por tipo de equipamento (`/pmoc/modelo`). */
export async function listarModelosDeTarefa(): Promise<PmocTaskTemplate[]> {
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

/** Processa o envio da foto de identificação de um equipamento do plano (em memória no modo demo). */
export async function enviarFotoEquipamentoPmoc(
  arquivo: File,
): Promise<{ url: string; attachment_id: string | null }> {
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

