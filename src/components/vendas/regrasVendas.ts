// Regras puras do front-end para Catálogo, Orçamentos e Vendas (Rodada 1).

import type { CardMachine } from '../../types/financeiro';
import type { ProfileRole } from '../../types/fsm';
import type {
  CatalogItem,
  Quote,
  QuoteDisplayStatus,
  Sale,
  SaleDisplayStatus,
  SaleDocumentModel,
} from '../../types/vendas';
import {
  calcularLinhaItemCentavos,
  formatarReais,
  somarCentavos,
  type ModoDescontoLinha,
} from '../../utils/dinheiro';
import { formatarData } from '../../utils/ordens';

export const ITENS_VENDAS_POR_PAGINA = 50;

/**
 * Acima deste percentual de desconto total sobre o valor bruto da venda,
 * o sistema exige nível financeiro `completo` (Adriana/Braulio).
 * Abaixo ou igual a este limite, qualquer usuário do escritório pode aplicar.
 */
export const LIMITE_DESCONTO_SEM_SENHA_PERCENT = 10;

/** As 4 observações padrão de orçamento copiadas literalmente do uso diário do SicWeb (seção 1 do briefing). */
export const OBSERVACOES_PADRAO_ORCAMENTO_INICIAIS: readonly { titulo: string; texto: string }[] = [
  {
    titulo: 'Alteração de informações',
    texto:
      'Orçamento feito de acordo com informações passadas pelo cliente, qualquer alteração o orçamento será refeito.',
  },
  {
    titulo: 'Elétrica e dreno',
    texto: 'Elétrica e dreno por conta do cliente.',
  },
  {
    titulo: 'Alvenaria, gesso e janelas',
    texto:
      'A empresa não realiza fechamento de paredes ou tetos (gesso ou forro PVC), nem retirada ou colocação de janelas, grades, telas ou vidros, ficando estes serviços por conta do cliente.',
  },
  {
    titulo: 'Metragem de fio e serviço elétrico',
    texto:
      'O fio e o serviço elétrico serão acrescentados no orçamento depois da execução, pois não sabemos a metragem.',
  },
];

