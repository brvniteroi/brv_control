// Avaliação do atendimento pelo cliente (estrelas e comentário). Ver migration 20261102160000_avaliacoes.sql.
import { supabase } from './supabase';

export interface Avaliacao {
  id: string;
  service_order_id: string;
  task_id: string | null;
  employee_id: string | null;
  customer_id: string;
  stars: number;
  comment: string | null;
  field_control_id: string | null;
  /** Por onde o cliente chegou à avaliação (link do e-mail ou do WhatsApp); null = link copiado ou histórico. */
  origem: OrigemAvaliacao | null;
  created_at: string;
  employee: { id: string; name: string } | null;
  service_order: { id: string; number: number } | null;
}

export type OrigemAvaliacao = 'email' | 'whatsapp';

/** Pedido de avaliação: e-mail automático ao concluir ou WhatsApp pelo botão. Ver migration 20261107100000. */
export interface PedidoAvaliacao {
  id: string;
  channel: OrigemAvaliacao;
  /** pendente = entregue ao servidor de e-mail, aguardando confirmação; pulado = uma regra impediu o envio */
  status: 'pendente' | 'enviado' | 'falhou' | 'pulado';
  detail: string | null;
  created_at: string;
}

/** Depois de pedir por e-mail, o WhatsApp só é liberado se o cliente não avaliar neste prazo. */
export const ESPERA_EMAIL_HORAS = 72;

export async function pedidosDaOS(osId: string): Promise<PedidoAvaliacao[]> {
  const { data, error } = await supabase
    .from('rating_requests')
    .select('id, channel, status, detail, created_at')
    .eq('service_order_id', osId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PedidoAvaliacao[];
}

/** Registra o pedido feito pelo WhatsApp (conta na regra das 72 h do e-mail automático). */
export async function registrarPedidoWhatsapp(osId: string): Promise<void> {
  const { error } = await supabase.rpc('registrar_pedido_avaliacao_whatsapp', { p_os: osId });
  if (error) throw new Error(error.message);
}

const SELECT = '*, employee:employees(id, name), service_order:service_orders(id, number)';

export async function avaliacoesDaOS(osId: string): Promise<Avaliacao[]> {
  const { data, error } = await supabase.from('ratings').select(SELECT).eq('service_order_id', osId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Avaliacao[];
}

export async function avaliacoesDoCliente(clienteId: string): Promise<Avaliacao[]> {
  const { data, error } = await supabase.from('ratings').select(SELECT).eq('customer_id', clienteId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Avaliacao[];
}

/** Média e quantidade de avaliações por colaborador (id -> resumo). */
export async function mediasPorTecnico(): Promise<Map<string, { media: number; quantidade: number }>> {
  const { data, error } = await supabase.from('avaliacoes_por_tecnico').select('employee_id, media, quantidade');
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((d) => [d.employee_id as string, { media: Number(d.media), quantidade: Number(d.quantidade) }]));
}

/** Link público da avaliação da OS (a OS precisa estar concluída). */
export async function gerarLinkAvaliacao(osId: string): Promise<string> {
  const { data, error } = await supabase.rpc('gerar_link_avaliacao', { p_os: osId });
  if (error) throw new Error(error.message);
  return `${window.location.origin}/avaliar/${data as string}`;
}

/** Telefone principal do cliente só com dígitos, no formato do WhatsApp (55 + DDD + número), ou null. */
export async function whatsappDoCliente(clienteId: string): Promise<string | null> {
  const { data, error } = await supabase.from('customers').select('phone').eq('id', clienteId).maybeSingle();
  if (error) throw new Error(error.message);
  const digitos = (data?.phone ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) return digitos;
  return null;
}

// ---------- App do técnico ----------

export interface MinhasAvaliacoes {
  media: number | null;
  quantidade: number;
  itens: { estrelas: number; comentario: string | null; data: string; os: number }[];
}

/** Avaliações que o técnico do login recebeu nos últimos `dias`. */
export async function minhasAvaliacoes(dias = 30): Promise<MinhasAvaliacoes> {
  const { data, error } = await supabase.rpc('minhas_avaliacoes', { p_dias: dias });
  if (error) throw new Error(error.message);
  const r = data as MinhasAvaliacoes;
  return { ...r, media: r.media === null ? null : Number(r.media) };
}

// ---------- Página pública (/avaliar/:token, sem login) ----------

export interface DadosAvaliacao {
  numero: number;
  servico: string | null;
  data: string | null;
  tecnico: string | null;
  avaliada: boolean;
  estrelas: number | null;
  comentario: string | null;
}

/** null = link inválido. */
export async function verAvaliacao(token: string): Promise<DadosAvaliacao | null> {
  const { data, error } = await supabase.rpc('avaliacao_ver', { p_token: token });
  if (error) throw new Error('Não foi possível abrir a avaliação. Verifique sua internet e tente de novo.');
  return (data as DadosAvaliacao | null) ?? null;
}

export async function enviarAvaliacao(
  token: string,
  estrelas: number,
  comentario: string,
  origem: OrigemAvaliacao | null = null,
): Promise<void> {
  const { error } = await supabase.rpc('avaliacao_enviar', {
    p_token: token,
    p_estrelas: estrelas,
    p_comentario: comentario,
    // Só manda quando existe: o link copiado (sem origem) funciona com qualquer versão da função
    ...(origem && { p_origem: origem }),
  });
  if (error) throw new Error(error.message.includes('fetch') ? 'Sem conexão. Tente de novo.' : error.message);
}
