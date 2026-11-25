import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, FileText, Search } from 'lucide-react';
import {
  ORCAMENTOS_SICWEB_POR_PAGINA,
  itensDoOrcamentoSicweb,
  listarOrcamentosSicweb,
  type ItemOrcamentoSicweb,
  type OrcamentoSicweb,
} from '../../services/orcamentosSicweb';
import { valorEmReais } from '../../utils/oficina';
import { formatarData } from '../../utils/ordens';

interface Props {
  /** Sem cliente: lista todos, com busca por número, nome e contato. */
  clienteId?: string;
}

/** Orçamentos do SicWeb (último ano), só consulta. Só quem vende vê (a RLS das tabelas usa pode_vender()). */
export default function OrcamentosSicweb({ clienteId }: Props) {
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(0);
  const [dados, setDados] = useState<{ orcamentos: OrcamentoSicweb[]; quantidade: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);
  const [itens, setItens] = useState<Record<number, ItemOrcamentoSicweb[] | 'erro'>>({});

  useEffect(() => {
    let ativo = true;
    const espera = setTimeout(() => {
      listarOrcamentosSicweb({ clienteId, busca, pagina })
        .then((r) => {
          if (!ativo) return;
          setErro(null);
          setDados(r);
        })
        .catch((e: unknown) => {
          console.error('Erro ao buscar orçamentos do SicWeb:', e);
          if (ativo) setErro('Não foi possível carregar os orçamentos.');
        });
    }, busca ? 300 : 0);
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, [clienteId, busca, pagina]);

  const alternar = (controle: number) => {
    if (aberto === controle) {
      setAberto(null);
      return;
    }
    setAberto(controle);
    if (itens[controle] && itens[controle] !== 'erro') return;
    itensDoOrcamentoSicweb(controle)
      .then((lista) => setItens((atual) => ({ ...atual, [controle]: lista })))
      .catch((e: unknown) => {
        console.error('Erro ao buscar itens do orçamento:', e);
        setItens((atual) => ({ ...atual, [controle]: 'erro' }));
      });
  };

  const lista = dados?.orcamentos ?? null;
  const totalPaginas = Math.max(1, Math.ceil((dados?.quantidade ?? 0) / ORCAMENTOS_SICWEB_POR_PAGINA));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex items-center gap-2 text-slate-800">
        <FileText size={18} className="text-blue-600" />
        <h2 className="text-base font-bold">Orçamentos do SicWeb{dados ? ` (${dados.quantidade})` : ''}</h2>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        Feitos no SicWeb de 24/11/2025 a 24/11/2026, só para consulta.
      </p>

      {!clienteId && (
        <div className="relative mt-4 max-w-md">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            autoFocus
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(0);
              setAberto(null);
            }}
            placeholder="Número do orçamento, nome ou contato..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-3.5 pl-9 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}

      {erro ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
      ) : lista === null ? (
        <p className="mt-4 text-xs text-slate-400">Carregando...</p>
      ) : lista.length === 0 ? (
        <p className="mt-4 text-xs text-slate-400">
          {clienteId
            ? 'Nenhum orçamento do SicWeb ligado a este cliente. Procure pelo nome em Orçamentos > Antigos (SicWeb).'
            : 'Nenhum orçamento encontrado.'}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 font-semibold uppercase tracking-wider text-slate-500">
                <th className="w-6 px-2 py-2.5" />
                <th className="px-3 py-2.5">Número</th>
                <th className="px-3 py-2.5">Data</th>
                <th className="px-3 py-2.5">Nome no orçamento</th>
                <th className="px-3 py-2.5 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((o) => {
                const expandido = aberto === o.controle;
                const doOrcamento = itens[o.controle];
                return (
                  <Fragment key={o.controle}>
                    <tr onClick={() => alternar(o.controle)} className="cursor-pointer border-b border-slate-50 text-slate-700 hover:bg-slate-50">
                      <td className="px-2 py-2.5 text-slate-400">
                        <button type="button" aria-expanded={expandido} aria-label={`Itens do orçamento ${o.controle}`}>
                          {expandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900">{o.controle}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{formatarData(o.data)}</td>
                      <td className="px-3 py-2.5">
                        {o.cliente_nome ?? '—'}
                        {o.contato ? <span className="text-slate-400"> · {o.contato}</span> : null}
                        {o.ligado_por === 'nome' && (
                          <span
                            title="O SicWeb não tinha cliente neste orçamento. Foi ligado porque há um único cliente com este nome: confira."
                            className="ml-1.5 rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                          >
                            ligado pelo nome
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">{valorEmReais(o.total)}</td>
                    </tr>
                    {expandido && (
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <td />
                        <td colSpan={4} className="px-3 py-3">
                          {doOrcamento === undefined ? (
                            <p className="text-slate-400">Carregando itens...</p>
                          ) : doOrcamento === 'erro' ? (
                            <p className="text-red-600">Não foi possível carregar os itens.</p>
                          ) : (
                            <div className="space-y-3">
                              {o.observacoes && <p className="whitespace-pre-line text-slate-600">{o.observacoes}</p>}
                              <table className="w-full text-left">
                                <thead>
                                  <tr className="font-semibold text-slate-500">
                                    <th className="py-1 pr-3">Produto / serviço</th>
                                    <th className="py-1 pr-3 text-right">Qtd.</th>
                                    <th className="py-1 pr-3 text-right">Unitário</th>
                                    <th className="py-1 text-right">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {doOrcamento.map((i) => (
                                    <tr key={i.controle} className="border-t border-slate-100 text-slate-700">
                                      <td className="py-1 pr-3">{i.produto_nome ?? '—'}</td>
                                      <td className="py-1 pr-3 text-right whitespace-nowrap">
                                        {i.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                                      </td>
                                      <td className="py-1 pr-3 text-right whitespace-nowrap">{valorEmReais(i.valor_unitario)}</td>
                                      <td className="py-1 text-right whitespace-nowrap">{valorEmReais(i.total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {totalPaginas > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2 text-xs text-slate-700">
              <button
                type="button"
                disabled={pagina === 0}
                onClick={() => setPagina((p) => p - 1)}
                aria-label="Página anterior"
                className="rounded-lg border border-slate-200 bg-white p-1.5 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="font-medium">
                Página {pagina + 1} de {totalPaginas}
              </span>
              <button
                type="button"
                disabled={pagina + 1 >= totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
                aria-label="Próxima página"
                className="rounded-lg border border-slate-200 bg-white p-1.5 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
