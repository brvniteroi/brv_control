import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import AreaTrabalho from '../components/linhaDoTempo/AreaTrabalho';
import NovaAtividadeModal from '../components/linhaDoTempo/NovaAtividadeModal';
import OrdemDetalhes from '../components/ordens/OrdemDetalhes';
import { useAuth } from '../contexts/useAuth';
import { useLinhaDoTempo } from '../hooks/useLinhaDoTempo';
import { dataLocal, formatarHora, minutosDoDia, somarDias } from '../utils/linhaDoTempo';
import { infoStatusAtividade } from '../utils/ordens';

const ZOOMS_PX_POR_HORA = [56, 88, 140];
const CHAVE_ZOOM = 'brv:linha-do-tempo:zoom';
const CHAVE_PAINEL = 'brv:linha-do-tempo:painel-v2';

const BOTAO =
  'inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50';

function lerNumero(chave: string, padrao: number): number {
  const v = Number(localStorage.getItem(chave));
  return Number.isInteger(v) && v >= 0 && v < ZOOMS_PX_POR_HORA.length ? v : padrao;
}

function dataPorExtenso(dia: string): string {
  return new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function LinhaDoTempo() {
  const { profile } = useAuth();
  if (profile?.role !== 'admin' && profile?.role !== 'escritorio') {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Lock size={24} />
        </div>
        <h2 className="mt-3 text-base font-bold text-slate-800">Acesso Restrito</h2>
        <p className="mt-1 max-w-sm text-xs text-slate-500">A linha do tempo é restrita aos perfis de escritório e administradores.</p>
      </div>
    );
  }
  return <LinhaDoTempoEscritorio />;
}

