import { supabase } from './supabase';

/** Uma execução de backup: o agendado das 9h ou o pedido pelo botão do Dashboard (só o administrador enxerga). */
export interface ExecucaoBackup {
  id: string;
  origem: 'manual' | 'agendado';
  status: 'pendente' | 'executando' | 'ok' | 'falhou';
  requested_at: string;
  started_at: string | null;
  finished_at: string | null;
  detalhe: string | null;
}

export interface EstadoBackup {
  execucoes: ExecucaoBackup[];
  /** Sinal de vida do vigia que roda no PC da empresa (null = nunca respondeu). */
  agenteVistoEm: string | null;
}

/** O PC da empresa conta como online com sinal de vida de menos de 3 minutos (a mesma regra do banco). */
export const MINUTOS_AGENTE_ONLINE = 3;

export async function carregarBackups(limite = 6): Promise<EstadoBackup> {
  const [execucoes, agente] = await Promise.all([
    supabase
      .from('backup_runs')
      .select('id, origem, status, requested_at, started_at, finished_at, detalhe')
      .order('requested_at', { ascending: false })
      .limit(limite),
    supabase.from('backup_agent').select('last_seen').eq('id', 1).maybeSingle(),
  ]);
  if (execucoes.error) throw execucoes.error;
  if (agente.error) throw agente.error;
  return {
    execucoes: (execucoes.data ?? []) as ExecucaoBackup[],
    agenteVistoEm: agente.data?.last_seen ?? null,
  };
}

/** Botão "Fazer backup agora": o banco confere que é administrador, que o PC está online e que não há outro pedido. */
export async function pedirBackup(): Promise<void> {
  const { error } = await supabase.rpc('backup_solicitar');
  if (error) throw new Error(error.message);
}
