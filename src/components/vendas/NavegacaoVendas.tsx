import { useAuth } from '../../contexts/useAuth';
import type { FinancialAccessLevel } from '../../types/financeiro';
import { useNivelFinanceiro } from '../financeiro/fonteDeDados';
import { FONTE_DADOS_DEMO } from './fonteDeDados';

/**
 * Controle discreto "Ver como: completo / caixa / nenhum" exibido no cabeçalho
 * somente enquanto `FONTE_DADOS_DEMO` for `true`. A navegação entre telas é pelo menu lateral.
 */
export default function NavegacaoVendas() {
  const { profile } = useAuth();
  const { nivel, definirSobrescrito } = useNivelFinanceiro(profile);

  if (!FONTE_DADOS_DEMO) return null;

  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 print:hidden">
      <span>Ver como:</span>
      <select
        value={nivel}
        aria-label="Simular nível de acesso financeiro"
        onChange={(e) => definirSobrescrito(e.target.value as FinancialAccessLevel)}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-none"
      >
        <option value="completo">completo</option>
        <option value="caixa">caixa</option>
        <option value="nenhum">nenhum</option>
      </select>
    </label>
  );
}
