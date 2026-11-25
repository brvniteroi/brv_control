import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import type {
  CardMachine,
  FinancialAccount,
  FinancialCategory,
  FinancialPaymentMethod,
  OrigemRecebimentoModal,
} from '../../types/financeiro';
import {
  centavosParaTextoInput,
  converterTextoParaCentavos,
  formatarReais,
  somarCentavos,
  subtrairCentavos,
} from '../../utils/dinheiro';
import { formatarData } from '../../utils/ordens';
import { ROTULO_FORMA_PAGAMENTO } from '../vendas/cores';
import ModalDialogoVendas from '../vendas/ModalDialogoVendas';
import {
  listarCategorias,
  listarContas,
  listarMaquininhas,
  registrarRecebimento,
} from './fonteDeDados';
import { calcularLiquidacaoCartao, diaLocalFinanceiro } from './regrasFinanceiro';

export interface RegistrarRecebimentoModalProps {
  origem: OrigemRecebimentoModal;
  onClose: () => void;
  onRegistrado: () => void;
}

interface LinhaPagamentoEstado {
  uid: string;
  method: FinancialPaymentMethod;
  accountId: string;
  machineId: string;
  installments: number;
  amountTexto: string;
  tenderedTexto: string;
}

const INPUT =
  'mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none';

const CAMPO_CELULA =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none';

const FORMAS_DISPONIVEIS: FinancialPaymentMethod[] = [
  'pix',
  'dinheiro',
  'debito',
  'credito',
  'boleto',
  'transferencia',
  'cheque',
];

