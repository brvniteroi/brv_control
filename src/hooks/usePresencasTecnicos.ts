import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { listarPresencas, type PresencaTecnico } from '../services/mapa';

/** Presença mais velha que isso = app fechado, tela apagada ou sem internet (o app avisa a cada 1 min). */
export const MINUTOS_ONLINE = 3;

/** Último sinal de vida de cada técnico, por id do colaborador, em tempo real. */
export function usePresencasTecnicos() {
  const [presencas, setPresencas] = useState<Record<string, string>>({});

  useEffect(() => {
    let ativo = true;
    const carregar = () => {
      listarPresencas()
        .then((lista: PresencaTecnico[]) => {
          if (ativo) setPresencas(Object.fromEntries(lista.map((p) => [p.employee_id, p.last_seen])));
        })
        .catch(() => {
          /* sem presença, o técnico aparece como offline */
        });
    };

    const canal = supabase
      .channel(`rt:presencas:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'technician_presence' }, (ev) => {
        if (ev.eventType === 'DELETE') return;
        const p = ev.new as PresencaTecnico;
        setPresencas((atual) => ({ ...atual, [p.employee_id]: p.last_seen }));
      })
      // A cada (re)conexão recarrega tudo
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') carregar();
      });

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, []);

  return presencas;
}
