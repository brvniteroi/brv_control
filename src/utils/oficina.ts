// Rótulos e regras da Oficina usados pelas telas. As regras de verdade estão no banco
// (trigger workshop_orders_regras); aqui só o espelho para mostrar/esconder botões.
import type {
  CanalResposta,
  EtapaOficina,
  ItemOficina,
  ItemOficinaTela,
  SituacaoPecas,
  UnidadeRecolhida,
} from '../types/oficina';
import type { ProfileRole } from '../types/fsm';

export const ETAPAS_FINAIS: EtapaOficina[] = ['entregue', 'descarte', 'cancelado'];

export const ehFinal = (e: EtapaOficina) => ETAPAS_FINAIS.includes(e);

/** Etapas na ordem do Kanban (as finais ficam na lista de finalizados). */
export const COLUNAS_KANBAN: { etapa: EtapaOficina; rotulo: string; quem: string }[] = [
  { etapa: 'em_transito', rotulo: 'Em trânsito', quem: 'Recolhido pelo técnico, ainda não chegou' },
  { etapa: 'entrada', rotulo: 'Entrada', quem: 'Chegou na loja' },
  { etapa: 'diagnostico', rotulo: 'Diagnóstico', quem: 'Oficina' },
  { etapa: 'aguardando_orcamento', rotulo: 'Aguardando orçamento', quem: 'Atendimento monta no SicWeb' },
  { etapa: 'aguardando_cliente', rotulo: 'Aguardando cliente', quem: 'Orçamento enviado' },
  { etapa: 'aguardando_peca', rotulo: 'Aguardando peça', quem: 'Aprovado, falta peça' },
  { etapa: 'em_reparo', rotulo: 'Em reparo', quem: 'Oficina' },
  { etapa: 'pronto', rotulo: 'Pronto', quem: 'Para devolver ao cliente' },
];

export const ROTULO_ETAPA: Record<EtapaOficina, string> = {
  em_transito: 'Em trânsito',
  entrada: 'Entrada',
  diagnostico: 'Diagnóstico',
  aguardando_orcamento: 'Aguardando orçamento',
  aguardando_cliente: 'Aguardando cliente',
  aguardando_peca: 'Aguardando peça',
  em_reparo: 'Em reparo',
  pronto: 'Pronto',
  entregue: 'Entregue',
  descarte: 'Descartado',
  cancelado: 'Cancelado',
};

export const ROTULO_UNIDADE: Record<UnidadeRecolhida, string> = {
  evaporadora: 'Evaporadora',
  condensadora: 'Condensadora',
  conjunto: 'Evaporadora + condensadora',
  aparelho: 'Aparelho inteiro (janela, portátil...)',
  outro: 'Outra peça',
};

/** Rótulo curto (cartão do Kanban e etiqueta). */
export const ROTULO_UNIDADE_CURTO: Record<UnidadeRecolhida, string> = {
  evaporadora: 'Evaporadora',
  condensadora: 'Condensadora',
  conjunto: 'Evap. + cond.',
  aparelho: 'Aparelho inteiro',
  outro: 'Outra peça',
};

export const ROTULO_PECAS: Record<SituacaoPecas, string> = {
  nao_necessario: 'Sem peça',
  a_comprar: 'Comprar peça',
  comprada: 'Peça comprada',
  chegou: 'Peça chegou',
};

export const ROTULO_CANAL: Record<CanalResposta, string> = {
  whatsapp: 'WhatsApp',
  telefone: 'Telefone',
  presencial: 'Pessoalmente',
  email: 'E-mail',
};

/** Tipos mais comuns (o campo é livre). */
export const TIPOS_EQUIPAMENTO = [
  'Split Hi-Wall',
  'Split Piso-Teto',
  'Split Cassete',
  'Janela (ACJ)',
  'Portátil',
  'Multi-split',
  'Inverter',
  'Outro',
];

export const TENSOES = ['127V', '220V', '380V'];

/** "OS 17300" ou "OS 17300 · item 2" (itens importados sem OS: a referência antiga). */
export function numeroItem(item: Pick<ItemOficinaTela, 'os_number' | 'item_number' | 'legacy_reference'>, totalNaOs?: number): string {
  if (item.os_number == null) return item.legacy_reference ?? 'Sem OS';
  const comItem = item.item_number > 1 || (totalNaOs ?? 1) > 1;
  return comItem ? `OS ${item.os_number} · item ${item.item_number}` : `OS ${item.os_number}`;
}

