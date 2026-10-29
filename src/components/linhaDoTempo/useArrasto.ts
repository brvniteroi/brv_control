import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { AtividadeLinha } from '../../hooks/useLinhaDoTempo';
import { PASSO_MINUTOS, arredondarMinutos, isoDoDia, minutosDoDia } from '../../utils/linhaDoTempo';

export type ModoArrasto = 'mover' | 'inicio' | 'fim';

/** O que está sendo arrastado e de onde veio (minutos desde 00:00 do dia mostrado). */
export interface EspecArrasto {
  id: string;
  origem: 'grade' | 'fila';
  modo: ModoArrasto;
  inicioMin: number;
  fimMin: number;
  employeeId: string | null;
  /** Atividade que não pode ser movida: o ponteiro só serve para clicar. */
  fixo?: boolean;
}

export interface PreviaArrasto {
  id: string;
  origem: 'grade' | 'fila';
  modo: ModoArrasto;
  /** Técnico da linha sob o ponteiro (null = fora das linhas, soltar não faz nada). */
  employeeId: string | null;
  inicioMin: number;
  fimMin: number;
  /** Ponteiro sobre o painel "A agendar" (soltar devolve a atividade à fila). */
  sobPainel: boolean;
  conflito: boolean;
  x: number;
  y: number;
}

interface Opcoes {
  dia: string;
  pxPorMin: number;
  /** Minuto (desde 00:00) em que a régua começa. */
  janelaInicioMin: number;
  atividades: AtividadeLinha[];
  lanes: () => { id: string; rect: DOMRect }[];
  painel: () => DOMRect | null;
  scroller: () => HTMLElement | null;
  larguraColunaTecnicos: number;
  aoClicar: (atividade: string) => void;
  agendar: (id: string, d: { employee_id: string; scheduled_start: string; scheduled_end: string }) => Promise<void>;
  desagendar: (id: string) => Promise<void>;
}

const LIMITE_ARRASTO_PX = 5;
const TOLERANCIA_LINHA_PX = 40;
const BORDA_AUTOSCROLL_PX = 48;

const limitar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

/**
 * Arrastar para mover/redimensionar atividades da grade e agendar as da fila "A agendar".
 * Usa eventos de ponteiro na janela inteira (o arrasto não se perde ao sair do elemento),
 * encaixa em passos de 15 min e só chama `agendar`/`desagendar` ao soltar.
 * Esc cancela. Movimento menor que 5 px é clique.
 */
