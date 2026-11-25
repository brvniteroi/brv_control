import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import FiltroPeriodo from '../components/comum/FiltroPeriodo';
import { ROTULO_ORIGEM_MOVIMENTO } from '../components/financeiro/cores';
import {
  CONTAS_FINANCEIRAS_DEMO,
  estornarMovimento,
  exportarMovimentosCsv,
  lancarMovimentoAvulso,
  listarCategorias,
  listarContas,
  listarFornecedores,
  listarMovimentos,
  transferir,
  useNivelFinanceiro,
} from '../components/financeiro/fonteDeDados';
import {
  ITENS_FINANCEIRO_POR_PAGINA,
  diaLocalFinanceiro,
} from '../components/financeiro/regrasFinanceiro';
import {
  ROTULO_FORMA_PAGAMENTO,
  ROTULO_FORMA_PAGAMENTO_CURTO,
} from '../components/vendas/cores';
import ModalDialogoVendas from '../components/vendas/ModalDialogoVendas';
import NavegacaoVendas from '../components/vendas/NavegacaoVendas';
import { semAcento } from '../components/vendas/regrasVendas';
import { useAuth } from '../contexts/useAuth';
import { useNavegacaoLista } from '../hooks/useNavegacaoLista';
import type {
  FinancialAccount,
  FinancialCategory,
  FinancialMovement,
  FinancialMovementDirection,
  FinancialMovementFilter,
  FinancialMovementListResult,
  FinancialPaymentMethod,
  Supplier,
} from '../types/financeiro';
import {
  converterTextoParaCentavos,
  formatarReais,
} from '../utils/dinheiro';
import { formatarDocumento } from '../utils/documento';
import { formatarData } from '../utils/ordens';

const INPUT =
  'mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none';

const FORMAS_PAGAMENTO: FinancialPaymentMethod[] = [
  'pix',
  'dinheiro',
  'debito',
  'credito',
  'boleto',
  'transferencia',
  'cheque',
];

