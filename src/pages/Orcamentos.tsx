import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Lock,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Wrench,
  X,
} from 'lucide-react';
import { CORES_SITUACAO_ORCAMENTO } from '../components/vendas/cores';
import {
  listarOrcamentos,
  listarVendedores,
} from '../components/vendas/fonteDeDados';
import NavegacaoVendas from '../components/vendas/NavegacaoVendas';
import OrcamentoEditor from '../components/vendas/OrcamentoEditor';
import { ModalTextosPadraoOrcamento } from '../components/vendas/OrcamentoModais';
import {
  ITENS_VENDAS_POR_PAGINA,
  ehEscritorioOuAdminVendas,
  situacaoOrcamento,
} from '../components/vendas/regrasVendas';
import { useAuth } from '../contexts/useAuth';
import type { Quote, QuoteDisplayStatus, SellerOption } from '../types/vendas';
import { formatarReais } from '../utils/dinheiro';
import { formatarData } from '../utils/ordens';

type FiltroSituacao = 'todos' | QuoteDisplayStatus;

const CHIPS_SITUACAO: readonly { id: FiltroSituacao; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'rascunho', rotulo: 'Rascunho' },
  { id: 'enviado', rotulo: 'Enviado' },
  { id: 'aprovado', rotulo: 'Aprovado' },
  { id: 'recusado', rotulo: 'Recusado' },
  { id: 'convertido', rotulo: 'Convertido' },
  { id: 'vencido', rotulo: 'Vencido' },
];

