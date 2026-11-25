// Camada de dados de demonstração do módulo de Catálogo, Orçamentos e Vendas (Rodada 1).
// Todas as funções são assíncronas e operam sobre cópias em memória clonadas de `dadosDemo.ts`.
// Quando o Claude criar as migrations e `src/services/vendas.ts`, basta trocar `FONTE_DADOS_DEMO` para `false`
// e ligar os corpos destas funções ao Supabase sem alterar as telas.

import { listarClientes } from '../../services/clientes';
import type { Customer } from '../../types/fsm';
import type { FinancialPaymentMethod } from '../../types/financeiro';
import type {
  CatalogItem,
  CatalogListFilter,
  CatalogListResult,
  CreateSaleInput,
  PublicQuoteView,
  Quote,
  QuoteDisplayStatus,
  QuoteEvent,
  QuoteListFilter,
  QuoteListResult,
  QuoteResponseChannel,
  QuoteStandardText,
  Sale,
  SaleDocument,
  SaleDocumentGroup,
  SaleDocumentModel,
  SaleListFilter,
  SaleListResult,
  SaveCatalogItemInput,
  SaveQuoteInput,
  SellerOption,
} from '../../types/vendas';
import { calcularLinhaItemCentavos, formatarReais, somarCentavos } from '../../utils/dinheiro';
import { CONTAS_FINANCEIRAS_DEMO, MAQUININHAS_DEMO } from '../financeiro/fonteDeDados';
import {
  CATALOGO_DEMO,
  CLIENTES_DEMO_VENDAS,
  EVENTOS_ORCAMENTO_DEMO,
  ORCAMENTOS_DEMO,
  TEXTOS_PADRAO_ORCAMENTO_DEMO,
  VENDAS_DEMO,
  VENDEDORES_DEMO,
} from './dadosDemo';
import {
  ITENS_VENDAS_POR_PAGINA,
  calcularTaxaMaquininha,
  dataIsoHoje,
  pareceItemDeServico,
  recalcularTotaisOrcamentoOuVenda,
  semAcento,
  situacaoOrcamento,
  situacaoVenda,
  somarDiasIso,
  sugerirModeloNotaProdutos,
} from './regrasVendas';

export const FONTE_DADOS_DEMO = true;

function clonar<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

let catalogoMemoria: CatalogItem[] = clonar([...CATALOGO_DEMO]);
let orcamentosMemoria: Quote[] = clonar([...ORCAMENTOS_DEMO]);
let eventosOrcamentoMemoria: QuoteEvent[] = clonar([...EVENTOS_ORCAMENTO_DEMO]);
let textosPadraoMemoria: QuoteStandardText[] = clonar([...TEXTOS_PADRAO_ORCAMENTO_DEMO]);
let vendasMemoria: Sale[] = clonar([...VENDAS_DEMO]);

let sequenciaOrcamento = 1704;
let sequenciaVenda = 1193;
let sequenciaOsFicticia = 17410;
let sequenciaNota = 10450;

const atraso = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ============================================================================
// 1. CATÁLOGO DE PRODUTOS E SERVIÇOS
// ============================================================================

export async function listarCatalogo(filtro: CatalogListFilter = {}): Promise<CatalogListResult> {
  await atraso(80);
  const aba = filtro.aba ?? 'todos';
  const termo = semAcento(filtro.busca ?? '');
  const catFiltro = (filtro.categoria ?? '').trim();
  const pagina = Math.max(0, filtro.pagina ?? 0);

  const contagens = {
    todos: catalogoMemoria.filter((i) => i.active).length,
    produtos: catalogoMemoria.filter((i) => i.active && i.kind === 'produto').length,
    servicos: catalogoMemoria.filter((i) => i.active && i.kind === 'servico').length,
    inativos: catalogoMemoria.filter((i) => !i.active).length,
    sugestoes_revisao: catalogoMemoria.filter(
      (i) => i.active && i.kind === 'produto' && !i.type_reviewed && pareceItemDeServico(i.name),
    ).length,
  };

  const categoriasSet = new Set<string>();
  for (const item of catalogoMemoria) {
    if (item.category?.trim()) categoriasSet.add(item.category.trim());
  }
  const categorias = [...categoriasSet].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const filtrados = catalogoMemoria.filter((item) => {
    if (aba === 'inativos') {
      if (item.active) return false;
    } else {
      if (!item.active) return false;
      if (aba === 'produtos' && item.kind !== 'produto') return false;
      if (aba === 'servicos' && item.kind !== 'servico') return false;
    }

    if (catFiltro && item.category !== catFiltro) return false;

    if (termo) {
      const alvo = semAcento(`${item.code} ${item.barcode ?? ''} ${item.name} ${item.category ?? ''}`);
      if (!alvo.includes(termo)) return false;
    }
    return true;
  });

  const ordenados = filtrados.slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const inicio = pagina * ITENS_VENDAS_POR_PAGINA;
  const paginados = ordenados.slice(inicio, inicio + ITENS_VENDAS_POR_PAGINA);

  return {
    itens: clonar(paginados),
    total: ordenados.length,
    categorias,
    contagens,
  };
}

export async function buscarItemCatalogo(id: string): Promise<CatalogItem | null> {
  await atraso(50);
  const achado = catalogoMemoria.find((i) => i.id === id) ?? null;
  return achado ? clonar(achado) : null;
}

/** Busca rápida sem acento por código, nome ou código de barras para o editor de orçamento e o PDV de venda. */
export async function buscarItensParaBusca(texto: string): Promise<CatalogItem[]> {
  await atraso(40);
  const termo = semAcento(texto);
  const ativos = catalogoMemoria.filter((i) => i.active);
  if (!termo) return clonar(ativos.slice(0, 15));

  // Se digitou exatamente o código ou código de barras, coloca no topo
  const exatos: CatalogItem[] = [];
  const parciais: CatalogItem[] = [];
  for (const item of ativos) {
    const cod = semAcento(item.code);
    const bar = semAcento(item.barcode ?? '');
    const nome = semAcento(item.name);
    if (cod === termo || (bar && bar === termo)) {
      exatos.push(item);
    } else if (cod.includes(termo) || bar.includes(termo) || nome.includes(termo)) {
      parciais.push(item);
    }
  }
  return clonar([...exatos, ...parciais].slice(0, 20));
}

export async function listarItensFrequentes(): Promise<CatalogItem[]> {
  await atraso(50);
  return clonar(catalogoMemoria.filter((i) => i.active && i.is_frequent));
}

