// Catálogo, orçamentos e vendas no Supabase (ligação das telas de vendas, 2026-11-25).
// As telas chamam `components/vendas/fonteDeDados.ts`, que repassa para cá com `USAR_BANCO_ORCAMENTOS = true`.
// Regras e permissões ficam no banco (migration 20261125100000_catalogo_orcamentos.sql): o orçamento só se grava pelas
// funções `orcamento_*`, que recalculam itens e totais; o custo do produto só aparece para o nível financeiro completo.

import { supabase } from './supabase';
import { semAcento } from './clientes';
import type { LinhaRecebimentoInput } from '../types/financeiro';
import type {
  CatalogItem,
  CatalogListFilter,
  CatalogListResult,
  PublicQuoteView,
  Quote,
  QuoteEvent,
  QuoteListFilter,
  QuoteListResult,
  QuoteResponseChannel,
  QuoteStandardText,
  SaveCatalogItemInput,
  CreateSaleInput,
  Sale,
  SaleDocumentModel,
  SaleListFilter,
  SaleListResult,
  SaveQuoteInput,
  SellerOption,
} from '../types/vendas';
import { ITENS_VENDAS_POR_PAGINA } from '../components/vendas/regrasVendas';

function traduzirErro(mensagem: string): string {
  if (mensagem.includes('catalog_items_code_key')) return 'Já existe um item no catálogo com este código.';
  if (mensagem.includes('catalog_items_ncm_check')) return 'O NCM precisa ter 8 dígitos.';
  if (mensagem.includes('catalog_items_cfop_check')) return 'O CFOP precisa ter 4 dígitos.';
  if (mensagem.includes('catalog_items_csosn_check')) return 'O CSOSN precisa ter 3 dígitos.';
  if (mensagem.includes('row-level security') || mensagem.includes('permission denied')) {
    return 'Você não tem permissão para esta ação.';
  }
  return mensagem;
}

function falhou(error: { message: string } | null): void {
  if (error) throw new Error(traduzirErro(error.message));
}

// ============================================================================
// Catálogo
// ============================================================================

type LinhaCatalogo = Omit<CatalogItem, 'cost_price_cents' | 'stock_quantity' | 'min_stock_quantity' | 'iss_rate'> & {
  stock_quantity: number | string;
  min_stock_quantity: number | string;
  iss_rate: number | string | null;
};

