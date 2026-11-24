import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ShoppingBag } from 'lucide-react';
import {
  LIMITE_VENDAS_CLIENTE,
  detalhesDaVenda,
  enderecosDoClienteVendas,
  listarVendasDoCliente,
  type ItemVendaSicweb,
  type PagamentoVendaSicweb,
  type VendasDoCliente,
} from '../../services/vendasSicweb';
import { valorEmReais } from '../../utils/oficina';
import { formatarData } from '../../utils/ordens';

interface VendasClienteProps {
  clienteId: string | 'novo';
}

interface Detalhe {
  itens: ItemVendaSicweb[];
  pagamentos: PagamentoVendaSicweb[];
}

const quantidade = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

/** Histórico de vendas do SicWeb (importado em 2026-11-24) de um cliente. Só o admin vê (a RLS das tabelas sicweb_* é só admin). */
export default function VendasCliente({ clienteId }: VendasClienteProps) {
  const [dados, setDados] = useState<VendasDoCliente | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enderecos, setEnderecos] = useState<Record<string, string>>({});
  const [aberta, setAberta] = useState<number | null>(null);
  const [detalhes, setDetalhes] = useState<Record<number, Detalhe | 'erro'>>({});

  useEffect(() => {
    if (clienteId === 'novo') return;
    let ativo = true;
    listarVendasDoCliente(clienteId)
      .then((r) => {
        if (ativo) setDados(r);
      })
      .catch((e: unknown) => {
        console.error('Erro ao buscar vendas do cliente:', e);
        if (ativo) setErro('Não foi possível carregar as vendas deste cliente.');
      });
    return () => {
      ativo = false;
    };
  }, [clienteId]);

  useEffect(() => {
    if (clienteId === 'novo') return;
    let ativo = true;
    enderecosDoClienteVendas(clienteId)
      .then((lista) => {
        if (ativo) setEnderecos(Object.fromEntries(lista.map((e) => [e.id, e.rotulo])));
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [clienteId]);

  // Coluna de endereço só quando o cliente tem mais de um (casa e consultório, por exemplo)
  const mostraEndereco = Object.keys(enderecos).length > 1;

  const resumo = useMemo(() => {
    const ativas = (dados?.vendas ?? []).filter((v) => !v.cancelada);
    return { total: ativas.reduce((s, v) => s + v.total + v.frete, 0), ultima: ativas[0]?.data ?? null };
  }, [dados]);

  const alternar = (controle: number) => {
    if (aberta === controle) {
      setAberta(null);
      return;
    }
    setAberta(controle);
    if (detalhes[controle]) return;
    detalhesDaVenda(controle)
      .then((d) => setDetalhes((atual) => ({ ...atual, [controle]: d })))
      .catch((e: unknown) => {
        console.error('Erro ao buscar itens da venda:', e);
        setDetalhes((atual) => ({ ...atual, [controle]: 'erro' }));
      });
  };

  const vendas = dados?.vendas ?? null;
  const cortada = dados != null && dados.quantidade > LIMITE_VENDAS_CLIENTE;

  return (
    <div className="mx-6 mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-800">
          <ShoppingBag size={18} className="text-blue-600" />
          <h2 className="text-base font-bold">Histórico de vendas{dados ? ` (${dados.quantidade})` : ''}</h2>
        </div>
        {vendas && vendas.length > 0 && (
          <p className="text-xs text-slate-500">
            {cortada ? `Nas ${vendas.length} mais recentes: ` : 'Total vendido: '}
            <strong className="text-slate-800">{valorEmReais(resumo.total)}</strong>
            {resumo.ultima && <> · última venda em {formatarData(resumo.ultima)}</>}
          </p>
        )}
      </div>
      <p className="mt-1 text-[11px] text-slate-400">Vendas feitas no SicWeb até 24/11/2026. Só o administrador vê esta aba.</p>

      {clienteId === 'novo' ? (
        <p className="mt-4 text-xs text-slate-400">Salve o cliente para ver as vendas.</p>
      ) : erro ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
      ) : vendas === null ? (
        <p className="mt-4 text-xs text-slate-400">Carregando...</p>
      ) : vendas.length === 0 ? (
        <p className="mt-4 text-xs text-slate-400">Este cliente não tem vendas importadas do SicWeb.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 font-semibold uppercase tracking-wider text-slate-500">
                <th className="w-6 px-2 py-2.5" />
                <th className="px-3 py-2.5">Data</th>
                <th className="px-3 py-2.5">Tipo</th>
                {mostraEndereco && <th className="px-3 py-2.5">Endereço</th>}
                <th className="px-3 py-2.5">Nota</th>
                <th className="px-3 py-2.5 text-right">Valor</th>
                <th className="px-3 py-2.5 text-right">Pago</th>
                <th className="px-3 py-2.5">Situação</th>
              </tr>
            </thead>
            <tbody>
              {vendas.map((v) => {
                const expandida = aberta === v.controle;
                const d = detalhes[v.controle];
                return (
                  <Fragment key={v.controle}>
                    <tr
                      onClick={() => alternar(v.controle)}
                      className={`cursor-pointer border-b border-slate-50 hover:bg-slate-50 ${v.cancelada ? 'text-slate-400' : 'text-slate-700'}`}
                    >
                      <td className="px-2 py-2.5 text-slate-400">{expandida ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{formatarData(v.data)}</td>
                      <td className="px-3 py-2.5">{v.tipo_nome ?? '—'}</td>
                      {mostraEndereco && <td className="px-3 py-2.5">{(v.address_id && enderecos[v.address_id]) || '—'}</td>}
                      <td className="px-3 py-2.5">{v.nota ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">{valorEmReais(v.total + v.frete)}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">{v.pago > 0 ? valorEmReais(v.pago) : '—'}</td>
                      <td className="px-3 py-2.5">
                        {v.cancelada ? (
                          <span className="rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">Cancelada</span>
                        ) : (
                          ''
                        )}
                      </td>
                    </tr>
                    {expandida && (
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <td />
                        <td colSpan={mostraEndereco ? 7 : 6} className="px-3 py-3">
                          {d === undefined ? (
                            <p className="text-slate-400">Carregando itens...</p>
                          ) : d === 'erro' ? (
                            <p className="text-red-600">Não foi possível carregar os itens desta venda.</p>
                          ) : (
                            <div className="space-y-3">
                              {v.observacoes && <p className="text-slate-600">Obs.: {v.observacoes}</p>}
                              {d.itens.length === 0 ? (
                                <p className="text-slate-400">Sem itens registrados nesta venda.</p>
                              ) : (
                                <table className="w-full text-left">
                                  <thead>
                                    <tr className="font-semibold text-slate-500">
                                      <th className="py-1 pr-3">Produto / serviço</th>
                                      <th className="py-1 pr-3 text-right">Qtd.</th>
                                      <th className="py-1 text-right">Valor</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {d.itens.map((i) => (
                                      <tr key={i.controle} className="border-t border-slate-100 text-slate-700">
                                        <td className="py-1 pr-3">{i.produto_nome ?? `Produto ${i.produto_codigo ?? ''}`}</td>
                                        <td className="py-1 pr-3 text-right whitespace-nowrap">{quantidade(i.quantidade)}</td>
                                        <td className="py-1 text-right whitespace-nowrap">{valorEmReais(i.total)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                              {v.frete > 0 && <p className="text-slate-500">Frete: {valorEmReais(v.frete)}</p>}
                              {d.pagamentos.length > 0 && (
                                <p className="text-slate-600">
                                  <span className="font-semibold">Pagamento:</span>{' '}
                                  {d.pagamentos.map((p) => `${p.forma ?? 'Forma não informada'} ${valorEmReais(p.valor)}`).join(' · ')}
                                </p>
                              )}
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
          {cortada && (
            <p className="mt-3 text-[11px] text-slate-400">
              Mostrando as {LIMITE_VENDAS_CLIENTE} vendas mais recentes de {dados?.quantidade}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
