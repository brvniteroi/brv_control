// Dados iniciais de demonstração em memória para o módulo PMOC.
// IMPORTANTE: Todos os nomes de clientes, CPFs, CNPJs, endereços e registros abaixo são
// estritamente fictícios/didáticos. Nenhum dado real de cliente nem do exemplo do Field Control foi usado.

import { EMPRESA_BRV } from './empresa';
import { gerarMesesDoPlano, tarefasPrevistasNoMes } from './regrasPmoc';
import type {
  PmocEnvironment,
  PmocEquipmentMonthExecution,
  PmocEquipmentTask,
  PmocMeasurementKey,
  PmocPeriodicity,
  PmocPlan,
  PmocPlanEquipment,
  PmocTaskTemplate,
  PmocTaskTemplateRow,
} from '../../types/pmoc';

/** Gera uma imagem SVG leve em data URI para ilustrar fotos de equipamentos e anexo TRT no modo demo. */
function criarSvgIlustrativo(titulo: string, subtitulo: string, corFundo: string, corTexto: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">
    <rect width="480" height="320" rx="16" fill="${corFundo}"/>
    <rect x="28" y="28" width="424" height="264" rx="12" fill="#ffffff" fill-opacity="0.92" stroke="${corTexto}" stroke-opacity="0.25" stroke-width="2"/>
    <rect x="60" y="68" width="360" height="92" rx="10" fill="${corFundo}" stroke="${corTexto}" stroke-width="2"/>
    <line x1="84" y1="132" x2="396" y2="132" stroke="${corTexto}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="384" cy="96" r="7" fill="#16a34a"/>
    <text x="240" y="206" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="${corTexto}">${titulo}</text>
    <text x="240" y="234" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#475569">${subtitulo}</text>
    <text x="240" y="266" text-anchor="middle" font-family="monospace" font-size="11" fill="#64748b">Imagem ilustrativa · Dados de demonstração</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function criarSvgTermoDemo(codigoTrt: string, responsavel: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420" viewBox="0 0 600 420">
    <rect width="600" height="420" fill="#f8fafc" stroke="#cbd5e1" stroke-width="4"/>
    <rect x="24" y="24" width="552" height="64" rx="8" fill="#0B1E3F"/>
    <text x="300" y="54" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#ffffff">TERMO DE RESPONSABILIDADE TÉCNICA (TRT - DEMO)</text>
    <text x="300" y="75" text-anchor="middle" font-family="monospace" font-size="12" fill="#bae6fd">${codigoTrt}</text>
    <text x="48" y="132" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#0f172a">Responsável Técnico (Fictício): ${responsavel}</text>
    <text x="48" y="162" font-family="Arial, sans-serif" font-size="13" fill="#334155">Atividade: Plano de Manutenção, Operação e Controle (PMOC) - Climatização</text>
    <text x="48" y="190" font-family="Arial, sans-serif" font-size="13" fill="#334155">Empresa Contratada: ${EMPRESA_BRV.razaoSocial}</text>
    <rect x="48" y="224" width="504" height="110" rx="8" fill="#f1f5f9" stroke="#cbd5e1"/>
    <text x="300" y="272" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#475569">DOCUMENTO ILUSTRATIVO DE DEMONSTRAÇÃO</text>
    <text x="300" y="298" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Substitua pelo arquivo PDF ou imagem oficial emitida pelo CFT/CREA.</text>
    <line x1="170" y1="374" x2="430" y2="374" stroke="#334155" stroke-width="1.5"/>
    <text x="300" y="394" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#64748b">Assinatura Digital / Autenticação</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

interface DefinicaoTarefaBase {
  description: string;
  periodicity: PmocPeriodicity;
  requires_measurement?: boolean;
  measurement_fields?: PmocMeasurementKey[];
}

/** As 22 tarefas oficiais na ordem exata do modelo PMOC da BRV. */
const TAREFAS_BASE_SPLIT_BRV: readonly DefinicaoTarefaBase[] = [
  { description: 'Verificar estado de fiação, terminais e contatos elétricos', periodicity: 'mensal' },
  {
    description: 'Medir e registrar corrente elétrica ventilador/compressor',
    periodicity: 'mensal',
    requires_measurement: true,
    measurement_fields: ['current_a'],
  },
  {
    description: 'Medir e registrar temperatura ar insuflamento, retorno e ambiente',
    periodicity: 'mensal',
    requires_measurement: true,
    measurement_fields: ['temp_supply_c', 'temp_return_c', 'temp_ambient_c'],
  },
  { description: 'Efetuar reaperto dos terminais, parafusos e molas', periodicity: 'mensal' },
  { description: 'Limpar bandeja condensação e dreno e sua operação', periodicity: 'mensal' },
  { description: 'Verificar a vedação dos painéis de fechamento do gabinete', periodicity: 'mensal' },
  {
    description: 'Verificar a tensão das correias, para evitar o escorregamento nas polias',
    periodicity: 'mensal',
  },
  {
    description:
      'Lavar as serpentinas e bandejas com remoção do bio-filme (lodo) sem o uso de produto desengraxante e corrosivo',
    periodicity: 'mensal',
  },
  {
    description: 'Limpar o gabinete do condicionador e ventiladores (carcaça e rotor)',
    periodicity: 'mensal',
  },
  {
    description: 'Verificar o funcionamento da resistência de aquecimento do cárter',
    periodicity: 'mensal',
  },
  { description: 'Verificar filtro e secador', periodicity: 'mensal' },
  { description: 'Verificar carga de gás refrigerante e vazamentos', periodicity: 'mensal' },
  { description: 'Verificar nível de óleo do compressor', periodicity: 'mensal' },
  { description: 'Verificar a operação da válvula de expansão', periodicity: 'mensal' },
  {
    description: 'Verificar e calibrar os dispositivos de segurança (pressostatos de alta/baixa e óleo)',
    periodicity: 'mensal',
  },
  {
    description: 'Verificar resistência de isolamento dos motores e compressores',
    periodicity: 'mensal',
  },
  {
    description: 'Verificar e calibrar os dispositivos de segurança, relés térmicos e fusíveis',
    periodicity: 'mensal',
  },
  {
    description: 'Verificar a calibragem e regulagem do termostato de controle de temperatura do ambiente',
    periodicity: 'mensal',
  },
  {
    description: 'Eliminar danos e sujeiras e corrosão no gabinete, na moldura da serpentina e na bandeja',
    periodicity: 'trimestral',
  },
  { description: 'Verificar e eliminar sujeiras, danos e corrosão', periodicity: 'trimestral' },
  { description: 'Limpeza de condensador', periodicity: 'semestral' },
  { description: 'Verificar protetor térmico compressor', periodicity: 'semestral' },
];

function montarLinhasModelo(prefixoId: string): PmocTaskTemplateRow[] {
  return TAREFAS_BASE_SPLIT_BRV.map((item, idx) => ({
    id: `${prefixoId}-t-${String(idx + 1).padStart(2, '0')}`,
    description: item.description,
    periodicity: item.periodicity,
    relative_start_month: 1,
    requires_measurement: Boolean(item.requires_measurement),
    measurement_fields: item.measurement_fields ? [...item.measurement_fields] : [],
    sort_order: idx + 1,
  }));
}

export const MODELOS_TAREFA_INICIAIS: PmocTaskTemplate[] = [
  {
    id: '00000000-0000-4000-8000-000000000901',
    equipment_type: 'Split Hi-Wall',
    description: 'Modelo padrão oficial da BRV Niterói (22 tarefas preventivas).',
    tasks: montarLinhasModelo('tpl-hiwall'),
    updated_at: '2026-10-30T12:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000902',
    equipment_type: 'Cassete',
    description: 'Checklist preventivo para evaporadoras tipo Cassete 1 ou 4 vias.',
    tasks: montarLinhasModelo('tpl-cassete'),
    updated_at: '2026-10-30T12:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000903',
    equipment_type: 'Split Piso-Teto',
    description: 'Checklist preventivo para condicionadores Split Piso-Teto comerciais.',
    tasks: montarLinhasModelo('tpl-pisoteto'),
    updated_at: '2026-10-30T12:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000904',
    equipment_type: 'VRF',
    description: 'Checklist preventivo para sistemas multi-split / VRF.',
    tasks: montarLinhasModelo('tpl-vrf'),
    updated_at: '2026-10-30T12:00:00.000Z',
  },
];

// IDs sintéticos em formato UUID v4 válido para não causar erro de sintaxe em filtros PostgREST
const PLANO_1_ID = '00000000-0000-4000-8000-000000000101';
const PLANO_2_ID = '00000000-0000-4000-8000-000000000102';

const CLIENTE_DEMO_1_ID = '00000000-0000-4000-8000-000000000201';
const CLIENTE_DEMO_2_ID = '00000000-0000-4000-8000-000000000202';

const END_DEMO_1_ID = '00000000-0000-4000-8000-000000000301';
const END_DEMO_2_ID = '00000000-0000-4000-8000-000000000302';

const TEC_DEMO_1_ID = '00000000-0000-4000-8000-000000000401';
const TEC_DEMO_2_ID = '00000000-0000-4000-8000-000000000402';

const AMB_1_ID = '00000000-0000-4000-8000-000000000501';
const AMB_2_ID = '00000000-0000-4000-8000-000000000502';
const AMB_3_ID = '00000000-0000-4000-8000-000000000503';

const EQ_1_ID = '00000000-0000-4000-8000-000000000601';
const EQ_2_ID = '00000000-0000-4000-8000-000000000602';
const EQ_3_ID = '00000000-0000-4000-8000-000000000603';
const EQ_4_ID = '00000000-0000-4000-8000-000000000604';
const EQ_5_ID = '00000000-0000-4000-8000-000000000605';

export const PLANOS_INICIAIS_DEMO: PmocPlan[] = [
  {
    id: PLANO_1_ID,
    code: 'PMOC-2026-0001',
    customer_id: CLIENTE_DEMO_1_ID,
    customer_name: 'Centro Médico Baía Sul Ltda (Fictício)',
    customer_trade_name: 'Clínica Baía Sul Demo',
    customer_person_type: 'PJ',
    // CNPJ alfanumérico sintético de demonstração (formato Receita jul/2026 com DV válido)
    customer_document: '00DEM001000133',
    customer_email: 'administracao@clinica-demo.exemplo.br',
    customer_phone: '2130000100',
    address_id: END_DEMO_1_ID,
    address_snapshot: {
      label: 'Unidade Icaraí (Demo)',
      street: 'Av. Exemplo Sete de Setembro',
      number: '100',
      complement: '2º andar · Salas 201 a 206',
      district: 'Icaraí',
      city: 'Niterói',
      state: 'RJ',
      zip_code: '24230-000',
    },
    start_date: '2026-08-01',
    end_date: '2027-07-31',
    status: 'vigente',
    responsible_employee_id: TEC_DEMO_1_ID,
    responsible_name: 'Carlos Eduardo Mendes (Demo)',
    responsible_cpf: null,
    responsible_email: EMPRESA_BRV.email,
    responsible_phone: EMPRESA_BRV.telefone,
    registration_type: 'CFT',
    registration_number: 'CFT-RJ-000101-DEMO',
    responsibility_term_number: 'TRT-2026-0001-DEMO',
    trt_attachment_url: criarSvgTermoDemo('TRT-2026-0001-DEMO', 'Carlos Eduardo Mendes (Demo)'),
    trt_attachment_name: 'trt-2026-0001-demo.svg',
    trt_attachment_mime: 'image/svg+xml',
    elaborated_by: EMPRESA_BRV.razaoSocial,
    notes: 'Visitas preventivas preferencialmente na primeira semana útil do mês, antes das 9h.',
    created_at: '2026-08-01T11:00:00.000Z',
    updated_at: '2026-10-15T14:30:00.000Z',
  },
  {
    id: PLANO_2_ID,
    code: 'PMOC-2025-0018',
    customer_id: CLIENTE_DEMO_2_ID,
    customer_name: 'Restaurante Maré Mansa Ltda (Fictício)',
    customer_trade_name: 'Maré Mansa Gastronomia Demo',
    customer_person_type: 'PJ',
    // CNPJ alfanumérico sintético de demonstração (formato Receita jul/2026 com DV válido)
    customer_document: '00DEM002000188',
    customer_email: 'contato@maremansa-demo.exemplo.br',
    customer_phone: '2130000200',
    address_id: END_DEMO_2_ID,
    address_snapshot: {
      label: 'Loja São Francisco (Demo)',
      street: 'Rua Fictícia das Palmeiras',
      number: '250',
      complement: 'Loja A · Térreo',
      district: 'São Francisco',
      city: 'Niterói',
      state: 'RJ',
      zip_code: '24360-000',
    },
    // Termina em 14/12/2026 -> dentro da janela de 60 dias (selo âmbar "Vence em N dias")
    start_date: '2025-12-15',
    end_date: '2026-12-14',
    status: 'vigente',
    responsible_employee_id: TEC_DEMO_2_ID,
    responsible_name: 'Roberto Alves Rocha (Demo)',
    responsible_cpf: null,
    responsible_email: EMPRESA_BRV.email,
    responsible_phone: EMPRESA_BRV.telefone,
    registration_type: 'CFT',
    registration_number: 'CFT-RJ-000202-DEMO',
    responsibility_term_number: 'TRT-2025-0018-DEMO',
    trt_attachment_url: null,
    trt_attachment_name: null,
    trt_attachment_mime: null,
    elaborated_by: EMPRESA_BRV.razaoSocial,
    notes: 'Atendimento somente às segundas-feiras (folga do salão). Renovar contrato em dezembro.',
    created_at: '2025-12-15T13:20:00.000Z',
    updated_at: '2026-10-20T10:15:00.000Z',
  },
];

export const AMBIENTES_INICIAIS_DEMO: PmocEnvironment[] = [
  {
    id: AMB_1_ID,
    plan_id: PLANO_1_ID,
    name: 'Recepção e Espera',
    code: 'RE',
    fixed_occupants: 4,
    floating_occupants: 25,
    area_m2: 48.5,
    sort_order: 1,
    created_at: '2026-08-01T11:05:00.000Z',
  },
  {
    id: AMB_2_ID,
    plan_id: PLANO_1_ID,
    name: 'Sala de Exames',
    code: 'SE',
    fixed_occupants: 3,
    floating_occupants: 6,
    area_m2: 22,
    sort_order: 2,
    created_at: '2026-08-01T11:06:00.000Z',
  },
  {
    id: AMB_3_ID,
    plan_id: PLANO_2_ID,
    name: 'Salão Gastronômico',
    code: 'SG',
    fixed_occupants: 8,
    floating_occupants: 45,
    area_m2: 85,
    sort_order: 1,
    created_at: '2025-12-15T13:25:00.000Z',
  },
];

export const EQUIPAMENTOS_INICIAIS_DEMO: PmocPlanEquipment[] = [
  {
    id: EQ_1_ID,
    plan_id: PLANO_1_ID,
    equipment_id: null,
    environment_id: AMB_1_ID,
    equipment_type: 'Split Hi-Wall',
    name: 'Split Recepção Principal',
    brand: 'Daikin',
    model: 'EcoSwing 24K',
    serial_number: 'DEMO-SN-001',
    capacity_btu: 24000,
    identifier: 'AR-RE-0001',
    photo_url: criarSvgIlustrativo('AR-RE-0001', 'Split Recepção Principal · 24.000 BTUs', '#e0f2fe', '#0369a1'),
    photo_attachment_id: null,
    sort_order: 1,
    active: true,
    created_at: '2026-08-01T11:10:00.000Z',
  },
  {
    id: EQ_2_ID,
    plan_id: PLANO_1_ID,
    equipment_id: null,
    environment_id: AMB_1_ID,
    equipment_type: 'Cassete',
    name: 'Cassete Sala de Espera',
    brand: 'LG',
    model: 'Dual Inverter 36K',
    serial_number: 'DEMO-SN-002',
    capacity_btu: 36000,
    identifier: 'AR-RE-0002',
    photo_url: criarSvgIlustrativo('AR-RE-0002', 'Cassete Sala de Espera · 36.000 BTUs', '#dbeafe', '#1d4ed8'),
    photo_attachment_id: null,
    sort_order: 2,
    active: true,
    created_at: '2026-08-01T11:11:00.000Z',
  },
  {
    id: EQ_3_ID,
    plan_id: PLANO_1_ID,
    equipment_id: null,
    environment_id: AMB_2_ID,
    equipment_type: 'Split Hi-Wall',
    name: 'Split Sala de Exames 01',
    brand: 'Midea',
    model: 'AirVolution 12K',
    serial_number: 'DEMO-SN-003',
    capacity_btu: 12000,
    identifier: 'AR-SE-0001',
    photo_url: criarSvgIlustrativo('AR-SE-0001', 'Split Sala de Exames 01 · 12.000 BTUs', '#ecfdf5', '#047857'),
    photo_attachment_id: null,
    sort_order: 3,
    active: true,
    created_at: '2026-08-01T11:12:00.000Z',
  },
  {
    id: EQ_4_ID,
    plan_id: PLANO_2_ID,
    equipment_id: null,
    environment_id: AMB_3_ID,
    equipment_type: 'Split Piso-Teto',
    name: 'Piso-Teto Salão Norte',
    brand: 'Carrier',
    model: 'XPower 48K',
    serial_number: 'DEMO-SN-004',
    capacity_btu: 48000,
    identifier: 'AR-SG-0001',
    photo_url: criarSvgIlustrativo('AR-SG-0001', 'Piso-Teto Salão Norte · 48.000 BTUs', '#fef3c7', '#b45309'),
    photo_attachment_id: null,
    sort_order: 1,
    active: true,
    created_at: '2025-12-15T13:30:00.000Z',
  },
  {
    id: EQ_5_ID,
    plan_id: PLANO_2_ID,
    equipment_id: null,
    environment_id: AMB_3_ID,
    equipment_type: 'Split Hi-Wall',
    name: 'Split Reserva Apoio Bar',
    brand: 'Elgin',
    model: 'Eco Inverter 18K',
    serial_number: 'DEMO-SN-005',
    capacity_btu: 18000,
    identifier: 'AR-SG-0002',
    photo_url: null,
    photo_attachment_id: null,
    sort_order: 2,
    active: true,
    created_at: '2025-12-15T13:31:00.000Z',
  },
];

function gerarCronogramaEquipamentoDemo(
  planId: string,
  planEquipmentId: string,
  prefixo: string,
  apenasBimestralTrimestral = false,
): PmocEquipmentTask[] {
  const modelo = MODELOS_TAREFA_INICIAIS[0];
  // Índices (1-based) que tipicamente não se aplicam a splits pequenos (correias, cárter, óleo, pressostatos)
  const desativadasSplitCompacto = new Set([7, 10, 13, 15]);

  return modelo.tasks.map((t, idx) => {
    const numero = idx + 1;
    const ativa = !desativadasSplitCompacto.has(numero);
    // No aparelho reserva (EQ_5_ID), as tarefas mensais viram bimestrais para demonstrar células "Não se aplica"
    const periodicidade: PmocPeriodicity =
      apenasBimestralTrimestral && t.periodicity === 'mensal' ? 'bimestral' : t.periodicity;

    return {
      id: `${prefixo}-task-${String(numero).padStart(2, '0')}`,
      plan_id: planId,
      plan_equipment_id: planEquipmentId,
      template_item_id: t.id,
      description: t.description,
      periodicity: periodicidade,
      start_month_offset: t.relative_start_month,
      requires_measurement: t.requires_measurement,
      measurement_fields: [...t.measurement_fields],
      sort_order: numero,
      active: ativa,
    };
  });
}

export const TAREFAS_INICIAIS_DEMO: PmocEquipmentTask[] = [
  ...gerarCronogramaEquipamentoDemo(PLANO_1_ID, EQ_1_ID, 'p1-eq1'),
  ...gerarCronogramaEquipamentoDemo(PLANO_1_ID, EQ_2_ID, 'p1-eq2'),
  ...gerarCronogramaEquipamentoDemo(PLANO_1_ID, EQ_3_ID, 'p1-eq3'),
  ...gerarCronogramaEquipamentoDemo(PLANO_2_ID, EQ_4_ID, 'p2-eq4'),
  ...gerarCronogramaEquipamentoDemo(PLANO_2_ID, EQ_5_ID, 'p2-eq5', true),
];

function criarExecucaoConcluidaDemo(params: {
  id: string;
  planId: string;
  planEquipmentId: string;
  referenceMonth: string;
  monthOffset: number;
  osNumber: number;
  tecnicoId: string;
  tecnicoNome: string;
  executadoEm: string;
  correnteA: number;
  insuflamentoC: number;
  retornoC: number;
  ambienteC: number;
  observacao: string;
  incluirFoto?: boolean;
}): PmocEquipmentMonthExecution {
  const tarefasDoAparelho = TAREFAS_INICIAIS_DEMO.filter(
    (t) => t.plan_equipment_id === params.planEquipmentId,
  );
  const previstas = tarefasPrevistasNoMes(tarefasDoAparelho, params.monthOffset);

  return {
    id: params.id,
    plan_id: params.planId,
    plan_equipment_id: params.planEquipmentId,
    reference_month: params.referenceMonth,
    status: 'concluida',
    service_order_id: `00000000-0000-4000-8000-0000000${params.osNumber}`,
    service_order_number: params.osNumber,
    technician_id: params.tecnicoId,
    technician_name: params.tecnicoNome,
    executed_at: params.executadoEm,
    measurements: {
      current_a: params.correnteA,
      temp_supply_c: params.insuflamentoC,
      temp_return_c: params.retornoC,
      temp_ambient_c: params.ambienteC,
    },
    task_results: previstas.map((t) => ({
      equipment_task_id: t.id,
      description: t.description,
      periodicity: t.periodicity,
      result: 'feito',
      notes: null,
    })),
    technician_notes: params.observacao,
    photo_urls: params.incluirFoto
      ? [
          criarSvgIlustrativo(
            `Execução ${params.referenceMonth}`,
            `OS #${params.osNumber} · Higienização e aferição`,
            '#f0fdf4',
            '#15803d',
          ),
        ]
      : [],
    unattended_reason: null,
    updated_at: params.executadoEm,
  };
}

function gerarExecucoesPlano2Demo(): PmocEquipmentMonthExecution[] {
  const meses = gerarMesesDoPlano('2025-12-15');
  const lista: PmocEquipmentMonthExecution[] = [];
  // Meses 1 a 10 (Dez/25 a Set/26) concluídos; Mês 11 (Out/26) fica sem registro -> Atrasada; Mês 12 (Nov/26) -> Prevista
  for (let i = 0; i < 10; i++) {
    const m = meses[i];
    const osNum = 8801 + i;
    const dataExec = `${m.referencia}-18T11:30:00.000Z`;

    lista.push(
      criarExecucaoConcluidaDemo({
        id: `exec-p2-eq4-${m.offset}`,
        planId: PLANO_2_ID,
        planEquipmentId: EQ_4_ID,
        referenceMonth: m.referencia,
        monthOffset: m.offset,
        osNumber: osNum,
        tecnicoId: TEC_DEMO_2_ID,
        tecnicoNome: 'Roberto Alves Rocha (Demo)',
        executadoEm: dataExec,
        correnteA: 9.8,
        insuflamentoC: 11.4,
        retornoC: 23.6,
        ambienteC: 22.5,
        observacao: 'Serpentina higienizada, dreno desobstruído e operação normal.',
        incluirFoto: i === 9,
      }),
    );

    const tarefasEq5 = tarefasPrevistasNoMes(
      TAREFAS_INICIAIS_DEMO.filter((t) => t.plan_equipment_id === EQ_5_ID),
      m.offset,
    );
    if (tarefasEq5.length > 0) {
      lista.push(
        criarExecucaoConcluidaDemo({
          id: `exec-p2-eq5-${m.offset}`,
          planId: PLANO_2_ID,
          planEquipmentId: EQ_5_ID,
          referenceMonth: m.referencia,
          monthOffset: m.offset,
          osNumber: osNum,
          tecnicoId: TEC_DEMO_2_ID,
          tecnicoNome: 'Roberto Alves Rocha (Demo)',
          executadoEm: dataExec,
          correnteA: 4.9,
          insuflamentoC: 12.1,
          retornoC: 24.0,
          ambienteC: 23.0,
          observacao: 'Aparelho reserva testado em carga plena.',
        }),
      );
    }
  }
  return lista;
}

export const EXECUCOES_INICIAIS_DEMO: PmocEquipmentMonthExecution[] = [
  // Plano 1 — Agosto/2026 (mês 1): todos os 3 equipamentos concluídos (OS #9010)
  criarExecucaoConcluidaDemo({
    id: 'exec-p1-eq1-m1',
    planId: PLANO_1_ID,
    planEquipmentId: EQ_1_ID,
    referenceMonth: '2026-08',
    monthOffset: 1,
    osNumber: 9010,
    tecnicoId: TEC_DEMO_1_ID,
    tecnicoNome: 'Carlos Eduardo Mendes (Demo)',
    executadoEm: '2026-08-06T10:15:00.000Z',
    correnteA: 5.6,
    insuflamentoC: 11.2,
    retornoC: 23.8,
    ambienteC: 22.4,
    observacao: 'Filtros lavados, bandeja limpa e conexões elétricas reapertadas.',
    incluirFoto: true,
  }),
  criarExecucaoConcluidaDemo({
    id: 'exec-p1-eq2-m1',
    planId: PLANO_1_ID,
    planEquipmentId: EQ_2_ID,
    referenceMonth: '2026-08',
    monthOffset: 1,
    osNumber: 9010,
    tecnicoId: TEC_DEMO_1_ID,
    tecnicoNome: 'Carlos Eduardo Mendes (Demo)',
    executadoEm: '2026-08-06T11:05:00.000Z',
    correnteA: 8.2,
    insuflamentoC: 10.8,
    retornoC: 23.5,
    ambienteC: 22.1,
    observacao: 'Bomba de dreno do cassete testada e operando sem ruído.',
    incluirFoto: true,
  }),
  criarExecucaoConcluidaDemo({
    id: 'exec-p1-eq3-m1',
    planId: PLANO_1_ID,
    planEquipmentId: EQ_3_ID,
    referenceMonth: '2026-08',
    monthOffset: 1,
    osNumber: 9010,
    tecnicoId: TEC_DEMO_1_ID,
    tecnicoNome: 'Carlos Eduardo Mendes (Demo)',
    executadoEm: '2026-08-06T11:50:00.000Z',
    correnteA: 3.7,
    insuflamentoC: 11.9,
    retornoC: 23.2,
    ambienteC: 21.8,
    observacao: 'Equipamento em ótimo estado e temperaturas dentro da faixa ideal.',
  }),

  // Plano 1 — Setembro/2026 (mês 2): 2 concluídos + 1 não atendido com motivo (OS #9045)
  criarExecucaoConcluidaDemo({
    id: 'exec-p1-eq1-m2',
    planId: PLANO_1_ID,
    planEquipmentId: EQ_1_ID,
    referenceMonth: '2026-09',
    monthOffset: 2,
    osNumber: 9045,
    tecnicoId: TEC_DEMO_1_ID,
    tecnicoNome: 'Carlos Eduardo Mendes (Demo)',
    executadoEm: '2026-09-04T09:40:00.000Z',
    correnteA: 5.5,
    insuflamentoC: 11.4,
    retornoC: 23.6,
    ambienteC: 22.2,
    observacao: 'Manutenção mensal realizada normalmente.',
    incluirFoto: true,
  }),
  criarExecucaoConcluidaDemo({
    id: 'exec-p1-eq2-m2',
    planId: PLANO_1_ID,
    planEquipmentId: EQ_2_ID,
    referenceMonth: '2026-09',
    monthOffset: 2,
    osNumber: 9045,
    tecnicoId: TEC_DEMO_1_ID,
    tecnicoNome: 'Carlos Eduardo Mendes (Demo)',
    executadoEm: '2026-09-04T10:30:00.000Z',
    correnteA: 8.1,
    insuflamentoC: 11.0,
    retornoC: 23.4,
    ambienteC: 22.0,
    observacao: 'Higienização das aletas e revisão elétrica concluídas.',
  }),
  {
    id: 'exec-p1-eq3-m2',
    plan_id: PLANO_1_ID,
    plan_equipment_id: EQ_3_ID,
    reference_month: '2026-09',
    status: 'nao_atendido',
    service_order_id: '00000000-0000-4000-8000-00000009045',
    service_order_number: 9045,
    technician_id: TEC_DEMO_1_ID,
    technician_name: 'Carlos Eduardo Mendes (Demo)',
    executed_at: '2026-09-04T10:45:00.000Z',
    measurements: {
      current_a: null,
      temp_supply_c: null,
      temp_return_c: null,
      temp_ambient_c: null,
    },
    task_results: [],
    technician_notes: null,
    photo_urls: [],
    unattended_reason:
      'Sala de exames ocupada com procedimentos médicos contínuos durante o horário liberado pela clínica.',
    updated_at: '2026-09-04T10:45:00.000Z',
  },

  // Plano 1 — Outubro/2026 (mês 3): sem execução concluída -> aparece como "Atrasada"
  // Plano 2 — Dez/25 a Set/26 concluídos, Out/26 atrasado, Nov/26 previsto
  ...gerarExecucoesPlano2Demo(),
];
