// Regras puras do front-end para o módulo Financeiro (Rodada 2).
// Datas sempre em dia local (AAAA-MM-DD via getFullYear/getMonth/getDate) e dinheiro em centavos inteiros.

import type {
  CardMachine,
  FinancialMovement,
} from '../../types/financeiro';
import {
  formatarReais,
  somarCentavos,
  subtrairCentavos,
} from '../../utils/dinheiro';
import { formatarData } from '../../utils/ordens';

export const ITENS_FINANCEIRO_POR_PAGINA = 50;

/**
 * Data local no formato `AAAA-MM-DD`.
 * Nunca usa `toISOString().slice(0, 10)` para evitar virar o dia seguinte após as 21h (BRT).
 */
export function diaLocalFinanceiro(d: Date = new Date()): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Converte uma string de data (`AAAA-MM-DD` ou timestamp ISO) para o dia local `AAAA-MM-DD`.
 */
export function extrairDiaLocal(dataOuIso: string): string {
  const limpo = dataOuIso.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(limpo)) return limpo;
  const d = new Date(limpo);
  if (Number.isNaN(d.getTime())) return limpo.slice(0, 10);
  return diaLocalFinanceiro(d);
}

/**
 * Desloca uma data local `AAAA-MM-DD` em `deltaDias` dias corridos, mantendo no fuso local.
 */
export function deslocarDiaLocal(dataLocalIso: string, deltaDias: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(extrairDiaLocal(dataLocalIso));
  const base = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0)
    : new Date();
  const alvo = new Date(base.getFullYear(), base.getMonth(), base.getDate() + deltaDias, 12, 0, 0);
  return diaLocalFinanceiro(alvo);
}

/**
 * Soma `diasUteis` dias úteis (pulando sábado e domingo) a partir de `dataLocalIso`.
 * Usado para calcular a data de liquidação de cartão na conta da maquininha ("dia útil seguinte").
 */
export function somarDiasUteisLocal(dataLocalIso: string, diasUteis: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(extrairDiaLocal(dataLocalIso));
  const d = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0)
    : new Date();
  let restantes = Math.max(0, Math.round(diasUteis));
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    const diaSemana = d.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      restantes -= 1;
    }
  }
  return diaLocalFinanceiro(d);
}

/**
 * Calcula a taxa como tarifa, o valor líquido e a data de liquidação (dia útil seguinte)
 * para um recebimento em cartão de débito ou crédito.
 */
export function calcularLiquidacaoCartao(
  maquininha: CardMachine | null | undefined,
  metodo: 'debito' | 'credito',
  parcelas: number,
  valorBrutoCentavos: number,
  dataBaseLocal = diaLocalFinanceiro(),
): {
  percentualTaxa: number;
  taxaCentavos: number;
  liquidoCentavos: number;
  dataLiquidacaoLocal: string;
} {
  const bruto = Math.max(0, Math.round(valorBrutoCentavos || 0));
  if (!maquininha || bruto === 0) {
    return {
      percentualTaxa: 0,
      taxaCentavos: 0,
      liquidoCentavos: bruto,
      dataLiquidacaoLocal: somarDiasUteisLocal(dataBaseLocal, 1),
    };
  }

  let percentualTaxa = 0;
  if (metodo === 'debito') {
    percentualTaxa = maquininha.debit_fee_percent;
  } else if (parcelas <= 1) {
    percentualTaxa = maquininha.credit_sight_fee_percent;
  } else {
    const faixa =
      maquininha.credit_installment_rates.find((r) => r.installments === parcelas) ??
      maquininha.credit_installment_rates[maquininha.credit_installment_rates.length - 1];
    percentualTaxa = faixa ? faixa.fee_percent : maquininha.credit_sight_fee_percent;
  }

  const taxaCentavos = Math.round((bruto * percentualTaxa) / 100);
  const liquidoCentavos = Math.max(0, subtrairCentavos(bruto, taxaCentavos));
  const dataLiquidacaoLocal = somarDiasUteisLocal(
    dataBaseLocal,
    maquininha.settlement_business_days || 1,
  );

  return {
    percentualTaxa,
    taxaCentavos,
    liquidoCentavos,
    dataLiquidacaoLocal,
  };
}

/** Saldo esperado no caixa = saldo inicial + entradas em dinheiro − saídas (sangrias). */
export function calcularSaldoEsperadoCaixa(
  saldoInicialCentavos: number,
  entradasCentavos: number,
  saidasCentavos: number,
): number {
  return subtrairCentavos(
    somarCentavos(saldoInicialCentavos, entradasCentavos),
    saidasCentavos,
  );
}

/** Diferença de fechamento do caixa = valor contado − valor esperado (negativo = falta, positivo = sobra). */
export function calcularDiferencaCaixa(
  contadoCentavos: number,
  esperadoCentavos: number,
): number {
  return subtrairCentavos(contadoCentavos, esperadoCentavos);
}

/** Gera o conteúdo CSV (com BOM UTF-8 e separador `;`) para exportação de movimentos no navegador. */
export function gerarCsvMovimentos(movimentos: FinancialMovement[]): string {
  const escapar = (v: string | number | null | undefined): string => {
    const texto = String(v ?? '').replace(/\r?\n/g, ' ').trim();
    if (texto.includes(';') || texto.includes('"')) {
      return `"${texto.replace(/"/g, '""')}"`;
    }
    return texto;
  };

  const cabecalho = [
    'Data',
    'Tipo',
    'Conta',
    'Categoria',
    'Forma',
    'Origem',
    'Cliente / Fornecedor',
    'Descrição',
    'Valor (R$)',
    'Situação',
    'Lançado por',
  ].join(';');

  const linhas = movimentos.map((m) => {
    const sinal = m.direction === 'entrada' ? '' : '-';
    const valorFormatado = `${sinal}${formatarReais(m.amount_cents, { comSimbolo: false })}`;
    const situacao = m.is_reversal
      ? `Estorno (${m.reverses_description ?? ''})`
      : m.reversed_by_movement_id
        ? 'Estornado'
        : 'Ativo';
    const pessoa = m.customer_name || m.supplier_name || '';

    return [
      formatarData(m.occurred_date),
      m.direction === 'entrada' ? 'Entrada' : 'Saída',
      m.account_name,
      m.category_name || (m.origin_type === 'transferencia' ? 'Transferência' : ''),
      m.method.toUpperCase(),
      m.origin_label || m.origin_type,
      pessoa,
      m.description,
      valorFormatado,
      situacao,
      m.created_by_name,
    ]
      .map(escapar)
      .join(';');
  });

  return `\uFEFF${[cabecalho, ...linhas].join('\r\n')}`;
}

