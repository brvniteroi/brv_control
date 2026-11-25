import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CreditCard,
  DollarSign,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  Users,
  Wallet,
} from 'lucide-react';
import FiltroPeriodo from '../components/comum/FiltroPeriodo';
import {
  RECEBIMENTOS_DE_CAMPO_DISPONIVEIS,
  resumoFinanceiro,
  useNivelFinanceiro,
} from '../components/financeiro/fonteDeDados';
import RegistrarRecebimentoModal from '../components/financeiro/RegistrarRecebimentoModal';
import { diaLocalFinanceiro } from '../components/financeiro/regrasFinanceiro';
import { ROTULO_FORMA_PAGAMENTO_CURTO } from '../components/vendas/cores';
import NavegacaoVendas from '../components/vendas/NavegacaoVendas';
import { useAuth } from '../contexts/useAuth';
import type {
  FinancialOverviewSummary,
  FinancialPaymentMethod,
  OrigemRecebimentoModal,
} from '../types/financeiro';
import { formatarReais } from '../utils/dinheiro';
import { formatarData } from '../utils/ordens';

const FORMAS_RESUMO: FinancialPaymentMethod[] = [
  'pix',
  'dinheiro',
  'credito',
  'debito',
  'boleto',
  'transferencia',
  'cheque',
];

