import type { ServiceOrderPriority, ServiceOrderStatus, TaskStatus } from '../types/fsm';

export const STATUS_OS: { valor: ServiceOrderStatus; rotulo: string; classe: string }[] = [
  { valor: 'aberta', rotulo: 'Aberta', classe: 'bg-slate-100 text-slate-700 border-slate-200' },
  { valor: 'agendada', rotulo: 'Agendada', classe: 'bg-blue-50 text-blue-700 border-blue-100' },
  { valor: 'em_andamento', rotulo: 'Em andamento', classe: 'bg-amber-50 text-amber-700 border-amber-100' },
  { valor: 'pausada', rotulo: 'Pausada', classe: 'bg-pink-50 text-pink-700 border-pink-100' },
  { valor: 'concluida', rotulo: 'Concluída', classe: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  { valor: 'cancelada', rotulo: 'Cancelada', classe: 'bg-red-50 text-red-700 border-red-100' },
];

export const PRIORIDADES: { valor: ServiceOrderPriority; rotulo: string }[] = [
  { valor: 'baixa', rotulo: 'Baixa' },
  { valor: 'normal', rotulo: 'Normal' },
  { valor: 'alta', rotulo: 'Alta' },
  { valor: 'urgente', rotulo: 'Urgente' },
];

export const STATUS_ATIVIDADE: { valor: TaskStatus; rotulo: string; classe: string }[] = [
  { valor: 'pendente', rotulo: 'Pendente', classe: 'bg-slate-100 text-slate-700 border-slate-200' },
  { valor: 'agendada', rotulo: 'Agendada', classe: 'bg-blue-50 text-blue-700 border-blue-100' },
  { valor: 'em_deslocamento', rotulo: 'Em deslocamento', classe: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  { valor: 'em_execucao', rotulo: 'Em execução', classe: 'bg-amber-50 text-amber-700 border-amber-100' },
  { valor: 'pausada', rotulo: 'Pausada', classe: 'bg-pink-50 text-pink-700 border-pink-100' },
  { valor: 'concluida', rotulo: 'Concluída', classe: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  { valor: 'cancelada', rotulo: 'Cancelada', classe: 'bg-red-50 text-red-700 border-red-100' },
];

export const infoStatusOS = (s: ServiceOrderStatus) => STATUS_OS.find((x) => x.valor === s) ?? STATUS_OS[0];
export const infoStatusAtividade = (s: TaskStatus) => STATUS_ATIVIDADE.find((x) => x.valor === s) ?? STATUS_ATIVIDADE[0];

const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const soData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

export const formatarDataHora = (iso: string | null | undefined) => (iso ? dataHora.format(new Date(iso)) : '—');
export const formatarData = (iso: string | null | undefined) => (iso ? soData.format(new Date(iso)) : '—');

const dois = (n: number) => String(n).padStart(2, '0');

/** ISO -> valores dos campos <input type="date"> e <input type="time"> no fuso do aparelho. */
export function paraCamposDataHora(iso: string | null): { data: string; hora: string } {
  if (!iso) return { data: '', hora: '' };
  const d = new Date(iso);
  return {
    data: `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`,
    hora: `${dois(d.getHours())}:${dois(d.getMinutes())}`,
  };
}

/** Campos de data e hora (fuso do aparelho) -> ISO. */
export function deCamposDataHora(data: string, hora: string): string | null {
  if (!data) return null;
  const d = new Date(`${data}T${hora || '08:00'}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
