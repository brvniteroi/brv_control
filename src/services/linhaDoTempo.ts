import { supabase } from './supabase';
import type {
  Employee,
  ServiceOrderPriority,
  ServiceOrderStatus,
  Task,
} from '../types/fsm';

export type TecnicoLinha = Pick<Employee, 'id' | 'name' | 'timeline_color'>;

/** Dados da OS mostrados no bloco da atividade (a tabela `tasks` não os traz). */
export interface OrdemLinha {
  id: string;
  number: number;
  status: ServiceOrderStatus;
  priority: ServiceOrderPriority;
  customer: { id: string; name: string } | null;
  service_type: { id: string; name: string; default_duration_minutes: number | null } | null;
  /** Bairro e cidade do endereço do atendimento. */
  local: string | null;
}

/** Técnicos ativos (os que aparecem como linhas da linha do tempo). */
export async function listarTecnicosLinha(): Promise<TecnicoLinha[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('id, name, timeline_color')
    .eq('active', true)
    .eq('role', 'tecnico')
    .order('name');
  if (error) throw new Error(`Não foi possível carregar os técnicos: ${error.message}`);
  return data ?? [];
}

/** Atividades com horário que tocam o intervalo [inicio, fim) (ISO). */
export async function listarAtividadesDoDia(inicio: string, fim: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .lt('scheduled_start', fim)
    .gt('scheduled_end', inicio)
    .order('scheduled_start');
  if (error) throw new Error(`Não foi possível carregar as atividades: ${error.message}`);
  return (data ?? []) as Task[];
}

/** Atividades ainda sem horário (fila de "a agendar"): pendentes de OS que não está encerrada. */
export async function listarAtividadesSemHorario(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .is('scheduled_start', null)
    .not('status', 'in', '(concluida,cancelada)')
    .order('created_at')
    .limit(200);
  if (error) throw new Error(`Não foi possível carregar as atividades a agendar: ${error.message}`);
  return (data ?? []) as Task[];
}

/** Dados de OS (número, cliente, tipo, local) para um conjunto de ids. */
export async function buscarOrdensLinha(ids: string[]): Promise<OrdemLinha[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('service_orders')
    .select(
      'id, number, status, priority, address_id, customer:customers(id, name), service_type:service_types(id, name, default_duration_minutes)',
    )
    .in('id', ids);
  if (error) throw new Error(`Não foi possível carregar as OS: ${error.message}`);
  const ordens = (data ?? []) as unknown as (Omit<OrdemLinha, 'local'> & { address_id: string | null })[];

  const idsEndereco = [...new Set(ordens.map((o) => o.address_id).filter((x): x is string => !!x))];
  const locais = new Map<string, string>();
  if (idsEndereco.length > 0) {
    const { data: enderecos, error: erroEnd } = await supabase
      .from('customer_addresses')
      .select('id, district, city')
      .in('id', idsEndereco);
    if (erroEnd) throw new Error(`Não foi possível carregar os endereços: ${erroEnd.message}`);
    for (const e of enderecos ?? []) {
      locais.set(e.id, [e.district, e.city].filter(Boolean).join(', '));
    }
  }

  return ordens.map(({ address_id, ...o }) => ({
    ...o,
    local: (address_id && locais.get(address_id)) || null,
  }));
}

function traduzirErro(mensagem: string): string {
  if (mensagem.includes('tasks_scheduled_needs_slot')) return 'Atividade agendada precisa de técnico e horário.';
  if (mensagem.includes('tasks_schedule_valid')) return 'O horário de término deve ser depois do início.';
  if (mensagem.includes('row-level security') || mensagem.includes('permission')) {
    return 'Você não tem permissão para reagendar esta atividade.';
  }
  return mensagem;
}

/**
 * Agenda ou reagenda: define técnico e horário. Atividade `pendente` vira `agendada`.
 * Só deve ser chamada para atividades que `podeMover` (pendente/agendada).
 */
export async function agendarAtividade(
  id: string,
  d: { employee_id: string; scheduled_start: string; scheduled_end: string },
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update({ ...d, status: 'agendada' })
    .eq('id', id)
    .in('status', ['pendente', 'agendada']) // não mexe em atividade que o técnico já iniciou
    .select()
    .maybeSingle();
  if (error) throw new Error(traduzirErro(error.message));
  if (!data) throw new Error('Esta atividade já foi iniciada ou alterada por outra pessoa. Atualize a tela.');
  return data as Task;
}

/** Devolve a atividade para a fila "a agendar" (sem horário, status pendente). */
export async function desagendarAtividade(id: string): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update({ scheduled_start: null, scheduled_end: null, status: 'pendente' })
    .eq('id', id)
    .in('status', ['pendente', 'agendada'])
    .select()
    .maybeSingle();
  if (error) throw new Error(traduzirErro(error.message));
  if (!data) throw new Error('Esta atividade já foi iniciada ou alterada por outra pessoa. Atualize a tela.');
  return data as Task;
}
