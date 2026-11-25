import { useEffect, useState, type KeyboardEvent } from 'react';

/**
 * Setas do teclado numa lista de escolha ligada a um campo de busca (pedido do Braulio, 2026-11-24: "em todas as vezes que
 * pudermos selecionar entre valores distintos"). Usado nos seletores de cliente, catálogo, Nova atividade, Nova placa,
 * etiquetas e na busca da Ajuda F1. Campos `<select>` nativos já aceitam as setas sozinhos.
 *
 * ↓/↑ percorrem a lista (dá a volta), Enter escolhe o item marcado, Esc fecha (se `aoFechar` foi informado).
 * A marcação volta ao início sempre que a lista muda e rola para ficar visível.
 * **`itens` precisa ter identidade estável (useMemo ou estado)**: uma lista nova a cada render zera a marcação sem parar.
 *
 * Na tela: o campo recebe `onKeyDown={aoTeclar}`; cada opção tem `id={`${idPrefixo}-${indice}`}`, fundo `bg-blue-50` quando
 * `indice === ativo` e `onMouseEnter={() => setAtivo(indice)}`.
 */
export function useNavegacaoLista<T>(opcoes: {
  itens: readonly T[];
  /** A lista está visível? (lista sempre aberta: `true`) */
  aberta: boolean;
  /** Prefixo do id de cada opção na tela (`${idPrefixo}-${indice}`), usado para rolar até a marcada. */
  idPrefixo: string;
  aoEscolher: (item: T) => void;
  /** ↓ com a lista fechada abre a lista. */
  aoAbrir?: () => void;
  /** Esc com a lista aberta. Sem ele, o Esc segue para quem estiver em volta (ex.: fechar o modal). */
  aoFechar?: () => void;
  /**
   * `true` (padrão): o primeiro item já vem marcado e o Enter o escolhe. `false`: nada marcado até usar as setas, e o Enter
   * segue para o campo (ex.: criar etiqueta nova, lista que fica sempre visível).
   */
  marcarPrimeiro?: boolean;
}) {
  const { itens, aberta, idPrefixo, aoEscolher, aoAbrir, aoFechar, marcarPrimeiro = true } = opcoes;
  const inicio = marcarPrimeiro ? 0 : -1;
  const [ativo, setAtivo] = useState(inicio);
  const [itensVistos, setItensVistos] = useState(itens);

  // Lista nova (o usuário digitou): a marcação volta ao início
  if (itensVistos !== itens) {
    setItensVistos(itens);
    setAtivo(inicio);
  }

  useEffect(() => {
    if (!aberta || ativo < 0) return;
    document.getElementById(`${idPrefixo}-${ativo}`)?.scrollIntoView({ block: 'nearest' });
  }, [ativo, aberta, idPrefixo]);

  /** Trata a tecla; devolve `true` se ela foi usada pela lista (para o campo não fazer mais nada com ela). */
  const aoTeclar = (e: KeyboardEvent<HTMLInputElement>): boolean => {
    if (itens.length === 0) return false;
    if (!aberta) {
      if (e.key === 'ArrowDown' && aoAbrir) {
        e.preventDefault();
        aoAbrir();
        return true;
      }
      return false;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAtivo((i) => (i < 0 ? 0 : (i + 1) % itens.length));
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAtivo((i) => (i <= 0 ? itens.length - 1 : i - 1));
      return true;
    }
    if (e.key === 'Enter') {
      if (ativo < 0) return false;
      const item = itens.at(Math.min(ativo, itens.length - 1));
      if (item === undefined) return false;
      e.preventDefault();
      aoEscolher(item);
      return true;
    }
    if (e.key === 'Escape' && aoFechar) {
      e.preventDefault();
      // Fecha só a lista, não o modal em volta
      e.stopPropagation();
      aoFechar();
      return true;
    }
    return false;
  };

  return { ativo, setAtivo, aoTeclar };
}
