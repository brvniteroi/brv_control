// Tipos do módulo de Catálogo, Orçamentos e Vendas (Rodada 1).
// Nomes das propriedades em inglês espelhando as futuras tabelas do Supabase:
// catalog_items, quotes, quote_items, quote_events, quote_texts, sales, sale_items, sale_payments, sale_documents.
// Valores monetários sempre em centavos inteiros (`*_cents`).

import type { FinancialPaymentMethod } from './financeiro';
import type { PersonType } from './fsm';
import type { ModoDescontoLinha } from '../utils/dinheiro';

/** Tipo do item no catálogo: Produto (vai em NFC-e / NF-e) ou Serviço (vai em NFS-e nacional). */
export type CatalogItemKind = 'produto' | 'servico';

/** Unidades de medida usuais do catálogo. */
export type CatalogUnit = 'UN' | 'M' | 'KG' | 'CX' | 'PAR' | 'KIT' | 'H' | 'SRV' | 'ROLO' | 'L';

/** Origem da mercadoria para ICMS/CSOSN (0 = Nacional, 1 = Estrangeira importação direta, 2 = Estrangeira adquirida no mercado interno, etc.). */
export type MerchandiseOrigin = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Linha de `public.catalog_items` (catálogo de produtos e serviços). */
export interface CatalogItem {
  id: string;
  /** Código único do item (ex.: código herdado da TABEST1 do SicWeb ou código interno). */
  code: string;
  /** Código de barras EAN/GTIN opcional (usado pelo leitor no balcão). */
  barcode: string | null;
  /** Nome descritivo do produto ou serviço. */
  name: string;
  /** 'produto' ou 'servico'. */
  kind: CatalogItemKind;
  /** Unidade comercial (UN, M, KG, CX, H, SRV...). */
  unit: string;
  /** Categoria de agrupamento no catálogo (ex.: Instalação, Tubulação, Elétrica, Gás e Solda, Peças). */
  category: string | null;
  /** Preço de venda sugerido em centavos. */
  sale_price_cents: number;
  /** Preço de custo em centavos (só visível para nível financeiro `completo`). */
  cost_price_cents: number | null;
  /** Se verdadeiro, exibe o saldo atual e avisa quando a quantidade vendida ultrapassa o saldo. */
  controls_stock: boolean;
  /** Saldo atual em estoque (apenas para produtos que controlam estoque). */
  stock_quantity: number;
  /** Estoque mínimo para alerta de reposição. */
  min_stock_quantity: number;
  /** Item ativo aparece nas buscas de orçamento e venda. */
  active: boolean;
  /** Se o tipo Produto/Serviço já foi conferido na ferramenta "Revisar tipos". */
  type_reviewed: boolean;
  /** Se o item já participou de vendas ou orçamentos (impede exclusão física; apenas inativa). */
  has_usage: boolean;
  /** Destaque para aparecer na grade de itens frequentes da Nova Venda. */
  is_frequent: boolean;

  // --- Dados fiscais de Produto (NFC-e / NF-e) ---
  /** NCM de 8 dígitos (ex.: 74111010 para tubo de cobre). */
  ncm: string | null;
  /** CFOP padrão de saída interna (padrão 5.102). */
  cfop: string | null;
  /** CSOSN do Simples Nacional (padrão 102). */
  csosn: string | null;
  /** Origem da mercadoria (0 a 8, padrão 0 = Nacional). */
  origin: MerchandiseOrigin;
  /** Unidade tributável na nota (se vazia, usa `unit`). */
  taxable_unit: string | null;

  // --- Dados fiscais de Serviço (NFS-e nacional) ---
  /** Código de serviço nacional / LC 116 / NBS (ex.: 14.01). */
  service_code: string | null;
  /** Alíquota de ISS em percentual (ex.: 2.0 ou 5.0). */
  iss_rate: number | null;
  /** Descrição fiscal padrão para discriminação na NFS-e. */
  invoice_description: string | null;

