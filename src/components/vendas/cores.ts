// Cores e rótulos centralizados para Catálogo, Orçamentos, Vendas e Notas Fiscais.
// Padrão visual idêntico a STATUS_OS (src/utils/ordens.ts).

import type { FinancialPaymentMethod } from '../../types/financeiro';
import type {
  CatalogItemKind,
  QuoteDisplayStatus,
  QuoteResponseChannel,
  SaleDisplayStatus,
  SaleDocumentModel,
  SaleDocumentStatus,
  SaleOriginType,
} from '../../types/vendas';

export interface EstiloSelo {
  rotulo: string;
  selo: string;
  ponto: string;
}

export const CORES_TIPO_ITEM: Record<CatalogItemKind, EstiloSelo> = {
  produto: {
    rotulo: 'Produto',
    selo: 'border-slate-200 bg-slate-100 text-slate-700',
    ponto: 'bg-slate-500',
  },
  servico: {
    rotulo: 'Serviço',
    selo: 'border-blue-100 bg-blue-50 text-blue-700',
    ponto: 'bg-blue-500',
  },
};

export const CORES_SITUACAO_ORCAMENTO: Record<QuoteDisplayStatus, EstiloSelo> = {
  rascunho: {
    rotulo: 'Rascunho',
    selo: 'border-slate-200 bg-slate-100 text-slate-600',
    ponto: 'bg-slate-400',
  },
  enviado: {
    rotulo: 'Enviado',
    selo: 'border-blue-100 bg-blue-50 text-blue-700',
    ponto: 'bg-blue-500',
  },
  aprovado: {
    rotulo: 'Aprovado',
    selo: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    ponto: 'bg-emerald-500',
  },
  recusado: {
    rotulo: 'Recusado',
    selo: 'border-red-100 bg-red-50 text-red-700',
    ponto: 'bg-red-500',
  },
  convertido: {
    rotulo: 'Convertido',
    selo: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    ponto: 'bg-emerald-500',
  },
  vencido: {
    rotulo: 'Vencido',
    selo: 'border-amber-100 bg-amber-50 text-amber-700',
    ponto: 'bg-amber-500',
  },
};

export const CORES_SITUACAO_VENDA: Record<SaleDisplayStatus, EstiloSelo> = {
  paga: {
    rotulo: 'Paga',
    selo: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    ponto: 'bg-emerald-500',
  },
  parcial: {
    rotulo: 'Parcial',
    selo: 'border-amber-100 bg-amber-50 text-amber-700',
    ponto: 'bg-amber-500',
  },
  aberta: {
    rotulo: 'Aberta',
    selo: 'border-blue-100 bg-blue-50 text-blue-700',
    ponto: 'bg-blue-500',
  },
  cancelada: {
    rotulo: 'Cancelada',
    selo: 'border-red-100 bg-red-50 text-red-700',
    ponto: 'bg-red-500',
  },
};

export const CORES_STATUS_NOTA: Record<SaleDocumentStatus, EstiloSelo> = {
  nao_emitida: {
    rotulo: 'Pendente',
    selo: 'border-slate-200 bg-slate-100 text-slate-600',
    ponto: 'bg-slate-400',
  },
  emitindo: {
    rotulo: 'Emitindo...',
    selo: 'border-blue-100 bg-blue-50 text-blue-700',
    ponto: 'bg-blue-500',
  },
  emitida: {
    rotulo: 'Emitida',
    selo: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    ponto: 'bg-emerald-500',
  },
  cancelada: {
    rotulo: 'Cancelada',
    selo: 'border-slate-200 bg-slate-100 text-slate-500',
    ponto: 'bg-slate-400',
  },
  erro: {
    rotulo: 'Erro na emissão',
    selo: 'border-red-100 bg-red-50 text-red-700',
    ponto: 'bg-red-500',
  },
};

export const ROTULO_MODELO_NOTA: Record<SaleDocumentModel, string> = {
  nfce: 'NFC-e',
  nfe: 'NF-e',
  nfse: 'NFS-e',
};

export const ROTULO_FORMA_PAGAMENTO: Record<FinancialPaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  debito: 'Cartão de Débito',
  credito: 'Cartão de Crédito',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  cheque: 'Cheque',
};

export const ROTULO_FORMA_PAGAMENTO_CURTO: Record<FinancialPaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  debito: 'Débito',
  credito: 'Crédito',
  boleto: 'Boleto',
  transferencia: 'Transf.',
  cheque: 'Cheque',
};

export const ROTULO_CANAL_ORCAMENTO: Record<QuoteResponseChannel, string> = {
  link: 'Pelo link público',
  whatsapp: 'WhatsApp',
  telefone: 'Telefone',
  presencial: 'Presencialmente',
  email: 'E-mail',
};

export const ROTULO_ORIGEM_VENDA: Record<SaleOriginType, string> = {
  balcao: 'Balcão',
  orcamento: 'Orçamento',
  os: 'Ordem de Serviço',
};

export const ORIGENS_MERCADORIA: readonly { valor: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; rotulo: string }[] = [
  { valor: 0, rotulo: '0 — Nacional' },
  { valor: 1, rotulo: '1 — Estrangeira (importação direta)' },
  { valor: 2, rotulo: '2 — Estrangeira (adquirida no mercado interno)' },
  { valor: 3, rotulo: '3 — Nacional (conteúdo de importação > 40% e ≤ 70%)' },
  { valor: 4, rotulo: '4 — Nacional (processos produtivos básicos)' },
  { valor: 5, rotulo: '5 — Nacional (conteúdo de importação ≤ 40%)' },
  { valor: 6, rotulo: '6 — Estrangeira (importação direta, sem similar nacional)' },
  { valor: 7, rotulo: '7 — Estrangeira (mercado interno, sem similar nacional)' },
  { valor: 8, rotulo: '8 — Nacional (conteúdo de importação > 70%)' },
];

export const UNIDADES_CATALOGO: readonly string[] = ['UN', 'M', 'KG', 'CX', 'PAR', 'KIT', 'ROLO', 'L', 'H', 'SRV'];
