import type { AtividadeLinha } from '../../hooks/useLinhaDoTempo';
import { minutosDoDia } from '../../utils/linhaDoTempo';

export const COLUNA_TECNICOS_PX = 188;

export interface JanelaTempo {
  inicioMin: number;
  fimMin: number;
}

/** Régua padrão 07h-19h; cresce para caber atividades fora desse horário. */
export function calcularJanela(atividades: AtividadeLinha[], dia: string): JanelaTempo {
  let inicio = 7 * 60;
  let fim = 19 * 60;
  for (const a of atividades) {
    if (!a.scheduled_start || !a.scheduled_end) continue;
    inicio = Math.min(inicio, Math.max(0, minutosDoDia(a.scheduled_start, dia)));
    fim = Math.max(fim, Math.min(1440, minutosDoDia(a.scheduled_end, dia)));
  }
  return { inicioMin: Math.floor(inicio / 60) * 60, fimMin: Math.ceil(fim / 60) * 60 };
}
