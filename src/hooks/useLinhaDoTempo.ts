import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  agendarAtividade,
  buscarOrdensLinha,
  desagendarAtividade,
  listarAtividadesDoDia,
  listarAtividadesSemHorario,
  listarTecnicosLinha,
  type OrdemLinha,
  type TecnicoLinha,
} from '../services/linhaDoTempo';
import type { Task } from '../types/fsm';
import { atividadesEmConflito, limitesDoDia, podeMover } from '../utils/linhaDoTempo';
import { useRealtimeTable } from './useRealtimeTable';

export interface AtividadeLinha extends Task {
  /** Null só enquanto os dados da OS ainda estão chegando. */
  ordem: OrdemLinha | null;
}

/**
 * Tudo que a tela da Linha do tempo precisa para um dia (`dia` = YYYY-MM-DD, fuso local):
 * técnicos, atividades do dia, fila "a agendar", conflitos de horário e ações de mover.
 * Mantém tudo em tempo real (Realtime) e faz atualização otimista ao arrastar.
 */
export function useLinhaDoTempo(dia: string) {
  const { inicio, fim } = useMemo(() => limitesDoDia(dia), [dia]);

  const [tecnicos, setTecnicos] = useState<TecnicoLinha[]>([]);
  const [erroTecnicos, setErroTecnicos] = useState<string | null>(null);
  const [ordens, setOrdens] = useState<Record<string, OrdemLinha>>({});
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const carregarTecnicos = useCallback(() => {
    listarTecnicosLinha()
      .then((t) => {
        setTecnicos(t);
        setErroTecnicos(null);
      })
      .catch((e) => setErroTecnicos(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(carregarTecnicos, [carregarTecnicos]);

  const doDia = useRealtimeTable<Task>(
    'tasks',
    `dia:${dia}`,
    () => listarAtividadesDoDia(inicio, fim),
    (t) =>
      !!t.scheduled_start &&
      !!t.scheduled_end &&
      Date.parse(t.scheduled_start) < Date.parse(fim) &&
      Date.parse(t.scheduled_end) > Date.parse(inicio),
  );

  const semHorario = useRealtimeTable<Task>(
    'tasks',
    'sem-horario',
    listarAtividadesSemHorario,
    (t) => t.scheduled_start === null && t.status !== 'concluida' && t.status !== 'cancelada',
  );

  // Dados das OS (número, cliente...) vêm separados: o Realtime só entrega a linha de `tasks`.
  const buscando = useRef(new Set<string>());
  useEffect(() => {
    const faltam = [...doDia.linhas, ...semHorario.linhas]
      .map((t) => t.service_order_id)
      .filter((id) => !ordens[id] && !buscando.current.has(id));
    const ids = [...new Set(faltam)];
    if (ids.length === 0) return;
    ids.forEach((id) => buscando.current.add(id));
    buscarOrdensLinha(ids)
      .then((lista) => setOrdens((atual) => ({ ...atual, ...Object.fromEntries(lista.map((o) => [o.id, o])) })))
      .catch((e) => setErroAcao(e instanceof Error ? e.message : String(e)))
      .finally(() => ids.forEach((id) => buscando.current.delete(id)));
  }, [doDia.linhas, semHorario.linhas, ordens]);

  const atividades = useMemo<AtividadeLinha[]>(
    () => doDia.linhas.map((t) => ({ ...t, ordem: ordens[t.service_order_id] ?? null })),
    [doDia.linhas, ordens],
  );
  const aAgendar = useMemo<AtividadeLinha[]>(
    () => semHorario.linhas.map((t) => ({ ...t, ordem: ordens[t.service_order_id] ?? null })),
    [semHorario.linhas, ordens],
  );
  const conflitos = useMemo(() => atividadesEmConflito(doDia.linhas), [doDia.linhas]);

  /**
   * Põe a atividade (da grade ou da fila "a agendar") num técnico e horário.
   * Atualiza a tela na hora e desfaz se o banco recusar; nesse caso lança Error em português.
   */
  const agendar = useCallback(
    async (id: string, d: { employee_id: string; scheduled_start: string; scheduled_end: string }) => {
      setErroAcao(null);
      const original = [...doDia.linhas, ...semHorario.linhas].find((t) => t.id === id);
      if (!original || !podeMover(original)) throw new Error('Esta atividade não pode ser movida.');
      const otimista: Task = { ...original, ...d, status: 'agendada' };

      doDia.setLinhas((atual) =>
        atual.some((t) => t.id === id) ? atual.map((t) => (t.id === id ? otimista : t)) : [...atual, otimista],
      );
      semHorario.setLinhas((atual) => atual.filter((t) => t.id !== id));
      try {
        const salvo = await agendarAtividade(id, d);
        doDia.setLinhas((atual) => atual.map((t) => (t.id === id ? salvo : t)));
      } catch (e) {
        doDia.setLinhas((atual) =>
          original.scheduled_start ? atual.map((t) => (t.id === id ? original : t)) : atual.filter((t) => t.id !== id),
        );
        if (!original.scheduled_start) semHorario.setLinhas((atual) => [...atual, original]);
        const mensagem = e instanceof Error ? e.message : String(e);
        setErroAcao(mensagem);
        throw new Error(mensagem);
      }
    },
    [doDia, semHorario],
  );

  /** Tira a atividade da grade e devolve para a fila "a agendar". */
  const desagendar = useCallback(
    async (id: string) => {
      setErroAcao(null);
      const original = doDia.linhas.find((t) => t.id === id);
      if (!original || !podeMover(original)) throw new Error('Esta atividade não pode ser movida.');
      doDia.setLinhas((atual) => atual.filter((t) => t.id !== id));
      semHorario.setLinhas((atual) => [
        ...atual,
        { ...original, scheduled_start: null, scheduled_end: null, status: 'pendente' },
      ]);
      try {
        await desagendarAtividade(id);
      } catch (e) {
        doDia.setLinhas((atual) => [...atual, original]);
        semHorario.setLinhas((atual) => atual.filter((t) => t.id !== id));
        const mensagem = e instanceof Error ? e.message : String(e);
        setErroAcao(mensagem);
        throw new Error(mensagem);
      }
    },
    [doDia, semHorario],
  );

  return {
    tecnicos,
    atividades,
    aAgendar,
    /** Ids das atividades que se sobrepõem a outra do mesmo técnico. */
    conflitos,
    carregando: doDia.carregando || semHorario.carregando,
    /** Falha ao carregar (mostrar com "Tentar de novo" = `recarregar`). */
    erro: doDia.erro ?? semHorario.erro ?? erroTecnicos,
    /** Falha de uma ação (mover/agendar); a tela já voltou ao estado anterior. */
    erroAcao,
    limparErroAcao: () => setErroAcao(null),
    agendar,
    desagendar,
    /** Botão "Atualizar": recarrega tudo do banco. */
    recarregar: () => {
      carregarTecnicos();
      void doDia.recarregar();
      void semHorario.recarregar();
    },
  };
}
