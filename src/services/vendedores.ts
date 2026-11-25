// Cadastro de vendedores (só admin; migration 20261125120000_vendedores_modelos.sql).
import { supabase } from './supabase';
import type { ProfileRole } from '../types/fsm';

export type NivelVendedor = 'caixa' | 'completo';

export interface LoginVendedor {
  profile_id: string;
  full_name: string;
  email: string;
  role: ProfileRole;
  active: boolean;
  sales_access: boolean;
  financial_access: 'nenhum' | NivelVendedor;
  employee_id: string | null;
  /** Nome que sai no orçamento e na venda (o do funcionário ligado ao login). */
  seller_name: string | null;
  employee_active: boolean | null;
}

export async function listarLoginsVendedores(): Promise<LoginVendedor[]> {
  const { data, error } = await supabase.rpc('vendedores_cadastro');
  if (error) throw new Error(error.message);
  return (data ?? []) as LoginVendedor[];
}

/** `nome` só vale quando o login ainda não tem funcionário (é com ele que o cadastro é criado). */
export async function salvarVendedor(profileId: string, vende: boolean, nivel: NivelVendedor, nome?: string): Promise<void> {
  const { error } = await supabase.rpc('vendedor_salvar', {
    p_profile: profileId,
    p_vende: vende,
    p_nivel: nivel,
    p_nome: nome?.trim() || null,
  });
  if (error) throw new Error(error.message);
}
