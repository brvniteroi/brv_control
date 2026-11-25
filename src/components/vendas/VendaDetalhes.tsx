import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Ban,
  CreditCard,
  DollarSign,
  ExternalLink,
  History,
  Loader2,
  Package,
  Plus,
  Printer,
  ShoppingBag,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import type { FinancialPaymentMethod } from '../../types/financeiro';
import type { Sale } from '../../types/vendas';
import {
  centavosParaTextoInput,
  converterTextoParaCentavos,
  formatarReais,
  somarCentavos,
} from '../../utils/dinheiro';
import { formatarDataHora } from '../../utils/ordens';
import {
  CONTAS_FINANCEIRAS_DEMO,
  MAQUININHAS_DEMO,
  useNivelFinanceiro,
} from '../financeiro/fonteDeDados';
import {
  CORES_SITUACAO_VENDA,
  CORES_TIPO_ITEM,
  ROTULO_FORMA_PAGAMENTO,
  ROTULO_ORIGEM_VENDA,
} from './cores';
import {
  buscarVenda,
  cancelarVenda,
  receberSaldoVenda,
} from './fonteDeDados';
import ModalDialogoVendas from './ModalDialogoVendas';
import NotasFiscaisVenda, { ReciboVendaModal } from './NotasFiscaisVenda';
import { calcularTaxaMaquininha, situacaoVenda } from './regrasVendas';

interface LinhaRecebimentoForm {
  uid: string;
  method: FinancialPaymentMethod;
  amountTexto: string;
  tenderedTexto: string;
  accountId: string;
  machineId: string;
  installments: number;
  notes: string;
}

interface ReceberSaldoModalProps {
  venda: Sale;
  atorNome: string;
  onFechar: () => void;
  onRecebido: (atualizada: Sale) => void;
}

