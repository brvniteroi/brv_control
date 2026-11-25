import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Lock,
  Plus,
  Search,
  ShoppingBag,
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
import FiltroPeriodo from '../components/comum/FiltroPeriodo';
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

const ABAS_VENDA: readonly { id: ChipVenda; rotulo: string }[] = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'hoje', rotulo: 'Hoje' },
  { id: 'a_receber', rotulo: 'A receber' },
  { id: 'canceladas', rotulo: 'Canceladas' },
];

const SELECT =
  'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

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
    <div className="space-y-6">
      {/* Cabeçalho da página */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Vendas</h1>
          <p className="mt-1 text-xs text-slate-500">
            Registre vendas de balcão, acompanhe recebimentos e emita notas fiscais.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NavegacaoVendas />

          <button
            type="button"
            onClick={abrirNovaVenda}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700"
          >
            <Plus size={18} />
            Nova venda
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <search className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative min-w-60 flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(0);
            }}
            placeholder="Buscar por número, cliente, nota ou item..."
            className="block w-full rounded-xl border border-slate-200 py-2.5 pr-3 pl-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex rounded-xl bg-slate-100 p-1">
          {ABAS_VENDA.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setChip(c.id);
                setPagina(0);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                chip === c.id
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {c.rotulo}
            </button>
          ))}
        </div>

        <select
          value={situacao}
          aria-label="Filtrar por situação da venda"
          onChange={(e) => {
            setSituacao(e.target.value as 'todas' | SaleDisplayStatus);
            setPagina(0);
          }}
          className={SELECT}
        >
          <option value="todas">Todas as situações</option>
          <option value="paga">Paga</option>
          <option value="parcial">Parcial</option>
          <option value="aberta">Aberta</option>
          <option value="cancelada">Cancelada</option>
        </select>

        <select
          value={formaPagamento}
          aria-label="Filtrar por forma de pagamento"
          onChange={(e) => {
            setFormaPagamento(e.target.value as 'todas' | FinancialPaymentMethod);
            setPagina(0);
          }}
          className={SELECT}
        >
          <option value="todas">Todas as formas</option>
          {(Object.keys(ROTULO_FORMA_PAGAMENTO) as FinancialPaymentMethod[]).map((m) => (
            <option key={m} value={m}>
              {ROTULO_FORMA_PAGAMENTO[m]}
            </option>
          ))}
        </select>

        <select
          value={origem}
          aria-label="Filtrar por origem"
          onChange={(e) => {
            setOrigem(e.target.value as 'todas' | SaleOriginType);
            setPagina(0);
          }}
          className={SELECT}
        >
          <option value="todas">Todas as origens</option>
          <option value="balcao">Balcão</option>
          <option value="orcamento">Orçamento</option>
          <option value="os">Ordem de Serviço</option>
        </select>

        <select
          value={statusNota}
          aria-label="Filtrar por nota fiscal"
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
          className={SELECT}
        >
          <option value="todas">Todas as notas</option>
          <option value="com_nota_emitida">Nota emitida</option>
          <option value="com_nota_pendente">Nota pendente</option>
          <option value="com_erro_nota">Erro na nota</option>
        </select>

        <FiltroPeriodo
          idPrefixo="vendas"
          dataInicio={dataInicio}
          dataFim={dataFim}
          onMudar={(ini, fim) => {
            setDataInicio(ini);
            setDataFim(fim);
            setPagina(0);
          }}
          classe={SELECT}
        />
      </search>

      {/* Estados da listagem */}
      {erro ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <span>{erro}</span>
          <button
            type="button"
            onClick={() => setVersao((v) => v + 1)}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 font-semibold text-red-700 hover:bg-red-100"
          >
            Tentar de novo
          </button>
        </div>
      ) : carregando ? (
        <div className="flex h-64 w-full items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <span className="text-xs font-medium">Carregando vendas...</span>
          </div>
        </div>
      ) : itens.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-2xs">
            <ShoppingBag size={28} />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-800">Nenhuma venda encontrada</h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            {busca || chip !== 'todas' || situacao !== 'todas' || formaPagamento !== 'todas' || origem !== 'todas' || statusNota !== 'todas' || dataInicio || dataFim
              ? 'Nenhuma venda corresponde aos filtros escolhidos.'
              : 'Registre a primeira venda para começar.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div
            tabIndex={0}
            role="region"
            aria-label="Tabela de vendas"
            className="overflow-x-auto"
          >
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Nº</th>
                  <th className="px-5 py-3.5">Cliente</th>
                  <th className="px-5 py-3.5">Origem</th>
                  <th className="px-5 py-3.5">Pagamento</th>
                  <th className="px-5 py-3.5">Situação</th>
                  <th className="px-5 py-3.5">Notas fiscais</th>
                  <th className="px-5 py-3.5">Data</th>
                  <th className="px-5 py-3.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {itens.map((venda) => {
                  const sit = situacaoVenda(venda);
                  const info = CORES_SITUACAO_VENDA[sit];
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
                      className="cursor-pointer transition hover:bg-slate-50/80"
                    >
                      <td className="px-5 py-4 font-mono font-bold text-slate-900">
                        {venda.number}
                      </td>
                      <td className="max-w-64 px-5 py-4">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {venda.customer_name}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {ROTULO_ORIGEM_VENDA[venda.origin_type]}
                        {venda.quote_number && (
                          <span className="block font-mono text-[11px] text-slate-400">
                            {venda.quote_number}
                          </span>
                        )}
                        {venda.service_order_number && (
                          <span className="block font-mono text-[11px] text-slate-400">
                            OS {venda.service_order_number}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {formas || <span className="text-amber-700">A receber</span>}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${info.selo}`}
                        >
                          {info.rotulo}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {venda.documents.map((doc) => (
                            <span
                              key={doc.id}
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CORES_STATUS_NOTA[doc.status].selo}`}
                            >
                              {ROTULO_MODELO_NOTA[doc.model]}: {CORES_STATUS_NOTA[doc.status].rotulo}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-slate-500">
                        {formatarDataHora(venda.created_at)}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-900">
                        {formatarReais(venda.total_cents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                {total} {total === 1 ? 'venda' : 'vendas'} · Total:{' '}
                <strong className="font-semibold text-slate-800">{formatarReais(somaTotalCents)}</strong>
              </span>
              <span>
                Recebido:{' '}
                <strong className="font-semibold text-emerald-700">{formatarReais(somaRecebidoCents)}</strong>
              </span>
              {somaAReceberCents > 0 && (
                <span>
                  A receber:{' '}
                  <strong className="font-semibold text-amber-700">{formatarReais(somaAReceberCents)}</strong>
                </span>
              )}
              <span>
                · página {pagina + 1} de {totalPaginas}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagina === 0}
                onClick={() => setPagina((p) => Math.max(0, p - 1))}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={pagina + 1 >= totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
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