export default function FinanceiroMovimentos() {
  const { profile } = useAuth();
  const atorNome = profile?.full_name || 'Adriana Lobo';
  const { nivel } = useNivelFinanceiro(profile);
  const [searchParams, setSearchParams] = useSearchParams();

  const [contas, setContas] = useState<FinancialAccount[]>(() => [...CONTAS_FINANCEIRAS_DEMO]);
  const [categorias, setCategorias] = useState<FinancialCategory[]>([]);
  const [fornecedores, setFornecedores] = useState<Supplier[]>([]);

  // Filtros
  const [busca, setBusca] = useState('');
  const [direcao, setDirecao] = useState<NonNullable<FinancialMovementFilter['direcao']>>('todas');
  const contaId = searchParams.get('conta') ?? '';
  const [formaPagamento, setFormaPagamento] =
    useState<NonNullable<FinancialMovementFilter['formaPagamento']>>('todas');
  const [categoriaId, setCategoriaId] = useState('');
  const [origem, setOrigem] = useState<NonNullable<FinancialMovementFilter['origem']>>('todas');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [pagina, setPagina] = useState(0);

  const [resultado, setResultado] = useState<FinancialMovementListResult>({
    itens: [],
    total: 0,
    soma_entradas_cents: 0,
    soma_saidas_cents: 0,
    saldo_liquido_cents: 0,
    saldo_atual_conta_cents: null,
  });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  // Modal: Lançamento avulso
  const [modalAvulso, setModalAvulso] = useState(false);
  const [avulsoDirecao, setAvulsoDirecao] = useState<FinancialMovementDirection>('saida');
  const [avulsoData, setAvulsoData] = useState(() => diaLocalFinanceiro());
  const [avulsoContaId, setAvulsoContaId] = useState('conta-itau');
  const [avulsoCategoriaId, setAvulsoCategoriaId] = useState('');
  const [avulsoForma, setAvulsoForma] = useState<FinancialPaymentMethod>('pix');
  const [avulsoValorTexto, setAvulsoValorTexto] = useState('');
  const [avulsoDescricao, setAvulsoDescricao] = useState('');
  const [avulsoFornecedor, setAvulsoFornecedor] = useState<Supplier | null>(null);
  const [buscaFornecedor, setBuscaFornecedor] = useState('');
  const [listaFornecedorAberta, setListaFornecedorAberta] = useState(false);

  // Modal: Transferência entre contas
  const [modalTransferencia, setModalTransferencia] = useState(false);
  const [transfData, setTransfData] = useState(() => diaLocalFinanceiro());
  const [transfOrigemId, setTransfOrigemId] = useState('conta-caixa-brv');
  const [transfDestinoId, setTransfDestinoId] = useState('conta-itau');
  const [transfValorTexto, setTransfValorTexto] = useState('');
  const [transfDescricao, setTransfDescricao] = useState('');

  // Modal: Estorno
  const [movimentoEstornar, setMovimentoEstornar] = useState<FinancialMovement | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);

  useEffect(() => {
    if (nivel !== 'completo') return;
    let ativo = true;
    Promise.all([listarContas(), listarCategorias(), listarFornecedores()])
      .then(([c, cat, forn]) => {
        if (!ativo) return;
        setContas(c);
        setCategorias(cat);
        setFornecedores(forn);
      })
      .catch(() => {
        // Mantém os dados iniciais
      });
    return () => {
      ativo = false;
    };
  }, [nivel]);

  const carregarMovimentos = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [res, contasAtualizadas] = await Promise.all([
        listarMovimentos({
          pagina,
          busca,
          contaId: contaId || undefined,
          formaPagamento,
          categoriaId: categoriaId || undefined,
          origem,
          direcao,
          dataInicio: dataInicio || undefined,
          dataFim: dataFim || undefined,
        }),
        listarContas(),
      ]);
      setResultado(res);
      setContas(contasAtualizadas);
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : 'Não foi possível carregar o extrato de movimentos.',
      );
    } finally {
      setCarregando(false);
    }
  }, [
    pagina,
    busca,
    contaId,
    formaPagamento,
    categoriaId,
    origem,
    direcao,
    dataInicio,
    dataFim,
  ]);

  useEffect(() => {
    if (nivel !== 'completo') return;
    const timer = setTimeout(() => {
      void carregarMovimentos();
    }, 0);
    return () => clearTimeout(timer);
  }, [carregarMovimentos, nivel]);

  // Busca de fornecedor com teclado (Regra 7 do GEMINI.md e seção 6.0 item 5: useNavegacaoLista)
  const fornecedoresFiltrados = useMemo(() => {
    const t = semAcento(buscaFornecedor);
    return fornecedores
      .filter((f) => f.active)
      .filter((f) => !t || semAcento(`${f.name} ${f.document ?? ''}`).includes(t));
  }, [fornecedores, buscaFornecedor]);

  const {
    ativo: indiceFornecedorAtivo,
    setAtivo: setIndiceFornecedorAtivo,
    aoTeclar: aoTeclarFornecedor,
  } = useNavegacaoLista({
    itens: fornecedoresFiltrados,
    aberta: listaFornecedorAberta,
    idPrefixo: 'fin-forn-opcao',
    aoEscolher: (escolhido) => {
      setAvulsoFornecedor(escolhido);
      setBuscaFornecedor('');
      setListaFornecedorAberta(false);
    },
    aoAbrir: () => setListaFornecedorAberta(true),
    aoFechar: () => setListaFornecedorAberta(false),
  });

  // Bloqueio para níveis `caixa` e `nenhum` (seção 6.4)
  if (nivel !== 'completo') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Movimentos</h1>
            <p className="mt-1 text-xs text-slate-500">
              Extrato de entradas, saídas, transferências e estornos.
            </p>
          </div>
          <NavegacaoVendas />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-base font-bold text-slate-800">Acesso restrito</p>
          <p className="mt-1 text-xs text-slate-500">
            O extrato completo de movimentos e saldos bancários está disponível apenas para o
            acesso financeiro completo.
          </p>
        </div>
      </div>
    );
  }

  const handleExportarCsv = async () => {
    setExportando(true);
    try {
      const csv = await exportarMovimentosCsv({
        busca,
        contaId: contaId || undefined,
        formaPagamento,
        categoriaId: categoriaId || undefined,
        origem,
        direcao,
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `movimentos-brv-${diaLocalFinanceiro()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExportando(false);
    }
  };

  const abrirModalAvulso = () => {
    setErroModal(null);
    setAvulsoDirecao('saida');
    setAvulsoData(diaLocalFinanceiro());
    setAvulsoContaId(contaId || 'conta-itau');
    const primeiraDespesa = categorias.find((c) => c.active && c.kind === 'despesa');
    setAvulsoCategoriaId(primeiraDespesa?.id ?? '');
    setAvulsoForma('pix');
    setAvulsoValorTexto('');
    setAvulsoDescricao('');
    setAvulsoFornecedor(null);
    setBuscaFornecedor('');
    setListaFornecedorAberta(false);
    setModalAvulso(true);
  };

  const handleSalvarAvulso = async (e: FormEvent) => {
    e.preventDefault();
    setErroModal(null);
    const centavos = converterTextoParaCentavos(avulsoValorTexto) ?? 0;
    if (centavos <= 0) {
      setErroModal('Informe um valor maior que zero.');
      return;
    }
    if (!avulsoCategoriaId) {
      setErroModal('Escolha a categoria.');
      return;
    }
    if (!avulsoDescricao.trim()) {
      setErroModal('Informe a descrição do lançamento.');
      return;
    }
    setSalvando(true);
    try {
      await lancarMovimentoAvulso(
        {
          direction: avulsoDirecao,
          occurred_date: avulsoData,
          account_id: avulsoContaId,
          category_id: avulsoCategoriaId,
          method: avulsoForma,
          amount_cents: centavos,
          description: avulsoDescricao.trim(),
          supplier_id: avulsoDirecao === 'saida' ? (avulsoFornecedor?.id ?? null) : null,
        },
        atorNome,
      );
      setModalAvulso(false);
      await carregarMovimentos();
    } catch (err) {
      setErroModal(err instanceof Error ? err.message : 'Erro ao salvar lançamento.');
    } finally {
      setSalvando(false);
    }
  };

  const handleSalvarTransferencia = async (e: FormEvent) => {
    e.preventDefault();
    setErroModal(null);
    const centavos = converterTextoParaCentavos(transfValorTexto) ?? 0;
    if (centavos <= 0) {
      setErroModal('Informe um valor maior que zero.');
      return;
    }
    if (transfOrigemId === transfDestinoId) {
      setErroModal('Escolha contas de origem e destino diferentes.');
      return;
    }
    setSalvando(true);
    try {
      await transferir(
        {
          occurred_date: transfData,
          from_account_id: transfOrigemId,
          to_account_id: transfDestinoId,
          amount_cents: centavos,
          description: transfDescricao.trim() || undefined,
        },
        atorNome,
      );
      setModalTransferencia(false);
      await carregarMovimentos();
    } catch (err) {
      setErroModal(err instanceof Error ? err.message : 'Erro ao transferir entre contas.');
    } finally {
      setSalvando(false);
    }
  };

  const handleConfirmarEstorno = async (e: FormEvent) => {
    e.preventDefault();
    if (!movimentoEstornar) return;
    setErroModal(null);
    if (!motivoEstorno.trim()) {
      setErroModal('Informe o motivo do estorno.');
      return;
    }
    setSalvando(true);
    try {
      await estornarMovimento(movimentoEstornar.id, motivoEstorno.trim(), atorNome);
      setMovimentoEstornar(null);
      setMotivoEstorno('');
      await carregarMovimentos();
    } catch (err) {
      setErroModal(err instanceof Error ? err.message : 'Erro ao estornar movimento.');
    } finally {
      setSalvando(false);
    }
  };

  const totalPaginas = Math.max(1, Math.ceil(resultado.total / ITENS_FINANCEIRO_POR_PAGINA));
  const categoriasDoModal = categorias.filter(
    (c) => c.active && c.kind === (avulsoDirecao === 'entrada' ? 'receita' : 'despesa'),
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho padrão Clientes.tsx (Regra 1 do GEMINI.md) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Movimentos</h1>
          <p className="mt-1 text-xs text-slate-500">
            Extrato imutável de entradas, saídas, transferências e estornos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <NavegacaoVendas />

          <button
            type="button"
            disabled={exportando || resultado.total === 0}
            onClick={() => void handleExportarCsv()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {exportando ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            Exportar CSV
          </button>

          <button
            type="button"
            onClick={() => {
              setErroModal(null);
              setTransfData(diaLocalFinanceiro());
              setTransfOrigemId('conta-caixa-brv');
              setTransfDestinoId('conta-itau');
              setTransfValorTexto('');
              setTransfDescricao('');
              setModalTransferencia(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeftRight size={14} />
            Transferir
          </button>

          <button
            type="button"
            onClick={abrirModalAvulso}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Lançamento avulso
          </button>
        </div>
      </div>

      {/* Barra única de filtros (Regra 2 do GEMINI.md e seção 6.0 item 3: usa FiltroPeriodo sem atalhos extras) */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(0);
            }}
            placeholder="Buscar por descrição, cliente, fornecedor..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-3.5 pl-9 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
          {(
            [
              { id: 'todas', rotulo: 'Todos' },
              { id: 'entrada', rotulo: 'Entradas' },
              { id: 'saida', rotulo: 'Saídas' },
              { id: 'estornos', rotulo: 'Estornos' },
            ] as const
          ).map((op) => (
            <button
              key={op.id}
              type="button"
              onClick={() => {
                setDirecao(op.id);
                setPagina(0);
              }}
              className={`rounded-lg px-3 py-1.5 transition ${
                direcao === op.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {op.rotulo}
            </button>
          ))}
        </div>

        <select
          value={contaId}
          aria-label="Filtrar por conta"
          onChange={(e) => {
            const v = e.target.value;
            setPagina(0);
            if (v) setSearchParams({ conta: v }, { replace: true });
            else setSearchParams({}, { replace: true });
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
        >
          <option value="">Todas as contas</option>
          {contas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({formatarReais(c.current_balance_cents)})
            </option>
          ))}
        </select>

        <select
          value={formaPagamento}
          aria-label="Filtrar por forma de pagamento"
          onChange={(e) => {
            setFormaPagamento(
              e.target.value as NonNullable<FinancialMovementFilter['formaPagamento']>,
            );
            setPagina(0);
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
        >
          <option value="todas">Todas as formas</option>
          {FORMAS_PAGAMENTO.map((m) => (
            <option key={m} value={m}>
              {ROTULO_FORMA_PAGAMENTO[m]}
            </option>
          ))}
        </select>

        <select
          value={categoriaId}
          aria-label="Filtrar por categoria"
          onChange={(e) => {
            setCategoriaId(e.target.value);
            setPagina(0);
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
        >
          <option value="">Todas as categorias</option>
          {categorias.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        <select
          value={origem}
          aria-label="Filtrar por origem"
          onChange={(e) => {
            setOrigem(e.target.value as NonNullable<FinancialMovementFilter['origem']>);
            setPagina(0);
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
        >
          <option value="todas">Todas as origens</option>
          <option value="venda">Venda</option>
          <option value="os">Ordem de Serviço</option>
          <option value="avulso">Avulso</option>
          <option value="transferencia">Transferência</option>
        </select>

        <FiltroPeriodo
          idPrefixo="fin-mov-periodo"
          dataInicio={dataInicio}
          dataFim={dataFim}
          onMudar={(ini, fim) => {
            setDataInicio(ini);
            setDataFim(fim);
            setPagina(0);
          }}
          classe="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Tabela de movimentos (sem fileira de cartões acima; resumo no rodapé como em Vendas.tsx) */}
      {carregando ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-slate-500">
          <Loader2 size={20} className="mr-2 animate-spin text-blue-600" />
          <span className="text-sm font-medium">Carregando movimentos...</span>
        </div>
      ) : erro ? (
        <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-red-700">{erro}</p>
          <button
            type="button"
            onClick={() => void carregarMovimentos()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={14} /> Tentar de novo
          </button>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Descrição / Origem</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Forma</th>
                  <th className="px-4 py-3">Conta</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  {contaId && <th className="px-4 py-3 text-right">Saldo na conta</th>}
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {resultado.itens.length === 0 ? (
                  <tr>
                    <td
                      colSpan={contaId ? 8 : 7}
                      className="px-4 py-10 text-center text-slate-400"
                    >
                      Nenhum movimento encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  resultado.itens.map((mov) => {
                    const jaEstornado = Boolean(mov.reversed_by_movement_id);
                    const ehEstorno = mov.is_reversal;

                    return (
                      <tr
                        key={mov.id}
                        className={`hover:bg-slate-50/60 ${
                          jaEstornado ? 'bg-slate-50/40 text-slate-400' : ''
                        }`}
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                          {formatarData(mov.occurred_date)}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`font-semibold ${
                                jaEstornado ? 'line-through text-slate-400' : 'text-slate-900'
                              }`}
                            >
                              {mov.description}
                            </span>

                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              {mov.origin_label || ROTULO_ORIGEM_MOVIMENTO[mov.origin_type]}
                            </span>

                            {ehEstorno && (
                              <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                Estorno
                              </span>
                            )}

                            {jaEstornado && (
                              <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                Já estornado
                              </span>
                            )}
                          </div>

                          {(mov.customer_name || mov.supplier_name || mov.reverses_description) && (
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {mov.customer_name ? `Cliente: ${mov.customer_name}` : ''}
                              {mov.supplier_name ? `Fornecedor: ${mov.supplier_name}` : ''}
                              {mov.reverses_description
                                ? `Estorna: ${mov.reverses_description}`
                                : ''}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {mov.category_name || 'Transferência'}
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {ROTULO_FORMA_PAGAMENTO_CURTO[mov.method]}
                        </td>

                        <td className="px-4 py-3 font-medium text-slate-800">
                          {mov.account_name}
                        </td>

                        <td
                          className={`whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums ${
                            jaEstornado
                              ? 'line-through text-slate-400'
                              : mov.direction === 'entrada'
                                ? 'text-emerald-700'
                                : 'text-red-700'
                          }`}
                        >
                          {mov.direction === 'entrada' ? '+ ' : '- '}
                          {formatarReais(mov.amount_cents)}
                        </td>

                        {contaId && (
                          <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-700">
                            {mov.running_balance_cents != null
                              ? formatarReais(mov.running_balance_cents)
                              : '—'}
                          </td>
                        )}

                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {!ehEstorno && !jaEstornado ? (
                            <button
                              type="button"
                              onClick={() => {
                                setErroModal(null);
                                setMotivoEstorno('');
                                setMovimentoEstornar(mov);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <RotateCcw size={12} />
                              Estornar
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {ehEstorno ? 'Estorno' : 'Estornado'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Rodapé único com totais e paginação (modelo Vendas.tsx) */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-4">
              <span>{resultado.total} movimentos</span>
              <span>
                Entradas:{' '}
                <strong className="tabular-nums text-emerald-700">
                  + {formatarReais(resultado.soma_entradas_cents)}
                </strong>
              </span>
              <span>
                Saídas:{' '}
                <strong className="tabular-nums text-red-700">
                  - {formatarReais(resultado.soma_saidas_cents)}
                </strong>
              </span>
              <span>
                Líquido:{' '}
                <strong
                  className={`tabular-nums ${
                    resultado.saldo_liquido_cents >= 0
                      ? 'text-slate-900'
                      : 'text-red-700'
                  }`}
                >
                  {formatarReais(resultado.saldo_liquido_cents)}
                </strong>
              </span>
              {resultado.saldo_atual_conta_cents !== null && (
                <span>
                  Saldo atual da conta:{' '}
                  <strong className="tabular-nums text-blue-700">
                    {formatarReais(resultado.saldo_atual_conta_cents)}
                  </strong>
                </span>
              )}
            </div>

            {totalPaginas > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagina === 0}
                  onClick={() => setPagina((p) => Math.max(0, p - 1))}
                  aria-label="Página anterior"
                  className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="font-medium text-slate-700">
                  Página {pagina + 1} de {totalPaginas}
                </span>
                <button
                  type="button"
                  disabled={pagina + 1 >= totalPaginas}
                  onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
                  aria-label="Próxima página"
                  className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Modal: Lançamento avulso (com busca de fornecedor por setas do teclado via useNavegacaoLista) */}
      {modalAvulso && (
        <ModalDialogoVendas
          aberto
          onFechar={() => setModalAvulso(false)}
          titulo="Lançamento avulso"
          larguraMax="max-w-lg"
        >
          <form onSubmit={(e) => void handleSalvarAvulso(e)} className="space-y-4">
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setAvulsoDirecao('saida');
                  const cat = categorias.find((c) => c.active && c.kind === 'despesa');
                  setAvulsoCategoriaId(cat?.id ?? '');
                }}
                className={`flex-1 rounded-lg py-2 transition ${
                  avulsoDirecao === 'saida'
                    ? 'bg-white text-red-700 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Despesa (saída)
              </button>
              <button
                type="button"
                onClick={() => {
                  setAvulsoDirecao('entrada');
                  const cat = categorias.find((c) => c.active && c.kind === 'receita');
                  setAvulsoCategoriaId(cat?.id ?? '');
                }}
                className={`flex-1 rounded-lg py-2 transition ${
                  avulsoDirecao === 'entrada'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Receita (entrada)
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="av-data" className="block text-xs font-semibold text-slate-700">
                  Data *
                </label>
                <input
                  id="av-data"
                  type="date"
                  required
                  value={avulsoData}
                  onChange={(e) => setAvulsoData(e.target.value)}
                  className={INPUT}
                />
              </div>

              <div>
                <label htmlFor="av-valor" className="block text-xs font-semibold text-slate-700">
                  Valor (R$) *
                </label>
                <input
                  id="av-valor"
                  type="text"
                  inputMode="decimal"
                  required
                  value={avulsoValorTexto}
                  onChange={(e) => setAvulsoValorTexto(e.target.value)}
                  placeholder="0,00"
                  className={INPUT}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="av-conta" className="block text-xs font-semibold text-slate-700">
                  Conta *
                </label>
                <select
                  id="av-conta"
                  value={avulsoContaId}
                  onChange={(e) => setAvulsoContaId(e.target.value)}
                  className={INPUT}
                >
                  {contas
                    .filter((c) => c.active)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label htmlFor="av-cat" className="block text-xs font-semibold text-slate-700">
                  Categoria *
                </label>
                <select
                  id="av-cat"
                  value={avulsoCategoriaId}
                  onChange={(e) => setAvulsoCategoriaId(e.target.value)}
                  className={INPUT}
                >
                  {categoriasDoModal.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="av-forma" className="block text-xs font-semibold text-slate-700">
                  Forma *
                </label>
                <select
                  id="av-forma"
                  value={avulsoForma}
                  onChange={(e) => setAvulsoForma(e.target.value as FinancialPaymentMethod)}
                  className={INPUT}
                >
                  {FORMAS_PAGAMENTO.map((m) => (
                    <option key={m} value={m}>
                      {ROTULO_FORMA_PAGAMENTO[m]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="av-desc" className="block text-xs font-semibold text-slate-700">
                Descrição *
              </label>
              <input
                id="av-desc"
                type="text"
                required
                value={avulsoDescricao}
                onChange={(e) => setAvulsoDescricao(e.target.value)}
                placeholder="Ex.: Compra de gás refrigerante / Energia elétrica da loja"
                className={INPUT}
              />
            </div>

            {/* Seletor de fornecedor com setas do teclado (Regra 7 do GEMINI.md: useNavegacaoLista) */}
            {avulsoDirecao === 'saida' && (
              <div className="relative">
                <label
                  htmlFor="av-fornecedor-busca"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Fornecedor (opcional)
                </label>

                {avulsoFornecedor ? (
                  <div className="mt-1.5 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    <div>
                      <strong className="text-slate-900">{avulsoFornecedor.name}</strong>
                      {avulsoFornecedor.document && (
                        <span className="ml-2 text-slate-500">
                          {formatarDocumento(
                            avulsoFornecedor.document,
                            avulsoFornecedor.person_type,
                          )}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setAvulsoFornecedor(null)}
                      aria-label="Remover fornecedor"
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      id="av-fornecedor-busca"
                      type="text"
                      value={buscaFornecedor}
                      onFocus={() => setListaFornecedorAberta(true)}
                      onChange={(e) => {
                        setBuscaFornecedor(e.target.value);
                        setListaFornecedorAberta(true);
                      }}
                      onKeyDown={aoTeclarFornecedor}
                      placeholder="Buscar fornecedor por nome ou CNPJ (use ↓/↑ e Enter)..."
                      className={INPUT}
                    />

                    {listaFornecedorAberta && fornecedoresFiltrados.length > 0 && (
                      <ul
                        role="listbox"
                        className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 text-xs shadow-sm"
                      >
                        {fornecedoresFiltrados.map((f, idx) => (
                          <li
                            key={f.id}
                            id={`fin-forn-opcao-${idx}`}
                            role="option"
                            aria-selected={idx === indiceFornecedorAtivo}
                            onMouseEnter={() => setIndiceFornecedorAtivo(idx)}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setAvulsoFornecedor(f);
                              setBuscaFornecedor('');
                              setListaFornecedorAberta(false);
                            }}
                            className={`flex cursor-pointer items-center justify-between px-3 py-2 ${
                              idx === indiceFornecedorAtivo
                                ? 'bg-blue-50 text-blue-900'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span className="font-semibold">{f.name}</span>
                            {f.document && (
                              <span className="text-[11px] text-slate-400">
                                {formatarDocumento(f.document, f.person_type)}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}

            {erroModal && (
              <p role="alert" className="text-xs font-medium text-red-600">
                {erroModal}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModalAvulso(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {salvando && <Loader2 size={13} className="animate-spin" />}
                Salvar lançamento
              </button>
            </div>
          </form>
        </ModalDialogoVendas>
      )}

      {/* Modal: Transferir entre contas */}
      {modalTransferencia && (
        <ModalDialogoVendas
          aberto
          onFechar={() => setModalTransferencia(false)}
          titulo="Transferir entre contas"
          larguraMax="max-w-md"
        >
          <form onSubmit={(e) => void handleSalvarTransferencia(e)} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="tr-data" className="block text-xs font-semibold text-slate-700">
                  Data *
                </label>
                <input
                  id="tr-data"
                  type="date"
                  required
                  value={transfData}
                  onChange={(e) => setTransfData(e.target.value)}
                  className={INPUT}
                />
              </div>

              <div>
                <label htmlFor="tr-valor" className="block text-xs font-semibold text-slate-700">
                  Valor (R$) *
                </label>
                <input
                  id="tr-valor"
                  type="text"
                  inputMode="decimal"
                  required
                  value={transfValorTexto}
                  onChange={(e) => setTransfValorTexto(e.target.value)}
                  placeholder="0,00"
                  className={INPUT}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="tr-origem" className="block text-xs font-semibold text-slate-700">
                  Conta de origem (saída) *
                </label>
                <select
                  id="tr-origem"
                  value={transfOrigemId}
                  onChange={(e) => setTransfOrigemId(e.target.value)}
                  className={INPUT}
                >
                  {contas
                    .filter((c) => c.active)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label htmlFor="tr-destino" className="block text-xs font-semibold text-slate-700">
                  Conta de destino (entrada) *
                </label>
                <select
                  id="tr-destino"
                  value={transfDestinoId}
                  onChange={(e) => setTransfDestinoId(e.target.value)}
                  className={INPUT}
                >
                  {contas
                    .filter((c) => c.active)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="tr-obs" className="block text-xs font-semibold text-slate-700">
                Observação
              </label>
              <input
                id="tr-obs"
                type="text"
                value={transfDescricao}
                onChange={(e) => setTransfDescricao(e.target.value)}
                placeholder="Ex.: Depósito do numerário do caixa"
                className={INPUT}
              />
            </div>

            {erroModal && (
              <p role="alert" className="text-xs font-medium text-red-600">
                {erroModal}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModalTransferencia(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {salvando && <Loader2 size={13} className="animate-spin" />}
                Confirmar transferência
              </button>
            </div>
          </form>
        </ModalDialogoVendas>
      )}

      {/* Modal: Estornar movimento */}
      {movimentoEstornar && (
        <ModalDialogoVendas
          aberto
          onFechar={() => setMovimentoEstornar(null)}
          titulo="Estornar movimento"
          larguraMax="max-w-md"
        >
          <form onSubmit={(e) => void handleConfirmarEstorno(e)} className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">{movimentoEstornar.description}</p>
              <p className="mt-1 text-slate-500">
                {formatarData(movimentoEstornar.occurred_date)} · {movimentoEstornar.account_name}{' '}
                ·{' '}
                <strong
                  className={
                    movimentoEstornar.direction === 'entrada'
                      ? 'text-emerald-700'
                      : 'text-red-700'
                  }
                >
                  {movimentoEstornar.direction === 'entrada' ? '+ ' : '- '}
                  {formatarReais(movimentoEstornar.amount_cents)}
                </strong>
              </p>
            </div>

            <div>
              <label htmlFor="est-motivo" className="block text-xs font-semibold text-slate-700">
                Motivo do estorno *
              </label>
              <textarea
                id="est-motivo"
                rows={3}
                required
                value={motivoEstorno}
                onChange={(e) => setMotivoEstorno(e.target.value)}
                placeholder="Informe o motivo para gerar o lançamento inverso no extrato"
                className={INPUT}
              />
            </div>

            {erroModal && (
              <p role="alert" className="text-xs font-medium text-red-600">
                {erroModal}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMovimentoEstornar(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {salvando && <Loader2 size={13} className="animate-spin" />}
                Confirmar estorno
              </button>
            </div>
          </form>
        </ModalDialogoVendas>
      )}
    </div>
  );
}