export async function salvarItemCatalogo(dados: SaveCatalogItemInput): Promise<CatalogItem> {
  await atraso(120);
  const codigoLimpo = dados.code.trim();
  const nomeLimpo = dados.name.trim();
  if (!codigoLimpo) throw new Error('Informe o código do item.');
  if (!nomeLimpo) throw new Error('Informe o nome do produto ou serviço.');
  if (dados.sale_price_cents < 0) throw new Error('O preço de venda não pode ser negativo.');

  const duplicado = catalogoMemoria.find(
    (i) => semAcento(i.code) === semAcento(codigoLimpo) && i.id !== dados.id,
  );
  if (duplicado) {
    throw new Error(`Já existe um item no catálogo com o código "${codigoLimpo}" (${duplicado.name}).`);
  }

  const agora = new Date().toISOString();

  if (dados.id) {
    const idx = catalogoMemoria.findIndex((i) => i.id === dados.id);
    if (idx === -1) throw new Error('Item do catálogo não encontrado.');
    const atual = catalogoMemoria[idx];
    const atualizado: CatalogItem = {
      ...atual,
      code: codigoLimpo,
      barcode: dados.barcode?.trim() || null,
      name: nomeLimpo,
      kind: dados.kind,
      unit: dados.unit.trim() || 'UN',
      category: dados.category?.trim() || null,
      sale_price_cents: Math.round(dados.sale_price_cents),
      cost_price_cents:
        dados.cost_price_cents !== undefined
          ? dados.cost_price_cents !== null
            ? Math.round(dados.cost_price_cents)
            : null
          : atual.cost_price_cents,
      controls_stock: dados.kind === 'produto' ? Boolean(dados.controls_stock) : false,
      stock_quantity: dados.kind === 'produto' ? Number(dados.stock_quantity ?? atual.stock_quantity) : 0,
      min_stock_quantity:
        dados.kind === 'produto' ? Number(dados.min_stock_quantity ?? atual.min_stock_quantity) : 0,
      active: dados.active ?? atual.active,
      is_frequent: dados.is_frequent ?? atual.is_frequent,
      type_reviewed: true,
      ncm: dados.kind === 'produto' ? dados.ncm?.replace(/\D/g, '') || null : null,
      cfop: dados.kind === 'produto' ? dados.cfop?.replace(/\D/g, '') || '5102' : null,
      csosn: dados.kind === 'produto' ? dados.csosn?.replace(/\D/g, '') || '102' : null,
      origin: dados.origin ?? atual.origin ?? 0,
      taxable_unit: dados.taxable_unit?.trim() || dados.unit.trim() || 'UN',
      service_code: dados.kind === 'servico' ? dados.service_code?.trim() || null : null,
      iss_rate: dados.kind === 'servico' ? (dados.iss_rate ?? null) : null,
      invoice_description: dados.kind === 'servico' ? dados.invoice_description?.trim() || null : null,
      updated_at: agora,
    };
    catalogoMemoria[idx] = atualizado;
    return clonar(atualizado);
  }

  const novo: CatalogItem = {
    id: `cat-${Date.now()}`,
    code: codigoLimpo,
    barcode: dados.barcode?.trim() || null,
    name: nomeLimpo,
    kind: dados.kind,
    unit: dados.unit.trim() || (dados.kind === 'servico' ? 'SRV' : 'UN'),
    category: dados.category?.trim() || null,
    sale_price_cents: Math.round(dados.sale_price_cents),
    cost_price_cents: dados.cost_price_cents != null ? Math.round(dados.cost_price_cents) : null,
    controls_stock: dados.kind === 'produto' ? Boolean(dados.controls_stock) : false,
    stock_quantity: dados.kind === 'produto' ? Number(dados.stock_quantity ?? 0) : 0,
    min_stock_quantity: dados.kind === 'produto' ? Number(dados.min_stock_quantity ?? 0) : 0,
    active: dados.active ?? true,
    type_reviewed: true,
    has_usage: false,
    is_frequent: Boolean(dados.is_frequent),
    ncm: dados.kind === 'produto' ? dados.ncm?.replace(/\D/g, '') || null : null,
    cfop: dados.kind === 'produto' ? dados.cfop?.replace(/\D/g, '') || '5102' : null,
    csosn: dados.kind === 'produto' ? dados.csosn?.replace(/\D/g, '') || '102' : null,
    origin: dados.origin ?? 0,
    taxable_unit: dados.taxable_unit?.trim() || dados.unit.trim() || 'UN',
    service_code: dados.kind === 'servico' ? dados.service_code?.trim() || null : null,
    iss_rate: dados.kind === 'servico' ? (dados.iss_rate ?? null) : null,
    invoice_description: dados.kind === 'servico' ? dados.invoice_description?.trim() || null : null,
    created_at: agora,
    updated_at: agora,
  };
  catalogoMemoria = [novo, ...catalogoMemoria];
  return clonar(novo);
}

/** Alterna ativo/inativo. Nunca exclui item que já foi vendido ou usado em orçamento. */
export async function inativarItemCatalogo(id: string): Promise<CatalogItem> {
  await atraso(90);
  const idx = catalogoMemoria.findIndex((i) => i.id === id);
  if (idx === -1) throw new Error('Item não encontrado.');
  const atual = catalogoMemoria[idx];
  const atualizado: CatalogItem = {
    ...atual,
    active: !atual.active,
    updated_at: new Date().toISOString(),
  };
  catalogoMemoria[idx] = atualizado;
  return clonar(atualizado);
}

export async function listarSugestoesDeServico(): Promise<CatalogItem[]> {
  await atraso(70);
  return clonar(
    catalogoMemoria.filter(
      (i) => i.active && i.kind === 'produto' && !i.type_reviewed && pareceItemDeServico(i.name),
    ),
  );
}

export async function marcarComoServico(ids: string[]): Promise<number> {
  await atraso(120);
  const conjunto = new Set(ids);
  let alterados = 0;
  const agora = new Date().toISOString();
  catalogoMemoria = catalogoMemoria.map((item) => {
    if (!conjunto.has(item.id)) return item;
    alterados += 1;
    return {
      ...item,
      kind: 'servico',
      unit: item.unit === 'UN' ? 'SRV' : item.unit,
      controls_stock: false,
      stock_quantity: 0,
      type_reviewed: true,
      service_code: item.service_code ?? '14.01',
      iss_rate: item.iss_rate ?? 2.0,
      updated_at: agora,
    };
  });
  return alterados;
}

// ============================================================================
// 2. ORÇAMENTOS
// ============================================================================

