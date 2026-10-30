import { supabase } from './supabase';
import { termoSeguro } from './clientes';
import type {
  Attachment,
  CustomerAddress,
  Employee,
  ServiceOrder,
  ServiceOrderPriority,
  ServiceOrderStatus,
  ServiceType,
  Task,
  TaskStatus,
} from '../types/fsm';

export const ORDENS_POR_PAGINA = 50;

export interface FiltrosOrdens {
  termo: string;
  status: ServiceOrderStatus | '';
  tipoId: string;
}

export interface AtividadeResumo {
  id: string;
  status: TaskStatus;
  scheduled_start: string | null;
  finished_at: string | null;
  /** Relato do técnico, mostrado ao passar o mouse na lista de OS */
  technician_notes: string | null;
  employee: { id: string; name: string } | null;
}

const CAMPOS_ATIVIDADE_RESUMO = 'tasks(id, status, scheduled_start, finished_at, technician_notes, employee:employees(id, name))';

export interface OrdemResumo extends ServiceOrder {
  customer: { id: string; name: string } | null;
  service_type: { id: string; name: string } | null;
  tasks: AtividadeResumo[];
}

export interface AtividadeDetalhe extends Task {
  employee: { id: string; name: string } | null;
}

export interface OrdemDetalhe extends ServiceOrder {
  customer: { id: string; name: string } | null;
  service_type: { id: string; name: string } | null;
  tasks: AtividadeDetalhe[];
  attachments: Attachment[];
}

export interface PaginaOrdens {
  itens: OrdemResumo[];
  total: number;
}

