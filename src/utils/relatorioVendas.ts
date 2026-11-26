import type { MesVendas } from '../services/relatorioVendas';

/** Anos em que o SicWeb não guarda o valor completo (sem itens). Não entram em variações. */
export const AVISO_DO_ANO: Record<number, string> = { 2008: 'sem valores', 2009: 'sem valores', 2010: 'incompleto' };

export type Medida = 'total' | 'vendas' | 'medio';

export const NOME_MEDIDA: Record<Medida, string> = { total: 'Faturamento', vendas: 'Número de vendas', medio: 'Valor médio por venda' };

export interface LinhaAno {
  ano: number;
  total: number;
  vendas: number;
  /** Faturamento dividido pelas vendas com valor. */
  medio: number | null;
  /** Variação sobre o ano anterior, em %; null quando não dá para comparar. */
  variacao: Record<Medida, number | null>;
  aviso: string | null;
}

const variacao = (atual: number | null, antes: number | null) => (atual === null || !antes ? null : ((atual - antes) / antes) * 100);

/**
 * Uma linha por ano. Com `ateODia`, todos os anos vão só até o dia e mês do último dia com venda.
 * Sem `ateODia`, o último ano (em andamento) é comparado com o mesmo período do ano anterior.
 */
export function resumirPorAno(meses: MesVendas[], ateODia: boolean, ultimoDia: string): LinhaAno[] {
  const somar = (ano: number, recortado: boolean) => {
    const doAno = meses.filter((m) => m.ano === ano);
    const total = doAno.reduce((s, m) => s + (recortado ? m.total_ate_dia : m.total), 0);
    const vendas = doAno.reduce((s, m) => s + (recortado ? m.vendas_ate_dia : m.vendas), 0);
    const comValor = doAno.reduce((s, m) => s + (recortado ? m.vendas_com_valor_ate_dia : m.vendas_com_valor), 0);
    return { total, vendas, medio: comValor ? total / comValor : null };
  };
  const anoAtual = Number(ultimoDia.slice(0, 4));
  const emAndamento = !ultimoDia.endsWith('-12-31');
  const anos = [...new Set(meses.map((m) => m.ano))].sort((a, b) => a - b);

  return anos.map((ano) => {
    const atual = somar(ano, ateODia);
    const recortar = ateODia || (ano === anoAtual && emAndamento);
    const comparavel = !AVISO_DO_ANO[ano] && !AVISO_DO_ANO[ano - 1] && anos.includes(ano - 1);
    const a = somar(ano, recortar);
    const b = somar(ano - 1, recortar);
    return {
      ano,
      ...atual,
      variacao: {
        total: comparavel ? variacao(a.total, b.total) : null,
        vendas: comparavel ? variacao(a.vendas, b.vendas) : null,
        medio: comparavel ? variacao(a.medio, b.medio) : null,
      },
      aviso: AVISO_DO_ANO[ano] ?? null,
    };
  });
}

/** Valor de um mês na medida escolhida; null quando não houve venda no mês. */
export function valorDoMes(m: MesVendas | undefined, medida: Medida): number | null {
  if (!m) return null;
  if (medida === 'vendas') return m.vendas;
  if (medida === 'total') return m.total;
  return m.vendas_com_valor ? m.total / m.vendas_com_valor : null;
}

export const reais = (v: number, centavos = true) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: centavos ? 2 : 0, minimumFractionDigits: centavos ? 2 : 0 });

export const diaBr = (dia: string) => dia.split('-').reverse().join('/');

/** CSV do mês a mês (";" e vírgula decimal, para abrir direto no Excel em português). */
export function csvMensal(meses: MesVendas[]): string {
  const dec = (v: number) => v.toFixed(2).replace('.', ',');
  const linhas = [...meses]
    .sort((a, b) => a.ano - b.ano || a.mes - b.mes)
    .map((m) => [m.ano, m.mes, m.vendas, m.vendas_com_valor, dec(m.total), AVISO_DO_ANO[m.ano] ?? ''].join(';'));
  return ['Ano;Mês;Vendas;Vendas com valor;Faturamento;Observação', ...linhas].join('\r\n');
}
