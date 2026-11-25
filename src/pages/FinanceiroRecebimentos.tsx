import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Check,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { CORES_SITUACAO_RECEBIMENTO } from '../components/financeiro/cores';
import {
  CONTAS_FINANCEIRAS_DEMO,
  MAQUININHAS_DEMO,
  confirmarRecebimento,
  dinheiroComTecnicos,
  listarContas,
  listarMaquininhas,
  listarRecebimentosAConferir,
  recusarRecebimento,
  useNivelFinanceiro,
} from '../components/financeiro/fonteDeDados';
import {
  calcularLiquidacaoCartao,
  diaLocalFinanceiro,
} from '../components/financeiro/regrasFinanceiro';
import { ROTULO_FORMA_PAGAMENTO } from '../components/vendas/cores';
import ModalDialogoVendas from '../components/vendas/ModalDialogoVendas';
import NavegacaoVendas from '../components/vendas/NavegacaoVendas';
import { semAcento } from '../components/vendas/regrasVendas';
import { useAuth } from '../contexts/useAuth';
import type {
  CardMachine,
  FieldReceipt,
  FieldReceiptStatus,
  FinancialAccount,
  TechnicianCashHolding,
} from '../types/financeiro';
import {
  centavosParaTextoInput,
  converterTextoParaCentavos,
  formatarReais,
  somarCentavos,
  subtrairCentavos,
} from '../utils/dinheiro';
import { formatarData, formatarDataHora } from '../utils/ordens';

type FiltroSituacao = 'todos' | FieldReceiptStatus;

const INPUT =
  'mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none';