function ReceberSaldoVendaModal({
  venda,
  atorNome,
  onFechar,
  onRecebido,
}: ReceberSaldoModalProps) {
  const saldoAberto = Math.max(0, venda.total_cents - venda.paid_cents);

  const [linhas, setLinhas] = useState<LinhaRecebimentoForm[]>([
    {
      uid: 'rec-1',
      method: 'pix',
      amountTexto: centavosParaTextoInput(saldoAberto),
      tenderedTexto: '',
      accountId: 'conta-itau',
      machineId: 'maq-rede',
      installments: 1,
      notes: '',
    },
  ]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const atualizarLinha = (uid: string, parcial: Partial<LinhaRecebimentoForm>) => {
    setLinhas((atuais) => atuais.map((l) => (l.uid === uid ? { ...l, ...parcial } : l)));
  };

  const somaInformada = linhas.reduce(
    (acc, l) => somarCentavos(acc, converterTextoParaCentavos(l.amountTexto) ?? 0),
    0,
  );
  const restante = Math.max(0, saldoAberto - somaInformada);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    const pagamentos = linhas
      .map((l) => {
        const valor = converterTextoParaCentavos(l.amountTexto) ?? 0;
        const entregue = converterTextoParaCentavos(l.tenderedTexto);
        return {
          method: l.method,
          amount_cents: valor,
          tendered_cents: l.method === 'dinheiro' ? entregue : null,
          account_id: l.accountId,
          card_machine_id:
            l.method === 'debito' || l.method === 'credito' ? l.machineId : null,
          installments: l.method === 'credito' ? l.installments : 1,
          notes: l.notes,
        };
      })
      .filter((p) => p.amount_cents > 0);

    if (pagamentos.length === 0) {
      setErro('Informe o valor a receber.');
      return;
    }

    setSalvando(true);
    try {
      const atualizada = await receberSaldoVenda(venda.id, pagamentos, atorNome);
      onRecebido(atualizada);
      onFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível registrar o recebimento.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalDialogoVendas
      aberto
      onFechar={onFechar}
      titulo={`Receber saldo · ${venda.number}`}
      subtitulo={`Cliente: ${venda.customer_name} · Saldo em aberto: ${formatarReais(saldoAberto)}`}
      larguraMax="max-w-xl"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="space-y-3">
          {linhas.map((lin) => {
            const valorCents = converterTextoParaCentavos(lin.amountTexto) ?? 0;
            const entregueCents = converterTextoParaCentavos(lin.tenderedTexto) ?? 0;
            const troco =
              lin.method === 'dinheiro' && entregueCents > valorCents
                ? entregueCents - valorCents
                : 0;
            const maq = MAQUININHAS_DEMO.find((m) => m.id === lin.machineId);
            const taxa =
              (lin.method === 'debito' || lin.method === 'credito') && maq
                ? calcularTaxaMaquininha(maq, lin.method, lin.installments, valorCents)
                : null;

            return (
              <div
                key={lin.uid}
                className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
              >
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Forma de pagamento
                    </label>
                    <select
                      value={lin.method}
                      onChange={(e) => {
                        const m = e.target.value as FinancialPaymentMethod;
                        atualizarLinha(lin.uid, {
                          method: m,
                          accountId: m === 'dinheiro' ? 'conta-caixa-brv' : 'conta-itau',
                        });
                      }}
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800"
                    >
                      {(Object.keys(ROTULO_FORMA_PAGAMENTO) as FinancialPaymentMethod[]).map(
                        (m) => (
                          <option key={m} value={m}>
                            {ROTULO_FORMA_PAGAMENTO[m]}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Valor a abater (R$)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={lin.amountTexto}
                      onChange={(e) =>
                        atualizarLinha(lin.uid, { amountTexto: e.target.value })
                      }
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-800"
                    />
                  </div>
                </div>

                {lin.method === 'dinheiro' ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600">
                        Valor entregue em espécie (p/ troco)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={lin.tenderedTexto}
                        onChange={(e) =>
                          atualizarLinha(lin.uid, { tenderedTexto: e.target.value })
                        }
                        placeholder={lin.amountTexto}
                        className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div className="flex flex-col justify-end">
                      <span className="text-[11px] text-slate-500">Troco a devolver:</span>
                      <span className="text-sm font-extrabold text-emerald-700">
                        {formatarReais(troco)}
                      </span>
                    </div>
                  </div>
                ) : lin.method === 'debito' || lin.method === 'credito' ? (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600">
                        Maquininha
                      </label>
                      <select
                        value={lin.machineId}
                        onChange={(e) =>
                          atualizarLinha(lin.uid, { machineId: e.target.value })
                        }
                        className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                      >
                        {MAQUININHAS_DEMO.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {lin.method === 'credito' && (
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600">
                          Parcelas
                        </label>
                        <select
                          value={lin.installments}
                          onChange={(e) =>
                            atualizarLinha(lin.uid, {
                              installments: Number(e.target.value),
                            })
                          }
                          className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
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
                      <p className="text-[11px] text-slate-500 sm:col-span-2">
                        Taxa estimada: <strong>{taxa.percentual.toFixed(2)}%</strong> ({formatarReais(taxa.taxaCentavos)}) ·
                        Líquido estimado no dia útil seguinte: <strong>{formatarReais(taxa.liquidoCentavos)}</strong>
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600">
                      Conta de destino
                    </label>
                    <select
                      value={lin.accountId}
                      onChange={(e) =>
                        atualizarLinha(lin.uid, { accountId: e.target.value })
                      }
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    >
                      {CONTAS_FINANCEIRAS_DEMO.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {linhas.length > 1 && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        setLinhas((at) => at.filter((x) => x.uid !== lin.uid))
                      }
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
                    >
                      <Trash2 size={12} /> Remover linha
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <button
            type="button"
            onClick={() =>
              setLinhas((at) => [
                ...at,
                {
                  uid: `rec-${Date.now()}`,
                  method: 'cartao' in at ? 'pix' : 'credito',
                  amountTexto: restante > 0 ? centavosParaTextoInput(restante) : '',
                  tenderedTexto: '',
                  accountId: 'conta-itau',
                  machineId: 'maq-rede',
                  installments: 1,
                  notes: '',
                },
              ])
            }
            className="inline-flex items-center gap-1 font-bold text-blue-600 hover:underline"
          >
            <Plus size={14} /> Adicionar outra forma
          </button>

          <span>
            Restante após este recebimento:{' '}
            <strong className={restante > 0 ? 'text-amber-700' : 'text-emerald-700'}>
              {formatarReais(restante)}
            </strong>
          </span>
        </div>

        {erro && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            Confirmar recebimento ({formatarReais(somaInformada)})
          </button>
        </div>
      </form>
    </ModalDialogoVendas>
  );
}

// ============================================================================
// Painel de Detalhe da Venda
// ============================================================================

interface VendaDetalhesProps {
  vendaId: string;
  onFechar: () => void;
  onAlterado: () => void;
}

export default function VendaDetalhes({
  vendaId,
  onFechar,
  onAlterado,
}: VendaDetalhesProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const atorNome = profile?.full_name || 'Equipe BRV';
  const { nivel } = useNivelFinanceiro(profile);
  const ehCompleto = nivel === 'completo';

  const [venda, setVenda] = useState<Sale | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [receberAberto, setReceberAberto] = useState(false);
  const [reciboAberto, setReciboAberto] = useState(false);
  const [cancelarAberto, setCancelarAberto] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    let ativo = true;
    buscarVenda(vendaId)
      .then((achada) => {
        if (!ativo) return;
        if (!achada) setErro('Venda não encontrada.');
        else setVenda(achada);
      })
      .catch((e: unknown) => {
        if (ativo) setErro(e instanceof Error ? e.message : 'Erro ao carregar a venda.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [vendaId]);

  const handleConfirmarCancelamento = async (e: FormEvent) => {
    e.preventDefault();
    if (!venda || !motivoCancelamento.trim()) return;
    setCancelando(true);
    setErro(null);
    try {
      const atualizada = await cancelarVenda(venda.id, motivoCancelamento, atorNome);
      setVenda(atualizada);
      setCancelarAberto(false);
      onAlterado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível cancelar a venda.');
    } finally {
      setCancelando(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 pb-16">
      {carregando ? (
        <div className="flex h-96 items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <span className="text-sm font-medium">Carregando venda...</span>
          </div>
        </div>
      ) : !venda ? (
        <div className="mx-auto mt-16 max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-red-700">{erro ?? 'Venda não encontrada.'}</p>
          <button
            type="button"
            onClick={onFechar}
            className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
          >
            Voltar
          </button>
        </div>
      ) : (
        (() => {
          const sit = situacaoVenda(venda);
          const cancelada = venda.status === 'cancelada';
          const saldoAberto = Math.max(0, venda.total_cents - venda.paid_cents);
          const temNotaEmitida = venda.documents.some((d) => d.status === 'emitida');

          return (
            <>
              {/* Cabeçalho fixo */}
              <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3.5 shadow-2xs sm:px-6">
                <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <ShoppingBag size={18} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
                          {venda.number}
                        </h1>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${CORES_SITUACAO_VENDA[sit].selo}`}
                        >
                          {CORES_SITUACAO_VENDA[sit].rotulo}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                          Origem: {ROTULO_ORIGEM_VENDA[venda.origin_type]}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {venda.customer_name} · {formatarDataHora(venda.created_at)}
                        {venda.seller_name ? ` · Vendedor(a): ${venda.seller_name}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setReciboAberto(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
                    >
                      <Printer size={14} />
                      Imprimir recibo
                    </button>

                    {!cancelada && saldoAberto > 0 && (
                      <button
                        type="button"
                        onClick={() => setReceberAberto(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700"
                      >
                        <DollarSign size={14} />
                        Receber saldo ({formatarReais(saldoAberto)})
                      </button>
                    )}

                    {!cancelada && ehCompleto && (
                      <button
                        type="button"
                        onClick={() => setCancelarAberto(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                      >
                        <Ban size={14} />
                        Cancelar venda
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={onFechar}
                      aria-label="Fechar"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mx-auto mt-6 max-w-5xl space-y-6 px-4 sm:px-6">
                {cancelada && (
                  <div
                    role="status"
                    className="rounded-2xl border-2 border-slate-300 bg-slate-100 p-4 text-xs text-slate-800"
                  >
                    <p className="text-sm font-bold text-slate-900">
                      Venda cancelada (somente leitura)
                    </p>
                    <p className="mt-0.5 text-slate-600">
                      {venda.cancelled_at ? `Em ${formatarDataHora(venda.cancelled_at)}` : ''}
                      {venda.cancelled_by_name ? ` por ${venda.cancelled_by_name}` : ''}
                      {venda.cancel_reason ? ` · Motivo: ${venda.cancel_reason}` : ''}
                    </p>
                  </div>
                )}

                {erro && (
                  <p
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
                  >
                    {erro}
                  </p>
                )}

                {/* Vínculos com orçamento / OS */}
                {(venda.quote_id || venda.service_order_number) && (
                  <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-xs shadow-xs">
                    <span className="font-bold text-slate-600">Vínculos:</span>
                    {venda.quote_id && (
                      <button
                        type="button"
                        onClick={() => navigate(`/orcamentos?orcamento=${venda.quote_id}`)}
                        className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 font-bold text-blue-800 hover:bg-blue-100"
                      >
                        Orçamento {venda.quote_number} <ExternalLink size={12} />
                      </button>
                    )}
                    {venda.service_order_number && (
                      <button
                        type="button"
                        onClick={() => navigate('/ordens-de-servico')}
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 font-bold text-indigo-800 hover:bg-indigo-100"
                      >
                        OS nº {venda.service_order_number} <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                )}

                {/* Itens da venda */}
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                  <h2 className="text-base font-bold text-slate-800">
                    Itens da venda ({venda.items.length})
                  </h2>

                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-[11px] font-bold uppercase text-slate-500">
                          <th className="py-2 pr-3">Tipo</th>
                          <th className="px-3 py-2">Código / Item</th>
                          <th className="px-3 py-2 text-center">Qtd.</th>
                          <th className="px-3 py-2 text-right">Unitário</th>
                          <th className="px-3 py-2 text-right">Desconto</th>
                          <th className="py-2 pl-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {venda.items.map((item) => (
                          <tr key={item.id}>
                            <td className="py-2.5 pr-3">
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
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="font-mono text-[11px] text-slate-400">
                                {item.code}
                              </span>{' '}
                              <strong className="text-slate-900">{item.name}</strong>
                            </td>
                            <td className="px-3 py-2.5 text-center tabular-nums">
                              {item.quantity} {item.unit}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {formatarReais(item.unit_price_cents)}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">
                              {item.discount_cents > 0
                                ? `- ${formatarReais(item.discount_cents)}`
                                : '—'}
                            </td>
                            <td className="py-2.5 pl-3 text-right font-extrabold tabular-nums text-brv-navy">
                              {formatarReais(item.total_cents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
                    <div className="flex flex-wrap gap-4 text-slate-600">
                      <span>
                        Produtos: <strong>{formatarReais(venda.products_subtotal_cents)}</strong>
                      </span>
                      <span>
                        Serviços: <strong>{formatarReais(venda.services_subtotal_cents)}</strong>
                      </span>
                      {venda.general_discount_cents > 0 && (
                        <span className="text-rose-700">
                          Desconto geral:{' '}
                          <strong>- {formatarReais(venda.general_discount_cents)}</strong>
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-extrabold text-brv-navy">
                      Total da Venda: {formatarReais(venda.total_cents)}
                    </div>
                  </div>
                </section>

                {/* Pagamentos */}
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-slate-800">
                      <CreditCard size={18} className="text-blue-600" />
                      <h2 className="text-base font-bold">
                        Pagamentos ({venda.payments.length})
                      </h2>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-emerald-700">
                        Pago: <strong>{formatarReais(venda.paid_cents)}</strong>
                      </span>
                      {saldoAberto > 0 && !cancelada && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-bold text-amber-900">
                          A receber: {formatarReais(saldoAberto)}
                        </span>
                      )}
                    </div>
                  </div>

                  {venda.payments.length === 0 ? (
                    <p className="mt-3 text-xs text-slate-400">
                      Nenhum pagamento registrado ainda (venda em aberto a receber).
                    </p>
                  ) : (
                    <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
                      {venda.payments.map((pg) => (
                        <li
                          key={pg.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900">
                              {ROTULO_FORMA_PAGAMENTO[pg.method]}
                              {pg.method === 'credito' && pg.installments > 1
                                ? ` (${pg.installments}x)`
                                : ''}
                            </span>
                            <span className="text-slate-500">
                              {' · '}
                              {pg.card_machine_name
                                ? `${pg.card_machine_name} → ${pg.account_name}`
                                : pg.account_name}
                            </span>
                            {pg.estimated_fee_cents != null && (
                              <span className="text-slate-400">
                                {' · '}Taxa est.: {pg.estimated_fee_percent}% (
                                {formatarReais(pg.estimated_fee_cents)})
                              </span>
                            )}
                            <p className="text-[11px] text-slate-400">
                              Lançado em {formatarDataHora(pg.paid_at)} por {pg.created_by_name}
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="text-sm font-extrabold text-emerald-700">
                              {formatarReais(pg.amount_cents)}
                            </span>
                            {pg.change_cents > 0 && (
                              <span className="block text-[11px] text-slate-500">
                                Troco: {formatarReais(pg.change_cents)}
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Notas fiscais (4.4) */}
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                  <h2 className="mb-3 text-base font-bold text-slate-800">Notas fiscais</h2>
                  <NotasFiscaisVenda
                    venda={venda}
                    podeCancelarNota={ehCompleto}
                    atorNome={atorNome}
                    onVendaAtualizada={(at) => {
                      setVenda(at);
                      onAlterado();
                    }}
                  />
                </section>

                {/* Histórico */}
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                  <div className="flex items-center gap-2 text-slate-800">
                    <History size={18} className="text-blue-600" />
                    <h2 className="text-base font-bold">Histórico da venda</h2>
                  </div>

                  <ol className="relative mt-4 ml-2 space-y-3 border-l-2 border-slate-200 pl-4">
                    {venda.events.map((ev) => (
                      <li key={ev.id} className="relative text-xs">
                        <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brv-navy" />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-slate-800">{ev.actor_name}</span>
                          <span className="text-[11px] text-slate-400">
                            {formatarDataHora(ev.created_at)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-slate-600">{ev.description}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>

              {receberAberto && (
                <ReceberSaldoVendaModal
                  venda={venda}
                  atorNome={atorNome}
                  onFechar={() => setReceberAberto(false)}
                  onRecebido={(at) => {
                    setVenda(at);
                    onAlterado();
                  }}
                />
              )}

              {reciboAberto && (
                <ReciboVendaModal venda={venda} onFechar={() => setReciboAberto(false)} />
              )}

              {cancelarAberto && (
                <ModalDialogoVendas
                  aberto
                  onFechar={() => setCancelarAberto(false)}
                  titulo={`Cancelar venda · ${venda.number}`}
                  subtitulo="O cancelamento estornará os pagamentos registrados desta venda."
                  larguraMax="max-w-md"
                >
                  {temNotaEmitida ? (
                    <div className="space-y-4">
                      <div
                        role="alert"
                        className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950"
                      >
                        <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-700" />
                        <p>
                          <strong>Atenção:</strong> venda com nota fiscal emitida só pode ser
                          cancelada depois de cancelar a nota fiscal na seção "Notas fiscais" desta
                          tela.
                        </p>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setCancelarAberto(false)}
                          className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white"
                        >
                          Entendi
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => void handleConfirmarCancelamento(e)}
                      className="space-y-4"
                    >
                      <div>
                        <label
                          htmlFor="canc-venda-motivo"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Motivo do cancelamento *
                        </label>
                        <textarea
                          id="canc-venda-motivo"
                          rows={3}
                          required
                          value={motivoCancelamento}
                          onChange={(e) => setMotivoCancelamento(e.target.value)}
                          placeholder="Descreva o motivo do cancelamento..."
                          className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setCancelarAberto(false)}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
                        >
                          Voltar
                        </button>
                        <button
                          type="submit"
                          disabled={cancelando || !motivoCancelamento.trim()}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {cancelando && <Loader2 size={13} className="animate-spin" />}
                          Confirmar cancelamento
                        </button>
                      </div>
                    </form>
                  )}
                </ModalDialogoVendas>
              )}
            </>
          );
        })()
      )}
    </div>,
    document.body,
  );
}

