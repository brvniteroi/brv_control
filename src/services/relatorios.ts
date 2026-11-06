// Dados dos relatórios (só leitura; a RLS já restringe ao escritório).
import { supabase } from './supabase';

/** O Supabase devolve no máximo 1000 linhas por consulta. */
const TAMANHO_PAGINA = 1000;

async function todasAsPaginas<T>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const { data, error } = await consulta(de, de + TAMANHO_PAGINA - 1);
    if (error) throw new Error(error.message);
    const pagina = (data ?? []) as T[];
    linhas.push(...pagina);
    if (pagina.length < TAMANHO_PAGINA) return linhas;
  }
}

export interface AtividadeRealizada {
  employee_id: string | null;
  finished_at: string | null;
  scheduled_start: string | null;
}

export interface AvaliacaoRecebida {
  employee_id: string | null;
  stars: number;
}

/**
 * Atividades concluídas no intervalo [inicio, fim) (ISO). A data é o término real; na importada
 * sem término, vale o início agendado. Concluída sem nenhuma das duas datas não entra.
 */
export function listarAtividadesRealizadas(inicio: string, fim: string): Promise<AtividadeRealizada[]> {
  return todasAsPaginas<AtividadeRealizada>((de, ate) =>
    supabase
      .from('tasks')
      .select('employee_id, finished_at, scheduled_start')
      .eq('status', 'concluida')
      .or(realizadaNoPeriodo(inicio, fim))
      .order('id')
      .range(de, ate),
  );
}

function realizadaNoPeriodo(inicio: string, fim: string): string {
  return (
    `and(finished_at.gte."${inicio}",finished_at.lt."${fim}"),` +
    `and(finished_at.is.null,scheduled_start.gte."${inicio}",scheduled_start.lt."${fim}")`
  );
}

/** Tipo de serviço de uma atividade ou avaliação, vindo da OS (null = OS sem tipo). */
export interface ComTipoServico {
  service_order: { service_type: { id: string; name: string } | null } | null;
}

const CAMPOS_TIPO = 'service_order:service_orders(service_type:service_types(id, name))';

/** Mesmo critério de `listarAtividadesRealizadas`, com o tipo de serviço da OS. */
export function listarRealizadasComTipo(inicio: string, fim: string): Promise<(ComTipoServico & { employee_id: string | null })[]> {
  return todasAsPaginas<ComTipoServico & { employee_id: string | null }>((de, ate) =>
    supabase
      .from('tasks')
      .select(`employee_id, ${CAMPOS_TIPO}`)
      .eq('status', 'concluida')
      .or(realizadaNoPeriodo(inicio, fim))
      .order('id')
      .range(de, ate),
  );
}

/** Avaliações dadas no intervalo [inicio, fim), com o tipo de serviço da OS avaliada. */
export function listarAvaliacoesComTipo(inicio: string, fim: string): Promise<(ComTipoServico & { stars: number })[]> {
  return todasAsPaginas<ComTipoServico & { stars: number }>((de, ate) =>
    supabase
      .from('ratings')
      .select(`stars, ${CAMPOS_TIPO}`)
      .gte('created_at', inicio)
      .lt('created_at', fim)
      .order('id')
      .range(de, ate),
  );
}

/** Avaliações dadas pelos clientes no intervalo [inicio, fim) (ISO). */
export function listarAvaliacoesRecebidas(inicio: string, fim: string): Promise<AvaliacaoRecebida[]> {
  return todasAsPaginas<AvaliacaoRecebida>((de, ate) =>
    supabase
      .from('ratings')
      .select('employee_id, stars')
      .gte('created_at', inicio)
      .lt('created_at', fim)
      .order('id')
      .range(de, ate),
  );
}
