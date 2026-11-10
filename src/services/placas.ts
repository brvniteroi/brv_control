// Módulo Placas (reparo de placas eletrônicas), acesso ao banco: migration 20261110100000_placas_base.sql.
// As telas chamam estas funções por components/placas/fonteDeDados.ts. Regras de etapa, número, autor, datas e
// histórico ficam no banco (os RAISE EXCEPTION da migration já vêm em português). Financeiro (valor cobrado e
// reembolso) fica em board_finance, que só quem tem a marca do perfil lê: sem ela os campos vêm vazios.
import { supabase } from './supabase';
import { compactarImagem, enviarParaHostgator } from './anexos';
import type { PedidoImpressao } from '../types/oficina';
import { gerarZplPlaca } from '../utils/etiquetaPlaca';
import type { LarguraEtiqueta } from '../utils/etiquetaOficina';
import type { PersonType } from '../types/fsm';
import type {
  BoardClient,
  BoardClientInput,
  BoardControlOsLookup,
  BoardCustomerKind,
  BoardEvent,
  BoardListFilter,
  BoardListResult,
  BoardOrder,
  BoardPhoto,
  BoardPhotoCategory,
  BoardPublicStageStep,
  BoardPublicTracking,
  BoardQuoteChannel,
  BoardQuoteInput,
  BoardQuoteResponseInput,
  BoardQuoteStatus,
  BoardRefundInput,
  BoardStage,
  BoardTechnicianOption,
  ConsultaCodigoErroInput,
  CreateBoardInput,
  ExtracaoFichaManualResultado,
  EnviarManualPlacaInput,
  FiltroFichasPlacas,
  MoveBoardExtra,
  PlacaFichaInput,
  PlacaFichaTecnica,
  PlacaManual,
  ResultadoConsultaErro,
  UpdateBoardFields,
} from '../types/placas';
import {
  ETAPAS_KANBAN_PLACA,
  MOSTRAR_VALOR_ORCAMENTO,
  PLACAS_FINALIZADAS_POR_PAGINA,
  ROTULO_ETAPA_PLACA,
  calcularValidadeGarantia,
  diasDesdeEntrada,
  garantiaVigente,
  placaEncalhada,
  semAcento,
} from '../components/placas/regrasPlacas';

// ---------------------------------------------------------------------
// Erros e conversão de linhas
// ---------------------------------------------------------------------

function traduzir(mensagem: string): string {
  if (mensagem.includes('board_orders_board_client_id_fkey')) return 'Este cliente tem placas cadastradas e não pode ser excluído.';
  if (mensagem.includes('board_orders_board_number_key')) return 'Outra placa acabou de receber este número. Tente de novo.';
  if (mensagem.includes('board_finance_reembolso')) return 'Para marcar reembolso, informe valor, data e motivo.';
  if (mensagem.includes('row-level security')) return 'Sem permissão para esta ação.';
  return mensagem;
}

function falhar(error: { message: string } | null): void {
  if (error) throw new Error(traduzir(error.message));
}

const FINAIS = ['entregue', 'sem_conserto'];

interface LinhaFinanceiro {
  charged_amount: number | null;
  refunded: boolean;
  refund_amount: number | null;
  refunded_at: string | null;
  refund_reason: string | null;
}

interface LinhaPlaca {
  id: string;
  board_number: string;
  public_token: string;
  status: BoardStage;
  stage_changed_at: string;
  finished_at: string | null;
  archived: boolean;
  archived_at: string | null;
  cancelled_entry: boolean;
  cancel_reason: string | null;
  unrepaired_reason: string | null;
  board_client_id: string | null;
  customer_id: string | null;
  service_order_id: string | null;
  customer_kind: BoardCustomerKind;
  customer_city: string | null;
  customer_document: string | null;
  customer_person_type: PersonType;
  customer_address: string | null;
  equipment_type: string;
  brand_model: string;
  board_code: string;
  peripherals: string | null;
  reported_defect: string;
  no_apparent_defect: boolean;
  pickup_employee_id: string | null;
  bench_employee_id: string | null;
  error_code: string | null;
  technical_diagnosis: string | null;
  replaced_components: string | null;
  quote_status: BoardQuoteStatus;
  quote_amount: number | null;
  quote_validity_days: number;
  quote_technical_opinion: string | null;
  quote_sent_at: string | null;
  quote_responded_at: string | null;
  quote_response_channel: BoardQuoteChannel | null;
  quote_response_notes: string | null;
  is_warranty: boolean;
  warranty_origin_id: string | null;
  created_at: string;
  updated_at: string;
  board_client: { name: string; phone: string; city: string | null; document: string | null; address: string | null } | null;
  customer: { name: string; trade_name: string | null; phone: string | null; document: string | null } | null;
  service_order: { number: number } | null;
  pickup: { name: string } | null;
  bench: { name: string } | null;
  origin: { board_number: string } | null;
  responder: { full_name: string } | null;
  finance: LinhaFinanceiro | null;
}

const SELECT_PLACA = `
  *,
  board_client:board_clients(name, phone, city, document, address),
  customer:customers(name, trade_name, phone, document),
  service_order:service_orders(number),
  pickup:employees!pickup_employee_id(name),
  bench:employees!bench_employee_id(name),
  origin:board_orders!warranty_origin_id(board_number),
  responder:profiles!quote_responded_by(full_name),
  finance:board_finance(charged_amount, refunded, refund_amount, refunded_at, refund_reason)
`;

