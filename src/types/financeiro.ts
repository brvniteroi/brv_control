// Tipos do módulo Financeiro (docs/financeiro.md e docs/gemini/vendas-financeiro-briefing.md).
// Nomes em inglês no padrão do banco; valores monetários sempre em centavos inteiros.

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

/** Categoria financeira de receita ou despesa (`financial_categories`). */
export interface FinancialCategory {
  id: string;
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

