import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Snowflake,
  UserCog,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/useAuth';

interface ItemMenu {
  rota: string;
  rotulo: string;
  icone: LucideIcon;
  apenasEscritorio?: boolean;
}

interface GrupoMenu {
  rotulo: string;
  icone: LucideIcon;
  itens: ItemMenu[];
}

type EntradaMenu = ItemMenu | GrupoMenu;

const ehGrupo = (e: EntradaMenu): e is GrupoMenu => 'itens' in e;

const MENU: EntradaMenu[] = [
  { rota: '/', rotulo: 'Dashboard', icone: LayoutDashboard },
  {
    rotulo: 'Serviços',
    icone: Wrench,
    itens: [
      { rota: '/linha-do-tempo', rotulo: 'Linha do Tempo', icone: CalendarRange, apenasEscritorio: true },
      { rota: '/calendario', rotulo: 'Calendário', icone: CalendarDays, apenasEscritorio: true },
      { rota: '/ordens-de-servico', rotulo: 'Ordens de Serviço', icone: ClipboardList },
    ],
  },
  { rota: '/clientes', rotulo: 'Clientes', icone: Users },
  { rota: '/equipamentos', rotulo: 'Equipamentos', icone: Snowflake },
  { rota: '/estoque', rotulo: 'Estoque', icone: Package },
  { rota: '/formularios', rotulo: 'Modelos de Formulários', icone: FileText, apenasEscritorio: true },
  { rota: '/equipe', rotulo: 'Equipe', icone: UserCog },
];

interface SidebarProps {
  aberta: boolean;
  onFechar: () => void;
}

const classeLink = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-brv-navy-light text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
  }`;

export default function Sidebar({ aberta, onFechar }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const { pathname } = useLocation();
  const [gruposFechados, setGruposFechados] = useState<Record<string, boolean>>({});
  const podeGerenciarFormularios = profile?.role === 'admin' || profile?.role === 'escritorio';
  const visivel = (item: ItemMenu) => !item.apenasEscritorio || podeGerenciarFormularios;

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
          <div className="flex items-center gap-2.5">
            <img src="/logo-brv.webp" alt="Logo BRV" className="h-7 w-auto object-contain" />
            <span className="text-lg font-bold tracking-wide">
              BRV <span className="font-light text-sky-300">Control</span>
            </span>
          </div>
          <button type="button" onClick={onFechar} className="md:hidden" aria-label="Fechar menu">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {MENU.map((entrada) => {
            if (!ehGrupo(entrada)) {
              if (!visivel(entrada)) return null;
              const { rota, rotulo, icone: Icone } = entrada;
              return (
                <NavLink key={rota} to={rota} end={rota === '/'} onClick={onFechar} className={classeLink}>
                  <Icone size={18} />
                  {rotulo}
                </NavLink>
              );
            }

            const filhos = entrada.itens.filter(visivel);
            if (filhos.length === 0) return null;
            const GrupoIcone = entrada.icone;
            const temAtivo = filhos.some((f) => pathname.startsWith(f.rota));
            // Aberto por padrão; só recolhe quando não se está numa tela do grupo
            const aberto = temAtivo || !gruposFechados[entrada.rotulo];
            return (
              <div key={entrada.rotulo}>
                <button
                  type="button"
                  onClick={() => setGruposFechados((g) => ({ ...g, [entrada.rotulo]: aberto }))}
                  aria-expanded={aberto}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <GrupoIcone size={18} />
                  <span className="flex-1 text-left">{entrada.rotulo}</span>
                  <ChevronDown size={16} className={`transition-transform ${aberto ? '' : '-rotate-90'}`} />
                </button>
                {aberto && (
                  <div className="mt-1 ml-5 space-y-1 border-l border-white/10 pl-2">
                    {filhos.map(({ rota, rotulo, icone: Icone }) => (
                      <NavLink key={rota} to={rota} onClick={onFechar} className={classeLink}>
                        <Icone size={16} />
                        {rotulo}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => {
              onFechar();
              signOut();
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-red-400 transition"
          >
            <LogOut size={16} />
            Sair da conta
          </button>
          <div className="mt-1 px-3 text-[11px] text-slate-500">BRV Niterói</div>
        </div>
      </aside>
    </>
  );
}
