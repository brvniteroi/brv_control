import type { AtividadeLinha } from '../../hooks/useLinhaDoTempo';
import type { TecnicoLinha } from '../../services/linhaDoTempo';
import { infoStatusAtividade } from '../../utils/ordens';

const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function horaDe(iso: string | null): string {
  return iso ? hora.format(new Date(iso)) : '--:--';
}

/** Texto do "title" (dica do navegador) de uma atividade. */
export function dicaAtividade(a: AtividadeLinha, tecnico: TecnicoLinha | undefined): string {
  const o = a.ordem;
  return [
    `${horaDe(a.scheduled_start)} – ${horaDe(a.scheduled_end)}`,
    o?.customer?.name ?? a.title,
    [o ? `OS ${o.number}` : null, o?.service_type?.name, o?.local].filter(Boolean).join(' · '),
    `Técnico: ${tecnico?.name ?? 'a distribuir'}`,
    `Situação: ${infoStatusAtividade(a.status).rotulo}`,
  ]
    .filter(Boolean)
    .join('\n');
}
