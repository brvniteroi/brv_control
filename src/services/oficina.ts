// Módulo Oficina (migration 20261108130000_oficina_base.sql; plano em docs/oficina.md).
// As telas leem pela visão oficina_itens (nomes do cliente/OS/técnicos sem abrir o cadastro ao papel
// 'oficina') e gravam em workshop_orders. Regras de etapa, autor e datas ficam no banco.
import { supabase } from './supabase';
import { anexarFoto } from './anexos';
import type { Attachment, AttachmentCategory } from '../types/fsm';
import type {
  AgenteImpressao,
  CamposBancada,
  CamposEscritorio,
  CanalResposta,
  DecisaoCliente,
  EtapaOficina,
  EventoOficina,
  ItemOficina,
  ItemOficinaTela,
  NovoItemOficina,
  OsParaOficina,
  PedidoImpressao,
} from '../types/oficina';
import { ETAPAS_FINAIS } from '../utils/oficina';
import { dadosEtiqueta, gerarZpl, gerarZplTeste, type LarguraEtiqueta } from '../utils/etiquetaOficina';

const POR_PAGINA = 50;

/** Mensagens do banco em português claro (os RAISE EXCEPTION da migration já vêm prontos). */
function traduzir(mensagem: string): string {
  if (mensagem.includes('workshop_orders_item_key')) return 'Outro item acabou de ser registrado nesta OS. Tente de novo.';
  if (mensagem.includes('attachments_workshop_order_id_fkey')) return 'Este item tem fotos: cancele em vez de excluir.';
  if (mensagem.includes('row-level security')) return 'Sem permissão para esta ação.';
  return mensagem;
}

function falhar(error: { message: string } | null): void {
  if (error) throw new Error(traduzir(error.message));
}

// ---------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------

/** Itens em aberto (Kanban), do mais antigo para o mais novo. */
export async function listarItensAbertos(): Promise<ItemOficinaTela[]> {
  const { data, error } = await supabase
    .from('oficina_itens')
    .select('*')
    .not('status', 'in', `(${ETAPAS_FINAIS.join(',')})`)
    .order('created_at', { ascending: true });
  falhar(error);
  return (data ?? []) as ItemOficinaTela[];
}

export interface FiltroFinalizados {
  pagina: number;            // começa em 0
  /** Número da OS, cliente, tipo, marca ou modelo */
  busca?: string;
  etapa?: 'entregue' | 'descarte' | 'cancelado';
}

/** Itens finalizados, paginados no servidor (mais recentes primeiro). */
export async function listarItensFinalizados(f: FiltroFinalizados): Promise<{ itens: ItemOficinaTela[]; total: number }> {
  let q = supabase
    .from('oficina_itens')
    .select('*', { count: 'exact' })
    .in('status', f.etapa ? [f.etapa] : ETAPAS_FINAIS);
  const termo = f.busca?.trim();
  if (termo) {
    if (/^\d+$/.test(termo)) {
      q = q.eq('os_number', Number(termo));
    } else {
      const t = termo.replace(/[%,()]/g, ' ');
      q = q.or(`customer_name.ilike.%${t}%,equipment_type.ilike.%${t}%,brand.ilike.%${t}%,model.ilike.%${t}%`);
    }
  }
  const { data, error, count } = await q
    .order('finished_at', { ascending: false, nullsFirst: false })
    .range(f.pagina * POR_PAGINA, f.pagina * POR_PAGINA + POR_PAGINA - 1);
  falhar(error);
  return { itens: (data ?? []) as ItemOficinaTela[], total: count ?? 0 };
}

export const ITENS_POR_PAGINA = POR_PAGINA;

export async function buscarItem(id: string): Promise<ItemOficinaTela | null> {
  const { data, error } = await supabase.from('oficina_itens').select('*').eq('id', id).maybeSingle();
  falhar(error);
  return (data as ItemOficinaTela) ?? null;
}

/** Itens de uma OS (bloco "Na oficina" na OS). */
export async function itensDaOS(serviceOrderId: string): Promise<ItemOficinaTela[]> {
  const { data, error } = await supabase
    .from('oficina_itens')
    .select('*')
    .or(`service_order_id.eq.${serviceOrderId},return_service_order_id.eq.${serviceOrderId}`)
    .order('item_number');
  falhar(error);
  return (data ?? []) as ItemOficinaTela[];
}

