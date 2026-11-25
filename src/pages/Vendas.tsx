import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Info,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react';
import {
  CORES_SITUACAO_VENDA,
  CORES_STATUS_NOTA,
  ROTULO_FORMA_PAGAMENTO,
  ROTULO_FORMA_PAGAMENTO_CURTO,
  ROTULO_MODELO_NOTA,
  ROTULO_ORIGEM_VENDA,
} from '../components/vendas/cores';
import { listarVendas } from '../components/vendas/fonteDeDados';
import NavegacaoVendas from '../components/vendas/NavegacaoVendas';
import NovaVendaModal from '../components/vendas/NovaVendaModal';
import {
  ITENS_VENDAS_POR_PAGINA,
  ehEscritorioOuAdminVendas,
  situacaoVenda,
} from '../components/vendas/regrasVendas';
import VendaDetalhes from '../components/vendas/VendaDetalhes';
import { useAuth } from '../contexts/useAuth';
import type { FinancialPaymentMethod } from '../types/financeiro';
import type { Sale, SaleDisplayStatus, SaleOriginType } from '../types/vendas';
import { formatarReais } from '../utils/dinheiro';
import { formatarDataHora } from '../utils/ordens';

type ChipVenda = 'todas' | 'hoje' | 'a_receber' | 'canceladas';

const CHIPS_VENDA: readonly { id: ChipVenda; rotulo: string }[] = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'hoje', rotulo: 'Hoje' },
  { id: 'a_receber', rotulo: 'A receber' },
  { id: 'canceladas', rotulo: 'Canceladas' },
];