  created_at: string;
  updated_at: string;
}

/** Dados para criar ou editar um item do catálogo. */
export interface SaveCatalogItemInput {
  id?: string;
  code: string;
  barcode?: string | null;
  name: string;
  kind: CatalogItemKind;
  unit: string;
  category?: string | null;
  sale_price_cents: number;
  cost_price_cents?: number | null;
  controls_stock: boolean;
  stock_quantity?: number;
  min_stock_quantity?: number;
  active?: boolean;
  is_frequent?: boolean;
  ncm?: string | null;
  cfop?: string | null;
  csosn?: string | null;
  origin?: MerchandiseOrigin;
  taxable_unit?: string | null;
  service_code?: string | null;
  iss_rate?: number | null;
  invoice_description?: string | null;
}

/** Filtros de listagem do catálogo (`/catalogo`). */
export interface CatalogListFilter {
  pagina?: number;
  busca?: string;
  aba?: 'todos' | 'produtos' | 'servicos' | 'inativos';
  categoria?: string;
}

/** Retorno paginado de `listarCatalogo`. */
export interface CatalogListResult {
  itens: CatalogItem[];
  total: number;
  categorias: string[];
  contagens: {
    todos: number;
    produtos: number;
    servicos: number;
    inativos: number;
    sugestoes_revisao: number;
  };
}

// ============================================================================
// ORÇAMENTOS (`quotes`, `quote_items`, `quote_events`, `quote_texts`)
// ============================================================================

/** Situação gravada no banco em `quotes.status`. */
export type QuoteBaseStatus = 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'convertido';

/** Situação exibida na tela (`vencido` é derivado quando `status === 'enviado'` e `valid_until < hoje`). */
export type QuoteDisplayStatus = QuoteBaseStatus | 'vencido';

/** Canal pelo qual o cliente respondeu ao orçamento. */
export type QuoteResponseChannel = 'link' | 'whatsapp' | 'telefone' | 'presencial' | 'email';

/** Item de um orçamento (`public.quote_items`). */
export interface QuoteItem {
  id: string;
  quote_id: string;
  /** `null` quando for "Item avulso" (sem cadastro no catálogo). */
  catalog_item_id: string | null;
  /** Marca se foi lançado como item avulso. */
  is_custom: boolean;
  /** 'produto' ou 'servico' (define em qual das duas tabelas o item entra e qual nota gerará). */
  kind: CatalogItemKind;
  /** Código do item (ou "AVULSO"). */
  code: string;
  /** Descrição do produto ou serviço no orçamento. */
  name: string;
  /** Unidade de medida (UN, M, SRV...). */
  unit: string;
  /** Quantidade (aceita decimal, ex.: 4.5 metros). */
  quantity: number;
  /** Valor unitário em centavos. */
  unit_price_cents: number;
  /** Modo de desconto na linha: 'valor' (em centavos) ou 'percentual' (0..100). */
  discount_mode: ModoDescontoLinha;
  /** Valor digitado para o desconto (centavos se 'valor', percentual se 'percentual'). */
  discount_input: number;
  /** Desconto calculado da linha em centavos. */
  discount_cents: number;
  /** Total líquido da linha em centavos: `Math.round(quantity * unit_price_cents) - discount_cents`. */
  total_cents: number;
  /** Ordem de exibição dentro da tabela do seu tipo. */
  sort_order: number;
}

/** Tipo de evento da linha do tempo do orçamento (`public.quote_events`). */
export type QuoteEventType =
  | 'criado'
  | 'alterado'
  | 'enviado'
  | 'reaberto'
  | 'novo_link'
  | 'aprovado'
  | 'recusado'
  | 'convertido_venda'
  | 'convertido_os'
  | 'nota';

/** Evento do histórico de um orçamento (`public.quote_events`). */
export interface QuoteEvent {
  id: string;
  quote_id: string;
  event_type: QuoteEventType;
  actor_name: string;
  note: string | null;
  created_at: string;
}

