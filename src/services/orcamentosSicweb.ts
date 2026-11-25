import { supabase } from './supabase';

// Orçamentos antigos do SicWeb, só consulta (tabelas sicweb_orcamento*, migrations 20261125160000 e 20261125170000;
// só quem vende lê: a RLS devolve vazio para os demais).

export interface OrcamentoSicweb {
  controle: number;
  data: string;
  customer_id: string | null;
  /** 'nome' = o SicWeb não tinha cliente; foi ligado por haver um único cliente com o mesmo nome. */
  ligado_por: 'codigo' | 'nome' | null;
  cliente_nome: string | null;
  contato: string | null;
  observacoes: string | null;
  total: number;
}

export interface ItemOrcamentoSicweb {
  controle: number;
  produto_nome: string | null;
  quantidade: number;
  valor_unitario: number;
  total: number;
}

export const ORCAMENTOS_SICWEB_POR_PAGINA = 50;

const semAcento = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Do mais recente para o mais antigo; `clienteId` restringe ao cliente; a busca olha número, nome e contato. */
export async function listarOrcamentosSicweb(filtro: {
  clienteId?: string;
  busca?: string;
  pagina?: number;
}): Promise<{ orcamentos: OrcamentoSicweb[]; quantidade: number }> {
  const inicio = (filtro.pagina ?? 0) * ORCAMENTOS_SICWEB_POR_PAGINA;
  let consulta = supabase
    .from('sicweb_orcamentos')
    .select('controle, data, customer_id, ligado_por, cliente_nome, contato, observacoes, total', { count: 'exact' });
  if (filtro.clienteId) consulta = consulta.eq('customer_id', filtro.clienteId);
  // Cada palavra precisa aparecer, em qualquer ordem
  for (const palavra of semAcento(filtro.busca ?? '').split(/\s+/).filter(Boolean)) {
    consulta = consulta.like('busca', `%${palavra.replace(/[\\%_]/g, '\\$&')}%`);
  }
  const { data, error, count } = await consulta
    .order('data', { ascending: false })
    .order('controle', { ascending: false })
    .range(inicio, inicio + ORCAMENTOS_SICWEB_POR_PAGINA - 1);
  if (error) throw error;
  const orcamentos = (data ?? []).map((o) => ({ ...o, total: Number(o.total) })) as OrcamentoSicweb[];
  return { orcamentos, quantidade: count ?? orcamentos.length };
}

export async function itensDoOrcamentoSicweb(controle: number): Promise<ItemOrcamentoSicweb[]> {
  const { data, error } = await supabase
    .from('sicweb_orcamento_itens')
    .select('controle, produto_nome, quantidade, valor_unitario, total')
    .eq('orcamento_controle', controle)
    .order('controle');
  if (error) throw error;
  return (data ?? []).map((i) => ({
    ...i,
    quantidade: Number(i.quantidade),
    valor_unitario: Number(i.valor_unitario),
    total: Number(i.total),
  })) as ItemOrcamentoSicweb[];
}
