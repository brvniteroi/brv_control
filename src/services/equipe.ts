import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Employee, EmployeeRole, Profile, ProfileRole } from '../types/fsm';

export interface ColaboradorComLogin extends Employee {
  profile: { id: string; email: string; full_name: string } | null;
}

export interface PerfilComColaborador extends Profile {
  colaborador: { id: string; name: string } | null;
}

export async function listarColaboradores(): Promise<ColaboradorComLogin[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('*, profile:profiles(id, email, full_name)')
    .order('active', { ascending: false })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ColaboradorComLogin[];
}

export interface SalvarColaboradorInput {
  id?: string;
  name: string;
  role: EmployeeRole;
  phone: string;
  email: string;
  timeline_color: string;
  active: boolean;
  profile_id: string | null;
}

function traduzir(mensagem: string): string {
  if (mensagem.includes('employees_profile_id_key')) return 'Este login já está ligado a outro colaborador.';
  if (mensagem.includes('employees_timeline_color_check')) return 'Cor inválida.';
  if (mensagem.includes('profiles_protege_ultimo_admin') || mensagem.includes('pelo menos um administrador')) {
    return 'É preciso manter pelo menos um administrador ativo.';
  }
  return mensagem;
}

export async function salvarColaborador(d: SalvarColaboradorInput): Promise<void> {
  const campos = {
    name: d.name.trim(),
    role: d.role,
    phone: d.phone.trim() || null,
    email: d.email.trim() || null,
    timeline_color: d.timeline_color,
    active: d.active,
    profile_id: d.profile_id,
  };
  const { error } = d.id
    ? await supabase.from('employees').update(campos).eq('id', d.id)
    : await supabase.from('employees').insert(campos);
  if (error) throw new Error(traduzir(error.message));
}

/** Perfis (logins) e o colaborador ligado a cada um. */
export async function listarPerfis(): Promise<PerfilComColaborador[]> {
  const [perfis, colaboradores] = await Promise.all([
    supabase.from('profiles').select('*').order('active', { ascending: false }).order('full_name', { ascending: true }),
    supabase.from('employees').select('id, name, profile_id').not('profile_id', 'is', null),
  ]);
  if (perfis.error) throw perfis.error;
  if (colaboradores.error) throw colaboradores.error;
  const porPerfil = new Map((colaboradores.data ?? []).map((c) => [c.profile_id as string, { id: c.id as string, name: c.name as string }]));
  return ((perfis.data ?? []) as Profile[]).map((p) => ({ ...p, colaborador: porPerfil.get(p.id) ?? null }));
}

export async function atualizarPerfil(
  id: string,
  campos: { full_name: string; role: ProfileRole; active: boolean },
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: campos.full_name.trim(), role: campos.role, active: campos.active })
    .eq('id', id);
  if (error) throw new Error(traduzir(error.message));
}

/** Liga o login a um colaborador (ou desliga com null). O vínculo anterior do login é desfeito. */
export async function vincularPerfil(perfilId: string, colaboradorId: string | null): Promise<void> {
  const { error: erroLimpar } = await supabase.from('employees').update({ profile_id: null }).eq('profile_id', perfilId);
  if (erroLimpar) throw new Error(traduzir(erroLimpar.message));
  if (!colaboradorId) return;
  const { error } = await supabase.from('employees').update({ profile_id: perfilId }).eq('id', colaboradorId);
  if (error) throw new Error(traduzir(error.message));
}

// ---------------------------------------------------------------------
// Ações que exigem a chave de administrador: rodam na Edge Function `gerenciar-usuario`
// ---------------------------------------------------------------------
async function chamarFuncao(corpo: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.functions.invoke('gerenciar-usuario', { body: corpo });
  if (!error) return;

  let mensagem = 'Não foi possível concluir. Confira se a função "gerenciar-usuario" está publicada no Supabase.';
  if (error instanceof FunctionsHttpError) {
    try {
      const resposta = (await error.context.json()) as { erro?: string };
      if (resposta.erro) mensagem = resposta.erro;
    } catch {
      /* resposta sem JSON: mantém a mensagem padrão */
    }
  }
  throw new Error(mensagem);
}

export interface CriarUsuarioInput {
  email: string;
  nome: string;
  papel: ProfileRole;
  senha: string;
  colaborador_id: string | null;
}

export const criarUsuario = (d: CriarUsuarioInput) => chamarFuncao({ acao: 'criar', ...d });

export const criarAcessoPortal = (d: { customer_id: string; email: string; nome: string; senha: string }) =>
  chamarFuncao({ acao: 'criar_acesso_cliente', ...d });

export interface AcessoPortal {
  profile_id: string;
  email: string;
  nome: string;
  active: boolean;
}

export async function listarAcessosPortal(customerId: string): Promise<AcessoPortal[]> {
  const { data, error } = await supabase
    .from('customer_users')
    .select('profile_id, profile:profiles(email, full_name, active)')
    .eq('customer_id', customerId)
    .order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const p = r.profile as unknown as { email: string; full_name: string; active: boolean } | null;
    return { profile_id: r.profile_id, email: p?.email ?? '', nome: p?.full_name ?? '', active: p?.active ?? false };
  });
}

export const redefinirSenha =(usuarioId: string, senha: string) =>
  chamarFuncao({ acao: 'redefinir_senha', usuario_id: usuarioId, senha });

/** Senha temporária legível (sem caracteres ambíguos como 0/O e 1/l). */
export function gerarSenhaTemporaria(): string {
  const letras = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => letras[b % letras.length]).join('');
}
