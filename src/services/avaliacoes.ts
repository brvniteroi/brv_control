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
  created_at: string;
  employee: { id: string; name: string } | null;
  service_order: { id: string; number: number } | null;
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

export async function enviarAvaliacao(token: string, estrelas: number, comentario: string): Promise<void> {
  const { error } = await supabase.rpc('avaliacao_enviar', { p_token: token, p_estrelas: estrelas, p_comentario: comentario });
  if (error) throw new Error(error.message.includes('fetch') ? 'Sem conexão. Tente de novo.' : error.message);
}
