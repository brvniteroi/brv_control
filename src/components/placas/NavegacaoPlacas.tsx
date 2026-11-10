import { NavLink } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  Cpu,
  DollarSign,
  FolderOpen,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { podeVerFinanceiroPlacas } from '../../utils/acessoPlacas';
import FaixaDadosDemoPlacas from './FaixaDadosDemoPlacas';

interface ItemAbaPlacas {
  rota: string;
  rotulo: string;
  icone: LucideIcon;
  exato?: boolean;
  apenasFinanceiro?: boolean;
}

const ABAS_PLACAS: readonly ItemAbaPlacas[] = [
  { rota: '/placas', rotulo: 'Reparos (Kanban)', icone: Cpu, exato: true },
  { rota: '/placas/clientes', rotulo: 'Clientes de placas', icone: Users },
  { rota: '/placas/financeiro', rotulo: 'Financeiro', icone: DollarSign, apenasFinanceiro: true },
  { rota: '/placas/fichas', rotulo: 'Fichas técnicas', icone: BookOpen },
  { rota: '/placas/erros', rotulo: 'Códigos de erro', icone: AlertTriangle },
  { rota: '/placas/assistente', rotulo: 'Assistente técnico', icone: Sparkles },
  { rota: '/placas/manuais', rotulo: 'Manuais', icone: FolderOpen },
];

/**
 * Barra superior comum às telas do menu "Placas" para quem está no computador,
 * acompanhada da faixa discreta de dados de demonstração.
 */
export default function NavegacaoPlacas() {
  const { profile } = useAuth();
  const temFinanceiro = podeVerFinanceiroPlacas(profile);

  const visiveis = ABAS_PLACAS.filter((aba) => !aba.apenasFinanceiro || temFinanceiro);

  return (
    <div className="space-y-3 print:hidden">
      <FaixaDadosDemoPlacas />

      <nav
        aria-label="Submenu de Placas"
        className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xs md:block"
      >
        <div className="flex items-center gap-1">
          {visiveis.map(({ rota, rotulo, icone: Icone, exato }) => (
            <NavLink
              key={rota}
              to={rota}
              end={exato}
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

