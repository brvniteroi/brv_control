import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { listarPosicoes, type PosicaoTecnico } from '../services/mapa';

/**
 * Última posição de cada técnico, por id do colaborador, em tempo real.
 * (Não usa useRealtimeTable porque a chave da tabela é employee_id, não id.)
 */
export function usePosicoesTecnicos() {
  const [posicoes, setPosicoes] = useState<Record<string, PosicaoTecnico>>({});
  const [erro, setErro] = useState<string | null>(null);
  const recarregarRef = useRef<() => void>(() => {});

  useEffect(() => {
    let ativo = true;
    const carregar = () => {
      listarPosicoes()
        .then((lista) => {
          if (!ativo) return;
          setPosicoes(Object.fromEntries(lista.map((p) => [p.employee_id, p])));
          setErro(null);
        })
        .catch((e) => ativo && setErro(e instanceof Error ? e.message : String(e)));
    };
    recarregarRef.current = carregar;

    const canal = supabase
      .channel(`rt:posicoes:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'technician_locations' }, (ev) => {
        if (ev.eventType === 'DELETE') {
          const id = (ev.old as { employee_id?: string }).employee_id;
          if (id) {
            setPosicoes((atual) => {
              const copia = { ...atual };
              delete copia[id];
              return copia;
            });
          }
          return;
        }
        const p = ev.new as PosicaoTecnico;
        setPosicoes((atual) => ({ ...atual, [p.employee_id]: p }));
      })
      // A cada (re)conexão recarrega tudo: nada se perde se a internet cair
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') carregar();
      });

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, []);

  const recarregar = useCallback(() => recarregarRef.current(), []);
  return { posicoes, erro, recarregar };
}
