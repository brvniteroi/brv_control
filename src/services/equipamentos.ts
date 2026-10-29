import { supabase } from './supabase';
import { termoSeguro } from './clientes';
import type { Equipment } from '../types/fsm';

export const EQUIPAMENTOS_POR_PAGINA = 50;

export type FiltroStatusEquipamento = 'ativos' | 'inativos' | 'todos';

export interface EquipamentoComCliente extends Equipment {
  customer: { id: string; name: string } | null;
}

export interface PaginaEquipamentos {
  itens: EquipamentoComCliente[];
  total: number;
}

export type EquipamentoInput = Pick<Equipment, 'customer_id' | 'category'> &
  Partial<
    Pick<
      Equipment,
      | 'address_id'
      | 'brand'
      | 'model'
      | 'serial_number'
      | 'capacity_btu'
      | 'voltage'
      | 'refrigerant'
      | 'location'
      | 'installed_at'
      | 'warranty_until'
      | 'qr_code'
      | 'notes'
      | 'active'
    >
  >;

export async function listarEquipamentos(
  termo: string,
  filtro: FiltroStatusEquipamento,
  pagina: number,
  clienteId?: string,
): Promise<PaginaEquipamentos> {
  let query = supabase
    .from('equipments')
    .select('*, customer:customers(id, name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(pagina * EQUIPAMENTOS_POR_PAGINA, (pagina + 1) * EQUIPAMENTOS_POR_PAGINA - 1);

  if (filtro === 'ativos') query = query.eq('active', true);
  if (filtro === 'inativos') query = query.eq('active', false);
  if (clienteId) query = query.eq('customer_id', clienteId);

  const limpo = termoSeguro(termo);
  if (limpo) {
    query = query.or(
      [
        `category.ilike.%${limpo}%`,
        `brand.ilike.%${limpo}%`,
        `model.ilike.%${limpo}%`,
        `serial_number.ilike.%${limpo}%`,
        `qr_code.ilike.%${limpo}%`,
        `location.ilike.%${limpo}%`,
      ].join(','),
    );
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { itens: (data ?? []) as EquipamentoComCliente[], total: count ?? 0 };
}

export async function buscarEquipamento(id: string): Promise<EquipamentoComCliente | null> {
  const { data, error } = await supabase
    .from('equipments')
    .select('*, customer:customers(id, name)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as EquipamentoComCliente | null) ?? null;
}

export async function salvarEquipamento(dados: EquipamentoInput, id?: string): Promise<Equipment> {
  const consulta = id
    ? supabase.from('equipments').update(dados).eq('id', id)
    : supabase.from('equipments').insert(dados);
  const { data, error } = await consulta.select().single();
  if (error) throw error;
  return data as Equipment;
}

/** Equipamento não é excluído (histórico de OS): fica inativo. */
export async function definirEquipamentoAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('equipments').update({ active: ativo }).eq('id', id);
  if (error) throw error;
}

/** Clientes para o seletor do formulário (busca por nome, até 20). */
export async function buscarClientesParaSeletor(termo: string): Promise<{ id: string; name: string }[]> {
  let query = supabase.from('customers').select('id, name').eq('active', true).order('name').limit(20);
  const limpo = termoSeguro(termo);
  if (limpo) query = query.ilike('name', `%${limpo}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Endereços de um cliente, para escolher onde o equipamento está instalado. */
export async function listarEnderecosDoCliente(
  clienteId: string,
): Promise<{ id: string; label: string | null; street: string; number: string | null; city: string | null }[]> {
  const { data, error } = await supabase
    .from('customer_addresses')
    .select('id, label, street, number, city')
    .eq('customer_id', clienteId)
    .order('is_primary', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
