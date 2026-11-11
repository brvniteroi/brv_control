import type {
  BoardCustomerKind,
  BoardPhotoCategory,
  BoardQuoteChannel,
  BoardQuoteStatus,
  BoardStage,
} from '../../types/placas';

export interface EstiloEtapaPlaca {
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
 * Cores centralizadas por etapa do módulo de Reparo de Placas.
 * Mantém a linguagem visual clara do BRV Control (`slate-200`, `emerald` para Pronto, cinza/vermelho suave nas finais).
 */
export const CORES_ETAPA_PLACA: Record<BoardStage, EstiloEtapaPlaca> = {
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
  aguardando_peca: {
    selo: 'border-amber-200 bg-amber-50 text-amber-800',
    ponto: 'bg-amber-500',
    bordaTopo: 'border-t-amber-500',
    chipAtivo: 'border-amber-500 bg-amber-500 text-white',
  },
  em_reparo: {
    selo: 'border-cyan-200 bg-cyan-50 text-cyan-800',
    ponto: 'bg-cyan-500',
    bordaTopo: 'border-t-cyan-500',
    chipAtivo: 'border-cyan-600 bg-cyan-600 text-white',
  },
  teste: {
    selo: 'border-violet-200 bg-violet-50 text-violet-800',
    ponto: 'bg-violet-500',
    bordaTopo: 'border-t-violet-500',
    chipAtivo: 'border-violet-600 bg-violet-600 text-white',
  },
  pronto: {
    selo: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    ponto: 'bg-emerald-500',
    bordaTopo: 'border-t-emerald-500',
    chipAtivo: 'border-emerald-600 bg-emerald-600 text-white',
  },
  entregue: {
    selo: 'border-slate-200 bg-slate-100 text-slate-700',
    ponto: 'bg-slate-500',
    bordaTopo: 'border-t-slate-400',
    chipAtivo: 'border-slate-600 bg-slate-600 text-white',
  },
  sem_conserto: {
    selo: 'border-rose-200 bg-rose-50 text-rose-800',
    ponto: 'bg-rose-500',
    bordaTopo: 'border-t-rose-500',
    chipAtivo: 'border-rose-600 bg-rose-600 text-white',
  },
};

export const CORES_ORCAMENTO_PLACA: Record<
  BoardQuoteStatus,
  { rotulo: string; rotuloPublico: string; selo: string }
> = {
  nao_feito: {
    rotulo: 'Sem orçamento',
    rotuloPublico: 'Aguardando diagnóstico / orçamento',
    selo: 'border-slate-200 bg-slate-50 text-slate-600',
  },
  enviado: {
    rotulo: 'Orçamento enviado',
    rotuloPublico: 'Orçamento enviado para aprovação',
    selo: 'border-amber-300 bg-amber-50 text-amber-800',
  },
  aprovado: {
    rotulo: 'Orçamento aprovado',
    rotuloPublico: 'Orçamento aprovado',
    selo: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  recusado: {
    rotulo: 'Orçamento recusado',
    rotuloPublico: 'Orçamento não aprovado',
    selo: 'border-rose-200 bg-rose-50 text-rose-800',
  },
};

export const CORES_TIPO_CLIENTE_PLACA: Record<
  BoardCustomerKind,
  { rotulo: string; rotuloCurto: string; selo: string }
> = {
  instalador: {
    rotulo: 'Parceiro instalador',
    rotuloCurto: 'Parceiro',
    selo: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  final: {
    rotulo: 'Cliente final',
    rotuloCurto: 'Final',
    selo: 'border-slate-200 bg-slate-100 text-slate-700',
  },
};

export const ROTULO_CANAL_ORCAMENTO: Record<BoardQuoteChannel, string> = {
  whatsapp: 'WhatsApp',
  telefone: 'Telefone',
  presencial: 'Presencial',
  email: 'E-mail',
  link: 'Link do orçamento (cliente aprovou)',
};

export const ROTULO_CATEGORIA_FOTO: Record<BoardPhotoCategory, string> = {
  antes: 'Antes (entrada)',
  depois: 'Depois (reparo/teste)',
  outros: 'Outros',
};

/** Tradução amigável das colunas editáveis para a linha do tempo de histórico. */
export const ROTULO_CAMPO_PLACA: Record<string, string> = {
  equipment_type: 'Tipo de equipamento',
  brand_model: 'Marca / modelo',
  board_code: 'Código da placa',
  peripherals: 'Periféricos / acessórios',
  reported_defect: 'Defeito reclamado',
  no_apparent_defect: 'Sem defeito aparente',
  pickup_technician_id: 'Técnico de retirada',
  bench_technician_id: 'Técnico de bancada',
  error_code: 'Código de erro',
  technical_diagnosis: 'Diagnóstico técnico',
  replaced_components: 'Componentes trocados',
  charged_amount: 'Valor cobrado',
  quote_amount: 'Valor do orçamento',
  quote_validity_days: 'Validade da proposta (dias)',
  quote_technical_opinion: 'Parecer técnico do orçamento',
  customer_document: 'CPF/CNPJ no orçamento',
  customer_address: 'Endereço no orçamento',
};

