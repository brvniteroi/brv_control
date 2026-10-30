import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Lock, Plus, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DiaCalendarioModal from '../components/calendario/DiaCalendarioModal';
import GradeMes from '../components/calendario/GradeMes';
import NovaAtividadeModal from '../components/linhaDoTempo/NovaAtividadeModal';
import OrdemDetalhes from '../components/ordens/OrdemDetalhes';
import { useAuth } from '../contexts/useAuth';
import { somarMeses, useCalendario } from '../hooks/useCalendario';
import type { AtividadeLinha } from '../hooks/useLinhaDoTempo';
import type { TecnicoLinha } from '../services/linhaDoTempo';
import { dataLocal } from '../utils/linhaDoTempo';
import { COR_STATUS_ATIVIDADE, STATUS_ATIVIDADE } from '../utils/ordens';

const BOTAO =
  'inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50';

export default function Calendario() {
  const { profile } = useAuth();
  if (profile?.role !== 'admin' && profile?.role !== 'escritorio') {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Lock size={24} />
        </div>
        <h2 className="mt-3 text-base font-bold text-slate-800">Acesso Restrito</h2>
        <p className="mt-1 max-w-sm text-xs text-slate-500">O calendário é restrito aos perfis de escritório e administradores.</p>
      </div>
    );
  }
  return <CalendarioEscritorio />;
}