function LinhaDoTempoEscritorio() {
  // /linha-do-tempo?dia=YYYY-MM-DD abre no dia (usado pelo calendário)
  const [params] = useSearchParams();
  const [dia, setDia] = useState(() => {
    const pedido = params.get('dia');
    return pedido && /^\d{4}-\d{2}-\d{2}$/.test(pedido) ? pedido : dataLocal();
  });
  const [zoom, setZoom] = useState(() => lerNumero(CHAVE_ZOOM, 1));
  const [painelAberto, setPainelAberto] = useState(() => localStorage.getItem(CHAVE_PAINEL) === '1');
  const [tecnicosFiltro, setTecnicosFiltro] = useState<string[]>([]);
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [mostrarCanceladas, setMostrarCanceladas] = useState(false);
  const [novaAberta, setNovaAberta] = useState(false);
  const [ordemAberta, setOrdemAberta] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => new Date());

  const t = useLinhaDoTempo(dia);
  const { limparErroAcao } = t;

  useEffect(() => localStorage.setItem(CHAVE_ZOOM, String(zoom)), [zoom]);
  useEffect(() => localStorage.setItem(CHAVE_PAINEL, painelAberto ? '1' : '0'), [painelAberto]);

  // Relógio da linha do "agora"
  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // O aviso de erro de uma ação some sozinho
  useEffect(() => {
    if (!t.erroAcao) return;
    const timer = setTimeout(limparErroAcao, 7000);
    return () => clearTimeout(timer);
  }, [t.erroAcao, limparErroAcao]);

  // Atalhos: ← → mudam o dia, T volta para hoje
  useEffect(() => {
    if (ordemAberta || novaAberta) return;
    const aoTecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'ArrowLeft') setDia((d) => somarDias(d, -1));
      else if (e.key === 'ArrowRight') setDia((d) => somarDias(d, 1));
      else if (e.key.toLowerCase() === 't') setDia(dataLocal());
    };
    window.addEventListener('keydown', aoTecla);
    return () => window.removeEventListener('keydown', aoTecla);
  }, [ordemAberta, novaAberta]);

  const ehHoje = dia === dataLocal(agora);
  const agoraMin = ehHoje ? agora.getHours() * 60 + agora.getMinutes() : null;

  const tecnicosVisiveis = useMemo(
    () => (tecnicosFiltro.length === 0 ? t.tecnicos : t.tecnicos.filter((x) => tecnicosFiltro.includes(x.id))),
    [t.tecnicos, tecnicosFiltro],
  );
  const atividadesVisiveis = useMemo(() => {
    const ids = new Set(tecnicosVisiveis.map((x) => x.id));
    const filtrando = tecnicosFiltro.length > 0;
    return t.atividades.filter(
      (a) => (mostrarCanceladas || a.status !== 'cancelada') && (!filtrando || (a.employee_id !== null && ids.has(a.employee_id))),
    );
  }, [t.atividades, tecnicosVisiveis, tecnicosFiltro, mostrarCanceladas]);

  if (ordemAberta) {
    return (
      <OrdemDetalhes
        ordemId={ordemAberta}
        onFechar={() => setOrdemAberta(null)}
        onSalvo={(id) => {
          setOrdemAberta(id);
          t.recarregar();
        }}
      />
    );
  }

  const alternarTecnico = (id: string) =>
    setTecnicosFiltro((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[480px] flex-col gap-3">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Linha do tempo</h1>
          <p className="mt-0.5 text-xs capitalize text-slate-500">{dataPorExtenso(dia)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
            <button type="button" onClick={() => setDia(somarDias(dia, -1))} aria-label="Dia anterior" className="px-2.5 py-2 text-slate-600 hover:bg-slate-50">
              <ChevronLeft size={16} />
            </button>
            <input
              type="date"
              value={dia}
              onChange={(e) => e.target.value && setDia(e.target.value)}
              aria-label="Data"
              className="border-x border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"
            />
            <button type="button" onClick={() => setDia(somarDias(dia, 1))} aria-label="Próximo dia" className="px-2.5 py-2 text-slate-600 hover:bg-slate-50">
              <ChevronRight size={16} />
            </button>
          </div>
          <button type="button" onClick={() => setDia(dataLocal())} disabled={ehHoje} className={BOTAO}>
            <CalendarRange size={14} /> Hoje
          </button>

          <div className="relative">
            <button type="button" onClick={() => setFiltroAberto((a) => !a)} className={BOTAO}>
              Técnicos{tecnicosFiltro.length > 0 ? ` (${tecnicosFiltro.length})` : ''}
            </button>
            {filtroAberto && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFiltroAberto(false)} />
                <div className="absolute right-0 z-50 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  {t.tecnicos.map((x) => (
                    <label key={x.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                      <input type="checkbox" checked={tecnicosFiltro.includes(x.id)} onChange={() => alternarTecnico(x.id)} />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: x.timeline_color }} />
                      {x.name}
                    </label>
                  ))}
                  <button type="button" onClick={() => setTecnicosFiltro([])} className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-blue-600 hover:bg-blue-50">
                    Mostrar todos
                  </button>
                </div>
              </>
            )}
          </div>

          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={mostrarCanceladas} onChange={(e) => setMostrarCanceladas(e.target.checked)} />
            Canceladas
          </label>

          <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
            <button type="button" onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} aria-label="Diminuir" className="px-2.5 py-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              <ZoomOut size={15} />
            </button>
            <button type="button" onClick={() => setZoom((z) => Math.min(ZOOMS_PX_POR_HORA.length - 1, z + 1))} disabled={zoom === ZOOMS_PX_POR_HORA.length - 1} aria-label="Aumentar" className="border-l border-slate-200 px-2.5 py-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              <ZoomIn size={15} />
            </button>
          </div>

          <button type="button" onClick={t.recarregar} disabled={t.carregando} className={BOTAO}>
            {t.carregando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Atualizar
          </button>
          <button type="button" onClick={() => setPainelAberto((a) => !a)} className={`${BOTAO} hidden md:inline-flex`}>
            <ListTodo size={14} /> A agendar{t.aAgendar.length > 0 ? ` (${t.aAgendar.length})` : ''}
          </button>
          <button type="button" onClick={() => setNovaAberta(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700">
            <Plus size={14} /> Nova atividade
          </button>
        </div>
      </div>

      {t.erroAcao && (
        <div role="alert" className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          <span className="flex items-center gap-2"><AlertCircle size={14} /> {t.erroAcao}</span>
          <button type="button" onClick={limparErroAcao} className="font-semibold underline">Fechar</button>
        </div>
      )}

      {t.erro ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
          <p>{t.erro}</p>
          <button type="button" onClick={t.recarregar} className="mt-3 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-rose-700 shadow-2xs hover:bg-rose-100">
            Tentar de novo
          </button>
        </div>
      ) : (
        <>
          {/* Computador: grade com arrastar e soltar */}
          <div className="hidden min-h-0 flex-1 flex-col md:flex">
            {t.carregando && t.atividades.length === 0 && t.tecnicos.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
                <Loader2 size={18} className="mr-2 animate-spin text-blue-600" /> Carregando a agenda...
              </div>
            ) : (
              <AreaTrabalho
                dia={dia}
                tecnicos={tecnicosVisiveis}
                atividades={atividadesVisiveis}
                aAgendar={t.aAgendar}
                conflitos={t.conflitos}
                pxPorHora={ZOOMS_PX_POR_HORA[zoom]}
                painelAberto={painelAberto}
                agoraMin={agoraMin}
                aoAbrirOrdem={setOrdemAberta}
                agendar={async (id, d) => t.agendar(id, d)}
                desagendar={t.desagendar}
              />
            )}
            {!t.carregando && atividadesVisiveis.length === 0 && (
              <p className="mt-2 text-center text-xs text-slate-500">Nenhuma atividade neste dia.</p>
            )}
          </div>

          {/* Celular: lista por técnico, sem arrastar */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto md:hidden">
            {tecnicosVisiveis.map((tec) => {
              const doTecnico = atividadesVisiveis
                .filter((a) => a.employee_id === tec.id)
                .sort((a, b) => a.scheduled_start!.localeCompare(b.scheduled_start!));
              return (
                <section key={tec.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tec.timeline_color }} />
                    {tec.name}
                  </h2>
                  {doTecnico.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-400">Livre neste dia.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {doTecnico.map((a) => (
                        <li key={a.id}>
                          <button type="button" onClick={() => setOrdemAberta(a.service_order_id)} className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-left text-xs">
                            <span className="font-mono font-bold text-slate-700">
                              {formatarHora(minutosDoDia(a.scheduled_start!, dia))}
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                              <b>{a.ordem?.customer?.name ?? a.title}</b>
                              {a.ordem ? ` · OS ${a.ordem.number}` : ''}
                            </span>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${infoStatusAtividade(a.status).classe}`}>
                              {infoStatusAtividade(a.status).rotulo}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      {novaAberta && (
        <NovaAtividadeModal
          dia={dia}
          tecnicos={t.tecnicos}
          aoFechar={() => setNovaAberta(false)}
          aoSalvo={() => {
            setNovaAberta(false);
            t.recarregar();
          }}
        />
      )}
    </div>
  );
}
