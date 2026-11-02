import { supabase } from './supabase';

export interface DadosTipoServico {
  name: string;
  default_duration_minutes: number | null;
  active: boolean;
}

const traduzirErro = (mensagem: string) => {
  if (mensagem.includes('service_types_name_key')) return 'Já existe um tipo de serviço com esse nome.';
  if (mensagem.includes('service_orders')) return 'Este tipo já foi usado em OS. Desative-o em vez de excluir.';
  return mensagem;
};

/** Quantas OS usam cada tipo (para a tela de cadastro). */
export async function contarUsoTipos(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('service_types').select('id, service_orders(count)');
  if (error) throw new Error(error.message);
  return new Map(
    (data ?? []).map((t) => [t.id as string, (t.service_orders as unknown as { count: number }[])[0]?.count ?? 0]),
  );
}

export async function salvarTipoServico(id: string | null, dados: DadosTipoServico): Promise<void> {
  const linha = { ...dados, name: dados.name.trim() };
  const { error } = id
    ? await supabase.from('service_types').update(linha).eq('id', id)
    : await supabase.from('service_types').insert(linha);
  if (error) throw new Error(traduzirErro(error.message));
}

export async function excluirTipoServico(id: string): Promise<void> {
  const { error, count } = await supabase.from('service_types').delete({ count: 'exact' }).eq('id', id);
  if (error) throw new Error(traduzirErro(error.message));
  if (count === 0) throw new Error('Sem permissão para excluir este tipo.');
}
