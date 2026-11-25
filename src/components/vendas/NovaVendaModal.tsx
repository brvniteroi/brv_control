import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Barcode,
  CheckCircle2,
  CreditCard,
  Loader2,
  Package,
  Plus,
  Printer,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Trash2,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import type { FinancialPaymentMethod } from '../../types/financeiro';
import type { Customer, PersonType } from '../../types/fsm';
import type {
  CatalogItem,
  CatalogItemKind,
  Sale,
  SellerOption,
} from '../../types/vendas';
import {
  calcularLinhaItemCentavos,
  calcularPercentualDesconto,
  centavosParaTextoInput,
  converterTextoParaCentavos,
  formatarReais,
  somarCentavos,
  type ModoDescontoLinha,
} from '../../utils/dinheiro';
import { documentoValido, formatarDocumento } from '../../utils/documento';
import {
  CONTAS_FINANCEIRAS_DEMO,
  MAQUININHAS_DEMO,
  useNivelFinanceiro,
} from '../financeiro/fonteDeDados';
import SeletorCliente from '../ordens/SeletorCliente';
import {
  CORES_TIPO_ITEM,
  ROTULO_FORMA_PAGAMENTO,
  ROTULO_FORMA_PAGAMENTO_CURTO,
} from './cores';
import {
  buscarItensParaBusca,
  buscarOrcamento,
  concluirVenda,
  listarItensFrequentes,
  listarVendedores,
} from './fonteDeDados';
import NotasFiscaisVenda, { ReciboVendaModal } from './NotasFiscaisVenda';
import {
  ModalItemAvulso,
  type ItemAvulsoResultado,
} from './OrcamentoModais';
import {
  LIMITE_DESCONTO_SEM_SENHA_PERCENT,
  calcularTaxaMaquininha,
  recalcularTotaisOrcamentoOuVenda,
} from './regrasVendas';

interface LinhaCarrinho {
  uid: string;
  catalog_item_id: string | null;
  is_custom: boolean;
  kind: CatalogItemKind;
  code: string;
  name: string;
  unit: string;
  quantityTexto: string;
  unitPriceTexto: string;
  discountMode: ModoDescontoLinha;
  discountTexto: string;
  controlsStock?: boolean;
  stockQuantity?: number;
}

interface LinhaPagamentoPdv {
  uid: string;
  method: FinancialPaymentMethod;
  amountTexto: string;
  tenderedTexto: string;
  accountId: string;
  machineId: string;
  installments: number;
}