function paraPlaca(l: LinhaPlaca): BoardOrder {
  const cli = l.board_client;
  const ctrl = l.customer;
  const fin = l.finance;
  const base = {
    id: l.id,
    board_number: l.board_number,
    public_token: l.public_token,
    status: l.status,
    stage_changed_at: l.stage_changed_at,
    finished_at: l.finished_at,
    archived: l.archived,
    archived_at: l.archived_at,
    cancelled_entry: l.cancelled_entry,
    cancel_reason: l.cancel_reason,
    unrepaired_reason: l.unrepaired_reason,
    board_client_id: l.board_client_id,
    customer_id: l.customer_id,
    service_order_id: l.service_order_id,
    os_number: l.service_order?.number ?? null,
    customer_name: cli?.name ?? ctrl?.trade_name ?? ctrl?.name ?? '—',
    customer_phone: cli?.phone ?? ctrl?.phone ?? null,
    customer_kind: l.customer_kind,
    customer_city: l.customer_city ?? cli?.city ?? null,
    customer_document: l.customer_document ?? cli?.document ?? ctrl?.document ?? null,
    customer_person_type: l.customer_person_type,
    customer_address: l.customer_address ?? cli?.address ?? null,
    equipment_type: l.equipment_type,
    brand_model: l.brand_model,
    board_code: l.board_code,
    peripherals: l.peripherals,
    reported_defect: l.reported_defect,
    no_apparent_defect: l.no_apparent_defect,
    pickup_technician_id: l.pickup_employee_id,
    pickup_technician_name: l.pickup?.name ?? null,
    bench_technician_id: l.bench_employee_id,
    bench_technician_name: l.bench?.name ?? null,
    error_code: l.error_code,
    technical_diagnosis: l.technical_diagnosis,
    replaced_components: l.replaced_components,
    quote_status: l.quote_status,
    quote_amount: l.quote_amount,
    quote_validity_days: l.quote_validity_days,
    quote_technical_opinion: l.quote_technical_opinion,
    quote_sent_at: l.quote_sent_at,
    quote_responded_at: l.quote_responded_at,
    quote_response_channel: l.quote_response_channel,
    quote_response_notes: l.quote_response_notes,
    quote_responded_by_name: l.responder?.full_name ?? null,
    is_warranty: l.is_warranty,
    warranty_origin_id: l.warranty_origin_id,
    warranty_origin_number: l.origin?.board_number ?? null,
    charged_amount: fin?.charged_amount ?? null,
    refunded: fin?.refunded ?? false,
    refund_amount: fin?.refund_amount ?? null,
    refunded_at: fin?.refunded_at ?? null,
    refund_reason: fin?.refund_reason ?? null,
    created_at: l.created_at,
    updated_at: l.updated_at,
  };
  return { ...base, days_since_entry: diasDesdeEntrada(base), stalled: placaEncalhada(base) };
}

// ---------------------------------------------------------------------
// Leitura de placas
// ---------------------------------------------------------------------

function textoBusca(p: BoardOrder): string {
  return semAcento(
    [p.board_number, p.customer_name, p.brand_model, p.board_code, p.error_code ?? '', p.equipment_type, p.customer_phone ?? ''].join(' '),
  );
}

export async function listarPlacas(filtro: BoardListFilter): Promise<BoardListResult> {
  const termo = semAcento((filtro.busca ?? '').trim());

  if (filtro.aba === 'andamento') {
    // Poucas dezenas em aberto: carrega todas e filtra/contabiliza aqui
    const { data, error } = await supabase
      .from('board_orders')
      .select(SELECT_PLACA)
      .eq('archived', false)
      .eq('cancelled_entry', false)
      .not('status', 'in', `(${FINAIS.join(',')})`)
      .order('created_at', { ascending: true });
    falhar(error);
    const todas = ((data ?? []) as unknown as LinhaPlaca[]).map(paraPlaca).filter((p) => !termo || textoBusca(p).includes(termo));
    const contagens = {
      todas: todas.length,
      parceiros: todas.filter((p) => p.customer_kind === 'instalador').length,
      final: todas.filter((p) => p.customer_kind === 'final').length,
      garantias: todas.filter((p) => p.is_warranty).length,
      encalhadas: todas.filter((p) => p.stalled).length,
    };
    const recorte = filtro.recorte ?? 'todas';
    const itens = todas.filter((p) => {
      if (recorte === 'parceiros') return p.customer_kind === 'instalador';
      if (recorte === 'final') return p.customer_kind === 'final';
      if (recorte === 'garantias') return p.is_warranty;
      if (recorte === 'encalhadas') return p.stalled;
      return true;
    });
    return { itens, total: itens.length, por_pagina: PLACAS_FINALIZADAS_POR_PAGINA, contagens };
  }

  // Finalizadas e arquivadas: paginadas no servidor
  const pagina = Math.max(1, filtro.pagina ?? 1);
  const de = (pagina - 1) * PLACAS_FINALIZADAS_POR_PAGINA;
  let consulta = supabase
    .from('board_orders')
    .select(SELECT_PLACA, { count: 'exact' })
    .eq('cancelled_entry', false)
    .or(`status.in.(${FINAIS.join(',')}),archived.eq.true`);
  if (filtro.desfecho === 'entregue' || filtro.desfecho === 'sem_conserto') consulta = consulta.eq('status', filtro.desfecho);
  if (filtro.ano) {
    consulta = consulta.gte('finished_at', `${filtro.ano}-01-01T00:00:00-03:00`).lt('finished_at', `${filtro.ano + 1}-01-01T00:00:00-03:00`);
  }
  if (termo) {
    const [{ data: clientes }, { data: controle }] = await Promise.all([
      supabase.from('board_clients').select('id').ilike('busca', `%${termo}%`).limit(200),
      supabase.from('customers').select('id').ilike('busca', `%${termo}%`).limit(200),
    ]);
    const partes = [`busca.ilike.%${termo}%`];
    if (clientes?.length) partes.push(`board_client_id.in.(${clientes.map((c) => c.id).join(',')})`);
    if (controle?.length) partes.push(`customer_id.in.(${controle.map((c) => c.id).join(',')})`);
    consulta = consulta.or(partes.join(','));
  }
  const { data, error, count } = await consulta
    .order('finished_at', { ascending: false, nullsFirst: false })
    .range(de, de + PLACAS_FINALIZADAS_POR_PAGINA - 1);
  falhar(error);
  const itens = ((data ?? []) as unknown as LinhaPlaca[]).map(paraPlaca);
  return {
    itens,
    total: count ?? itens.length,
    por_pagina: PLACAS_FINALIZADAS_POR_PAGINA,
    contagens: { todas: 0, parceiros: 0, final: 0, garantias: 0, encalhadas: 0 },
  };
}