/** Itens do cliente (aba Atendimento do cadastro). */
export async function itensDoCliente(customerId: string): Promise<ItemOficinaTela[]> {
  const { data, error } = await supabase
    .from('oficina_itens')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  falhar(error);
  return (data ?? []) as ItemOficinaTela[];
}

/** Dados de uma OS pelo número, para registrar a entrada de um item ligado a ela. */
export async function buscarOsPorNumero(numero: number): Promise<OsParaOficina | null> {
  const { data, error } = await supabase.rpc('oficina_buscar_os', { p_numero: numero });
  falhar(error);
  const linhas = (data ?? []) as OsParaOficina[];
  return linhas[0] ?? null;
}

export async function historicoDoItem(id: string): Promise<EventoOficina[]> {
  const { data, error } = await supabase
    .from('workshop_order_events')
    .select('*')
    .eq('workshop_order_id', id)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  falhar(error);
  return (data ?? []) as EventoOficina[];
}

/** Funcionários que podem ficar como técnico de bancada (categoria oficina) e de retirada (técnicos de campo). */
export async function listarTecnicosOficina(): Promise<{ id: string; name: string; role: string }[]> {
  // Pela função do banco: o papel 'oficina' não lê employees (telefones/e-mails da equipe)
  const { data, error } = await supabase.rpc('oficina_funcionarios');
  falhar(error);
  return (data ?? []) as { id: string; name: string; role: string }[];
}

// ---------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------

/**
 * Item ligado a uma OS que já existe (escritório ou oficina). `chegou = true` entra direto na "Entrada"
 * (o item está na loja); `false` fica "Em trânsito" (o técnico ainda está trazendo).
 */
export async function criarItemNaOS(
  serviceOrderId: string,
  dados: NovoItemOficina & { pickup_employee_id?: string | null; task_id?: string | null },
  chegou = true,
): Promise<ItemOficina> {
  const { data, error } = await supabase
    .from('workshop_orders')
    .insert({ ...dados, service_order_id: serviceOrderId, status: chegou ? 'entrada' : 'em_transito' })
    .select()
    .single();
  falhar(error);
  return data as ItemOficina;
}

/** Entrada de balcão (sem visita): o banco cria a OS e o item juntos. Só o escritório. */
export async function entradaBalcao(customerId: string, addressId: string | null, dados: NovoItemOficina): Promise<string> {
  const { data, error } = await supabase.rpc('oficina_entrada_balcao', {
    p_customer_id: customerId,
    p_address_id: addressId,
    p_item: dados,
  });
  falhar(error);
  return data as string;
}

/**
 * App de campo: itens recolhidos nesta atividade. Lê a tabela (o técnico não tem a visão oficina_itens;
 * a RLS libera os itens das OS dele).
 */
export async function itensDaAtividade(taskId: string): Promise<ItemOficina[]> {
  const { data, error } = await supabase
    .from('workshop_orders')
    .select('*')
    .eq('task_id', taskId)
    .order('item_number');
  falhar(error);
  return (data ?? []) as ItemOficina[];
}

/** App de campo: técnico registra a retirada na atividade (fase 3). */
export async function recolherNoCampo(taskId: string, dados: NovoItemOficina): Promise<string> {
  const { data, error } = await supabase.rpc('oficina_recolher', { p_task_id: taskId, p_item: dados });
  falhar(error);
  return data as string;
}

// ---------------------------------------------------------------------
// Andamento
// ---------------------------------------------------------------------

async function atualizar(id: string, campos: Record<string, unknown>): Promise<ItemOficina> {
  const { data, error } = await supabase.from('workshop_orders').update(campos).eq('id', id).select().single();
  falhar(error);
  return data as ItemOficina;
}

/** Bancada e escritório: dados técnicos. O banco recusa o que o papel não pode mudar. */
export function atualizarItem(id: string, campos: CamposBancada | CamposEscritorio): Promise<ItemOficina> {
  return atualizar(id, campos);
}

/** Muda a etapa (arraste no Kanban ou botão). Para final use as funções próprias abaixo. */
export function mudarEtapa(id: string, etapa: Exclude<EtapaOficina, 'entregue' | 'descarte' | 'cancelado'>): Promise<ItemOficina> {
  return atualizar(id, { status: etapa });
}

