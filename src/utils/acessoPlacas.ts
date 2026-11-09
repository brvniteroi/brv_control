import type { Profile } from '../types/fsm';

/**
 * Financeiro das placas (dashboard, reembolso): só quem tem a marca `board_finance_access` no perfil, hoje o Braulio.
 * Não depende do papel (admin comum não basta). O banco repete a regra em `tem_financeiro_placas()`.
 */
export function podeVerFinanceiroPlacas(profile: Profile | null | undefined): boolean {
  return (
    !!profile &&
    profile.active &&
    (profile.role === 'admin' || profile.role === 'escritorio') &&
    profile.board_finance_access === true
  );
}