export default function FinanceiroVisaoGeral() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { nivel } = useNivelFinanceiro(profile);

  const hoje = diaLocalFinanceiro();
  const [dataInicio, setDataInicio] = useState(() => `${hoje.slice(0, 7)}-01`);
  const [dataFim, setDataFim] = useState(() => hoje);

  const [resumo, setResumo] = useState<FinancialOverviewSummary | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modalReceberOrigem, setModalReceberOrigem] = useState<OrigemRecebimentoModal | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await resumoFinanceiro({ dataInicio, dataFim });
      setResumo(dados);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o resumo financeiro.');
    } finally {
      setCarregando(false);
    }
  }, [dataInicio, dataFim]);

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
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Financeiro</h1>
            <p className="mt-1 text-xs text-slate-500">
              Visão geral do caixa, contas e recebimentos.
            </p>
          </div>
          <NavegacaoVendas />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-base font-bold text-slate-800">Acesso restrito</p>
          <p className="mt-1 text-xs text-slate-500">
            Seu perfil não possui permissão para visualizar o módulo Financeiro.
          </p>
        </div>
      </div>
    );
  }

  const ehCompleto = nivel === 'completo';
  const maiorDia30d = resumo
    ? Math.max(...resumo.daily_received_30d.map((d) => d.amount_cents), 1)
    : 1;

  return (
    <div className="space-y-6">
      {/* Cabeçalho padrão Clientes.tsx (Regra 1 do GEMINI.md) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Financeiro</h1>
          <p className="mt-1 text-xs text-slate-500">
            {ehCompleto
              ? 'Saldos das contas, recebimentos e vendas a receber.'
              : 'Recebimentos do dia e vendas a receber.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <NavegacaoVendas />

          {ehCompleto && (
            <FiltroPeriodo
              idPrefixo="fin-visao-periodo"
              dataInicio={dataInicio}
              dataFim={dataFim}
              onMudar={(ini, fim) => {
                setDataInicio(ini);
                setDataFim(fim);
              }}
              classe="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
            />
          )}

          <Link
            to="/vendas"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Ir para Vendas
          </Link>
        </div>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-slate-500">
          <Loader2 size={20} className="mr-2 animate-spin text-blue-600" />
          <span className="text-sm font-medium">Carregando visão geral...</span>
        </div>
      ) : erro || !resumo ? (
        <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-red-700">
            {erro ?? 'Erro ao carregar dados.'}
          </p>
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
          {/* Saldos das contas e maquininhas — visível apenas para nível `completo` (seção 6.1) */}
          {ehCompleto && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {resumo.accounts.map((conta) => (
                <button
                  key={conta.id}
                  type="button"
                  onClick={() => navigate(`/financeiro/movimentos?conta=${conta.id}`)}
                  className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:border-slate-300"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      conta.kind === 'caixa'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    {conta.kind === 'caixa' ? <Wallet size={19} /> : <Landmark size={19} />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-500">{conta.name}</p>
                    <p className="text-lg font-bold leading-tight tabular-nums text-slate-900">
                      {formatarReais(conta.current_balance_cents)}
                    </p>
                    <p className="text-[11px] text-slate-400">Ver extrato</p>
                  </div>
                </button>
              ))}

              <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <DollarSign size={19} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">Total em contas</p>
                  <p className="text-lg font-bold leading-tight tabular-nums text-slate-900">
                    {formatarReais(resumo.total_accounts_balance_cents)}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {resumo.accounts.length} contas ativas
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Cartões de resumo operacional (`CardsResumo.tsx` modelo) */}
          <div
            className={`grid grid-cols-1 gap-4 ${
              ehCompleto
                ? RECEBIMENTOS_DE_CAMPO_DISPONIVEIS
                  ? 'sm:grid-cols-2 lg:grid-cols-4'
                  : 'sm:grid-cols-3'
                : RECEBIMENTOS_DE_CAMPO_DISPONIVEIS
                  ? 'sm:grid-cols-3'
                  : 'sm:grid-cols-2'
            }`}
          >
            {/* Recebido hoje (visível para `completo` e `caixa`) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Recebido hoje</span>
                <span className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600">
                  <DollarSign size={15} />
                </span>
              </div>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                {formatarReais(resumo.received_today_cents)}
              </p>
              <div className="mt-2.5 space-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
                {FORMAS_RESUMO.filter((m) => resumo.received_today_by_method[m] > 0).length ===
                0 ? (
                  <p className="text-slate-400">Sem entradas hoje</p>
                ) : (
                  FORMAS_RESUMO.filter((m) => resumo.received_today_by_method[m] > 0).map((m) => (
                    <div key={m} className="flex items-center justify-between">
                      <span>{ROTULO_FORMA_PAGAMENTO_CURTO[m]}</span>
                      <strong className="tabular-nums text-slate-800">
                        {formatarReais(resumo.received_today_by_method[m])}
                      </strong>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recebido no período/mês (visível apenas para `completo`) */}
            {ehCompleto && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Recebido no período</span>
                  <span className="rounded-lg bg-blue-50 p-1.5 text-blue-600">
                    <Landmark size={15} />
                  </span>
                </div>
                <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                  {formatarReais(resumo.received_month_cents)}
                </p>
                <div className="mt-2.5 space-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
                  {FORMAS_RESUMO.filter((m) => resumo.received_month_by_method[m] > 0).map((m) => (
                    <div key={m} className="flex items-center justify-between">
                      <span>{ROTULO_FORMA_PAGAMENTO_CURTO[m]}</span>
                      <strong className="tabular-nums text-slate-800">
                        {formatarReais(resumo.received_month_by_method[m])}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Maquininhas a liquidar (visível apenas para `completo`) */}
            {ehCompleto && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Maquininhas (a liquidar)
                  </span>
                  <span className="rounded-lg bg-sky-50 p-1.5 text-sky-600">
                    <CreditCard size={15} />
                  </span>
                </div>
                <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                  {formatarReais(
                    resumo.pending_machines.reduce((acc, m) => acc + m.pending_net_cents, 0),
                  )}
                </p>
                <div className="mt-2.5 space-y-1.5 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
                  {resumo.pending_machines.length === 0 && (
                    <p className="text-slate-400">Nenhum cartão a cair</p>
                  )}
                  {resumo.pending_machines.map((m) => (
                    <div key={m.machine_id} className="flex items-center justify-between">
                      <span>
                        {m.machine_name} ({formatarData(m.next_settlement_date)})
                      </span>
                      <strong className="tabular-nums text-slate-800">
                        {formatarReais(m.pending_net_cents)}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dinheiro com técnicos e recebimentos a conferir (`completo` e `caixa`) */}
            {RECEBIMENTOS_DE_CAMPO_DISPONIVEIS && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Dinheiro com técnicos</span>
                <span className="rounded-lg bg-amber-50 p-1.5 text-amber-600">
                  <Users size={15} />
                </span>
              </div>
              <p className="mt-1 text-xl font-bold tabular-nums text-amber-700">
                {formatarReais(resumo.technician_cash_total_cents)}
              </p>
              <div className="mt-2.5 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
                <p>
                  <strong>{resumo.pending_receipts_count}</strong> recebimentos de campo a conferir
                </p>
                <Link
                  to="/financeiro/recebimentos"
                  className="mt-1.5 inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline"
                >
                  Ir para conferência <ArrowRight size={12} />
                </Link>
              </div>
            </div>

            )}

            {/* No perfil caixa, mostra também um cartão direto para o Caixa da loja */}
            {!ehCompleto && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Caixa da loja</span>
                  <span className="rounded-lg bg-blue-50 p-1.5 text-blue-600">
                    <Wallet size={15} />
                  </span>
                </div>
                <p className="mt-1 text-base font-bold text-slate-900">
                  Abertura, sangria e fechamento
                </p>
                <div className="mt-2.5 border-t border-slate-100 pt-2 text-[11px]">
                  <Link
                    to="/financeiro/caixa"
                    className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline"
                  >
                    Abrir tela do Caixa <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Gráfico simples em HTML/CSS dos últimos 30 dias — apenas nível `completo` (modelo GraficoAtividadesMes.tsx) */}
          {ehCompleto && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">
                    Recebido nos últimos 30 dias
                  </h2>
                  <p className="text-xs text-slate-500">
                    O que os clientes pagaram em cada dia (vendas e receitas avulsas).
                  </p>
                </div>
              </div>

              <div className="flex h-40 items-end gap-1 border-b border-slate-200 pt-6">
                {resumo.daily_received_30d.map((ponto) => {
                  const alturaPct =
                    ponto.amount_cents > 0
                      ? Math.max(6, Math.round((ponto.amount_cents / maiorDia30d) * 100))
                      : 0;
                  const diaMes = `${ponto.date.slice(8, 10)}/${ponto.date.slice(5, 7)}`;
                  return (
                    <div
                      key={ponto.date}
                      title={`${formatarData(ponto.date)}: ${formatarReais(ponto.amount_cents)}`}
                      className="group flex h-full flex-1 flex-col items-center justify-end"
                    >
                      <div
                        className="w-full max-w-5 rounded-t bg-blue-600 transition-opacity group-hover:opacity-80"
                        style={{ height: `${alturaPct}%` }}
                      />
                      <span className="sr-only">
                        {diaMes}: {formatarReais(ponto.amount_cents)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-slate-500">
                <span>
                  {resumo.daily_received_30d[0]
                    ? formatarData(resumo.daily_received_30d[0].date)
                    : ''}
                </span>
                <span>
                  {resumo.daily_received_30d[14]
                    ? formatarData(resumo.daily_received_30d[14].date)
                    : ''}
                </span>
                <span>
                  {resumo.daily_received_30d[resumo.daily_received_30d.length - 1]
                    ? formatarData(
                        resumo.daily_received_30d[resumo.daily_received_30d.length - 1].date,
                      )
                    : ''}
                </span>
              </div>
            </section>
          )}

          {/* Tabelas operacionais: Dinheiro com técnicos e Vendas a receber */}
          <div className={`grid grid-cols-1 gap-6 ${RECEBIMENTOS_DE_CAMPO_DISPONIVEIS ? 'lg:grid-cols-2' : ''}`}>
            {/* Dinheiro com técnicos */}
            {RECEBIMENTOS_DE_CAMPO_DISPONIVEIS && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                <h2 className="text-sm font-bold text-slate-800">
                  Dinheiro com técnicos a entregar
                </h2>
                <Link
                  to="/financeiro/recebimentos"
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Conferir todos
                </Link>
              </div>

              {resumo.technician_cash_list.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-slate-400">
                  Nenhum valor em espécie pendente com os técnicos.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-2.5">Técnico</th>
                        <th className="px-3 py-2.5 text-center">OS</th>
                        <th className="px-3 py-2.5">Mais antigo</th>
                        <th className="px-4 py-2.5 text-right">Em mãos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {resumo.technician_cash_list.map((t) => (
                        <tr key={t.technician_id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-2.5 font-semibold text-slate-900">
                            {t.technician_name}
                          </td>
                          <td className="px-3 py-2.5 text-center tabular-nums">
                            {t.receipts_count}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">
                            {formatarData(t.oldest_received_at)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold tabular-nums text-amber-700">
                            {formatarReais(t.total_cash_cents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            )}

            {/* Vendas a receber (mostrando o que foi pago e "Falta R$ X" nas parciais — seção 6.0 item 6) */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                <h2 className="text-sm font-bold text-slate-800">
                  Vendas a receber ({resumo.open_sales_count})
                </h2>
                <Link
                  to="/vendas"
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Ver todas ({formatarReais(resumo.open_sales_total_cents)})
                </Link>
              </div>

              {resumo.open_sales_oldest.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-slate-400">
                  Nenhuma venda com saldo em aberto.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-2.5">Venda / Cliente</th>
                        <th className="px-3 py-2.5 text-right">Total</th>
                        <th className="px-3 py-2.5 text-right">Pago / Saldo</th>
                        <th className="px-4 py-2.5 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {resumo.open_sales_oldest.map((v) => (
                        <tr key={v.sale_id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-2.5">
                            <span className="font-bold text-slate-900">{v.sale_number}</span>
                            <span className="text-slate-400"> · {formatarData(v.created_at)}</span>
                            <p className="truncate text-slate-600">{v.customer_name}</p>
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                            {formatarReais(v.total_cents)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {v.paid_cents > 0 ? (
                              <span className="text-slate-700">
                                {formatarReais(v.paid_cents)}
                                {v.paid_methods_label ? ` (${v.paid_methods_label})` : ''}
                              </span>
                            ) : (
                              <span className="text-slate-400">Nada pago</span>
                            )}
                            <span className="block text-[11px] font-semibold text-amber-700">
                              Falta {formatarReais(v.remaining_cents)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setModalReceberOrigem({
                                  tipo: 'venda',
                                  id: v.sale_id,
                                  numero: v.sale_number,
                                  clienteNome: v.customer_name,
                                  valorSugerido: v.remaining_cents,
                                })
                              }
                              className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                            >
                              Receber
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {modalReceberOrigem && (
        <RegistrarRecebimentoModal
          origem={modalReceberOrigem}
          onClose={() => setModalReceberOrigem(null)}
          onRegistrado={() => void carregar()}
        />
      )}
    </div>
  );
}