/** Chegou na loja (Em trânsito → Entrada). A tela pede a etiqueta logo depois. */
export function receberItem(id: string, conferencia?: string): Promise<ItemOficina> {
  return atualizar(id, { status: 'entrada', ...(conferencia?.trim() ? { intake_notes: conferencia.trim() } : {}) });
}

/** Orçamento feito no SicWeb e enviado ao cliente: guarda a referência e passa para "Aguardando cliente". */
export function registrarOrcamento(
  id: string,
  o: { referencia: string; valor: number | null; enviado?: boolean },
): Promise<ItemOficina> {
  return atualizar(id, {
    quote_reference: o.referencia.trim() || null,
    quote_amount: o.valor,
    ...(o.enviado === false ? {} : { status: 'aguardando_cliente', quote_sent_at: new Date().toISOString() }),
  });
}

/**
 * Resposta do cliente ao orçamento. Aprovado segue para "Aguardando peça" (se faltar peça) ou "Em reparo";
 * recusado vai para "Pronto" (devolver sem conserto). Recusado com descarte: use autorizarDescarte.
 */
export function registrarResposta(
  id: string,
  r: { decisao: DecisaoCliente; canal: CanalResposta; observacao?: string; faltaPeca?: boolean },
): Promise<ItemOficina> {
  const proxima: EtapaOficina = r.decisao === 'recusado' ? 'pronto' : r.faltaPeca ? 'aguardando_peca' : 'em_reparo';
  return atualizar(id, {
    decision: r.decisao,
    decision_channel: r.canal,
    decision_note: r.observacao?.trim() || null,
    status: proxima,
  });
}

/**
 * Cliente autorizou o descarte: registra a autorização e finaliza como "Descartado". O banco exige canal e
 * descrição, e grava um comentário na OS de origem. Se ainda não havia resposta ao orçamento, fica "recusado".
 */
export function autorizarDescarte(
  item: Pick<ItemOficina, 'id' | 'decision'>,
  a: { canal: CanalResposta; descricao: string },
): Promise<ItemOficina> {
  return atualizar(item.id, {
    ...(item.decision ? {} : { decision: 'recusado', decision_channel: a.canal }),
    discard_channel: a.canal,
    discard_note: a.descricao.trim(),
    status: 'descarte',
  });
}

/** Entregue sem OS de devolução (cliente buscou na loja). Com OS de devolução, a baixa é automática ao concluí-la. */
export function marcarEntregue(id: string): Promise<ItemOficina> {
  return atualizar(id, { status: 'entregue' });
}

export function cancelarItem(id: string, motivo: string): Promise<ItemOficina> {
  return atualizar(id, { status: 'cancelado', cancel_reason: motivo.trim() });
}

/** Admin: reabre um item finalizado (volta para "Pronto"). */
export function reabrirItem(id: string): Promise<ItemOficina> {
  return atualizar(id, { status: 'pronto' });
}

/** OS de devolução (sem atividade: agendar depois pela linha do tempo). Devolve o id da OS criada. */
export async function criarOsDevolucao(itemIds: string[], serviceTypeId: string, descricao?: string): Promise<string> {
  const { data, error } = await supabase.rpc('oficina_criar_os_devolucao', {
    p_item_ids: itemIds,
    p_service_type_id: serviceTypeId,
    p_descricao: descricao ?? null,
  });
  falhar(error);
  return data as string;
}

/** Nota livre no histórico (autor e data vêm do login). */
export async function anotarNoHistorico(id: string, nota: string): Promise<void> {
  const { error } = await supabase.from('workshop_order_events').insert({ workshop_order_id: id, event: 'nota', note: nota.trim() });
  falhar(error);
}

// ---------------------------------------------------------------------
// Fotos (HostGator, como as da OS; não aparecem na galeria da OS)
// ---------------------------------------------------------------------

export async function fotosDoItem(id: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('workshop_order_id', id)
    .order('created_at', { ascending: true });
  falhar(error);
  return (data ?? []) as Attachment[];
}

