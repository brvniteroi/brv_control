import { supabase } from './supabase';
import type { Tag } from '../types/fsm';

/**
 * Cores sugeridas para etiquetas (fundo claro + texto na própria cor, então só tons médios/escuros).
 * Ordem: vermelhos, rosas, roxos, azuis, verdes, amarelos/laranjas, marrons e neutros.
 */
export const CORES_ETIQUETA = [
  '#991B1B', '#DC2626', '#E11D48', '#DB2777', '#C026D3', '#9333EA', '#7C3AED', '#4F46E5',
  '#1E3A8A', '#2563EB', '#0284C7', '#0891B2', '#0D9488', '#059669', '#16A34A', '#166534',
  '#65A30D', '#CA8A04', '#D97706', '#EA580C', '#C2410C', '#92400E', '#78350F', '#475569',
  '#6B7280', '#111827',
];
export const COR_PADRAO_ETIQUETA = '#2563EB';

export async function listarEtiquetas(): Promise<Tag[]> {
  const { data, error } = await supabase.from('tags').select('id, name, color').order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function criarEtiqueta(nome: string, cor: string): Promise<Tag> {
  const { data, error } = await supabase
    .from('tags')
    .insert({ name: nome.trim(), color: cor })
    .select('id, name, color')
    .single();
  if (error) {
    if (error.message.includes('tags_nome_key')) throw new Error('Já existe uma etiqueta com esse nome.');
    throw new Error(error.message);
  }
  return data;
}

export async function atualizarEtiqueta(id: string, nome: string, cor: string): Promise<void> {
  const { error } = await supabase.from('tags').update({ name: nome.trim(), color: cor }).eq('id', id);
  if (error) {
    if (error.message.includes('tags_nome_key')) throw new Error('Já existe uma etiqueta com esse nome.');
    throw new Error(error.message);
  }
}

/** Quantas OS usam cada etiqueta (para a tela de cadastro). */
export async function contarUsoEtiquetas(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('tags').select('id, service_order_tags(count)');
  if (error) throw new Error(error.message);
  return new Map(
    (data ?? []).map((t) => [t.id as string, (t.service_order_tags as unknown as { count: number }[])[0]?.count ?? 0]),
  );
}

/** Apaga do catálogo (sai de todas as OS). O banco só deixa o admin. */
export async function excluirEtiqueta(id: string): Promise<void> {
  const { error, count } = await supabase.from('tags').delete({ count: 'exact' }).eq('id', id);
  if (error) throw new Error(error.message);
  if (count === 0) throw new Error('Só o administrador pode excluir etiquetas.');
}

/** Linha "Etiquetas: A, B" para as dicas (title) dos blocos da linha do tempo e do calendário. */
export const dicaEtiquetas = (etiquetas: Tag[] | undefined) =>
  etiquetas?.length ? `Etiquetas: ${etiquetas.map((t) => t.name).join(', ')}` : null;

export const ordenarEtiquetas =(lista: Tag[] | null | undefined): Tag[] =>
  [...(lista ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

/** Substitui todas as etiquetas da OS pelas informadas (uma transação). */
export async function definirEtiquetasOrdem(serviceOrderId: string, tagIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('definir_etiquetas_ordem', { p_service_order_id: serviceOrderId, p_tag_ids: tagIds });
  if (error) throw new Error(error.message);
}
