import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  agendarAtividade,
  listarAtividadesDoDia,
  listarTecnicosLinha,
  type OrdemLinha,
  type TecnicoLinha,
} from '../services/linhaDoTempo';
import type { Task } from '../types/fsm';
import { atividadesEmConflito, limitesDoDia, podeMover } from '../utils/linhaDoTempo';
import { useOrdensDasAtividades } from './useOrdensDasAtividades';
import { useRealtimeTable } from './useRealtimeTable';

export interface AtividadeLinha extends Task {
  /** Null só enquanto os dados da OS ainda estão chegando. */
  ordem: OrdemLinha | null;
}

/**
 * Tudo que a tela da Linha do tempo precisa para um dia (`dia` = YYYY-MM-DD, fuso local):
 * técnicos, atividades do dia, conflitos de horário e a ação de mover.
 * Mantém tudo em tempo real (Realtime) e faz atualização otimista ao arrastar.
 */
export function useLinhaDoTempo(dia: string) {
  const { inicio, fim } = useMemo(() => limitesDoDia(dia), [dia]);

  const [tecnicos, setTecnicos] = useState<TecnicoLinha[]>([]);
  const [erroTecnicos, setErroTecnicos] = useState<string | null>(null);
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

  const { ordens, recarregarOrdens } = useOrdensDasAtividades(doDia.linhas, setErroAcao);

  const atividades = useMemo<AtividadeLinha[]>(
    () => doDia.linhas.map((t) => ({ ...t, ordem: ordens[t.service_order_id] ?? null })),
    [doDia.linhas, ordens],
  );
  const conflitos = useMemo(() => atividadesEmConflito(doDia.linhas), [doDia.linhas]);

  /**
   * Muda o técnico e o horário da atividade.
   * Atualiza a tela na hora e desfaz se o banco recusar; nesse caso lança Error em português.
   */
  const agendar = useCallback(
    async (id: string, d: { employee_id: string; scheduled_start: string; scheduled_end: string }) => {
      setErroAcao(null);
      const original = doDia.linhas.find((t) => t.id === id);
      if (!original || !podeMover(original)) throw new Error('Esta atividade não pode ser movida.');
      const otimista: Task = { ...original, ...d };

      doDia.setLinhas((atual) => atual.map((t) => (t.id === id ? otimista : t)));
      try {
        const salvo = await agendarAtividade(id, d);
        doDia.setLinhas((atual) => atual.map((t) => (t.id === id ? salvo : t)));
      } catch (e) {
        doDia.setLinhas((atual) => atual.map((t) => (t.id === id ? original : t)));
        const mensagem = e instanceof Error ? e.message : String(e);
        setErroAcao(mensagem);
        throw new Error(mensagem);
      }
    },
    [doDia],
  );

  return {
    tecnicos,
    atividades,
    /** Ids das atividades que se sobrepõem a outra do mesmo técnico. */
    conflitos,
    carregando: doDia.carregando,
    /** Falha ao carregar (mostrar com "Tentar de novo" = `recarregar`). */
    erro: doDia.erro ?? erroTecnicos,
    /** Falha de uma ação (mover); a tela já voltou ao estado anterior. */
    erroAcao,
    limparErroAcao: () => setErroAcao(null),
    agendar,
    /** Botão "Atualizar": recarrega tudo do banco. */
    recarregar: () => {
      carregarTecnicos();
      recarregarOrdens();
      void doDia.recarregar();
    },
  };
}
