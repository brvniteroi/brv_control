// Selos e rótulos do módulo Financeiro (Rodada 2), seguindo o formato de STATUS_OS (src/utils/ordens.ts).

import type {
  CashEntryKind,
  FieldReceiptStatus,
  FinancialOriginType,
} from '../../types/financeiro';

export interface EstiloSeloFinanceiro {
  rotulo: string;
  selo: string;
}

export const CORES_SITUACAO_RECEBIMENTO: Record<FieldReceiptStatus, EstiloSeloFinanceiro> = {
  a_conferir: {
    rotulo: 'A conferir',
    selo: 'border-amber-100 bg-amber-50 text-amber-700',
  },
  confirmado: {
    rotulo: 'Confirmado',
    selo: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  },
  divergente: {
    rotulo: 'Divergente',
    selo: 'border-red-100 bg-red-50 text-red-700',
  },
};

export const ROTULO_ORIGEM_MOVIMENTO: Record<FinancialOriginType, string> = {
  venda: 'Venda',
  os: 'Ordem de Serviço',
  avulso: 'Avulso',
  transferencia: 'Transferência',
  caixa: 'Caixa',
  tarifa_cartao: 'Tarifa de cartão',
};

export const ROTULO_TIPO_LANCAMENTO_CAIXA: Record<CashEntryKind, string> = {
  venda_dinheiro: 'Venda em dinheiro',
  recebimento_os: 'Recebimento de OS',
  reforco: 'Reforço (suprimento)',
  sangria: 'Retirada (sangria)',
};

