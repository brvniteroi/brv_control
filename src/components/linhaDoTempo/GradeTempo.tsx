import { memo, useMemo, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { AlertTriangle, Flame } from 'lucide-react';
import type { AtividadeLinha } from '../../hooks/useLinhaDoTempo';
import type { TecnicoLinha } from '../../services/linhaDoTempo';
import { formatarHora, minutosDoDia, podeMover } from '../../utils/linhaDoTempo';
import { COR_STATUS_ATIVIDADE as COR_STATUS } from '../../utils/ordens';
import { COLUNA_TECNICOS_PX, type JanelaTempo } from './janela';
import type { EspecArrasto, PreviaArrasto } from './useArrasto';

const ALTURA_LINHA_PX = 64;
const ID_OUTROS = '__outros';

interface BarraProps {
  atividade: AtividadeLinha;
  dia: string;
  janelaInicioMin: number;
  pxPorMin: number;
  conflito: boolean;
  esmaecida: boolean;
  aoIniciar: (e: ReactPointerEvent, spec: EspecArrasto) => void;
}

const Barra = memo(function Barra({ atividade: a, dia, janelaInicioMin, pxPorMin, conflito, esmaecida, aoIniciar }: BarraProps) {
  const inicioReal = minutosDoDia(a.scheduled_start!, dia);
  const fimReal = minutosDoDia(a.scheduled_end!, dia);
  const esquerda = (Math.max(0, inicioReal) - janelaInicioMin) * pxPorMin;
  const largura = Math.max(18, (Math.min(1440, fimReal) - Math.max(0, inicioReal)) * pxPorMin);
  const movel = podeMover(a);
  const o = a.ordem;
  const spec = (modo: EspecArrasto['modo']): EspecArrasto => ({
    id: a.id,
    origem: 'grade',
    modo,
    inicioMin: inicioReal,
    fimMin: fimReal,
    employeeId: a.employee_id,
    fixo: !movel,
  });

  const detalhes = [o ? `OS ${o.number}` : null, o?.service_type?.name, o?.local].filter(Boolean).join(' · ');
  const dica = [
    `${formatarHora(inicioReal)} – ${formatarHora(fimReal)}`,
    o?.customer?.name,
    detalhes,
    conflito ? 'Conflito de horário com outra atividade do técnico' : null,
    movel ? null : 'Atividade já iniciada: não pode ser movida aqui',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div
      title={dica}
      onPointerDown={(e) => aoIniciar(e, spec('mover'))}
      style={{ left: esquerda, width: largura, touchAction: 'none' }}
      className={`group absolute top-1.5 bottom-1.5 select-none overflow-hidden rounded-lg border-b-4 text-white shadow-sm ${COR_STATUS[a.status]} ${
        movel ? 'cursor-grab' : 'cursor-pointer'
      } ${conflito ? 'ring-2 ring-red-500 ring-offset-1' : ''} ${esmaecida ? 'opacity-30' : ''} ${
        a.status === 'cancelada' ? 'line-through' : ''
      }`}
    >
      <div className="flex h-full flex-col justify-center px-2.5 leading-tight">
        <div className="flex items-center gap-1 text-xs font-bold">
          {conflito && <AlertTriangle size={12} className="shrink-0 text-yellow-300" />}
          {o?.priority === 'urgente' && <Flame size={12} className="shrink-0 text-yellow-300" />}
          <span className="truncate">{o ? (o.customer?.name ?? a.title) : a.title}</span>
        </div>
        {largura > 90 && <div className="truncate text-[11px] text-white/85">{detalhes || a.title}</div>}
      </div>
      {movel && (
        <>
          <div
            onPointerDown={(e) => aoIniciar(e, spec('inicio'))}
            className="absolute inset-y-0 left-0 w-2 cursor-col-resize bg-white/0 transition group-hover:bg-white/30"
          />
          <div
            onPointerDown={(e) => aoIniciar(e, spec('fim'))}
            className="absolute inset-y-0 right-0 w-2 cursor-col-resize bg-white/0 transition group-hover:bg-white/30"
          />
        </>
      )}
    </div>
  );
});

function resumoTecnico(atividades: AtividadeLinha[]): string {
  const validas = atividades.filter((a) => a.status !== 'cancelada' && a.scheduled_start && a.scheduled_end);
  if (validas.length === 0) return 'Livre';
  const min = validas.reduce(
    (s, a) => s + (new Date(a.scheduled_end!).getTime() - new Date(a.scheduled_start!).getTime()) / 60000,
    0,
  );
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  const tempo = m === 0 ? `${h} h` : h === 0 ? `${m} min` : `${h} h ${m}`;
  return `${validas.length} ${validas.length === 1 ? 'atividade' : 'atividades'} · ${tempo}`;
}

interface GradeTempoProps {
  dia: string;
  tecnicos: TecnicoLinha[];
  atividades: AtividadeLinha[];
  conflitos: Set<string>;
  janela: JanelaTempo;
  pxPorHora: number;
  previa: PreviaArrasto | null;
  agoraMin: number | null;
  scrollerRef: RefObject<HTMLDivElement | null>;
  registrarLane: (id: string, el: HTMLDivElement | null) => void;
  aoIniciarArrasto: (e: ReactPointerEvent, spec: EspecArrasto) => void;
}

export default function GradeTempo({
  dia, tecnicos, atividades, conflitos, janela, pxPorHora, previa, agoraMin, scrollerRef, registrarLane, aoIniciarArrasto,
}: GradeTempoProps) {
  const pxPorMin = pxPorHora / 60;
  const larguraTotal = (janela.fimMin - janela.inicioMin) * pxPorMin;
  const horas = Array.from({ length: (janela.fimMin - janela.inicioMin) / 60 }, (_, i) => janela.inicioMin / 60 + i);

  const linhas = useMemo(() => {
    const ids = new Set(tecnicos.map((t) => t.id));
    const porTecnico = new Map<string, AtividadeLinha[]>();
    const outros: AtividadeLinha[] = [];
    for (const a of atividades) {
      if (a.employee_id && ids.has(a.employee_id)) {
        const l = porTecnico.get(a.employee_id) ?? [];
        l.push(a);
        porTecnico.set(a.employee_id, l);
      } else {
        outros.push(a);
      }
    }
    const lista = tecnicos.map((t) => ({ ...t, atividades: porTecnico.get(t.id) ?? [], somenteLeitura: false }));
    // Atividades de colaborador inativo (ou sem técnico) continuam visíveis, mas não recebem soltar
    if (outros.length > 0) {
      lista.push({ id: ID_OUTROS, name: 'Outros colaboradores', timeline_color: '#94A3B8', atividades: outros, somenteLeitura: true });
    }
    return lista;
  }, [tecnicos, atividades]);

  const fundoHoras = {
    backgroundImage: 'linear-gradient(to right, #E2E8F0 1px, transparent 1px)',
    backgroundSize: `${pxPorHora}px 100%`,
  };

  return (
    <div ref={scrollerRef} className="relative min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
      <div className="relative" style={{ width: COLUNA_TECNICOS_PX + larguraTotal, minWidth: '100%' }}>
        {/* Régua de horas */}
        <div className="sticky top-0 z-30 flex border-b border-slate-200 bg-slate-50">
          <div
            className="sticky left-0 z-40 shrink-0 border-r border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            style={{ width: COLUNA_TECNICOS_PX }}
          >
            Técnicos
          </div>
          <div className="flex" style={{ width: larguraTotal }}>
            {horas.map((h) => (
              <div
                key={h}
                className="shrink-0 border-l border-slate-200 px-1.5 py-2 text-xs font-semibold text-slate-500 first:border-l-0"
                style={{ width: pxPorHora }}
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
        </div>

        {/* Linhas dos técnicos */}
        {linhas.map((t) => {
          const ordenadas = [...t.atividades].sort((x, y) => x.scheduled_start!.localeCompare(y.scheduled_start!));
          const ativas = ordenadas.filter((a) => a.status !== 'cancelada');
          const sombra = previa && previa.employeeId === t.id ? previa : null;
          return (
            <div key={t.id} className="flex border-b border-slate-200" style={{ height: ALTURA_LINHA_PX }}>
              <div
                className="sticky left-0 z-20 flex shrink-0 items-center gap-2.5 border-r border-slate-200 bg-white px-3"
                style={{ width: COLUNA_TECNICOS_PX }}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: t.timeline_color }}
                >
                  {t.name.trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">{t.name}</div>
                  <div className="truncate text-[11px] text-slate-500">{resumoTecnico(t.atividades)}</div>
                </div>
              </div>

              <div
                ref={t.somenteLeitura ? undefined : (el) => registrarLane(t.id, el)}
                className={`relative shrink-0 ${previa && previa.employeeId === t.id ? 'bg-blue-50/60' : ''}`}
                style={{ width: larguraTotal, ...fundoHoras }}
              >
                {/* Tempo livre entre duas atividades do mesmo técnico */}
                {ativas.slice(1).map((a, i) => {
                  const fimAnterior = Math.min(1440, minutosDoDia(ativas[i].scheduled_end!, dia));
                  const inicio = Math.max(0, minutosDoDia(a.scheduled_start!, dia));
                  if (inicio <= fimAnterior) return null;
                  return (
                    <div
                      key={`vao-${a.id}`}
                      className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded bg-slate-200"
                      style={{ left: (fimAnterior - janela.inicioMin) * pxPorMin, width: (inicio - fimAnterior) * pxPorMin }}
                    />
                  );
                })}

                {t.atividades.map((a) => (
                  <Barra
                    key={a.id}
                    atividade={a}
                    dia={dia}
                    janelaInicioMin={janela.inicioMin}
                    pxPorMin={pxPorMin}
                    conflito={conflitos.has(a.id)}
                    esmaecida={previa?.id === a.id && previa.origem === 'grade'}
                    aoIniciar={aoIniciarArrasto}
                  />
                ))}

                {/* Sombra de onde a atividade vai ficar */}
                {sombra && (
                  <div
                    className={`pointer-events-none absolute top-1.5 bottom-1.5 z-10 flex items-start rounded-lg border-2 border-dashed ${
                      sombra.conflito ? 'border-red-500 bg-red-100/70' : 'border-blue-500 bg-blue-100/70'
                    }`}
                    style={{
                      left: (sombra.inicioMin - janela.inicioMin) * pxPorMin,
                      width: Math.max(18, (sombra.fimMin - sombra.inicioMin) * pxPorMin),
                    }}
                  >
                    <span
                      className={`-mt-6 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-bold text-white ${
                        sombra.conflito ? 'bg-red-600' : 'bg-blue-600'
                      }`}
                    >
                      {formatarHora(sombra.inicioMin)} – {formatarHora(sombra.fimMin)}
                      {sombra.conflito ? ' · conflito' : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {linhas.length === 0 && (
          <div className="p-10 text-center text-sm text-slate-500">
            Nenhum técnico ativo. Cadastre em Equipe &gt; Colaboradores.
          </div>
        )}

        {/* Linha do "agora" */}
        {agoraMin !== null && agoraMin >= janela.inicioMin && agoraMin <= janela.fimMin && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-10 border-l-2 border-dotted border-green-600"
            style={{ left: COLUNA_TECNICOS_PX + (agoraMin - janela.inicioMin) * pxPorMin }}
          />
        )}
      </div>
    </div>
  );
}
