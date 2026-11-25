// Tipos do módulo Financeiro (docs/financeiro.md e docs/gemini/vendas-financeiro-briefing.md, Rodadas 1 e 2).
// Nomes em inglês no padrão do banco; comentários em português; valores monetários sempre em centavos inteiros (`*_cents`).

import type { PersonType } from './fsm';

/** Nível de acesso financeiro do perfil (completo = Adriana/Braulio; caixa = Jéssica/Pedro; nenhum = técnicos/demais). */
export type FinancialAccessLevel = 'completo' | 'caixa' | 'nenhum';

/** Formas de pagamento aceitas nas vendas e movimentos financeiros. */
export type FinancialPaymentMethod =
  | 'dinheiro'
  | 'pix'
  | 'debito'
  | 'credito'
  | 'boleto'
  | 'transferencia'
  | 'cheque';

/** Conta financeira da empresa (`financial_accounts`: Caixa BRV, Itaú, Caixa Econômica, Nubank...). */
export interface FinancialAccount {
  id: string;
  name: string;
  kind: 'caixa' | 'banco';
  initial_balance_cents: number;
  current_balance_cents: number;
  active: boolean;
}

export interface SaveFinancialAccountInput {
  id?: string;
  name: string;
  kind: 'caixa' | 'banco';
  initial_balance_cents: number;
  active: boolean;
}

/** Faixa de taxa por número de parcelas de uma maquininha de cartão. */
export interface CardMachineInstallmentRate {
  installments: number;
  fee_percent: number;
}

/** Maquininha de cartão (`card_machines`: Rede, InfinitePay...). */
export interface CardMachine {
  id: string;
  name: string;
  settlement_account_id: string;
  settlement_account_name: string;
  settlement_business_days: number;
  debit_fee_percent: number;
  credit_sight_fee_percent: number;
  credit_installment_rates: CardMachineInstallmentRate[];
  active: boolean;
}

export interface SaveCardMachineInput {
  id?: string;
  name: string;
  settlement_account_id: string;
  settlement_business_days: number;
  debit_fee_percent: number;
  credit_sight_fee_percent: number;
  credit_installment_rates: CardMachineInstallmentRate[];
  active: boolean;
}

/** Categoria financeira de receita ou despesa (`financial_categories`). */
export interface FinancialCategory {
  id: string;
  name: string;
  kind: 'receita' | 'despesa';
  active: boolean;
}

export interface SaveFinancialCategoryInput {
  id?: string;
  name: string;
  kind: 'receita' | 'despesa';
  active: boolean;
}

/** Fornecedor cadastrado no financeiro (`suppliers`). */
export interface Supplier {
  id: string;
  name: string;
  person_type: PersonType;
  document: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
}

export interface SaveSupplierInput {
  id?: string;
  name: string;
  person_type: PersonType;
  document: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
}

// ============================================================================
// MOVIMENTOS FINANCEIROS (`financial_movements` — imutáveis; correção só por estorno)
// ============================================================================

export type FinancialMovementDirection = 'entrada' | 'saida';

export type FinancialOriginType =
  | 'venda'
  | 'os'
  | 'avulso'
  | 'transferencia'
  | 'caixa'
  | 'tarifa_cartao';

/** Movimento financeiro no extrato (`public.financial_movements`). */
export interface FinancialMovement {
  id: string;
  /** Data local do movimento (`AAAA-MM-DD`). */
  occurred_date: string;
  created_at: string;
  direction: FinancialMovementDirection;
  /** Valor positivo em centavos inteiros. */
  amount_cents: number;
  account_id: string;
  account_name: string;
  category_id: string | null;
  category_name: string | null;
  method: FinancialPaymentMethod;
  origin_type: FinancialOriginType;
  origin_id: string | null;
  origin_label: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  customer_name: string | null;
  description: string;
  created_by_name: string;
  /** `true` quando este movimento é um lançamento de estorno de outro movimento. */
  is_reversal: boolean;
  /** ID do movimento original que este lançamento estorna. */
  reverses_movement_id: string | null;
  /** Descrição curta do movimento original estornado (ex.: "estorna #mov-012"). */
  reverses_description: string | null;
  /** Se já foi estornado, ID do movimento de estorno (bloqueia segundo estorno). */
  reversed_by_movement_id: string | null;
  reversal_reason: string | null;
  /** ID compartilhado entre os dois movimentos de uma transferência entre contas. */
  transfer_pair_id: string | null;
  /** Saldo acumulado na conta após o movimento (preenchido quando filtrado por uma conta). */
  running_balance_cents?: number | null;
}

export interface FinancialMovementFilter {
  pagina?: number;
  busca?: string;
  contaId?: string;
  formaPagamento?: 'todas' | FinancialPaymentMethod;
  categoriaId?: string;
  origem?: 'todas' | 'venda' | 'os' | 'avulso' | 'transferencia';
  direcao?: 'todas' | 'entrada' | 'saida' | 'estornos';
  dataInicio?: string;
  dataFim?: string;
}

export interface FinancialMovementListResult {
  itens: FinancialMovement[];
  total: number;
  soma_entradas_cents: number;
  soma_saidas_cents: number;
  saldo_liquido_cents: number;
  saldo_atual_conta_cents: number | null;
}

export interface CreateManualMovementInput {
  direction: FinancialMovementDirection;
  occurred_date: string;
  account_id: string;
  category_id: string;
  method: FinancialPaymentMethod;
  amount_cents: number;
  description: string;
  supplier_id?: string | null;
}

