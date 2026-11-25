import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Lock,
  Loader2,
  RefreshCw,
  Unlock,
} from 'lucide-react';
import { ROTULO_TIPO_LANCAMENTO_CAIXA } from '../components/financeiro/cores';
import {
  abrirCaixa,
  fecharCaixa,
  listarFechamentos,
  registrarMovimentoCaixa,
  situacaoCaixa,
  useNivelFinanceiro,
} from '../components/financeiro/fonteDeDados';
import { calcularDiferencaCaixa } from '../components/financeiro/regrasFinanceiro';
import ModalDialogoVendas from '../components/vendas/ModalDialogoVendas';
import NavegacaoVendas from '../components/vendas/NavegacaoVendas';
import { useAuth } from '../contexts/useAuth';
import type { CashSession } from '../types/financeiro';
import {
  centavosParaTextoInput,
  converterTextoParaCentavos,
  formatarReais,
} from '../utils/dinheiro';
import { formatarData, formatarDataHora } from '../utils/ordens';

const INPUT =
  'mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none';

export default function FinanceiroCaixa() {
  const { profile } = useAuth();
  const atorNome = profile?.full_name || 'Jéssica Atendimento';
  const { nivel } = useNivelFinanceiro(profile);

  const [caixaAtual, setCaixaAtual] = useState<CashSession | null>(null);
  const [fechamentos, setFechamentos] = useState<CashSession[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Modais
  const [abrirModal, setAbrirModal] = useState(false);
  const [saldoInicialTexto, setSaldoInicialTexto] = useState('200,00');

  const [lancamentoTipo, setLancamentoTipo] = useState<'reforco' | 'sangria' | null>(null);
  const [lancamentoValorTexto, setLancamentoValorTexto] = useState('');
  const [lancamentoMotivo, setLancamentoMotivo] = useState('');

  const [fecharModal, setFecharModal] = useState(false);
  const [saldoContadoTexto, setSaldoContadoTexto] = useState('');
  const [justificativaDiferenca, setJustificativaDiferenca] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [atual, historico] = await Promise.all([situacaoCaixa(), listarFechamentos()]);
      setCaixaAtual(atual);
      setFechamentos(historico);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o caixa da loja.');
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
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Caixa</h1>
            <p className="mt-1 text-xs text-slate-500">
              Abertura, lançamentos em espécie e fechamento do caixa da loja.
            </p>
          </div>
          <NavegacaoVendas />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-base font-bold text-slate-800">Acesso restrito</p>
          <p className="mt-1 text-xs text-slate-500">
            Seu perfil não possui permissão para operar o caixa.
          </p>
        </div>
      </div>
    );
  }

  const handleAbrirCaixa = async (e: FormEvent) => {
    e.preventDefault();
    setErroModal(null);
    const centavos = converterTextoParaCentavos(saldoInicialTexto);
    if (centavos === null || centavos < 0) {
      setErroModal('Informe um saldo inicial válido.');
      return;
    }
    setSalvando(true);
    try {
      const novo = await abrirCaixa(centavos, atorNome);
      setCaixaAtual(novo);
      setAbrirModal(false);
    } catch (err) {
      setErroModal(err instanceof Error ? err.message : 'Erro ao abrir o caixa.');
    } finally {
      setSalvando(false);
    }
  };

  const handleRegistrarLancamento = async (e: FormEvent) => {
    e.preventDefault();
    if (!lancamentoTipo) return;
    setErroModal(null);
    const centavos = converterTextoParaCentavos(lancamentoValorTexto) ?? 0;
    if (centavos <= 0) {
      setErroModal('Informe um valor maior que zero.');
      return;
    }
    if (!lancamentoMotivo.trim()) {
      setErroModal('Informe o motivo do lançamento.');
      return;
    }
    setSalvando(true);
    try {
      const atualizado = await registrarMovimentoCaixa(
        {
          kind: lancamentoTipo,
          amount_cents: centavos,
          description: lancamentoMotivo.trim(),
        },
        atorNome,
      );
      setCaixaAtual(atualizado);
      setLancamentoTipo(null);
      setLancamentoValorTexto('');
      setLancamentoMotivo('');
    } catch (err) {
      setErroModal(err instanceof Error ? err.message : 'Erro ao registrar movimento no caixa.');
    } finally {
      setSalvando(false);
    }
  };

  const esperadoAtual = caixaAtual?.expected_balance_cents ?? 0;
  const contadoAtual = converterTextoParaCentavos(saldoContadoTexto) ?? 0;
  const diferencaFechamento = calcularDiferencaCaixa(contadoAtual, esperadoAtual);

  const handleFecharCaixa = async (e: FormEvent) => {
    e.preventDefault();
    setErroModal(null);
    const centavos = converterTextoParaCentavos(saldoContadoTexto);
    if (centavos === null || centavos < 0) {
      setErroModal('Informe o valor contado na gaveta.');
      return;
    }
    if (diferencaFechamento !== 0 && !justificativaDiferenca.trim()) {
      setErroModal('Informe a justificativa da diferença entre o contado e o esperado.');
      return;
    }
    setSalvando(true);
    try {
      await fecharCaixa(
        {
          counted_balance_cents: centavos,
          difference_reason: justificativaDiferenca.trim() || undefined,
        },
        atorNome,
      );
      setFecharModal(false);
      setJustificativaDiferenca('');
      await carregar();
    } catch (err) {
      setErroModal(err instanceof Error ? err.message : 'Erro ao fechar o caixa.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho padrão Clientes.tsx (Regra 1 do GEMINI.md) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Caixa</h1>
          <p className="mt-1 text-xs text-slate-500">
            Abertura, lançamentos em espécie e fechamento do caixa da loja.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <NavegacaoVendas />

          {caixaAtual ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setErroModal(null);
                  setLancamentoValorTexto('');
                  setLancamentoMotivo('');
                  setLancamentoTipo('reforco');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ArrowUpCircle size={15} className="text-emerald-600" />
                Reforço
              </button>

              <button
                type="button"
                onClick={() => {
                  setErroModal(null);
                  setLancamentoValorTexto('');
                  setLancamentoMotivo('');
                  setLancamentoTipo('sangria');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ArrowDownCircle size={15} className="text-red-600" />
                Retirada (sangria)
              </button>

              <button
                type="button"
                onClick={() => {
                  setErroModal(null);
                  setSaldoContadoTexto(centavosParaTextoInput(caixaAtual.expected_balance_cents));
                  setJustificativaDiferenca('');
                  setFecharModal(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Lock size={15} />
                Fechar caixa
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setErroModal(null);
                setSaldoInicialTexto('200,00');
                setAbrirModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Unlock size={15} />
              Abrir caixa
            </button>
          )}
        </div>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-slate-500">
          <Loader2 size={20} className="mr-2 animate-spin text-blue-600" />
          <span className="text-sm font-medium">Carregando caixa...</span>
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
          {/* Sessão atual do caixa (sem fileira de cartões de resumo — totais no rodapé da tabela, seção 6.0 item 2) */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-bold text-slate-800">Movimentos do caixa de hoje</h2>
                {caixaAtual ? (
                  <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                    Caixa aberto
                  </span>
                ) : (
                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                    Caixa fechado
                  </span>
                )}
              </div>

              {caixaAtual && (
                <span className="text-xs text-slate-500">
                  Aberto em {formatarDataHora(caixaAtual.opened_at)} por{' '}
                  <strong>{caixaAtual.opened_by_name}</strong>
                </span>
              )}
            </div>

            {!caixaAtual ? (
              <div className="p-10 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  O caixa da loja está fechado no momento.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Abra o caixa informando o valor contado na gaveta para registrar entradas e
                  retiradas em espécie.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-3">Data / Hora</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Origem</th>
                        <th className="px-4 py-3">Descrição</th>
                        <th className="px-4 py-3">Responsável</th>
                        <th className="px-4 py-3 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {caixaAtual.entries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                            Nenhum lançamento em espécie registrado desde a abertura.
                          </td>
                        </tr>
                      ) : (
                        caixaAtual.entries.map((lanc) => (
                          <tr key={lanc.id} className="hover:bg-slate-50/60">
                            <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                              {formatarDataHora(lanc.created_at)}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">
                              {ROTULO_TIPO_LANCAMENTO_CAIXA[lanc.kind]}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {lanc.origin_label || '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-800">{lanc.description}</td>
                            <td className="px-4 py-3 text-slate-500">{lanc.created_by_name}</td>
                            <td
                              className={`whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums ${
                                lanc.direction === 'entrada'
                                  ? 'text-emerald-700'
                                  : 'text-red-700'
                              }`}
                            >
                              {lanc.direction === 'entrada' ? '+ ' : '- '}
                              {formatarReais(lanc.amount_cents)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Rodapé único com o resumo do caixa aberto (Regra 3 do GEMINI.md) */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs text-slate-600">
                  <span>{caixaAtual.entries.length} lançamentos em espécie</span>
                  <div className="flex flex-wrap items-center gap-4">
                    <span>
                      Saldo inicial:{' '}
                      <strong className="tabular-nums text-slate-800">
                        {formatarReais(caixaAtual.opening_balance_cents)}
                      </strong>
                    </span>
                    <span>
                      Entradas:{' '}
                      <strong className="tabular-nums text-emerald-700">
                        + {formatarReais(caixaAtual.entries_in_cents)}
                      </strong>
                    </span>
                    <span>
                      Saídas:{' '}
                      <strong className="tabular-nums text-red-700">
                        - {formatarReais(caixaAtual.entries_out_cents)}
                      </strong>
                    </span>
                    <span>
                      Saldo esperado na gaveta:{' '}
                      <strong className="text-sm tabular-nums text-slate-900">
                        {formatarReais(caixaAtual.expected_balance_cents)}
                      </strong>
                    </span>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Fechamentos anteriores */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="border-b border-slate-100 px-5 py-3.5">
              <h2 className="text-sm font-bold text-slate-800">Fechamentos anteriores</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Aberto por</th>
                    <th className="px-4 py-3">Fechado por</th>
                    <th className="px-4 py-3 text-right">Inicial</th>
                    <th className="px-4 py-3 text-right">Entradas / Saídas</th>
                    <th className="px-4 py-3 text-right">Esperado</th>
                    <th className="px-4 py-3 text-right">Contado</th>
                    <th className="px-4 py-3">Diferença</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {fechamentos.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        Nenhum fechamento anterior registrado.
                      </td>
                    </tr>
                  ) : (
                    fechamentos.map((f) => {
                      const dif = f.difference_cents ?? 0;
                      return (
                        <tr key={f.id} className="hover:bg-slate-50/60">
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                            {formatarData(f.opened_date)}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{f.opened_by_name}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {f.closed_by_name || '—'}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatarReais(f.opening_balance_cents)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            <span className="text-emerald-700">
                              +{formatarReais(f.entries_in_cents)}
                            </span>{' '}
                            /{' '}
                            <span className="text-red-700">
                              -{formatarReais(f.entries_out_cents)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">
                            {formatarReais(f.expected_balance_cents)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900">
                            {formatarReais(f.counted_balance_cents ?? 0)}
                          </td>
                          <td className="px-4 py-3">
                            {dif === 0 ? (
                              <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                                Batido
                              </span>
                            ) : (
                              <div>
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                                    dif < 0
                                      ? 'border-red-100 bg-red-50 text-red-700'
                                      : 'border-amber-100 bg-amber-50 text-amber-700'
                                  }`}
                                >
                                  {dif > 0 ? `+ ${formatarReais(dif)}` : `- ${formatarReais(Math.abs(dif))}`}
                                </span>
                                {f.difference_reason && (
                                  <p className="mt-0.5 text-[11px] text-slate-500">
                                    {f.difference_reason}
                                  </p>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Modal: Abrir caixa */}
      {abrirModal && (
        <ModalDialogoVendas
          aberto
          onFechar={() => setAbrirModal(false)}
          titulo="Abrir caixa da loja"
          larguraMax="max-w-md"
        >
          <form onSubmit={(e) => void handleAbrirCaixa(e)} className="space-y-4">
            <div>
              <label htmlFor="cx-abrir-valor" className="block text-xs font-semibold text-slate-700">
                Saldo inicial contado na gaveta (R$) *
              </label>
              <input
                id="cx-abrir-valor"
                type="text"
                inputMode="decimal"
                required
                value={saldoInicialTexto}
                onChange={(e) => setSaldoInicialTexto(e.target.value)}
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
                onClick={() => setAbrirModal(false)}
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
                Confirmar abertura
              </button>
            </div>
          </form>
        </ModalDialogoVendas>
      )}

      {/* Modal: Reforço ou Retirada (sangria) */}
      {lancamentoTipo && (
        <ModalDialogoVendas
          aberto
          onFechar={() => setLancamentoTipo(null)}
          titulo={
            lancamentoTipo === 'reforco'
              ? 'Reforço de caixa (suprimento)'
              : 'Retirada de caixa (sangria)'
          }
          larguraMax="max-w-md"
        >
          <form onSubmit={(e) => void handleRegistrarLancamento(e)} className="space-y-4">
            <div>
              <label htmlFor="cx-lanc-valor" className="block text-xs font-semibold text-slate-700">
                Valor em espécie (R$) *
              </label>
              <input
                id="cx-lanc-valor"
                type="text"
                inputMode="decimal"
                required
                value={lancamentoValorTexto}
                onChange={(e) => setLancamentoValorTexto(e.target.value)}
                placeholder="0,00"
                className={INPUT}
              />
            </div>

            <div>
              <label htmlFor="cx-lanc-motivo" className="block text-xs font-semibold text-slate-700">
                Motivo / descrição *
              </label>
              <input
                id="cx-lanc-motivo"
                type="text"
                required
                value={lancamentoMotivo}
                onChange={(e) => setLancamentoMotivo(e.target.value)}
                placeholder={
                  lancamentoTipo === 'reforco'
                    ? 'Ex.: Troco trazido do banco'
                    : 'Ex.: Depósito bancário ou despesa de loja'
                }
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
                onClick={() => setLancamentoTipo(null)}
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

      {/* Modal: Fechar caixa */}
      {fecharModal && caixaAtual && (
        <ModalDialogoVendas
          aberto
          onFechar={() => setFecharModal(false)}
          titulo="Fechar caixa da loja"
          larguraMax="max-w-md"
        >
          <form onSubmit={(e) => void handleFecharCaixa(e)} className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
              <div className="flex justify-between">
                <span>Saldo inicial:</span>
                <strong className="tabular-nums">
                  {formatarReais(caixaAtual.opening_balance_cents)}
                </strong>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Entradas em espécie:</span>
                <strong className="tabular-nums text-emerald-700">
                  + {formatarReais(caixaAtual.entries_in_cents)}
                </strong>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Retiradas (sangrias):</span>
                <strong className="tabular-nums text-red-700">
                  - {formatarReais(caixaAtual.entries_out_cents)}
                </strong>
              </div>
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-sm">
                <span className="font-semibold text-slate-900">Saldo esperado:</span>
                <strong className="tabular-nums text-slate-900">
                  {formatarReais(caixaAtual.expected_balance_cents)}
                </strong>
              </div>
            </div>

            <div>
              <label htmlFor="cx-fechar-contado" className="block text-xs font-semibold text-slate-700">
                Valor contado na gaveta (R$) *
              </label>
              <input
                id="cx-fechar-contado"
                type="text"
                inputMode="decimal"
                required
                value={saldoContadoTexto}
                onChange={(e) => setSaldoContadoTexto(e.target.value)}
                className={INPUT}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs">
              <span className="font-medium text-slate-600">Diferença apurada:</span>
              <strong
                className={`tabular-nums ${
                  diferencaFechamento === 0
                    ? 'text-emerald-700'
                    : diferencaFechamento < 0
                      ? 'text-red-700'
                      : 'text-amber-700'
                }`}
              >
                {diferencaFechamento === 0
                  ? 'R$ 0,00 (Batido)'
                  : diferencaFechamento > 0
                    ? `+ ${formatarReais(diferencaFechamento)} (Sobra)`
                    : `- ${formatarReais(Math.abs(diferencaFechamento))} (Falta)`}
              </strong>
            </div>

            {diferencaFechamento !== 0 && (
              <div>
                <label
                  htmlFor="cx-fechar-justificativa"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Justificativa da diferença *
                </label>
                <textarea
                  id="cx-fechar-justificativa"
                  rows={2}
                  required
                  value={justificativaDiferenca}
                  onChange={(e) => setJustificativaDiferenca(e.target.value)}
                  placeholder="Explique o motivo da diferença para liberar o fechamento"
                  className={INPUT}
                />
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
                onClick={() => setFecharModal(false)}
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
                Encerrar caixa
              </button>
            </div>
          </form>
        </ModalDialogoVendas>
      )}
    </div>
  );
}
