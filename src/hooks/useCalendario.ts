import { useCallback, useEffect, useMemo, useState } from 'react';
import { listarAtividadesDoDia, listarColaboradoresCores } from '../services/linhaDoTempo';
import type { Task } from '../types/fsm';
import { dataLocal, limitesDoDia, somarDias } from '../utils/linhaDoTempo';
import type { AtividadeLinha } from './useLinhaDoTempo';
import { useOrdensDasAtividades } from './useOrdensDasAtividades';
import { useRealtimeTable } from './useRealtimeTable';

/** Dias (YYYY-MM-DD) da grade do mês `mes` (YYYY-MM): semanas completas, de domingo a sábado. */
export function diasDaGrade(mes: string): string[] {
  const primeiro = `${mes}-01`;
  const inicio = somarDias(primeiro, -new Date(`${primeiro}T12:00:00`).getDay());
  const ultimo = somarDias(`${somarMeses(mes, 1)}-01`, -1);
  const fim = somarDias(ultimo, 6 - new Date(`${ultimo}T12:00:00`).getDay());
  const dias: string[] = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

/** "2026-10" + 1 = "2026-11". */
export function somarMeses(mes: string, n: number): string {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(ano, m - 1 + n, 1);
  return dataLocal(d).slice(0, 7);
}

/**
 * Atividades agendadas no mês do calendário (grade inteira, inclusive os dias do mês vizinho),
 * agrupadas pelo dia do início, em tempo real.
 */
export function useCalendario(mes: string) {
  const dias = useMemo(() => diasDaGrade(mes), [mes]);
  const inicio = limitesDoDia(dias[0]).inicio;
  const fim = limitesDoDia(dias[dias.length - 1]).fim;

  const [colaboradores, setColaboradores] = useState<Awaited<ReturnType<typeof listarColaboradoresCores>>>([]);
  const [erroColaboradores, setErroColaboradores] = useState<string | null>(null);
  const [erroOrdens, setErroOrdens] = useState<string | null>(null);

  const carregarColaboradores = useCallback(() => {
    listarColaboradoresCores()
      .then((c) => {
        setColaboradores(c);
        setErroColaboradores(null);
      })
      .catch((e) => setErroColaboradores(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(carregarColaboradores, [carregarColaboradores]);

  const doMes = useRealtimeTable<Task>(
    'tasks',
    `calendario:${mes}`,
    () => listarAtividadesDoDia(inicio, fim),
    (t) => !!t.scheduled_start && Date.parse(t.scheduled_start) >= Date.parse(inicio) && Date.parse(t.scheduled_start) < Date.parse(fim),
  );
  const ordens = useOrdensDasAtividades(doMes.linhas, setErroOrdens);

  /** Atividades por dia (YYYY-MM-DD do início, fuso local), em ordem de horário. */
  const porDia = useMemo(() => {
    const mapa = new Map<string, AtividadeLinha[]>();
    const ordenadas = [...doMes.linhas]
      .filter((t) => t.scheduled_start)
      .sort((a, b) => a.scheduled_start!.localeCompare(b.scheduled_start!));
    for (const t of ordenadas) {
      const dia = dataLocal(new Date(t.scheduled_start!));
      const lista = mapa.get(dia) ?? [];
      lista.push({ ...t, ordem: ordens[t.service_order_id] ?? null });
      mapa.set(dia, lista);
    }
    return mapa;
  }, [doMes.linhas, ordens]);

  return {
    dias,
    porDia,
    colaboradores,
    carregando: doMes.carregando,
    erro: doMes.erro ?? erroColaboradores ?? erroOrdens,
    recarregar: () => {
      carregarColaboradores();
      setErroOrdens(null);
      void doMes.recarregar();
    },
  };
}
