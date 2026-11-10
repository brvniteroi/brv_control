import type { Attachment, ProfileRole } from '../../types/fsm';
import type { BoardOrder, BoardPhoto, BoardStage, PlacaFichaTecnica } from '../../types/placas';
import { valorEmReais } from '../../utils/oficina';
import { formatarData } from '../../utils/ordens';
import { ROTULO_CATEGORIA_FOTO } from './cores';

/** Limite de dias desde a entrada (placa ainda em aberto, inclusive `pronto`) para marcar como `"Encalhada"`. */
export const DIAS_PLACA_ENCALHADA = 4;

/** Prazo legal de garantia do reparo de placa em dias corridos após a saída (`entregue`). */
export const PRAZO_GARANTIA_PLACA_DIAS = 90;

/**
 * Constante única que governa se a página pública `/placa/:token` revela o valor em reais do orçamento.
 * Por decisão do negócio, o parceiro vê apenas o estado do orçamento, nunca o valor.
 */
export const MOSTRAR_VALOR_ORCAMENTO = false;

/** Quantidade de placas finalizadas por página na aba `"Finalizadas"`. */
export const PLACAS_FINALIZADAS_POR_PAGINA = 50;

export interface DefinicaoEtapaPlaca {
  etapa: BoardStage;
  rotulo: string;
  rotuloCurto: string;
  quemMexe: string;
  final: boolean;
}

/** Todas as etapas da placa na ordem do fluxo do laboratório. */
export const ETAPAS_PLACA: readonly DefinicaoEtapaPlaca[] = [
  {
    etapa: 'entrada',
    rotulo: 'Entrada / Triagem',
    rotuloCurto: 'Entrada',
    quemMexe: 'Balcão / Recepção',
    final: false,
  },
  {
    etapa: 'diagnostico',
    rotulo: 'Diagnóstico / Orçamento',
    rotuloCurto: 'Diagnóstico',
    quemMexe: 'Bancada e Escritório',
    final: false,
  },
  {
    etapa: 'aguardando_peca',
    rotulo: 'Aguardando Peça',
    rotuloCurto: 'Aguardando Peça',
    quemMexe: 'Bancada / Compras',
    final: false,
  },
  {
    etapa: 'em_reparo',
    rotulo: 'Em Reparo',
    rotuloCurto: 'Em Reparo',
    quemMexe: 'Bancada',
    final: false,
  },
  {
    etapa: 'teste',
    rotulo: 'Teste em Simulador',
    rotuloCurto: 'Teste',
    quemMexe: 'Bancada',
    final: false,
  },
  {
    etapa: 'pronto',
    rotulo: 'Pronto para Entrega',
    rotuloCurto: 'Pronto',
    quemMexe: 'Balcão / Expedição',
    final: false,
  },
  {
    etapa: 'entregue',
    rotulo: 'Entregue / Faturado',
    rotuloCurto: 'Entregue',
    quemMexe: 'Escritório / Admin',
    final: true,
  },
  {
    etapa: 'sem_conserto',
    rotulo: 'Sem Conserto / Devolvido',
    rotuloCurto: 'Sem Conserto',
    quemMexe: 'Escritório / Admin',
    final: true,
  },
];

/** As 6 colunas exibidas na aba `"Em andamento"` do Kanban. */
export const ETAPAS_KANBAN_PLACA: readonly DefinicaoEtapaPlaca[] = ETAPAS_PLACA.filter((e) => !e.final);

/** Etapas finais exibidas na aba `"Finalizadas"`. */
export const ETAPAS_FINAIS_PLACA: readonly BoardStage[] = ['entregue', 'sem_conserto'];

export const ROTULO_ETAPA_PLACA: Record<BoardStage, string> = {
  entrada: 'Entrada / Triagem',
  diagnostico: 'Diagnóstico / Orçamento',
  aguardando_peca: 'Aguardando Peça',
  em_reparo: 'Em Reparo',
  teste: 'Teste em Simulador',
  pronto: 'Pronto para Entrega',
  entregue: 'Entregue / Faturado',
  sem_conserto: 'Sem Conserto / Devolvido',
};

