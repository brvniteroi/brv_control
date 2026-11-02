import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Clock, Lock, MapPin, RefreshCw } from 'lucide-react';
import { supabase } from '../../services/supabase';
import {
  bloqueioDeInicio,
  carregarMinhaAgenda,
  enderecoDaAtividade,
  lerCacheAgenda,
  salvarCacheAgenda,
  somenteDeHoje,
  type AtividadeCampo,
} from '../../services/campo';
import { comPendentes } from '../../services/filaCampo';
import { useContextoCampo } from '../../components/campo/contextoCampo';
import { useFilaCampo } from '../../hooks/useCampo';
import { infoStatusAtividade } from '../../utils/ordens';

const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const diaLongo = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });

export default function CampoAgenda() {
  const { colaborador } = useContextoCampo();
  const fila = useFilaCampo();
  const [atividades, setAtividades] = useState<AtividadeCampo[]>(() => lerCacheAgenda(colaborador.id)?.itens ?? []);
  const [carregando, setCarregando] = useState(true);
  const [cacheDe, setCacheDe] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ultima = useRef(0);
  const [hoje] = useState(() => new Date());

  const carregar = useCallback(async () => {
    const req = ++ultima.current;
    setCarregando(true);
    try {
      const dados = await carregarMinhaAgenda(colaborador.id);
      if (req !== ultima.current) return;
      setAtividades(dados);
      salvarCacheAgenda(colaborador.id, dados);
      setCacheDe(null);
      setErro(null);
    } catch (e) {
      if (req !== ultima.current) return;
      const cache = lerCacheAgenda(colaborador.id);
      if (cache) {
        setAtividades(cache.itens);
        setCacheDe(cache.em);
      } else {
        setErro(e instanceof Error ? e.message : 'Não foi possível carregar a agenda.');
      }
    } finally {
      if (req === ultima.current) setCarregando(false);
    }
  }, [colaborador.id]);

  // Carrega e acompanha mudanças do escritório (nova atividade, reagendamento) em tempo real
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const canal = supabase
      .channel(`campo:agenda:${colaborador.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        clearTimeout(timer);
        timer = setTimeout(carregar, 600);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') carregar();
      });
    // Carga inicial fora do efeito (sem sinal o canal nunca conecta, e o cache precisa ser conferido)
    const inicial = setTimeout(carregar, 0);
    const aoVoltar = () => document.visibilityState === 'visible' && carregar();
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('online', carregar);
    return () => {
      clearTimeout(inicial);
      clearTimeout(timer);
      supabase.removeChannel(canal);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('online', carregar);
    };
  }, [carregar, colaborador.id]);

  const doDia = useMemo(() => somenteDeHoje(atividades.map((a) => comPendentes(a, fila))), [atividades, fila]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Minha agenda</h1>
          <p className="text-xs capitalize text-slate-500">{diaLongo.format(hoje)}</p>
        </div>
        <button
          type="button"
          onClick={carregar}
          disabled={carregando}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
        >
          <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {cacheDe && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Sem conexão. Mostrando a agenda carregada em {new Date(cacheDe).toLocaleString('pt-BR')}.
        </div>
      )}
      {erro && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</div>}

      <section>
        <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-blue-700">
          Hoje {doDia.length > 0 && <span className="font-semibold text-slate-400">({doDia.length})</span>}
        </h2>
        {doDia.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-6 text-center text-xs text-slate-400">
            {carregando && atividades.length === 0 ? 'Carregando...' : 'Nenhuma atividade para hoje.'}
          </p>
        ) : (
          <div className="space-y-2">
            {doDia.map((a) => (
              <CartaoAtividade
                key={a.id}
                atividade={a}
                pendente={fila.some((i) => i.taskId === a.id)}
                bloqueada={a.status === 'agendada' && bloqueioDeInicio(a, doDia) !== null}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CartaoAtividade({ atividade: a, pendente, bloqueada }: { atividade: AtividadeCampo; pendente: boolean; bloqueada: boolean }) {
  const st = infoStatusAtividade(a.status);
  const end = enderecoDaAtividade(a);
  const cliente = a.ordem?.cliente;
  const inicio = a.scheduled_start ? new Date(a.scheduled_start) : null;
  const fim = a.scheduled_end ? new Date(a.scheduled_end) : null;

  return (
    <Link
      to={`/campo/atividade/${a.id}`}
      className={`flex items-stretch gap-3 rounded-2xl border bg-white p-3.5 shadow-xs active:bg-slate-50 ${
        a.status === 'concluida' ? 'border-slate-200 opacity-70' : a.status === 'em_execucao' ? 'border-orange-300' : 'border-slate-200'
      }`}
    >
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50 py-1 text-center">
        <Clock size={13} className="text-slate-400" />
        <span className="mt-0.5 text-sm font-bold text-slate-900">{inicio ? hora.format(inicio) : '--:--'}</span>
        {fim && <span className="text-[10px] text-slate-400">{hora.format(fim)}</span>}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${st.classe}`}>{st.rotulo}</span>
          {a.ordem && <span className="text-[11px] font-semibold text-slate-400">OS {a.ordem.number}</span>}
          {pendente && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">não enviado</span>}
          {bloqueada && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              <Lock size={10} /> aguarda a anterior
            </span>
          )}
        </div>
        <div className="mt-1 truncate text-sm font-bold text-slate-900">{cliente?.trade_name || cliente?.name || 'Cliente'}</div>
        <div className="truncate text-xs text-slate-600">{a.ordem?.tipo?.name ?? a.title}</div>
        {end && (
          <div className="mt-1 flex items-center gap-1 truncate text-[11px] text-slate-500">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{[end.street, end.number].filter(Boolean).join(', ')}{end.district ? ` - ${end.district}` : ''}</span>
          </div>
        )}
      </div>
      <ChevronRight size={18} className="self-center text-slate-300" />
    </Link>
  );
}