export function semAcento(termo: string): string {
  return termo
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function ehEscritorioOuAdminVendas(papel: ProfileRole | undefined): boolean {
  return papel === 'admin' || papel === 'escritorio';
}

export function dataIsoHoje(): string {
  const agora = new Date();
  const a = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, '0');
  const d = String(agora.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

export function somarDiasIso(dataIsoBase: string, dias: number): string {
  const base = dataIsoBase.includes('T') ? new Date(dataIsoBase) : new Date(`${dataIsoBase}T12:00:00`);
  const futura = new Date(base.getTime() + Math.max(0, dias) * 86_400_000);
  const a = futura.getFullYear();
  const m = String(futura.getMonth() + 1).padStart(2, '0');
  const d = String(futura.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

/**
 * Calcula a situação de exibição do orçamento (`situacaoOrcamento`).
 * - Se `converted_sale_id` ou `converted_service_order_id` ou `status === 'convertido'` -> `'convertido'`
 * - Se `status === 'enviado'` e `valid_until < hoje` -> `'vencido'`
 * - Caso contrário, retorna `status`.
 */
export function situacaoOrcamento(
  orcamento: Pick<
    Quote,
    'status' | 'valid_until' | 'converted_sale_id' | 'converted_service_order_id'
  >,
  hojeIso = dataIsoHoje(),
): QuoteDisplayStatus {
  if (
    orcamento.status === 'convertido' ||
    Boolean(orcamento.converted_sale_id) ||
    Boolean(orcamento.converted_service_order_id)
  ) {
    return 'convertido';
  }
  if (orcamento.status === 'enviado' && orcamento.valid_until && orcamento.valid_until < hojeIso) {
    return 'vencido';
  }
  return orcamento.status;
}

/** Quantos dias um orçamento já está vencido (0 se ainda estiver dentro da validade). */
export function diasOrcamentoVencido(validUntil: string, hojeIso = dataIsoHoje()): number {
  if (!validUntil || validUntil >= hojeIso) return 0;
  const tVal = new Date(`${validUntil}T12:00:00`).getTime();
  const tHoje = new Date(`${hojeIso}T12:00:00`).getTime();
  return Math.max(1, Math.round((tHoje - tVal) / 86_400_000));
}

/**
 * Calcula a situação da venda (`situacaoVenda`):
 * - `'cancelada'` se `status === 'cancelada'`
 * - `'paga'` se `paid_cents >= total_cents && total_cents > 0`
 * - `'parcial'` se `paid_cents > 0 && paid_cents < total_cents`
 * - `'aberta'` se `paid_cents === 0`
 */
export function situacaoVenda(
  venda: Pick<Sale, 'status' | 'total_cents' | 'paid_cents'>,
): SaleDisplayStatus {
  if (venda.status === 'cancelada') return 'cancelada';
  if (venda.paid_cents >= venda.total_cents && venda.total_cents > 0) return 'paga';
  if (venda.paid_cents > 0) return 'parcial';
  return 'aberta';
}

/** Verifica se um item do catálogo possui todos os dados fiscais essenciais preenchidos. */
export function itemTemDadoFiscalCompleto(
  item: Pick<CatalogItem, 'kind' | 'ncm' | 'cfop' | 'csosn' | 'service_code' | 'iss_rate'>,
): boolean {
  if (item.kind === 'produto') {
    const ncmOk = Boolean(item.ncm && item.ncm.replace(/\D/g, '').length === 8);
    const cfopOk = Boolean(item.cfop && item.cfop.replace(/\D/g, '').length === 4);
    const csosnOk = Boolean(item.csosn && item.csosn.replace(/\D/g, '').length === 3);
    return ncmOk && cfopOk && csosnOk;
  }
  const codOk = Boolean(item.service_code && item.service_code.trim().length >= 3);
  const issOk = item.iss_rate !== null && item.iss_rate !== undefined && item.iss_rate > 0;
  return codOk && issOk;
}

/**
 * Heurística da ferramenta "Revisar tipos": identifica itens cujo nome começa com "M.O"
 * ou contém "mão de obra", "instalação", "desinstalação", "manutenção" ou "visita".
 */
export function pareceItemDeServico(nome: string): boolean {
  const n = semAcento(nome);
  if (/^m\.?\s*o\b/.test(n)) return true;
  return (
    n.includes('mao de obra') ||
    n.includes('instalacao') ||
    n.includes('desinstalacao') ||
    n.includes('manutencao') ||
    n.includes('visita')
  );
}

/** Sugere NF-e se o cliente tiver CNPJ (14 caracteres), senão NFC-e. */
export function sugerirModeloNotaProdutos(
  tipoPessoa?: 'PF' | 'PJ' | null,
  documento?: string | null,
): Extract<SaleDocumentModel, 'nfce' | 'nfe'> {
  if (tipoPessoa === 'PJ') return 'nfe';
  const limpo = (documento ?? '').replace(/[^A-Za-z0-9]/g, '');
  if (limpo.length === 14) return 'nfe';
  return 'nfce';
}

/** Calcula a taxa estimada da maquininha para débito ou crédito (1x..12x). */
export function calcularTaxaMaquininha(
  maquininha: CardMachine | null | undefined,
  metodo: 'debito' | 'credito',
  parcelas: number,
  valorCentavos: number,
): { percentual: number; taxaCentavos: number; liquidoCentavos: number } {
  if (!maquininha || valorCentavos <= 0) {
    return { percentual: 0, taxaCentavos: 0, liquidoCentavos: valorCentavos };
  }
  let percentual = 0;
  if (metodo === 'debito') {
    percentual = maquininha.debit_fee_percent;
  } else if (parcelas <= 1) {
    percentual = maquininha.credit_sight_fee_percent;
  } else {
    const faixa =
      maquininha.credit_installment_rates.find((r) => r.installments === parcelas) ??
      maquininha.credit_installment_rates[maquininha.credit_installment_rates.length - 1];
    percentual = faixa ? faixa.fee_percent : maquininha.credit_sight_fee_percent;
  }
  const taxaCentavos = Math.round((valorCentavos * percentual) / 100);
  return {
    percentual,
    taxaCentavos,
    liquidoCentavos: Math.max(0, valorCentavos - taxaCentavos),
  };
}

/** Recalcula subtotais de produtos, serviços e total geral em centavos. */
export function recalcularTotaisOrcamentoOuVenda(
  itens: Array<{
    kind: 'produto' | 'servico';
    quantity: number;
    unit_price_cents: number;
    discount_mode: ModoDescontoLinha;
    discount_input: number;
  }>,
  descontoGeralCentavos: number,
  freteCentavos = 0,
): {
  produtosSubtotalCentavos: number;
  servicosSubtotalCentavos: number;
  brutoTotalCentavos: number;
  descontoLinhasCentavos: number;
  descontoGeralEfetivoCentavos: number;
  freteEfetivoCentavos: number;
  totalCentavos: number;
} {
  let produtosSubtotalCentavos = 0;
  let servicosSubtotalCentavos = 0;
  let brutoTotalCentavos = 0;
  let descontoLinhasCentavos = 0;

  for (const item of itens) {
    const calc = calcularLinhaItemCentavos(
      item.quantity,
      item.unit_price_cents,
      item.discount_mode,
      item.discount_input,
    );
    brutoTotalCentavos = somarCentavos(brutoTotalCentavos, calc.brutoCentavos);
    descontoLinhasCentavos = somarCentavos(descontoLinhasCentavos, calc.descontoCentavos);
    if (item.kind === 'produto') {
      produtosSubtotalCentavos = somarCentavos(produtosSubtotalCentavos, calc.totalCentavos);
    } else {
      servicosSubtotalCentavos = somarCentavos(servicosSubtotalCentavos, calc.totalCentavos);
    }
  }

  const somaLiquidaLinhas = somarCentavos(produtosSubtotalCentavos, servicosSubtotalCentavos);
  const descontoGeralEfetivoCentavos = Math.min(
    somaLiquidaLinhas,
    Math.max(0, Math.round(descontoGeralCentavos || 0)),
  );
  const freteEfetivoCentavos = Math.max(0, Math.round(freteCentavos || 0));
  const totalCentavos = Math.max(
    0,
    somaLiquidaLinhas - descontoGeralEfetivoCentavos + freteEfetivoCentavos,
  );

  return {
    produtosSubtotalCentavos,
    servicosSubtotalCentavos,
    brutoTotalCentavos,
    descontoLinhasCentavos,
    descontoGeralEfetivoCentavos,
    freteEfetivoCentavos,
    totalCentavos,
  };
}

export function linkPublicoOrcamento(token: string): string {
  return `${window.location.origin}/orcamento/${token}`;
}

/** Texto da mensagem de WhatsApp com o link de aprovação do orçamento (seção 3.4). */
export function textoWhatsAppOrcamento(
  orcamento: Pick<Quote, 'number' | 'customer_name' | 'valid_until' | 'total_cents' | 'public_token'>,
): string {
  const nome =
    orcamento.customer_name && orcamento.customer_name !== 'Consumidor final'
      ? `, ${orcamento.customer_name}`
      : '';
  const validade = orcamento.valid_until ? formatarData(orcamento.valid_until) : '10 dias';
  const valor = formatarReais(orcamento.total_cents);
  const link = linkPublicoOrcamento(orcamento.public_token);
  return `Olá${nome}! Segue seu orçamento nº ${orcamento.number} (${valor}), válido até ${validade}: ${link}`;
}

/** Abre a aba do WhatsApp de forma síncrona no clique para o navegador do celular não bloquear o pop-up. */
export function prepararJanelaWhatsApp(): Window | null {
  try {
    return window.open('about:blank', '_blank');
  } catch {
    return null;
  }
}

export function abrirLinkNaJanelaWhatsApp(
  janela: Window | null,
  telefone: string | null | undefined,
  mensagem: string,
): void {
  const digitos = (telefone ?? '').replace(/\D/g, '').replace(/^0+/, '');
  const foneFinal =
    digitos.length === 10 || digitos.length === 11
      ? `55${digitos}`
      : (digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')
        ? digitos
        : '';
  const url = `https://wa.me/${foneFinal}?text=${encodeURIComponent(mensagem)}`;
  if (janela && !janela.closed) {
    janela.location.replace(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