export function useArrasto(opcoes: Opcoes) {
  const [previa, setPrevia] = useState<PreviaArrasto | null>(null);

  // Os handlers de janela vivem além de um render: leem sempre as opções mais novas
  const opc = useRef(opcoes);
  useEffect(() => {
    opc.current = opcoes;
  });

  const limpezaRef = useRef<(() => void) | null>(null);
  // Se a tela sair do ar no meio do arrasto, tira os ouvintes da janela
  useEffect(() => () => limpezaRef.current?.(), []);

  const iniciar = useCallback((e: ReactPointerEvent, spec: EspecArrasto) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    limpezaRef.current?.();

    const x0 = e.clientX;
    const y0 = e.clientY;
    let ativo = false;
    let ultima: PreviaArrasto | null = null;

    const calcular = (ev: PointerEvent): PreviaArrasto => {
      const o = opc.current;
      const lanes = o.lanes();
      const duracao = spec.fimMin - spec.inicioMin;
      const deltaMin = (ev.clientX - x0) / o.pxPorMin;

      // Linha (técnico) sob o ponteiro; tolera uma margem vertical para não "cair" ao errar a mira
      let melhor: { id: string; distancia: number } | null = null;
      for (const l of lanes) {
        const distancia = ev.clientY < l.rect.top ? l.rect.top - ev.clientY : ev.clientY > l.rect.bottom ? ev.clientY - l.rect.bottom : 0;
        if (!melhor || distancia < melhor.distancia) melhor = { id: l.id, distancia };
      }
      const laneId = melhor && melhor.distancia <= TOLERANCIA_LINHA_PX ? melhor.id : null;

      let inicioMin = spec.inicioMin;
      let fimMin = spec.fimMin;
      let employeeId = spec.employeeId;
      let sobPainel = false;

      if (spec.modo === 'mover') {
        employeeId = laneId;
        const painel = o.painel();
        sobPainel =
          spec.origem === 'grade' &&
          !!painel &&
          ev.clientX >= painel.left && ev.clientX <= painel.right &&
          ev.clientY >= painel.top && ev.clientY <= painel.bottom;

        const ini =
          spec.origem === 'grade'
            ? arredondarMinutos(spec.inicioMin + deltaMin)
            : arredondarMinutos(o.janelaInicioMin + (ev.clientX - (lanes[0]?.rect.left ?? 0)) / o.pxPorMin);
        inicioMin = limitar(ini, 0, 1440 - duracao);
        fimMin = inicioMin + duracao;
      } else if (spec.modo === 'inicio') {
        inicioMin = limitar(arredondarMinutos(spec.inicioMin + deltaMin), 0, spec.fimMin - PASSO_MINUTOS);
      } else {
        fimMin = limitar(arredondarMinutos(spec.fimMin + deltaMin), spec.inicioMin + PASSO_MINUTOS, 1440);
      }

      const conflito =
        !!employeeId &&
        !sobPainel &&
        o.atividades.some((a) => {
          if (a.id === spec.id || a.employee_id !== employeeId || a.status === 'cancelada') return false;
          if (!a.scheduled_start || !a.scheduled_end) return false;
          return inicioMin < minutosDoDia(a.scheduled_end, o.dia) && fimMin > minutosDoDia(a.scheduled_start, o.dia);
        });

      return { id: spec.id, origem: spec.origem, modo: spec.modo, employeeId, inicioMin, fimMin, sobPainel, conflito, x: ev.clientX, y: ev.clientY };
    };

    const autorolar = (ev: PointerEvent) => {
      const o = opc.current;
      const s = o.scroller();
      if (!s) return;
      const r = s.getBoundingClientRect();
      if (ev.clientY < r.top || ev.clientY > r.bottom) return;
      if (ev.clientX > r.right - BORDA_AUTOSCROLL_PX && ev.clientX < r.right + 40) s.scrollLeft += 18;
      else if (ev.clientX < r.left + o.larguraColunaTecnicos + BORDA_AUTOSCROLL_PX && ev.clientX > r.left) s.scrollLeft -= 18;
    };

    const aoMover = (ev: PointerEvent) => {
      if (spec.fixo) return;
      if (!ativo) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < LIMITE_ARRASTO_PX) return;
        ativo = true;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = spec.modo === 'mover' ? 'grabbing' : 'col-resize';
      }
      autorolar(ev);
      ultima = calcular(ev);
      setPrevia(ultima);
    };

    const encerrar = (cancelar: boolean) => {
      limpar();
      setPrevia(null);
      const o = opc.current;

      if (!ativo) {
        if (!cancelar && spec.origem === 'grade') o.aoClicar(spec.id);
        return;
      }
      if (cancelar || !ultima) return;

      if (ultima.sobPainel) {
        o.desagendar(spec.id).catch(() => {}); // o hook já guarda a mensagem de erro
        return;
      }
      if (!ultima.employeeId) return; // soltou fora das linhas
      const inalterado =
        spec.origem === 'grade' &&
        ultima.employeeId === spec.employeeId &&
        ultima.inicioMin === spec.inicioMin &&
        ultima.fimMin === spec.fimMin;
      if (inalterado) return;
      o.agendar(spec.id, {
        employee_id: ultima.employeeId,
        scheduled_start: isoDoDia(o.dia, ultima.inicioMin),
        scheduled_end: isoDoDia(o.dia, ultima.fimMin),
      }).catch(() => {});
    };

    const aoSoltar = () => encerrar(false);
    const aoCancelar = () => encerrar(true);
    const aoTecla = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') encerrar(true);
    };

    function limpar() {
      window.removeEventListener('pointermove', aoMover);
      window.removeEventListener('pointerup', aoSoltar);
      window.removeEventListener('pointercancel', aoCancelar);
      window.removeEventListener('keydown', aoTecla);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      limpezaRef.current = null;
    }

    window.addEventListener('pointermove', aoMover);
    window.addEventListener('pointerup', aoSoltar);
    window.addEventListener('pointercancel', aoCancelar);
    window.addEventListener('keydown', aoTecla);
    limpezaRef.current = limpar;
  }, []);

  return { previa, iniciar };
}