export default function Vendas() {
  const { profile } = useAuth();
  const podeAcessar = ehEscritorioOuAdminVendas(profile?.role);
  const [searchParams, setSearchParams] = useSearchParams();

  const vendaParamId = searchParams.get('venda');
  const orcamentoConverterId = searchParams.get('orcamento');
  const novaVendaParam = searchParams.get('nova') === '1';

  const [chip, setChip] = useState<ChipVenda>('todas');
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<'todas' | SaleDisplayStatus>('todas');
  const [formaPagamento, setFormaPagamento] = useState<'todas' | FinancialPaymentMethod>('todas');
  const [origem, setOrigem] = useState<'todas' | SaleOriginType>('todas');
  const [statusNota, setStatusNota] = useState<
    'todas' | 'com_nota_emitida' | 'com_nota_pendente' | 'com_erro_nota'
  >('todas');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [pagina, setPagina] = useState(0);
  const [versao, setVersao] = useState(0);

  const [itens, setItens] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [somaTotalCents, setSomaTotalCents] = useState(0);
  const [somaRecebidoCents, setSomaRecebidoCents] = useState(0);
  const [somaAReceberCents, setSomaAReceberCents] = useState(0);
  const [contagens, setContagens] = useState({
    todas: 0,
    hoje: 0,
    a_receber: 0,
    canceladas: 0,
  });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!podeAcessar) return;
    let ativo = true;
    const timer = setTimeout(() => {
      setCarregando(true);
      setErro(null);
      listarVendas({
        pagina,
        busca,
        chip,
        situacao,
        formaPagamento,
        origem,
        statusNota,
        dataInicio,
        dataFim,
      })
        .then((res) => {
          if (!ativo) return;
          setItens(res.itens);
          setTotal(res.total);
          setSomaTotalCents(res.soma_total_cents);
          setSomaRecebidoCents(res.soma_recebido_cents);
          setSomaAReceberCents(res.soma_a_receber_cents);
          setContagens(res.contagens);
        })
        .catch((e: unknown) => {
          if (!ativo) return;
          setErro(e instanceof Error ? e.message : 'Não foi possível carregar as vendas.');
        })
        .finally(() => {
          if (ativo) setCarregando(false);
        });
    }, 130);

    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [
    podeAcessar,
    pagina,
    busca,
    chip,
    situacao,
    formaPagamento,
    origem,
    statusNota,
    dataInicio,
    dataFim,
    versao,
  ]);

  if (!podeAcessar) {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Lock size={24} />
        </div>
        <h1 className="mt-3 text-base font-bold text-slate-800">Acesso restrito</h1>
        <p className="mt-1 max-w-sm text-xs text-slate-500">
          O módulo de vendas é restrito à equipe do escritório e administradores.
        </p>
      </div>
    );
  }

  const abrirNovaVenda = () => {
    setSearchParams((atual) => {
      const novo = new URLSearchParams(atual);
      novo.delete('venda');
      novo.delete('orcamento');
      novo.set('nova', '1');
      return novo;
    });
  };

  const abrirDetalheVenda = (id: string) => {
    setSearchParams((atual) => {
      const novo = new URLSearchParams(atual);
      novo.delete('nova');
      novo.delete('orcamento');
      novo.set('venda', id);
      return novo;
    });
  };

  const fecharPaineis = () => {
    setSearchParams((atual) => {
      const novo = new URLSearchParams(atual);
      novo.delete('venda');
      novo.delete('nova');
      novo.delete('orcamento');
      return novo;
    });
  };

  const totalPaginas = Math.max(1, Math.ceil(total / ITENS_VENDAS_POR_PAGINA));

  return (
    <div className="space-y-4">
      <NavegacaoVendas />

      {/* Aviso fixo de separação do histórico antigo do SicWeb (seção 4.2) */}
      <div className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-2.5 text-xs text-blue-950">
        <Info size={16} className="shrink-0 text-blue-600" />
        <span>
          Vendas anteriores a 24/11/2026 ficam no cadastro de cada cliente, aba Vendas (histórico do SicWeb).
        </span>
      </div>

      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-brv-navy">
              <ShoppingBag size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-brv-navy sm:text-2xl">
                Vendas
              </h1>
              <p className="text-xs text-slate-500">
                Vendas de balcão, de orçamento e de OS com separação fiscal automática
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={abrirNovaVenda}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 sm:text-sm"
          >
            <Plus size={16} />
            Nova venda
          </button>
        </div>

        {/* Chips e Filtros */}
        <search className="space-y-3 border-t border-slate-100 pt-3.5">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar vendas por atalho">
            {CHIPS_VENDA.map((c) => {
              const ativo = chip === c.id;
              const qtd = contagens[c.id];
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => {
                    setChip(c.id);
                    setPagina(0);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                    ativo
                      ? 'border-brv-navy bg-brv-navy text-white shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{c.rotulo}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      ativo ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {qtd}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-6">
            <div className="relative lg:col-span-2">
              <Search
                size={15}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPagina(0);
                }}
                aria-label="Buscar venda por número, cliente, nota ou item"
                placeholder="Buscar nº, cliente, nota fiscal ou item..."
                className="block w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pr-8 pl-9 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => {
                    setBusca('');
                    setPagina(0);
                  }}
                  aria-label="Limpar busca"
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <select
              value={formaPagamento}
              aria-label="Filtrar por forma de pagamento"
              onChange={(e) => {
                setFormaPagamento(e.target.value as 'todas' | FinancialPaymentMethod);
                setPagina(0);
              }}
              className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none"
            >
              <option value="todas">Todas as formas</option>
              {(Object.keys(ROTULO_FORMA_PAGAMENTO) as FinancialPaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {ROTULO_FORMA_PAGAMENTO[m]}
                </option>
              ))}
            </select>

            <select
              value={situacao}
              aria-label="Filtrar por situação da venda"
              onChange={(e) => {
                setSituacao(e.target.value as 'todas' | SaleDisplayStatus);
                setPagina(0);
              }}
              className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none"
            >
              <option value="todas">Todas as situações</option>
              <option value="paga">Paga</option>
              <option value="parcial">Parcial</option>
              <option value="aberta">Aberta (a receber)</option>
              <option value="cancelada">Cancelada</option>
            </select>

            <select
              value={origem}
              aria-label="Filtrar por origem da venda"
              onChange={(e) => {
                setOrigem(e.target.value as 'todas' | SaleOriginType);
                setPagina(0);
              }}
              className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none"
            >
              <option value="todas">Todas as origens</option>
              <option value="balcao">Balcão</option>
              <option value="orcamento">Orçamento</option>
              <option value="os">Ordem de Serviço</option>
            </select>

            <select
              value={statusNota}
              aria-label="Filtrar por situação da nota fiscal"
              onChange={(e) => {
                setStatusNota(
                  e.target.value as
                    | 'todas'
                    | 'com_nota_emitida'
                    | 'com_nota_pendente'
                    | 'com_erro_nota',
                );
                setPagina(0);
              }}
              className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none"
            >
              <option value="todas">Com ou sem nota</option>
              <option value="com_nota_emitida">Com nota emitida</option>
              <option value="com_nota_pendente">Com nota pendente</option>
              <option value="com_erro_nota">Com erro de nota</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Período:</span>
            <input
              type="date"
              value={dataInicio}
              aria-label="Data inicial das vendas"
              onChange={(e) => {
                setDataInicio(e.target.value);
                setPagina(0);
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
            />
            <span>até</span>
            <input
              type="date"
              value={dataFim}
              aria-label="Data final das vendas"
              onChange={(e) => {
                setDataFim(e.target.value);
                setPagina(0);
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
            />
            {(dataInicio || dataFim) && (
              <button
                type="button"
                onClick={() => {
                  setDataInicio('');
                  setDataFim('');
                  setPagina(0);
                }}
                className="font-semibold text-blue-600 hover:underline"
              >
                Limpar datas
              </button>
            )}
          </div>
        </search>
      </div>

      {/* Estados da listagem */}
      {carregando ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-2xs">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          <span className="text-sm font-medium">Carregando vendas...</span>
        </div>
      ) : erro ? (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-8 text-center"
        >
          <AlertCircle size={28} className="text-red-600" />
          <p className="max-w-md text-sm font-medium text-red-800">{erro}</p>
          <button
            type="button"
            onClick={() => setVersao((v) => v + 1)}
            className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            <RefreshCw size={14} />
            Tentar de novo
          </button>
        </div>
      ) : itens.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <ShoppingBag size={32} className="text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">Nenhuma venda encontrada</p>
          <p className="max-w-sm text-xs text-slate-400">
            Ajuste os filtros ou clique em "Nova venda" para registrar uma venda de balcão.
          </p>
        </div>
      ) : (
        <>
          {/* Cartões no celular (< md) */}
          <div className="space-y-2.5 md:hidden">
            {itens.map((venda) => {
              const sit = situacaoVenda(venda);
              const formas = [
                ...new Set(venda.payments.map((p) => ROTULO_FORMA_PAGAMENTO_CURTO[p.method])),
              ].join(' + ');

              return (
                <button
                  key={venda.id}
                  type="button"
                  onClick={() => abrirDetalheVenda(venda.id)}
                  className="block w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:border-blue-300"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-sm font-extrabold text-brv-navy">
                      {venda.number}
                    </span>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${CORES_SITUACAO_VENDA[sit].selo}`}
                    >
                      {CORES_SITUACAO_VENDA[sit].rotulo}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-800">{venda.customer_name}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {venda.documents.map((doc) => (
                      <span
                        key={doc.id}
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CORES_STATUS_NOTA[doc.status].selo}`}
                      >
                        {doc.group === 'produtos' ? 'Produtos' : 'Serviços'}:{' '}
                        {ROTULO_MODELO_NOTA[doc.model]} {CORES_STATUS_NOTA[doc.status].rotulo.toLowerCase()}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                    <span className="text-[11px] text-slate-400">
                      {formatarDataHora(venda.created_at)} · {formas || 'A receber'}
                    </span>
                    <strong className="font-extrabold text-brv-navy">
                      {formatarReais(venda.total_cents)}
                    </strong>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tabela no computador (>= md) */}
          <div
            tabIndex={0}
            role="region"
            aria-label="Tabela de vendas"
            className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs md:block"
          >
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Data / Hora</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Origem</th>
                  <th className="px-4 py-3">Forma(s)</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3">Notas fiscais</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {itens.map((venda) => {
                  const sit = situacaoVenda(venda);
                  const formas = [
                    ...new Set(
                      venda.payments.map((p) =>
                        p.method === 'credito' && p.installments > 1
                          ? `${ROTULO_FORMA_PAGAMENTO_CURTO[p.method]} ${p.installments}x`
                          : ROTULO_FORMA_PAGAMENTO_CURTO[p.method],
                      ),
                    ),
                  ].join(' + ');

                  return (
                    <tr
                      key={venda.id}
                      onClick={() => abrirDetalheVenda(venda.id)}
                      className="cursor-pointer transition hover:bg-blue-50/35"
                    >
                      <td className="px-4 py-3 font-mono font-extrabold text-blue-600">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirDetalheVenda(venda.id);
                          }}
                          className="hover:underline"
                        >
                          {venda.number}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatarDataHora(venda.created_at)}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {venda.customer_name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {ROTULO_ORIGEM_VENDA[venda.origin_type]}
                        {venda.quote_number && (
                          <span className="block font-mono text-[10px] text-slate-400">
                            {venda.quote_number}
                          </span>
                        )}
                        {venda.service_order_number && (
                          <span className="block font-mono text-[10px] text-slate-400">
                            OS {venda.service_order_number}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formas || <span className="text-amber-700">A receber</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${CORES_SITUACAO_VENDA[sit].selo}`}
                        >
                          {CORES_SITUACAO_VENDA[sit].rotulo}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {venda.documents.map((doc) => (
                            <span
                              key={doc.id}
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CORES_STATUS_NOTA[doc.status].selo}`}
                            >
                              {doc.group === 'produtos' ? 'Produtos' : 'Serviços'}:{' '}
                              {ROTULO_MODELO_NOTA[doc.model]}{' '}
                              {CORES_STATUS_NOTA[doc.status].rotulo.toLowerCase()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold tabular-nums text-brv-navy">
                        {formatarReais(venda.total_cents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Rodapé com totais do filtro */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                <strong>{total}</strong> {total === 1 ? 'venda' : 'vendas'} no filtro
              </span>
              <span>
                Total ativo:{' '}
                <strong className="font-extrabold text-brv-navy">
                  {formatarReais(somaTotalCents)}
                </strong>
              </span>
              <span className="text-emerald-700">
                Recebido: <strong>{formatarReais(somaRecebidoCents)}</strong>
              </span>
              {somaAReceberCents > 0 && (
                <span className="text-amber-800">
                  A receber: <strong>{formatarReais(somaAReceberCents)}</strong>
                </span>
              )}
            </div>

            {totalPaginas > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagina === 0}
                  onClick={() => setPagina((p) => Math.max(0, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <span>
                  Página <strong>{pagina + 1}</strong> de <strong>{totalPaginas}</strong>
                </span>
                <button
                  type="button"
                  disabled={pagina + 1 >= totalPaginas}
                  onClick={() => setPagina((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:opacity-40"
                >
                  Próxima <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {(novaVendaParam || Boolean(orcamentoConverterId)) && (
        <NovaVendaModal
          orcamentoOrigemId={orcamentoConverterId}
          onFechar={fecharPaineis}
          onVendaConcluida={() => setVersao((v) => v + 1)}
          onAbrirDetalheVenda={(id) => abrirDetalheVenda(id)}
        />
      )}

      {vendaParamId && (
        <VendaDetalhes
          key={vendaParamId}
          vendaId={vendaParamId}
          onFechar={fecharPaineis}
          onAlterado={() => setVersao((v) => v + 1)}
        />
      )}
    </div>
  );
}

