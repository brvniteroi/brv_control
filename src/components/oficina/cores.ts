import type { EtapaOficina, ItemOficinaTela, SituacaoPecas } from '../../types/oficina';

export interface EstiloEtapa {
  /** Classes do selo (fundo, texto e borda). */
  selo: string;
  /** Bolinha colorida de cabeçalho/indicador. */
  ponto: string;
  /** Borda superior da coluna no Kanban. */
  bordaTopo: string;
  /** Estilo do chip selecionado no seletor de etapas do celular. */
  chipAtivo: string;
}

/**
 * Cores centralizadas por etapa da Oficina.
 * Regra visual: finais em cinza, "Pronto" em verde e "Aguardando cliente" em âmbar.
 */
export const CORES_ETAPA: Record<EtapaOficina, EstiloEtapa> = {
  em_transito: {
    selo: 'border-sky-200 bg-sky-50 text-sky-700',
    ponto: 'bg-sky-500',
    bordaTopo: 'border-t-sky-500',
    chipAtivo: 'border-sky-600 bg-sky-600 text-white',
  },
  entrada: {
    selo: 'border-blue-200 bg-blue-50 text-blue-700',
    ponto: 'bg-blue-500',
    bordaTopo: 'border-t-blue-500',
    chipAtivo: 'border-blue-600 bg-blue-600 text-white',
  },
  diagnostico: {
    selo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    ponto: 'bg-indigo-500',
    bordaTopo: 'border-t-indigo-500',
    chipAtivo: 'border-indigo-600 bg-indigo-600 text-white',
  },
  aguardando_orcamento: {
    selo: 'border-violet-200 bg-violet-50 text-violet-700',
    ponto: 'bg-violet-500',
    bordaTopo: 'border-t-violet-500',
    chipAtivo: 'border-violet-600 bg-violet-600 text-white',
  },
  aguardando_cliente: {
    selo: 'border-amber-300 bg-amber-50 text-amber-800',
    ponto: 'bg-amber-500',
    bordaTopo: 'border-t-amber-500',
    chipAtivo: 'border-amber-500 bg-amber-500 text-white',
  },
  aguardando_peca: {
    selo: 'border-orange-200 bg-orange-50 text-orange-800',
    ponto: 'bg-orange-500',
    bordaTopo: 'border-t-orange-500',
    chipAtivo: 'border-orange-600 bg-orange-600 text-white',
  },
  em_reparo: {
    selo: 'border-cyan-200 bg-cyan-50 text-cyan-800',
    ponto: 'bg-cyan-500',
    bordaTopo: 'border-t-cyan-500',
    chipAtivo: 'border-cyan-600 bg-cyan-600 text-white',
  },
  pronto: {
    selo: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    ponto: 'bg-emerald-500',
    bordaTopo: 'border-t-emerald-500',
    chipAtivo: 'border-emerald-600 bg-emerald-600 text-white',
  },
  entregue: {
    selo: 'border-slate-200 bg-slate-100 text-slate-700',
    ponto: 'bg-slate-400',
    bordaTopo: 'border-t-slate-400',
    chipAtivo: 'border-slate-600 bg-slate-600 text-white',
  },
  descarte: {
    selo: 'border-slate-200 bg-slate-100 text-slate-700',
    ponto: 'bg-slate-400',
    bordaTopo: 'border-t-slate-400',
    chipAtivo: 'border-slate-600 bg-slate-600 text-white',
  },
  cancelado: {
    selo: 'border-slate-200 bg-slate-100 text-slate-600',
    ponto: 'bg-slate-400',
    bordaTopo: 'border-t-slate-400',
    chipAtivo: 'border-slate-600 bg-slate-600 text-white',
  },
};

export const CORES_PECAS: Record<SituacaoPecas, string> = {
  nao_necessario: 'border-slate-200 bg-slate-50 text-slate-600',
  a_comprar: 'border-rose-200 bg-rose-50 text-rose-700',
  comprada: 'border-amber-200 bg-amber-50 text-amber-800',
  chegou: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

/** Tradução dos nomes das colunas de `workshop_orders` para o histórico de alterações. */
export const ROTULO_CAMPO_HISTORICO: Record<string, string> = {
  equipment_type: 'Tipo de equipamento',
  units_collected: 'O que veio',
  brand: 'Marca',
  model: 'Modelo',
  serial_number: 'Nº de série',
  capacity_btu: 'BTUs',
  voltage: 'Tensão',
  accessories: 'Acessórios',
  reported_defect: 'Defeito relatado',
  field_report: 'Relato do técnico de campo',
  intake_notes: 'Conferência na chegada',
  diagnosis: 'Diagnóstico',
  parts_needed: 'Peças necessárias',
  parts_status: 'Situação das peças',
  repair_notes: 'Serviço executado',
  pickup_employee_id: 'Técnico de retirada',
  bench_employee_id: 'Técnico da oficina',
  equipment_id: 'Equipamento cadastrado',
  is_warranty: 'Retorno em garantia',
  warranty_origin_id: 'Origem da garantia',
  quote_reference: 'Nº do orçamento (SicWeb)',
  quote_amount: 'Valor do orçamento',
  quote_sent_at: 'Envio do orçamento',
  return_service_order_id: 'OS de devolução',
  service_order_id: 'OS de origem',
  task_id: 'Atividade de origem',
};

/**
 * Calcula quantos itens conhecidos existem por OS para `numeroItem(item, totalNaOs)` mostrar
 * "OS 17300 · item 1" também no item 1 quando houver mais de um item na mesma OS.
 */
export function mapaTotaisPorOs(itens: Pick<ItemOficinaTela, 'service_order_id' | 'item_number'>[]): Map<string, number> {
  const contagem = new Map<string, number>();
  for (const item of itens) {
    if (!item.service_order_id) continue;
    const atual = contagem.get(item.service_order_id) ?? 0;
    contagem.set(item.service_order_id, Math.max(atual + 1, item.item_number));
  }
  return contagem;
}

