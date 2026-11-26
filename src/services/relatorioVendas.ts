import { supabase } from './supabase';

// Relatório de vendas (SicWeb até a virada + BRV Control a partir dela) e busca no histórico do SicWeb.
// Só admin (as funções recusam os demais). Migration 20261126100000_relatorio_vendas.sql. Não traz lucro.

export interface MesVendas {
  ano: number;
  mes: number;
  vendas: number;
  vendas_com_valor: number;
  total: number;
  /** Os mesmos números só até o dia e mês do último dia com venda (comparação justa entre anos). */
  vendas_ate_dia: number;
  vendas_com_valor_ate_dia: number;
  total_ate_dia: number;
}

export interface RelatorioMensal {
  ultimo_dia: string;
  virada: string;
  meses: MesVendas[];
}

export interface ItemRanking {
  nome: string;
  quantidade: number;
  total: number;
}

export interface DetalheVendas {
  tipos: { tipo: 'produto' | 'servico' | 'sem_classificacao'; total: number }[];
  produtos: ItemRanking[];
  servicos: ItemRanking[];
  clientes: { id: string; nome: string; vendas: number; total: number }[];
  balcao: { vendas: number; total: number };
}

export interface VendaAchada {
  controle: number;
  data: string;
  total: number;
  frete: number;
  cancelada: boolean;
  tipo_nome: string | null;
  observacoes: string | null;
  customer_id: string | null;
  cliente: string | null;
}

export interface BuscaVendas {
  quantidade: number;
  canceladas: number;
  /** Soma sem as canceladas, de todas as encontradas (não só da página). */
  total: number;
  vendas: VendaAchada[];
}

export const VENDAS_SICWEB_POR_PAGINA = 50;

export async function relatorioMensal(): Promise<RelatorioMensal> {
  const { data, error } = await supabase.rpc('relatorio_vendas_mensal');
  if (error) throw error;
  return data as RelatorioMensal;
}

export async function detalheVendas(inicio: string, fim: string): Promise<DetalheVendas> {
  const { data, error } = await supabase.rpc('relatorio_vendas_detalhe', { p_inicio: inicio, p_fim: fim });
  if (error) throw error;
  return data as DetalheVendas;
}

export async function buscarVendasSicweb(filtro: { busca: string; inicio: string; fim: string; pagina: number }): Promise<BuscaVendas> {
  const { data, error } = await supabase.rpc('sicweb_vendas_buscar', {
    p_busca: filtro.busca,
    p_inicio: filtro.inicio || null,
    p_fim: filtro.fim || null,
    p_pagina: filtro.pagina,
  });
  if (error) throw error;
  return data as BuscaVendas;
}

export interface ProdutoVendido {
  nome: string;
  unidade: string | null;
  categoria: string | null;
  fabricante: string | null;
  codigo: string | null;
  quantidade: number;
  total: number;
  /** Em quantas vendas apareceu no período. */
  vendas: number;
  /** Quantidade no mesmo período um ano antes. */
  quantidade_anterior: number;
  /** Última venda entre o período e o do ano anterior. */
  ultima_venda: string;
}

export interface RelatorioProdutos {
  ultimo_dia: string;
  anterior_inicio: string;
  anterior_fim: string;
  sem_classificacao: { quantidade: number; total: number };
  produtos: ProdutoVendido[];
}

export async function produtosVendidos(inicio: string, fim: string): Promise<RelatorioProdutos> {
  const { data, error } = await supabase.rpc('relatorio_produtos_vendidos', { p_inicio: inicio, p_fim: fim });
  if (error) throw error;
  return data as RelatorioProdutos;
}

export async function ultimoDiaComVenda(): Promise<string> {
  return (await relatorioMensal()).ultimo_dia;
}
