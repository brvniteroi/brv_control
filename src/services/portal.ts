import { supabase } from './supabase';
import type { ServiceOrderPriority, ServiceOrderStatus } from '../types/fsm';

// Tudo aqui passa por funções do banco que só devolvem dados do cliente ligado ao login
// (supabase/migrations/20261030100000_portal_cliente.sql).

export interface PortalCliente {
  id: string;
  name: string;
  trade_name: string | null;
}

export interface PortalEquipamentoAtendido {
  id: string;
  nome: string;
  local: string | null;
  servico: string | null;
}

export interface PortalChamado {
  id: string;
  number: number;
  status: ServiceOrderStatus;
  priority: ServiceOrderPriority;
  description: string | null;
  opened_at: string;
  completed_at: string | null;
  tipo: string;
  endereco: string | null;
  proxima_visita: string | null;
  equipamentos: PortalEquipamentoAtendido[];
}

export interface PortalOpcoes {
  tipos: { id: string; name: string }[];
  enderecos: { id: string; nome: string }[];
  equipamentos: { id: string; nome: string; local: string | null }[];
}

export interface PortalDocumento {
  id: string;
  nome: string;
  filled_at: string | null;
  os_numero: number;
  equipamento: string | null;
}

export interface NovoChamado {
  tipo: string;
  descricao: string;
  endereco: string | null;
  equipamento: string | null;
  urgente: boolean;
}

async function chamar<T>(funcao: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(funcao, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const buscarMeuCliente = () => chamar<PortalCliente | null>('portal_meu_cliente');
export const listarChamados = () => chamar<PortalChamado[]>('portal_chamados');
export const buscarOpcoesChamado = () => chamar<PortalOpcoes>('portal_opcoes_chamado');
export const listarDocumentos = () => chamar<PortalDocumento[]>('portal_documentos');

/** Abre o chamado e devolve o número da OS criada. */
export const abrirChamado = (d: NovoChamado) =>
  chamar<number>('portal_abrir_chamado', {
    p_tipo: d.tipo,
    p_descricao: d.descricao,
    p_endereco: d.endereco,
    p_equipamento: d.equipamento,
    p_urgente: d.urgente,
  });
