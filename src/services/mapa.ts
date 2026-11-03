// Página Mapa: última posição de cada técnico (enviada pelo app de campo, ver useRastreioCampo).
import { supabase } from './supabase';

export interface PosicaoTecnico {
  employee_id: string;
  latitude: number;
  longitude: number;
  /** Precisão informada pelo celular, em metros. */
  accuracy_m: number | null;
  updated_at: string;
}

export interface PresencaTecnico {
  employee_id: string;
  last_seen: string;
}

export async function listarPresencas(): Promise<PresencaTecnico[]> {
  const { data, error } = await supabase.from('technician_presence').select('*');
  if (error) throw new Error(`Não foi possível carregar a presença dos técnicos: ${error.message}`);
  return data ?? [];
}

export async function listarPosicoes(): Promise<PosicaoTecnico[]> {
  const { data, error } = await supabase.from('technician_locations').select('*');
  if (error) throw new Error(`Não foi possível carregar a posição dos técnicos: ${error.message}`);
  return data ?? [];
}