/** Texto padrão de observação de orçamento (`public.quote_texts`). */
export interface QuoteStandardText {
  id: string;
  title: string;
  content: string;
  sort_order: number;
  active: boolean;
}

/** Vendedor / atendente listado nos seletores de orçamento e venda. */
export interface SellerOption {
  id: string;
  name: string;
  role: string;
}

/** Orçamento completo (`public.quotes`). */
export interface Quote {
  id: string;
  /** Código sequencial legível no formato `ORC-NNNNN` (ex.: `ORC-01703`). */
  number: string;
  /** Situação gravada no banco (`vencido` é calculado via `situacaoOrcamento`). */
  status: QuoteBaseStatus;
  /** `null` = "Consumidor final (sem cadastro)". */
  customer_id: string | null;
  /** Nome do cliente ou "Consumidor final". */
  customer_name: string;
  customer_person_type: PersonType;
  customer_document: string | null;
  /** Endereço selecionado do cliente (`customer_addresses.id`). */
  address_id: string | null;
  /** Resumo do endereço para impressão do orçamento. */
  address_text: string | null;
  /** Nome livre do contato no cliente (campo "Contato" da tela antiga do SicWeb). */
  contact_name: string | null;
  /** Telefone de contato nesta cópia do orçamento. */
  contact_phone: string | null;
  /** ID do vendedor/atendente responsável. */
  seller_id: string | null;
  seller_name: string | null;
  /** Validade em dias corridos (padrão 10). */
  validity_days: number;
  /** Data limite de validade (`YYYY-MM-DD`). */
  valid_until: string;
  /** Subtotal líquido dos itens de tipo `produto` em centavos. */
  products_subtotal_cents: number;
  /** Subtotal líquido dos itens de tipo `servico` em centavos. */
  services_subtotal_cents: number;
  /** Desconto geral aplicado ao orçamento em centavos. */
  general_discount_cents: number;
  /** Frete ou outras despesas acessórias em centavos. */
  freight_cents: number;
  /** Total geral do orçamento em centavos (`produtos + servicos - desconto_geral + frete`). */
  total_cents: number;
  /** Forma de pagamento prevista (texto curto livre, ex.: "PIX ou cartão em até 6x"). */
  payment_terms_note: string | null;
  /** Observações que saem impressas no documento A4 e na página pública do cliente. */
  notes: string | null;
  /** Observação interna exclusiva do escritório (nunca vai para o documento nem link público). */
  internal_notes: string | null;
  /** Token público opaco para `/orcamento/:token`. */
  public_token: string;
  /** Data/hora do envio ao cliente. */
  sent_at: string | null;
  /** Data/hora da resposta (aprovação ou recusa). */
  responded_at: string | null;
  response_channel: QuoteResponseChannel | null;
  /** Nome de quem aprovou pelo link ou registrou a resposta no escritório. */
  responded_by_name: string | null;
  response_note: string | null;
  /** Vínculo com venda gerada (`sales.id`). */
  converted_sale_id: string | null;
  converted_sale_number: string | null;
  /** Vínculo com OS gerada (`service_orders.id`). */
  converted_service_order_id: string | null;
  converted_service_order_number: number | null;
  items: QuoteItem[];
  created_at: string;
  updated_at: string;
}

/** Dados enviados pelo editor ao criar ou atualizar um orçamento (`salvarOrcamento`). */
export interface SaveQuoteInput {
  id?: string;
  customer_id: string | null;
  customer_name?: string | null;
  customer_person_type?: PersonType;
  customer_document?: string | null;
  address_id?: string | null;
  address_text?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  seller_id?: string | null;
  validity_days: number;
  general_discount_cents: number;
  freight_cents: number;
  payment_terms_note?: string | null;
  notes?: string | null;
  internal_notes?: string | null;
  items: Array<{
    id?: string;
    catalog_item_id: string | null;
    is_custom: boolean;
    kind: CatalogItemKind;
    code: string;
    name: string;
    unit: string;
    quantity: number;
    unit_price_cents: number;
    discount_mode: ModoDescontoLinha;
    discount_input: number;
  }>;
}

