import { useEffect, useRef, useState } from 'react';
import { buscarOrdensLinha, type OrdemLinha } from '../services/linhaDoTempo';
import type { Task } from '../types/fsm';

/**
 * Dados das OS (número, cliente, tipo, local) das atividades da tela, por id da OS.
 * Vêm separados porque o Realtime só entrega a linha de `tasks`; só busca as que faltam.
 */
export function useOrdensDasAtividades(atividades: Task[], aoErro: (mensagem: string) => void) {
  const [ordens, setOrdens] = useState<Record<string, OrdemLinha>>({});
  const buscando = useRef(new Set<string>());
  const aoErroRef = useRef(aoErro);
  useEffect(() => {
    aoErroRef.current = aoErro;
  });

  useEffect(() => {
    const ids = [
      ...new Set(atividades.map((t) => t.service_order_id).filter((id) => !ordens[id] && !buscando.current.has(id))),
    ];
    if (ids.length === 0) return;
    ids.forEach((id) => buscando.current.add(id));
    buscarOrdensLinha(ids)
      .then((lista) => setOrdens((atual) => ({ ...atual, ...Object.fromEntries(lista.map((o) => [o.id, o])) })))
      .catch((e) => aoErroRef.current(e instanceof Error ? e.message : String(e)))
      .finally(() => ids.forEach((id) => buscando.current.delete(id)));
  }, [atividades, ordens]);

  return ordens;
}