export default function Orcamentos() {
  const { profile } = useAuth();
  const podeAcessar = ehEscritorioOuAdminVendas(profile?.role);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const orcamentoParam = searchParams.get('orcamento');
  const novoParam = searchParams.get('novo') === '1';
  const rotaTextos = location.pathname.endsWith('/textos');

  const [situacao, setSituacao] = useState<FiltroSituacao>('todos');
  const [busca, setBusca] = useState('');
  const [vendedorId, setVendedorId] = useState('');
  const [composicao, setComposicao] = useState<'todos' | 'com_servico' | 'com_produto'>('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [pagina, setPagina] = useState(0);
  const [versao, setVersao] = useState(0);

  const [vendedores, setVendedores] = useState<SellerOption[]>([]);
  const [itens, setItens] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [somaTotalCents, setSomaTotalCents] = useState(0);
  const [contagens, setContagens] = useState<Record<FiltroSituacao, number>>({
    todos: 0,
    rascunho: 0,
    enviado: 0,
    aprovado: 0,
    recusado: 0,
    convertido: 0,
    vencido: 0,
  });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modalTextosAberto, setModalTextosAberto] = useState(false);

  useEffect(() => {
    if (!podeAcessar) return;
    listarVendedores()
      .then(setVendedores)
      .catch(() => {});
  }, [podeAcessar]);

  useEffect(() => {
    if (!podeAcessar) return;
    let ativo = true;
    const timer = setTimeout(() => {
      setCarregando(true);
      setErro(null);
      listarOrcamentos({
        pagina,
        busca,
        situacao,
        vendedorId,
        composicao,
        dataInicio,
        dataFim,
      })
        .then((res) => {
          if (!ativo) return;
          setItens(res.itens);
          setTotal(res.total);
          setSomaTotalCents(res.soma_total_cents);
          setContagens(res.contagens);
        })
        .catch((e: unknown) => {
          if (!ativo) return;
          setErro(e instanceof Error ? e.message : 'Não foi possível carregar os orçamentos.');
        })
        .finally(() => {
          if (ativo) setCarregando(false);
        });
    }, 140);

    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [podeAcessar, pagina, busca, situacao, vendedorId, composicao, dataInicio, dataFim, versao]);

  if (!podeAcessar) {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Lock size={24} />
        </div>
        <h1 className="mt-3 text-base font-bold text-slate-800">Acesso restrito</h1>
        <p className="mt-1 max-w-sm text-xs text-slate-500">
          O módulo de orçamentos é restrito à equipe do escritório e administradores.
        </p>
      </div>
    );
  }

  const abrirOrcamento = (id: string) => {
    setSearchParams((atual) => {
      const novo = new URLSearchParams(atual);
      novo.delete('novo');
      novo.set('orcamento', id);
      return novo;
    });
  };

  const abrirNovo = () => {
    setSearchParams((atual) => {
      const novo = new URLSearchParams(atual);
      novo.delete('orcamento');
      novo.set('novo', '1');
      return novo;
    });
  };

  const fecharEditor = () => {
    setSearchParams((atual) => {
      const novo = new URLSearchParams(atual);
      novo.delete('orcamento');
      novo.delete('novo');
      return novo;
    });
  };

  const totalPaginas = Math.max(1, Math.ceil(total / ITENS_VENDAS_POR_PAGINA));

  return (
    <div className="space-y-5">
      <NavegacaoVendas />

      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-brv-navy">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-brv-navy sm:text-2xl">
                Orçamentos
              </h1>
              <p className="text-xs text-slate-500">
                Propostas de produtos e serviços com aprovação por link no WhatsApp
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setModalTextosAberto(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Settings2 size={15} />
              Textos padrão
            </button>

            <button
              type="button"
              onClick={abrirNovo}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 sm:text-sm"
            >
              <Plus size={16} />
              Novo orçamento
            </button>
          </div>
        </div>

        {/* Chips de situação */}
        <search className="space-y-3 border-t border-slate-100 pt-3.5">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar orçamentos por situação">
            {CHIPS_SITUACAO.map((chip) => {
              const ativo = situacao === chip.id;
              const qtd = contagens[chip.id] ?? 0;
              return (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => {
                    setSituacao(chip.id);
                    setPagina(0);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                    ativo
                      ? 'border-brv-navy bg-brv-navy text-white shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {chip.id !== 'todos' && !ativo && (
                    <span className={`h-2 w-2 rounded-full ${CORES_SITUACAO_ORCAMENTO[chip.id].ponto}`} />
                  )}
                  <span>{chip.rotulo}</span>
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

          {/* Filtros secundários */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
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
                aria-label="Buscar orçamento por número, cliente, contato ou produto"
                placeholder="Buscar nº, cliente, contato ou item..."
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
              value={vendedorId}
              aria-label="Filtrar por vendedor"
              onChange={(e) => {
                setVendedorId(e.target.value);
                setPagina(0);
              }}
              className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none"
            >
              <option value="">Todos os vendedores</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>

            <select
              value={composicao}
              aria-label="Filtrar por tipo de item no orçamento"
              onChange={(e) => {
                setComposicao(e.target.value as 'todos' | 'com_servico' | 'com_produto');
                setPagina(0);
              }}
              className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none"
            >
              <option value="todos">Produtos e serviços</option>
              <option value="com_servico">Só com serviço</option>
              <option value="com_produto">Só com produto</option>
            </select>

            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={dataInicio}
                aria-label="Data inicial"
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  setPagina(0);
                }}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50/70 px-2 py-2 text-xs text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
              <span className="text-xs text-slate-400">a</span>
              <input
                type="date"
                value={dataFim}
                aria-label="Data final"
                onChange={(e) => {
                  setDataFim(e.target.value);
                  setPagina(0);
                }}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50/70 px-2 py-2 text-xs text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>
        </search>
      </div>

      {/* Estados da listagem */}
      {carregando ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-2xs">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          <span className="text-sm font-medium">Carregando orçamentos...</span>
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
          <FileSpreadsheet size={32} className="text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">Nenhum orçamento encontrado</p>
          <p className="max-w-sm text-xs text-slate-400">
            Ajuste os filtros ou clique em "Novo orçamento" para montar uma proposta.
          </p>
        </div>
      ) : (
        <>
          {/* Cartões no celular (< md) */}
          <div className="space-y-2.5 md:hidden">
            {itens.map((orc) => {
              const sit = situacaoOrcamento(orc);
              const temProd = orc.items.some((i) => i.kind === 'produto');
              const temServ = orc.items.some((i) => i.kind === 'servico');
              return (
                <button
                  key={orc.id}
                  type="button"
                  onClick={() => abrirOrcamento(orc.id)}
                  className="block w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:border-blue-300"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-sm font-extrabold text-brv-navy">
                      {orc.number}
                    </span>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${CORES_SITUACAO_ORCAMENTO[sit].selo}`}
                    >
                      {CORES_SITUACAO_ORCAMENTO[sit].rotulo}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-800">{orc.customer_name}</p>
                  {orc.contact_name && (
                    <p className="text-[11px] text-slate-500">Contato: {orc.contact_name}</p>
                  )}
                  <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                    <span className="text-[11px] text-slate-400">
                      {formatarData(orc.created_at)} · {orc.seller_name}
                    </span>
                    <div className="flex items-center gap-2">
                      {temProd && <Package size={13} className="text-sky-600" />}
                      {temServ && <Wrench size={13} className="text-indigo-600" />}
                      <strong className="font-extrabold text-brv-navy">
                        {formatarReais(orc.total_cents)}
                      </strong>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tabela no computador (>= md) */}
          <div
            tabIndex={0}
            role="region"
            aria-label="Tabela de orçamentos"
            className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs md:block"
          >
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Data / Validade</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Contato</th>
                  <th className="px-4 py-3">Composição</th>
                  <th className="px-4 py-3">Vendedor</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {itens.map((orc) => {
                  const sit = situacaoOrcamento(orc);
                  const temProd = orc.items.some((i) => i.kind === 'produto');
                  const temServ = orc.items.some((i) => i.kind === 'servico');
                  return (
                    <tr
                      key={orc.id}
                      onClick={() => abrirOrcamento(orc.id)}
                      className="cursor-pointer transition hover:bg-blue-50/35"
                    >
                      <td className="px-4 py-3 font-mono font-extrabold text-blue-600">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirOrcamento(orc.id);
                          }}
                          className="hover:underline"
                        >
                          {orc.number}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">
                          {formatarData(orc.created_at)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Val.: {formatarData(orc.valid_until)}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {orc.customer_name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{orc.contact_name || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {temProd && (
                            <span
                              title="Contém produtos"
                              className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800"
                            >
                              <Package size={11} /> Prod.
                            </span>
                          )}
                          {temServ && (
                            <span
                              title="Contém serviços"
                              className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-800"
                            >
                              <Wrench size={11} /> Serv.
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{orc.seller_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${CORES_SITUACAO_ORCAMENTO[sit].selo}`}
                        >
                          {CORES_SITUACAO_ORCAMENTO[sit].rotulo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold tabular-nums text-brv-navy">
                        {formatarReais(orc.total_cents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Rodapé com total do filtro e paginação */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                <strong>{total}</strong> {total === 1 ? 'orçamento' : 'orçamentos'} no filtro
              </span>
              <span>
                Total do filtro:{' '}
                <strong className="text-sm font-extrabold text-brv-navy">
                  {formatarReais(somaTotalCents)}
                </strong>
              </span>
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

      {(orcamentoParam || novoParam) && (
        <OrcamentoEditor
          key={orcamentoParam ?? 'novo'}
          orcamentoId={orcamentoParam ?? 'novo'}
          onFechar={fecharEditor}
          onSalvo={() => setVersao((v) => v + 1)}
          onTrocarOrcamento={(novoId) => abrirOrcamento(novoId)}
        />
      )}

      {(modalTextosAberto || rotaTextos) && (
        <ModalTextosPadraoOrcamento
          aberto
          onFechar={() => {
            setModalTextosAberto(false);
            if (rotaTextos) navigate('/orcamentos', { replace: true });
          }}
        />
      )}
    </div>
  );
}

