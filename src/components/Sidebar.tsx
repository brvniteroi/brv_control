import { NavLink } from 'react-router-dom';
import {
  CalendarRange, ClipboardList, LayoutDashboard, Package, Snowflake, Users, X,
  type LucideIcon,
} from 'lucide-react';

interface ItemMenu {
  rota: string;
  rotulo: string;
  icone: LucideIcon;
}

const MENU: ItemMenu[] = [
  { rota: '/', rotulo: 'Dashboard', icone: LayoutDashboard },
  { rota: '/linha-do-tempo', rotulo: 'Linha do Tempo', icone: CalendarRange },
  { rota: '/ordens-de-servico', rotulo: 'Ordens de Serviço', icone: ClipboardList },
  { rota: '/clientes', rotulo: 'Clientes', icone: Users },
  { rota: '/equipamentos', rotulo: 'Equipamentos', icone: Snowflake },
  { rota: '/estoque', rotulo: 'Estoque', icone: Package },
];

interface SidebarProps {
  aberta: boolean;
  onFechar: () => void;
}

export default function Sidebar({ aberta, onFechar }: SidebarProps) {
  return (
    <>
      {/* Fundo escuro atrás do menu no celular */}
      {aberta && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onFechar} aria-hidden />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-brv-navy text-white transition-transform md:static md:translate-x-0 ${
          aberta ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <span className="text-lg font-bold tracking-wide">
            BRV <span className="font-light text-sky-300">Control</span>
          </span>
          <button type="button" onClick={onFechar} className="md:hidden" aria-label="Fechar menu">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {MENU.map(({ rota, rotulo, icone: Icone }) => (
            <NavLink
              key={rota}
              to={rota}
              end={rota === '/'}
              onClick={onFechar}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brv-navy-light text-white'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icone size={18} />
              {rotulo}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 text-xs text-slate-400">BRV Niterói</div>
      </aside>
    </>
  );
}