/** 'antes' = chegada/diagnóstico, 'depois' = consertado, 'documento' = comprovante (ex.: print da autorização). */
export function anexarFotoItem(arquivo: File, id: string, categoria: AttachmentCategory = 'outros', legenda?: string): Promise<Attachment> {
  return anexarFoto(arquivo, { workshopOrderId: id, category: categoria, caption: legenda });
}

// ---------------------------------------------------------------------
// Impressão (fila → agente no servidor da loja → Elgin)
// ---------------------------------------------------------------------

/** Agente com sinal nos últimos 90 s = Elgin disponível. */
export const AGENTE_ONLINE_MS = 90_000;

export async function situacaoImpressora(): Promise<{ online: boolean; agente: AgenteImpressao | null }> {
  const { data, error } = await supabase
    .from('print_agents')
    .select('*')
    .eq('printer', 'elgin')
    .order('last_seen_at', { ascending: false })
    .limit(1);
  falhar(error);
  const agente = ((data ?? [])[0] as AgenteImpressao) ?? null;
  const online = !!agente && Date.now() - new Date(agente.last_seen_at).getTime() < AGENTE_ONLINE_MS;
  return { online, agente };
}

/** Manda a etiqueta do item para a fila. Acompanhe com acompanharPedido(). */
export async function pedirEtiqueta(
  item: ItemOficinaTela,
  opcoes: { copias?: number; largura?: LarguraEtiqueta; totalNaOs?: number } = {},
): Promise<PedidoImpressao> {
  const copias = opcoes.copias ?? 1;
  const { data, error } = await supabase
    .from('print_jobs')
    .insert({
      kind: 'etiqueta_oficina',
      workshop_order_id: item.id,
      payload: gerarZpl(dadosEtiqueta(item, opcoes.totalNaOs), { largura: opcoes.largura, copias }),
      copies: copias,
    })
    .select()
    .single();
  falhar(error);
  return data as PedidoImpressao;
}

export async function pedirEtiquetaTeste(quem: string): Promise<PedidoImpressao> {
  const { data, error } = await supabase
    .from('print_jobs')
    .insert({ kind: 'teste', payload: gerarZplTeste(quem), copies: 1 })
    .select()
    .single();
  falhar(error);
  return data as PedidoImpressao;
}

export async function cancelarPedido(id: string): Promise<void> {
  const { error } = await supabase.from('print_jobs').update({ status: 'cancelada' }).eq('id', id);
  falhar(error);
}

export async function pedidosDoItem(id: string): Promise<PedidoImpressao[]> {
  const { data, error } = await supabase
    .from('print_jobs')
    .select('*')
    .eq('workshop_order_id', id)
    .order('created_at', { ascending: false })
    .limit(20);
  falhar(error);
  return (data ?? []) as PedidoImpressao[];
}

/**
 * Acompanha um pedido até sair da fila (Realtime + conferência a cada 3 s, no máximo 60 s).
 * `aoMudar` recebe cada situação nova; a promessa resolve com a final (impressa, falhou ou cancelada)
 * ou com a última vista, se o tempo acabar.
 */
export function acompanharPedido(id: string, aoMudar?: (p: PedidoImpressao) => void): Promise<PedidoImpressao | null> {
  return new Promise((resolve) => {
    let ultimo: PedidoImpressao | null = null;
    let encerrado = false;
    const finais = ['impressa', 'falhou', 'cancelada'];

    const ver = (p: PedidoImpressao) => {
      if (encerrado) return;
      if (!ultimo || ultimo.status !== p.status) aoMudar?.(p);
      ultimo = p;
      if (finais.includes(p.status)) encerrar();
    };
    const conferir = async () => {
      const { data } = await supabase.from('print_jobs').select('*').eq('id', id).maybeSingle();
      if (data) ver(data as PedidoImpressao);
    };
    const canal = supabase
      .channel(`print_job:${id}`)
      .on<PedidoImpressao>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'print_jobs', filter: `id=eq.${id}` },
        (ev) => ver(ev.new as PedidoImpressao))
      .subscribe();
    const relogio = setInterval(conferir, 3000);
    const limite = setTimeout(encerrar, 60_000);

    function encerrar() {
      if (encerrado) return;
      encerrado = true;
      clearInterval(relogio);
      clearTimeout(limite);
      supabase.removeChannel(canal);
      resolve(ultimo);
    }
    conferir();
  });
}
