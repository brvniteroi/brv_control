import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { buscarItem, listarItensAbertos, situacaoImpressora, AGENTE_ONLINE_MS } from '../services/oficina';
import type { AgenteImpressao, ItemOficina, ItemOficinaTela } from '../types/oficina';
import { ehFinal } from '../utils/oficina';

/**
 * Itens em aberto da oficina (Kanban), em sincronia pelo Realtime.
 * O Realtime traz a linha crua de workshop_orders (sem nome do cliente/OS), então cada mudança
 * busca a linha da visão oficina_itens. Item que finaliza sai da lista.
 * `setItens` fica exposto para a atualização otimista do arraste.
 */
export function useItensOficina() {
  const [itens, setItens] = useState<ItemOficinaTela[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregarRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let ativo = true;

    const recarregar = async () => {
      setCarregando(true);
      try {
        const dados = await listarItensAbertos();
        if (ativo) {
          setItens(dados);
          setErro(null);
        }
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : String(e));
      } finally {
        if (ativo) setCarregando(false);
      }
    };
    recarregarRef.current = recarregar;

    const canal = supabase
      .channel('rt:oficina:abertos')
      .on<ItemOficina>('postgres_changes', { event: '*', schema: 'public', table: 'workshop_orders' }, async (ev) => {
        const id = (ev.eventType === 'DELETE' ? ev.old : ev.new)?.id;
        if (!id) return;
        const linha = ev.eventType === 'DELETE' ? null : await buscarItem(id).catch(() => null);
        if (!ativo) return;
        setItens((atual) => {
          const sem = atual.filter((i) => i.id !== id);
          if (!linha || ehFinal(linha.status)) return sem;
          const indice = atual.findIndex((i) => i.id === id);
          if (indice === -1) return [...sem, linha];
          const copia = atual.slice();
          copia[indice] = linha;
          return copia;
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') recarregar();
      });

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, []);

  const recarregar = useCallback(() => recarregarRef.current(), []);
  return { itens, setItens, carregando, erro, recarregar };
}

/** Situação da Elgin (agente no servidor da loja), conferida a cada 30 s. */
export function useSituacaoImpressora() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [agente, setAgente] = useState<AgenteImpressao | null>(null);

  useEffect(() => {
    let ativo = true;
    const conferir = () =>
      situacaoImpressora()
        .then((s) => {
          if (!ativo) return;
          setOnline(s.online);
          setAgente(s.agente);
        })
        .catch(() => ativo && setOnline(false));
    conferir();
    const relogio = setInterval(conferir, 30_000);
    return () => {
      ativo = false;
      clearInterval(relogio);
    };
  }, []);

  return { online, agente, limiteMs: AGENTE_ONLINE_MS };
}
