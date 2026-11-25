// Camada de dados de demonstração do Financeiro (seções 7 e 8 de docs/gemini/vendas-financeiro-briefing.md).
// Na Rodada 1 expõe `nivelFinanceiro(profile)`, o seletor de demonstração "Ver como: completo / caixa / nenhum"
// e a leitura das contas e maquininhas usadas na tela de Nova Venda / Receber saldo.
// As demais funções do Financeiro (seção 6) serão completadas na Rodada 2.

import { useSyncExternalStore } from 'react';
import type {
  CardMachine,
  FinancialAccessLevel,
  FinancialAccount,
} from '../../types/financeiro';
import type { Profile } from '../../types/fsm';

export const FONTE_DADOS_FINANCEIRO_DEMO = true;

// Estado reativo do seletor "Ver como: completo / caixa / nenhum" da faixa de demonstração
let nivelDemoSobrescrito: FinancialAccessLevel | null = null;
const ouvintesNivel = new Set<() => void>();

export function definirNivelFinanceiroDemo(nivel: FinancialAccessLevel | null): void {
  nivelDemoSobrescrito = nivel;
  for (const fn of ouvintesNivel) fn();
}

export function obterNivelFinanceiroDemoSobrescrito(): FinancialAccessLevel | null {
  return nivelDemoSobrescrito;
}

export function assinarNivelFinanceiroDemo(ouvinte: () => void): () => void {
  ouvintesNivel.add(ouvinte);
  return () => ouvintesNivel.delete(ouvinte);
}

/**
 * Retorna o nível de acesso financeiro do usuário logado (`completo`, `caixa` ou `nenhum`).
 * TODO(Claude): quando a coluna `profiles.financial_access` existir no banco, mover para
 * `src/utils/acessoFinanceiro.ts` lendo o campo real do `profile` (garantindo que `admin`
 * seja sempre `completo` e `tecnico`/`cliente`/`oficina` sejam sempre `nenhum`).
 */
export function nivelFinanceiro(profile: Pick<Profile, 'role'> | null | undefined): FinancialAccessLevel {
  if (!profile) return 'nenhum';
  if (profile.role !== 'admin' && profile.role !== 'escritorio') {
    return 'nenhum';
  }
  if (FONTE_DADOS_FINANCEIRO_DEMO && nivelDemoSobrescrito !== null) {
    return nivelDemoSobrescrito;
  }
  if (profile.role === 'admin') return 'completo';
  if (profile.role === 'escritorio') return 'caixa';
  return 'nenhum';
}

/** Hook reativo que recalcula `nivelFinanceiro(profile)` sempre que o seletor "Ver como" da faixa demo muda. */
export function useNivelFinanceiro(profile: Pick<Profile, 'role'> | null | undefined): {
  nivel: FinancialAccessLevel;
  sobrescrito: FinancialAccessLevel | null;
  definirSobrescrito: (n: FinancialAccessLevel | null) => void;
} {
  const sobrescrito = useSyncExternalStore(
    assinarNivelFinanceiroDemo,
    obterNivelFinanceiroDemoSobrescrito,
    () => null,
  );
  return {
    nivel: nivelFinanceiro(profile),
    sobrescrito,
    definirSobrescrito: definirNivelFinanceiroDemo,
  };
}

/** Contas financeiras iniciais da BRV (usadas na escolha de destino dos pagamentos da venda). */
export const CONTAS_FINANCEIRAS_DEMO: readonly FinancialAccount[] = [
  {
    id: 'conta-caixa-brv',
    name: 'Caixa BRV (Loja)',
    kind: 'caixa',
    initial_balance_cents: 120000,
    current_balance_cents: 285000,
    active: true,
  },
  {
    id: 'conta-itau',
    name: 'Itaú Empresas',
    kind: 'banco',
    initial_balance_cents: 1540000,
    current_balance_cents: 2489500,
    active: true,
  },
  {
    id: 'conta-cef',
    name: 'Caixa Econômica',
    kind: 'banco',
    initial_balance_cents: 620000,
    current_balance_cents: 845000,
    active: true,
  },
  {
    id: 'conta-nubank',
    name: 'Nubank PJ',
    kind: 'banco',
    initial_balance_cents: 310000,
    current_balance_cents: 512000,
    active: true,
  },
];

/** Maquininhas de cartão iniciais da BRV com suas taxas para estimativa na venda. */
export const MAQUININHAS_DEMO: readonly CardMachine[] = [
  {
    id: 'maq-rede',
    name: 'Rede (Laranjinha Itaú)',
    settlement_account_id: 'conta-itau',
    settlement_account_name: 'Itaú Empresas',
    settlement_business_days: 1,
    debit_fee_percent: 1.39,
    credit_sight_fee_percent: 3.19,
    credit_installment_rates: [
      { installments: 2, fee_percent: 4.49 },
      { installments: 3, fee_percent: 5.39 },
      { installments: 4, fee_percent: 6.29 },
      { installments: 5, fee_percent: 7.19 },
      { installments: 6, fee_percent: 7.99 },
      { installments: 10, fee_percent: 11.49 },
      { installments: 12, fee_percent: 12.99 },
    ],
    active: true,
  },
  {
    id: 'maq-infinitepay',
    name: 'InfinitePay',
    settlement_account_id: 'conta-itau',
    settlement_account_name: 'Itaú Empresas',
    settlement_business_days: 1,
    debit_fee_percent: 0.85,
    credit_sight_fee_percent: 2.89,
    credit_installment_rates: [
      { installments: 2, fee_percent: 3.99 },
      { installments: 3, fee_percent: 4.79 },
      { installments: 4, fee_percent: 5.59 },
      { installments: 5, fee_percent: 6.39 },
      { installments: 6, fee_percent: 7.15 },
      { installments: 10, fee_percent: 10.29 },
      { installments: 12, fee_percent: 11.79 },
    ],
    active: true,
  },
];

export async function listarContas(): Promise<FinancialAccount[]> {
  return CONTAS_FINANCEIRAS_DEMO.map((c) => ({ ...c }));
}

export async function listarMaquininhas(): Promise<CardMachine[]> {
  return MAQUININHAS_DEMO.map((m) => ({
    ...m,
    credit_installment_rates: m.credit_installment_rates.map((r) => ({ ...r })),
  }));
}

