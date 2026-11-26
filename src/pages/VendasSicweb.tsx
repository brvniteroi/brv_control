import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import FiltroPeriodo from '../components/comum/FiltroPeriodo';
import { VENDAS_SICWEB_POR_PAGINA, buscarVendasSicweb, type BuscaVendas } from '../services/relatorioVendas';
import { detalhesDaVenda, type ItemVendaSicweb, type PagamentoVendaSicweb } from '../services/vendasSicweb';
import { diaBr, reais } from '../utils/relatorioVendas';

const caixa = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700';

function Itens({ controle }: { controle: number }) {
  const [dados, setDados] = useState<{ itens: ItemVendaSicweb[]; pagamentos: PagamentoVendaSicweb[] } | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let ativo = true;
    detalhesDaVenda(controle)
      .then((d) => ativo && setDados(d))
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, [controle]);

  if (erro) return <p className="text-rose-700">Não foi possível carregar os itens.</p>;
  if (!dados) return <Loader2 size={16} className="animate-spin text-slate-400" />;
  return (
    <div className="space-y-2">
      {dados.itens.length === 0 ? (
        <p className="text-slate-500">O SicWeb não guardou itens desta venda.</p>
      ) : (
        <table className="w-full">
          <tbody className="tabular-nums">
            {dados.itens.map((i) => (
              <tr key={i.controle} className="border-b border-slate-200 last:border-0">
                <td className="py-1 pr-2">{i.produto_nome ?? 'Produto apagado do cadastro do SicWeb'}</td>
                <td className="w-20 py-1 text-right text-slate-600">{i.quantidade.toLocaleString('pt-BR')}</td>
                <td className="w-28 py-1 text-right font-semibold">{reais(i.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-slate-500">
        {dados.pagamentos.length === 0
          ? 'Sem pagamento registrado no SicWeb.'
          : `Pagamento: ${dados.pagamentos.map((p) => `${p.forma ?? 'sem forma'} ${reais(p.valor - p.troco)}`).join(' · ')}`}
      </p>
    </div>
  );
}

/** Consulta de todo o histórico de vendas do SicWeb (só admin). */
export default function VendasSicweb() {
  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = useState({ busca: '', inicio: '', fim: '', pagina: 0 });
  const [resposta, setResposta] = useState<{ chave: string; dados?: BuscaVendas; erro?: string } | null>(null);
  const [aberta, setAberta] = useState<number | null>(null);
  const chave = JSON.stringify(filtro);

  // A busca só dispara quando a pessoa para de digitar
  useEffect(() => {
    const t = setTimeout(() => setFiltro((f) => (f.busca === texto.trim() ? f : { ...f, busca: texto.trim(), pagina: 0 })), 450);
    return () => clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    let ativo = true;
    const k = JSON.stringify(filtro);
    buscarVendasSicweb(filtro)
      .then((dados) => ativo && setResposta({ chave: k, dados }))
      .catch((e) => ativo && setResposta({ chave: k, erro: e?.message ?? 'Não foi possível buscar.' }));
    return () => {
      ativo = false;
    };
  }, [filtro]);

  const carregando = resposta?.chave !== chave;
  const d = resposta?.dados;
  const paginas = Math.max(1, Math.ceil((d?.quantidade ?? 0) / VENDAS_SICWEB_POR_PAGINA));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Vendas antigas (SicWeb)</h1>
          <p className="mt-1 text-xs text-slate-500">Todo o histórico trazido do SicWeb, desde 2008. Só consulta.</p>
        </div>
        <Link to="/vendas" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <ArrowLeft size={15} /> Voltar às vendas
        </Link>
      </div>

      <search className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative min-w-60 flex-1">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Cliente, produto, serviço ou número da venda"
            aria-label="Buscar nas vendas antigas"
            className="w-full rounded-xl border border-slate-200 py-2 pl-10 pr-3 text-sm"
          />
        </div>
        <FiltroPeriodo idPrefixo="vendas-sicweb" dataInicio={filtro.inicio} dataFim={filtro.fim} onMudar={(inicio, fim) => setFiltro((f) => ({ ...f, inicio, fim, pagina: 0 }))} classe={caixa} />
      </search>

      {resposta?.erro && !carregando ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">{resposta.erro}</p>
      ) : !d ? (
        <div className="flex h-40 items-center justify-center text-slate-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <div className={`space-y-3 transition-opacity ${carregando ? 'opacity-50' : ''}`}>
          <p className="text-sm text-slate-700" aria-live="polite">
            <strong>{d.quantidade.toLocaleString('pt-BR')}</strong> {d.quantidade === 1 ? 'venda' : 'vendas'} · <strong>{reais(d.total)}</strong>
            {d.canceladas > 0 && <span className="text-slate-500"> (valor sem as canceladas: {d.canceladas})</span>}
          </p>
          <p className="text-[11px] text-slate-500">O valor é o das vendas inteiras encontradas. Ao buscar um produto, os outros itens dessas vendas também entram na soma.</p>

          <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full min-w-150 text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-2.5">Data</th>
                  <th scope="col" className="px-4 py-2.5">Número</th>
                  <th scope="col" className="px-4 py-2.5">Cliente</th>
                  <th scope="col" className="px-4 py-2.5">Tipo</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {d.vendas.map((v) => (
                  <Fragment key={v.controle}>
                    <tr onClick={() => setAberta(aberta === v.controle ? null : v.controle)} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 tabular-nums">
                        <button type="button" aria-expanded={aberta === v.controle} className="inline-flex items-center gap-1.5">
                          <ChevronDown size={14} className={`text-slate-400 transition-transform ${aberta === v.controle ? '' : '-rotate-90'}`} />
                          {diaBr(v.data)}
                        </button>
                      </td>
                      <td className="px-4 py-2 tabular-nums text-slate-600">{v.controle}</td>
                      <td className="px-4 py-2 font-medium text-slate-800">{v.cliente ?? 'Sem cliente'}</td>
                      <td className="px-4 py-2 text-xs text-slate-600">
                        {v.tipo_nome ?? '—'}
                        {v.cancelada && <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 font-semibold text-rose-700">Cancelada</span>}
                      </td>
                      <td className={`px-4 py-2 text-right font-semibold tabular-nums ${v.cancelada ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{reais(v.total)}</td>
                    </tr>
                    {aberta === v.controle && (
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <td colSpan={5} className="px-8 py-3 text-xs text-slate-700">
                          <Itens controle={v.controle} />
                          {v.frete > 0 && <p className="mt-1 text-slate-500">Frete: {reais(v.frete)}</p>}
                          {v.observacoes && <p className="mt-1 text-slate-500">Observações: {v.observacoes}</p>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {d.vendas.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Nenhuma venda encontrada.</p>}
          </section>

          {paginas > 1 && (
            <div className="flex items-center justify-end gap-3 text-xs text-slate-600">
              <span>Página {filtro.pagina + 1} de {paginas.toLocaleString('pt-BR')}</span>
              <button type="button" aria-label="Página anterior" disabled={filtro.pagina === 0} onClick={() => setFiltro((f) => ({ ...f, pagina: f.pagina - 1 }))} className={`${caixa} disabled:opacity-40`}>
                <ChevronLeft size={15} />
              </button>
              <button type="button" aria-label="Próxima página" disabled={filtro.pagina + 1 >= paginas} onClick={() => setFiltro((f) => ({ ...f, pagina: f.pagina + 1 }))} className={`${caixa} disabled:opacity-40`}>
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
