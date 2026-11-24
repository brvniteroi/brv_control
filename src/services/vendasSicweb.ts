import { supabase } from './supabase';

// Histórico de vendas do SicWeb (tabelas sicweb_*; só o admin lê: a RLS devolve vazio para os demais).
// Não traz o lucro: a tela não mostra.

export interface VendaSicweb {
  controle: number;
  data: string;
  hora: string | null;
  tipo: number | null;
  tipo_nome: string | null;
  nota: number | null;
  pedido: number | null;
  observacoes: string | null;
  frete: number;
  total: number;
  total_tabela: number;
  pago: number;
  cancelada: boolean;
  /** Endereço do cliente onde a venda foi feita (só nos clientes com mais de um endereço). */
  address_id: string | null;
}

export interface ItemVendaSicweb {
  controle: number;
  produto_codigo: number | null;
  produto_nome: string | null;
  quantidade: number;
  total: number;
  total_tabela: number;
}

export interface PagamentoVendaSicweb {
  controle: number;
  forma: string | null;
  valor: number;
  troco: number;
}

export interface VendasDoCliente {
  vendas: VendaSicweb[];
  /** Total de vendas do cliente (pode ser maior que a lista, que traz só as mais recentes). */
  quantidade: number;
}

/** Quantas vendas a lista traz (as mais recentes). Cliente comum tem poucas; só o "Cliente Balcão" passa disso. */
export const LIMITE_VENDAS_CLIENTE = 300;

const COLUNAS = 'controle, data, hora, tipo, tipo_nome, nota, pedido, observacoes, frete, total, total_tabela, pago, cancelada, address_id';

export async function listarVendasDoCliente(clienteId: string): Promise<VendasDoCliente> {
  const { data, error, count } = await supabase
    .from('sicweb_vendas')
    .select(COLUNAS, { count: 'exact' })
    .eq('customer_id', clienteId)
    .order('data', { ascending: false })
    .order('controle', { ascending: false })
    .range(0, LIMITE_VENDAS_CLIENTE - 1);
  if (error) throw error;
  const vendas = (data ?? []).map((v) => ({
    ...v,
    frete: Number(v.frete),
    total: Number(v.total),
    total_tabela: Number(v.total_tabela),
    pago: Number(v.pago),
  })) as VendaSicweb[];
  return { vendas, quantidade: count ?? vendas.length };
}

/** Endereços ativos do cliente (para mostrar em que endereço cada venda foi feita). */
export async function enderecosDoClienteVendas(clienteId: string): Promise<{ id: string; rotulo: string }[]> {
  const { data, error } = await supabase.from('customer_addresses').select('id, label, street, number, is_primary').eq('customer_id', clienteId).order('is_primary', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((a) => ({ id: a.id as string, rotulo: (a.label as string | null)?.trim() || [a.street, a.number].filter(Boolean).join(', ') }));
}

export async function detalhesDaVenda(vendaControle: number): Promise<{ itens: ItemVendaSicweb[]; pagamentos: PagamentoVendaSicweb[] }> {
  const [itens, pagamentos] = await Promise.all([
    supabase
      .from('sicweb_venda_itens')
      .select('controle, produto_codigo, produto_nome, quantidade, total, total_tabela')
      .eq('venda_controle', vendaControle)
      .order('controle'),
    supabase.from('sicweb_venda_pagamentos').select('controle, forma, valor, troco').eq('venda_controle', vendaControle).order('controle'),
  ]);
  if (itens.error) throw itens.error;
  if (pagamentos.error) throw pagamentos.error;
  return {
    itens: (itens.data ?? []).map((i) => ({ ...i, quantidade: Number(i.quantidade), total: Number(i.total), total_tabela: Number(i.total_tabela) })) as ItemVendaSicweb[],
    pagamentos: (pagamentos.data ?? []).map((p) => ({ ...p, valor: Number(p.valor), troco: Number(p.troco) })) as PagamentoVendaSicweb[],
  };
}
