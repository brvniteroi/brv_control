import type { Profile } from '../types/fsm';

/**
 * Quem entra em Vendas, Orçamentos e Catálogo: o admin sempre; o escritório só se for vendedor.
 * A mesma regra de `public.pode_vender()` no banco, que é quem de fato protege os dados.
 */
export function podeVender(profile: Pick<Profile, 'role' | 'sales_access'> | null | undefined): boolean {
  if (!profile) return false;
  return profile.role === 'admin' || (profile.role === 'escritorio' && !!profile.sales_access);
}
