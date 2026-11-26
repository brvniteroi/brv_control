import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, Download, Loader2, Search } from 'lucide-react';
import { CartaoNumero } from '../components/relatorios/ComponentesRelatorio';
import { produtosVendidos, ultimoDiaComVenda, type ProdutoVendido, type RelatorioProdutos as Dados } from '../services/relatorioVendas';
import { PERIODOS_PRODUTOS, csvProdutos, diaBr, mesesDoPeriodo, reais, type PeriodoProdutos } from '../utils/relatorioVendas';
import { semAcento } from '../services/clientes';

const caixa = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700';

type Ordem = 'total' | 'quantidade' | 'vendas';

const qtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** Produtos vendidos num período, para apoiar as compras (só admin; a rota e o banco garantem). */
export default function RelatorioProdutos() {
  const [ultimoDia, setUltimoDia] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoProdutos | 'personalizado'>('12m');
  const [datas, setDatas] = useState({ inicio: '', fim: '' });
  const [resposta, setResposta] = useState<{ chave: string; dados?: Dados; erro?: string } | null>(null);
  const [erroInicial, setErroInicial] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [ordem, setOrdem] = useState<Ordem>('total');

  // Os períodos prontos contam a partir da última venda registrada, não de hoje
  useEffect(() => {
    let ativo = true;
    ultimoDiaComVenda()
      .then((dia) => {
        if (!ativo) return;
        setUltimoDia(dia);
        const [inicio, fim] = PERIODOS_PRODUTOS['12m'].intervalo(dia);
        setDatas({ inicio, fim });
      })
      .catch((e) => ativo && setErroInicial(e?.message ?? 'Não foi possível carregar o relatório.'));
    return () => {
      ativo = false;
    };
  }, []);

  const valido = !!datas.inicio && !!datas.fim && datas.inicio <= datas.fim;
  const chave = `${datas.inicio}/${datas.fim}`;

  useEffect(() => {
    if (!datas.inicio || !datas.fim || datas.inicio > datas.fim) return;
    let ativo = true;
    const k = `${datas.inicio}/${datas.fim}`;
    produtosVendidos(datas.inicio, datas.fim)
      .then((dados) => ativo && setResposta({ chave: k, dados }))
      .catch((e) => ativo && setResposta({ chave: k, erro: e?.message ?? 'Não foi possível carregar o relatório.' }));
    return () => {
      ativo = false;
    };
  }, [datas]);

  const dados = resposta?.dados;
  const carregando = valido && resposta?.chave !== chave;
  // A média mensal só conta até a última venda registrada (período que vai além dela não dilui a média)
  const meses = valido && ultimoDia ? mesesDoPeriodo(datas.inicio, datas.fim < ultimoDia ? datas.fim : ultimoDia) : 1;

  const categorias = useMemo(
    () => [...new Set((dados?.produtos ?? []).map((p) => p.categoria).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [dados],
  );

  const linhas = useMemo(() => {
    const palavras = semAcento(busca).split(/\s+/).filter(Boolean);
    return (dados?.produtos ?? [])
      .filter((p) => !categoria || p.categoria === categoria)
      .filter((p) => {
        const texto = semAcento(`${p.nome} ${p.fabricante ?? ''} ${p.codigo ?? ''}`);
        return palavras.every((x) => texto.includes(x));
      })
      .sort((a, b) => b[ordem] - a[ordem] || b.total - a.total || b.quantidade_anterior - a.quantidade_anterior);
  }, [dados, busca, categoria, ordem]);

  const total = linhas.reduce((s, p) => s + p.total, 0);
  const vendidos = linhas.filter((p) => p.quantidade > 0).length;
  const pararam = linhas.filter((p) => p.quantidade === 0).length;

  function escolherPeriodo(p: PeriodoProdutos) {
    if (!ultimoDia) return;
    setPeriodo(p);
    const [inicio, fim] = PERIODOS_PRODUTOS[p].intervalo(ultimoDia);
    setDatas({ inicio, fim });
  }

  function baixarCsv() {
    const url = URL.createObjectURL(new Blob(['﻿', csvProdutos(linhas, meses)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `produtos-vendidos-${datas.inicio}-a-${datas.fim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (erroInicial) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">{erroInicial}</div>;

  const cabecalho = (rotulo: string, coluna: Ordem) => (
    <th scope="col" aria-sort={ordem === coluna ? 'descending' : 'none'} className="px-3 py-2.5 text-right">
      <button type="button" onClick={() => setOrdem(coluna)} className={`inline-flex items-center gap-1 uppercase ${ordem === coluna ? 'text-blue-700' : 'hover:text-slate-800'}`}>
        {rotulo}
        {ordem === coluna && <ArrowDown size={12} />}
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Produtos vendidos</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Para apoiar as compras.{ultimoDia ? ` Vendas registradas até ${diaBr(ultimoDia)}, sem as canceladas.` : ''}
          </p>
        </div>
        <button type="button" onClick={baixarCsv} disabled={!linhas.length || carregando} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50">
          <Download size={14} /> Baixar planilha (CSV)
        </button>
      </div>

      <search className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs lg:flex-row lg:flex-wrap lg:items-center">
        <select aria-label="Período" value={periodo} onChange={(e) => e.target.value !== 'personalizado' && escolherPeriodo(e.target.value as PeriodoProdutos)} className={caixa}>
          {(Object.keys(PERIODOS_PRODUTOS) as PeriodoProdutos[]).map((p) => (
            <option key={p} value={p}>{PERIODOS_PRODUTOS[p].rotulo}</option>
          ))}
          {periodo === 'personalizado' && <option value="personalizado">Período escolhido</option>}
        </select>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <label htmlFor="produtos-de">De</label>
          <input id="produtos-de" type="date" value={datas.inicio} onChange={(e) => { setPeriodo('personalizado'); setDatas((d) => ({ ...d, inicio: e.target.value })); }} className={caixa} />
          <label htmlFor="produtos-ate">até</label>
          <input id="produtos-ate" type="date" value={datas.fim} onChange={(e) => { setPeriodo('personalizado'); setDatas((d) => ({ ...d, fim: e.target.value })); }} className={caixa} />
        </div>
        <select aria-label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className={caixa}>
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <div className="relative min-w-56 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Produto, fabricante ou código" aria-label="Buscar produto" className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm" />
        </div>
      </search>

      {!valido && ultimoDia && <p className="text-sm text-rose-700">Escolha as duas datas, com o início antes do fim.</p>}

      {resposta?.erro && !carregando ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">{resposta.erro}</p>
      ) : !dados ? (
        <div className="flex h-40 items-center justify-center text-slate-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <div className={`space-y-4 transition-opacity ${carregando ? 'opacity-50' : ''}`}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <CartaoNumero rotulo="Valor vendido" valor={reais(total)} detalhe={categoria || busca ? 'nos produtos filtrados' : 'em produtos'} />
            <CartaoNumero rotulo="Produtos diferentes vendidos" valor={vendidos.toLocaleString('pt-BR')} detalhe={`em cerca de ${qtd(meses)} ${meses === 1 ? 'mês' : 'meses'}`} />
            <CartaoNumero rotulo="Sem venda no período" valor={pararam.toLocaleString('pt-BR')} detalhe="venderam no mesmo período do ano anterior" />
          </div>

          <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full min-w-200 text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th scope="col" className="w-10 px-3 py-2.5 text-right">#</th>
                  <th scope="col" className="px-3 py-2.5 text-left">Produto</th>
                  {cabecalho('Quantidade', 'quantidade')}
                  <th scope="col" className="px-3 py-2.5 text-right">Média por mês</th>
                  <th scope="col" className="px-3 py-2.5 text-right" title={`De ${diaBr(dados.anterior_inicio)} a ${diaBr(dados.anterior_fim)}`}>Ano anterior</th>
                  {cabecalho('Valor', 'total')}
                  {cabecalho('Nº de vendas', 'vendas')}
                  <th scope="col" className="px-3 py-2.5 text-right">Última venda</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {linhas.map((p: ProdutoVendido, i) => (
                  <tr key={`${p.nome}|${p.unidade}`} className="border-b border-slate-100 text-right last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs text-slate-400">{i + 1}</td>
                    <th scope="row" className="px-3 py-2 text-left font-medium text-slate-800">
                      {p.nome}
                      {(p.categoria || p.fabricante) && <span className="block text-[11px] font-normal text-slate-500">{[p.categoria, p.fabricante].filter(Boolean).join(' · ')}</span>}
                    </th>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-800">{qtd(p.quantidade)} <span className="text-[11px] font-normal text-slate-500">{p.unidade}</span></td>
                    <td className="px-3 py-2 text-slate-700">{qtd(p.quantidade / meses)}</td>
                    <td className="px-3 py-2 text-slate-500">{qtd(p.quantidade_anterior)}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-800">{reais(p.total)}</td>
                    <td className="px-3 py-2 text-slate-600">{p.vendas.toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{diaBr(p.ultima_venda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {linhas.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Nenhum produto vendido com esses filtros.</p>}
          </section>

          <div className="space-y-1 text-[11px] text-slate-500">
            <p>“Ano anterior” é a quantidade de {diaBr(dados.anterior_inicio)} a {diaBr(dados.anterior_fim)}. O estoque não é considerado.</p>
            <p>Um serviço aparecendo aqui está marcado como produto: mude o tipo em Vendas &gt; Catálogo.</p>
            {dados.sem_classificacao.total > 0 && (
              <p>Fora da lista: {reais(dados.sem_classificacao.total)} em itens de produtos apagados do cadastro do SicWeb (sem nome).</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
