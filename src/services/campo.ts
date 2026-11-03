// App de campo do técnico: agenda, detalhes da atividade e ações de execução.
// O RLS já limita o técnico às próprias atividades; as consultas filtram pelo colaborador
// do login só para não depender disso.
import { supabase } from './supabase';
import type { Attachment, CustomerAddress, Equipment, ServiceOrder, Task } from '../types/fsm';

type EnderecoCampo = Pick<
  CustomerAddress,
  'id' | 'label' | 'street' | 'number' | 'complement' | 'district' | 'city' | 'state' | 'zip_code' | 'reference' | 'latitude' | 'longitude'
>;

export interface AtividadeCampo
  extends Pick<
    Task,
    | 'id' | 'service_order_id' | 'employee_id' | 'title' | 'description' | 'status' | 'scheduled_start' | 'scheduled_end'
    | 'estimated_minutes' | 'started_at' | 'finished_at' | 'technician_notes'
    | 'checkin_lat' | 'checkin_lng' | 'checkout_lat' | 'checkout_lng'
  > {
  ordem: {
    id: string;
    number: number;
    status: ServiceOrder['status'];
    priority: ServiceOrder['priority'];
    description: string | null;
    tipo: { name: string } | null;
    endereco: EnderecoCampo | null;
    cliente: {
      id: string;
      name: string;
      trade_name: string | null;
      enderecos: (EnderecoCampo & { is_primary: boolean; active: boolean })[];
    } | null;
    equipamentos: {
      service_performed: string | null;
      equipamento: Pick<Equipment, 'id' | 'category' | 'brand' | 'model' | 'capacity_btu' | 'location' | 'serial_number' | 'qr_code'> | null;
    }[];
  } | null;
}

/** Campos que o técnico pode alterar (trigger tasks_protege_agenda barra o resto). */
export type CamposExecucao = Partial<
  Pick<Task, 'status' | 'started_at' | 'finished_at' | 'checkin_lat' | 'checkin_lng' | 'checkout_lat' | 'checkout_lng' | 'technician_notes'>
>;

const END = 'id, label, street, number, complement, district, city, state, zip_code, reference, latitude, longitude';
// O técnico não lê customers nem customer_contacts (telefone, e-mail, documento): o nome do cliente
// vem de campo_clientes() e os endereços numa consulta à parte (ver completarClientes).
const SELECT = `id, service_order_id, employee_id, title, description, status, scheduled_start, scheduled_end,
  estimated_minutes, started_at, finished_at, technician_notes, checkin_lat, checkin_lng, checkout_lat, checkout_lng,
  ordem:service_orders!service_order_id(id, number, status, priority, description, customer_id,
    tipo:service_types!service_type_id(name),
    endereco:customer_addresses!service_orders_address_fk(${END}),
    equipamentos:service_order_equipments(service_performed,
      equipamento:equipments(id, category, brand, model, capacity_btu, location, serial_number, qr_code)))`;

type OrdemCampo = NonNullable<AtividadeCampo['ordem']>;
type ClienteCampo = NonNullable<OrdemCampo['cliente']>;
type AtividadeBruta = Omit<AtividadeCampo, 'ordem'> & {
  ordem: (Omit<OrdemCampo, 'cliente'> & { customer_id: string }) | null;
};

/** Junta nome e endereços do cliente em cada atividade. */
async function completarClientes(lista: AtividadeBruta[]): Promise<AtividadeCampo[]> {
  const ids = [...new Set(lista.flatMap((t) => (t.ordem ? [t.ordem.customer_id] : [])))];
  const clientes = new Map<string, ClienteCampo>();
  if (ids.length) {
    const [nomes, enderecos] = await Promise.all([
      supabase.rpc('campo_clientes', { p_ids: ids }),
      supabase.from('customer_addresses').select(`${END}, customer_id, is_primary, active`).in('customer_id', ids),
    ]);
    if (nomes.error) throw new Error(nomes.error.message);
    if (enderecos.error) throw new Error(enderecos.error.message);
    for (const c of nomes.data as { id: string; name: string; trade_name: string | null }[]) {
      clientes.set(c.id, { ...c, enderecos: [] });
    }
    for (const { customer_id, ...e } of enderecos.data as (ClienteCampo['enderecos'][number] & { customer_id: string })[]) {
      clientes.get(customer_id)?.enderecos.push(e);
    }
  }
  return lista.map((t) => ({
    ...t,
    ordem: t.ordem && { ...t.ordem, cliente: clientes.get(t.ordem.customer_id) ?? null },
  }));
}

export interface MeuColaborador {
  id: string;
  name: string;
}