function registrarEventoOrc(
  quoteId: string,
  eventType: QuoteEvent['event_type'],
  note: string,
  actorName = 'Equipe BRV',
): QuoteEvent {
  const ev: QuoteEvent = {
    id: `ev-orc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    quote_id: quoteId,
    event_type: eventType,
    actor_name: actorName,
    note,
    created_at: new Date().toISOString(),
  };
  eventosOrcamentoMemoria = [ev, ...eventosOrcamentoMemoria];
  return ev;
}

export async function listarOrcamentos(filtro: QuoteListFilter = {}): Promise<QuoteListResult> {
  await atraso(90);
  const hoje = dataIsoHoje();
  const termo = semAcento(filtro.busca ?? '');
  const sitFiltro = filtro.situacao ?? 'todos';
  const vendFiltro = (filtro.vendedorId ?? '').trim();
  const compFiltro = filtro.composicao ?? 'todos';
  const dataIni = (filtro.dataInicio ?? '').trim();
  const dataFim = (filtro.dataFim ?? '').trim();
  const pagina = Math.max(0, filtro.pagina ?? 0);

  const contagens: Record<'todos' | QuoteDisplayStatus, number> = {
    todos: 0,
    rascunho: 0,
    enviado: 0,
    aprovado: 0,
    recusado: 0,
    convertido: 0,
    vencido: 0,
  };

  // Filtra primeiro por busca/período/vendedor/composição para os chips mostrarem a contagem coerente
  const preFiltrados = orcamentosMemoria.filter((orc) => {
    if (vendFiltro && orc.seller_id !== vendFiltro) return false;
    const diaCriacao = orc.created_at.slice(0, 10);
    if (dataIni && diaCriacao < dataIni) return false;
    if (dataFim && diaCriacao > dataFim) return false;

    if (compFiltro === 'com_servico' && !orc.items.some((i) => i.kind === 'servico')) return false;
    if (compFiltro === 'com_produto' && !orc.items.some((i) => i.kind === 'produto')) return false;

    if (termo) {
      const nomesItens = orc.items.map((i) => `${i.code} ${i.name}`).join(' ');
      const alvo = semAcento(
        `${orc.number} ${orc.customer_name} ${orc.contact_name ?? ''} ${orc.seller_name ?? ''} ${nomesItens}`,
      );
      if (!alvo.includes(termo)) return false;
    }
    return true;
  });

  for (const orc of preFiltrados) {
    const sit = situacaoOrcamento(orc, hoje);
    contagens.todos += 1;
    contagens[sit] += 1;
  }

  const filtrados =
    sitFiltro === 'todos'
      ? preFiltrados
      : preFiltrados.filter((orc) => situacaoOrcamento(orc, hoje) === sitFiltro);

  const ordenados = filtrados
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  let somaTotal = 0;
  for (const orc of ordenados) {
    somaTotal = somarCentavos(somaTotal, orc.total_cents);
  }

  const inicio = pagina * ITENS_VENDAS_POR_PAGINA;
  const paginados = ordenados.slice(inicio, inicio + ITENS_VENDAS_POR_PAGINA);

  return {
    itens: clonar(paginados),
    total: ordenados.length,
    soma_total_cents: somaTotal,
    contagens,
  };
}

export async function buscarOrcamento(id: string): Promise<Quote | null> {
  await atraso(60);
  const achado = orcamentosMemoria.find((o) => o.id === id) ?? null;
  return achado ? clonar(achado) : null;
}

export async function salvarOrcamento(dados: SaveQuoteInput, atorNome = 'Equipe BRV'): Promise<Quote> {
  await atraso(130);
  if (dados.items.length === 0) {
    throw new Error('Adicione ao menos um produto ou serviço ao orçamento.');
  }
  const diasValidade = Math.max(1, Math.round(dados.validity_days || 10));
  const totais = recalcularTotaisOrcamentoOuVenda(
    dados.items,
    dados.general_discount_cents,
    dados.freight_cents,
  );
  const vendedor =
    VENDEDORES_DEMO.find((v) => v.id === dados.seller_id) ?? VENDEDORES_DEMO[0];
  const agora = new Date().toISOString();

  if (dados.id) {
    const idx = orcamentosMemoria.findIndex((o) => o.id === dados.id);
    if (idx === -1) throw new Error('Orçamento não encontrado.');
    const atual = orcamentosMemoria[idx];
    if (atual.status === 'aprovado' || atual.status === 'convertido') {
      throw new Error(
        'Orçamento aprovado ou convertido não pode ter valores alterados. Use o botão "Duplicar".',
      );
    }

    const baseData = (atual.sent_at ?? atual.created_at).slice(0, 10);
    const items = dados.items.map((l, i) => {
      const calc = calcularLinhaItemCentavos(
        l.quantity,
        l.unit_price_cents,
        l.discount_mode,
        l.discount_input,
      );
      return {
        id: l.id ?? `${atual.id}-item-${Date.now()}-${i + 1}`,
        quote_id: atual.id,
        catalog_item_id: l.catalog_item_id,
        is_custom: l.is_custom,
        kind: l.kind,
        code: l.code || (l.is_custom ? 'AVULSO' : 'ITEM'),
        name: l.name.trim(),
        unit: l.unit.trim() || (l.kind === 'servico' ? 'SRV' : 'UN'),
        quantity: l.quantity,
        unit_price_cents: Math.round(l.unit_price_cents),
        discount_mode: l.discount_mode,
        discount_input: l.discount_input,
        discount_cents: calc.descontoCentavos,
        total_cents: calc.totalCentavos,
        sort_order: i + 1,
      };
    });

    const atualizado: Quote = {
      ...atual,
      customer_id: dados.customer_id,
      customer_name: dados.customer_name?.trim() || 'Consumidor final',
      customer_person_type: dados.customer_person_type ?? 'PF',
      customer_document: dados.customer_document?.trim() || null,
      address_id: dados.address_id ?? null,
      address_text: dados.address_text?.trim() || null,
      contact_name: dados.contact_name?.trim() || null,
      contact_phone: dados.contact_phone?.trim() || null,
      seller_id: vendedor.id,
      seller_name: vendedor.name,
      validity_days: diasValidade,
      valid_until: somarDiasIso(baseData, diasValidade),
      products_subtotal_cents: totais.produtosSubtotalCentavos,
      services_subtotal_cents: totais.servicosSubtotalCentavos,
      general_discount_cents: totais.descontoGeralEfetivoCentavos,
      freight_cents: totais.freteEfetivoCentavos,
      total_cents: totais.totalCentavos,
      payment_terms_note: dados.payment_terms_note?.trim() || null,
      notes: dados.notes?.trim() || null,
      internal_notes: dados.internal_notes?.trim() || null,
      items,
      updated_at: agora,
    };

    orcamentosMemoria[idx] = atualizado;
    registrarEventoOrc(
      atual.id,
      'alterado',
      `Orçamento atualizado (${items.length} ${items.length === 1 ? 'item' : 'itens'}, total ${formatarReais(atualizado.total_cents)}).`,
      atorNome,
    );
    return clonar(atualizado);
  }

  const numeroSeq = sequenciaOrcamento++;
  const id = `orc-demo-${Date.now()}`;
  const numero = `ORC-${String(numeroSeq).padStart(5, '0')}`;
  const hoje = dataIsoHoje();

  const items = dados.items.map((l, i) => {
    const calc = calcularLinhaItemCentavos(
      l.quantity,
      l.unit_price_cents,
      l.discount_mode,
      l.discount_input,
    );
    return {
      id: `${id}-item-${i + 1}`,
      quote_id: id,
      catalog_item_id: l.catalog_item_id,
      is_custom: l.is_custom,
      kind: l.kind,
      code: l.code || (l.is_custom ? 'AVULSO' : 'ITEM'),
      name: l.name.trim(),
      unit: l.unit.trim() || (l.kind === 'servico' ? 'SRV' : 'UN'),
      quantity: l.quantity,
      unit_price_cents: Math.round(l.unit_price_cents),
      discount_mode: l.discount_mode,
      discount_input: l.discount_input,
      discount_cents: calc.descontoCentavos,
      total_cents: calc.totalCentavos,
      sort_order: i + 1,
    };
  });

  const novo: Quote = {
    id,
    number: numero,
    status: 'rascunho',
    customer_id: dados.customer_id,
    customer_name: dados.customer_name?.trim() || 'Consumidor final',
    customer_person_type: dados.customer_person_type ?? 'PF',
    customer_document: dados.customer_document?.trim() || null,
    address_id: dados.address_id ?? null,
    address_text: dados.address_text?.trim() || null,
    contact_name: dados.contact_name?.trim() || null,
    contact_phone: dados.contact_phone?.trim() || null,
    seller_id: vendedor.id,
    seller_name: vendedor.name,
    validity_days: diasValidade,
    valid_until: somarDiasIso(hoje, diasValidade),
    products_subtotal_cents: totais.produtosSubtotalCentavos,
    services_subtotal_cents: totais.servicosSubtotalCentavos,
    general_discount_cents: totais.descontoGeralEfetivoCentavos,
    freight_cents: totais.freteEfetivoCentavos,
    total_cents: totais.totalCentavos,
    payment_terms_note: dados.payment_terms_note?.trim() || null,
    notes: dados.notes?.trim() || null,
    internal_notes: dados.internal_notes?.trim() || null,
    public_token: `demo-orc-${numeroSeq}`,
    sent_at: null,
    responded_at: null,
    response_channel: null,
    responded_by_name: null,
    response_note: null,
    converted_sale_id: null,
    converted_sale_number: null,
    converted_service_order_id: null,
    converted_service_order_number: null,
    items,
    created_at: agora,
    updated_at: agora,
  };

  orcamentosMemoria = [novo, ...orcamentosMemoria];
  registrarEventoOrc(
    novo.id,
    'criado',
    `Orçamento ${novo.number} criado (${formatarReais(novo.total_cents)}).`,
    atorNome,
  );
  return clonar(novo);
}

export async function duplicarOrcamento(id: string, atorNome = 'Equipe BRV'): Promise<Quote> {
  await atraso(110);
  const original = orcamentosMemoria.find((o) => o.id === id);
  if (!original) throw new Error('Orçamento original não encontrado.');

  const numeroSeq = sequenciaOrcamento++;
  const novoId = `orc-demo-${Date.now()}`;
  const numero = `ORC-${String(numeroSeq).padStart(5, '0')}`;
  const agora = new Date().toISOString();
  const hoje = dataIsoHoje();

  const copia: Quote = {
    ...clonar(original),
    id: novoId,
    number: numero,
    status: 'rascunho',
    valid_until: somarDiasIso(hoje, original.validity_days || 10),
    public_token: `demo-orc-${numeroSeq}`,
    sent_at: null,
    responded_at: null,
    response_channel: null,
    responded_by_name: null,
    response_note: null,
    converted_sale_id: null,
    converted_sale_number: null,
    converted_service_order_id: null,
    converted_service_order_number: null,
    items: original.items.map((item, i) => ({
      ...clonar(item),
      id: `${novoId}-item-${i + 1}`,
      quote_id: novoId,
    })),
    created_at: agora,
    updated_at: agora,
  };

  orcamentosMemoria = [copia, ...orcamentosMemoria];
  registrarEventoOrc(
    copia.id,
    'criado',
    `Duplicado a partir do orçamento ${original.number}.`,
    atorNome,
  );
  return clonar(copia);
}

export async function excluirOrcamento(id: string): Promise<void> {
  await atraso(90);
  const orc = orcamentosMemoria.find((o) => o.id === id);
  if (!orc) throw new Error('Orçamento não encontrado.');
  if (orc.status !== 'rascunho') {
    throw new Error('Apenas orçamentos em rascunho podem ser excluídos.');
  }
  orcamentosMemoria = orcamentosMemoria.filter((o) => o.id !== id);
  eventosOrcamentoMemoria = eventosOrcamentoMemoria.filter((e) => e.quote_id !== id);
}

/** Volta um orçamento enviado/recusado para rascunho, revogando o link público anterior. */
export async function reabrirOrcamento(id: string, atorNome = 'Equipe BRV'): Promise<Quote> {
  await atraso(100);
  const idx = orcamentosMemoria.findIndex((o) => o.id === id);
  if (idx === -1) throw new Error('Orçamento não encontrado.');
  const atual = orcamentosMemoria[idx];
  if (atual.status === 'convertido') {
    throw new Error('Orçamento já convertido não pode ser reaberto. Duplique-o se precisar de outro.');
  }
  const novoToken = `demo-orc-${Date.now().toString(36)}`;
  const atualizado: Quote = {
    ...atual,
    status: 'rascunho',
    public_token: novoToken,
    responded_at: null,
    response_channel: null,
    responded_by_name: null,
    response_note: null,
    updated_at: new Date().toISOString(),
  };
  orcamentosMemoria[idx] = atualizado;
  registrarEventoOrc(
    id,
    'reaberto',
    'Reaberto como rascunho para edição (o link público anterior foi revogado).',
    atorNome,
  );
  return clonar(atualizado);
}

export async function registrarEnvioOrcamento(id: string, atorNome = 'Equipe BRV'): Promise<Quote> {
  await atraso(90);
  const idx = orcamentosMemoria.findIndex((o) => o.id === id);
  if (idx === -1) throw new Error('Orçamento não encontrado.');
  const atual = orcamentosMemoria[idx];
  const agora = new Date().toISOString();
  const hoje = dataIsoHoje();

  const atualizado: Quote = {
    ...atual,
    status: atual.status === 'rascunho' ? 'enviado' : atual.status,
    sent_at: agora,
    valid_until: somarDiasIso(hoje, atual.validity_days || 10),
    updated_at: agora,
  };
  orcamentosMemoria[idx] = atualizado;
  registrarEventoOrc(
    id,
    'enviado',
    `Orçamento enviado ao cliente (válido até ${atualizado.valid_until}).`,
    atorNome,
  );
  return clonar(atualizado);
}

export async function registrarRespostaOrcamento(
  id: string,
  dados: {
    decisao: 'aprovado' | 'recusado';
    canal: QuoteResponseChannel;
    observacao?: string;
    atorNome?: string;
  },
): Promise<Quote> {
  await atraso(100);
  const idx = orcamentosMemoria.findIndex((o) => o.id === id);
  if (idx === -1) throw new Error('Orçamento não encontrado.');
  const atual = orcamentosMemoria[idx];
  if (atual.status === 'convertido') {
    throw new Error('Este orçamento já foi convertido.');
  }

  const agora = new Date().toISOString();
  const quem = dados.atorNome ?? 'Equipe BRV';
  const atualizado: Quote = {
    ...atual,
    status: dados.decisao,
    responded_at: agora,
    response_channel: dados.canal,
    responded_by_name: quem,
    response_note: dados.observacao?.trim() || null,
    updated_at: agora,
  };
  orcamentosMemoria[idx] = atualizado;
  registrarEventoOrc(
    id,
    dados.decisao,
    `Cliente ${dados.decisao === 'aprovado' ? 'APROVOU' : 'RECUSOU'} o orçamento via ${dados.canal}${dados.observacao?.trim() ? `: ${dados.observacao.trim()}` : '.'}`,
    quem,
  );
  return clonar(atualizado);
}

export async function gerarNovoLinkOrcamento(id: string, atorNome = 'Equipe BRV'): Promise<Quote> {
  await atraso(90);
  const idx = orcamentosMemoria.findIndex((o) => o.id === id);
  if (idx === -1) throw new Error('Orçamento não encontrado.');
  const atual = orcamentosMemoria[idx];
  const novoToken = `demo-orc-${Date.now().toString(36)}`;
  const atualizado: Quote = {
    ...atual,
    public_token: novoToken,
    updated_at: new Date().toISOString(),
  };
  orcamentosMemoria[idx] = atualizado;
  registrarEventoOrc(
    id,
    'novo_link',
    'Gerado novo link público de aprovação (o link anterior foi revogado).',
    atorNome,
  );
  return clonar(atualizado);
}

export async function historicoDoOrcamento(id: string): Promise<QuoteEvent[]> {
  await atraso(50);
  return clonar(
    eventosOrcamentoMemoria
      .filter((e) => e.quote_id === id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  );
}

export async function anotarNoHistoricoOrcamento(
  id: string,
  nota: string,
  atorNome = 'Equipe BRV',
): Promise<QuoteEvent> {
  await atraso(80);
  if (!nota.trim()) throw new Error('Digite uma anotação.');
  return clonar(registrarEventoOrc(id, 'nota', nota.trim(), atorNome));
}

export async function listarTextosPadraoOrcamento(): Promise<QuoteStandardText[]> {
  await atraso(40);
  return clonar(
    textosPadraoMemoria
      .filter((t) => t.active)
      .sort((a, b) => a.sort_order - b.sort_order),
  );
}

export async function salvarTextoPadraoOrcamento(dados: {
  id?: string;
  title: string;
  content: string;
}): Promise<QuoteStandardText> {
  await atraso(80);
  const titulo = dados.title.trim();
  const texto = dados.content.trim();
  if (!titulo) throw new Error('Informe um título curto para a observação padrão.');
  if (!texto) throw new Error('Informe o texto da observação padrão.');

  if (dados.id) {
    const idx = textosPadraoMemoria.findIndex((t) => t.id === dados.id);
    if (idx === -1) throw new Error('Texto padrão não encontrado.');
    const atualizado: QuoteStandardText = {
      ...textosPadraoMemoria[idx],
      title: titulo,
      content: texto,
    };
    textosPadraoMemoria[idx] = atualizado;
    return clonar(atualizado);
  }

  const novo: QuoteStandardText = {
    id: `txt-padrao-${Date.now()}`,
    title: titulo,
    content: texto,
    sort_order: textosPadraoMemoria.length + 1,
    active: true,
  };
  textosPadraoMemoria = [...textosPadraoMemoria, novo];
  return clonar(novo);
}

export async function excluirTextoPadraoOrcamento(id: string): Promise<void> {
  await atraso(70);
  textosPadraoMemoria = textosPadraoMemoria.filter((t) => t.id !== id);
}

// ---------- Página pública do orçamento (/orcamento/:token) ----------

function projetarOrcamentoPublico(orc: Quote): PublicQuoteView {
  const hoje = dataIsoHoje();
  return {
    number: orc.number,
    status: orc.status,
    is_expired: Boolean(orc.valid_until && orc.valid_until < hoje),
    customer_name: orc.customer_name,
    customer_person_type: orc.customer_person_type,
    customer_document: orc.customer_document,
    address_text: orc.address_text,
    contact_name: orc.contact_name,
    contact_phone: orc.contact_phone,
    seller_name: orc.seller_name,
    validity_days: orc.validity_days,
    valid_until: orc.valid_until,
    products_subtotal_cents: orc.products_subtotal_cents,
    services_subtotal_cents: orc.services_subtotal_cents,
    general_discount_cents: orc.general_discount_cents,
    freight_cents: orc.freight_cents,
    total_cents: orc.total_cents,
    payment_terms_note: orc.payment_terms_note,
    notes: orc.notes,
    sent_at: orc.sent_at,
    responded_at: orc.responded_at,
    response_channel: orc.response_channel,
    responded_by_name: orc.responded_by_name,
    items: clonar(orc.items),
    created_at: orc.created_at,
  };
}

export async function buscarOrcamentoPublico(token: string): Promise<PublicQuoteView | null> {
  await atraso(100);
  const limpo = token.trim();
  if (!limpo) return null;
  const achado = orcamentosMemoria.find((o) => o.public_token === limpo);
  if (!achado) return null;
  return projetarOrcamentoPublico(achado);
}

export async function aprovarOrcamentoPublico(
  token: string,
  nome: string,
): Promise<PublicQuoteView> {
  await atraso(140);
  const limpo = token.trim();
  const nomeLimpo = nome.trim();
  if (nomeLimpo.length < 3) throw new Error('Informe seu nome completo para aprovar o orçamento.');

  const idx = orcamentosMemoria.findIndex((o) => o.public_token === limpo);
  if (idx === -1) throw new Error('Link de orçamento inválido ou revogado.');
  const atual = orcamentosMemoria[idx];

  const hoje = dataIsoHoje();
  if (atual.status !== 'enviado') {
    throw new Error('Este orçamento não está aguardando aprovação.');
  }
  if (atual.valid_until && atual.valid_until < hoje) {
    throw new Error('Este orçamento está vencido. Solicite a revalidação à BRV pelo WhatsApp.');
  }

  const agora = new Date().toISOString();
  const atualizado: Quote = {
    ...atual,
    status: 'aprovado',
    responded_at: agora,
    response_channel: 'link',
    responded_by_name: nomeLimpo,
    response_note: 'Aprovado pelo cliente na página pública ("Li e concordo").',
    updated_at: agora,
  };
  orcamentosMemoria[idx] = atualizado;
  registrarEventoOrc(
    atual.id,
    'aprovado',
    `Aprovado pelo link público por "${nomeLimpo}" ("Li e concordo").`,
    `${nomeLimpo} (pelo link)`,
  );
  return projetarOrcamentoPublico(atualizado);
}

/**
 * TODO(Claude): ligar à criação real de OS (`salvarOrdem`) levando os itens de serviço
 * para a descrição/"solicitação do cliente". Na demonstração, devolve um número fictício de OS.
 */
export async function gerarOsDoOrcamento(
  id: string,
  atorNome = 'Equipe BRV',
): Promise<{ quote: Quote; service_order_id: string; service_order_number: number; descricaoServicos: string }> {
  await atraso(150);
  const idx = orcamentosMemoria.findIndex((o) => o.id === id);
  if (idx === -1) throw new Error('Orçamento não encontrado.');
  const atual = orcamentosMemoria[idx];
  const servicos = atual.items.filter((i) => i.kind === 'servico');
  if (servicos.length === 0) {
    throw new Error('Este orçamento não possui itens de serviço para gerar uma Ordem de Serviço.');
  }

  const descricaoServicos = servicos
    .map((s) => `${s.quantity} ${s.unit} — ${s.name}`)
    .join('\n');
  const osNumero = sequenciaOsFicticia++;
  const osId = `os-demo-${osNumero}`;
  const agora = new Date().toISOString();

  const atualizado: Quote = {
    ...atual,
    status: 'convertido',
    converted_service_order_id: osId,
    converted_service_order_number: osNumero,
    updated_at: agora,
  };
  orcamentosMemoria[idx] = atualizado;
  registrarEventoOrc(
    id,
    'convertido_os',
    `Gerada OS nº ${osNumero} com os serviços: ${servicos.map((s) => s.name).join(', ')}.`,
    atorNome,
  );
  return {
    quote: clonar(atualizado),
    service_order_id: osId,
    service_order_number: osNumero,
    descricaoServicos,
  };
}

// ============================================================================
// 3. VENDAS E NOTAS FISCAIS
// ============================================================================

export async function listarVendas(filtro: SaleListFilter = {}): Promise<SaleListResult> {
  await atraso(90);
  const termo = semAcento(filtro.busca ?? '');
  const chip = filtro.chip ?? 'todas';
  const sitFiltro = filtro.situacao ?? 'todas';
  const formaFiltro = filtro.formaPagamento ?? 'todas';
  const origemFiltro = filtro.origem ?? 'todas';
  const statusNota = filtro.statusNota ?? 'todas';
  const dataIni = (filtro.dataInicio ?? '').trim();
  const dataFim = (filtro.dataFim ?? '').trim();
  const pagina = Math.max(0, filtro.pagina ?? 0);

  const contagens = {
    todas: vendasMemoria.length,
    a_receber: vendasMemoria.filter((v) => {
      const s = situacaoVenda(v);
      return s === 'aberta' || s === 'parcial';
    }).length,
    canceladas: vendasMemoria.filter((v) => v.status === 'cancelada').length,
  };

  const filtradas = vendasMemoria.filter((venda) => {
    const sit = situacaoVenda(venda);
    const dia = venda.created_at.slice(0, 10);

    if (chip === 'a_receber' && sit !== 'aberta' && sit !== 'parcial') return false;
    if (chip === 'canceladas' && sit !== 'cancelada') return false;

    if (sitFiltro !== 'todas' && sit !== sitFiltro) return false;
    if (origemFiltro !== 'todas' && venda.origin_type !== origemFiltro) return false;
    if (formaFiltro !== 'todas' && !venda.payments.some((p) => p.method === formaFiltro)) return false;

    if (statusNota === 'com_nota_emitida' && !venda.documents.some((d) => d.status === 'emitida')) {
      return false;
    }
    if (
      statusNota === 'com_nota_pendente' &&
      !venda.documents.some((d) => d.status === 'nao_emitida')
    ) {
      return false;
    }
    if (statusNota === 'com_erro_nota' && !venda.documents.some((d) => d.status === 'erro')) {
      return false;
    }

    if (dataIni && dia < dataIni) return false;
    if (dataFim && dia > dataFim) return false;

    if (termo) {
      const itensTexto = venda.items.map((i) => `${i.code} ${i.name}`).join(' ');
      const notasTexto = venda.documents.map((d) => d.number ?? '').join(' ');
      const alvo = semAcento(
        `${venda.number} ${venda.customer_name} ${venda.quote_number ?? ''} ${venda.service_order_number ?? ''} ${itensTexto} ${notasTexto}`,
      );
      if (!alvo.includes(termo)) return false;
    }
    return true;
  });

  const ordenadas = filtradas
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  let somaTotal = 0;
  let somaRecebido = 0;
  let somaAReceber = 0;
  for (const v of ordenadas) {
    if (v.status === 'cancelada') continue;
    somaTotal = somarCentavos(somaTotal, v.total_cents);
    somaRecebido = somarCentavos(somaRecebido, v.paid_cents);
    somaAReceber = somarCentavos(somaAReceber, Math.max(0, v.total_cents - v.paid_cents));
  }

  const inicio = pagina * ITENS_VENDAS_POR_PAGINA;
  const paginadas = ordenadas.slice(inicio, inicio + ITENS_VENDAS_POR_PAGINA);

  return {
    itens: clonar(paginadas),
    total: ordenadas.length,
    soma_total_cents: somaTotal,
    soma_recebido_cents: somaRecebido,
    soma_a_receber_cents: somaAReceber,
    contagens,
  };
}

export async function buscarVenda(id: string): Promise<Sale | null> {
  await atraso(60);
  const achada = vendasMemoria.find((v) => v.id === id) ?? null;
  return achada ? clonar(achada) : null;
}

export async function concluirVenda(
  dados: CreateSaleInput,
  atorNome = 'Equipe BRV',
): Promise<Sale> {
  await atraso(160);
  if (dados.items.length === 0) {
    throw new Error('Adicione ao menos um item ao carrinho antes de concluir a venda.');
  }

  const totais = recalcularTotaisOrcamentoOuVenda(dados.items, dados.general_discount_cents, 0);
  const somaPagamentos = dados.payments.reduce((acc, p) => somarCentavos(acc, p.amount_cents), 0);

  if (somaPagamentos > totais.totalCentavos) {
    throw new Error('A soma dos pagamentos abatidos não pode ultrapassar o total da venda.');
  }

  if (somaPagamentos < totais.totalCentavos && !dados.customer_id) {
    throw new Error(
      'Para deixar a venda em aberto (a receber), é obrigatório escolher um cliente cadastrado.',
    );
  }

  const seq = sequenciaVenda++;
  const id = `vnd-demo-${Date.now()}`;
  const numero = `VND-${String(seq).padStart(5, '0')}`;
  const agora = new Date().toISOString();
  const vendedor =
    VENDEDORES_DEMO.find((v) => v.id === dados.seller_id) ?? VENDEDORES_DEMO[0];

  const items = dados.items.map((l, i) => {
    const calc = calcularLinhaItemCentavos(
      l.quantity,
      l.unit_price_cents,
      l.discount_mode,
      l.discount_input,
    );
    return {
      id: `${id}-item-${i + 1}`,
      sale_id: id,
      catalog_item_id: l.catalog_item_id,
      is_custom: l.is_custom,
      kind: l.kind,
      code: l.code || (l.is_custom ? 'AVULSO' : 'ITEM'),
      name: l.name.trim(),
      unit: l.unit.trim() || (l.kind === 'servico' ? 'SRV' : 'UN'),
      quantity: l.quantity,
      unit_price_cents: Math.round(l.unit_price_cents),
      discount_mode: l.discount_mode,
      discount_input: l.discount_input,
      discount_cents: calc.descontoCentavos,
      total_cents: calc.totalCentavos,
      sort_order: i + 1,
    };
  });

  let trocoTotal = 0;
  const payments = dados.payments.map((pg, i) => {
    const conta =
      CONTAS_FINANCEIRAS_DEMO.find((c) => c.id === pg.account_id) ??
      (pg.method === 'dinheiro' ? CONTAS_FINANCEIRAS_DEMO[0] : CONTAS_FINANCEIRAS_DEMO[1]);
    const maq =
      pg.method === 'debito' || pg.method === 'credito'
        ? (MAQUININHAS_DEMO.find((m) => m.id === pg.card_machine_id) ?? MAQUININHAS_DEMO[0])
        : null;
    const parcelas = pg.method === 'credito' ? Math.max(1, pg.installments ?? 1) : 1;
    const taxa =
      maq && (pg.method === 'debito' || pg.method === 'credito')
        ? calcularTaxaMaquininha(maq, pg.method, parcelas, pg.amount_cents)
        : null;
    const recebidoEspecie =
      pg.method === 'dinheiro' && pg.tendered_cents && pg.tendered_cents >= pg.amount_cents
        ? Math.round(pg.tendered_cents)
        : null;
    const troco = recebidoEspecie ? Math.max(0, recebidoEspecie - pg.amount_cents) : 0;
    trocoTotal = somarCentavos(trocoTotal, troco);

    return {
      id: `${id}-pag-${i + 1}`,
      sale_id: id,
      method: pg.method,
      amount_cents: Math.round(pg.amount_cents),
      tendered_cents: recebidoEspecie,
      change_cents: troco,
      account_id: maq ? maq.settlement_account_id : conta.id,
      account_name: maq ? maq.settlement_account_name : conta.name,
      card_machine_id: maq?.id ?? null,
      card_machine_name: maq?.name ?? null,
      installments: parcelas,
      estimated_fee_percent: taxa?.percentual ?? null,
      estimated_fee_cents: taxa?.taxaCentavos ?? null,
      paid_at: agora,
      created_by_name: atorNome,
      notes: pg.notes?.trim() || null,
    };
  });

  // Separação fiscal automática: Produtos -> NFC-e/NF-e; Serviços -> NFS-e nacional
  const documents: SaleDocument[] = [];
  if (totais.produtosSubtotalCentavos > 0) {
    const modeloProd =
      dados.preferred_product_invoice_model ??
      sugerirModeloNotaProdutos(
        dados.customer_person_type,
        dados.invoice_document ?? dados.customer_document,
      );
    documents.push({
      id: `${id}-doc-prod`,
      sale_id: id,
      group: 'produtos',
      model: modeloProd,
      status: 'nao_emitida',
      amount_cents: totais.produtosSubtotalCentavos,
      number: null,
      series: null,
      access_key: null,
      xml_url: null,
      pdf_url: null,
      error_message: null,
      cancel_reason: null,
      issued_at: null,
      cancelled_at: null,
    });
  }
  if (totais.servicosSubtotalCentavos > 0) {
    documents.push({
      id: `${id}-doc-serv`,
      sale_id: id,
      group: 'servicos',
      model: 'nfse',
      status: 'nao_emitida',
      amount_cents: totais.servicosSubtotalCentavos,
      number: null,
      series: null,
      access_key: null,
      xml_url: null,
      pdf_url: null,
      error_message: null,
      cancel_reason: null,
      issued_at: null,
      cancelled_at: null,
    });
  }

  let orcOrigemNumero: string | null = null;
  if (dados.quote_id) {
    const idxOrc = orcamentosMemoria.findIndex((o) => o.id === dados.quote_id);
    if (idxOrc !== -1) {
      orcOrigemNumero = orcamentosMemoria[idxOrc].number;
      orcamentosMemoria[idxOrc] = {
        ...orcamentosMemoria[idxOrc],
        status: 'convertido',
        converted_sale_id: id,
        converted_sale_number: numero,
        updated_at: agora,
      };
      registrarEventoOrc(
        dados.quote_id,
        'convertido_venda',
        `Convertido na venda ${numero}.`,
        atorNome,
      );
    }
  }

  const novaVenda: Sale = {
    id,
    number: numero,
    status: 'ativa',
    origin_type: dados.quote_id ? 'orcamento' : (dados.origin_type ?? 'balcao'),
    quote_id: dados.quote_id ?? null,
    quote_number: orcOrigemNumero,
    service_order_id: dados.service_order_id ?? null,
    service_order_number: null,
    customer_id: dados.customer_id,
    customer_name: dados.customer_name?.trim() || 'Consumidor final',
    customer_person_type: dados.customer_person_type ?? 'PF',
    customer_document: dados.customer_document?.trim() || null,
    invoice_document: dados.invoice_document?.trim() || dados.customer_document?.trim() || null,
    address_id: dados.address_id ?? null,
    address_text: dados.address_text?.trim() || null,
    seller_id: vendedor.id,
    seller_name: vendedor.name,
    products_subtotal_cents: totais.produtosSubtotalCentavos,
    services_subtotal_cents: totais.servicosSubtotalCentavos,
    general_discount_cents: totais.descontoGeralEfetivoCentavos,
    total_cents: totais.totalCentavos,
    paid_cents: somaPagamentos,
    change_cents: trocoTotal,
    notes: dados.notes?.trim() || null,
    cancel_reason: null,
    cancelled_at: null,
    cancelled_by_name: null,
    items,
    payments,
    documents,
    events: [
      {
        id: `${id}-ev-1`,
        sale_id: id,
        description: `Venda ${numero} concluída (${formatarReais(totais.totalCentavos)}).`,
        actor_name: atorNome,
        created_at: agora,
      },
    ],
    created_at: agora,
    updated_at: agora,
  };

  vendasMemoria = [novaVenda, ...vendasMemoria];
  return clonar(novaVenda);
}

export async function receberSaldoVenda(
  id: string,
  pagamentos: Array<{
    method: FinancialPaymentMethod;
    amount_cents: number;
    tendered_cents?: number | null;
    account_id?: string | null;
    card_machine_id?: string | null;
    installments?: number;
    notes?: string | null;
  }>,
  atorNome = 'Equipe BRV',
): Promise<Sale> {
  await atraso(130);
  const idx = vendasMemoria.findIndex((v) => v.id === id);
  if (idx === -1) throw new Error('Venda não encontrada.');
  const atual = vendasMemoria[idx];
  if (atual.status === 'cancelada') throw new Error('Não é possível receber em uma venda cancelada.');

  const saldoAberto = Math.max(0, atual.total_cents - atual.paid_cents);
  const somaNovos = pagamentos.reduce((acc, p) => somarCentavos(acc, p.amount_cents), 0);
  if (somaNovos <= 0) throw new Error('Informe ao menos um pagamento com valor maior que zero.');
  if (somaNovos > saldoAberto) {
    throw new Error(`O valor informado ultrapassa o saldo em aberto (${formatarReais(saldoAberto)}).`);
  }

  const agora = new Date().toISOString();
  let trocoAdicional = 0;

  const novosPagamentos = pagamentos.map((pg, i) => {
    const conta =
      CONTAS_FINANCEIRAS_DEMO.find((c) => c.id === pg.account_id) ??
      (pg.method === 'dinheiro' ? CONTAS_FINANCEIRAS_DEMO[0] : CONTAS_FINANCEIRAS_DEMO[1]);
    const maq =
      pg.method === 'debito' || pg.method === 'credito'
        ? (MAQUININHAS_DEMO.find((m) => m.id === pg.card_machine_id) ?? MAQUININHAS_DEMO[0])
        : null;
    const parcelas = pg.method === 'credito' ? Math.max(1, pg.installments ?? 1) : 1;
    const taxa =
      maq && (pg.method === 'debito' || pg.method === 'credito')
        ? calcularTaxaMaquininha(maq, pg.method, parcelas, pg.amount_cents)
        : null;
    const recebidoEspecie =
      pg.method === 'dinheiro' && pg.tendered_cents && pg.tendered_cents >= pg.amount_cents
        ? Math.round(pg.tendered_cents)
        : null;
    const troco = recebidoEspecie ? Math.max(0, recebidoEspecie - pg.amount_cents) : 0;
    trocoAdicional = somarCentavos(trocoAdicional, troco);

    return {
      id: `${id}-pag-${Date.now()}-${i + 1}`,
      sale_id: id,
      method: pg.method,
      amount_cents: Math.round(pg.amount_cents),
      tendered_cents: recebidoEspecie,
      change_cents: troco,
      account_id: maq ? maq.settlement_account_id : conta.id,
      account_name: maq ? maq.settlement_account_name : conta.name,
      card_machine_id: maq?.id ?? null,
      card_machine_name: maq?.name ?? null,
      installments: parcelas,
      estimated_fee_percent: taxa?.percentual ?? null,
      estimated_fee_cents: taxa?.taxaCentavos ?? null,
      paid_at: agora,
      created_by_name: atorNome,
      notes: pg.notes?.trim() || null,
    };
  });

  const atualizada: Sale = {
    ...atual,
    paid_cents: somarCentavos(atual.paid_cents, somaNovos),
    change_cents: somarCentavos(atual.change_cents, trocoAdicional),
    payments: [...atual.payments, ...novosPagamentos],
    events: [
      {
        id: `${id}-ev-${Date.now()}`,
        sale_id: id,
        description: `Recebido saldo de ${formatarReais(somaNovos)}.`,
        actor_name: atorNome,
        created_at: agora,
      },
      ...atual.events,
    ],
    updated_at: agora,
  };
  vendasMemoria[idx] = atualizada;
  return clonar(atualizada);
}

/**
 * Cancela uma venda (exige motivo e bloqueia se houver nota fiscal emitida ainda não cancelada).
 * TODO(Claude): no banco, estornar também os movimentos financeiros gerados pelos pagamentos da venda.
 */
export async function cancelarVenda(
  id: string,
  motivo: string,
  atorNome = 'Adriana Lobo',
): Promise<Sale> {
  await atraso(130);
  const motivoLimpo = motivo.trim();
  if (!motivoLimpo) throw new Error('Informe o motivo do cancelamento da venda.');

  const idx = vendasMemoria.findIndex((v) => v.id === id);
  if (idx === -1) throw new Error('Venda não encontrada.');
  const atual = vendasMemoria[idx];
  if (atual.status === 'cancelada') throw new Error('Esta venda já está cancelada.');

  const notaEmitida = atual.documents.find((d) => d.status === 'emitida');
  if (notaEmitida) {
    throw new Error(
      `Esta venda possui nota fiscal emitida (${notaEmitida.model.toUpperCase()} nº ${notaEmitida.number}). Cancele a nota fiscal primeiro antes de cancelar a venda.`,
    );
  }

  const agora = new Date().toISOString();
  const atualizada: Sale = {
    ...atual,
    status: 'cancelada',
    cancel_reason: motivoLimpo,
    cancelled_at: agora,
    cancelled_by_name: atorNome,
    events: [
      {
        id: `${id}-ev-canc-${Date.now()}`,
        sale_id: id,
        description: `Venda cancelada (pagamentos estornados). Motivo: ${motivoLimpo}`,
        actor_name: atorNome,
        created_at: agora,
      },
      ...atual.events,
    ],
    updated_at: agora,
  };
  vendasMemoria[idx] = atualizada;
  return clonar(atualizada);
}

// ============================================================================
// 4. NOTAS FISCAIS DA VENDA (SIMULAÇÃO)
// ============================================================================

/**
 * TODO(Claude): provedor ainda não escolhido (docs/financeiro.md, "Notas fiscais").
 */
export async function listarNotasDaVenda(vendaId: string): Promise<SaleDocument[]> {
  await atraso(50);
  const venda = vendasMemoria.find((v) => v.id === vendaId);
  return venda ? clonar(venda.documents) : [];
}

/**
 * TODO(Claude): provedor ainda não escolhido (docs/financeiro.md, "Notas fiscais").
 * Na demonstração, aguarda ~1 s e gera número/chave fictícios.
 */
export async function emitirNotaVenda(
  vendaId: string,
  grupo: SaleDocumentGroup,
  tipo?: SaleDocumentModel,
  atorNome = 'Equipe BRV',
): Promise<Sale> {
  await atraso(1000);
  const idx = vendasMemoria.findIndex((v) => v.id === vendaId);
  if (idx === -1) throw new Error('Venda não encontrada.');
  const atual = vendasMemoria[idx];
  if (atual.status === 'cancelada') {
    throw new Error('Não é possível emitir nota fiscal de uma venda cancelada.');
  }

  const modeloFinal: SaleDocumentModel =
    grupo === 'servicos' ? 'nfse' : (tipo ?? sugerirModeloNotaProdutos(atual.customer_person_type, atual.invoice_document));
  const num = modeloFinal === 'nfse' ? `2026000${sequenciaNota++}` : String(sequenciaNota++);
  const serie = modeloFinal === 'nfse' ? 'ADN' : '1';
  const chave =
    modeloFinal === 'nfse'
      ? `3303302220732036100016420261124000${num.slice(-4)}`
      : `33261107320361000164${modeloFinal === 'nfe' ? '55' : '65'}0010000${num}1000000019`;
  const agora = new Date().toISOString();

  const docs = atual.documents.slice();
  const docIdx = docs.findIndex((d) => d.group === grupo);
  const valorGrupo =
    grupo === 'produtos' ? atual.products_subtotal_cents : atual.services_subtotal_cents;

  const novoDoc: SaleDocument = {
    id: docIdx >= 0 ? docs[docIdx].id : `${vendaId}-doc-${grupo}`,
    sale_id: vendaId,
    group: grupo,
    model: modeloFinal,
    status: 'emitida',
    amount_cents: valorGrupo,
    number: num,
    series: serie,
    access_key: chave,
    xml_url: `#xml-demo-${vendaId}-${grupo}`,
    pdf_url: `#pdf-demo-${vendaId}-${grupo}`,
    error_message: null,
    cancel_reason: null,
    issued_at: agora,
    cancelled_at: null,
  };

  if (docIdx >= 0) docs[docIdx] = novoDoc;
  else docs.push(novoDoc);

  const atualizada: Sale = {
    ...atual,
    documents: docs,
    events: [
      {
        id: `${vendaId}-ev-nf-${Date.now()}`,
        sale_id: vendaId,
        description: `Nota fiscal ${modeloFinal.toUpperCase()} nº ${num} (${grupo}) emitida (demonstração).`,
        actor_name: atorNome,
        created_at: agora,
      },
      ...atual.events,
    ],
    updated_at: agora,
  };
  vendasMemoria[idx] = atualizada;
  return clonar(atualizada);
}

