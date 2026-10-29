import { useCallback, useMemo, useRef } from 'react';
import type { AtividadeLinha } from '../../hooks/useLinhaDoTempo';
import type { TecnicoLinha } from '../../services/linhaDoTempo';
import GradeTempo from './GradeTempo';
import { COLUNA_TECNICOS_PX, calcularJanela, duracaoPrevista } from './janela';
import PainelAAgendar from './PainelAAgendar';
import { useArrasto } from './useArrasto';

interface Props {
  dia: string;
  tecnicos: TecnicoLinha[];
  atividades: AtividadeLinha[];
  aAgendar: AtividadeLinha[];
  conflitos: Set<string>;
  pxPorHora: number;
  painelAberto: boolean;
  agoraMin: number | null;
  aoAbrirOrdem: (ordemId: string) => void;
  agendar: (id: string, d: { employee_id: string; scheduled_start: string; scheduled_end: string }) => Promise<void>;
  desagendar: (id: string) => Promise<void>;
}

/** Grade + painel "A agendar" + o arrasto que liga os dois. */
export default function AreaTrabalho({
  dia, tecnicos, atividades, aAgendar, conflitos, pxPorHora, painelAberto, agoraMin, aoAbrirOrdem, agendar, desagendar,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const painelRef = useRef<HTMLDivElement | null>(null);
  const lanesRef = useRef(new Map<string, HTMLDivElement>());

  const registrarLane = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) lanesRef.current.set(id, el);
    else lanesRef.current.delete(id);
  }, []);

  const janela = useMemo(() => calcularJanela(atividades, dia), [atividades, dia]);

  const { previa, iniciar } = useArrasto({
    dia,
    pxPorMin: pxPorHora / 60,
    janelaInicioMin: janela.inicioMin,
    atividades,
    lanes: () => [...lanesRef.current].map(([id, el]) => ({ id, rect: el.getBoundingClientRect() })),
    painel: () => painelRef.current?.getBoundingClientRect() ?? null,
    scroller: () => scrollerRef.current,
    larguraColunaTecnicos: COLUNA_TECNICOS_PX,
    aoClicar: (id) => {
      const a = atividades.find((x) => x.id === id);
      if (a) aoAbrirOrdem(a.service_order_id);
    },
    agendar,
    desagendar,
  });

  const arrastandoDaFila = previa?.origem === 'fila' ? aAgendar.find((a) => a.id === previa.id) : undefined;

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <GradeTempo
        dia={dia}
        tecnicos={tecnicos}
        atividades={atividades}
        conflitos={conflitos}
        janela={janela}
        pxPorHora={pxPorHora}
        previa={previa}
        agoraMin={agoraMin}
        scrollerRef={scrollerRef}
        registrarLane={registrarLane}
        aoIniciarArrasto={iniciar}
      />

      {painelAberto && (
        <PainelAAgendar
          atividades={aAgendar}
          destacar={!!previa?.sobPainel}
          painelRef={painelRef}
          arrastandoId={previa?.origem === 'fila' ? previa.id : null}
          aoIniciarArrasto={iniciar}
          aoAbrirOrdem={aoAbrirOrdem}
        />
      )}

      {/* Etiqueta que segue o ponteiro ao arrastar da fila */}
      {arrastandoDaFila && previa && (
        <div
          className="pointer-events-none fixed z-50 max-w-60 rounded-lg border border-blue-300 bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-lg"
          style={{ left: previa.x + 14, top: previa.y + 14 }}
        >
          <div className="truncate">{arrastandoDaFila.ordem?.customer?.name ?? arrastandoDaFila.title}</div>
          <div className="text-[11px] font-normal text-slate-500">{duracaoPrevista(arrastandoDaFila)} min</div>
        </div>
      )}
    </div>
  );
}