export async function buscarPlaca(id: string): Promise<BoardOrder | null> {
  const { data, error } = await supabase.from('board_orders').select(SELECT_PLACA).eq('id', id).maybeSingle();
  falhar(error);
  return data ? paraPlaca(data as unknown as LinhaPlaca) : null;
}

async function placaOuErro(id: string): Promise<BoardOrder> {
  const p = await buscarPlaca(id);
  if (!p) throw new Error('Placa não encontrada.');
  return p;
}

export async function placasDoCliente(clienteId: string): Promise<BoardOrder[]> {
  const { data, error } = await supabase
    .from('board_orders')
    .select(SELECT_PLACA)
    .eq('board_client_id', clienteId)
    .order('created_at', { ascending: false });
  falhar(error);
  return ((data ?? []) as unknown as LinhaPlaca[]).map(paraPlaca);
}

/** Placas em aberto + entregues no ano + reembolsadas no ano (quem não tem a marca do financeiro recebe os valores vazios). */
export async function listarPlacasParaFinanceiro(ano: number): Promise<BoardOrder[]> {
  const inicio = `${ano}-01-01T00:00:00-03:00`;
  const fim = `${ano + 1}-01-01T00:00:00-03:00`;
  const [abertas, finalizadas, reembolsos] = await Promise.all([
    supabase.from('board_orders').select(SELECT_PLACA).eq('archived', false).eq('cancelled_entry', false).not('status', 'in', `(${FINAIS.join(',')})`),
    supabase.from('board_orders').select(SELECT_PLACA).eq('cancelled_entry', false).gte('finished_at', inicio).lt('finished_at', fim),
    supabase.from('board_finance').select('board_order_id').eq('refunded', true).gte('refunded_at', `${ano}-01-01`).lt('refunded_at', `${ano + 1}-01-01`),
  ]);
  falhar(abertas.error);
  falhar(finalizadas.error);
  falhar(reembolsos.error);
  const porId = new Map<string, BoardOrder>();
  for (const l of [...(abertas.data ?? []), ...(finalizadas.data ?? [])] as unknown as LinhaPlaca[]) porId.set(l.id, paraPlaca(l));
  const faltam = (reembolsos.data ?? []).map((r) => r.board_order_id as string).filter((id) => !porId.has(id));
  if (faltam.length) {
    const { data, error } = await supabase.from('board_orders').select(SELECT_PLACA).in('id', faltam);
    falhar(error);
    for (const l of (data ?? []) as unknown as LinhaPlaca[]) porId.set(l.id, paraPlaca(l));
  }
  return [...porId.values()];
}

// ---------------------------------------------------------------------
// Entrada e alterações
// ---------------------------------------------------------------------