/**
 * TODO(Claude): provedor ainda não escolhido (docs/financeiro.md, "Notas fiscais").
 */
export async function cancelarNotaVenda(
  notaId: string,
  motivo: string,
  atorNome = 'Adriana Lobo',
): Promise<Sale> {
  await atraso(800);
  const motivoLimpo = motivo.trim();
  if (!motivoLimpo) throw new Error('Informe o motivo do cancelamento da nota fiscal.');

  const idx = vendasMemoria.findIndex((v) => v.documents.some((d) => d.id === notaId));
  if (idx === -1) throw new Error('Nota fiscal não encontrada.');
  const atual = vendasMemoria[idx];
  const agora = new Date().toISOString();

  const docs = atual.documents.map((d) =>
    d.id === notaId
      ? {
          ...d,
          status: 'cancelada' as const,
          cancel_reason: motivoLimpo,
          cancelled_at: agora,
        }
      : d,
  );
  const docCancelado = docs.find((d) => d.id === notaId)!;

  const atualizada: Sale = {
    ...atual,
    documents: docs,
    events: [
      {
        id: `${atual.id}-ev-cancnf-${Date.now()}`,
        sale_id: atual.id,
        description: `Nota ${docCancelado.model.toUpperCase()} nº ${docCancelado.number ?? ''} cancelada. Motivo: ${motivoLimpo}`,
        actor_name: atorNome,
        created_at: agora,
      },
      ...atual.events,
    ],
    updated_at: agora,
  };
  vendasMemoria[idx] = atualizada;
  return clonar(atualizada);
}

