// Módulo Oficina. Espelha supabase/migrations/20261108130000_oficina_base.sql: ao mudar lá, mudar aqui.

export type EtapaOficina =
  | 'em_transito'
  | 'entrada'
  | 'diagnostico'
  | 'aguardando_orcamento'
  | 'aguardando_cliente'
  | 'aguardando_peca'
  | 'em_reparo'
  | 'pronto'
  | 'entregue'
  | 'descarte'
  | 'cancelado';

/** O que foi recolhido do cliente. */
export type UnidadeRecolhida = 'evaporadora' | 'condensadora' | 'conjunto' | 'aparelho' | 'outro';

export type SituacaoPecas = 'nao_necessario' | 'a_comprar' | 'comprada' | 'chegou';

export type DecisaoCliente = 'aprovado' | 'recusado';

/** Por onde o cliente respondeu (orçamento ou autorização de descarte). */
export type CanalResposta = 'whatsapp' | 'telefone' | 'presencial' | 'email';

/** Linha de public.workshop_orders. */
export interface ItemOficina {
  id: string;
  kind: 'equipamento' | 'placa';
  service_order_id: string | null;
  item_number: number;
  task_id: string | null;
  customer_id: string;
  equipment_id: string | null;
  status: EtapaOficina;

  equipment_type: string;
  units_collected: UnidadeRecolhida;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  capacity_btu: number | null;
  voltage: string | null;
  accessories: string | null;
  reported_defect: string | null;
  field_report: string | null;
  intake_notes: string | null;

  diagnosis: string | null;
  parts_needed: string | null;
  parts_status: SituacaoPecas;
  repair_notes: string | null;
  pickup_employee_id: string | null;
  bench_employee_id: string | null;

  is_warranty: boolean;
  warranty_origin_id: string | null;

  quote_reference: string | null;
  /** NUMERIC chega como número ou texto, conforme o driver: usar Number() */
  quote_amount: number | string | null;
  quote_sent_at: string | null;

  decision: DecisaoCliente | null;
  decision_channel: CanalResposta | null;
  decision_note: string | null;
  decision_at: string | null;
  decision_by: string | null;

  discard_channel: CanalResposta | null;
  discard_note: string | null;
  discard_authorized_at: string | null;
  discard_authorized_by: string | null;

  return_service_order_id: string | null;
  cancel_reason: string | null;

  received_at: string | null;
  received_by: string | null;
  ready_at: string | null;
  finished_at: string | null;

  legacy_table: string | null;
  legacy_id: string | null;
  legacy_reference: string | null;

  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Linha da visão public.oficina_itens: o item com os nomes para a tela. */
export interface ItemOficinaTela extends ItemOficina {
  os_number: number | null;
  customer_name: string | null;
  pickup_employee_name: string | null;
  bench_employee_name: string | null;
  return_os_number: number | null;
  return_os_status: string | null;
  warranty_origin_item: number | null;
  warranty_origin_os_number: number | null;
}

/** Dados que as telas informam ao criar um item (o resto vem do banco). */
export interface NovoItemOficina {
  equipment_type: string;
  units_collected: UnidadeRecolhida;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  capacity_btu?: number | null;
  voltage?: string | null;
  accessories?: string | null;
  reported_defect?: string | null;
  field_report?: string | null;
  intake_notes?: string | null;
  equipment_id?: string | null;
  is_warranty?: boolean;
  warranty_origin_id?: string | null;
}

/** Campos que a bancada (papel oficina) pode alterar. */
export type CamposBancada = Partial<
  Pick<
    ItemOficina,
    | 'equipment_type'
    | 'units_collected'
    | 'brand'
    | 'model'
    | 'serial_number'
    | 'capacity_btu'
    | 'voltage'
    | 'accessories'
    | 'reported_defect'
    | 'intake_notes'
    | 'diagnosis'
    | 'parts_needed'
    | 'parts_status'
    | 'repair_notes'
    | 'bench_employee_id'
    | 'equipment_id'
  >
>;

/** Campos que só o escritório altera (além dos da bancada). */
export type CamposEscritorio = CamposBancada &
  Partial<
    Pick<
      ItemOficina,
      | 'field_report'
      | 'pickup_employee_id'
      | 'is_warranty'
      | 'warranty_origin_id'
      | 'quote_reference'
      | 'quote_sent_at'
      | 'return_service_order_id'
    >
  > & { quote_amount?: number | null };

export type EventoOficinaTipo = 'criado' | 'etapa' | 'alteracao' | 'decisao' | 'descarte_autorizado' | 'nota';

/** Linha de public.workshop_order_events (histórico; ninguém altera nem apaga). */
export interface EventoOficina {
  id: number;
  workshop_order_id: string;
  event: EventoOficinaTipo;
  from_status: EtapaOficina | null;
  to_status: EtapaOficina | null;
  /** { campo: [antes, depois] } */
  changes: Record<string, [unknown, unknown]> | null;
  note: string | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
}

/** Resultado de oficina_buscar_os (entrada na oficina a partir do número da OS). */
export interface OsParaOficina {
  service_order_id: string;
  os_number: number;
  os_status: string;
  customer_id: string;
  customer_name: string;
  bairro: string | null;
  cidade: string | null;
  description: string | null;
  task_id: string | null;
  technician_id: string | null;
  technician_name: string | null;
  technician_notes: string | null;
  task_finished_at: string | null;
  itens_na_oficina: number;
}

export type SituacaoImpressao = 'pendente' | 'imprimindo' | 'impressa' | 'falhou' | 'cancelada';

/** Linha de public.print_jobs (fila da Elgin). */
export interface PedidoImpressao {
  id: string;
  printer: string;
  kind: 'etiqueta_oficina' | 'teste';
  workshop_order_id: string | null;
  payload: string;
  copies: number;
  status: SituacaoImpressao;
  error: string | null;
  attempts: number;
  agent: string | null;
  requested_by: string | null;
  requested_by_name: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

/** Linha de public.print_agents (sinal de vida do agente no servidor da loja). */
export interface AgenteImpressao {
  id: string;
  printer: string;
  version: string | null;
  info: Record<string, unknown> | null;
  last_seen_at: string;
}
