import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { buscarOrdensLinha, type OrdemLinha } from '../services/linhaDoTempo';
import type { Task } from '../types/fsm';

/**
 * Dados das OS (número, cliente, tipo, local, etiquetas) das atividades da tela, por id da OS.
 * Vêm separados porque o Realtime só entrega a linha de `tasks`; só busca as que faltam.
 * Mudança na OS ou nas etiquetas dela (de qualquer usuário) busca aquela OS de novo.
 */
export function useOrdensDasAtividades(atividades: Task[], aoErro: (mensagem: string) => void) {
  const [ordens, setOrdens] = useState<Record<string, OrdemLinha>>({});
  const ordensRef = useRef(ordens);
  const buscando = useRef(new Set<string>());
  const aoErroRef = useRef(aoErro);
  useEffect(() => {
    aoErroRef.current = aoErro;
    ordensRef.current = ordens;
  });

  const buscar = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    ids.forEach((id) => buscando.current.add(id));
    buscarOrdensLinha(ids)
      .then((lista) => setOrdens((atual) => ({ ...atual, ...Object.fromEntries(lista.map((o) => [o.id, o])) })))
      .catch((e) => aoErroRef.current(e instanceof Error ? e.message : String(e)))
      .finally(() => ids.forEach((id) => buscando.current.delete(id)));
  }, []);

  useEffect(() => {
    const ids = [
      ...new Set(atividades.map((t) => t.service_order_id).filter((id) => !ordens[id] && !buscando.current.has(id))),
    ];
    buscar(ids);
  }, [atividades, ordens, buscar]);

  // Só rebusca OS que já estão na tela (o old do DELETE traz a chave primária: service_order_id vem junto)
  useEffect(() => {
    const rebuscar = (id: unknown) => {
      if (typeof id === 'string' && ordensRef.current[id]) buscar([id]);
    };
    const canal = supabase
      .channel(`rt:ordens-linha:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_order_tags' }, (ev) => {
        const linha = (ev.eventType === 'DELETE' ? ev.old : ev.new) as { service_order_id?: string };
        rebuscar(linha.service_order_id);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'service_orders' }, (ev) => {
        rebuscar((ev.new as { id?: string }).id);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [buscar]);

  /** Busca de novo todas as OS já carregadas (botão "Atualizar", volta da tela da OS). */
  const recarregarOrdens = useCallback(() => buscar(Object.keys(ordensRef.current)), [buscar]);

  return { ordens, recarregarOrdens };
}