/** Filtros da listagem `/orcamentos`. */
export interface QuoteListFilter {
  pagina?: number;
  busca?: string;
  situacao?: 'todos' | QuoteDisplayStatus;
  vendedorId?: string;
  dataInicio?: string;
  dataFim?: string;
  composicao?: 'todos' | 'com_servico' | 'com_produto';
}

/** Resultado paginado de `listarOrcamentos`. */
export interface QuoteListResult {
  itens: Quote[];
  total: number;
  soma_total_cents: number;
  contagens: Record<'todos' | QuoteDisplayStatus, number>;
}

/** Dados públicos e seguros do orçamento exibidos em `/orcamento/:token` (sem `internal_notes`). */
export interface PublicQuoteView {
  number: string;
  status: QuoteBaseStatus;
  is_expired: boolean;
  customer_name: string;
  customer_person_type: PersonType;
  customer_document: string | null;
  address_text: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  seller_name: string | null;
  validity_days: number;
  valid_until: string;
  products_subtotal_cents: number;
  services_subtotal_cents: number;
  general_discount_cents: number;
  freight_cents: number;
  total_cents: number;
  payment_terms_note: string | null;
  notes: string | null;
  sent_at: string | null;
  responded_at: string | null;
  response_channel: QuoteResponseChannel | null;
  responded_by_name: string | null;
  items: QuoteItem[];
  created_at: string;
}

// ============================================================================
// VENDAS E NOTAS FISCAIS (`sales`, `sale_items`, `sale_payments`, `sale_documents`)
// ============================================================================

/** Origem comercial da venda. */
export type SaleOriginType = 'balcao' | 'orcamento' | 'os';

/** Situação gravada da venda (`sales.status`). */
export type SaleBaseStatus = 'ativa' | 'cancelada';

/** Situação calculada da venda a partir dos pagamentos e do status. */
export type SaleDisplayStatus = 'aberta' | 'parcial' | 'paga' | 'cancelada';

/** Item de uma venda (`public.sale_items`). */
export interface SaleItem {
  id: string;
  sale_id: string;
  catalog_item_id: string | null;
  is_custom: boolean;
  kind: CatalogItemKind;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  unit_price_cents: number;
  discount_mode: ModoDescontoLinha;
  discount_input: number;
  discount_cents: number;
  total_cents: number;
  sort_order: number;
}

/** Linha de pagamento de uma venda (`public.sale_payments`). */
export interface SalePayment {
  id: string;
  sale_id: string;
  method: FinancialPaymentMethod;
  /** Valor abatido da venda em centavos (sem o troco). */
  amount_cents: number;
  /** Valor entregue em espécie quando `method === 'dinheiro'` (para registro do troco). */
  tendered_cents: number | null;
  /** Troco devolvido em centavos quando `method === 'dinheiro'`. */
  change_cents: number;
  account_id: string | null;
  account_name: string | null;
  card_machine_id: string | null;
  card_machine_name: string | null;
  installments: number;
  estimated_fee_percent: number | null;
  estimated_fee_cents: number | null;
  paid_at: string;
  created_by_name: string;
  notes: string | null;
}

/** Grupo fiscal da nota na venda: 'produtos' (NFC-e / NF-e) ou 'servicos' (NFS-e nacional). */
export type SaleDocumentGroup = 'produtos' | 'servicos';

/** Modelo do documento fiscal. */
export type SaleDocumentModel = 'nfce' | 'nfe' | 'nfse';

/** Situação da nota fiscal. */
export type SaleDocumentStatus = 'nao_emitida' | 'emitindo' | 'emitida' | 'cancelada' | 'erro';

