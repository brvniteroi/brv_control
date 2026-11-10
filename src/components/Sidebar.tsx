import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  CalendarRange,
  ChartColumn,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  ClipboardList,
  Cpu,
  DollarSign,
  FileBarChart,
  FileText,
  FolderOpen,
  Hammer,
  Layers,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Map as MapaIcone,
  Package,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Tag,
  UserCog,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { podeVerFinanceiroPlacas } from '../utils/acessoPlacas';

interface ItemMenu {
  rota: string;
  rotulo: string;
  icone: LucideIcon;
  apenasEscritorio?: boolean;
  /** Visível também para o papel 'oficina' (que só vê estes itens) */
  oficina?: boolean;
  /** Visível apenas para quem tem `podeVerFinanceiroPlacas(profile)` */
  financeiroPlacas?: boolean;
}

interface GrupoMenu {
  rotulo: string;
  icone: LucideIcon;
  itens: ItemMenu[];
}

type EntradaMenu = ItemMenu | GrupoMenu;

const ehGrupo = (e: EntradaMenu): e is GrupoMenu => 'itens' in e;

/**
 * O módulo Placas ainda usa dados de demonstração (`components/placas/fonteDeDados.ts`, `FONTE_DADOS_DEMO`).
 * Enquanto for `false`, o grupo "Placas" fica fora do menu (as rotas `/placas...` seguem abrindo por URL para testar).
 * Virar `true` junto com `FONTE_DADOS_DEMO = false`, quando o banco das placas estiver ligado.
 */
const MOSTRAR_MENU_PLACAS = true;

const MENU: EntradaMenu[] = [
  { rota: '/', rotulo: 'Dashboard', icone: LayoutDashboard },
  {
    rotulo: 'Serviços',
    icone: Wrench,
    itens: [
      { rota: '/linha-do-tempo', rotulo: 'Linha do Tempo', icone: CalendarRange, apenasEscritorio: true },
      { rota: '/calendario', rotulo: 'Calendário', icone: CalendarDays, apenasEscritorio: true },
      { rota: '/mapa', rotulo: 'Mapa', icone: MapaIcone, apenasEscritorio: true },
      { rota: '/ordens-de-servico', rotulo: 'Ordens de Serviço', icone: ClipboardList },
      // PMOC fica fora do menu até ligar ao banco (hoje usa dados de demonstração). Rotas /pmoc seguem acessíveis por URL.
      // { rota: '/pmoc', rotulo: 'PMOC', icone: FileCheck2, apenasEscritorio: true },
    ],
  },
  {
    rotulo: 'Cadastros',
    icone: FolderOpen,
    itens: [
      { rota: '/clientes', rotulo: 'Clientes', icone: Users },
      { rota: '/equipamentos', rotulo: 'Equipamentos', icone: Snowflake },
      { rota: '/tipos-de-servico', rotulo: 'Tipos de Serviço', icone: ListChecks, apenasEscritorio: true },
      { rota: '/etiquetas', rotulo: 'Etiquetas', icone: Tag, apenasEscritorio: true },
      { rota: '/cargos', rotulo: 'Cargos', icone: BriefcaseBusiness, apenasEscritorio: true },
      { rota: '/formularios', rotulo: 'Modelos de Formulários', icone: FileText, apenasEscritorio: true },
      { rota: '/equipe', rotulo: 'Equipe', icone: UserCog },
    ],
  },
  {
    rotulo: 'Relatórios',
    icone: FileBarChart,
    itens: [
      { rota: '/relatorios/atividades', rotulo: 'Atividades', icone: ClipboardCheck, apenasEscritorio: true },
      { rota: '/relatorios/graficos', rotulo: 'Gráficos', icone: ChartColumn, apenasEscritorio: true },
      { rota: '/relatorios/tipos-de-servico', rotulo: 'Tipos de Serviços', icone: Layers, apenasEscritorio: true },
      { rota: '/relatorios/garantia-brv', rotulo: 'Garantia BRV', icone: ShieldCheck, apenasEscritorio: true },
    ],
  },
  { rota: '/oficina', rotulo: 'Oficina', icone: Hammer, oficina: true },
  {
    rotulo: 'Placas',
    icone: Cpu,
    itens: [
      { rota: '/placas', rotulo: 'Reparos (Kanban)', icone: Cpu, apenasEscritorio: true },
      { rota: '/placas/clientes', rotulo: 'Clientes de placas', icone: Users, apenasEscritorio: true },
      { rota: '/placas/financeiro', rotulo: 'Financeiro', icone: DollarSign, financeiroPlacas: true },
      { rota: '/placas/fichas', rotulo: 'Fichas técnicas', icone: BookOpen, apenasEscritorio: true },
      { rota: '/placas/erros', rotulo: 'Códigos de erro', icone: AlertTriangle, apenasEscritorio: true },
      { rota: '/placas/assistente', rotulo: 'Assistente técnico', icone: Sparkles, apenasEscritorio: true },
      { rota: '/placas/manuais', rotulo: 'Manuais', icone: FolderOpen, apenasEscritorio: true },
    ],
  },
  { rota: '/estoque', rotulo: 'Estoque', icone: Package },
  { rota: '/ajuda', rotulo: 'Ajuda (F1)', icone: CircleHelp, apenasEscritorio: true },
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
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({});
  const podeGerenciarFormularios = profile?.role === 'admin' || profile?.role === 'escritorio';
  const ehBancada = profile?.role === 'oficina';
  const temFinanceiroPlacas = podeVerFinanceiroPlacas(profile);
  const visivel = (item: ItemMenu) => {
    if (item.financeiroPlacas) return temFinanceiroPlacas;
    return ehBancada ? !!item.oficina : !item.apenasEscritorio || podeGerenciarFormularios;
  };

  return (
    <>
      {/* Fundo escuro atrás do menu no celular */}
      {aberta && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onFechar} aria-hidden />
      )}

      <aside
        className={`print:hidden fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-brv-navy text-white transition-transform md:static md:translate-x-0 ${
          aberta ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <img src="/logobrvcontrol.png" alt="Logo BRV" className="h-7 w-auto object-contain" />
            <span className="text-lg font-bold tracking-wide">
              BRV <span className="font-light text-sky-300">Control</span>
            </span>
          </div>
          <button type="button" onClick={onFechar} className="md:hidden" aria-label="Fechar menu">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {MENU.filter((e) => MOSTRAR_MENU_PLACAS || !(ehGrupo(e) && e.rotulo === 'Placas')).map((entrada) => {
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
            // Recolhido por padrão e aberto quando se está numa tela do grupo; o clique sempre manda
            const aberto = gruposAbertos[entrada.rotulo] ?? temAtivo;
            return (
              <div key={entrada.rotulo}>
                <button
                  type="button"
                  onClick={() => setGruposAbertos((g) => ({ ...g, [entrada.rotulo]: !aberto }))}
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
                      <NavLink key={rota} to={rota} end={rota === '/placas'} onClick={onFechar} className={classeLink}>
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
