import { useEffect, useState, type KeyboardEvent } from 'react';

/**
 * Teclado na lista de sugestões de uma busca (catálogo no orçamento e na Nova venda; pedido do Braulio, 2026-11-24):
 * ↓/↑ percorrem a lista (dá a volta), Enter escolhe o item marcado (o primeiro, se ninguém mexeu), Esc fecha.
 * O item marcado volta para o primeiro sempre que a lista muda e rola para ficar visível.
 */
export function useNavegacaoLista<T>(opcoes: {
  itens: T[];
  aberta: boolean;
  /** Prefixo do id de cada opção na tela (`${idPrefixo}-${indice}`), usado para rolar até a marcada. */
  idPrefixo: string;
  aoEscolher: (item: T) => void;
  aoAbrir: () => void;
  aoFechar: () => void;
}) {
  const { itens, aberta, idPrefixo, aoEscolher, aoAbrir, aoFechar } = opcoes;
  const [ativo, setAtivo] = useState(0);
  const [itensVistos, setItensVistos] = useState(itens);

  // Lista nova (o usuário digitou): a marcação volta para o primeiro item
  if (itensVistos !== itens) {
    setItensVistos(itens);
    setAtivo(0);
  }

  useEffect(() => {
    if (!aberta) return;
    document.getElementById(`${idPrefixo}-${ativo}`)?.scrollIntoView({ block: 'nearest' });
  }, [ativo, aberta, idPrefixo]);

  const aoTeclar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (itens.length === 0) return;
    if (!aberta) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        aoAbrir();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAtivo((i) => (i + 1) % itens.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAtivo((i) => (i - 1 + itens.length) % itens.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = itens.at(Math.min(ativo, itens.length - 1));
      if (item !== undefined) aoEscolher(item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      aoFechar();
    }
  };

  return { ativo, setAtivo, aoTeclar };
}