/**
 * Registra manualmente o número da NFS-e emitida no portal nacional (`nfse.gov.br/EmissorNacional`).
 * TODO(Claude): provedor ainda não escolhido (docs/financeiro.md, "Notas fiscais").
 */
export async function registrarNotaManual(
  vendaId: string,
  modelo: SaleDocumentModel,
  numero: string,
  atorNome = 'Equipe BRV',
): Promise<Sale> {
  await atraso(100);
  const numLimpo = numero.trim();
  if (!numLimpo) throw new Error('Informe o número da nota fiscal emitida no portal.');

  const idx = vendasMemoria.findIndex((v) => v.id === vendaId);
  if (idx === -1) throw new Error('Venda não encontrada.');
  const atual = vendasMemoria[idx];
  const agora = new Date().toISOString();
  const grupo: SaleDocumentGroup = modelo === 'nfse' ? 'servicos' : 'produtos';

  const docs = atual.documents.slice();
  const docIdx = docs.findIndex((d) => d.group === grupo);
  const valorGrupo =
    grupo === 'produtos' ? atual.products_subtotal_cents : atual.services_subtotal_cents;

  const docManual: SaleDocument = {
    id: docIdx >= 0 ? docs[docIdx].id : `${vendaId}-doc-${grupo}`,
    sale_id: vendaId,
    group: grupo,
    model: modelo,
    status: 'emitida',
    amount_cents: valorGrupo,
    number: numLimpo,
    series: modelo === 'nfse' ? 'PORTAL' : '1',
    access_key: null,
    xml_url: null,
    pdf_url: null,
    error_message: null,
    cancel_reason: null,
    issued_at: agora,
    cancelled_at: null,
  };

  if (docIdx >= 0) docs[docIdx] = docManual;
  else docs.push(docManual);

  const atualizada: Sale = {
    ...atual,
    documents: docs,
    events: [
      {
        id: `${vendaId}-ev-nfman-${Date.now()}`,
        sale_id: vendaId,
        description: `Registrada manualmente a ${modelo.toUpperCase()} nº ${numLimpo} emitida no portal nacional.`,
        actor_name: atorNome,
        created_at: agora,
      },
      ...atual.events,
    ],
    updated_at: agora,
  };
  vendasMemoria[idx] = atualizada;
  return clonar(atualizada);
}

// ============================================================================
// 5. VENDEDORES E CLIENTES
// ============================================================================

export async function listarVendedores(): Promise<SellerOption[]> {
  await atraso(30);
  return clonar([...VENDEDORES_DEMO]);
}

/**
 * Reaproveita `listarClientes` de `src/services/clientes.ts` (o mesmo que `SeletorCliente` já usa),
 * sem criar busca paralela no banco.
 */
export async function buscarClientesParaVenda(texto: string): Promise<Customer[]> {
  try {
    const r = await listarClientes(texto, 'ativos', 0);
    if (r.itens.length > 0) return r.itens.slice(0, 15);
  } catch {
    // Fallback para os 3 clientes fictícios de demonstração caso esteja sem sessão no Supabase
  }
  const termo = semAcento(texto);
  return CLIENTES_DEMO_VENDAS.filter(
    (c) => !termo || semAcento(`${c.name} ${c.document} ${c.phone}`).includes(termo),
  ).map((c) => ({
    id: c.id,
    person_type: c.person_type,
    name: c.name,
    trade_name: null,
    document: c.document,
    state_registration: null,
    email: null,
    phone: c.phone,
    notes: null,
    active: true,
    field_control_id: null,
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-01T10:00:00.000Z',
  }));
}

