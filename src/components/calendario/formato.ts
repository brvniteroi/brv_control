import type { AtividadeLinha } from '../../hooks/useLinhaDoTempo';
import type { TecnicoLinha } from '../../services/linhaDoTempo';
import { infoStatusAtividade } from '../../utils/ordens';
import { semAcento } from '../../services/clientes';
import { dicaEtiquetas } from '../../services/etiquetas';

const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function horaDe(iso: string | null): string {
  return iso ? hora.format(new Date(iso)) : '--:--';
}

/** Termo digitado na busca, pronto para `bateBusca` (vazio = sem busca). */
export function termoBusca(texto: string): string {
  return semAcento(texto.trim());
}

/** A atividade é de um cliente cujo nome contém o termo (sem diferenciar acento nem maiúscula). */
export function bateBusca(a: AtividadeLinha, termo: string): boolean {
  return !!termo && semAcento(a.ordem?.customer?.name ?? a.title).includes(termo);
}

/** As que batem com a busca vêm primeiro (cada grupo mantém o horário), para não ficarem escondidas no "Ver mais". */
export function ordenarPelaBusca(atividades: AtividadeLinha[], termo: string): AtividadeLinha[] {
  if (!termo) return atividades;
  return [...atividades.filter((a) => bateBusca(a, termo)), ...atividades.filter((a) => !bateBusca(a, termo))];
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
    dicaEtiquetas(o?.etiquetas),
  ]
    .filter(Boolean)
    .join('\n');
}
