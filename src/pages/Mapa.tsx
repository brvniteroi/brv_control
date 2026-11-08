import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Loader2,
  Lock,
  Map as MapaIcone,
  MapPinOff,
  Navigation,
  RefreshCw,
} from 'lucide-react';
import MapaOperacao, { type Foco, type PontoAtividade, type PontoTecnico } from '../components/mapa/MapaOperacao';
import OrdemDetalhes from '../components/ordens/OrdemDetalhes';
import { useAuth } from '../contexts/useAuth';
import { useLinhaDoTempo, type AtividadeLinha } from '../hooks/useLinhaDoTempo';
import { usePosicoesTecnicos } from '../hooks/usePosicoesTecnicos';
import { MINUTOS_ONLINE, usePresencasTecnicos } from '../hooks/usePresencasTecnicos';
import { mapasConfigurados } from '../services/googleMaps';
import type { PosicaoTecnico } from '../services/mapa';
import { alertasAparelhos, type AlertaAparelhos } from '../services/aparelho';
import type { TaskStatus } from '../types/fsm';
import { dataLocal, somarDias } from '../utils/linhaDoTempo';
import { infoStatusAtividade } from '../utils/ordens';

const BOTAO =
  'inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50';

/** Cor do alfinete por status (as mesmas da linha do tempo). */
const COR_STATUS: Record<TaskStatus, string> = {
  agendada: '#2563EB',
  em_deslocamento: '#4F46E5',
  em_execucao: '#EA580C',
  concluida: '#16A34A',
  cancelada: '#FCA5A5',
};

/** Posição mais velha que isso aparece apagada (app fechado, tela apagada ou sem sinal). */
const MINUTOS_POSICAO_RECENTE = 15;
/** Posição mais velha que isso nem aparece (ex.: de ontem). */
const HORAS_POSICAO_VISIVEL = 12;

const COR_SEM_TECNICO = '#94A3B8';

function dataPorExtenso(dia: string): string {
  return new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

const hora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';

function haQuanto(iso: string, agora: number): string {
  const min = Math.max(0, Math.round((agora - Date.parse(iso)) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return `há ${h}h${String(min % 60).padStart(2, '0')}`;
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : (partes[0]?.[1] ?? ''))).toUpperCase();
}

export default function Mapa() {
  const { profile } = useAuth();
  if (profile?.role !== 'admin' && profile?.role !== 'escritorio') {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Lock size={24} />
        </div>
        <h2 className="mt-3 text-base font-bold text-slate-800">Acesso Restrito</h2>
        <p className="mt-1 max-w-sm text-xs text-slate-500">O mapa é restrito aos perfis de escritório e administradores.</p>
      </div>
    );
  }
  if (!mapasConfigurados) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-xs">
        Mapa desativado: falta configurar <code>VITE_GOOGLE_MAPS_API_KEY</code>.
      </div>
    );
  }
  return <MapaEscritorio />;
}

interface GrupoTecnico {
  id: string | null;
  nome: string;
  cor: string;
  posicao: PosicaoTecnico | null;
  atividades: (AtividadeLinha & { ordemDoDia: number })[];
}

