// Itens de um modelo nas linhas do orçamento e da venda (quantidade em branco até alguém digitar).
import type { ItemDoModelo } from '../../services/modelosOrcamento';
import { centavosParaTextoInput } from '../../utils/dinheiro';
import type { LinhaItemVenda } from './TabelaItensVenda';

/** Item que já está na tela não é repetido nem tem a quantidade mexida. */
export function aplicarModeloNasLinhas(
  linhas: LinhaItemVenda[],
  doModelo: ItemDoModelo[],
  prefixoUid: string,
): { novasLinhas: LinhaItemVenda[]; primeiraEmBranco: string | null } {
  const jaTem = new Set(linhas.filter((l) => !l.is_custom).map((l) => l.catalog_item_id));
  const novas: LinhaItemVenda[] = doModelo
    .filter(({ item }) => !jaTem.has(item.id))
    .map(({ item, quantidade }) => ({
      uid: `${prefixoUid}-${item.id}`,
      catalog_item_id: item.id,
      is_custom: false,
      kind: item.kind,
      code: item.code,
      name: item.name,
      unit: item.unit,
      quantityTexto: quantidade == null ? '' : String(quantidade).replace('.', ','),
      unitPriceTexto: centavosParaTextoInput(item.sale_price_cents),
      discountMode: 'valor',
      discountTexto: '',
      controlsStock: item.controls_stock,
      stockQuantity: item.stock_quantity,
    }));
  const novasLinhas = [...linhas, ...novas];
  // A tabela mostra os produtos antes dos serviços
  const naTela = [...novasLinhas.filter((l) => l.kind === 'produto'), ...novasLinhas.filter((l) => l.kind === 'servico')];
  return { novasLinhas, primeiraEmBranco: naTela.find((l) => !l.quantityTexto.trim())?.uid ?? null };
}

export function focarQuantidade(idPrefixo: string, uid: string | null): void {
  if (uid) setTimeout(() => document.getElementById(`${idPrefixo}-qtd-${uid}`)?.focus(), 60);
}

/** Devolve só as linhas com quantidade; `null` se não sobrar nada ou se a pessoa preferir voltar e preencher. */
export function confirmarItensSemQuantidade<T extends LinhaItemVenda>(linhas: T[]): T[] | null {
  const emBranco = linhas.filter((l) => !l.quantityTexto.trim());
  if (emBranco.length === 0) return linhas;
  const comQuantidade = linhas.filter((l) => l.quantityTexto.trim());
  if (comQuantidade.length === 0) {
    window.alert('Preencha a quantidade de pelo menos um item.');
    return null;
  }
  const nomes = emBranco.map((l) => `• ${l.name}`).join('\n');
  return window.confirm(`Sem quantidade, estes itens ficam de fora:\n\n${nomes}\n\nContinuar?`) ? comQuantidade : null;
}