/** Documento fiscal vinculado à venda (`public.sale_documents`). */
export interface SaleDocument {
  id: string;
  sale_id: string;
  group: SaleDocumentGroup;
  model: SaleDocumentModel;
  status: SaleDocumentStatus;
  amount_cents: number;
  number: string | null;
  series: string | null;
  access_key: string | null;
  xml_url: string | null;
  pdf_url: string | null;
  error_message: string | null;
  cancel_reason: string | null;
  issued_at: string | null;
  cancelled_at: string | null;
}

/** Evento do histórico de uma venda. */
export interface SaleEvent {
  id: string;
  sale_id: string;
  description: string;
  actor_name: string;
  created_at: string;
}

/** Venda completa (`public.sales`). */
export interface Sale {
  id: string;
  /** Código sequencial legível no formato `VND-NNNNN` (ex.: `VND-01191`). */
  number: string;
  status: SaleBaseStatus;
  origin_type: SaleOriginType;
  quote_id: string | null;
  quote_number: string | null;
  service_order_id: string | null;
  service_order_number: number | null;
  /** `null` = "Consumidor final". */
  customer_id: string | null;
  customer_name: string;
  customer_person_type: PersonType;
  customer_document: string | null;
  /** CPF/CNPJ informado avulso para sair na nota quando for Consumidor final. */
  invoice_document: string | null;
  address_id: string | null;
  address_text: string | null;
  seller_id: string | null;
  seller_name: string | null;
  products_subtotal_cents: number;
  services_subtotal_cents: number;
  general_discount_cents: number;
  total_cents: number;
  paid_cents: number;
  change_cents: number;
  notes: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  cancelled_by_name: string | null;
  items: SaleItem[];
  payments: SalePayment[];
  documents: SaleDocument[];
  events: SaleEvent[];
  created_at: string;
  updated_at: string;
}

/** Dados enviados ao concluir uma nova venda (`concluirVenda`). */
export interface CreateSaleInput {
  origin_type?: SaleOriginType;
  quote_id?: string | null;
  service_order_id?: string | null;
  customer_id: string | null;
  customer_name?: string | null;
  customer_person_type?: PersonType;
  customer_document?: string | null;
  invoice_document?: string | null;
  address_id?: string | null;
  address_text?: string | null;
  seller_id?: string | null;
  general_discount_cents: number;
  notes?: string | null;
  /** Escolha opcional do modelo de nota para os produtos ('nfce' | 'nfe'). */
  preferred_product_invoice_model?: 'nfce' | 'nfe';
  items: Array<{
    catalog_item_id: string | null;
    is_custom: boolean;
    kind: CatalogItemKind;
    code: string;
    name: string;
    unit: string;
    quantity: number;
    unit_price_cents: number;
    discount_mode: ModoDescontoLinha;
    discount_input: number;
  }>;
  payments: Array<{
    method: FinancialPaymentMethod;
    amount_cents: number;
    tendered_cents?: number | null;
    account_id?: string | null;
    card_machine_id?: string | null;
    installments?: number;
    notes?: string | null;
  }>;
}

/** Filtros da listagem `/vendas`. */
export interface SaleListFilter {
  pagina?: number;
  busca?: string;
  /** Atalho de situação. Data é só pelo período (`dataInicio`/`dataFim`): o antigo atalho "Hoje" brigava com ele (2026-11-24). */
  chip?: 'todas' | 'a_receber' | 'canceladas';
  situacao?: 'todas' | SaleDisplayStatus;
  formaPagamento?: 'todas' | FinancialPaymentMethod;
  origem?: 'todas' | SaleOriginType;
  statusNota?: 'todas' | 'com_nota_emitida' | 'com_nota_pendente' | 'com_erro_nota';
  dataInicio?: string;
  dataFim?: string;
}

/** Retorno paginado de `listarVendas`. */
export interface SaleListResult {
  itens: Sale[];
  total: number;
  soma_total_cents: number;
  soma_recebido_cents: number;
  soma_a_receber_cents: number;
  contagens: {
    todas: number;
    a_receber: number;
    canceladas: number;
  };
}

