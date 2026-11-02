import { supabase } from './supabase';
import type {
  Employee,
  ServiceOrderPriority,
  ServiceOrderStatus,
  Tag,
  Task,
} from '../types/fsm';
import { ordenarEtiquetas } from './etiquetas';

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
  /** Endereço do atendimento (o da OS ou, sem ele, o principal do cliente), com coordenadas para o mapa. */
  endereco: { texto: string; lat: number | null; lng: number | null } | null;
  /** Etiquetas da OS (ex.: "Aguardando pagamento"), em ordem alfabética. */
  etiquetas: Tag[];
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

/** Atividades com horário que tocam o intervalo [inicio, fim) (ISO): um dia ou o mês do calendário. */
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

/** Todos os colaboradores (inclusive inativos), para nome e cor de quem aparece no calendário. */
export async function listarColaboradoresCores(): Promise<(TecnicoLinha & Pick<Employee, 'active' | 'role'>)[]> {
  const { data, error } = await supabase.from('employees').select('id, name, timeline_color, active, role').order('name');
  if (error) throw new Error(`Não foi possível carregar os colaboradores: ${error.message}`);
  return data ?? [];
}

/** Ids por requisição: muitos ids no `in(...)` estouram o tamanho da URL. */
const LOTE_IDS = 100;

/** Dados de OS (número, cliente, tipo, local) para um conjunto de ids. */
export async function buscarOrdensLinha(ids: string[]): Promise<OrdemLinha[]> {
  if (ids.length === 0) return [];
  if (ids.length > LOTE_IDS) {
    const lotes: string[][] = [];
    for (let i = 0; i < ids.length; i += LOTE_IDS) lotes.push(ids.slice(i, i + LOTE_IDS));
    return (await Promise.all(lotes.map(buscarOrdensLinha))).flat();
  }
  const { data, error } = await supabase
    .from('service_orders')
    .select(
      'id, number, status, priority, address_id, customer:customers(id, name), service_type:service_types(id, name, default_duration_minutes), etiquetas:tags(id, name, color)',
    )
    .in('id', ids);
  if (error) throw new Error(`Não foi possível carregar as OS: ${error.message}`);
  const ordens = (data ?? []) as unknown as (Omit<OrdemLinha, 'local' | 'endereco'> & { address_id: string | null })[];

  // Endereço da OS; sem ele, o principal do cliente
  const idsEndereco = [...new Set(ordens.map((o) => o.address_id).filter((x): x is string => !!x))];
  const idsClienteSemEndereco = [
    ...new Set(ordens.flatMap((o) => (!o.address_id && o.customer ? [o.customer.id] : []))),
  ];
  const [porId, principais] = await Promise.all([
    idsEndereco.length > 0
      ? supabase.from('customer_addresses').select(CAMPOS_ENDERECO).in('id', idsEndereco)
      : { data: [], error: null },
    idsClienteSemEndereco.length > 0
      ? supabase.from('customer_addresses').select(CAMPOS_ENDERECO).in('customer_id', idsClienteSemEndereco).eq('is_primary', true)
      : { data: [], error: null },
  ]);
  const erroEnd = porId.error ?? principais.error;
  if (erroEnd) throw new Error(`Não foi possível carregar os endereços: ${erroEnd.message}`);
  const enderecos = new Map<string, EnderecoBruto>((porId.data as EnderecoBruto[]).map((e) => [e.id, e]));
  const principalDoCliente = new Map<string, EnderecoBruto>((principais.data as EnderecoBruto[]).map((e) => [e.customer_id, e]));

  return ordens.map(({ address_id, ...o }) => {
    const e = (address_id && enderecos.get(address_id)) || (o.customer && principalDoCliente.get(o.customer.id)) || null;
    return {
      ...o,
      local: (address_id && e && [e.district, e.city].filter(Boolean).join(', ')) || null,
      endereco: e && {
        texto: [[e.street, e.number].filter(Boolean).join(', '), e.district, e.city].filter(Boolean).join(' - '),
        lat: e.latitude,
        lng: e.longitude,
      },
      etiquetas: ordenarEtiquetas(o.etiquetas),
    };
  });
}

const CAMPOS_ENDERECO = 'id, customer_id, street, number, district, city, latitude, longitude';

interface EnderecoBruto {
  id: string;
  customer_id: string;
  street: string;
  number: string | null;
  district: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

function traduzirErro(mensagem: string): string {
  if (mensagem.includes('tasks_scheduled_needs_slot')) return 'A atividade precisa de técnico e horário.';
  if (mensagem.includes('tasks_schedule_valid')) return 'O horário de término deve ser depois do início.';
  if (mensagem.includes('row-level security') || mensagem.includes('permission')) {
    return 'Você não tem permissão para reagendar esta atividade.';
  }
  return mensagem;
}

/**
 * Reagenda: muda técnico e horário. Só deve ser chamada para atividades que `podeMover` (agendada).
 */
export async function agendarAtividade(
  id: string,
  d: { employee_id: string; scheduled_start: string; scheduled_end: string },
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update({
      ...d,
      estimated_minutes: Math.max(1, Math.round((Date.parse(d.scheduled_end) - Date.parse(d.scheduled_start)) / 60000)),
    })
    .eq('id', id)
    .eq('status', 'agendada') // não mexe em atividade que o técnico já iniciou
    .select()
    .maybeSingle();
  if (error) throw new Error(traduzirErro(error.message));
  if (!data) throw new Error('Esta atividade já foi iniciada ou alterada por outra pessoa. Atualize a tela.');
  return data as Task;
}