/** Ex.: "Split Hi-Wall Midea · Evaporadora". */
export function descricaoItem(item: Pick<ItemOficina, 'equipment_type' | 'brand' | 'units_collected'>): string {
  const base = [item.equipment_type, item.brand].filter(Boolean).join(' ');
  return `${base} · ${ROTULO_UNIDADE_CURTO[item.units_collected]}`;
}

export const valorEmReais = (v: number | string | null | undefined) =>
  v == null || v === '' ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Dias desde a entrada na loja (ou desde o registro, se ainda em trânsito). */
export function diasNaOficina(item: Pick<ItemOficina, 'received_at' | 'created_at' | 'finished_at'>): number {
  const inicio = new Date(item.received_at ?? item.created_at).getTime();
  const fim = item.finished_at ? new Date(item.finished_at).getTime() : Date.now();
  return Math.max(0, Math.floor((fim - inicio) / 86_400_000));
}

const ehEscritorio = (papel: ProfileRole | undefined) => papel === 'admin' || papel === 'escritorio';

/** Mudanças de etapa que a bancada (papel oficina) pode fazer. */
const PASSOS_BANCADA: [EtapaOficina, EtapaOficina][] = [
  ['em_transito', 'entrada'],
  ['entrada', 'diagnostico'],
  ['diagnostico', 'entrada'],
  ['diagnostico', 'aguardando_orcamento'],
  ['aguardando_orcamento', 'diagnostico'],
  ['aguardando_peca', 'em_reparo'],
  ['em_reparo', 'aguardando_peca'],
  ['em_reparo', 'pronto'],
  ['pronto', 'em_reparo'],
];

/**
 * Pode mudar o item para esta etapa? Mesmas regras do banco; a tela usa para mostrar
 * botões e aceitar o arraste no Kanban. Entregue, descarte e cancelado têm botões próprios
 * (pedem dados), por isso não entram aqui.
 */
export function podeMover(item: ItemOficina, para: EtapaOficina, papel: ProfileRole | undefined): boolean {
  if (item.status === para || ehFinal(item.status) || ehFinal(para)) return false;
  if (!ehEscritorio(papel)) {
    const passo = PASSOS_BANCADA.some(([de, a]) => de === item.status && a === para);
    const garantia = item.is_warranty && item.status === 'diagnostico' && (para === 'aguardando_peca' || para === 'em_reparo');
    if (!passo && !garantia) return false;
    if (papel !== 'oficina') return false;
  }
  return motivoBloqueio(item, para) === null;
}

/** Por que o item não pode ir para a etapa (null = pode). Texto para mostrar ao usuário. */
export function motivoBloqueio(item: ItemOficina, para: EtapaOficina): string | null {
  if ((para === 'aguardando_peca' || para === 'em_reparo') && !(item.decision === 'aprovado' || item.is_warranty)) {
    return 'Falta registrar a aprovação do cliente.';
  }
  if (para === 'pronto' && !(item.decision || item.is_warranty)) {
    return 'Falta registrar a resposta do cliente ao orçamento.';
  }
  return null;
}

/** Botões do escritório disponíveis no item. */
export function acoesEscritorio(item: ItemOficina) {
  const aberto = !ehFinal(item.status);
  return {
    registrarOrcamento: aberto && ['diagnostico', 'aguardando_orcamento', 'aguardando_cliente'].includes(item.status),
    registrarResposta: aberto && ['aguardando_orcamento', 'aguardando_cliente'].includes(item.status),
    autorizarDescarte: aberto && item.status !== 'em_transito',
    criarOsDevolucao: item.status === 'pronto' && !item.return_service_order_id,
    marcarEntregue: item.status === 'pronto',
    cancelar: aberto,
  };
}

/** Texto para o WhatsApp avisando o cliente do orçamento (o orçamento em si sai do SicWeb). */
export function textoOrcamentoWhatsApp(item: ItemOficinaTela): string {
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const valor = item.quote_amount != null && item.quote_amount !== '' ? ` no valor de ${valorEmReais(item.quote_amount)}` : '';
  const ref = item.quote_reference ? ` (orçamento nº ${item.quote_reference})` : '';
  return (
    `${saudacao}, ${item.customer_name ?? ''}. Aqui é da BRV Climatização. ` +
    `Referente à ${numeroItem(item)}: ${descricaoItem(item)}.` +
    (item.diagnosis ? `\nDiagnóstico: ${item.diagnosis}` : '') +
    `\nSegue o orçamento${ref}${valor}. Aguardamos sua autorização para seguir com o conserto.`
  );
}
