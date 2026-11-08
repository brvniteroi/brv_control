// Um aparelho por técnico (migration 20261108120000_um_aparelho_por_tecnico.sql). Cada celular guarda uma
// identificação própria; ao fazer login ele "assume" o técnico e os outros aparelhos saem sozinhos.
import { supabase } from './supabase';

const CHAVE_APARELHO = 'brv_aparelho_id';
const CHAVE_MOTIVO_SAIDA = 'brv_motivo_saida';
let idEmMemoria: string | null = null;

/** Identificação deste aparelho (navegador ou APK), criada na primeira vez. */
export function idAparelho(): string {
  try {
    let id = localStorage.getItem(CHAVE_APARELHO);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CHAVE_APARELHO, id);
    }
    return id;
  } catch {
    // Sem armazenamento (modo privado): vale enquanto a página estiver aberta
    idEmMemoria ??= crypto.randomUUID();
    return idEmMemoria;
  }
}

/**
 * Logo depois do login: se for técnico, este aparelho passa a ser o dele e as sessões dos outros aparelhos
 * são encerradas. Falha aqui não impede o login (a conferência periódica do app de campo resolve depois).
 */
export async function assumirAparelhoAoEntrar(): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('assumir_aparelho', {
      p_aparelho: idAparelho(),
      p_user_agent: navigator.userAgent,
    });
    if (error || data !== true) return;
    await supabase.auth.signOut({ scope: 'others' });
  } catch {
    /* sem sinal: segue */
  }
}

/** false = o login do técnico foi aberto em outro aparelho. Erro de rede conta como liberado. */
export async function aparelhoLiberado(): Promise<boolean> {
  const { data, error } = await supabase.rpc('aparelho_liberado', {
    p_aparelho: idAparelho(),
    p_user_agent: navigator.userAgent,
  });
  if (error) return true;
  return data !== false;
}

/** Motivo mostrado na tela de login depois de uma saída automática (lido uma vez). */
export function guardarMotivoSaida(motivo: string): void {
  try {
    sessionStorage.setItem(CHAVE_MOTIVO_SAIDA, motivo);
  } catch {
    /* sem armazenamento: sai sem o aviso */
  }
}

export function lerMotivoSaida(): string | null {
  try {
    return sessionStorage.getItem(CHAVE_MOTIVO_SAIDA);
  } catch {
    return null;
  }
}

export function apagarMotivoSaida(): void {
  try {
    sessionStorage.removeItem(CHAVE_MOTIVO_SAIDA);
  } catch {
    /* nada */
  }
}

export interface AlertaAparelhos {
  aparelhos: number;
  ultimaTroca: string;
}

/** Técnicos (employee_id) com login em 2 ou mais aparelhos nas últimas 24 h (só o escritório lê). */
export async function alertasAparelhos(): Promise<Record<string, AlertaAparelhos>> {
  const desde = new Date(Date.now() - 24 * 3600000).toISOString();
  const { data, error } = await supabase
    .from('tecnico_aparelho_trocas')
    .select('employee_id, aparelho_id, created_at')
    .gte('created_at', desde)
    .order('created_at', { ascending: false });
  if (error) return {};
  const porTecnico = new Map<string, { ids: Set<string>; ultima: string }>();
  for (const r of data ?? []) {
    if (!r.employee_id) continue;
    const g = porTecnico.get(r.employee_id) ?? { ids: new Set<string>(), ultima: r.created_at as string };
    g.ids.add(r.aparelho_id as string);
    porTecnico.set(r.employee_id, g);
  }
  const resultado: Record<string, AlertaAparelhos> = {};
  for (const [id, g] of porTecnico) {
    if (g.ids.size >= 2) resultado[id] = { aparelhos: g.ids.size, ultimaTroca: g.ultima };
  }
  return resultado;
}
