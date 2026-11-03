// Comentários internos da OS (só o escritório). Ver migration 20261103100000_comentarios_os.sql.
import { supabase } from './supabase';

export interface ComentarioOS {
  id: string;
  service_order_id: string;
  author_id: string | null;
  author_name: string | null;
  message: string;
  field_control_id: string | null;
  created_at: string;
}

export async function comentariosDaOS(osId: string): Promise<ComentarioOS[]> {
  const { data, error } = await supabase
    .from('service_order_comments')
    .select('*')
    .eq('service_order_id', osId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ComentarioOS[];
}

/** Autor e data são preenchidos pelo banco a partir do login. */
export async function comentarOS(osId: string, mensagem: string): Promise<void> {
  const { error } = await supabase.from('service_order_comments').insert({ service_order_id: osId, message: mensagem.trim() });
  if (error) throw new Error(error.message);
}

export async function excluirComentario(id: string): Promise<void> {
  const { error } = await supabase.from('service_order_comments').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
