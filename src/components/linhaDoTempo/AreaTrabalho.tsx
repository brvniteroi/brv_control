import { useCallback, useMemo, useRef } from 'react';
import type { AtividadeLinha } from '../../hooks/useLinhaDoTempo';
import type { TecnicoLinha } from '../../services/linhaDoTempo';
import GradeTempo from './GradeTempo';
import { COLUNA_TECNICOS_PX, calcularJanela } from './janela';
import { useArrasto } from './useArrasto';

interface Props {
  dia: string;
  tecnicos: TecnicoLinha[];
  atividades: AtividadeLinha[];
  conflitos: Set<string>;
  pxPorHora: number;
  agoraMin: number | null;
  aoAbrirOrdem: (ordemId: string) => void;
  agendar: (id: string, d: { employee_id: string; scheduled_start: string; scheduled_end: string }) => Promise<void>;
}

/** Grade + o arrasto para mover e redimensionar as atividades. */
export default function AreaTrabalho({ dia, tecnicos, atividades, conflitos, pxPorHora, agoraMin, aoAbrirOrdem, agendar }: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const lanesRef = useRef(new Map<string, HTMLDivElement>());

  const registrarLane = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) lanesRef.current.set(id, el);
    else lanesRef.current.delete(id);
  }, []);

  const janela = useMemo(() => calcularJanela(atividades, dia), [atividades, dia]);

  const { previa, iniciar } = useArrasto({
    dia,
    pxPorMin: pxPorHora / 60,
    atividades,
    lanes: () => [...lanesRef.current].map(([id, el]) => ({ id, rect: el.getBoundingClientRect() })),
    scroller: () => scrollerRef.current,
    larguraColunaTecnicos: COLUNA_TECNICOS_PX,
    aoClicar: (id) => {
      const a = atividades.find((x) => x.id === id);
      if (a) aoAbrirOrdem(a.service_order_id);
    },
    agendar,
  });

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
    </div>
  );
}