/** Colaborador ligado ao login (só existe para técnico ativo). */
export async function meuColaborador(profileId: string): Promise<MeuColaborador | null> {
  const { data, error } = await supabase.from('employees').select('id, name').eq('profile_id', profileId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Início e fim (exclusivo) do dia local. */
function limitesDeHoje() {
  const d = new Date();
  return {
    inicio: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
    fim: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1),
  };
}

/** Atividades de hoje do técnico, na ordem do dia. Canceladas ficam de fora. */
export async function carregarMinhaAgenda(colaboradorId: string): Promise<AtividadeCampo[]> {
  const { inicio, fim } = limitesDeHoje();
  const { data, error } = await supabase
    .from('tasks')
    .select(SELECT)
    .eq('employee_id', colaboradorId)
    .neq('status', 'cancelada')
    .gte('scheduled_start', inicio.toISOString())
    .lt('scheduled_start', fim.toISOString())
    .order('scheduled_start')
    .order('id');
  if (error) throw new Error(error.message);
  return completarClientes(data as unknown as AtividadeBruta[]);
}

/** Só as de hoje (o cache pode ser de um dia anterior), na ordem do dia. */
export function somenteDeHoje(itens: AtividadeCampo[]): AtividadeCampo[] {
  const { inicio, fim } = limitesDeHoje();
  return itens
    .filter((a) => {
      if (!a.scheduled_start || a.status === 'cancelada') return false;
      const t = new Date(a.scheduled_start).getTime();
      return t >= inicio.getTime() && t < fim.getTime();
    })
    .sort((x, y) => new Date(x.scheduled_start!).getTime() - new Date(y.scheduled_start!).getTime() || (x.id < y.id ? -1 : 1));
}

/**
 * Motivo para o técnico ainda não poder sair para / iniciar a atividade (null = pode).
 * Só atividade de hoje, e só a primeira do dia ou a que vem logo depois de uma concluída.
 * `doDia` = agenda de hoje já com as ações da fila do aparelho aplicadas.
 */
export function bloqueioDeInicio(atividade: AtividadeCampo, doDia: AtividadeCampo[]): string | null {
  const ordem = somenteDeHoje(doDia);
  const pos = ordem.findIndex((a) => a.id === atividade.id);
  if (pos === -1) return 'Só dá para iniciar atividades de hoje.';
  if (pos === 0) return null;
  const anterior = ordem[pos - 1];
  if (anterior.status === 'concluida') return null;
  const horario = anterior.scheduled_start
    ? ` (${new Date(anterior.scheduled_start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`
    : '';
  return `Conclua antes a ${anterior.ordem ? `OS ${anterior.ordem.number}` : 'atividade anterior'}${horario}.`;
}

export async function carregarAtividade(id: string): Promise<AtividadeCampo | null> {
  const { data, error } = await supabase.from('tasks').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [atividade] = await completarClientes([data as unknown as AtividadeBruta]);
  return atividade;
}

export async function fotosDaAtividade(taskId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('task_id', taskId)
    .neq('category', 'assinatura')
    .order('created_at');
  if (error) throw new Error(error.message);
  return data as Attachment[];
}

// ---------- Cache local (abrir a agenda sem sinal mostra a última carregada) ----------

const CHAVE_CACHE = 'brv:campo:agenda';

interface CacheAgenda {
  colaboradorId: string;
  em: string;
  itens: AtividadeCampo[];
}

export function salvarCacheAgenda(colaboradorId: string, itens: AtividadeCampo[]) {
  try {
    localStorage.setItem(CHAVE_CACHE, JSON.stringify({ colaboradorId, em: new Date().toISOString(), itens }));
  } catch {
    /* sem espaço: segue sem cache */
  }
}

export function lerCacheAgenda(colaboradorId: string): CacheAgenda | null {
  try {
    const c = JSON.parse(localStorage.getItem(CHAVE_CACHE) ?? 'null') as CacheAgenda | null;
    return c && c.colaboradorId === colaboradorId ? c : null;
  } catch {
    return null;
  }
}

/** Atualiza uma atividade dentro do cache (ex.: depois de abrir os detalhes com sinal). */
export function atualizarNoCache(atividade: AtividadeCampo) {
  if (!atividade.employee_id) return;
  const c = lerCacheAgenda(atividade.employee_id);
  if (!c) return;
  const itens = c.itens.some((a) => a.id === atividade.id)
    ? c.itens.map((a) => (a.id === atividade.id ? atividade : a))
    : c.itens;
  salvarCacheAgenda(atividade.employee_id, itens);
}

export function atividadeDoCache(id: string): AtividadeCampo | null {
  try {
    const c = JSON.parse(localStorage.getItem(CHAVE_CACHE) ?? 'null') as CacheAgenda | null;
    return c?.itens.find((a) => a.id === id) ?? null;
  } catch {
    return null;
  }
}

// ---------- GPS e navegação ----------

export interface Posicao {
  lat: number;
  lng: number;
}

/** Localização atual; null se negada, indisponível ou demorar (a ação segue sem ela). */
export function obterPosicao(tempoMs = 10000): Promise<Posicao | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: tempoMs, maximumAge: 60000 },
    );
  });
}

/** Distância aproximada em metros entre dois pontos (fórmula de haversine). */
export function distanciaMetros(a: Posicao, b: Posicao): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** Grava a posição atual do técnico do login (página Mapa do escritório). */
export async function enviarPosicao(p: Posicao, precisaoM: number): Promise<void> {
  const { error } = await supabase.rpc('registrar_posicao', { p_lat: p.lat, p_lng: p.lng, p_precisao: Math.round(precisaoM) });
  if (error) throw new Error(error.message);
}

/** Sinal de vida: avisa o escritório que o app está aberto e com internet. */
export async function enviarPresenca(): Promise<void> {
  const { error } = await supabase.rpc('registrar_presenca');
  if (error) throw new Error(error.message);
}

export function enderecoDaAtividade(a: AtividadeCampo): EnderecoCampo | null {
  const c = a.ordem?.cliente;
  return a.ordem?.endereco ?? c?.enderecos.find((e) => e.is_primary) ?? c?.enderecos.find((e) => e.active) ?? null;
}

export function textoEnderecoCampo(e: EnderecoCampo): string {
  const via = [e.street, e.number].filter(Boolean).join(', ');
  return [via, e.complement, e.district, `${e.city}/${e.state}`].filter(Boolean).join(' - ');
}

export function linkGoogleMaps(e: EnderecoCampo): string {
  const destino = e.latitude != null && e.longitude != null ? `${e.latitude},${e.longitude}` : textoEnderecoCampo(e);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;
}
