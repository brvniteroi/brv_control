import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Loader2, Plus, Printer, RotateCcw, ShoppingBag, X } from 'lucide-react';
import { useTelaAjuda } from '../../ajuda/contextoAjuda';
import { useAuth } from '../../contexts/useAuth';
import type { CardMachine, FinancialAccount, FinancialPaymentMethod } from '../../types/financeiro';
import type { Customer, PersonType } from '../../types/fsm';
import type {
  CatalogItem,
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
  listarContas,
  listarMaquininhas,
  useNivelFinanceiro,
} from '../financeiro/fonteDeDados';
import SeletorCliente from '../ordens/SeletorCliente';
import {
  ROTULO_FORMA_PAGAMENTO,
  ROTULO_FORMA_PAGAMENTO_CURTO,
} from './cores';
import {
  buscarOrcamento,
  concluirVenda,
  listarItensFrequentes,
  listarVendedores,
} from './fonteDeDados';
import NotasFiscaisVenda, { ReciboVendaModal } from './NotasFiscaisVenda';
import TabelaItensVenda, { type LinhaItemVenda } from './TabelaItensVenda';
import {
  ModalItemAvulso,
  type ItemAvulsoResultado,
} from './OrcamentoModais';
import {
  LIMITE_DESCONTO_SEM_SENHA_PERCENT,
  calcularTaxaMaquininha,
  recalcularTotaisOrcamentoOuVenda,
} from './regrasVendas';

const INPUT =
  'mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

