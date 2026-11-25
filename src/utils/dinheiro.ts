// Aritmética monetária inteira em centavos (nunca usar float solto para dinheiro).
// Usado pelos módulos de Catálogo, Orçamentos, Vendas e Financeiro.

/** Soma uma lista de valores inteiros em centavos com segurança contra imprecisão de ponto flutuante. */
export function somarCentavos(...valores: (number | null | undefined)[]): number {
  let soma = 0;
  for (const v of valores) {
    if (v == null || Number.isNaN(v)) continue;
    soma += Math.round(v);
  }
  return soma;
}

/** Subtrai dois valores inteiros em centavos (`a - b`) com arredondamento inteiro seguro. */
export function subtrairCentavos(
  a: number | null | undefined,
  b: number | null | undefined,
): number {
  const va = a == null || Number.isNaN(a) ? 0 : Math.round(a);
  const vb = b == null || Number.isNaN(b) ? 0 : Math.round(b);
  return va - vb;
}

/** Converte um número em reais (ex.: 15.9) para centavos inteiros (1590). */
export function reaisParaCentavos(reais: number): number {
  if (!Number.isFinite(reais)) return 0;
  return Math.round(reais * 100);
}

/** Converte centavos inteiros (1590) para número em reais (15.9). */
export function centavosParaReais(centavos: number | null | undefined): number {
  if (centavos == null || !Number.isFinite(centavos)) return 0;
  return Math.round(centavos) / 100;
}

/** Formata um valor em centavos para moeda brasileira ("R$ 1.234,56" ou "1.234,56"). */
export function formatarReais(
  centavos: number | null | undefined,
  opcoes?: { comSimbolo?: boolean },
): string {
  const valor = centavos == null || !Number.isFinite(centavos) ? 0 : Math.round(centavos) / 100;
  const comSimbolo = opcoes?.comSimbolo ?? true;
  if (comSimbolo) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Converte texto digitado pelo usuário ("1.234,56", "R$ 590,00", "450", "12,5") para centavos inteiros.
 * Devolve `null` quando o texto está vazio ou inválido.
 */
export function converterTextoParaCentavos(texto: string | number | null | undefined): number | null {
  if (texto === null || texto === undefined) return null;
  if (typeof texto === 'number') {
    return Number.isFinite(texto) ? Math.round(texto * 100) : null;
  }
  const limpo = texto.trim().replace(/[R$\s]/g, '');
  if (!limpo) return null;

  let normalizado: string;
  if (limpo.includes(',')) {
    // Formato brasileiro: "1.234,56" -> "1234.56"
    normalizado = limpo.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) {
    // Milhar com ponto sem centavos: "1.500" -> "1500"
    normalizado = limpo.replace(/\./g, '');
  } else {
    normalizado = limpo;
  }

  const numero = Number(normalizado);
  if (!Number.isFinite(numero)) return null;
  return Math.round(numero * 100);
}

/** Formata centavos para edição num campo de texto ("1234,56" ou "0,00"). */
export function centavosParaTextoInput(centavos: number | null | undefined): string {
  if (centavos == null || !Number.isFinite(centavos)) return '';
  return (Math.round(centavos) / 100).toFixed(2).replace('.', ',');
}

export type ModoDescontoLinha = 'valor' | 'percentual';

/**
 * Calcula o bruto, o desconto e o líquido de uma linha de item (orçamento ou venda),
 * arredondando por linha em centavos com `Math.round`.
 * - `quantidade`: aceita decimal (ex.: 3.5 metros de tubo de cobre)
 * - `unitarioCentavos`: preço unitário em centavos
 * - `descontoModo`: 'valor' (em centavos) ou 'percentual' (0 a 100)
 * - `descontoEntrada`: centavos se 'valor', ou percentual (ex.: 10 para 10%) se 'percentual'
 */
export function calcularLinhaItemCentavos(
  quantidade: number,
  unitarioCentavos: number,
  descontoModo: ModoDescontoLinha = 'valor',
  descontoEntrada = 0,
): {
  brutoCentavos: number;
  descontoCentavos: number;
  totalCentavos: number;
} {
  const qtdSegura = Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 0;
  const unitSeguro = Number.isFinite(unitarioCentavos) && unitarioCentavos > 0 ? Math.round(unitarioCentavos) : 0;
  const brutoCentavos = Math.round(qtdSegura * unitSeguro);

  let descontoBruto = 0;
  if (descontoModo === 'percentual') {
    const pct = Math.max(0, Math.min(100, Number.isFinite(descontoEntrada) ? descontoEntrada : 0));
    descontoBruto = Math.round((brutoCentavos * pct) / 100);
  } else {
    descontoBruto = Math.max(0, Number.isFinite(descontoEntrada) ? Math.round(descontoEntrada) : 0);
  }

  const descontoCentavos = Math.min(brutoCentavos, descontoBruto);
  const totalCentavos = Math.max(0, brutoCentavos - descontoCentavos);
  return { brutoCentavos, descontoCentavos, totalCentavos };
}

/**
 * Calcula o percentual efetivo de desconto sobre o valor bruto (produtos + serviços).
 * Ex.: bruto 100000 (R$ 1.000,00) e desconto total 12500 (R$ 125,00) -> 12.5%.
 */
export function calcularPercentualDesconto(brutoCentavos: number, descontoTotalCentavos: number): number {
  if (brutoCentavos <= 0 || descontoTotalCentavos <= 0) return 0;
  return Math.round((descontoTotalCentavos / brutoCentavos) * 10000) / 100;
}

/*
 * Testes simples de verificação das funções monetárias:
 *
 * 1) somarCentavos(59000, 1450, null, 2990) === 63440
 * 2) converterTextoParaCentavos('1.234,56') === 123456
 * 3) converterTextoParaCentavos('R$ 590,00') === 59000
 * 4) converterTextoParaCentavos('12,5') === 1250
 * 5) formatarReais(155000) === 'R$ 1.550,00'
 * 6) calcularLinhaItemCentavos(3.5, 2890, 'percentual', 10)
 *    -> brutoCentavos: 10115 (Math.round(3.5 * 2890))
 *    -> descontoCentavos: 1012 (Math.round(10115 * 0.10))
 *    -> totalCentavos: 9103
 */