export interface CreateTransferInput {
  occurred_date: string;
  from_account_id: string;
  to_account_id: string;
  amount_cents: number;
  description?: string;
}

// ============================================================================
// RECEBIMENTOS A CONFERIR DOS TÉCNICOS (`field_receipts`, seção 6.3)
// ============================================================================

export type FieldReceiptStatus = 'a_conferir' | 'confirmado' | 'divergente';

export interface FieldReceipt {
  id: string;
  service_order_id: string;
  service_order_number: number;
  customer_name: string;
  technician_id: string;
  technician_name: string;
  received_at: string;
  /** Valor informado pelo técnico em centavos. */
  amount_cents: number;
  /** Valor total da OS em centavos (para exibir "Falta R$ X" quando parcial). */
  order_total_cents: number;
  method: 'dinheiro' | 'debito' | 'credito' | 'pix';
  installments: number;
  card_machine_id: string | null;
  card_machine_name: string | null;
  status: FieldReceiptStatus;
  notes: string | null;
  divergence_reason: string | null;
  confirmed_at: string | null;
  confirmed_by_name: string | null;
  settled_account_id: string | null;
  settled_account_name: string | null;
  /** Data prevista/efetiva do crédito na conta (`AAAA-MM-DD`, dia útil seguinte para cartão). */
  settled_date: string | null;
  /** Tarifa da maquininha lançada como despesa na confirmação de cartão. */
  fee_cents: number | null;
}

export interface ConfirmFieldReceiptInput {
  account_id?: string;
  card_machine_id?: string;
  installments?: number;
  settlement_date?: string;
  fee_cents?: number;
  notes?: string;
}

export interface TechnicianCashHolding {
  technician_id: string;
  technician_name: string;
  receipts_count: number;
  total_cash_cents: number;
  oldest_received_at: string;
}

// ============================================================================
// CAIXA FÍSICO DA LOJA (`cash_sessions`, `cash_session_entries`, seção 6.2)
// ============================================================================

export type CashEntryKind = 'venda_dinheiro' | 'recebimento_os' | 'reforco' | 'sangria' | 'estorno' | 'outro';

export interface CashSessionEntry {
  id: string;
  session_id: string;
  kind: CashEntryKind;
  direction: 'entrada' | 'saida';
  amount_cents: number;
  description: string;
  origin_label: string | null;
  created_by_name: string;
  created_at: string;
}

export interface CashSession {
  id: string;
  status: 'aberto' | 'fechado';
  opened_date: string;
  opened_at: string;
  opened_by_name: string;
  opening_balance_cents: number;
  entries_in_cents: number;
  entries_out_cents: number;
  expected_balance_cents: number;
  counted_balance_cents: number | null;
  difference_cents: number | null;
  difference_reason: string | null;
  closed_at: string | null;
  closed_by_name: string | null;
  entries: CashSessionEntry[];
}

export interface CreateCashEntryInput {
  kind: 'reforco' | 'sangria';
  amount_cents: number;
  description: string;
}

/** Caixa aberto (ou null) e, com ele fechado, o que o sistema espera encontrar na gaveta. */
export interface CashStatus {
  sessao: CashSession | null;
  esperado_abertura_cents: number | null;
  primeira_abertura: boolean;
}

export interface CloseCashSessionInput {
  /** Caixa que está na tela (o banco recusa se ele já foi fechado). */
  session_id: string;
  counted_balance_cents: number;
  difference_reason?: string;
}

// ============================================================================
// VISÃO GERAL (`resumoFinanceiro`, seção 6.1)
// ============================================================================

export interface PendingCardMachineBalance {
  machine_id: string;
  machine_name: string;
  settlement_account_name: string;
  pending_gross_cents: number;
  estimated_fee_cents: number;
  pending_net_cents: number;
  next_settlement_date: string;
}

export interface OpenSaleReceivableSummary {
  sale_id: string;
  sale_number: string;
  customer_name: string;
  created_at: string;
  total_cents: number;
  paid_cents: number;
  remaining_cents: number;
  paid_methods_label: string;
}

export interface DailyReceivedPoint {
  date: string;
  amount_cents: number;
}

export interface FinancialOverviewSummary {
  accounts: FinancialAccount[];
  total_accounts_balance_cents: number;
  pending_machines: PendingCardMachineBalance[];
  received_today_cents: number;
  received_today_by_method: Record<FinancialPaymentMethod, number>;
  received_month_cents: number;
  received_month_by_method: Record<FinancialPaymentMethod, number>;
  technician_cash_total_cents: number;
  technician_cash_list: TechnicianCashHolding[];
  pending_receipts_count: number;
  open_sales_total_cents: number;
  open_sales_count: number;
  open_sales_oldest: OpenSaleReceivableSummary[];
  daily_received_30d: DailyReceivedPoint[];
}

// ============================================================================
// MODAL REAPROVEITÁVEL `RegistrarRecebimentoModal` (seção 6.6)
// ============================================================================

export interface OrigemRecebimentoModal {
  tipo: 'venda' | 'os' | 'avulso';
  id?: string;
  numero?: string;
  clienteNome: string;
  valorSugerido: number;
}

export interface LinhaRecebimentoInput {
  method: FinancialPaymentMethod;
  amount_cents: number;
  tendered_cents?: number | null;
  account_id?: string | null;
  card_machine_id?: string | null;
  installments?: number;
}

export interface RegistrarRecebimentoInput {
  origem: OrigemRecebimentoModal;
  occurred_date: string;
  category_id?: string | null;
  notes?: string | null;
  pagamentos: LinhaRecebimentoInput[];
}