function parseQtd(texto: string): number {
  const n = Number(texto.trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseDesc(modo: ModoDescontoLinha, texto: string): number {
  if (!texto.trim()) return 0;
  if (modo === 'percentual') {
    const pct = Number(texto.trim().replace(',', '.'));
    return Number.isFinite(pct) && pct >= 0 ? Math.min(100, pct) : 0;
  }
  return converterTextoParaCentavos(texto) ?? 0;
}

interface NovaVendaModalProps {
  /** Se informado, pré-preenche a venda com o cliente e os itens do orçamento. */
  orcamentoOrigemId?: string | null;
  onFechar: () => void;
  onVendaConcluida: (venda: Sale) => void;
  onAbrirDetalheVenda: (vendaId: string) => void;
}

export default function NovaVendaModal({
  orcamentoOrigemId,
  onFechar,
  onVendaConcluida,
  onAbrirDetalheVenda,
}: NovaVendaModalProps) {
  const { profile } = useAuth();
  const atorNome = profile?.full_name || 'Equipe BRV';
  const { nivel } = useNivelFinanceiro(profile);
  const ehCompleto = nivel === 'completo';
  const inputBuscaRef = useRef<HTMLInputElement>(null);

  const [carregandoOrigem, setCarregandoOrigem] = useState(Boolean(orcamentoOrigemId));
  const [orcamentoNumero, setOrcamentoNumero] = useState<string | null>(null);
  const [itensFrequentes, setItensFrequentes] = useState<CatalogItem[]>([]);
  const [vendedores, setVendedores] = useState<SellerOption[]>([]);
  const [vendedorId, setVendedorId] = useState('');

  // Busca de item (código, nome ou leitor de código de barras)
  const [busca, setBusca] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState<CatalogItem[]>([]);
  const [buscaFocada, setBuscaFocada] = useState(false);

  // Carrinho
  const [carrinho, setCarrinho] = useState<LinhaCarrinho[]>([]);
  const [descontoGeralTexto, setDescontoGeralTexto] = useState('');

  // Cliente (Consumidor final por padrão)
  const [cliente, setCliente] = useState<{
    id: string;
    name: string;
    person_type?: PersonType;
    document?: string | null;
  } | null>(null);
  const [mostrarCampoCpfNota, setMostrarCampoCpfNota] = useState(false);
  const [tipoDocNota, setTipoDocNota] = useState<PersonType>('PF');
  const [docNaNota, setDocNaNota] = useState('');

  // Pagamentos
  const [pagamentos, setPagamentos] = useState<LinhaPagamentoPdv[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Tela pós-conclusão (Comprovante da venda + cartões de notas)
  const [vendaConcluida, setVendaConcluida] = useState<Sale | null>(null);
  const [reciboAberto, setReciboAberto] = useState(false);
  const [modalAvulsoAberto, setModalAvulsoAberto] = useState(false);

  useEffect(() => {
    let ativo = true;
    Promise.all([listarItensFrequentes(), listarVendedores()])
      .then(([freq, vend]) => {
        if (!ativo) return;
        setItensFrequentes(freq);
        setVendedores(vend);
        setVendedorId((atual) => atual || (vend[0]?.id ?? ''));
      })
      .catch(() => {});

    if (orcamentoOrigemId) {
      buscarOrcamento(orcamentoOrigemId)
        .then((orc) => {
          if (!ativo || !orc) return;
          setOrcamentoNumero(orc.number);
          if (orc.customer_id) {
            setCliente({
              id: orc.customer_id,
              name: orc.customer_name,
              person_type: orc.customer_person_type,
              document: orc.customer_document,
            });
          }
          if (orc.seller_id) setVendedorId(orc.seller_id);
          if (orc.general_discount_cents > 0) {
            setDescontoGeralTexto(centavosParaTextoInput(orc.general_discount_cents));
          }
          setCarrinho(
            orc.items.map((i) => ({
              uid: `orc-it-${i.id}`,
              catalog_item_id: i.catalog_item_id,
              is_custom: i.is_custom,
              kind: i.kind,
              code: i.code,
              name: i.name,
              unit: i.unit,
              quantityTexto: String(i.quantity).replace('.', ','),
              unitPriceTexto: centavosParaTextoInput(i.unit_price_cents),
              discountMode: i.discount_mode,
              discountTexto:
                i.discount_input > 0
                  ? i.discount_mode === 'percentual'
                    ? String(i.discount_input).replace('.', ',')
                    : centavosParaTextoInput(i.discount_input)
                  : '',
            })),
          );
          setPagamentos([
            {
              uid: 'pg-inicial',
              method: 'pix',
              amountTexto: centavosParaTextoInput(orc.total_cents),
              tenderedTexto: '',
              accountId: 'conta-itau',
              machineId: 'maq-rede',
              installments: 1,
            },
          ]);
        })
        .finally(() => {
          if (ativo) setCarregandoOrigem(false);
        });
    } else {
      setTimeout(() => inputBuscaRef.current?.focus(), 80);
    }

    return () => {
      ativo = false;
    };
  }, [orcamentoOrigemId]);

  useEffect(() => {
    if (!busca.trim() && !buscaFocada) return;
    let ativo = true;
    const timer = setTimeout(() => {
      buscarItensParaBusca(busca)
        .then((lista) => {
          if (ativo) setResultadosBusca(lista);
        })
        .catch(() => {});
    }, 80);
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [busca, buscaFocada]);

  const adicionarAoCarrinho = (item: CatalogItem) => {
    setCarrinho((atual) => {
      const idx = atual.findIndex((l) => !l.is_custom && l.catalog_item_id === item.id);
      if (idx >= 0) {
        const copia = atual.slice();
        const lin = copia[idx];
        const novaQtd = parseQtd(lin.quantityTexto) + 1;
        copia[idx] = { ...lin, quantityTexto: String(novaQtd).replace('.', ',') };
        return copia;
      }
      return [
        ...atual,
        {
          uid: `cart-${atual.length + 1}-${item.id}`,
          catalog_item_id: item.id,
          is_custom: false,
          kind: item.kind,
          code: item.code,
          name: item.name,
          unit: item.unit,
          quantityTexto: '1',
          unitPriceTexto: centavosParaTextoInput(item.sale_price_cents),
          discountMode: 'valor',
          discountTexto: '',
          controlsStock: item.controls_stock,
          stockQuantity: item.stock_quantity,
        },
      ];
    });
    setBusca('');
    inputBuscaRef.current?.focus();
  };

  const adicionarAvulsoAoCarrinho = (av: ItemAvulsoResultado) => {
    setCarrinho((atual) => [
      ...atual,
      {
        uid: `cart-av-${atual.length + 1}`,
        catalog_item_id: null,
        is_custom: true,
        kind: av.kind,
        code: 'AVULSO',
        name: av.name,
        unit: av.unit,
        quantityTexto: String(av.quantity).replace('.', ','),
        unitPriceTexto: centavosParaTextoInput(av.unit_price_cents),
        discountMode: 'valor',
        discountTexto: '',
      },
    ]);
  };

  const atualizarItemCarrinho = (uid: string, parcial: Partial<LinhaCarrinho>) => {
    setCarrinho((atual) => atual.map((l) => (l.uid === uid ? { ...l, ...parcial } : l)));
  };

  const itensCalculados = useMemo(
    () =>
      carrinho.map((l) => {
        const quantity = parseQtd(l.quantityTexto);
        const unit_price_cents = converterTextoParaCentavos(l.unitPriceTexto) ?? 0;
        const discount_input = parseDesc(l.discountMode, l.discountTexto);
        const calc = calcularLinhaItemCentavos(
          quantity,
          unit_price_cents,
          l.discountMode,
          discount_input,
        );
        return {
          ...l,
          quantity,
          unit_price_cents,
          discount_input,
          discount_cents: calc.descontoCentavos,
          total_cents: calc.totalCentavos,
        };
      }),
    [carrinho],
  );

  const totais = useMemo(() => {
    const descGeral = converterTextoParaCentavos(descontoGeralTexto) ?? 0;
    return recalcularTotaisOrcamentoOuVenda(
      itensCalculados.map((i) => ({
        kind: i.kind,
        quantity: i.quantity,
        unit_price_cents: i.unit_price_cents,
        discount_mode: i.discountMode,
        discount_input: i.discount_input,
      })),
      descGeral,
      0,
    );
  }, [itensCalculados, descontoGeralTexto]);

  const descontoTotalCentavos = somarCentavos(
    totais.descontoLinhasCentavos,
    totais.descontoGeralEfetivoCentavos,
  );
  const percentualDescontoTotal = calcularPercentualDesconto(
    totais.brutoTotalCentavos,
    descontoTotalCentavos,
  );
  const descontoExcedeLimite =
    percentualDescontoTotal > LIMITE_DESCONTO_SEM_SENHA_PERCENT && !ehCompleto;

  const somaPagamentos = useMemo(
    () =>
      pagamentos.reduce(
        (acc, p) => somarCentavos(acc, converterTextoParaCentavos(p.amountTexto) ?? 0),
        0,
      ),
    [pagamentos],
  );

  const restanteReceber = Math.max(0, totais.totalCentavos - somaPagamentos);

  const pagarTotalEm = (metodo: FinancialPaymentMethod) => {
    setPagamentos([
      {
        uid: `pg-unico-${metodo}`,
        method: metodo,
        amountTexto: centavosParaTextoInput(totais.totalCentavos),
        tenderedTexto: '',
        accountId: metodo === 'dinheiro' ? 'conta-caixa-brv' : 'conta-itau',
        machineId: 'maq-rede',
        installments: 1,
      },
    ]);
  };

  const adicionarLinhaPagamento = (metodo: FinancialPaymentMethod = 'pix') => {
    setPagamentos((atual) => [
      ...atual,
      {
        uid: `pg-${atual.length + 1}-${metodo}`,
        method: metodo,
        amountTexto: restanteReceber > 0 ? centavosParaTextoInput(restanteReceber) : '',
        tenderedTexto: '',
        accountId: metodo === 'dinheiro' ? 'conta-caixa-brv' : 'conta-itau',
        machineId: 'maq-rede',
        installments: 1,
      },
    ]);
  };

  const atualizarPagamento = (uid: string, parcial: Partial<LinhaPagamentoPdv>) => {
    setPagamentos((atual) => atual.map((p) => (p.uid === uid ? { ...p, ...parcial } : p)));
  };

  const handleConcluirVenda = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (itensCalculados.length === 0) {
      setErro('Adicione ao menos um item ao carrinho.');
      return;
    }
    if (descontoExcedeLimite) {
      setErro(
        `O desconto aplicado (${percentualDescontoTotal.toFixed(1)}%) ultrapassa o limite de ${LIMITE_DESCONTO_SEM_SENHA_PERCENT}% permitido para o seu nível de acesso. Reduza o desconto ou peça a liberação de quem possui acesso financeiro completo.`,
      );
      return;
    }
    if (!cliente && docNaNota.trim() && !documentoValido(docNaNota, tipoDocNota)) {
      setErro(
        tipoDocNota === 'PF'
          ? 'O CPF informado para a nota fiscal é inválido.'
          : 'O CNPJ informado para a nota fiscal é inválido.',
      );
      return;
    }

    const pagamentosValidos = pagamentos
      .map((p) => ({
        method: p.method,
        amount_cents: converterTextoParaCentavos(p.amountTexto) ?? 0,
        tendered_cents:
          p.method === 'dinheiro' ? converterTextoParaCentavos(p.tenderedTexto) : null,
        account_id: p.accountId,
        card_machine_id:
          p.method === 'debito' || p.method === 'credito' ? p.machineId : null,
        installments: p.method === 'credito' ? p.installments : 1,
      }))
      .filter((p) => p.amount_cents > 0);

    const totalPago = pagamentosValidos.reduce(
      (acc, p) => somarCentavos(acc, p.amount_cents),
      0,
    );

    if (totalPago > totais.totalCentavos) {
      setErro(
        'A soma dos valores abatidos ultrapassa o total da venda. Para dinheiro com troco, mantenha "Valor a abater" igual ao saldo e preencha "Valor entregue em espécie".',
      );
      return;
    }

    if (totalPago < totais.totalCentavos && !cliente) {
      setErro(
        'Venda com saldo a receber exige um cliente cadastrado (não pode ficar como Consumidor final).',
      );
      return;
    }

    setSalvando(true);
    try {
      const criada = await concluirVenda(
        {
          origin_type: orcamentoOrigemId ? 'orcamento' : 'balcao',
          quote_id: orcamentoOrigemId ?? null,
          customer_id: cliente?.id ?? null,
          customer_name: cliente?.name ?? 'Consumidor final',
          customer_person_type: cliente ? (cliente.person_type ?? 'PF') : tipoDocNota,
          customer_document: cliente?.document ?? null,
          invoice_document: cliente
            ? (cliente.document ?? null)
            : docNaNota.trim() || null,
          seller_id: vendedorId || null,
          general_discount_cents: converterTextoParaCentavos(descontoGeralTexto) ?? 0,
          items: itensCalculados.map((i) => ({
            catalog_item_id: i.catalog_item_id,
            is_custom: i.is_custom,
            kind: i.kind,
            code: i.code,
            name: i.name,
            unit: i.unit,
            quantity: i.quantity,
            unit_price_cents: i.unit_price_cents,
            discount_mode: i.discountMode,
            discount_input: i.discount_input,
          })),
          payments: pagamentosValidos,
        },
        atorNome,
      );
      setVendaConcluida(criada);
      onVendaConcluida(criada);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível concluir a venda.');
    } finally {
      setSalvando(false);
    }
  };

  const iniciarNovaVendaEmBranco = () => {
    setVendaConcluida(null);
    setCarrinho([]);
    setPagamentos([]);
    setDescontoGeralTexto('');
    setCliente(null);
    setDocNaNota('');
    setMostrarCampoCpfNota(false);
    setErro(null);
    setTimeout(() => inputBuscaRef.current?.focus(), 80);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-100 pb-12">
      {/* Cabeçalho fixo do PDV */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-brv-navy px-4 py-3 text-white shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-sky-300">
              <ShoppingBag size={18} />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight sm:text-lg">
                {vendaConcluida
                  ? `Comprovante da Venda · ${vendaConcluida.number}`
                  : orcamentoNumero
                    ? `Nova Venda (do Orçamento ${orcamentoNumero})`
                    : 'Nova Venda (Balcão / PDV)'}
              </h1>
              <p className="text-[11px] text-slate-300">
                {vendaConcluida
                  ? 'Venda registrada com sucesso — emita as notas ou imprima o recibo abaixo'
                  : 'Use o leitor de código de barras ou busque pelo código/nome do produto ou serviço'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar tela de venda"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white hover:bg-white/15"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {carregandoOrigem ? (
        <div className="flex h-80 items-center justify-center text-sm text-slate-500">
          Carregando itens do orçamento...
        </div>
      ) : vendaConcluida ? (
        /* ================================================================= */
        /* TELA DE COMPROVANTE DA VENDA CONCLUÍDA                            */
        /* ================================================================= */
        <div className="mx-auto mt-6 max-w-4xl space-y-6 px-4 sm:px-6">
          <div className="rounded-2xl border-2 border-emerald-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 size={26} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    Venda {vendaConcluida.number} concluída!
                  </h2>
                  <p className="text-xs text-slate-600">
                    Cliente: <strong>{vendaConcluida.customer_name}</strong> · Total:{' '}
                    <strong>{formatarReais(vendaConcluida.total_cents)}</strong> · Pago:{' '}
                    <strong className="text-emerald-700">
                      {formatarReais(vendaConcluida.paid_cents)}
                    </strong>
                    {vendaConcluida.change_cents > 0 && (
                      <>
                        {' · '}Troco:{' '}
                        <strong>{formatarReais(vendaConcluida.change_cents)}</strong>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReciboAberto(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50"
                >
                  <Printer size={15} />
                  Imprimir recibo
                </button>

                <button
                  type="button"
                  onClick={() => onAbrirDetalheVenda(vendaConcluida.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50"
                >
                  Ver detalhe da venda
                </button>

                <button
                  type="button"
                  onClick={iniciarNovaVendaEmBranco}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                >
                  <RotateCcw size={15} />
                  Nova venda
                </button>
              </div>
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
            <h3 className="mb-3 text-base font-bold text-slate-800">
              Emissão de Notas Fiscais da Venda
            </h3>
            <NotasFiscaisVenda
              venda={vendaConcluida}
              podeCancelarNota={ehCompleto}
              atorNome={atorNome}
              onVendaAtualizada={(at) => {
                setVendaConcluida(at);
                onVendaConcluida(at);
              }}
            />
          </section>

          {reciboAberto && (
            <ReciboVendaModal
              venda={vendaConcluida}
              onFechar={() => setReciboAberto(false)}
            />
          )}
        </div>
      ) : (
        /* ================================================================= */
        /* TELA DO PDV (ESQUERDA: BUSCA + FREQUENTES + CARRINHO; DIREITA: $) */
        /* ================================================================= */
        <form
          onSubmit={(e) => void handleConcluirVenda(e)}
          className="mx-auto mt-5 grid max-w-7xl grid-cols-1 gap-5 px-4 sm:px-6 lg:grid-cols-12"
        >
          {/* COLUNA ESQUERDA (7 cols): Busca, Itens frequentes e Carrinho */}
          <div className="space-y-4 lg:col-span-7">
            {/* Barra de busca / código de barras */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="pdv-busca-item"
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-700"
                >
                  <Barcode size={16} className="text-blue-600" />
                  Buscar item por código, nome ou leitor de código de barras (Enter adiciona)
                </label>

                <button
                  type="button"
                  onClick={() => setModalAvulsoAberto(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  <Plus size={13} /> Item avulso
                </button>
              </div>

              <div className="relative mt-2">
                <input
                  ref={inputBuscaRef}
                  id="pdv-busca-item"
                  type="text"
                  autoCorrect="off"
                  spellCheck={false}
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    setBuscaFocada(true);
                  }}
                  onFocus={() => setBuscaFocada(true)}
                  onBlur={() => setTimeout(() => setBuscaFocada(false), 180)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && resultadosBusca.length > 0) {
                      e.preventDefault();
                      adicionarAoCarrinho(resultadosBusca[0]);
                    }
                  }}
                  placeholder="Bipe o código de barras ou digite o nome/código..."
                  className="block w-full rounded-xl border-2 border-blue-500/80 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />

                {buscaFocada && busca.trim() && resultadosBusca.length > 0 && (
                  <ul className="absolute z-30 mt-1 max-h-64 w-full divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                    {resultadosBusca.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onMouseDown={() => adicionarAoCarrinho(item)}
                          className="flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-xs hover:bg-blue-50"
                        >
                          <div className="min-w-0">
                            <span className="font-mono text-[11px] font-bold text-slate-400">
                              {item.code}
                            </span>{' '}
                            <strong className="text-slate-900">{item.name}</strong>
                            <span
                              className={`ml-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${CORES_TIPO_ITEM[item.kind].selo}`}
                            >
                              {CORES_TIPO_ITEM[item.kind].rotulo}
                            </span>
                          </div>
                          <span className="shrink-0 font-extrabold text-brv-navy">
                            {formatarReais(item.sale_price_cents)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Grade de itens frequentes */}
              {itensFrequentes.length > 0 && (
                <div className="mt-3.5">
                  <div className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <Sparkles size={12} className="text-amber-500" />
                    Itens frequentes (clique para adicionar)
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {itensFrequentes.slice(0, 9).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => adicionarAoCarrinho(item)}
                        className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-2 text-left text-xs transition hover:border-blue-400 hover:bg-blue-50/50"
                      >
                        <span className="line-clamp-1 font-bold text-slate-800">
                          {item.name}
                        </span>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-slate-400">
                            {item.kind === 'produto' ? 'Prod.' : 'Serv.'}
                          </span>
                          <span className="font-extrabold text-brv-navy">
                            {formatarReais(item.sale_price_cents)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Carrinho de itens */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-800">
                  Carrinho ({itensCalculados.length}{' '}
                  {itensCalculados.length === 1 ? 'item' : 'itens'})
                </h2>
                {itensCalculados.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCarrinho([])}
                    className="text-xs font-semibold text-slate-400 hover:text-red-600"
                  >
                    Limpar carrinho
                  </button>
                )}
              </div>

              {itensCalculados.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-400">
                  O carrinho está vazio. Escolha um item frequente ou pesquise acima.
                </p>
              ) : (
                <div className="mt-3 space-y-2.5">
                  {itensCalculados.map((item) => {
                    const faltaEstoque =
                      item.kind === 'produto' &&
                      item.controlsStock &&
                      item.stockQuantity !== undefined &&
                      item.quantity > item.stockQuantity;

                    return (
                      <div
                        key={item.uid}
                        className="rounded-xl border border-slate-200 bg-slate-50/50 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${CORES_TIPO_ITEM[item.kind].selo}`}
                            >
                              {item.kind === 'produto' ? (
                                <Package size={10} />
                              ) : (
                                <Wrench size={10} />
                              )}
                              {CORES_TIPO_ITEM[item.kind].rotulo}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400">
                              {item.code}
                            </span>
                            <strong className="text-xs text-slate-900">{item.name}</strong>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setCarrinho((at) => at.filter((x) => x.uid !== item.uid))
                            }
                            aria-label={`Remover ${item.name}`}
                            className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {faltaEstoque && (
                          <p className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                            <AlertTriangle size={12} />
                            Estoque insuficiente (saldo atual: {item.stockQuantity} {item.unit})
                          </p>
                        )}

                        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500">
                              Qtd. ({item.unit})
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.quantityTexto}
                              onChange={(e) =>
                                atualizarItemCarrinho(item.uid, {
                                  quantityTexto: e.target.value,
                                })
                              }
                              className="mt-0.5 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500">
                              Valor unit. (R$)
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.unitPriceTexto}
                              onChange={(e) =>
                                atualizarItemCarrinho(item.uid, {
                                  unitPriceTexto: e.target.value,
                                })
                              }
                              className="mt-0.5 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-semibold text-slate-500">
                                Desconto
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  atualizarItemCarrinho(item.uid, {
                                    discountMode:
                                      item.discountMode === 'valor' ? 'percentual' : 'valor',
                                    discountTexto: '',
                                  })
                                }
                                className="text-[10px] font-bold text-blue-600 hover:underline"
                              >
                                {item.discountMode === 'valor' ? '%' : 'R$'}
                              </button>
                            </div>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.discountTexto}
                              onChange={(e) =>
                                atualizarItemCarrinho(item.uid, {
                                  discountTexto: e.target.value,
                                })
                              }
                              placeholder={item.discountMode === 'valor' ? 'R$ 0,00' : '0%'}
                              className="mt-0.5 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                            />
                          </div>

                          <div className="flex flex-col justify-end text-right">
                            <span className="text-[10px] font-semibold text-slate-400">
                              Total
                            </span>
                            <span className="text-sm font-extrabold tabular-nums text-brv-navy">
                              {formatarReais(item.total_cents)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* COLUNA DIREITA (5 cols): Cliente, Resumo e Pagamento */}
          <div className="space-y-4 lg:col-span-5">
            {/* Cliente */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                  <UserCheck size={16} className="text-blue-600" />
                  Cliente
                </h2>
                {!cliente && (
                  <button
                    type="button"
                    onClick={() => setMostrarCampoCpfNota((v) => !v)}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    {mostrarCampoCpfNota ? 'Ocultar CPF/CNPJ na nota' : 'CPF/CNPJ na nota'}
                  </button>
                )}
              </div>

              <p className="mt-0.5 text-[11px] text-slate-500">
                Padrão: <strong>Consumidor final</strong>. Para venda a receber, escolha o cliente.
              </p>

              <SeletorCliente
                valor={cliente}
                onChange={(c: Customer | null) =>
                  setCliente(
                    c
                      ? {
                          id: c.id,
                          name: c.name,
                          person_type: c.person_type,
                          document: c.document,
                        }
                      : null,
                  )
                }
              />

              {!cliente && mostrarCampoCpfNota && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <label htmlFor="pdv-doc-nota">CPF/CNPJ na nota (Consumidor final)</label>
                    <div className="inline-flex rounded-md bg-white p-0.5">
                      {(['PF', 'PJ'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            setTipoDocNota(t);
                            setDocNaNota((d) => formatarDocumento(d, t));
                          }}
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            tipoDocNota === t
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-500'
                          }`}
                        >
                          {t === 'PF' ? 'CPF' : 'CNPJ'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    id="pdv-doc-nota"
                    type="text"
                    value={docNaNota}
                    onChange={(e) =>
                      setDocNaNota(formatarDocumento(e.target.value, tipoDocNota))
                    }
                    placeholder={
                      tipoDocNota === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'
                    }
                    className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                  />
                </div>
              )}

              <div className="mt-3">
                <label htmlFor="pdv-vendedor" className="block text-xs font-semibold text-slate-700">
                  Vendedor(a)
                </label>
                <select
                  id="pdv-vendedor"
                  value={vendedorId}
                  onChange={(e) => setVendedorId(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
                >
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Resumo */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <h2 className="text-sm font-bold text-slate-800">Resumo</h2>

              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Produtos</span>
                  <strong>{formatarReais(totais.produtosSubtotalCentavos)}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Serviços</span>
                  <strong>{formatarReais(totais.servicosSubtotalCentavos)}</strong>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <label htmlFor="pdv-desc-geral" className="font-semibold text-slate-700">
                    Desconto geral (R$)
                  </label>
                  <input
                    id="pdv-desc-geral"
                    type="text"
                    inputMode="decimal"
                    value={descontoGeralTexto}
                    onChange={(e) => setDescontoGeralTexto(e.target.value)}
                    placeholder="0,00"
                    className="w-28 rounded-lg border border-slate-200 px-2.5 py-1 text-right text-xs font-bold text-slate-800"
                  />
                </div>

                {percentualDescontoTotal > 0 && (
                  <p
                    className={`text-[11px] font-semibold ${
                      descontoExcedeLimite ? 'text-red-600' : 'text-slate-500'
                    }`}
                  >
                    Desconto total efetivo: {percentualDescontoTotal.toFixed(1)}% (limite para
                    nível caixa: {LIMITE_DESCONTO_SEM_SENHA_PERCENT}%)
                  </p>
                )}

                <div className="flex items-center justify-between border-t border-slate-200 pt-2.5 text-base font-extrabold text-brv-navy">
                  <span>Total a Pagar</span>
                  <span>{formatarReais(totais.totalCentavos)}</span>
                </div>
              </div>
            </div>

            {/* Pagamento */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                  <CreditCard size={16} className="text-blue-600" />
                  Pagamento
                </h2>
                <button
                  type="button"
                  onClick={() => adicionarLinhaPagamento('pix')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                >
                  <Plus size={13} /> Adicionar linha
                </button>
              </div>

              {/* Atalhos rápidos "Pagar o total em ..." */}
              {totais.totalCentavos > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {(['pix', 'credito', 'debito', 'dinheiro'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => pagarTotalEm(m)}
                      className="rounded-lg border border-blue-200 bg-blue-50/70 px-2.5 py-1 text-[11px] font-bold text-blue-800 transition hover:bg-blue-100"
                    >
                      Pagar o total em {ROTULO_FORMA_PAGAMENTO_CURTO[m]}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPagamentos([])}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Deixar em aberto (a receber)
                  </button>
                </div>
              )}

              {pagamentos.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2.5 text-xs text-amber-900">
                  Nenhum pagamento no ato: a venda ficará como <strong>Aberta (a receber)</strong>.
                  (Exige cliente cadastrado.)
                </p>
              ) : (
                <div className="mt-3 space-y-2.5">
                  {pagamentos.map((pg) => {
                    const valorCents = converterTextoParaCentavos(pg.amountTexto) ?? 0;
                    const entregueCents = converterTextoParaCentavos(pg.tenderedTexto) ?? 0;
                    const troco =
                      pg.method === 'dinheiro' && entregueCents > valorCents
                        ? entregueCents - valorCents
                        : 0;
                    const maq = MAQUININHAS_DEMO.find((m) => m.id === pg.machineId);
                    const taxa =
                      (pg.method === 'debito' || pg.method === 'credito') && maq
                        ? calcularTaxaMaquininha(maq, pg.method, pg.installments, valorCents)
                        : null;

                    return (
                      <div
                        key={pg.uid}
                        className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3"
                      >
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500">
                              Forma
                            </label>
                            <select
                              value={pg.method}
                              onChange={(e) => {
                                const m = e.target.value as FinancialPaymentMethod;
                                atualizarPagamento(pg.uid, {
                                  method: m,
                                  accountId:
                                    m === 'dinheiro' ? 'conta-caixa-brv' : 'conta-itau',
                                });
                              }}
                              className="mt-0.5 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800"
                            >
                              {(
                                Object.keys(ROTULO_FORMA_PAGAMENTO) as FinancialPaymentMethod[]
                              ).map((m) => (
                                <option key={m} value={m}>
                                  {ROTULO_FORMA_PAGAMENTO[m]}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-semibold text-slate-500">
                                Valor (R$)
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  setPagamentos((at) =>
                                    at.filter((x) => x.uid !== pg.uid),
                                  )
                                }
                                className="text-[10px] font-semibold text-red-600 hover:underline"
                              >
                                Remover
                              </button>
                            </div>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={pg.amountTexto}
                              onChange={(e) =>
                                atualizarPagamento(pg.uid, {
                                  amountTexto: e.target.value,
                                })
                              }
                              className="mt-0.5 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800"
                            />
                          </div>
                        </div>

                        {pg.method === 'dinheiro' ? (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-medium text-slate-500">
                                Recebido em espécie (R$)
                              </label>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={pg.tenderedTexto}
                                onChange={(e) =>
                                  atualizarPagamento(pg.uid, {
                                    tenderedTexto: e.target.value,
                                  })
                                }
                                placeholder={pg.amountTexto}
                                className="mt-0.5 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs"
                              />
                            </div>
                            <div className="flex flex-col justify-end text-right">
                              <span className="text-[10px] text-slate-500">Troco:</span>
                              <span className="text-xs font-extrabold text-emerald-700">
                                {formatarReais(troco)}
                              </span>
                            </div>
                          </div>
                        ) : pg.method === 'debito' || pg.method === 'credito' ? (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-medium text-slate-500">
                                Maquininha
                              </label>
                              <select
                                value={pg.machineId}
                                onChange={(e) =>
                                  atualizarPagamento(pg.uid, {
                                    machineId: e.target.value,
                                  })
                                }
                                className="mt-0.5 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                              >
                                {MAQUININHAS_DEMO.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {pg.method === 'credito' && (
                              <div>
                                <label className="block text-[10px] font-medium text-slate-500">
                                  Parcelas
                                </label>
                                <select
                                  value={pg.installments}
                                  onChange={(e) =>
                                    atualizarPagamento(pg.uid, {
                                      installments: Number(e.target.value),
                                    })
                                  }
                                  className="mt-0.5 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                                >
                                  {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                                    <option key={n} value={n}>
                                      {n}x
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            {taxa && (
                              <p className="col-span-2 text-[10px] text-slate-500">
                                Taxa estimada: <strong>{taxa.percentual.toFixed(2)}%</strong> (
                                {formatarReais(taxa.taxaCentavos)}) · Líquido:{' '}
                                <strong>{formatarReais(taxa.liquidoCentavos)}</strong>
                              </p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500">
                              Conta de destino
                            </label>
                            <select
                              value={pg.accountId}
                              onChange={(e) =>
                                atualizarPagamento(pg.uid, {
                                  accountId: e.target.value,
                                })
                              }
                              className="mt-0.5 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                            >
                              {CONTAS_FINANCEIRAS_DEMO.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
                <span className="font-semibold text-slate-600">Restante a receber:</span>
                <strong
                  className={`text-sm font-extrabold ${
                    restanteReceber > 0 ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  {formatarReais(restanteReceber)}
                </strong>
              </div>
            </div>

            {erro && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
              >
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={salvando || itensCalculados.length === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-extrabold text-white shadow-md transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {salvando && <Loader2 size={18} className="animate-spin" />}
              Concluir venda ({formatarReais(totais.totalCentavos)})
            </button>
          </div>
        </form>
      )}

      {modalAvulsoAberto && (
        <ModalItemAvulso
          aberto={modalAvulsoAberto}
          onFechar={() => setModalAvulsoAberto(false)}
          onAdicionar={adicionarAvulsoAoCarrinho}
        />
      )}
    </div>,
    document.body,
  );
}
