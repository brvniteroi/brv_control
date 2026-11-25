import { NavLink } from 'react-router-dom';
import {
  FileSpreadsheet,
  FlaskConical,
  PackageSearch,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import type { FinancialAccessLevel } from '../../types/financeiro';
import { useNivelFinanceiro } from '../financeiro/fonteDeDados';
import { FONTE_DADOS_DEMO } from './fonteDeDados';

interface ItemAbaVendas {
  rota: string;
  rotulo: string;
  icone: LucideIcon;
}

const ABAS_VENDAS: readonly ItemAbaVendas[] = [
  { rota: '/orcamentos', rotulo: 'Orçamentos', icone: FileSpreadsheet },
  { rota: '/vendas', rotulo: 'Vendas', icone: ShoppingBag },
  { rota: '/catalogo', rotulo: 'Catálogo', icone: PackageSearch },
];

const NIVEIS_DEMO: readonly { valor: FinancialAccessLevel; rotulo: string }[] = [
  { valor: 'completo', rotulo: 'completo' },
  { valor: 'caixa', rotulo: 'caixa' },
  { valor: 'nenhum', rotulo: 'nenhum' },
];

/**
 * Faixa de demonstração com seletor "Ver como: completo / caixa / nenhum" (seção 7 do briefing)
 * + barra superior comum às telas do grupo "Vendas" (`/orcamentos`, `/vendas`, `/catalogo`).
 */
export default function NavegacaoVendas() {
  const { profile } = useAuth();
  const { nivel, definirSobrescrito } = useNivelFinanceiro(profile);

  return (
    <div className="space-y-3 print:hidden">
      {FONTE_DADOS_DEMO && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2 text-xs text-amber-950"
        >
          <div className="flex items-center gap-2">
            <FlaskConical size={14} className="shrink-0 text-amber-700" aria-hidden="true" />
            <span className="font-semibold">Dados de demonstração</span>
            <span className="hidden text-amber-800 sm:inline">
              — As alterações ficam em memória até o banco ser ligado.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-amber-900">Ver como:</span>
            <div className="inline-flex rounded-lg border border-amber-300 bg-white p-0.5" role="group" aria-label="Simular nível de acesso financeiro">
              {NIVEIS_DEMO.map((op) => {
                const ativo = nivel === op.valor;
                return (
                  <button
                    key={op.valor}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => definirSobrescrito(op.valor)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                      ativo
                        ? 'bg-brv-navy text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {op.rotulo}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Submenu de Vendas"
        className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xs"
      >
        <div className="flex items-center gap-1">
          {ABAS_VENDAS.map(({ rota, rotulo, icone: Icone }) => (
            <NavLink
              key={rota}
              to={rota}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  isActive
                    ? 'bg-brv-navy text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icone size={15} aria-hidden="true" />
              <span>{rotulo}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

