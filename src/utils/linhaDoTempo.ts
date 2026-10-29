import type { Task } from '../types/fsm';

/** Passo de encaixe ao arrastar/redimensionar (minutos). */
export const PASSO_MINUTOS = 15;

const dois = (n: number) => String(n).padStart(2, '0');

/** Data local (fuso do aparelho) no formato YYYY-MM-DD, o mesmo do <input type="date">. */
export function dataLocal(d: Date = new Date()): string {
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() + n);
  return dataLocal(d);
}

/** Início e fim (00:00 do dia e 00:00 do dia seguinte) em ISO, para filtrar no banco. */
export function limitesDoDia(dia: string): { inicio: string; fim: string } {
  return {
    inicio: new Date(`${dia}T00:00:00`).toISOString(),
    fim: new Date(`${somarDias(dia, 1)}T00:00:00`).toISOString(),
  };
}

/** Minutos desde 00:00 do `dia`, no fuso local (pode passar de 1440 ou ser negativo). */
export function minutosDoDia(iso: string, dia: string): number {
  return Math.round((new Date(iso).getTime() - new Date(`${dia}T00:00:00`).getTime()) / 60000);
}

/** Minutos desde 00:00 do `dia` -> ISO. */
export function isoDoDia(dia: string, minutos: number): string {
  return new Date(new Date(`${dia}T00:00:00`).getTime() + minutos * 60000).toISOString();
}

export function arredondarMinutos(minutos: number, passo = PASSO_MINUTOS): number {
  return Math.round(minutos / passo) * passo;
}

/** "08:30" a partir de minutos desde 00:00. */
export function formatarHora(minutos: number): string {
  const m = ((Math.round(minutos) % 1440) + 1440) % 1440;
  return `${dois(Math.floor(m / 60))}:${dois(m % 60)}`;
}

/** Só atividades ainda não iniciadas podem ser movidas na linha do tempo. */
export function podeMover(t: Pick<Task, 'status'>): boolean {
  return t.status === 'pendente' || t.status === 'agendada';
}

type Agendada = Pick<Task, 'id' | 'employee_id' | 'status' | 'scheduled_start' | 'scheduled_end'>;

/** Ids das atividades que se sobrepõem a outra do mesmo técnico (canceladas não contam). */
export function atividadesEmConflito(atividades: Agendada[]): Set<string> {
  const emConflito = new Set<string>();
  const porTecnico = new Map<string, Agendada[]>();
  for (const a of atividades) {
    if (!a.employee_id || !a.scheduled_start || !a.scheduled_end || a.status === 'cancelada') continue;
    const lista = porTecnico.get(a.employee_id) ?? [];
    lista.push(a);
    porTecnico.set(a.employee_id, lista);
  }
  for (const lista of porTecnico.values()) {
    lista.sort((x, y) => x.scheduled_start!.localeCompare(y.scheduled_start!));
    let anterior: Agendada | null = null;
    for (const a of lista) {
      // `anterior` guarda a que termina mais tarde até agora
      if (anterior && new Date(a.scheduled_start!) < new Date(anterior.scheduled_end!)) {
        emConflito.add(a.id);
        emConflito.add(anterior.id);
        if (new Date(a.scheduled_end!) <= new Date(anterior.scheduled_end!)) continue;
      }
      anterior = a;
    }
  }
  return emConflito;
}