export async function buscarOsControl(numero: number | string): Promise<BoardControlOsLookup | null> {
  const n = Number(String(numero).replace(/\D/g, ''));
  if (!n) return null;
  const { data: os, error } = await supabase
    .from('service_orders')
    .select('id, number, description, customer:customers(id, name, trade_name, phone, document, person_type), address:customer_addresses!address_id(street, number, complement, district, city, state)')
    .eq('number', n)
    .maybeSingle();
  falhar(error);
  if (!os) return null;
  const cliente = os.customer as unknown as { id: string; name: string; trade_name: string | null; phone: string | null; document: string | null; person_type: PersonType } | null;
  if (!cliente) return null;
  const endereco = os.address as unknown as { street: string; number: string | null; complement: string | null; district: string | null; city: string; state: string } | null;

  const { data: atividade } = await supabase
    .from('tasks')
    .select('employee_id, technician_notes, employee:employees(name)')
    .eq('service_order_id', os.id)
    .neq('status', 'cancelada')
    .order('scheduled_start', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const { data: existentes } = await supabase.from('board_orders').select('board_number').eq('service_order_id', os.id);

  const partes = endereco
    ? [[endereco.street, endereco.number].filter(Boolean).join(', '), endereco.complement, endereco.district, [endereco.city, endereco.state].filter(Boolean).join('/')]
    : [];
  return {
    service_order_id: os.id,
    os_number: os.number,
    customer_id: cliente.id,
    customer_name: cliente.trade_name || cliente.name,
    customer_phone: cliente.phone,
    customer_document: cliente.document,
    customer_person_type: cliente.person_type,
    address_summary: partes.filter(Boolean).join(' - '),
    city: endereco?.city ?? null,
    technician_id: (atividade?.employee_id as string | null) ?? null,
    technician_name: ((atividade?.employee as unknown as { name: string } | null)?.name) ?? null,
    field_report: (atividade?.technician_notes as string | null) ?? (os.description as string | null) ?? null,
    existing_board_numbers: (existentes ?? []).map((e) => e.board_number as string),
  };
}

export async function listarTecnicos(): Promise<BoardTechnicianOption[]> {
  const { data, error } = await supabase.rpc('oficina_funcionarios');
  falhar(error);
  const lista = ((data ?? []) as { id: string; name: string; role: string }[]).map((f) => ({
    id: f.id,
    name: f.name,
    area: f.role === 'oficina' ? ('bancada' as const) : ('campo' as const),
  }));
  // O técnico de bancada (Braulio Valente) tem cadastro inativo como funcionário de campo, então a função acima não o traz.
  const { data: bancada } = await supabase.from('employees').select('id, name').ilike('name', '%braulio%valente%');
  for (const f of (bancada ?? []) as { id: string; name: string }[]) {
    const i = lista.findIndex((l) => l.id === f.id);
    if (i >= 0) lista[i].area = 'bancada';
    else lista.push({ id: f.id, name: f.name, area: 'bancada' as const });
  }
  return lista;
}

export async function criarPlaca(dados: CreateBoardInput): Promise<BoardOrder> {
  const linha: Record<string, unknown> = {
    customer_kind: dados.customer_kind,
    customer_city: dados.customer_city ?? null,
    pickup_employee_id: dados.pickup_technician_id ?? null,
    bench_employee_id: dados.bench_technician_id ?? null,
    equipment_type: dados.equipment_type.trim(),
    brand_model: dados.brand_model.trim(),
    board_code: dados.board_code.trim(),
    peripherals: dados.peripherals?.trim() || null,
    reported_defect: dados.reported_defect.trim(),
    error_code: dados.error_code?.trim() || null,
    no_apparent_defect: dados.no_apparent_defect,
    is_warranty: dados.is_warranty,
    warranty_origin_id: dados.is_warranty ? (dados.warranty_origin_id ?? null) : null,
  };

  if (dados.origem === 'balcao') {
    if (!dados.board_client_id) throw new Error('Escolha o cliente de placas.');
    const { data: cli, error } = await supabase.from('board_clients').select('*').eq('id', dados.board_client_id).single();
    falhar(error);
    linha.board_client_id = cli.id;
    linha.customer_city = dados.customer_city ?? cli.city;
    linha.customer_document = cli.document;
    linha.customer_person_type = cli.person_type;
    linha.customer_address = cli.address;
  } else {
    if (!dados.service_order_id) throw new Error('Informe a OS do BRV Control.');
    const { data: os, error } = await supabase
      .from('service_orders')
      .select('id, number, customer:customers(id, document, person_type)')
      .eq('id', dados.service_order_id)
      .single();
    falhar(error);
    if (!os) throw new Error('OS do BRV Control não encontrada.');
    const cliente = os.customer as unknown as { id: string; document: string | null; person_type: PersonType };
    linha.service_order_id = os.id;
    linha.customer_id = cliente.id;
    linha.customer_document = cliente.document;
    linha.customer_person_type = cliente.person_type;
  }

  const { data: criada, error } = await supabase.from('board_orders').insert(linha).select('id').single();
  falhar(error);
  if (!criada) throw new Error('A placa não foi registrada.');

  // Fotos da entrada: se alguma falhar a placa já existe; avisa sem perder o registro
  const falhas: string[] = [];
  for (const foto of dados.entry_photos ?? []) {
    try {
      await anexarFotoPlaca(foto.file, criada.id, 'antes', foto.caption);
    } catch (e) {
      falhas.push(e instanceof Error ? e.message : 'foto');
    }
  }
  const placa = await placaOuErro(criada.id);
  if (falhas.length) throw new Error(`A placa ${placa.board_number} foi registrada, mas ${falhas.length} foto(s) não subiram. Anexe de novo pelo detalhe da placa.`);
  return placa;
}

async function atualizar(id: string, campos: Record<string, unknown>): Promise<BoardOrder> {
  const { error } = await supabase.from('board_orders').update(campos as never).eq('id', id);
  falhar(error);
  return placaOuErro(id);
}

async function gravarFinanceiro(id: string, campos: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('board_finance').upsert({ board_order_id: id, ...campos }, { onConflict: 'board_order_id' });
  falhar(error);
}

export async function atualizarPlaca(id: string, campos: UpdateBoardFields): Promise<BoardOrder> {
  const { charged_amount, pickup_technician_id, bench_technician_id, ...resto } = campos;
  const mudar: Record<string, unknown> = { ...resto };
  if (pickup_technician_id !== undefined) mudar.pickup_employee_id = pickup_technician_id;
  if (bench_technician_id !== undefined) mudar.bench_employee_id = bench_technician_id;
  if (Object.keys(mudar).length) await atualizar(id, mudar);
  if (charged_amount !== undefined) await gravarFinanceiro(id, { charged_amount });
  return placaOuErro(id);
}

export async function moverPlaca(id: string, etapa: BoardStage, extra: MoveBoardExtra = {}): Promise<BoardOrder> {
  const mudar: Record<string, unknown> = { status: etapa };
  if (extra.finished_at) mudar.finished_at = extra.finished_at;
  if (etapa === 'sem_conserto') mudar.unrepaired_reason = extra.unrepaired_reason?.trim() || null;
  await atualizar(id, mudar);
  if (extra.charged_amount !== undefined && extra.charged_amount !== null) await gravarFinanceiro(id, { charged_amount: extra.charged_amount });
  return placaOuErro(id);
}

// ---------------------------------------------------------------------
// Orçamento (feito no Control)
// ---------------------------------------------------------------------

export function registrarOrcamento(id: string, dados: BoardQuoteInput): Promise<BoardOrder> {
  return atualizar(id, {
    quote_amount: dados.quote_amount,
    quote_validity_days: dados.quote_validity_days,
    quote_technical_opinion: dados.quote_technical_opinion.trim(),
    customer_document: dados.customer_document ?? null,
    customer_person_type: dados.customer_person_type ?? 'PF',
    customer_address: dados.customer_address ?? null,
  });
}

export async function registrarEnvioOrcamento(id: string): Promise<BoardOrder> {
  const atual = await placaOuErro(id);
  // Resposta já registrada (aprovado/recusado) não volta para "enviado"
  const mudar: Record<string, unknown> = { quote_sent_at: new Date().toISOString() };
  if (atual.quote_status === 'nao_feito' || atual.quote_status === 'enviado') mudar.quote_status = 'enviado';
  return atualizar(id, mudar);
}

export function registrarRespostaOrcamento(id: string, dados: BoardQuoteResponseInput): Promise<BoardOrder> {
  return atualizar(id, {
    quote_status: dados.decision,
    quote_response_channel: dados.channel,
    quote_response_notes: dados.notes?.trim() || null,
  });
}

export async function registrarReembolso(id: string, dados: BoardRefundInput): Promise<BoardOrder> {
  await gravarFinanceiro(id, dados.refunded
    ? { refunded: true, refund_amount: dados.refund_amount, refunded_at: dados.refunded_at, refund_reason: dados.refund_reason?.trim() || null }
    : { refunded: false, refund_amount: null, refunded_at: null, refund_reason: null });
  return placaOuErro(id);
}

// ---------------------------------------------------------------------
// Arquivar, cancelar, reabrir, link
// ---------------------------------------------------------------------

export function arquivarPlaca(id: string): Promise<BoardOrder> {
  return atualizar(id, { archived: true });
}

export function cancelarPlaca(id: string, motivo: string): Promise<BoardOrder> {
  return atualizar(id, { cancelled_entry: true, cancel_reason: motivo.trim() });
}

export async function reabrirPlaca(id: string): Promise<BoardOrder> {
  const atual = await placaOuErro(id);
  return atualizar(id, { status: atual.status === 'sem_conserto' ? 'diagnostico' : 'pronto', archived: false });
}

export async function gerarNovoLinkAcompanhamento(id: string): Promise<BoardOrder> {
  const { error } = await supabase.rpc('board_novo_link', { p_id: id });
  falhar(error);
  return placaOuErro(id);
}

// ---------------------------------------------------------------------
// Histórico e fotos
// ---------------------------------------------------------------------

interface LinhaEvento {
  id: string;
  board_order_id: string;
  event_type: BoardEvent['event_type'];
  from_stage: BoardStage | null;
  to_stage: BoardStage | null;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
  visibility: BoardEvent['visibility'];
  actor_name: string | null;
  created_at: string;
}

function paraEvento(l: LinhaEvento): BoardEvent {
  return { ...l, actor_name: l.actor_name ?? 'Sistema' };
}

export async function anotarNoHistorico(id: string, nota: string): Promise<BoardEvent> {
  const { data, error } = await supabase
    .from('board_events')
    .insert({ board_order_id: id, event_type: 'nota', note: nota.trim() })
    .select('*')
    .single();
  falhar(error);
  return paraEvento(data as LinhaEvento);
}

export async function historicoDaPlaca(id: string): Promise<BoardEvent[]> {
  const { data, error } = await supabase
    .from('board_events')
    .select('*')
    .eq('board_order_id', id)
    .order('created_at', { ascending: false });
  falhar(error);
  return ((data ?? []) as LinhaEvento[]).map(paraEvento);
}

interface LinhaFoto {
  id: string;
  board_order_id: string;
  category: BoardPhotoCategory;
  public_url: string;
  file_name: string | null;
  caption: string | null;
  stage_at_capture: BoardStage | null;
  uploaded_by_name: string | null;
  created_at: string;
}

function paraFoto(l: LinhaFoto): BoardPhoto {
  return { ...l, file_name: l.file_name ?? '', stage_at_capture: l.stage_at_capture ?? 'entrada', uploaded_by_name: l.uploaded_by_name ?? '' };
}

export async function fotosDaPlaca(id: string): Promise<BoardPhoto[]> {
  const { data, error } = await supabase.from('board_photos').select('*').eq('board_order_id', id).order('created_at', { ascending: false });
  falhar(error);
  return ((data ?? []) as LinhaFoto[]).map(paraFoto);
}

/** Compacta, envia para a HostGator e registra em board_photos (autor e etapa vêm do banco). */
export async function anexarFotoPlaca(arquivo: File, id: string, categoria: BoardPhotoCategory, legenda?: string): Promise<BoardPhoto> {
  const compactada = await compactarImagem(arquivo);
  const enviado = await enviarParaHostgator(compactada);
  const { data, error } = await supabase
    .from('board_photos')
    .insert({
      board_order_id: id,
      category: categoria,
      public_url: enviado.public_url,
      file_name: enviado.file_name ?? arquivo.name,
      caption: legenda?.trim() || null,
    })
    .select('*')
    .single();
  falhar(error);
  return paraFoto(data as LinhaFoto);
}

/** Apaga o registro (o arquivo continua na HostGator, como nas fotos das OS). */
export async function excluirFotoPlaca(fotoId: string): Promise<void> {
  const { data, error } = await supabase.from('board_photos').delete().eq('id', fotoId).select('id');
  falhar(error);
  if (!data?.length) throw new Error('Sem permissão para excluir esta foto.');
}

// ---------------------------------------------------------------------
// Clientes de placas (cadastro paralelo ao dos clientes do Control)
// ---------------------------------------------------------------------

interface LinhaCliente {
  id: string;
  name: string;
  phone: string;
  kind: BoardCustomerKind;
  city: string | null;
  document: string | null;
  person_type: PersonType;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function paraCliente(l: LinhaCliente, contagem?: { total: number; ultima: string | null }): BoardClient {
  return {
    id: l.id,
    name: l.name,
    phone: l.phone,
    kind: l.kind,
    city: l.city,
    document: l.document,
    person_type: l.person_type,
    address: l.address,
    notes: l.notes,
    board_count: contagem?.total ?? 0,
    last_board_at: contagem?.ultima ?? null,
    created_at: l.created_at,
    updated_at: l.updated_at,
  };
}

export async function listarClientesPlacas(filtro: { busca?: string; tipo?: 'todos' | BoardCustomerKind } = {}): Promise<BoardClient[]> {
  let consulta = supabase.from('board_clients').select('*').order('name', { ascending: true });
  const termo = semAcento((filtro.busca ?? '').trim());
  if (termo) consulta = consulta.ilike('busca', `%${termo}%`);
  if (filtro.tipo && filtro.tipo !== 'todos') consulta = consulta.eq('kind', filtro.tipo);
  const [{ data, error }, { data: placas, error: erroPlacas }] = await Promise.all([
    consulta,
    supabase.from('board_orders').select('board_client_id, created_at').not('board_client_id', 'is', null),
  ]);
  falhar(error);
  falhar(erroPlacas);
  const contagens = new Map<string, { total: number; ultima: string | null }>();
  for (const p of placas ?? []) {
    const c = contagens.get(p.board_client_id as string) ?? { total: 0, ultima: null };
    c.total += 1;
    if (!c.ultima || p.created_at > c.ultima) c.ultima = p.created_at as string;
    contagens.set(p.board_client_id as string, c);
  }
  return ((data ?? []) as LinhaCliente[]).map((l) => paraCliente(l, contagens.get(l.id)));
}

export async function salvarClientePlaca(dados: BoardClientInput): Promise<BoardClient> {
  const linha = {
    name: dados.name.trim(),
    phone: dados.phone.trim(),
    kind: dados.kind,
    city: dados.city?.trim() || null,
    document: dados.document?.trim() || null,
    person_type: dados.person_type ?? 'PF',
    address: dados.address?.trim() || null,
    notes: dados.notes?.trim() || null,
  };
  const consulta = dados.id
    ? supabase.from('board_clients').update(linha).eq('id', dados.id)
    : supabase.from('board_clients').insert(linha);
  const { data, error } = await consulta.select('*').single();
  falhar(error);
  const { count } = await supabase.from('board_orders').select('id', { count: 'exact', head: true }).eq('board_client_id', data.id);
  return paraCliente(data as LinhaCliente, { total: count ?? 0, ultima: null });
}

export async function excluirClientePlaca(id: string): Promise<void> {
  const { error } = await supabase.from('board_clients').delete().eq('id', id);
  falhar(error);
}

// ---------------------------------------------------------------------
// Etiqueta na Elgin (mesma fila e mesmo agente da Oficina: migration 20261110110000_fila_impressao_placas.sql)
// ---------------------------------------------------------------------

/** Manda a etiqueta da placa para a fila. Acompanhe com acompanharPedido() de services/oficina. */
export async function pedirEtiquetaPlacaNaFila(
  placa: BoardOrder,
  opcoes: { copias?: number; largura?: LarguraEtiqueta } = {},
): Promise<PedidoImpressao> {
  const copias = Math.min(10, Math.max(1, Math.round(opcoes.copias ?? 1)));
  const { data, error } = await supabase
    .from('print_jobs')
    .insert({
      kind: 'etiqueta_placa',
      board_order_id: placa.id,
      payload: gerarZplPlaca(placa, { largura: opcoes.largura, copias }),
      copies: copias,
    })
    .select()
    .single();
  falhar(error);
  return data as PedidoImpressao;
}

// ---------------------------------------------------------------------
// Página pública do parceiro (/placa/<token>), sem login
// ---------------------------------------------------------------------

interface RespostaAcompanhamento {
  board_number: string;
  equipment_type: string;
  brand_model: string;
  board_code: string;
  status: BoardStage;
  created_at: string;
  stage_changed_at: string;
  finished_at: string | null;
  quote_status: BoardQuoteStatus;
  is_warranty: boolean;
  reached: Partial<Record<BoardStage, string>>;
  photos: BoardPublicTracking['photos'];
}

export async function buscarAcompanhamentoPublico(token: string): Promise<BoardPublicTracking | null> {
  const limpo = token.trim();
  if (!limpo) return null;
  const { data, error } = await supabase.rpc('placa_acompanhamento', { p_token: limpo });
  falhar(error);
  const r = data as RespostaAcompanhamento | null;
  if (!r) return null;

  const etapas: BoardStage[] = r.status === 'sem_conserto' ? ['entrada', 'diagnostico', 'sem_conserto'] : [...ETAPAS_KANBAN_PLACA.map((e) => e.etapa), 'entregue'];
  const atual = etapas.indexOf(r.status);
  const alcancadas: Partial<Record<BoardStage, string>> = { ...r.reached, entrada: r.reached.entrada ?? r.created_at };
  alcancadas[r.status] = r.finished_at ?? r.stage_changed_at;
  const steps: BoardPublicStageStep[] = etapas.map((etapa, i) => ({
    stage: etapa,
    label: ROTULO_ETAPA_PLACA[etapa],
    state: i < atual ? 'concluida' : i === atual ? 'atual' : 'proxima',
    reached_at: i <= atual ? (alcancadas[etapa] ?? null) : null,
  }));

  const entregue = r.status === 'entregue' && r.finished_at;
  return {
    board_number: r.board_number,
    equipment_type: r.equipment_type,
    brand_model: r.brand_model,
    board_code: r.board_code,
    status: r.status,
    created_at: r.created_at,
    finished_at: r.finished_at,
    quote_status: r.quote_status,
    quote_amount: MOSTRAR_VALOR_ORCAMENTO ? null : null,
    is_warranty: r.is_warranty,
    warranty_until: entregue ? calcularValidadeGarantia(r.finished_at as string) : null,
    warranty_active: entregue ? garantiaVigente(r.finished_at as string) : false,
    steps,
    photos: r.photos ?? [],
  };
}

// ---------------------------------------------------------------------
// Apoio técnico: fichas técnicas e manuais (migration 20261110130000_placas_apoio_tecnico.sql)
// Leitura e cadastro: admin e escritório; editar ficha e excluir ficha/manual: só admin (a RLS garante).
// ---------------------------------------------------------------------

type LinhaFicha = Omit<PlacaFichaTecnica, never> & Record<string, unknown>;

export async function listarFichas(filtro?: FiltroFichasPlacas): Promise<PlacaFichaTecnica[]> {
  // São poucas centenas de fichas: busca (sem acento) e filtros rodam aqui, como na demonstração.
  const { data, error } = await supabase.from('board_tech_sheets').select('*').order('fabricante').limit(2000);
  falhar(error);
  const busca = semAcento(filtro?.busca?.trim() ?? '');
  const fab = semAcento(filtro?.fabricante?.trim() ?? '');
  const btus = (filtro?.btus ?? '').replace(/\D/g, '');
  return ((data ?? []) as LinhaFicha[])
    .filter((f) => {
      if (fab && semAcento(f.fabricante) !== fab) return false;
      if (btus && (f.capacidade_btu ?? '').replace(/\D/g, '') !== btus) return false;
      if (!busca) return true;
      return semAcento(
        [f.fabricante, f.linha, f.tipo_split, f.capacidade_btu, f.evaporadora, f.condensadora, f.ref_evaporadora, f.ref_condensadora, f.gas]
          .filter(Boolean)
          .join(' '),
      ).includes(busca);
    })
    .sort((a, b) =>
      `${a.fabricante} ${a.linha ?? ''} ${a.capacidade_btu ?? ''}`.localeCompare(`${b.fabricante} ${b.linha ?? ''} ${b.capacidade_btu ?? ''}`, 'pt-BR'),
    ) as PlacaFichaTecnica[];
}

export async function buscarFicha(id: string): Promise<PlacaFichaTecnica | null> {
  const { data, error } = await supabase.from('board_tech_sheets').select('*').eq('id', id).maybeSingle();
  falhar(error);
  return (data as PlacaFichaTecnica | null) ?? null;
}

export async function salvarFicha(dados: PlacaFichaInput): Promise<PlacaFichaTecnica> {
  if (!dados.fabricante.trim()) throw new Error('Informe o fabricante do equipamento.');
  if (!dados.evaporadora?.trim() && !dados.condensadora?.trim()) throw new Error('Informe ao menos o modelo da evaporadora ou da condensadora.');

  const { id, ...resto } = dados as PlacaFichaInput & { created_at?: string };
  delete (resto as { created_at?: string }).created_at;
  const campos: Record<string, string | null> = {};
  for (const [chave, valor] of Object.entries(resto)) {
    const texto = typeof valor === 'string' ? valor.trim() : null;
    campos[chave] = texto ? texto : null;
  }
  campos.fabricante = dados.fabricante.trim();

  if (id) {
    const { data, error } = await supabase.from('board_tech_sheets').update(campos as never).eq('id', id).select('*');
    falhar(error);
    if (!data?.length) throw new Error('Apenas administradores podem editar fichas técnicas já cadastradas.');
    return data[0] as PlacaFichaTecnica;
  }
  const { data, error } = await supabase.from('board_tech_sheets').insert(campos as never).select('*').single();
  falhar(error);
  return data as PlacaFichaTecnica;
}

export async function excluirFicha(id: string): Promise<void> {
  const { data, error } = await supabase.from('board_tech_sheets').delete().eq('id', id).select('id');
  falhar(error);
  if (!data?.length) throw new Error('Apenas administradores podem excluir fichas técnicas.');
}

const COLUNAS_MANUAL = 'id, manufacturer, title, file_name, file_type, file_size_bytes, file_url, has_extracted_text, uploaded_by_name, created_at';

export async function listarManuais(filtro?: { busca?: string; fabricante?: string }): Promise<PlacaManual[]> {
  const { data, error } = await supabase.from('board_manuals').select(COLUNAS_MANUAL).order('created_at', { ascending: false }).limit(1000);
  falhar(error);
  const busca = semAcento(filtro?.busca?.trim() ?? '');
  const fab = semAcento(filtro?.fabricante?.trim() ?? '');
  return ((data ?? []) as Array<Omit<PlacaManual, 'file_url'> & { file_url: string | null }>)
    .filter((m) => {
      if (fab && semAcento(m.manufacturer) !== fab) return false;
      return !busca || semAcento(`${m.manufacturer} ${m.title} ${m.file_name}`).includes(busca);
    })
    .map((m) => ({ ...m, file_url: m.file_url ?? '' })) as PlacaManual[];
}

/** Manual em TXT guarda o próprio texto (a IA consulta nele). PDF vai para a HostGator; o texto sai depois, pela IA. */
export async function enviarManual(arquivo: File, dados: EnviarManualPlacaInput): Promise<PlacaManual> {
  if (!dados.manufacturer.trim()) throw new Error('Informe o fabricante do manual.');
  if (!dados.title.trim()) throw new Error('Informe o título ou linha de modelos do manual.');
  const nome = arquivo.name.toLowerCase();
  const ehPdf = arquivo.type === 'application/pdf' || nome.endsWith('.pdf');
  const ehTxt = arquivo.type === 'text/plain' || nome.endsWith('.txt');
  if (!ehPdf && !ehTxt) throw new Error('Envie apenas manuais nos formatos PDF ou TXT.');
  if (arquivo.size > 20 * 1024 * 1024) throw new Error('O manual excede o tamanho máximo de 20 MB.');

  let fileUrl: string | null = null;
  let texto: string | null = null;
  if (ehTxt) texto = await arquivo.text();
  else fileUrl = (await enviarParaHostgator(arquivo)).public_url;

  const { data, error } = await supabase
    .from('board_manuals')
    .insert({
      manufacturer: dados.manufacturer.trim(),
      title: dados.title.trim(),
      file_name: arquivo.name,
      file_type: ehPdf ? 'PDF' : 'TXT',
      file_size_bytes: arquivo.size,
      file_url: fileUrl,
      content_text: texto,
    })
    .select(COLUNAS_MANUAL)
    .single();
  falhar(error);
  return { ...(data as PlacaManual), file_url: (data as { file_url: string | null }).file_url ?? '' };
}

export async function excluirManual(id: string): Promise<void> {
  const { data, error } = await supabase.from('board_manuals').delete().eq('id', id).select('id');
  falhar(error);
  if (!data?.length) throw new Error('Apenas administradores podem excluir manuais.');
}

/** Texto do manual (para abrir manual que só tem texto, sem arquivo). */
export async function textoDoManual(id: string): Promise<string> {
  const { data, error } = await supabase.from('board_manuals').select('content_text').eq('id', id).maybeSingle();
  falhar(error);
  return (data as { content_text: string | null } | null)?.content_text ?? '';
}

// ---------------------------------------------------------------------
// IA do apoio técnico (Edge Function apoio-tecnico, Gemini). Exige a chave GEMINI_API_KEY no Supabase.
// ---------------------------------------------------------------------

async function chamarApoioTecnico<T>(corpo: Record<string, unknown> | FormData): Promise<T> {
  const { data, error } = await supabase.functions.invoke('apoio-tecnico', { body: corpo });
  if (error) {
    const resposta = (error as { context?: Response }).context;
    const detalhe = resposta ? await resposta.json().catch(() => null) : null;
    if (resposta?.status === 404) throw new Error('A IA ainda não foi publicada no Supabase (função apoio-tecnico).');
    throw new Error(detalhe?.erro ?? 'Não foi possível consultar a IA agora. Tente de novo.');
  }
  if ((data as { erro?: string })?.erro) throw new Error((data as { erro: string }).erro);
  return data as T;
}

export async function extrairFichaDoManual(arquivo: File): Promise<ExtracaoFichaManualResultado> {
  const nome = arquivo.name.toLowerCase();
  if (!(arquivo.type === 'application/pdf' || arquivo.type === 'text/plain' || nome.endsWith('.pdf') || nome.endsWith('.txt'))) {
    throw new Error('Formato não suportado. Envie apenas arquivos PDF ou TXT.');
  }
  if (arquivo.size > 20 * 1024 * 1024) throw new Error('Este arquivo é muito grande (máximo de 20 MB).');
  if (arquivo.size === 0) throw new Error('Não foi possível ler este arquivo.');
  const form = new FormData();
  form.append('acao', 'ficha');
  form.append('arquivo', arquivo);
  return chamarApoioTecnico<ExtracaoFichaManualResultado>(form);
}

export async function consultarCodigoErro(dados: ConsultaCodigoErroInput): Promise<ResultadoConsultaErro> {
  if (!dados.marca.trim()) throw new Error('Informe a marca do equipamento.');
  if (!dados.consulta.trim()) throw new Error('Informe o código de erro ou sintoma observado.');
  const r = await chamarApoioTecnico<Omit<ResultadoConsultaErro, 'marca' | 'modelo' | 'codigo_ou_sintoma' | 'consultado_em'>>({
    acao: 'erro',
    marca: dados.marca.trim(),
    modelo: dados.modelo?.trim() ?? '',
    consulta: dados.consulta.trim(),
  });
  return {
    ...r,
    marca: dados.marca.trim(),
    modelo: dados.modelo?.trim() || null,
    codigo_ou_sintoma: dados.consulta.trim(),
    consultado_em: new Date().toISOString(),
  };
}