export const ROTULO_ETAPA_CURTO_PLACA: Record<BoardStage, string> = {
  entrada: 'Entrada',
  diagnostico: 'Diagnóstico',
  aguardando_peca: 'Aguard. Peça',
  em_reparo: 'Em Reparo',
  teste: 'Teste',
  pronto: 'Pronto',
  entregue: 'Entregue',
  sem_conserto: 'Sem Conserto',
};

export const SUGESTOES_TIPO_EQUIPAMENTO_PLACA: readonly string[] = [
  'Split Inverter',
  'Split Hi-Wall Inverter',
  'Split Piso-Teto Inverter',
  'Split Cassete Inverter',
  'Multi-Split Inverter',
  'VRF / VRV',
  'Cortina de Ar / ACJ Eletrônico',
];

export function ehEtapaFinalPlaca(etapa: BoardStage): boolean {
  return ETAPAS_FINAIS_PLACA.includes(etapa);
}

/** Normaliza texto para busca sem acento e em minúsculas (independente de `services/clientes.ts`). */
export function semAcento(termo: string): string {
  return termo
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');
const tresDigitos = (n: number) => String(n).padStart(3, '0');

/** Prefixo diário `OS-DDMMAA-` usado exclusivamente por `gerarNumeroPlaca` e `proximaSequenciaDiaPlaca`. */
export function prefixoDiaPlaca(data: Date): string {
  const dia = doisDigitos(data.getDate());
  const mes = doisDigitos(data.getMonth() + 1);
  const ano = doisDigitos(data.getFullYear() % 100);
  return `OS-${dia}${mes}${ano}-`;
}

/**
 * ÚNICO lugar do front-end autorizado a montar o número próprio da placa no padrão `OS-DDMMAA-NNN`.
 * Ex.: `gerarNumeroPlaca(new Date(2026, 10, 9), 1)` -> `"OS-091126-001"`.
 */
export function gerarNumeroPlaca(data: Date, sequenciaDoDia: number): string {
  const seq = Math.max(1, Math.floor(sequenciaDoDia));
  return `${prefixoDiaPlaca(data)}${tresDigitos(seq)}`;
}

/** Descobre o próximo sequencial `NNN` do dia a partir dos `board_number` já existentes. */
export function proximaSequenciaDiaPlaca(numerosExistentes: readonly string[], data: Date): number {
  const prefixo = prefixoDiaPlaca(data);
  let maior = 0;
  for (const num of numerosExistentes) {
    if (!num.startsWith(prefixo)) continue;
    const sufixo = Number.parseInt(num.slice(prefixo.length), 10);
    if (!Number.isNaN(sufixo) && sufixo > maior) {
      maior = sufixo;
    }
  }
  return maior + 1;
}

/**
 * Dias inteiros corridos desde a ENTRADA da placa (`created_at`); não zera ao mudar de etapa (decisão do Braulio,
 * 2026-11-09). Para finalizadas, congela na saída (`finished_at`) = tempo total de reparo, base do futuro relatório
 * de tempo médio de reparo.
 */
export function diasDesdeEntrada(
  placa: Pick<BoardOrder, 'created_at' | 'finished_at' | 'status'>,
  agoraMs: number = Date.now(),
): number {
  const inicio = new Date(placa.created_at).getTime();
  if (Number.isNaN(inicio)) return 0;
  const fim =
    ehEtapaFinalPlaca(placa.status) && placa.finished_at
      ? new Date(placa.finished_at).getTime()
      : agoraMs;
  return Math.max(0, Math.floor((fim - inicio) / 86_400_000));
}

/**
 * Placa em aberto (inclusive `pronto`, ainda não entregue) há 4 dias ou mais desde a entrada = `"Encalhada"`.
 */
export function placaEncalhada(
  placa: Pick<BoardOrder, 'status' | 'created_at' | 'finished_at' | 'archived' | 'cancelled_entry'>,
  agoraMs: number = Date.now(),
): boolean {
  if (placa.archived || placa.cancelled_entry) return false;
  if (ehEtapaFinalPlaca(placa.status)) return false;
  return diasDesdeEntrada(placa, agoraMs) >= DIAS_PLACA_ENCALHADA;
}

/** Soma 90 dias corridos à data de saída (`finished_at`) para obter a validade da garantia legal. */
export function calcularValidadeGarantia(finishedAt: string | null | undefined): string | null {
  if (!finishedAt) return null;
  const base = new Date(finishedAt);
  if (Number.isNaN(base.getTime())) return null;
  const fim = new Date(base.getTime() + PRAZO_GARANTIA_PLACA_DIAS * 86_400_000);
  return fim.toISOString();
}

/** Verifica se a garantia de 90 dias ainda está vigente na data de referência. */
export function garantiaVigente(
  finishedAt: string | null | undefined,
  agoraMs: number = Date.now(),
): boolean {
  const limiteIso = calcularValidadeGarantia(finishedAt);
  if (!limiteIso) return false;
  return new Date(limiteIso).getTime() >= agoraMs;
}

export function ehEscritorioOuAdminPlaca(papel: ProfileRole | undefined): boolean {
  return papel === 'admin' || papel === 'escritorio';
}

/**
 * Explica por que uma placa não pode ir para `destino` com o `papel` informado (`null` = permitido).
 * O banco repetirá a mesma regra em trigger/RLS.
 */
export function motivoBloqueioPlaca(
  placa: Pick<
    BoardOrder,
    'status' | 'archived' | 'cancelled_entry' | 'quote_status' | 'is_warranty'
  >,
  destino: BoardStage,
  papel: ProfileRole | undefined,
): string | null {
  if (!papel || papel === 'tecnico') {
    return 'Seu perfil não movimenta placas do laboratório.';
  }
  if (placa.cancelled_entry) {
    return 'Entrada cancelada não pode mudar de etapa.';
  }
  if (placa.archived) {
    return 'Placa arquivada não pode mudar de etapa.';
  }
  if (placa.status === destino) {
    return 'A placa já está nesta etapa.';
  }
  if (ehEtapaFinalPlaca(placa.status)) {
    return 'Placa finalizada só pode voltar ao Kanban pelo botão Reabrir (administrador).';
  }
  if (ehEtapaFinalPlaca(destino) && !ehEscritorioOuAdminPlaca(papel)) {
    return 'Apenas o escritório ou administrador pode finalizar a entrega ou devolução da placa.';
  }

  const exigeAprovacao: BoardStage[] = ['aguardando_peca', 'em_reparo', 'teste', 'pronto', 'entregue'];
  if (exigeAprovacao.includes(destino) && !placa.is_warranty && placa.quote_status !== 'aprovado') {
    if (placa.quote_status === 'recusado') {
      return 'O orçamento foi recusado pelo cliente; finalize como Sem Conserto / Devolvido.';
    }
    return 'Falta registrar a aprovação do orçamento pelo cliente.';
  }

  if (destino === 'entregue' && placa.status !== 'pronto') {
    return 'Passe a placa pela etapa Pronto para Entrega antes de registrar a saída.';
  }

  return null;
}

/** Verdadeiro se `papel` pode mover `placa` para `destino`. */
export function podeMoverPlaca(
  placa: Pick<
    BoardOrder,
    'status' | 'archived' | 'cancelled_entry' | 'quote_status' | 'is_warranty'
  >,
  destino: BoardStage,
  papel: ProfileRole | undefined,
): boolean {
  return motivoBloqueioPlaca(placa, destino, papel) === null;
}

/** Etapa anterior e próxima no Kanban para os botões rápidos `←` e `→` do cartão. */
export function etapasAdjacentesKanban(etapaAtual: BoardStage): {
  anterior: BoardStage | null;
  proxima: BoardStage | null;
} {
  const idx = ETAPAS_KANBAN_PLACA.findIndex((c) => c.etapa === etapaAtual);
  if (idx === -1) return { anterior: null, proxima: null };
  return {
    anterior: idx > 0 ? ETAPAS_KANBAN_PLACA[idx - 1].etapa : null,
    proxima: idx < ETAPAS_KANBAN_PLACA.length - 1 ? ETAPAS_KANBAN_PLACA[idx + 1].etapa : null,
  };
}

/** Gera URL pública completa de acompanhamento (`/placa/:token`). */
export function linkPublicoPlaca(publicToken: string): string {
  const origem = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origem}/placa/${publicToken}`;
}

/** Converte `BoardPhoto` para o formato esperado por `VisualizadorFotos` sem alterá-lo. */
export function converterFotosPlacaParaAttachment(
  fotos: Pick<BoardPhoto, 'id' | 'category' | 'public_url' | 'caption' | 'created_at'>[],
): Attachment[] {
  return fotos.map((f) => ({
    id: f.id,
    service_order_id: null,
    task_id: null,
    equipment_id: null,
    workshop_order_id: null,
    storage: 'hostgator',
    storage_path: f.public_url,
    public_url: f.public_url,
    file_name: null,
    mime_type: 'image/jpeg',
    size_bytes: null,
    width: null,
    height: null,
    category: f.category,
    caption: f.caption
      ? `${f.caption} (${ROTULO_CATEGORIA_FOTO[f.category]})`
      : ROTULO_CATEGORIA_FOTO[f.category],
    field_control_id: null,
    uploaded_by: null,
    created_at: f.created_at,
  }));
}

export type DadosCamposFicha = Omit<PlacaFichaTecnica, 'id' | 'created_at'>;

/** Cria objeto em branco com todas as 34 colunas editáveis de `fichas_tecnicas_split`. */
export function criarFichaVazia(): DadosCamposFicha {
  return {
    fabricante: '',
    linha: '',
    tipo_split: 'Hi-Wall Inverter',
    capacidade_btu: '',
    capacidade_w: '',
    evaporadora: '',
    medida_evaporadora: '',
    ref_evaporadora: '',
    condensadora: '',
    medida_condensadora: '',
    ref_condensadora: '',
    revisao_manual: '',
    gas: '',
    cobre_liquido: '',
    cobre_succao: '',
    dist_min: '',
    dist_padrao: '',
    dist_max: '',
    desnivel_max: '',
    carga_fabrica: '',
    carga_extra: '',
    regra_bitola: '',
    tensao: '220V ~ 60Hz 1F',
    alimentacao_em: '',
    p_nominal: '',
    p_max_dim: '',
    i_refrigeracao: '',
    i_aquecimento: '',
    i_max_dim: '',
    origem_eletrica: '',
    cabo_alimentacao: '',
    cabo_interligacao: '',
    protecao: '',
    observacao: '',
    lacunas: '',
    fonte: '',
    arquivo_original_url: '',
  };
}

/** Limpa telefone e monta URL `https://wa.me/55...` com texto pré-preenchido. */
export function montarLinkWhatsAppPlaca(telefone: string | null | undefined, mensagem: string): string {
  const digitos = (telefone ?? '').replace(/\D/g, '');
  const comPais =
    digitos.length >= 10 && !digitos.startsWith('55') ? `55${digitos}` : digitos;
  const textoCodificado = encodeURIComponent(mensagem);
  return comPais
    ? `https://wa.me/${comPais}?text=${textoCodificado}`
    : `https://wa.me/?text=${textoCodificado}`;
}

/** Mensagem padrão do comprovante de entrada para envio no WhatsApp (seção 3.5). */
export function textoWhatsAppEntradaPlaca(placa: Pick<BoardOrder, 'board_number' | 'public_token'>): string {
  return `Recebemos sua placa, ${placa.board_number}, acompanhe aqui: ${linkPublicoPlaca(placa.public_token)}`;
}

/** Mensagem padrão para envio da proposta de orçamento pelo WhatsApp (seção 3.4). */
export function textoWhatsAppOrcamentoPlaca(
  placa: Pick<
    BoardOrder,
    'board_number' | 'customer_name' | 'brand_model' | 'board_code' | 'quote_amount' | 'quote_validity_days'
  >,
): string {
  const valor = placa.quote_amount != null ? valorEmReais(placa.quote_amount) : 'sob consulta';
  const entrada = placa.quote_amount != null ? valorEmReais(placa.quote_amount / 2) : '50%';
  return (
    `Olá, ${placa.customer_name}! Segue a proposta de orçamento do laboratório BRV Niterói referente à placa ${placa.board_number} (${placa.brand_model} · Cód. ${placa.board_code}).\n` +
    `Valor total: ${valor} (sinal de 50%: ${entrada} via PIX para início em bancada).\n` +
    `Validade da proposta: ${placa.quote_validity_days || 10} dias corridos.`
  );
}

/** Mensagem padrão para envio do termo de garantia de 90 dias pelo WhatsApp (seção 3.6). */
export function textoWhatsAppGarantiaPlaca(
  placa: Pick<
    BoardOrder,
    'board_number' | 'customer_name' | 'brand_model' | 'board_code' | 'finished_at' | 'replaced_components'
  >,
): string {
  const validade = calcularValidadeGarantia(placa.finished_at);
  return (
    `Olá, ${placa.customer_name}! Confirmamos a entrega da placa ${placa.board_number} (${placa.brand_model} · Cód. ${placa.board_code}).\n` +
    `Garantia legal BRV Niterói: 90 dias (válida até ${formatarData(validade)}), restrita aos componentes reparados/substituídos (${placa.replaced_components || 'conforme laudo de bancada'}).\n` +
    `Guarde o número ${placa.board_number} e mantenha o lacre de bancada intacto.`
  );
}

// ============================================================================
// CÁLCULOS PUROS DO DASHBOARD FINANCEIRO DE PLACAS (seção 3.10)
// Espelha as regras de `DashboardReparos.jsx` do sistema antigo.
// ============================================================================

export const NOMES_MESES_CURTOS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

export const NOMES_MESES_COMPLETOS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

export interface MesFinanceiroPlacas {
  /** Índice do mês (`0` = Janeiro .. `11` = Dezembro). */
  mesIndice: number;
  /** Nome curto (`Jan`..`Dez`). */
  nomeCurto: string;
  /** Nome completo (`Janeiro`..`Dezembro`). */
  nomeCompleto: string;
  /** Faturamento líquido do mês (exclui reembolsadas, sem conserto e garantias sem cobrança). */
  faturamento: number;
  /** Quantidade de placas faturadas no mês. */
  qtdEntregues: number;
  /** Ticket médio do mês (`qtdEntregues > 0 ? faturamento / qtdEntregues : 0`). */
  ticketMedio: number;
  /** Soma dos reembolsos registrados no mês. */
  totalReembolsos: number;
  /** Quantidade de placas reembolsadas no mês. */
  qtdReembolsos: number;
  /** Placas entregues faturadas neste mês (para o modal de detalhe do mês). */
  placasEntregues: BoardOrder[];
  /** Placas reembolsadas neste mês (para o modal de detalhe do mês). */
  placasReembolsadas: BoardOrder[];
}

export interface ItemRankingPlacas {
  rotulo: string;
  quantidade: number;
  percentual: number;
}

export interface ConsolidadoFinanceiroPlacas {
  ano: number;
  mesReferenciaIndice: number;
  mesReferenciaNome: string;
  /** Cartão 1: Faturamento líquido do mês de referência. */
  faturamentoMes: number;
  qtdEntreguesMes: number;
  /** Cartão 2: Ticket médio do mês de referência. */
  ticketMedioMes: number;
  /** Cartão 3: Soma dos orçamentos das placas ativas na bancada (em aberto). */
  valorBancadaAberto: number;
  qtdBancadaAberta: number;
  /** Cartão 4: Placas em aberto há >= 4 dias desde a entrada (inclusive `pronto`). */
  qtdEncalhadas: number;
  /** Cartão 5: Total faturado líquido no ano selecionado. */
  totalAno: number;
  qtdEntreguesAno: number;
  ticketMedioAno: number;
  /** Resumo anual de reembolsos. */
  totalReembolsosAno: number;
  qtdReembolsosAno: number;
  /** Série mensal de Janeiro a Dezembro. */
  meses: MesFinanceiroPlacas[];
  /** Maior valor mensal (para escalar a altura das colunas em HTML/CSS). */
  maiorFaturamentoMensal: number;
  /** Top 5 marcas mais atendidas. */
  rankingMarcas: ItemRankingPlacas[];
  /** Top 5 defeitos/códigos mais atendidos. */
  rankingDefeitos: ItemRankingPlacas[];
}

/** Valor efetivo de receita de uma placa entregue (`COALESCE(charged_amount, quote_amount, 0)`). */
export function valorReceitaPlaca(
  placa: Pick<BoardOrder, 'charged_amount' | 'quote_amount'>,
): number {
  const bruto = placa.charged_amount ?? placa.quote_amount ?? 0;
  return Number.isFinite(Number(bruto)) ? Math.max(0, Number(bruto)) : 0;
}

/** Valor efetivo de estorno de uma placa reembolsada (`COALESCE(refund_amount, charged_amount, quote_amount, 0)`). */
export function valorEstornoPlaca(
  placa: Pick<BoardOrder, 'refund_amount' | 'charged_amount' | 'quote_amount'>,
): number {
  const bruto = placa.refund_amount ?? placa.charged_amount ?? placa.quote_amount ?? 0;
  return Number.isFinite(Number(bruto)) ? Math.max(0, Number(bruto)) : 0;
}

/** Extrai ano e mês locais de uma string ISO (`AAAA-MM-DD` ou timestamp ISO). */
function extrairAnoMesLocal(iso: string | null | undefined): { ano: number; mes: number } | null {
  if (!iso) return null;
  const texto = iso.trim();
  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (soData) {
    return { ano: Number(soData[1]), mes: Number(soData[2]) - 1 };
  }
  const d = new Date(texto);
  if (Number.isNaN(d.getTime())) return null;
  return { ano: d.getFullYear(), mes: d.getMonth() };
}

/**
 * Consolida todas as métricas financeiras, série mensal, reembolsos e rankings para o ano selecionado.
 */
export function calcularFinanceiroPlacas(
  placas: readonly BoardOrder[],
  anoSelecionado: number,
  dataReferencia: Date = new Date(),
): ConsolidadoFinanceiroPlacas {
  const agoraMs = dataReferencia.getTime();
  const mesReferenciaIndice =
    anoSelecionado === dataReferencia.getFullYear() ? dataReferencia.getMonth() : 11;

  const meses: MesFinanceiroPlacas[] = NOMES_MESES_CURTOS.map((nomeCurto, idx) => ({
    mesIndice: idx,
    nomeCurto,
    nomeCompleto: NOMES_MESES_COMPLETOS[idx],
    faturamento: 0,
    qtdEntregues: 0,
    ticketMedio: 0,
    totalReembolsos: 0,
    qtdReembolsos: 0,
    placasEntregues: [],
    placasReembolsadas: [],
  }));

  let valorBancadaAberto = 0;
  let qtdBancadaAberta = 0;
  let qtdEncalhadas = 0;
  let totalAno = 0;
  let qtdEntreguesAno = 0;
  let totalReembolsosAno = 0;
  let qtdReembolsosAno = 0;

  const contagemMarcas = new Map<string, number>();
  const contagemDefeitos = new Map<string, number>();
  let baseRankings = 0;

  for (const p of placas) {
    if (p.cancelled_entry) continue;

    const ativaNaBancada = !ehEtapaFinalPlaca(p.status) && !p.archived;
    if (ativaNaBancada) {
      qtdBancadaAberta += 1;
      valorBancadaAberto += Math.max(0, Number(p.quote_amount ?? 0));
      if (placaEncalhada(p, agoraMs)) {
        qtdEncalhadas += 1;
      }
    }

    // Reembolsos contabilizados na competência de `refunded_at` (ou saída/etapa/entrada)
    if (p.refunded) {
      const refEstorno = extrairAnoMesLocal(
        p.refunded_at ?? p.finished_at ?? p.stage_changed_at ?? p.created_at,
      );
      if (refEstorno && refEstorno.ano === anoSelecionado) {
        const valEstorno = valorEstornoPlaca(p);
        totalReembolsosAno += valEstorno;
        qtdReembolsosAno += 1;
        const m = meses[refEstorno.mes];
        m.totalReembolsos += valEstorno;
        m.qtdReembolsos += 1;
        m.placasReembolsadas.push(p);
      }
    }

    // Receita líquida: placas entregues no ano, não reembolsadas e com faturamento efetivo (> 0 ou não garantia)
    if (p.status === 'entregue' && !p.refunded) {
      const refSaida = extrairAnoMesLocal(p.finished_at ?? p.stage_changed_at ?? p.created_at);
      const valReceita = valorReceitaPlaca(p);
      const contaComoFaturada = !p.is_warranty || valReceita > 0;
      if (refSaida && refSaida.ano === anoSelecionado && contaComoFaturada) {
        totalAno += valReceita;
        qtdEntreguesAno += 1;
        const m = meses[refSaida.mes];
        m.faturamento += valReceita;
        m.qtdEntregues += 1;
        m.placasEntregues.push(p);
      }
    }

    // Rankings consideram placas do ano selecionado (pela data de saída ou entrada)
    const refRanking = extrairAnoMesLocal(p.finished_at ?? p.created_at);
    if (refRanking && refRanking.ano === anoSelecionado) {
      baseRankings += 1;
      const textoMarca = (p.brand_model || p.equipment_type || 'Outra').trim();
      const primeiraPalavra = (textoMarca.split(/\s+/)[0] || 'OUTRA').toUpperCase();
      contagemMarcas.set(primeiraPalavra, (contagemMarcas.get(primeiraPalavra) ?? 0) + 1);

      const chaveDefeito = p.error_code?.trim()
        ? `Erro ${p.error_code.trim().toUpperCase()} — ${(p.reported_defect || 'Falha reportada').slice(0, 42)}`
        : (p.reported_defect || 'Não especificado').trim();
      contagemDefeitos.set(chaveDefeito, (contagemDefeitos.get(chaveDefeito) ?? 0) + 1);
    }
  }

  let maiorFaturamentoMensal = 0;
  for (const m of meses) {
    m.ticketMedio = m.qtdEntregues > 0 ? m.faturamento / m.qtdEntregues : 0;
    if (m.faturamento > maiorFaturamentoMensal) {
      maiorFaturamentoMensal = m.faturamento;
    }
  }

  const mesRef = meses[mesReferenciaIndice];
  const montarRanking = (mapa: Map<string, number>): ItemRankingPlacas[] =>
    [...mapa.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
      .slice(0, 5)
      .map(([rotulo, quantidade]) => ({
        rotulo,
        quantidade,
        percentual: baseRankings > 0 ? (quantidade / baseRankings) * 100 : 0,
      }));

  return {
    ano: anoSelecionado,
    mesReferenciaIndice,
    mesReferenciaNome: NOMES_MESES_COMPLETOS[mesReferenciaIndice],
    faturamentoMes: mesRef.faturamento,
    qtdEntreguesMes: mesRef.qtdEntregues,
    ticketMedioMes: mesRef.ticketMedio,
    valorBancadaAberto,
    qtdBancadaAberta,
    qtdEncalhadas,
    totalAno,
    qtdEntreguesAno,
    ticketMedioAno: qtdEntreguesAno > 0 ? totalAno / qtdEntreguesAno : 0,
    totalReembolsosAno,
    qtdReembolsosAno,
    meses,
    maiorFaturamentoMensal,
    rankingMarcas: montarRanking(contagemMarcas),
    rankingDefeitos: montarRanking(contagemDefeitos),
  };
}
