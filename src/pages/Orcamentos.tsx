import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Lock,
  Plus,
  Search,
} from 'lucide-react';
import { CORES_SITUACAO_ORCAMENTO } from '../components/vendas/cores';
import {
  listarOrcamentos,
  listarVendedores,
} from '../components/vendas/fonteDeDados';
import NavegacaoVendas from '../components/vendas/NavegacaoVendas';
import FiltroPeriodo from '../components/comum/FiltroPeriodo';
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

const OPCOES_SITUACAO: readonly { id: FiltroSituacao; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todas as situações' },
  { id: 'rascunho', rotulo: 'Rascunho' },
  { id: 'enviado', rotulo: 'Enviado' },
  { id: 'aprovado', rotulo: 'Aprovado' },
  { id: 'recusado', rotulo: 'Recusado' },
  { id: 'convertido', rotulo: 'Convertido' },
  { id: 'vencido', rotulo: 'Vencido' },
];

const SELECT =
  'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

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
    <div className="space-y-6">
      {/* Cabeçalho da página */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Orçamentos</h1>
          <p className="mt-1 text-xs text-slate-500">
            Elabore propostas, envie o link de aprovação e converta em venda ou OS.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NavegacaoVendas />

          <Link
            to="/orcamentos/sicweb"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Antigos (SicWeb)
          </Link>

          <button
            type="button"
            onClick={() => setModalTextosAberto(true)}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Textos padrão
          </button>

          <button
            type="button"
            onClick={abrirNovo}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700"
          >
            <Plus size={18} />
            Novo orçamento
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <search className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs lg:flex-row lg:items-center">
        <div className="relative flex-1">
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
            placeholder="Buscar por número, cliente, contato ou item..."
            className="block w-full rounded-xl border border-slate-200 py-2.5 pr-3 pl-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <select
          aria-label="Filtrar por situação"
          value={situacao}
          onChange={(e) => {
            setSituacao(e.target.value as FiltroSituacao);
            setPagina(0);
          }}
          className={SELECT}
        >
          {OPCOES_SITUACAO.map((op) => (
            <option key={op.id} value={op.id}>
              {op.rotulo}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrar por vendedor"
          value={vendedorId}
          onChange={(e) => {
            setVendedorId(e.target.value);
            setPagina(0);
          }}
          className={SELECT}
        >
          <option value="">Todos os vendedores</option>
          {vendedores.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrar por composição"
          value={composicao}
          onChange={(e) => {
            setComposicao(e.target.value as 'todos' | 'com_servico' | 'com_produto');
            setPagina(0);
          }}
          className={SELECT}
        >
          <option value="todos">Produtos e serviços</option>
          <option value="com_servico">Com serviço</option>
          <option value="com_produto">Com produto</option>
        </select>

        <FiltroPeriodo
          idPrefixo="orcamentos"
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
            <span className="text-xs font-medium">Carregando orçamentos...</span>
          </div>
        </div>
      ) : itens.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-2xs">
            <FileText size={28} />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-800">Nenhum orçamento encontrado</h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            {busca || situacao !== 'todos' || vendedorId || composicao !== 'todos' || dataInicio || dataFim
              ? 'Nenhum orçamento corresponde aos filtros escolhidos.'
              : 'Crie o primeiro orçamento para começar.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div
            tabIndex={0}
            role="region"
            aria-label="Tabela de orçamentos"
            className="overflow-x-auto"
          >
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Nº</th>
                  <th className="px-5 py-3.5">Cliente</th>
                  <th className="px-5 py-3.5">Contato</th>
                  <th className="px-5 py-3.5">Situação</th>
                  <th className="px-5 py-3.5">Vendedor</th>
                  <th className="px-5 py-3.5">Emissão</th>
                  <th className="px-5 py-3.5">Validade</th>
                  <th className="px-5 py-3.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {itens.map((orc) => {
                  const sit = situacaoOrcamento(orc);
                  const info = CORES_SITUACAO_ORCAMENTO[sit];
                  return (
                    <tr
                      key={orc.id}
                      onClick={() => abrirOrcamento(orc.id)}
                      className="cursor-pointer transition hover:bg-slate-50/80"
                    >
                      <td className="px-5 py-4 font-mono font-bold text-slate-900">
                        {orc.number}
                      </td>
                      <td className="max-w-64 px-5 py-4">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {orc.customer_name}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{orc.contact_name || '—'}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${info.selo}`}
                        >
                          {info.rotulo}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{orc.seller_name || '—'}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-slate-500">
                        {formatarData(orc.created_at)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-slate-500">
                        {formatarData(orc.valid_until)}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-900">
                        {formatarReais(orc.total_cents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            <span>
              {total} {total === 1 ? 'orçamento' : 'orçamentos'} · Total:{' '}
              <strong className="font-semibold text-slate-800">{formatarReais(somaTotalCents)}</strong> · página{' '}
              {pagina + 1} de {totalPaginas}
            </span>
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
