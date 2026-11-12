import { supabase } from './supabase';
import type { ServiceOrderPriority, ServiceOrderStatus, TaskStatus } from '../types/fsm';

const STATUS_ABERTOS: ServiceOrderStatus[] = ['agendada', 'em_andamento'];

export interface ResumoOrdens {
  /** Quantidade de OS por status (todos os status, zerados quando não há). */
  porStatus: Record<ServiceOrderStatus, number>;
  /** OS ainda abertas com prazo (`due_date`) anterior a hoje. */
  atrasadas: number;
  /** OS abertas com prioridade alta ou urgente. */
  urgentes: number;
  /** OS concluídas nos últimos 30 dias. */
  concluidas30dias: number;
  /** Das OS em andamento, quantas são de balcão (equipamento trazido à oficina, sem visita de campo). */
  balcaoEmAndamento: number;
}

export interface AtividadeDoDia {
  id: string;
  title: string;
  status: TaskStatus;
  scheduled_start: string;
  scheduled_end: string;
  employee: { id: string; name: string } | null;
  service_order: {
    id: string;
    number: number;
    customer: { id: string; name: string } | null;
    /** Avaliação do cliente (uma por OS; as do Field podem ser várias). */
    avaliacoes: { stars: number; comment: string | null; origem: 'email' | 'whatsapp' | null }[];
    /** Pedidos de avaliação (e-mail automático e WhatsApp), para mostrar "aguardando". */
    pedidos: { channel: 'email' | 'whatsapp'; status: 'pendente' | 'enviado' | 'falhou' | 'pulado'; created_at: string }[];
  } | null;
}

export interface OrdemDestaque {
  id: string;
  number: number;
  status: ServiceOrderStatus;
  priority: ServiceOrderPriority;
  due_date: string | null;
  customer: { id: string; name: string } | null;
}

export interface DadosDashboard {
  resumo: ResumoOrdens;
  atividadesHoje: AtividadeDoDia[];
  /** Até 10 OS abertas atrasadas ou urgentes, as mais antigas primeiro. */
  precisamAtencao: OrdemDestaque[];
}

function dataLocalISO(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

async function contar(
  filtrar: (q: ReturnType<typeof base>) => ReturnType<typeof base>,
): Promise<number> {
  const { count, error } = await filtrar(base());
  if (error) throw error;
  return count ?? 0;
}

function base() {
  return supabase.from('service_orders').select('id', { count: 'exact', head: true });
}

export async function carregarDashboard(): Promise<DadosDashboard> {
  const agora = new Date();
  const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const fimDia = new Date(inicioDia);
  fimDia.setDate(fimDia.getDate() + 1);
  const hoje = dataLocalISO(agora);
  const ha30dias = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const statusTodos: ServiceOrderStatus[] = [...STATUS_ABERTOS, 'concluida', 'cancelada'];

  const [contagens, atrasadas, urgentes, concluidas30dias, balcaoEmAndamento, atividades, destaque] = await Promise.all([
    Promise.all(statusTodos.map((s) => contar((q) => q.eq('status', s)))),
    contar((q) => q.in('status', STATUS_ABERTOS).lt('due_date', hoje)),
    contar((q) => q.in('status', STATUS_ABERTOS).in('priority', ['alta', 'urgente'])),
    contar((q) => q.eq('status', 'concluida').gte('completed_at', ha30dias)),
    // OS de balcão = tipo "Oficina (balcão)" (o mesmo nome que `oficina_entrada_balcao` procura)
    supabase
      .from('service_orders')
      .select('id, service_type:service_types!inner(name)', { count: 'exact', head: true })
      .eq('status', 'em_andamento')
      .ilike('service_type.name', 'oficina (balcão)')
      .then(({ count, error }) => {
        if (error) throw error;
        return count ?? 0;
      }),
    supabase
      .from('tasks')
      .select(
        'id, title, status, scheduled_start, scheduled_end, employee:employees(id, name), ' +
          'service_order:service_orders(id, number, customer:customers(id, name), ' +
          'avaliacoes:ratings(stars, comment, origem), pedidos:rating_requests(channel, status, created_at))',
      )
      .gte('scheduled_start', inicioDia.toISOString())
      .lt('scheduled_start', fimDia.toISOString())
      .neq('status', 'cancelada')
      .order('scheduled_start', { ascending: true }),
    supabase
      .from('service_orders')
      .select('id, number, status, priority, due_date, customer:customers(id, name)')
      .in('status', STATUS_ABERTOS)
      .or(`due_date.lt.${hoje},priority.in.(alta,urgente)`)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(10),
  ]);

  if (atividades.error) throw atividades.error;
  if (destaque.error) throw destaque.error;

  const porStatus = Object.fromEntries(
    statusTodos.map((s, i) => [s, contagens[i]]),
  ) as Record<ServiceOrderStatus, number>;

  return {
    resumo: { porStatus, atrasadas, urgentes, concluidas30dias, balcaoEmAndamento },
    atividadesHoje: (atividades.data ?? []) as unknown as AtividadeDoDia[],
    precisamAtencao: (destaque.data ?? []) as unknown as OrdemDestaque[],
  };
}