/** Bolinha verde = app aberto e com internet agora; cinza = fora do ar (mostra há quanto tempo). */
function IndicadorOnline({ visto, agora }: { visto: string | undefined; agora: number }) {
  const online = !!visto && agora - Date.parse(visto) < MINUTOS_ONLINE * 60000;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
        online ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
      }`}
      title={visto ? `Último sinal do app: ${haQuanto(visto, agora)}` : 'O app ainda não deu sinal'}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {online ? 'Online' : visto ? `Offline · ${haQuanto(visto, agora)}` : 'Offline'}
    </span>
  );
}

function MapaEscritorio() {
  const [dia, setDia] = useState(() => dataLocal());
  const [tecnicoFiltro, setTecnicoFiltro] = useState('');
  const [mostrarConcluidas, setMostrarConcluidas] = useState(true);
  const [foco, setFoco] = useState<Foco | null>(null);
  const [enquadrar, setEnquadrar] = useState(0);
  const [ordemAberta, setOrdemAberta] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  const t = useLinhaDoTempo(dia);
  const { posicoes, erro: erroPosicoes, recarregar: recarregarPosicoes } = usePosicoesTecnicos();
  const presencas = usePresencasTecnicos();
  const ehHoje = dia === dataLocal();

  // Login de técnico usado em 2+ aparelhos nas últimas 24 h (possível senha compartilhada)
  const [alertasLogin, setAlertasLogin] = useState<Record<string, AlertaAparelhos>>({});
  useEffect(() => {
    const ler = () => alertasAparelhos().then(setAlertasLogin);
    void ler();
    const timer = setInterval(ler, 120_000);
    return () => clearInterval(timer);
  }, []);

  // Atualiza o "há X min"
  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Técnicos com atividade no dia ou (hoje) com posição recente, cada um com as atividades na ordem do dia
  const grupos = useMemo<GrupoTecnico[]>(() => {
    const porTecnico = new Map<string | null, AtividadeLinha[]>();
    for (const a of t.atividades) {
      if (a.status === 'cancelada') continue;
      const lista = porTecnico.get(a.employee_id) ?? [];
      lista.push(a);
      porTecnico.set(a.employee_id, lista);
    }
    const posicaoVisivel = (id: string) => {
      const p = posicoes[id];
      return ehHoje && p && agora - Date.parse(p.updated_at) < HORAS_POSICAO_VISIVEL * 3600000 ? p : null;
    };

    const resultado: GrupoTecnico[] = t.tecnicos
      .filter((x) => porTecnico.has(x.id) || posicaoVisivel(x.id))
      .map((x) => ({ id: x.id, nome: x.name, cor: x.timeline_color, posicao: posicaoVisivel(x.id), atividades: [] }));
    // Atividade de quem não está mais na lista de técnicos ativos
    for (const id of porTecnico.keys()) {
      if (!resultado.some((g) => g.id === id)) {
        resultado.push({ id, nome: id ? 'Outro colaborador' : 'Sem técnico', cor: COR_SEM_TECNICO, posicao: null, atividades: [] });
      }
    }
    for (const g of resultado) {
      const lista = [...(porTecnico.get(g.id) ?? [])].sort(
        (a, b) => Date.parse(a.scheduled_start ?? '') - Date.parse(b.scheduled_start ?? '') || (a.id < b.id ? -1 : 1),
      );
      g.atividades = lista.map((a, i) => ({ ...a, ordemDoDia: i + 1 }));
    }
    return resultado;
  }, [t.atividades, t.tecnicos, posicoes, ehHoje, agora]);

  const visiveis = useMemo(
    () =>
      grupos
        .filter((g) => !tecnicoFiltro || g.id === tecnicoFiltro)
        .map((g) => ({ ...g, atividades: g.atividades.filter((a) => mostrarConcluidas || a.status !== 'concluida') })),
    [grupos, tecnicoFiltro, mostrarConcluidas],
  );

  const pontosAtividades = useMemo<PontoAtividade[]>(
    () =>
      visiveis.flatMap((g) =>
        g.atividades.flatMap((a) => {
          const e = a.ordem?.endereco;
          if (!e || e.lat == null || e.lng == null) return [];
          return [
            {
              id: a.id,
              serviceOrderId: a.service_order_id,
              lat: e.lat,
              lng: e.lng,
              cor: COR_STATUS[a.status],
              corTecnico: g.cor,
              rotulo: String(a.ordemDoDia),
              titulo: `OS ${a.ordem?.number ?? ''} · ${a.ordem?.customer?.name ?? 'Cliente'}`,
              linhas: [
                e.texto,
                `${g.nome} · ${hora(a.scheduled_start)}`,
                `${infoStatusAtividade(a.status).rotulo}${a.ordem?.service_type ? ` · ${a.ordem.service_type.name}` : ''}`,
              ],
            },
          ];
        }),
      ),
    [visiveis],
  );

  const pontosTecnicos = useMemo<PontoTecnico[]>(
    () =>
      visiveis.flatMap((g) => {
        const p = g.posicao;
        if (!p || !g.id) return [];
        const emAndamento = g.atividades.find((a) => a.status === 'em_execucao' || a.status === 'em_deslocamento');
        return [
          {
            id: g.id,
            lat: p.latitude,
            lng: p.longitude,
            cor: g.cor,
            iniciais: iniciais(g.nome),
            antigo: agora - Date.parse(p.updated_at) > MINUTOS_POSICAO_RECENTE * 60000,
            titulo: g.nome,
            linhas: [
              `Posição ${haQuanto(p.updated_at, agora)} (${hora(p.updated_at)})`,
              ...(p.accuracy_m != null ? [`Precisão: ~${p.accuracy_m} m`] : []),
              ...(emAndamento
                ? [`${infoStatusAtividade(emAndamento.status).rotulo}: OS ${emAndamento.ordem?.number ?? ''}`]
                : []),
            ],
          },
        ];
      }),
    [visiveis, agora],
  );

  const contagem = useMemo(() => {
    const todas = grupos.filter((g) => !tecnicoFiltro || g.id === tecnicoFiltro).flatMap((g) => g.atividades);
    return {
      porAtender: todas.filter((a) => a.status === 'agendada').length,
      andamento: todas.filter((a) => a.status === 'em_deslocamento' || a.status === 'em_execucao').length,
      concluidas: todas.filter((a) => a.status === 'concluida').length,
    };
  }, [grupos, tecnicoFiltro]);

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

  const focar = (tipo: Foco['tipo'], id: string) => setFoco((f) => ({ tipo, id, vez: (f?.vez ?? 0) + 1 }));
  const erro = t.erro ?? erroPosicoes;

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100vh-8rem)] lg:min-h-[520px]">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mapa</h1>
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

          <select
            value={tecnicoFiltro}
            onChange={(e) => setTecnicoFiltro(e.target.value)}
            aria-label="Técnico"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs focus:outline-none"
          >
            <option value="">Todos os técnicos</option>
            {t.tecnicos.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>

          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={mostrarConcluidas} onChange={(e) => setMostrarConcluidas(e.target.checked)} />
            Concluídas
          </label>

          <button type="button" onClick={() => setEnquadrar((n) => n + 1)} className={BOTAO} title="Mostrar todos os pontos">
            <Crosshair size={14} /> Enquadrar
          </button>
          <button
            type="button"
            onClick={() => {
              t.recarregar();
              recarregarPosicoes();
            }}
            disabled={t.carregando}
            className={BOTAO}
          >
            {t.carregando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Atualizar
          </button>
        </div>
      </div>

      {erro && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle size={14} /> {erro}
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[320px_1fr]">
        {/* Mapa (no celular fica em cima) */}
        <div className="h-[60vh] lg:order-2 lg:h-auto">
          <MapaOperacao
            atividades={pontosAtividades}
            tecnicos={pontosTecnicos}
            foco={foco}
            chaveEnquadrar={`${dia}:${tecnicoFiltro}:${enquadrar}`}
            onAbrirOS={setOrdemAberta}
          />
        </div>

        {/* Lista ao lado */}
        <aside className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-xs lg:order-1">
          <div className="grid grid-cols-3 gap-2 border-b border-slate-100 p-3 text-center">
            <Contador valor={contagem.porAtender} rotulo="Por atender" cor={COR_STATUS.agendada} />
            <Contador valor={contagem.andamento} rotulo="Em andamento" cor={COR_STATUS.em_execucao} />
            <Contador valor={contagem.concluidas} rotulo="Concluídas" cor={COR_STATUS.concluida} />
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            {t.carregando && visiveis.length === 0 ? (
              <div className="flex justify-center py-10">
                <Loader2 size={20} className="animate-spin text-slate-400" />
              </div>
            ) : visiveis.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center text-xs text-slate-400">
                <MapaIcone size={28} className="mb-2" />
                Nenhum atendimento {ehHoje ? 'hoje' : 'neste dia'}.
              </div>
            ) : (
              visiveis.map((g) => (
                <div key={g.id ?? 'sem'} className="rounded-xl border border-slate-100">
                  <button
                    type="button"
                    disabled={!g.posicao || !g.id}
                    onClick={() => g.id && focar('tecnico', g.id)}
                    className="flex w-full items-center gap-2.5 rounded-t-xl bg-slate-50 px-3 py-2 text-left enabled:hover:bg-slate-100"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: g.cor }}
                    >
                      {iniciais(g.nome)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 truncate text-xs font-bold text-slate-800">
                        {g.nome}
                        {g.id && ehHoje && <IndicadorOnline visto={presencas[g.id]} agora={agora} />}
                      </span>
                      {g.id && ehHoje && alertasLogin[g.id] && (
                        <span
                          className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-amber-700"
                          title={`Última troca de aparelho: ${hora(alertasLogin[g.id].ultimaTroca)}. Cada técnico deve usar um celular só; se não foi troca de celular, o login pode ter sido passado para outra pessoa. Troque a senha em Equipe > Usuários e acessos.`}
                        >
                          <AlertTriangle size={11} /> Login usado em {alertasLogin[g.id].aparelhos} aparelhos nas últimas 24 h
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-slate-500">
                        {!ehHoje ? (
                          `${g.atividades.length} ${g.atividades.length === 1 ? 'atendimento' : 'atendimentos'}`
                        ) : g.posicao ? (
                          <>
                            <Navigation
                              size={11}
                              className={
                                agora - Date.parse(g.posicao.updated_at) > MINUTOS_POSICAO_RECENTE * 60000
                                  ? 'text-slate-400'
                                  : 'text-emerald-600'
                              }
                            />
                            Posição {haQuanto(g.posicao.updated_at, agora)}
                          </>
                        ) : (
                          <>
                            <MapPinOff size={11} /> Sem posição hoje
                          </>
                        )}
                      </span>
                    </span>
                  </button>

                  <ul className="divide-y divide-slate-50">
                    {g.atividades.map((a) => {
                      const temPonto = a.ordem?.endereco?.lat != null && a.ordem?.endereco?.lng != null;
                      return (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => (temPonto ? focar('atividade', a.id) : setOrdemAberta(a.service_order_id))}
                            className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-slate-50"
                          >
                            <span
                              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                              style={{ backgroundColor: COR_STATUS[a.status] }}
                            >
                              {a.ordemDoDia}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-semibold text-slate-800">
                                {hora(a.scheduled_start)} · OS {a.ordem?.number ?? '…'} · {a.ordem?.customer?.name ?? ''}
                              </span>
                              <span className="block truncate text-[11px] text-slate-500">
                                {infoStatusAtividade(a.status).rotulo}
                                {a.ordem?.local ? ` · ${a.ordem.local}` : ''}
                              </span>
                              {a.ordem && !temPonto && (
                                <span className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-600">
                                  <MapPinOff size={10} /> Endereço sem localização no mapa
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>

          <p className="border-t border-slate-100 px-3 py-2 text-[10px] leading-snug text-slate-400">
            A posição do técnico vem do celular enquanto o app de campo está aberto. Posição apagada = mais de{' '}
            {MINUTOS_POSICAO_RECENTE} min sem atualizar (app fechado, tela apagada ou sem sinal).
          </p>
        </aside>
      </div>
    </div>
  );
}

function Contador({ valor, rotulo, cor }: { valor: number; rotulo: string; cor: string }) {
  return (
    <div>
      <div className="text-lg font-bold" style={{ color: cor }}>
        {valor}
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{rotulo}</div>
    </div>
  );
}