function CalendarioEscritorio() {
  const navigate = useNavigate();
  const hoje = dataLocal();
  const [mes, setMes] = useState(() => hoje.slice(0, 7));
  const [tecnicosFiltro, setTecnicosFiltro] = useState<string[]>([]);
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [mostrarCanceladas, setMostrarCanceladas] = useState(false);
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [novaNoDia, setNovaNoDia] = useState<string | null>(null);
  const [ordemAberta, setOrdemAberta] = useState<string | null>(null);

  const c = useCalendario(mes);

  // Atalhos: ← → mudam o mês, T volta para o mês atual
  useEffect(() => {
    if (ordemAberta || diaAberto || novaNoDia) return;
    const aoTecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'ArrowLeft') setMes((m) => somarMeses(m, -1));
      else if (e.key === 'ArrowRight') setMes((m) => somarMeses(m, 1));
      else if (e.key.toLowerCase() === 't') setMes(dataLocal().slice(0, 7));
    };
    window.addEventListener('keydown', aoTecla);
    return () => window.removeEventListener('keydown', aoTecla);
  }, [ordemAberta, diaAberto, novaNoDia]);

  const tecnicosPorId = useMemo(() => new Map<string, TecnicoLinha>(c.colaboradores.map((x) => [x.id, x])), [c.colaboradores]);
  const tecnicosAtivos = useMemo(() => c.colaboradores.filter((x) => x.active && x.role === 'tecnico'), [c.colaboradores]);

  const porDiaVisivel = useMemo(() => {
    const filtrando = tecnicosFiltro.length > 0;
    const mapa = new Map<string, AtividadeLinha[]>();
    for (const [dia, lista] of c.porDia) {
      const visiveis = lista.filter(
        (a) =>
          (mostrarCanceladas || a.status !== 'cancelada') &&
          (!filtrando || (a.employee_id !== null && tecnicosFiltro.includes(a.employee_id))),
      );
      if (visiveis.length > 0) mapa.set(dia, visiveis);
    }
    return mapa;
  }, [c.porDia, tecnicosFiltro, mostrarCanceladas]);

  const totalDoMes = useMemo(
    () => [...porDiaVisivel].filter(([dia]) => dia.startsWith(mes)).reduce((s, [, l]) => s + l.length, 0),
    [porDiaVisivel, mes],
  );

  if (ordemAberta) {
    return (
      <OrdemDetalhes
        ordemId={ordemAberta}
        onFechar={() => setOrdemAberta(null)}
        onSalvo={(id) => {
          setOrdemAberta(id);
          c.recarregar();
        }}
      />
    );
  }

  const alternarTecnico = (id: string) =>
    setTecnicosFiltro((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));

  const nomeMes = new Date(`${mes}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const ehMesAtual = mes === hoje.slice(0, 7);

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[560px] flex-col gap-3">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 first-letter:uppercase">{nomeMes}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Calendário de atividades · {totalDoMes} {totalDoMes === 1 ? 'atividade' : 'atividades'} no mês
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
            <button type="button" onClick={() => setMes(somarMeses(mes, -1))} aria-label="Mês anterior" className="px-2.5 py-2 text-slate-600 hover:bg-slate-50">
              <ChevronLeft size={16} />
            </button>
            <input
              type="month"
              value={mes}
              onChange={(e) => e.target.value && setMes(e.target.value)}
              aria-label="Mês"
              className="border-x border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"
            />
            <button type="button" onClick={() => setMes(somarMeses(mes, 1))} aria-label="Próximo mês" className="px-2.5 py-2 text-slate-600 hover:bg-slate-50">
              <ChevronRight size={16} />
            </button>
          </div>
          <button type="button" onClick={() => setMes(hoje.slice(0, 7))} disabled={ehMesAtual} className={BOTAO}>
            <CalendarDays size={14} /> Hoje
          </button>

          <div className="relative">
            <button type="button" onClick={() => setFiltroAberto((a) => !a)} className={BOTAO}>
              Técnicos{tecnicosFiltro.length > 0 ? ` (${tecnicosFiltro.length})` : ''}
            </button>
            {filtroAberto && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFiltroAberto(false)} />
                <div className="absolute right-0 z-50 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  {tecnicosAtivos.map((x) => (
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

          <button type="button" onClick={c.recarregar} disabled={c.carregando} className={BOTAO}>
            {c.carregando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Atualizar
          </button>
          <button
            type="button"
            onClick={() => setNovaNoDia(ehMesAtual ? hoje : `${mes}-01`)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
          >
            <Plus size={14} /> Nova atividade
          </button>
        </div>
      </div>

      {c.erro ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
          <p>{c.erro}</p>
          <button type="button" onClick={c.recarregar} className="mt-3 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-rose-700 shadow-2xs hover:bg-rose-100">
            Tentar de novo
          </button>
        </div>
      ) : (
        <GradeMes
          mes={mes}
          dias={c.dias}
          hoje={hoje}
          porDia={porDiaVisivel}
          tecnicos={tecnicosPorId}
          aoAbrirOrdem={setOrdemAberta}
          aoAbrirDia={setDiaAberto}
        />
      )}

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] text-slate-600 shadow-2xs">
        <span className="font-semibold text-slate-700">Situações:</span>
        {STATUS_ATIVIDADE.map((s) => (
          <span key={s.valor} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${COR_STATUS_ATIVIDADE[s.valor]}`} />
            {s.rotulo}
          </span>
        ))}
      </div>

      {diaAberto && (
        <DiaCalendarioModal
          dia={diaAberto}
          atividades={porDiaVisivel.get(diaAberto) ?? []}
          tecnicos={tecnicosPorId}
          aoFechar={() => setDiaAberto(null)}
          aoAbrirOrdem={(id) => {
            setDiaAberto(null);
            setOrdemAberta(id);
          }}
          aoAbrirLinhaDoTempo={() => navigate(`/linha-do-tempo?dia=${diaAberto}`)}
          aoNovaAtividade={() => {
            setNovaNoDia(diaAberto);
            setDiaAberto(null);
          }}
        />
      )}

      {novaNoDia && (
        <NovaAtividadeModal
          dia={novaNoDia}
          tecnicos={tecnicosAtivos}
          aoFechar={() => setNovaNoDia(null)}
          aoSalvo={() => {
            setNovaNoDia(null);
            c.recarregar();
          }}
        />
      )}
    </div>
  );
}
