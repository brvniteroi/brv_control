import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

/**
 * Lista mantida em sincronia com uma tabela do Supabase via Realtime.
 *
 * - A carga inicial roda a cada (re)conexão do canal: se o celular do técnico
 *   ficar sem sinal, nada se perde quando a conexão volta.
 * - Com RLS ativo, UPDATE/DELETE não trazem a versão antiga da linha, só o id.
 *   Por isso o card é localizado pelo id, e `manter` decide se a versão nova
 *   continua na tela (ex.: atividade arrastada para outro dia sai da linha do
 *   tempo de hoje).
 * - `chave` identifica o recorte (dia, técnico...); ao mudar, recarrega.
 * - `setLinhas` fica exposto para atualização otimista no drag and drop.
 *
 * Exemplo (linha do tempo de um dia):
 *   const { linhas: tarefas } = useRealtimeTable<Task>('tasks', dia, async () => {
 *     const { data, error } = await supabase.from('tasks').select('*')
 *       .lt('scheduled_start', fimDoDia).gt('scheduled_end', inicioDoDia);
 *     if (error) throw error;
 *     return data;
 *   }, (t) => t.scheduled_start! < fimDoDia && t.scheduled_end! > inicioDoDia);
 */
export function useRealtimeTable<T extends { id: string }>(
  tabela: string,
  chave: string,
  carregar: () => Promise<T[]>,
  manter: (linha: T) => boolean = () => true,
) {
  const [linhas, setLinhas] = useState<T[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // As funções mudam a cada render; o canal só é recriado quando a chave muda
  const carregarRef = useRef(carregar);
  const manterRef = useRef(manter);
  const recarregarRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    carregarRef.current = carregar;
    manterRef.current = manter;
  });

  useEffect(() => {
    let ativo = true;

    const recarregar = async () => {
      setCarregando(true);
      try {
        const dados = await carregarRef.current();
        if (ativo) {
          setLinhas(dados);
          setErro(null);
        }
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : String(e));
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    recarregarRef.current = recarregar;

    const aplicar = (evento: RealtimePostgresChangesPayload<T>) => {
      if (evento.eventType === 'DELETE') {
        const id = (evento.old as Partial<T>).id;
        setLinhas((atual) => atual.filter((l) => l.id !== id));
        return;
      }
      const nova = evento.new;
      setLinhas((atual) => {
        const indice = atual.findIndex((l) => l.id === nova.id);
        if (!manterRef.current(nova)) {
          return indice === -1 ? atual : atual.filter((l) => l.id !== nova.id);
        }
        if (indice === -1) return [...atual, nova];
        const copia = atual.slice();
        copia[indice] = nova;
        return copia;
      });
    };

    const canal = supabase
      .channel(`rt:${tabela}:${chave}`)
      .on<T>('postgres_changes', { event: '*', schema: 'public', table: tabela }, aplicar)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') recarregar();
      });

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [tabela, chave]);

    /** Recarrega do banco (botão "Atualizar"). */
  const recarregar = useCallback(() => recarregarRef.current(), []);

  return { linhas, setLinhas, carregando, erro, recarregar };
}