export default function RegistrarRecebimentoModal({
  origem,
  onClose,
  onRegistrado,
}: RegistrarRecebimentoModalProps) {
  const { profile } = useAuth();
  const atorNome = profile?.full_name || 'Equipe BRV';
  const seqUidRef = useRef(2);

  const [contas, setContas] = useState<FinancialAccount[]>([]);
  const [maquininhas, setMaquininhas] = useState<CardMachine[]>([]);
  const [categoriasReceita, setCategoriasReceita] = useState<FinancialCategory[]>([]);

  const [clienteNome, setClienteNome] = useState(origem.clienteNome || 'Consumidor final');
  const [dataRecebimento, setDataRecebimento] = useState(() => diaLocalFinanceiro());
  const [categoriaId, setCategoriaId] = useState(
    origem.tipo === 'os' ? 'cat-fin-servico' : 'cat-fin-venda-loja',
  );
  const [observacao, setObservacao] = useState('');

  const [linhas, setLinhas] = useState<LinhaPagamentoEstado[]>(() => [
    {
      uid: 'pg-1',
      method: 'pix',
      accountId: '',
      machineId: '',
      installments: 1,
      amountTexto: origem.valorSugerido > 0 ? centavosParaTextoInput(origem.valorSugerido) : '',
      tenderedTexto: '',
    },
  ]);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    Promise.all([listarContas(), listarMaquininhas(), listarCategorias()])
      .then(([listaContas, listaMaq, listaCats]) => {
        if (!ativo) return;
        const ativas = listaContas.filter((c) => c.active);
        const maqsAtivas = listaMaq.filter((m) => m.active);
        const recAtivas = listaCats.filter((c) => c.active && c.kind === 'receita');
        setContas(ativas);
        setMaquininhas(maqsAtivas);
        setCategoriasReceita(recAtivas);
      })
      .catch((e: unknown) => {
        if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar as contas.');
      });
    return () => {
      ativo = false;
    };
  }, []);

  // Linha sem escolha ('') usa o padrão: dinheiro no caixa; o resto no primeiro banco
  const contaDaLinha = (l: { method: FinancialPaymentMethod; accountId: string }): string => {
    const doTipo = contas.filter((c) => (l.method === 'dinheiro' ? c.kind === 'caixa' : c.kind === 'banco'));
    return doTipo.find((c) => c.id === l.accountId)?.id ?? doTipo[0]?.id ?? '';
  };
  const maquininhaDaLinha = (l: { machineId: string }): string =>
    maquininhas.find((m) => m.id === l.machineId)?.id ?? maquininhas[0]?.id ?? '';

  const atualizarLinha = (uid: string, parcial: Partial<LinhaPagamentoEstado>) => {
    setLinhas((atuais) => atuais.map((l) => (l.uid === uid ? { ...l, ...parcial } : l)));
  };

  const totalInformado = linhas.reduce(
    (acc, l) => somarCentavos(acc, converterTextoParaCentavos(l.amountTexto) ?? 0),
    0,
  );

  const faltaSugerido =
    origem.valorSugerido > 0
      ? Math.max(0, subtrairCentavos(origem.valorSugerido, totalInformado))
      : 0;

  const totalTroco = linhas.reduce((acc, l) => {
    if (l.method !== 'dinheiro') return acc;
    const val = converterTextoParaCentavos(l.amountTexto) ?? 0;
    const ent = converterTextoParaCentavos(l.tenderedTexto) ?? 0;
    return ent > val ? somarCentavos(acc, subtrairCentavos(ent, val)) : acc;
  }, 0);

  const adicionarLinha = () => {
    const uid = `pg-${seqUidRef.current++}`;
    setLinhas((atuais) => [
      ...atuais,
      {
        uid,
        method: 'credito',
        accountId: '',
        machineId: '',
        installments: 1,
        amountTexto: faltaSugerido > 0 ? centavosParaTextoInput(faltaSugerido) : '',
        tenderedTexto: '',
      },
    ]);
  };

  const removerLinha = (uid: string) => {
    setLinhas((atuais) => (atuais.length > 1 ? atuais.filter((l) => l.uid !== uid) : atuais));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);

    const pagamentos = linhas
      .map((l) => {
        const valor = converterTextoParaCentavos(l.amountTexto) ?? 0;
        const entregue = converterTextoParaCentavos(l.tenderedTexto);
        const ehCartao = l.method === 'debito' || l.method === 'credito';
        return {
          method: l.method,
          amount_cents: valor,
          tendered_cents: l.method === 'dinheiro' ? entregue : null,
          account_id: ehCartao ? null : contaDaLinha(l),
          card_machine_id: ehCartao ? maquininhaDaLinha(l) : null,
          installments: l.method === 'credito' ? l.installments : 1,
        };
      })
      .filter((p) => p.amount_cents > 0);

    if (pagamentos.length === 0) {
      setErro('Informe ao menos uma forma de pagamento com valor maior que zero.');
      return;
    }

    if (origem.valorSugerido > 0 && totalInformado > origem.valorSugerido) {
      setErro(
        `A soma das formas (${formatarReais(totalInformado)}) excede o saldo a receber (${formatarReais(origem.valorSugerido)}). Para troco em espécie, use a coluna "Entregue (R$)".`,
      );
      return;
    }

    setSalvando(true);
    try {
      await registrarRecebimento(
        {
          origem: {
            ...origem,
            clienteNome: clienteNome.trim() || origem.clienteNome || 'Consumidor final',
          },
          occurred_date: dataRecebimento,
          category_id: categoriaId,
          notes: observacao.trim() || null,
          pagamentos,
        },
        atorNome,
      );
      onRegistrado();
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível registrar o recebimento.');
    } finally {
      setSalvando(false);
    }
  };

  const tituloModal = origem.numero
    ? `Receber · ${origem.numero}`
    : origem.tipo === 'os'
      ? 'Receber Ordem de Serviço'
      : 'Receber avulso';

  return (
    <ModalDialogoVendas aberto onFechar={onClose} titulo={tituloModal} larguraMax="max-w-3xl">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Cliente</label>
            {origem.tipo === 'avulso' ? (
              <input
                type="text"
                value={clienteNome}
                onChange={(e) => setClienteNome(e.target.value)}
                placeholder="Consumidor final"
                className={INPUT}
              />
            ) : (
              <div className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
                {origem.clienteNome}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="rec-data" className="block text-xs font-semibold text-slate-700">
              Data
            </label>
            <input
              id="rec-data"
              type="date"
              value={dataRecebimento}
              onChange={(e) => setDataRecebimento(e.target.value)}
              className={INPUT}
            />
          </div>

          {origem.tipo === 'avulso' ? (
            <div>
              <label htmlFor="rec-cat" className="block text-xs font-semibold text-slate-700">
                Categoria
              </label>
              <select
                id="rec-cat"
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className={INPUT}
              >
                {categoriasReceita.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <span className="block text-xs font-semibold text-slate-700">Saldo a receber</span>
              <div className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold tabular-nums text-slate-900">
                {formatarReais(origem.valorSugerido)}
              </div>
            </div>
          )}
        </div>

        {/* Tabela compacta de formas de pagamento (Regra 8 do GEMINI.md: uma linha por item, editável na célula) */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[600px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                <th className="w-40 px-3 py-2.5">Forma</th>
                <th className="w-44 px-3 py-2.5">Conta / Maquininha</th>
                <th className="w-20 px-2 py-2.5 text-center">Parc.</th>
                <th className="w-32 px-2 py-2.5 text-right">Valor (R$)</th>
                <th className="px-3 py-2.5">Troco / Liquidação</th>
                <th className="w-10 px-2 py-2.5 text-right">
                  <span className="sr-only">Remover</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhas.map((lin) => {
                const ehCartao = lin.method === 'debito' || lin.method === 'credito';
                const valorCents = converterTextoParaCentavos(lin.amountTexto) ?? 0;
                const entregueCents = converterTextoParaCentavos(lin.tenderedTexto) ?? 0;
                const trocoLinha =
                  lin.method === 'dinheiro' && entregueCents > valorCents
                    ? subtrairCentavos(entregueCents, valorCents)
                    : 0;
                const maq = maquininhas.find((m) => m.id === maquininhaDaLinha(lin));
                const liq =
                  ehCartao && maq && valorCents > 0
                    ? calcularLiquidacaoCartao(
                        maq,
                        lin.method === 'debito' ? 'debito' : 'credito',
                        lin.installments,
                        valorCents,
                        dataRecebimento,
                      )
                    : null;

                return (
                  <tr key={lin.uid} className="align-middle hover:bg-slate-50/50">
                    <td className="px-3 py-2">
                      <select
                        value={lin.method}
                        aria-label="Forma de pagamento"
                        onChange={(e) => {
                          const m = e.target.value as FinancialPaymentMethod;
                          atualizarLinha(lin.uid, {
                            method: m,
                            accountId: '',
                            installments: m === 'credito' ? lin.installments : 1,
                          });
                        }}
                        className={CAMPO_CELULA}
                      >
                        {FORMAS_DISPONIVEIS.map((m) => (
                          <option key={m} value={m}>
                            {ROTULO_FORMA_PAGAMENTO[m]}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-3 py-2">
                      {ehCartao ? (
                        <select
                          value={maquininhaDaLinha(lin)}
                          aria-label="Maquininha de cartão"
                          onChange={(e) =>
                            atualizarLinha(lin.uid, { machineId: e.target.value })
                          }
                          className={CAMPO_CELULA}
                        >
                          {maquininhas.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.settlement_account_name})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={contaDaLinha(lin)}
                          aria-label="Conta de destino"
                          onChange={(e) =>
                            atualizarLinha(lin.uid, { accountId: e.target.value })
                          }
                          className={CAMPO_CELULA}
                        >
                          {contas
                            .filter((c) => c.kind === (lin.method === 'dinheiro' ? 'caixa' : 'banco'))
                            .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>

                    <td className="px-2 py-2">
                      {lin.method === 'credito' ? (
                        <select
                          value={lin.installments}
                          aria-label="Parcelas"
                          onChange={(e) =>
                            atualizarLinha(lin.uid, { installments: Number(e.target.value) })
                          }
                          className={`${CAMPO_CELULA} text-center`}
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                            <option key={n} value={n}>
                              {n}x
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="block text-center text-slate-400">1x</span>
                      )}
                    </td>

                    <td className="px-2 py-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label="Valor em reais"
                        value={lin.amountTexto}
                        onChange={(e) =>
                          atualizarLinha(lin.uid, { amountTexto: e.target.value })
                        }
                        placeholder="0,00"
                        className={`${CAMPO_CELULA} text-right font-semibold tabular-nums`}
                      />
                    </td>

                    <td className="px-3 py-2">
                      {lin.method === 'dinheiro' ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label="Valor entregue em espécie para troco"
                            value={lin.tenderedTexto}
                            onChange={(e) =>
                              atualizarLinha(lin.uid, { tenderedTexto: e.target.value })
                            }
                            placeholder="Entregue R$"
                            className={`${CAMPO_CELULA} w-28 text-right tabular-nums`}
                          />
                          {trocoLinha > 0 && (
                            <span className="whitespace-nowrap text-[11px] font-semibold text-emerald-700">
                              Troco: {formatarReais(trocoLinha)}
                            </span>
                          )}
                        </div>
                      ) : liq ? (
                        <span className="block text-[11px] text-slate-500">
                          Líq. <strong className="text-slate-700">{formatarReais(liq.liquidoCentavos)}</strong>{' '}
                          (taxa {liq.percentualTaxa.toFixed(2)}%) em{' '}
                          {formatarData(liq.dataLiquidacaoLocal)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-2 py-2 text-right">
                      {linhas.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removerLinha(lin.uid)}
                          title="Remover linha"
                          aria-label="Remover forma de pagamento"
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-3 py-2.5 text-xs">
            <button
              type="button"
              onClick={adicionarLinha}
              className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline"
            >
              <Plus size={14} /> Adicionar forma
            </button>

            <div className="flex flex-wrap items-center gap-4 text-slate-600">
              {totalTroco > 0 && (
                <span>
                  Troco:{' '}
                  <strong className="tabular-nums text-emerald-700">
                    {formatarReais(totalTroco)}
                  </strong>
                </span>
              )}
              {origem.valorSugerido > 0 && (
                <span>
                  Falta:{' '}
                  <strong
                    className={`tabular-nums ${
                      faltaSugerido > 0 ? 'text-amber-700' : 'text-emerald-700'
                    }`}
                  >
                    {formatarReais(faltaSugerido)}
                  </strong>
                </span>
              )}
              <span>
                Total informado:{' '}
                <strong className="tabular-nums text-slate-900">
                  {formatarReais(totalInformado)}
                </strong>
              </span>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="rec-obs" className="block text-xs font-semibold text-slate-700">
            Observação
          </label>
          <input
            id="rec-obs"
            type="text"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Opcional"
            className={INPUT}
          />
        </div>

        {erro && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
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
            Confirmar recebimento ({formatarReais(totalInformado)})
          </button>
        </div>
      </form>
    </ModalDialogoVendas>
  );
}

