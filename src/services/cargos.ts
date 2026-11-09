// Cadastro de cargos (migration 20261108110000_funcionarios_cargos.sql). A categoria do cargo é copiada
// para employees.role pelo banco, e é ela que decide quem aparece na linha do tempo e na agenda.
import { supabase } from './supabase';
import type { Cargo, EmployeeRole } from '../types/fsm';

/** Categoria do cargo: rótulo e o que ela significa no sistema. */
export const CATEGORIAS_CARGO: { valor: EmployeeRole; rotulo: string; explicacao: string }[] = [
  { valor: 'tecnico', rotulo: 'Atende em campo', explicacao: 'Aparece na linha do tempo, na agenda e nos relatórios de técnicos' },
  { valor: 'auxiliar', rotulo: 'Auxiliar', explicacao: 'Ajudante; não recebe atividades próprias' },
  { valor: 'supervisor', rotulo: 'Supervisão', explicacao: 'Coordena a equipe' },
  { valor: 'administrativo', rotulo: 'Administrativo', explicacao: 'Escritório, financeiro, atendimento' },
  { valor: 'oficina', rotulo: 'Atende na oficina', explicacao: 'Bancada na loja; não aparece na linha do tempo nem nos relatórios de técnicos' },
];

export const rotuloCategoria = (c: EmployeeRole) => CATEGORIAS_CARGO.find((x) => x.valor === c)?.rotulo ?? c;

export async function listarCargos(): Promise<Cargo[]> {
  const { data, error } = await supabase.from('cargos').select('*').order('ativo', { ascending: false }).order('nome');
  if (error) throw new Error(error.message);
  return (data ?? []) as Cargo[];
}

/** Quantos funcionários (ativos ou não) em cada cargo. */
export async function contarFuncionariosPorCargo(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('employees').select('cargo_id').not('cargo_id', 'is', null);
  if (error) throw new Error(error.message);
  const mapa = new Map<string, number>();
  for (const r of data ?? []) mapa.set(r.cargo_id as string, (mapa.get(r.cargo_id as string) ?? 0) + 1);
  return mapa;
}

function traduzir(mensagem: string): string {
  if (mensagem.includes('cargos_nome_key')) return 'Já existe um cargo com este nome.';
  if (mensagem.includes('employees_cargo_id_fkey')) return 'Há funcionários neste cargo: desative em vez de excluir.';
  return mensagem;
}

export async function salvarCargo(
  id: string | null,
  d: { nome: string; categoria: EmployeeRole; descricao: string; ativo: boolean },
): Promise<void> {
  const campos = { nome: d.nome.trim(), categoria: d.categoria, descricao: d.descricao.trim() || null, ativo: d.ativo };
  const { error } = id
    ? await supabase.from('cargos').update(campos).eq('id', id)
    : await supabase.from('cargos').insert(campos);
  if (error) throw new Error(traduzir(error.message));
}

export async function excluirCargo(id: string): Promise<void> {
  const { error } = await supabase.from('cargos').delete().eq('id', id);
  if (error) throw new Error(traduzir(error.message));
}
