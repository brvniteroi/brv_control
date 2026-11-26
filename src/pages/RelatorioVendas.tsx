import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { CartaoNumero } from '../components/relatorios/ComponentesRelatorio';
import GraficoVendasAno from '../components/relatorios/GraficoVendasAno';
import DetalheVendasAno from '../components/relatorios/DetalheVendasAno';
import { relatorioMensal, type RelatorioMensal } from '../services/relatorioVendas';
import { AVISO_DO_ANO, NOME_MEDIDA, csvMensal, diaBr, reais, resumirPorAno, valorDoMes, type Medida } from '../utils/relatorioVendas';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const botao = (ligado: boolean) =>
  `px-3 py-2 text-xs font-semibold transition ${ligado ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`;

const sinal = (v: number | null) => (v === null ? '—' : `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);

/** Histórico de vendas ano a ano e mês a mês (só admin; a rota e o banco garantem). */
export default function RelatorioVendas() {
  const [dados, setDados] = useState<RelatorioMensal | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [medida, setMedida] = useState<Medida>('total');
  const [ateODia, setAteODia] = useState(false);

  useEffect(() => {
    let ativo = true;
    relatorioMensal()
      .then((r) => ativo && setDados(r))
      .catch((e) => ativo && setErro(e?.message ?? 'Não foi possível carregar o relatório.'));
    return () => {
      ativo = false;
    };
  }, []);

  const anos = useMemo(() => (dados ? resumirPorAno(dados.meses, ateODia, dados.ultimo_dia) : []), [dados, ateODia]);

  if (erro) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">{erro}</div>;
  if (!dados) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  const diaMes = diaBr(dados.ultimo_dia).slice(0, 5);
  const anoAtual = Number(dados.ultimo_dia.slice(0, 4));
  // Os cartões comparam sempre o mesmo período, para o ano em andamento não parecer queda
  const mesmoPeriodo = resumirPorAno(dados.meses, true, dados.ultimo_dia);
  const atual = mesmoPeriodo.find((a) => a.ano === anoAtual);
  const anterior = mesmoPeriodo.find((a) => a.ano === anoAtual - 1);
  const cheios = resumirPorAno(dados.meses, false, dados.ultimo_dia).filter((a) => a.ano < anoAtual && !a.aviso);
  const melhor = [...cheios].sort((a, b) => b.total - a.total)[0];

  const porChave = new Map(dados.meses.map((m) => [m.ano * 100 + m.mes, m]));
  const maiorMes = Math.max(1, ...dados.meses.filter((m) => !AVISO_DO_ANO[m.ano]).map((m) => valorDoMes(m, medida) ?? 0));
  const formatar = (v: number) => (medida === 'vendas' ? v.toLocaleString('pt-BR') : reais(v, false));
  const compacto = (v: number) =>
    medida === 'total' ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : Math.round(v).toLocaleString('pt-BR');

  function baixarCsv() {
    const url = URL.createObjectURL(new Blob(['﻿', csvMensal(dados!.meses)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendas-mes-a-mes-ate-${dados!.ultimo_dia}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Relatório de vendas</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Vendas registradas até {diaBr(dados.ultimo_dia)}: SicWeb antes de {diaBr(dados.virada)} e BRV Control a partir dessa data. Sem as canceladas.
          </p>
        </div>
        <button type="button" onClick={baixarCsv} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50">
          <Download size={14} /> Baixar planilha (CSV)
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CartaoNumero rotulo={`${anoAtual} até ${diaMes}`} valor={reais(atual?.total ?? 0, false)} detalhe={`${sinal(atual?.variacao.total ?? null)} sobre o mesmo período de ${anoAtual - 1} (${reais(anterior?.total ?? 0, false)})`} />
        <CartaoNumero rotulo={`Vendas em ${anoAtual}`} valor={(atual?.vendas ?? 0).toLocaleString('pt-BR')} detalhe={`${sinal(atual?.variacao.vendas ?? null)} no mesmo período`} />
        <CartaoNumero rotulo="Valor médio por venda" valor={atual?.medio ? reais(atual.medio) : '—'} detalhe={`${sinal(atual?.variacao.medio ?? null)} no mesmo período`} />
        <CartaoNumero rotulo="Melhor ano fechado" valor={melhor ? String(melhor.ano) : '—'} detalhe={melhor ? `${reais(melhor.total, false)} no ano inteiro` : undefined} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="O que mostrar" className="inline-flex overflow-hidden rounded-xl border border-slate-200 shadow-2xs">
          {(Object.keys(NOME_MEDIDA) as Medida[]).map((m) => (
            <button key={m} type="button" aria-pressed={medida === m} onClick={() => setMedida(m)} className={botao(medida === m)}>
              {NOME_MEDIDA[m]}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Período de cada ano" className="inline-flex overflow-hidden rounded-xl border border-slate-200 shadow-2xs">
          <button type="button" aria-pressed={!ateODia} onClick={() => setAteODia(false)} className={botao(!ateODia)}>
            Ano inteiro
          </button>
          <button type="button" aria-pressed={ateODia} onClick={() => setAteODia(true)} className={botao(ateODia)}>
            Até {diaMes} em cada ano
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-6">
        <h2 className="text-sm font-bold text-slate-800">{NOME_MEDIDA[medida]} por ano</h2>
        <GraficoVendasAno
          dados={anos.map((a) => ({
            ano: a.ano,
            valor: (medida === 'medio' ? a.medio : a[medida]) ?? 0,
            aviso: a.aviso,
            parcial: !ateODia && a.ano === anoAtual,
          }))}
          formatar={formatar}
        />
      </section>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full min-w-170 text-sm">
          <caption className="sr-only">Resumo por ano</caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-4 py-2.5 text-left">Ano</th>
              <th scope="col" className="px-4 py-2.5">Faturamento</th>
              <th scope="col" className="px-4 py-2.5">Variação</th>
              <th scope="col" className="px-4 py-2.5">Vendas</th>
              <th scope="col" className="px-4 py-2.5">Variação</th>
              <th scope="col" className="px-4 py-2.5">Valor médio</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {[...anos].reverse().map((a) => (
              <tr key={a.ano} className="border-b border-slate-100 text-right last:border-0">
                <th scope="row" className="px-4 py-2 text-left font-semibold text-slate-800">
                  {a.ano}
                  {a.aviso && <span className="ml-2 text-[11px] font-medium text-amber-700">{a.aviso}</span>}
                  {a.ano === anoAtual && <span className="ml-2 text-[11px] font-medium text-slate-500">até {diaMes}</span>}
                </th>
                <td className="px-4 py-2 font-semibold text-slate-800">{a.aviso === 'sem valores' ? '—' : reais(a.total)}</td>
                <td className="px-4 py-2 text-slate-600">{sinal(a.variacao.total)}</td>
                <td className="px-4 py-2 text-slate-800">{a.vendas.toLocaleString('pt-BR')}</td>
                <td className="px-4 py-2 text-slate-600">{sinal(a.variacao.vendas)}</td>
                <td className="px-4 py-2 text-slate-800">{a.medio === null || a.aviso ? '—' : reais(a.medio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!ateODia && (
          <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
            A variação de {anoAtual} compara com {anoAtual - 1} somente até {diaMes}.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-6">
        <h2 className="text-sm font-bold text-slate-800">Mês a mês: {NOME_MEDIDA[medida].toLowerCase()}</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Quanto mais escuro, maior o valor.{medida === 'total' ? ' Em milhares de reais.' : medida === 'medio' ? ' Em reais.' : ''} O mês de {diaBr(dados.ultimo_dia).slice(3)} está incompleto.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-200 border-separate border-spacing-0.5 text-xs tabular-nums">
            <thead>
              <tr className="text-slate-500">
                <th scope="col" className="px-2 py-1 text-left">Ano</th>
                {MESES.map((m) => (
                  <th key={m} scope="col" className="px-1 py-1 text-center font-semibold">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...anos].reverse().map((a) => (
                <tr key={a.ano}>
                  <th scope="row" className="px-2 py-1 text-left font-semibold text-slate-700">
                    {a.ano}
                    {a.aviso && <span className="text-amber-700">*</span>}
                  </th>
                  {MESES.map((nome, i) => {
                    const v = valorDoMes(porChave.get(a.ano * 100 + i + 1), medida);
                    const semValor = a.aviso === 'sem valores' && medida !== 'vendas';
                    if (v === null || semValor) return <td key={nome} className="rounded px-1 py-1.5 text-center text-slate-300">—</td>;
                    const forca = a.aviso ? 0 : Math.min(1, v / maiorMes);
                    return (
                      <td
                        key={nome}
                        title={`${nome}/${a.ano}: ${formatar(v)}`}
                        className={`rounded px-1 py-1.5 text-center ${forca > 0.55 ? 'font-semibold text-white' : 'text-slate-800'}`}
                        style={{ backgroundColor: `color-mix(in srgb, #1d4ed8 ${Math.round(forca * 92) + 4}%, white)` }}
                      >
                        {compacto(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">* 2008 e 2009 não têm valores no SicWeb; 2010 está incompleto. Esses anos não entram nas variações.</p>
      </section>

      <DetalheVendasAno anos={anos.filter((a) => !a.aviso).map((a) => a.ano).reverse()} ultimoDia={dados.ultimo_dia} />
    </div>
  );
}
