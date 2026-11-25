// Modelos de orçamento: listas prontas de itens do catálogo (migration 20261125120000_vendedores_modelos.sql).
import { supabase } from './supabase';
import { buscarItensPorIds } from './vendas';
import type { CatalogItem } from '../types/vendas';

export interface ModeloOrcamento {
  id: string;
  name: string;
  /** `quantidade` nula = o item entra com a quantidade em branco. */
  itens: { catalog_item_id: string; quantidade: number | null }[];
}

export interface ItemDoModelo {
  item: CatalogItem;
  quantidade: number | null;
}

export async function listarModelos(): Promise<ModeloOrcamento[]> {
  const { data, error } = await supabase
    .from('quote_templates')
    .select('id, name, quote_template_items (catalog_item_id, suggested_quantity, sort_order)')
    .order('sort_order')
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => ({
    id: m.id as string,
    name: m.name as string,
    itens: [...(m.quote_template_items ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({
        catalog_item_id: i.catalog_item_id as string,
        quantidade: i.suggested_quantity == null ? null : Number(i.suggested_quantity),
      })),
  }));
}

/** Itens do modelo com o preço atual do catálogo. Item inativado fica de fora (`foraDoCatalogo`). */
export async function abrirModelo(modelo: ModeloOrcamento): Promise<{ itens: ItemDoModelo[]; foraDoCatalogo: string[] }> {
  const achados = new Map((await buscarItensPorIds(modelo.itens.map((i) => i.catalog_item_id))).map((i) => [i.id, i]));
  const itens: ItemDoModelo[] = [];
  const foraDoCatalogo: string[] = [];
  for (const linha of modelo.itens) {
    const item = achados.get(linha.catalog_item_id);
    if (item?.active) itens.push({ item, quantidade: linha.quantidade });
    else if (item) foraDoCatalogo.push(item.name);
  }
  return { itens, foraDoCatalogo };
}

/** Com um nome que já existe, só grava se `substituir` for verdadeiro. */
export async function salvarModelo(
  nome: string,
  itens: { catalog_item_id: string; quantity: number | null }[],
  substituir: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('modelo_salvar', { p: { name: nome, replace: substituir, items: itens } });
  if (error) throw new Error(error.message);
}

export async function excluirModelo(id: string): Promise<void> {
  const { error } = await supabase.from('quote_templates').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