/** Custos (a tabela só devolve linhas para o nível financeiro completo; para os demais, vem vazia). */
async function custosDe(ids: string[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  if (ids.length === 0) return mapa;
  const { data } = await supabase.from('catalog_item_costs').select('catalog_item_id, cost_price_cents').in('catalog_item_id', ids);
  for (const c of data ?? []) mapa.set(c.catalog_item_id as string, Number(c.cost_price_cents));
  return mapa;
}

function paraItem(l: LinhaCatalogo, custos: Map<string, number>): CatalogItem {
  return {
    ...l,
    sale_price_cents: Number(l.sale_price_cents),
    stock_quantity: Number(l.stock_quantity),
    min_stock_quantity: Number(l.min_stock_quantity),
    iss_rate: l.iss_rate == null ? null : Number(l.iss_rate),
    cost_price_cents: custos.get(l.id) ?? null,
    has_usage: Boolean((l as { has_usage?: boolean }).has_usage),
  };
}

async function comCustos(linhas: LinhaCatalogo[]): Promise<CatalogItem[]> {
  const custos = await custosDe(linhas.map((l) => l.id));
  return linhas.map((l) => paraItem(l, custos));
}

/** Termo de busca no formato da coluna `busca` (minúsculas, sem acento), escapando os curingas do LIKE. */
function termoBusca(texto: string): string {
  return semAcento(texto.trim()).replace(/[%_\\]/g, (c) => `\\${c}`);
}

export async function listarCatalogo(filtro: CatalogListFilter = {}): Promise<CatalogListResult> {
  const aba = filtro.aba ?? 'todos';
  const termo = termoBusca(filtro.busca ?? '');
  const categoria = (filtro.categoria ?? '').trim();
  const pagina = Math.max(0, filtro.pagina ?? 0);

  let q = supabase.from('catalogo_itens').select('*', { count: 'exact' });
  if (aba === 'inativos') q = q.eq('active', false);
  else {
    q = q.eq('active', true);
    if (aba === 'produtos') q = q.eq('kind', 'produto');
    if (aba === 'servicos') q = q.eq('kind', 'servico');
  }
  if (categoria) q = q.eq('category', categoria);
  if (termo) q = q.like('busca', `%${termo}%`);
  q = q.order('name').range(pagina * ITENS_VENDAS_POR_PAGINA, (pagina + 1) * ITENS_VENDAS_POR_PAGINA - 1);

  const contar = () => supabase.from('catalog_items').select('id', { count: 'exact', head: true });

  const [lista, todos, produtos, servicos, inativos, sugestoes, categorias] = await Promise.all([
    q,
    contar().eq('active', true),
    contar().eq('active', true).eq('kind', 'produto'),
    contar().eq('active', true).eq('kind', 'servico'),
    contar().eq('active', false),
    supabase.from('catalogo_itens').select('id', { count: 'exact', head: true }).eq('sugere_servico', true),
    supabase.from('catalog_items').select('category').not('category', 'is', null).limit(5000),
  ]);
  falhou(lista.error);

  const nomesCategorias = [
    ...new Set((categorias.data ?? []).map((c) => String(c.category).trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  return {
    itens: await comCustos((lista.data ?? []) as LinhaCatalogo[]),
    total: lista.count ?? 0,
    categorias: nomesCategorias,
    contagens: {
      todos: todos.count ?? 0,
      produtos: produtos.count ?? 0,
      servicos: servicos.count ?? 0,
      inativos: inativos.count ?? 0,
      sugestoes_revisao: sugestoes.count ?? 0,
    },
  };
}

export async function buscarItemCatalogo(id: string): Promise<CatalogItem | null> {
  const { data, error } = await supabase.from('catalogo_itens').select('*').eq('id', id).maybeSingle();
  falhou(error);
  if (!data) return null;
  return (await comCustos([data as LinhaCatalogo]))[0];
}

/** Busca do orçamento e da venda: código ou código de barras exato primeiro, depois o resto pelo nome. */
export async function buscarItensParaBusca(texto: string): Promise<CatalogItem[]> {
  const bruto = texto.trim();
  if (!bruto) {
    const { data, error } = await supabase
      .from('catalog_items')
      .select('*')
      .eq('active', true)
      .order('is_frequent', { ascending: false })
      .order('name')
      .limit(15);
    falhou(error);
    return comCustos((data ?? []) as LinhaCatalogo[]);
  }
  const termo = termoBusca(bruto);
  // Valor entre aspas no filtro "or" (aceita ponto, vírgula e parênteses); curingas do LIKE escapados
  const exato = bruto.replace(/["\\]/g, '').replace(/[%_]/g, (c) => `\\${c}`);
  const [exatos, parciais] = await Promise.all([
    supabase
      .from('catalog_items')
      .select('*')
      .eq('active', true)
      .or(`code.ilike."${exato}",barcode.eq."${bruto.replace(/["\\]/g, '')}"`)
      .limit(5),
    supabase.from('catalog_items').select('*').eq('active', true).like('busca', `%${termo}%`).order('name').limit(20),
  ]);
  falhou(parciais.error);
  const vistos = new Set<string>();
  const juntos: LinhaCatalogo[] = [];
  for (const l of [...((exatos.data ?? []) as LinhaCatalogo[]), ...((parciais.data ?? []) as LinhaCatalogo[])]) {
    if (vistos.has(l.id)) continue;
    vistos.add(l.id);
    juntos.push(l);
  }
  return comCustos(juntos.slice(0, 20));
}

export async function listarItensFrequentes(): Promise<CatalogItem[]> {
  const { data, error } = await supabase.from('catalog_items').select('*').eq('active', true).eq('is_frequent', true).order('name');
  falhou(error);
  return comCustos((data ?? []) as LinhaCatalogo[]);
}

async function nivelFinanceiroAtual(): Promise<string> {
  const { data } = await supabase.rpc('nivel_financeiro');
  return typeof data === 'string' ? data : 'nenhum';
}

export async function salvarItemCatalogo(dados: SaveCatalogItemInput): Promise<CatalogItem> {
  const codigo = dados.code.trim();
  const nome = dados.name.trim();
  if (!codigo) throw new Error('Informe o código do item.');
  if (!nome) throw new Error('Informe o nome do produto ou serviço.');
  if (dados.sale_price_cents < 0) throw new Error('O preço de venda não pode ser negativo.');

  const produto = dados.kind === 'produto';
  const unidade = dados.unit.trim() || (produto ? 'UN' : 'SRV');
  const campos = {
    code: codigo,
    barcode: dados.barcode?.trim() || null,
    name: nome,
    kind: dados.kind,
    unit: unidade,
    category: dados.category?.trim() || null,
    ...(dados.manufacturer !== undefined ? { manufacturer: dados.manufacturer?.trim() || null } : {}),
    ...(dados.notes !== undefined ? { notes: dados.notes?.trim() || null } : {}),
    sale_price_cents: Math.round(dados.sale_price_cents),
    controls_stock: produto ? Boolean(dados.controls_stock) : false,
    ...(dados.stock_quantity !== undefined ? { stock_quantity: produto ? Number(dados.stock_quantity) : 0 } : {}),
    ...(dados.min_stock_quantity !== undefined ? { min_stock_quantity: produto ? Number(dados.min_stock_quantity) : 0 } : {}),
    ...(dados.active !== undefined ? { active: dados.active } : {}),
    ...(dados.is_frequent !== undefined ? { is_frequent: dados.is_frequent } : {}),
    type_reviewed: true,
    ncm: produto ? dados.ncm?.replace(/\D/g, '') || null : null,
    // Campo fiscal em branco fica em branco (nada de preencher o que o contador não confirmou)
    cfop: produto ? dados.cfop?.replace(/\D/g, '') || null : null,
    csosn: produto ? dados.csosn?.replace(/\D/g, '') || null : null,
    origin: dados.origin ?? 0,
    taxable_unit: dados.taxable_unit?.trim() || unidade,
    service_code: produto ? null : dados.service_code?.trim() || null,
    iss_rate: produto ? null : (dados.iss_rate ?? null),
    invoice_description: produto ? null : dados.invoice_description?.trim() || null,
  };

  let id = dados.id;
  if (id) {
    const { error } = await supabase.from('catalog_items').update(campos).eq('id', id);
    falhou(error);
  } else {
    const { data, error } = await supabase.from('catalog_items').insert(campos).select('id').single();
    falhou(error);
    if (!data) throw new Error('Não foi possível cadastrar o item.');
    id = data.id as string;
  }

  // Custo: só quem tem o financeiro completo grava (a tela só mostra o campo para ele)
  if (dados.cost_price_cents !== undefined && (await nivelFinanceiroAtual()) === 'completo') {
    if (dados.cost_price_cents === null) {
      const { error } = await supabase.from('catalog_item_costs').delete().eq('catalog_item_id', id);
      falhou(error);
    } else {
      const { error } = await supabase
        .from('catalog_item_costs')
        .upsert({ catalog_item_id: id, cost_price_cents: Math.round(dados.cost_price_cents) });
      falhou(error);
    }
  }

  const salvo = await buscarItemCatalogo(id);
  if (!salvo) throw new Error('Item do catálogo não encontrado depois de salvar.');
  return salvo;
}

/** Alterna ativo/inativo (item do catálogo nunca se exclui). */
export async function inativarItemCatalogo(id: string): Promise<CatalogItem> {
  const atual = await buscarItemCatalogo(id);
  if (!atual) throw new Error('Item não encontrado.');
  const { error } = await supabase.from('catalog_items').update({ active: !atual.active }).eq('id', id);
  falhou(error);
  return { ...atual, active: !atual.active };
}

export async function listarSugestoesDeServico(): Promise<CatalogItem[]> {
  const { data, error } = await supabase.from('catalogo_itens').select('*').eq('sugere_servico', true).order('name').limit(500);
  falhou(error);
  return comCustos((data ?? []) as LinhaCatalogo[]);
}

export async function marcarComoServico(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  // Unidade "UN" vira "SRV". Código de serviço e ISS ficam em branco até o contador confirmar.
  const unidade = await supabase.from('catalog_items').update({ unit: 'SRV' }).in('id', ids).eq('unit', 'UN');
  falhou(unidade.error);
  const { data, error } = await supabase
    .from('catalog_items')
    .update({ kind: 'servico', controls_stock: false, stock_quantity: 0, type_reviewed: true, ncm: null, cfop: null, csosn: null })
    .in('id', ids)
    .select('id');
  falhou(error);
  return data?.length ?? 0;
}

// ============================================================================
// Orçamentos
// ============================================================================

/** O banco devolve números (quantidade, desconto) como number no JSON; garante o tipo. */
function paraOrcamento(json: unknown): Quote {
  const q = json as Quote;
  return {
    ...q,
    items: (q.items ?? []).map((i) => ({
      ...i,
      quantity: Number(i.quantity),
      discount_input: Number(i.discount_input),
      unit_price_cents: Number(i.unit_price_cents),
      discount_cents: Number(i.discount_cents),
      total_cents: Number(i.total_cents),
    })),
  };
}

export async function listarOrcamentos(filtro: QuoteListFilter = {}): Promise<QuoteListResult> {
  const { data, error } = await supabase.rpc('orcamentos_listar', {
    p: {
      busca: filtro.busca ?? '',
      situacao: filtro.situacao ?? 'todos',
      vendedor_id: filtro.vendedorId ?? '',
      data_inicio: filtro.dataInicio ?? '',
      data_fim: filtro.dataFim ?? '',
      composicao: filtro.composicao ?? 'todos',
      pagina: filtro.pagina ?? 0,
      por_pagina: ITENS_VENDAS_POR_PAGINA,
    },
  });
  falhou(error);
  const r = data as { itens: unknown[]; total: number; soma_total_cents: number; contagens: QuoteListResult['contagens'] };
  return {
    itens: (r.itens ?? []).map(paraOrcamento),
    total: Number(r.total),
    soma_total_cents: Number(r.soma_total_cents),
    contagens: r.contagens,
  };
}

export async function buscarOrcamento(id: string): Promise<Quote | null> {
  const { data, error } = await supabase.rpc('orcamento_buscar', { p_id: id });
  falhou(error);
  return data ? paraOrcamento(data) : null;
}

async function buscarOuFalhar(id: string): Promise<Quote> {
  const q = await buscarOrcamento(id);
  if (!q) throw new Error('Orçamento não encontrado.');
  return q;
}

export async function salvarOrcamento(dados: SaveQuoteInput): Promise<Quote> {
  if (dados.items.length === 0) throw new Error('Adicione ao menos um produto ou serviço ao orçamento.');
  const { data, error } = await supabase.rpc('orcamento_salvar', { p: dados });
  falhou(error);
  return buscarOuFalhar(data as string);
}

export async function duplicarOrcamento(id: string): Promise<Quote> {
  const { data, error } = await supabase.rpc('orcamento_duplicar', { p_id: id });
  falhou(error);
  return buscarOuFalhar(data as string);
}

export async function excluirOrcamento(id: string): Promise<void> {
  const { error } = await supabase.rpc('orcamento_excluir', { p_id: id });
  falhou(error);
}

export async function reabrirOrcamento(id: string): Promise<Quote> {
  const { error } = await supabase.rpc('orcamento_reabrir', { p_id: id });
  falhou(error);
  return buscarOuFalhar(id);
}

export async function registrarEnvioOrcamento(id: string): Promise<Quote> {
  const { error } = await supabase.rpc('orcamento_registrar_envio', { p_id: id });
  falhou(error);
  return buscarOuFalhar(id);
}

export async function registrarRespostaOrcamento(
  id: string,
  dados: { decisao: 'aprovado' | 'recusado'; canal: QuoteResponseChannel; observacao?: string },
): Promise<Quote> {
  const { error } = await supabase.rpc('orcamento_registrar_resposta', {
    p_id: id,
    p_decisao: dados.decisao,
    p_canal: dados.canal,
    p_observacao: dados.observacao ?? null,
  });
  falhou(error);
  return buscarOuFalhar(id);
}

export async function gerarNovoLinkOrcamento(id: string): Promise<Quote> {
  const { error } = await supabase.rpc('orcamento_novo_link', { p_id: id });
  falhou(error);
  return buscarOuFalhar(id);
}

export async function historicoDoOrcamento(id: string): Promise<QuoteEvent[]> {
  const { data, error } = await supabase
    .from('quote_events')
    .select('id, quote_id, event_type, actor_name, note, created_at')
    .eq('quote_id', id)
    .order('created_at', { ascending: false });
  falhou(error);
  return (data ?? []) as QuoteEvent[];
}

export async function anotarNoHistoricoOrcamento(id: string, nota: string): Promise<QuoteEvent> {
  if (!nota.trim()) throw new Error('Digite uma anotação.');
  const { data, error } = await supabase.rpc('orcamento_anotar', { p_id: id, p_nota: nota.trim() });
  falhou(error);
  const { data: ev, error: e2 } = await supabase
    .from('quote_events')
    .select('id, quote_id, event_type, actor_name, note, created_at')
    .eq('id', data as string)
    .single();
  falhou(e2);
  return ev as QuoteEvent;
}

export async function listarTextosPadraoOrcamento(): Promise<QuoteStandardText[]> {
  const { data, error } = await supabase
    .from('quote_texts')
    .select('id, title, content, sort_order, active')
    .eq('active', true)
    .order('sort_order')
    .order('title');
  falhou(error);
  return (data ?? []) as QuoteStandardText[];
}

export async function salvarTextoPadraoOrcamento(dados: { id?: string; title: string; content: string }): Promise<QuoteStandardText> {
  const title = dados.title.trim();
  const content = dados.content.trim();
  if (!title) throw new Error('Informe um título curto para a observação padrão.');
  if (!content) throw new Error('Informe o texto da observação padrão.');
  const colunas = 'id, title, content, sort_order, active';
  if (dados.id) {
    const { data, error } = await supabase.from('quote_texts').update({ title, content }).eq('id', dados.id).select(colunas).single();
    falhou(error);
    return data as QuoteStandardText;
  }
  const { data: ultimo } = await supabase.from('quote_texts').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const ordem = Number(ultimo?.[0]?.sort_order ?? 0) + 1;
  const { data, error } = await supabase.from('quote_texts').insert({ title, content, sort_order: ordem }).select(colunas).single();
  falhou(error);
  return data as QuoteStandardText;
}

export async function excluirTextoPadraoOrcamento(id: string): Promise<void> {
  const { error } = await supabase.from('quote_texts').delete().eq('id', id);
  falhou(error);
}

export async function buscarOrcamentoPublico(token: string): Promise<PublicQuoteView | null> {
  const limpo = token.trim();
  if (!limpo) return null;
  const { data, error } = await supabase.rpc('orcamento_publico_ver', { p_token: limpo });
  falhou(error);
  return data ? (paraOrcamento(data) as unknown as PublicQuoteView) : null;
}

export async function aprovarOrcamentoPublico(token: string, nome: string): Promise<PublicQuoteView> {
  if (nome.trim().length < 3) throw new Error('Informe seu nome completo para aprovar o orçamento.');
  const { data, error } = await supabase.rpc('orcamento_publico_aprovar', { p_token: token.trim(), p_nome: nome.trim() });
  falhou(error);
  return paraOrcamento(data) as unknown as PublicQuoteView;
}

export async function gerarOsDoOrcamento(
  id: string,
): Promise<{ quote: Quote; service_order_id: string; service_order_number: number; descricaoServicos: string }> {
  const { data, error } = await supabase.rpc('orcamento_gerar_os', { p_id: id });
  falhou(error);
  const r = data as { service_order_id: string; service_order_number: number; descricao: string };
  return {
    quote: await buscarOuFalhar(id),
    service_order_id: r.service_order_id,
    service_order_number: Number(r.service_order_number),
    descricaoServicos: r.descricao,
  };
}

/** Funcionários ativos; quem está logado vem primeiro (é o vendedor sugerido no orçamento novo). */
/** Só os vendedores cadastrados; quem está logado vem primeiro (migration 20261125120000). */
export async function listarVendedores(): Promise<SellerOption[]> {
  const { data, error } = await supabase.rpc('vendas_vendedores');
  falhou(error);
  return (data ?? []) as SellerOption[];
}

/** Itens do catálogo pelos ids (modelos de orçamento). */
export async function buscarItensPorIds(ids: string[]): Promise<CatalogItem[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('catalog_items').select('*').in('id', ids);
  falhou(error);
  return comCustos((data ?? []) as LinhaCatalogo[]);
}

// ============================================================================
// Vendas (migration 20261125110000_vendas_financeiro_base.sql). A venda só se grava pelas funções venda_*:
// o banco recalcula itens, desconto, totais, troco, taxa do cartão e lança os movimentos financeiros.
// ============================================================================


/** Quantidade, desconto e percentual da taxa vêm como número no JSON; garante o tipo. */
function paraVenda(json: unknown): Sale {
  const v = json as Sale;
  return {
    ...v,
    items: (v.items ?? []).map((i) => ({ ...i, quantity: Number(i.quantity), discount_input: Number(i.discount_input) })),
    payments: (v.payments ?? []).map((p) => ({
      ...p,
      estimated_fee_percent: p.estimated_fee_percent == null ? null : Number(p.estimated_fee_percent),
    })),
    documents: v.documents ?? [],
    events: v.events ?? [],
  };
}

export async function listarVendas(filtro: SaleListFilter = {}): Promise<SaleListResult> {
  const { data, error } = await supabase.rpc('vendas_listar', {
    p: {
      busca: filtro.busca ?? '',
      chip: filtro.chip ?? 'todas',
      situacao: filtro.situacao ?? 'todas',
      forma: filtro.formaPagamento ?? 'todas',
      origem: filtro.origem ?? 'todas',
      status_nota: filtro.statusNota ?? 'todas',
      data_inicio: filtro.dataInicio ?? '',
      data_fim: filtro.dataFim ?? '',
      pagina: filtro.pagina ?? 0,
      por_pagina: ITENS_VENDAS_POR_PAGINA,
    },
  });
  falhou(error);
  const res = data as SaleListResult;
  return { ...res, itens: (res.itens ?? []).map(paraVenda) };
}

export async function buscarVenda(id: string): Promise<Sale | null> {
  const { data, error } = await supabase.rpc('venda_buscar', { p_id: id });
  falhou(error);
  return data ? paraVenda(data) : null;
}

async function vendaOuFalhar(id: string): Promise<Sale> {
  const venda = await buscarVenda(id);
  if (!venda) throw new Error('Venda não encontrada.');
  return venda;
}

export async function concluirVenda(dados: CreateSaleInput): Promise<Sale> {
  const { data, error } = await supabase.rpc('venda_concluir', { p: dados });
  falhou(error);
  return vendaOuFalhar(data as string);
}

/** `data` (AAAA-MM-DD) só quando o recebimento é de um dia anterior; sem ela, vale agora. */
export async function receberSaldoVenda(id: string, pagamentos: LinhaRecebimentoInput[], data?: string | null): Promise<Sale> {
  const { error } = await supabase.rpc('venda_receber', { p_id: id, p_pagamentos: pagamentos, p_data: data || null });
  falhou(error);
  return vendaOuFalhar(id);
}

export async function cancelarVenda(id: string, motivo: string): Promise<Sale> {
  const { error } = await supabase.rpc('venda_cancelar', { p_id: id, p_motivo: motivo.trim() });
  falhou(error);
  return vendaOuFalhar(id);
}

export async function registrarNotaManual(id: string, modelo: SaleDocumentModel, numero: string): Promise<Sale> {
  const { error } = await supabase.rpc('venda_registrar_nota', { p_id: id, p_modelo: modelo, p_numero: numero.trim() });
  falhou(error);
  return vendaOuFalhar(id);
}

export async function cancelarNotaVenda(notaId: string, motivo: string): Promise<Sale> {
  const { data, error } = await supabase.rpc('venda_cancelar_nota', { p_nota: notaId, p_motivo: motivo.trim() });
  falhou(error);
  return vendaOuFalhar(data as string);
}