export default function FinanceiroRecebimentos() {
  const { profile } = useAuth();
  const atorNome = profile?.full_name || 'Jéssica Atendimento';
  const { nivel } = useNivelFinanceiro(profile);

  const [recebimentos, setRecebimentos] = useState<FieldReceipt[]>([]);
  const [tecnicosEmMaos, setTecnicosEmMaos] = useState<TechnicianCashHolding[]>([]);
  const [contas, setContas] = useState<FinancialAccount[]>(() =>
    CONTAS_FINANCEIRAS_DEMO.filter((c) => c.active),
  );
  const [maquininhas, setMaquininhas] = useState<CardMachine[]>(() =>
    MAQUININHAS_DEMO.filter((m) => m.active),
  );

  const [busca, setBusca] = useState('');
  const [situacaoFiltro, setSituacaoFiltro] = useState<FiltroSituacao>('a_conferir');
  const [formaFiltro, setFormaFiltro] = useState<'todas' | FieldReceipt['method']>('todas');

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Modal de confirmação
  const [recConfirmar, setRecConfirmar] = useState<FieldReceipt | null>(null);
  const [contaDestinoId, setContaDestinoId] = useState('conta-caixa-brv');
  const [maquininhaId, setMaquininhaId] = useState('maq-rede');
  const [parcelasCartao, setParcelasCartao] = useState(1);
  const [dataLiquidacao, setDataLiquidacao] = useState('');
  const [tarifaTexto, setTarifaTexto] = useState('');
  const [obsConfirmacao, setObsConfirmacao] = useState('');

  // Modal de divergência
  const [recDivergente, setRecDivergente] = useState<FieldReceipt | null>(null);
  const [motivoDivergencia, setMotivoDivergencia] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [listaRec, listaTec, listaContas, listaMaq] = await Promise.all([
        listarRecebimentosAConferir(),
        dinheiroComTecnicos(),
        listarContas(),
        listarMaquininhas(),
      ]);
      setRecebimentos(listaRec);
      setTecnicosEmMaos(listaTec);
      const contasAtivas = listaContas.filter((c) => c.active);
      const maqsAtivas = listaMaq.filter((m) => m.active);
      if (contasAtivas.length > 0) setContas(contasAtivas);
      if (maqsAtivas.length > 0) setMaquininhas(maqsAtivas);
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : 'Não foi possível carregar os recebimentos de campo.',
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (nivel === 'nenhum') return;
    const timer = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(timer);
  }, [carregar, nivel]);

  if (nivel === 'nenhum') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Recebimentos</h1>
            <p className="mt-1 text-xs text-slate-500">
              Conferência dos valores recebidos pelos técnicos em campo.
            </p>
          </div>
          <NavegacaoVendas />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-base font-bold text-slate-800">Acesso restrito</p>
          <p className="mt-1 text-xs text-slate-500">
            Seu perfil não possui permissão para conferir recebimentos.
          </p>
        </div>
      </div>
    );
  }

  const abrirModalConfirmar = (rec: FieldReceipt) => {
    setErroModal(null);
    setRecConfirmar(rec);
    setObsConfirmacao(rec.notes ?? '');
    const ehCartao = rec.method === 'debito' || rec.method === 'credito';
    if (ehCartao) {
      const maq =
        maquininhas.find((m) => m.id === rec.card_machine_id) ?? maquininhas[0];
      const parc = rec.method === 'credito' ? Math.max(1, rec.installments) : 1;
      setMaquininhaId(maq?.id ?? 'maq-rede');
      setParcelasCartao(parc);
      const calc = calcularLiquidacaoCartao(
        maq,
        rec.method === 'debito' ? 'debito' : 'credito',
        parc,
        rec.amount_cents,
        diaLocalFinanceiro(),
      );
      setDataLiquidacao(calc.dataLiquidacaoLocal);
      setTarifaTexto(centavosParaTextoInput(calc.taxaCentavos));
    } else {
      setContaDestinoId(rec.method === 'dinheiro' ? 'conta-caixa-brv' : 'conta-itau');
    }
  };

  const recalcularCartaoNoModal = (
    rec: FieldReceipt,
    novoMaqId: string,
    novasParcelas: number,
  ) => {
    const maq = maquininhas.find((m) => m.id === novoMaqId) ?? maquininhas[0];
    const calc = calcularLiquidacaoCartao(
      maq,
      rec.method === 'debito' ? 'debito' : 'credito',
      novasParcelas,
      rec.amount_cents,
      diaLocalFinanceiro(),
    );
    setDataLiquidacao(calc.dataLiquidacaoLocal);
    setTarifaTexto(centavosParaTextoInput(calc.taxaCentavos));
  };

  const handleConfirmar = async (e: FormEvent) => {
    e.preventDefault();
    if (!recConfirmar) return;
    setErroModal(null);
    const ehCartao = recConfirmar.method === 'debito' || recConfirmar.method === 'credito';
    const tarifaCents = converterTextoParaCentavos(tarifaTexto) ?? 0;

    setSalvando(true);
    try {
      await confirmarRecebimento(
        recConfirmar.id,
        ehCartao
          ? {
              card_machine_id: maquininhaId,
              installments: recConfirmar.method === 'credito' ? parcelasCartao : 1,
              settlement_date: dataLiquidacao,
              fee_cents: tarifaCents,
              notes: obsConfirmacao.trim() || undefined,
            }
          : {
              account_id: contaDestinoId,
              notes: obsConfirmacao.trim() || undefined,
            },
        atorNome,
      );
      setRecConfirmar(null);
      await carregar();
    } catch (err) {
      setErroModal(err instanceof Error ? err.message : 'Erro ao confirmar recebimento.');
    } finally {
      setSalvando(false);
    }
  };

  const handleRecusar = async (e: FormEvent) => {
    e.preventDefault();
    if (!recDivergente) return;
    setErroModal(null);
    if (!motivoDivergencia.trim()) {
      setErroModal('Informe o motivo da divergência.');
      return;
    }
    setSalvando(true);
    try {
      await recusarRecebimento(recDivergente.id, motivoDivergencia.trim(), atorNome);
      setRecDivergente(null);
      setMotivoDivergencia('');
      await carregar();
    } catch (err) {
      setErroModal(err instanceof Error ? err.message : 'Erro ao registrar divergência.');
    } finally {
      setSalvando(false);
    }
  };

  const termo = semAcento(busca);
  const filtrados = recebimentos.filter((r) => {
    if (situacaoFiltro !== 'todos' && r.status !== situacaoFiltro) return false;
    if (formaFiltro !== 'todas' && r.method !== formaFiltro) return false;
    if (termo) {
      const alvo = semAcento(
        `OS ${r.service_order_number} ${r.customer_name} ${r.technician_name} ${r.notes ?? ''}`,
      );
      if (!alvo.includes(termo)) return false;
    }
    return true;
  });

  const somaFiltro = filtrados.reduce((acc, r) => somarCentavos(acc, r.amount_cents), 0);
  const somaEmMaos = tecnicosEmMaos.reduce(
    (acc, t) => somarCentavos(acc, t.total_cash_cents),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho padrão Clientes.tsx (Regra 1 do GEMINI.md) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Recebimentos</h1>
          <p className="mt-1 text-xs text-slate-500">
            Conferência dos valores recebidos pelos técnicos nas Ordens de Serviço.
          </p>
        </div>
        <NavegacaoVendas />
      </div>

      {carregando ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-slate-500">
          <Loader2 size={20} className="mr-2 animate-spin text-blue-600" />
          <span className="text-sm font-medium">Carregando recebimentos...</span>
        </div>
      ) : erro ? (
        <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-red-700">{erro}</p>
          <button
            type="button"
            onClick={() => void carregar()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={14} /> Tentar de novo
          </button>
        </div>
      ) : (
        <>
          {/* Bloco compacto de dinheiro com técnicos ainda não entregue (seção 6.3) */}
          {tecnicosEmMaos.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
                <h2 className="text-sm font-bold text-slate-800">
                  Dinheiro com técnicos ainda não entregue
                </h2>
                <span className="text-xs text-slate-500">
                  Total em mãos:{' '}
                  <strong className="tabular-nums text-amber-700">
                    {formatarReais(somaEmMaos)}
                  </strong>
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-2.5">Técnico</th>
                      <th className="px-4 py-2.5 text-center">OS em espécie</th>
                      <th className="px-4 py-2.5">Recebimento mais antigo</th>
                      <th className="px-4 py-2.5 text-right">Total a entregar</th>
                      <th className="px-4 py-2.5 text-right">Filtro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {tecnicosEmMaos.map((t) => (
                      <tr key={t.technician_id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 font-semibold text-slate-900">
                          {t.technician_name}
                        </td>
                        <td className="px-4 py-2.5 text-center tabular-nums">
                          {t.receipts_count}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">
                          {formatarDataHora(t.oldest_received_at)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold tabular-nums text-amber-700">
                          {formatarReais(t.total_cash_cents)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setBusca(t.technician_name);
                              setSituacaoFiltro('a_conferir');
                              setFormaFiltro('dinheiro');
                            }}
                            className="font-semibold text-blue-600 hover:underline"
                          >
                            Filtrar técnico
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Barra única de filtros (Regra 2 do GEMINI.md: busca + controle segmentado sem contador + select) */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-sm">
              <Search
                size={16}
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por OS, cliente ou técnico..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-3.5 pl-9 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                {(
                  [
                    { id: 'todos', rotulo: 'Todos' },
                    { id: 'a_conferir', rotulo: 'A conferir' },
                    { id: 'confirmado', rotulo: 'Confirmados' },
                    { id: 'divergente', rotulo: 'Divergentes' },
                  ] as const
                ).map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setSituacaoFiltro(op.id)}
                    className={`rounded-lg px-3 py-1.5 transition ${
                      situacaoFiltro === op.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {op.rotulo}
                  </button>
                ))}
              </div>

              <select
                value={formaFiltro}
                aria-label="Filtrar por forma de pagamento"
                onChange={(e) =>
                  setFormaFiltro(e.target.value as 'todas' | FieldReceipt['method'])
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="todas">Todas as formas</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="debito">Cartão de débito</option>
                <option value="credito">Cartão de crédito</option>
              </select>
            </div>
          </div>

          {/* Tabela principal de recebimentos */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">OS / Data</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Técnico</th>
                    <th className="px-4 py-3">Forma</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                    <th className="px-4 py-3">Situação</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filtrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                        Nenhum recebimento encontrado para este filtro.
                      </td>
                    </tr>
                  ) : (
                    filtrados.map((rec) => {
                      const faltaOS = Math.max(
                        0,
                        subtrairCentavos(rec.order_total_cents, rec.amount_cents),
                      );
                      const estilo = CORES_SITUACAO_RECEBIMENTO[rec.status];

                      return (
                        <tr key={rec.id} className="hover:bg-slate-50/60">
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className="font-bold text-slate-900">
                              OS #{rec.service_order_number}
                            </span>
                            <p className="text-[11px] text-slate-400">
                              {formatarDataHora(rec.received_at)}
                            </p>
                          </td>

                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-800">{rec.customer_name}</span>
                            {rec.notes && (
                              <p className="text-[11px] text-slate-500">{rec.notes}</p>
                            )}
                          </td>

                          <td className="px-4 py-3 font-medium text-slate-800">
                            {rec.technician_name}
                          </td>

                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-800">
                              {ROTULO_FORMA_PAGAMENTO[rec.method]}
                              {rec.method === 'credito' && rec.installments > 1
                                ? ` (${rec.installments}x)`
                                : ''}
                            </span>
                            {rec.card_machine_name && (
                              <span className="block text-[11px] text-slate-500">
                                {rec.card_machine_name}
                              </span>
                            )}
                          </td>

                          {/* Valor recebido + "Falta R$ X" quando parcial (seção 6.0 item 6) */}
                          <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                            <span className="font-bold text-slate-900">
                              {formatarReais(rec.amount_cents)}
                            </span>
                            {faltaOS > 0 && (
                              <span className="block text-[11px] font-semibold text-amber-700">
                                Falta {formatarReais(faltaOS)} (OS{' '}
                                {formatarReais(rec.order_total_cents)})
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${estilo.selo}`}
                            >
                              {estilo.rotulo}
                            </span>
                            {rec.status === 'confirmado' && rec.settled_account_name && (
                              <p className="mt-0.5 text-[11px] text-slate-500">
                                {rec.settled_account_name}
                                {rec.settled_date ? ` · ${formatarData(rec.settled_date)}` : ''}
                                {rec.fee_cents
                                  ? ` · Tarifa: ${formatarReais(rec.fee_cents)}`
                                  : ''}
                              </p>
                            )}
                            {rec.status === 'divergente' && rec.divergence_reason && (
                              <p className="mt-0.5 text-[11px] text-red-600">
                                {rec.divergence_reason}
                              </p>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            {rec.status !== 'confirmado' ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => abrirModalConfirmar(rec)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                >
                                  <Check size={13} />
                                  Confirmar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setErroModal(null);
                                    setMotivoDivergencia(rec.divergence_reason ?? '');
                                    setRecDivergente(rec);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                                >
                                  <AlertTriangle size={13} />
                                  Divergência
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">
                                Por {rec.confirmed_by_name}
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

            {/* Rodapé único da tabela (Regra 3 do GEMINI.md) */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs text-slate-600">
              <span>{filtrados.length} recebimentos listados</span>
              <span>
                Total do filtro:{' '}
                <strong className="tabular-nums text-slate-900">
                  {formatarReais(somaFiltro)}
                </strong>
              </span>
            </div>
          </section>
        </>
      )}

      {/* Modal: Confirmar recebimento (com cálculo de liquidação no dia útil seguinte e taxa como tarifa editável para cartão) */}
      {recConfirmar && (
        <ModalDialogoVendas
          aberto
          onFechar={() => setRecConfirmar(null)}
          titulo={`Confirmar recebimento · OS #${recConfirmar.service_order_number}`}
          larguraMax="max-w-lg"
        >
          <form onSubmit={(e) => void handleConfirmar(e)} className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
              <div className="flex justify-between">
                <span>Cliente:</span>
                <strong>{recConfirmar.customer_name}</strong>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Técnico:</span>
                <strong>{recConfirmar.technician_name}</strong>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Forma informada:</span>
                <strong>{ROTULO_FORMA_PAGAMENTO[recConfirmar.method]}</strong>
              </div>
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-sm">
                <span className="font-semibold text-slate-900">Valor bruto recebido:</span>
                <strong className="tabular-nums text-slate-900">
                  {formatarReais(recConfirmar.amount_cents)}
                </strong>
              </div>
              {recConfirmar.amount_cents < recConfirmar.order_total_cents && (
                <div className="mt-1 flex justify-between text-[11px] font-semibold text-amber-700">
                  <span>Saldo restante da OS ({formatarReais(recConfirmar.order_total_cents)}):</span>
                  <span>
                    Falta{' '}
                    {formatarReais(
                      subtrairCentavos(
                        recConfirmar.order_total_cents,
                        recConfirmar.amount_cents,
                      ),
                    )}
                  </span>
                </div>
              )}
            </div>

            {recConfirmar.method === 'debito' || recConfirmar.method === 'credito' ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="conf-maq"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Maquininha *
                    </label>
                    <select
                      id="conf-maq"
                      value={maquininhaId}
                      onChange={(e) => {
                        const novoId = e.target.value;
                        setMaquininhaId(novoId);
                        recalcularCartaoNoModal(recConfirmar, novoId, parcelasCartao);
                      }}
                      className={INPUT}
                    >
                      {maquininhas.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.settlement_account_name})
                        </option>
                      ))}
                    </select>
                  </div>

                  {recConfirmar.method === 'credito' && (
                    <div>
                      <label
                        htmlFor="conf-parc"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Parcelas
                      </label>
                      <select
                        id="conf-parc"
                        value={parcelasCartao}
                        onChange={(e) => {
                          const p = Number(e.target.value);
                          setParcelasCartao(p);
                          recalcularCartaoNoModal(recConfirmar, maquininhaId, p);
                        }}
                        className={INPUT}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                          <option key={n} value={n}>
                            {n}x
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="conf-data-liq"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Data do crédito (dia útil seguinte) *
                    </label>
                    <input
                      id="conf-data-liq"
                      type="date"
                      required
                      value={dataLiquidacao}
                      onChange={(e) => setDataLiquidacao(e.target.value)}
                      className={INPUT}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="conf-tarifa"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Taxa como tarifa (R$) *
                    </label>
                    <input
                      id="conf-tarifa"
                      type="text"
                      inputMode="decimal"
                      required
                      value={tarifaTexto}
                      onChange={(e) => setTarifaTexto(e.target.value)}
                      className={INPUT}
                    />
                  </div>
                </div>

                {(() => {
                  const maqAtual =
                    maquininhas.find((m) => m.id === maquininhaId) ?? maquininhas[0];
                  const tarifaCents = converterTextoParaCentavos(tarifaTexto) ?? 0;
                  const liquidoCents = Math.max(
                    0,
                    subtrairCentavos(recConfirmar.amount_cents, tarifaCents),
                  );
                  return (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
                      <p>
                        Conta de liquidação:{' '}
                        <strong className="text-slate-900">
                          {maqAtual?.settlement_account_name ?? 'Itaú'}
                        </strong>
                      </p>
                      <p className="mt-0.5">
                        Entrada bruta:{' '}
                        <strong className="tabular-nums text-emerald-700">
                          + {formatarReais(recConfirmar.amount_cents)}
                        </strong>{' '}
                        · Tarifa:{' '}
                        <strong className="tabular-nums text-red-700">
                          - {formatarReais(tarifaCents)}
                        </strong>{' '}
                        · Líquido:{' '}
                        <strong className="tabular-nums text-slate-900">
                          {formatarReais(liquidoCents)}
                        </strong>
                      </p>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div>
                <label
                  htmlFor="conf-conta"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Conta de destino *
                </label>
                <select
                  id="conf-conta"
                  value={contaDestinoId}
                  onChange={(e) => setContaDestinoId(e.target.value)}
                  className={INPUT}
                >
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="conf-obs" className="block text-xs font-semibold text-slate-700">
                Observação
              </label>
              <input
                id="conf-obs"
                type="text"
                value={obsConfirmacao}
                onChange={(e) => setObsConfirmacao(e.target.value)}
                placeholder="Opcional"
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
                onClick={() => setRecConfirmar(null)}
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
                Confirmar entrada
              </button>
            </div>
          </form>
        </ModalDialogoVendas>
      )}

      {/* Modal: Registrar divergência */}
      {recDivergente && (
        <ModalDialogoVendas
          aberto
          onFechar={() => setRecDivergente(null)}
          titulo={`Divergência · OS #${recDivergente.service_order_number}`}
          larguraMax="max-w-md"
        >
          <form onSubmit={(e) => void handleRecusar(e)} className="space-y-4">
            <div>
              <label
                htmlFor="div-motivo"
                className="block text-xs font-semibold text-slate-700"
              >
                Motivo da divergência *
              </label>
              <textarea
                id="div-motivo"
                rows={3}
                required
                value={motivoDivergencia}
                onChange={(e) => setMotivoDivergencia(e.target.value)}
                placeholder="Ex.: Valor entregue em espécie diferente do informado na OS"
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
                onClick={() => setRecDivergente(null)}
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
                Salvar divergência
              </button>
            </div>
          </form>
        </ModalDialogoVendas>
      )}
    </div>
  );
}