type LinhaCarrinho = LinhaItemVenda;

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
  useTelaAjuda('venda');
  const { profile } = useAuth();
  const atorNome = profile?.full_name || 'Equipe BRV';
  const { nivel } = useNivelFinanceiro(profile);
  const ehCompleto = nivel === 'completo';


  const [carregandoOrigem, setCarregandoOrigem] = useState(Boolean(orcamentoOrigemId));
  const [orcamentoNumero, setOrcamentoNumero] = useState<string | null>(null);
  const [itensFrequentes, setItensFrequentes] = useState<CatalogItem[]>([]);
  const [vendedores, setVendedores] = useState<SellerOption[]>([]);
  const [vendedorId, setVendedorId] = useState('');

  const [carrinho, setCarrinho] = useState<LinhaCarrinho[]>([]);
  const [descontoGeralTexto, setDescontoGeralTexto] = useState('');

  const [cliente, setCliente] = useState<{
    id: string;
    name: string;
    person_type?: PersonType;
    document?: string | null;
  } | null>(null);
  const [mostrarCampoCpfNota, setMostrarCampoCpfNota] = useState(false);
  const [tipoDocNota, setTipoDocNota] = useState<PersonType>('PF');
  const [docNaNota, setDocNaNota] = useState('');

  const [pagamentos, setPagamentos] = useState<LinhaPagamentoPdv[]>([]);
  // Contas e maquininhas ativas (o banco só as entrega a quem tem acesso financeiro "caixa" ou "completo")
  const [contas, setContas] = useState<FinancialAccount[]>([]);
  const [maquininhas, setMaquininhas] = useState<CardMachine[]>([]);
  const [freteCentavos, setFreteCentavos] = useState(0);
  // Linha sem escolha ('') usa o padrão: dinheiro no caixa; o resto no primeiro banco
  const contaDaLinha = (pg: { method: FinancialPaymentMethod; accountId: string }): string => {
    const doTipo = contas.filter((c) => (pg.method === 'dinheiro' ? c.kind === 'caixa' : c.kind === 'banco'));
    return doTipo.find((c) => c.id === pg.accountId)?.id ?? doTipo[0]?.id ?? '';
  };
  const maquininhaDaLinha = (pg: { machineId: string }): string =>
    maquininhas.find((m) => m.id === pg.machineId)?.id ?? maquininhas[0]?.id ?? '';
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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

    Promise.all([listarContas(), listarMaquininhas()])
      .then(([listaContas, listaMaquininhas]) => {
        if (!ativo) return;
        setContas(listaContas.filter((c) => c.active));
        setMaquininhas(listaMaquininhas.filter((m) => m.active));
      })
      .catch((e: unknown) => {
        if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar as contas.');
      });

    if (orcamentoOrigemId) {
      buscarOrcamento(orcamentoOrigemId)
        .then((orc) => {
          if (!ativo || !orc) return;
          setOrcamentoNumero(orc.number);
          setFreteCentavos(orc.freight_cents ?? 0);
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
              accountId: '',
              machineId: '',
              installments: 1,
            },
          ]);
        })
        .finally(() => {
          if (ativo) setCarregandoOrigem(false);
        });
    }

    return () => {
      ativo = false;
    };
  }, [orcamentoOrigemId]);

  const adicionarAoCarrinho = (item: CatalogItem, quantidade = 1) => {
    setCarrinho((atual) => {
      const idx = atual.findIndex((l) => !l.is_custom && l.catalog_item_id === item.id);
      if (idx >= 0) {
        const copia = atual.slice();
        const lin = copia[idx];
        const novaQtd = Math.round((parseQtd(lin.quantityTexto) + quantidade) * 1000) / 1000;
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
          quantityTexto: String(quantidade).replace('.', ','),
          unitPriceTexto: centavosParaTextoInput(item.sale_price_cents),
          discountMode: 'valor',
          discountTexto: '',
          controlsStock: item.controls_stock,
          stockQuantity: item.stock_quantity,
        },
      ];
    });
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
      freteCentavos,
    );
  }, [itensCalculados, descontoGeralTexto, freteCentavos]);

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
        accountId: '',
        machineId: '',
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
        accountId: '',
        machineId: '',
        installments: 1,
      },
    ]);
  };

  const atualizarPagamento = (uid: string, parcial: Partial<LinhaPagamentoPdv>) => {
    setPagamentos((atual) => atual.map((p) => (p.uid === uid ? { ...p, ...parcial } : p)));
  };

  const handleConcluirVenda = async (e?: FormEvent) => {
    e?.preventDefault();
    setErro(null);

    if (itensCalculados.length === 0) {
      setErro('Adicione ao menos um item.');
      return;
    }
    if (descontoExcedeLimite) {
      setErro(
        `O desconto aplicado (${percentualDescontoTotal.toFixed(1)}%) ultrapassa o limite de ${LIMITE_DESCONTO_SEM_SENHA_PERCENT}% para o nível caixa.`,
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
        account_id: p.method === 'debito' || p.method === 'credito' ? null : contaDaLinha(p),
        card_machine_id:
          p.method === 'debito' || p.method === 'credito' ? maquininhaDaLinha(p) : null,
        installments: p.method === 'credito' ? p.installments : 1,
      }))
      .filter((p) => p.amount_cents > 0);

    const totalPago = pagamentosValidos.reduce(
      (acc, p) => somarCentavos(acc, p.amount_cents),
      0,
    );

    if (totalPago > totais.totalCentavos) {
      setErro('A soma dos pagamentos ultrapassa o total da venda.');
      return;
    }

    if (totalPago < totais.totalCentavos && !cliente) {
      setErro('Venda com saldo a receber exige cliente cadastrado.');
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
          freight_cents: freteCentavos,
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
    setTimeout(() => document.getElementById('pdv-busca-item')?.focus(), 80);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 pb-16">
      {/* Cabeçalho fixo igual a OrdemDetalhes */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <ShoppingBag size={18} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {vendaConcluida
                ? `Venda ${vendaConcluida.number}`
                : orcamentoNumero
                  ? `Nova venda · ${orcamentoNumero}`
                  : 'Nova venda'}
            </h1>
            <span className="text-xs text-slate-500">
              Total: <strong className="text-slate-900">{formatarReais(vendaConcluida ? vendaConcluida.total_cents : totais.totalCentavos)}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!vendaConcluida && (
            <button
              type="button"
              onClick={() => void handleConcluirVenda()}
              disabled={salvando || itensCalculados.length === 0}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Concluir venda'}
            </button>
          )}

          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {carregandoOrigem ? (
        <div className="flex h-80 items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <span className="text-sm font-medium">Carregando orçamento...</span>
          </div>
        </div>
      ) : vendaConcluida ? (
        <div className="mx-auto mt-6 max-w-5xl space-y-6 px-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Venda {vendaConcluida.number} concluída
                  </h2>
                  <p className="text-xs text-slate-600">
                    {vendaConcluida.customer_name} · Total:{' '}
                    <strong>{formatarReais(vendaConcluida.total_cents)}</strong> · Pago:{' '}
                    <strong className="text-emerald-700">
                      {formatarReais(vendaConcluida.paid_cents)}
                    </strong>
                    {vendaConcluida.change_cents > 0 && (
                      <> · Troco: <strong>{formatarReais(vendaConcluida.change_cents)}</strong></>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReciboAberto(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Printer size={14} />
                  Recibo
                </button>

                <button
                  type="button"
                  onClick={() => onAbrirDetalheVenda(vendaConcluida.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Abrir venda
                </button>

                <button
                  type="button"
                  onClick={iniciarNovaVendaEmBranco}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
                >
                  <RotateCcw size={14} />
                  Nova venda
                </button>
              </div>
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <h3 className="mb-3 text-base font-bold text-slate-800">Notas fiscais</h3>
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
        <>
          {erro && (
            <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
              {erro}
            </div>
          )}

          <form
            onSubmit={(e) => void handleConcluirVenda(e)}
            className="mx-auto mt-6 flex max-w-6xl flex-col gap-6 px-6"
          >
            {/* Em cima, em largura total (a descrição do item precisa aparecer inteira): busca, itens e frequentes */}
            <div className="space-y-6">
              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-800">Itens</h2>
                  {itensCalculados.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCarrinho([])}
                      className="text-xs font-semibold text-slate-500 hover:text-red-600"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                <TabelaItensVenda
                  idPrefixo="pdv"
                  itens={itensCalculados}
                  podeVerCusto={ehCompleto}
                  colunaCodigo={false}
                  focarBuscaAoAbrir={!orcamentoOrigemId}
                  onAdicionar={adicionarAoCarrinho}
                  onAtualizar={atualizarItemCarrinho}
                  onRemover={(uid) => setCarrinho((at) => at.filter((x) => x.uid !== uid))}
                  onItemAvulso={() => setModalAvulsoAberto(true)}
                />

                {itensFrequentes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {itensFrequentes.slice(0, 9).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => adicionarAoCarrinho(item)}
                        title={`${item.name} (${formatarReais(item.sale_price_cents)})`}
                        className="max-w-[14rem] truncate rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:border-blue-300 hover:bg-blue-50/40"
                      >
                        + {item.name}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Embaixo, lado a lado: Cliente e Pagamento */}
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-800">Cliente</h2>
                  {!cliente && (
                    <button
                      type="button"
                      onClick={() => setMostrarCampoCpfNota((v) => !v)}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      {mostrarCampoCpfNota ? 'Ocultar CPF/CNPJ na nota' : 'CPF/CNPJ na nota'}
                    </button>
                  )}
                </div>

                <div>
                  <span className="block text-xs font-medium text-slate-700">
                    Cliente (vazio = Consumidor final)
                  </span>
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
                </div>

                {!cliente && mostrarCampoCpfNota && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                      <label htmlFor="pdv-doc-nota">CPF/CNPJ na nota</label>
                      <div className="inline-flex rounded-md bg-white p-0.5">
                        {(['PF', 'PJ'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              setTipoDocNota(t);
                              setDocNaNota((d) => formatarDocumento(d, t));
                            }}
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
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

                <div>
                  <label htmlFor="pdv-vendedor" className="block text-xs font-medium text-slate-700">
                    Vendedor(a)
                  </label>
                  <select
                    id="pdv-vendedor"
                    value={vendedorId}
                    onChange={(e) => setVendedorId(e.target.value)}
                    className={INPUT}
                  >
                    {vendedores.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-slate-800">Pagamento</h2>
                  <button
                    type="button"
                    onClick={() => adicionarLinhaPagamento('pix')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    <Plus size={13} /> Adicionar forma
                  </button>
                </div>

                <div className="space-y-2 border-b border-slate-100 pb-3 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Produtos</span>
                    <strong>{formatarReais(totais.produtosSubtotalCentavos)}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Serviços</span>
                    <strong>{formatarReais(totais.servicosSubtotalCentavos)}</strong>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <label htmlFor="pdv-desc-geral" className="font-medium text-slate-700">
                      Desconto geral (R$)
                    </label>
                    <input
                      id="pdv-desc-geral"
                      type="text"
                      inputMode="decimal"
                      value={descontoGeralTexto}
                      onChange={(e) => setDescontoGeralTexto(e.target.value)}
                      placeholder="0,00"
                      className="w-28 rounded-lg border border-slate-200 px-2.5 py-1 text-right text-xs font-semibold text-slate-800"
                    />
                  </div>

                  {descontoExcedeLimite && (
                    <p className="text-xs font-semibold text-red-600">
                      Desconto ({percentualDescontoTotal.toFixed(1)}%) acima do limite de{' '}
                      {LIMITE_DESCONTO_SEM_SENHA_PERCENT}% para o nível caixa.
                    </p>
                  )}

                  {freteCentavos > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Frete (do orçamento)</span>
                      <strong>{formatarReais(freteCentavos)}</strong>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-sm font-bold text-slate-900">
                    <span>Total a pagar</span>
                    <span>{formatarReais(totais.totalCentavos)}</span>
                  </div>
                </div>

                {totais.totalCentavos > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(['pix', 'credito', 'debito', 'dinheiro'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => pagarTotalEm(m)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        {ROTULO_FORMA_PAGAMENTO_CURTO[m]}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPagamentos([])}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                    >
                      A receber
                    </button>
                  </div>
                )}

                {pagamentos.length === 0 ? (
                  !cliente ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Venda a receber exige escolher um cliente cadastrado.
                    </p>
                  ) : null
                ) : (
                  <div className="space-y-2.5">
                    {pagamentos.map((pg) => {
                      const valorCents = converterTextoParaCentavos(pg.amountTexto) ?? 0;
                      const entregueCents = converterTextoParaCentavos(pg.tenderedTexto) ?? 0;
                      const troco =
                        pg.method === 'dinheiro' && entregueCents > valorCents
                          ? entregueCents - valorCents
                          : 0;
                      const maq = maquininhas.find((m) => m.id === maquininhaDaLinha(pg));
                      const taxa =
                        ehCompleto && (pg.method === 'debito' || pg.method === 'credito') && maq
                          ? calcularTaxaMaquininha(maq, pg.method, pg.installments, valorCents)
                          : null;

                      return (
                        <div
                          key={pg.uid}
                          className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600">
                                Forma
                              </label>
                              <select
                                value={pg.method}
                                onChange={(e) => {
                                  const m = e.target.value as FinancialPaymentMethod;
                                  atualizarPagamento(pg.uid, { method: m, accountId: '' });
                                }}
                                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800"
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
                                <label className="text-[11px] font-medium text-slate-600">
                                  Valor (R$)
                                </label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPagamentos((at) =>
                                      at.filter((x) => x.uid !== pg.uid),
                                    )
                                  }
                                  className="text-[11px] font-semibold text-red-600 hover:underline"
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
                                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                              />
                            </div>
                          </div>

                          {pg.method === 'dinheiro' ? (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] font-medium text-slate-600">
                                  Recebido (R$)
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
                                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs"
                                />
                              </div>
                              <div className="flex flex-col justify-end text-right">
                                <span className="text-[11px] text-slate-500">Troco:</span>
                                <span className="text-xs font-bold text-emerald-700">
                                  {formatarReais(troco)}
                                </span>
                              </div>
                            </div>
                          ) : pg.method === 'debito' || pg.method === 'credito' ? (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] font-medium text-slate-600">
                                  Maquininha
                                </label>
                                <select
                                  value={maquininhaDaLinha(pg)}
                                  onChange={(e) =>
                                    atualizarPagamento(pg.uid, {
                                      machineId: e.target.value,
                                    })
                                  }
                                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                                >
                                  {maquininhas.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {pg.method === 'credito' && (
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-600">
                                    Parcelas
                                  </label>
                                  <select
                                    value={pg.installments}
                                    onChange={(e) =>
                                      atualizarPagamento(pg.uid, {
                                        installments: Number(e.target.value),
                                      })
                                    }
                                    className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
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
                                <p className="col-span-2 text-[11px] text-slate-500">
                                  Taxa: <strong>{taxa.percentual.toFixed(2)}%</strong> (
                                  {formatarReais(taxa.taxaCentavos)}) · Líquido:{' '}
                                  <strong>{formatarReais(taxa.liquidoCentavos)}</strong>
                                </p>
                              )}
                            </div>
                          ) : (
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600">
                                Conta de destino
                              </label>
                              <select
                                value={contaDaLinha(pg)}
                                onChange={(e) =>
                                  atualizarPagamento(pg.uid, {
                                    accountId: e.target.value,
                                  })
                                }
                                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                              >
                                {contas.filter((c) => c.kind === 'banco').map((c) => (
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

                <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
                  <span className="font-medium text-slate-600">Restante a receber</span>
                  <strong
                    className={`text-sm font-bold ${
                      restanteReceber > 0 ? 'text-amber-700' : 'text-emerald-700'
                    }`}
                  >
                    {formatarReais(restanteReceber)}
                  </strong>
                </div>

                <button
                  type="submit"
                  disabled={salvando || itensCalculados.length === 0}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {salvando && <Loader2 size={16} className="animate-spin" />}
                  Concluir venda ({formatarReais(totais.totalCentavos)})
                </button>
              </section>
            </div>
          </form>
        </>
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