export async function listarOrdens(f: FiltrosOrdens, pagina: number): Promise<PaginaOrdens> {
  let query = supabase
    .from('service_orders')
    .select(`*, customer:customers(id, name), service_type:service_types(id, name), ${CAMPOS_ATIVIDADE_RESUMO}`, {
      count: 'exact',
    })
    .order('number', { ascending: false })
    .range(pagina * ORDENS_POR_PAGINA, (pagina + 1) * ORDENS_POR_PAGINA - 1);

  if (f.status) query = query.eq('status', f.status);
  if (f.tipoId) query = query.eq('service_type_id', f.tipoId);

  const termo = termoSeguro(f.termo);
  if (termo) {
    const condicoes = [`description.ilike.%${termo}%`, `internal_notes.ilike.%${termo}%`];
    if (/^\d{1,15}$/.test(termo)) condicoes.push(`number.eq.${termo}`);
    // O nome do cliente está em outra tabela: acha os clientes primeiro e filtra por id
    const { data: clientes, error: erroClientes } = await supabase
      .from('customers')
      .select('id')
      .ilike('name', `%${termo}%`)
      .limit(100);
    if (erroClientes) throw erroClientes;
    if (clientes && clientes.length > 0) condicoes.push(`customer_id.in.(${clientes.map((c) => c.id).join(',')})`);
    query = query.or(condicoes.join(','));
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { itens: (data ?? []) as unknown as OrdemResumo[], total: count ?? 0 };
}

export async function buscarOrdem(id: string): Promise<OrdemDetalhe | null> {
  const { data, error } = await supabase
    .from('service_orders')
    .select(
      '*, customer:customers(id, name), service_type:service_types(id, name), tasks(*, employee:employees(id, name)), attachments(*)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const ordem = data as unknown as OrdemDetalhe;
  ordem.tasks = [...ordem.tasks].sort((a, b) => (a.scheduled_start ?? a.created_at).localeCompare(b.scheduled_start ?? b.created_at));
  ordem.attachments = [...ordem.attachments].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return ordem;
}

export async function listarTipos(): Promise<ServiceType[]> {
  const { data, error } = await supabase.from('service_types').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as ServiceType[];
}

export async function listarTecnicos(): Promise<Pick<Employee, 'id' | 'name' | 'active'>[]> {
  const { data, error } = await supabase.from('employees').select('id, name, active').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function listarEnderecosDoCliente(customerId: string): Promise<CustomerAddress[]> {
  const { data, error } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('customer_id', customerId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CustomerAddress[];
}

export interface SalvarOrdemInput {
  id?: string;
  customer_id: string;
  address_id: string | null;
  service_type_id: string;
  status: ServiceOrderStatus;
  priority: ServiceOrderPriority;
  description: string;
  internal_notes: string;
  due_date: string;
  cancel_reason: string;
  /** Valores atuais, para só carimbar a data quando o status muda de fato */
  completed_at?: string | null;
  cancelled_at?: string | null;
}

function traduzirErro(mensagem: string): string {
  if (mensagem.includes('tasks_scheduled_needs_slot')) return 'Atividade agendada precisa de técnico e data/hora de início.';
  if (mensagem.includes('tasks_schedule_valid')) return 'O horário de término deve ser depois do início.';
  if (mensagem.includes('tasks_execution_valid')) return 'O término real precisa de início e deve ser depois dele.';
  if (mensagem.includes('service_orders_address_fk')) return 'O endereço escolhido não pertence a este cliente.';
  if (mensagem.includes('service_orders_number_key')) return 'Já existe uma OS com este número.';
  return mensagem;
}

/** Cria ou atualiza a OS e devolve o id. */
export async function salvarOrdem(d: SalvarOrdemInput): Promise<string> {
  const agora = new Date().toISOString();
  const campos = {
    customer_id: d.customer_id,
    address_id: d.address_id,
    service_type_id: d.service_type_id,
    status: d.status,
    priority: d.priority,
    description: d.description.trim() || null,
    internal_notes: d.internal_notes.trim() || null,
    due_date: d.due_date || null,
    completed_at: d.status === 'concluida' ? (d.completed_at ?? agora) : null,
    cancelled_at: d.status === 'cancelada' ? (d.cancelled_at ?? agora) : null,
    cancel_reason: d.status === 'cancelada' ? d.cancel_reason.trim() || null : null,
  };

  if (d.id) {
    const { error } = await supabase.from('service_orders').update(campos).eq('id', d.id);
    if (error) throw new Error(traduzirErro(error.message));
    if (d.status === 'concluida') await concluirAtividadesAbertas(d.id);
    return d.id;
  }
  const { data, error } = await supabase.from('service_orders').insert(campos).select('id').single();
  if (error) throw new Error(traduzirErro(error.message));
  return data.id as string;
}

export interface SalvarAtividadeInput {
  id?: string;
  service_order_id: string;
  employee_id: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  technician_notes: string;
  /** Início/término reais (digitados no painel); `undefined` = não mexe. Concluída sem eles: carimba. */
  started_at?: string | null;
  finished_at?: string | null;
}

/**
 * Check-in/check-out de uma atividade concluída pelo escritório: mantém o que o técnico registrou;
 * sem registro, usa o início agendado (se já passou) e a hora atual.
 */
function carimbosConclusao(
  t: { scheduled_start: string | null; started_at?: string | null; finished_at?: string | null },
  agora: string,
): { started_at: string; finished_at: string } {
  const fim = t.finished_at ?? agora;
  const inicio = t.started_at ?? (t.scheduled_start && t.scheduled_start <= fim ? t.scheduled_start : fim);
  return { started_at: inicio, finished_at: fim };
}

/** OS concluída: as atividades ainda abertas são concluídas junto (senão continuam "em execução" na linha do tempo). */
async function concluirAtividadesAbertas(ordemId: string): Promise<void> {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, scheduled_start, started_at, finished_at')
    .eq('service_order_id', ordemId)
    .not('status', 'in', '(concluida,cancelada)');
  if (error) throw new Error(traduzirErro(error.message));
  const agora = new Date().toISOString();
  for (const t of data ?? []) {
    const { error: erro } = await supabase
      .from('tasks')
      .update({ status: 'concluida', ...carimbosConclusao(t, agora) })
      .eq('id', t.id);
    if (erro) throw new Error(`OS salva, mas não foi possível concluir uma atividade: ${traduzirErro(erro.message)}`);
  }
}

export async function salvarAtividade(d: SalvarAtividadeInput): Promise<void> {
  const campos = {
    service_order_id: d.service_order_id,
    employee_id: d.employee_id,
    title: d.title.trim(),
    description: d.description.trim() || null,
    status: d.status,
    scheduled_start: d.scheduled_start,
    scheduled_end: d.scheduled_end,
    technician_notes: d.technician_notes.trim() || null,
    ...(d.started_at !== undefined && { started_at: d.started_at }),
    ...(d.finished_at !== undefined && { finished_at: d.finished_at }),
    // Concluída sem início/término informados: completa com o agendado e a hora atual
    ...(d.status === 'concluida' && carimbosConclusao(d, new Date().toISOString())),
  };
  const { error } = d.id
    ? await supabase.from('tasks').update(campos).eq('id', d.id)
    : await supabase.from('tasks').insert(campos);
  if (error) throw new Error(traduzirErro(error.message));
}

export async function removerAtividade(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw new Error(traduzirErro(error.message));
}

/** OS de um cliente (da mais nova para a mais antiga), para a aba Atendimento do cadastro. */
export async function listarOrdensDoCliente(customerId: string): Promise<OrdemResumo[]> {
  const { data, error } = await supabase
    .from('service_orders')
    .select(`*, customer:customers(id, name), service_type:service_types(id, name), ${CAMPOS_ATIVIDADE_RESUMO}`)
    .eq('customer_id', customerId)
    .order('number', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as OrdemResumo[];
}
