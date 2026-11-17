import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CalendarCheck2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  MessageCircle,
  PlayCircle,
  Snowflake,
  UserCheck,
} from 'lucide-react';
import { prepararJanelaWhatsApp } from '../placas/regrasPlacas';
import GerarOsMesPmocModal from './GerarOsMesPmocModal';
import RelatorioExecucaoPmoc from './RelatorioExecucaoPmoc';
import { gerarLinkRelatorio, resumoDoMes } from './fonteDeDados';
import {
  ESTILOS_SITUACAO_MES_PMOC,
  formatarEnderecoResumo,
  formatarMesReferencia,
  mesAtualLocal,
  montarLinkWhatsAppPmoc,
  textoWhatsAppRelatorioPmoc,
} from './regrasPmoc';
import type {
  PmocGenerateOsResult,
  PmocMonthPlanItem,
  PmocMonthPlanStatus,
  PmocMonthSummary,
} from '../../types/pmoc';
import { formatarDataHora } from '../../utils/ordens';

function deslocarMesReferencia(referencia: string, deltaMeses: number): string {
  const [anoStr, mesStr] = referencia.split('-');
  const ano = Number(anoStr);
  const mesZero = Number(mesStr) - 1;
  if (Number.isNaN(ano) || Number.isNaN(mesZero)) return mesAtualLocal();
  const data = new Date(ano, mesZero + deltaMeses, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

export default function PainelPmocDoMes() {
  const navigate = useNavigate();
  const [mesSelecionado, setMesSelecionado] = useState<string>(() => mesAtualLocal());
  const [filtroSituacao, setFiltroSituacao] = useState<'todos' | PmocMonthPlanStatus>('todos');

  const [resumo, setResumo] = useState<PmocMonthSummary | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [planoGerarOsId, setPlanoGerarOsId] = useState<string | null>(null);
  const [relatorioAberto, setRelatorioAberto] = useState<{
    planId: string;
    mes: string;
  } | null>(null);

  const [avisoOperacao, setAvisoOperacao] = useState<string | null>(null);
  const [enviandoWhatsId, setEnviandoWhatsId] = useState<string | null>(null);
  const [copiandoId, setCopiandoId] = useState<string | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  const carregarResumo = useCallback(async (mesAlvo: string) => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await resumoDoMes(mesAlvo);
      setResumo(dados);
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar o painel do PMOC do mês.',
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    Promise.resolve()
      .then(() => {
        if (!ativo) return null;
        setCarregando(true);
        setErro(null);
        return resumoDoMes(mesSelecionado);
      })
      .then((dados) => {
        if (ativo && dados) setResumo(dados);
      })
      .catch((err) => {
        if (!ativo) return;
        setErro(
          err instanceof Error
            ? err.message
            : 'Não foi possível carregar o painel do PMOC do mês.',
        );
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [mesSelecionado]);

  const itensFiltrados = useMemo(() => {
    if (!resumo) return [];
    if (filtroSituacao === 'todos') return resumo.items;
    return resumo.items.filter((i) => i.status === filtroSituacao);
  }, [filtroSituacao, resumo]);

  const handleOsGerada = async (resultado: PmocGenerateOsResult) => {
    setPlanoGerarOsId(null);
    setAvisoOperacao(resultado.message);
    await carregarResumo(mesSelecionado);
  };

  const handleEnviarWhatsApp = async (item: PmocMonthPlanItem) => {
    if (enviandoWhatsId) return;
    const janela = prepararJanelaWhatsApp();
    setEnviandoWhatsId(item.plan_id);
    try {
      const { url } = await gerarLinkRelatorio(item.plan_id, item.reference_month);
      const nomeCliente = item.customer_trade_name || item.customer_name;
      const mensagem = textoWhatsAppRelatorioPmoc(nomeCliente, item.reference_month, url);
      janela.ir(montarLinkWhatsAppPmoc(item.customer_phone, mensagem));
    } catch (err) {
      janela.cancelar();
      setErro(
        err instanceof Error
          ? err.message
          : 'Não foi possível gerar o link do relatório para envio no WhatsApp.',
      );
    } finally {
      setEnviandoWhatsId(null);
    }
  };

  const handleCopiarLink = async (item: PmocMonthPlanItem) => {
    if (copiandoId) return;
    setCopiandoId(item.plan_id);
    try {
      const { url } = await gerarLinkRelatorio(item.plan_id, item.reference_month);
      await navigator.clipboard.writeText(url);
      setCopiadoId(item.plan_id);
      setTimeout(() => setCopiadoId((atual) => (atual === item.plan_id ? null : atual)), 2500);
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : 'Não foi possível copiar o link do relatório.',
      );
    } finally {
      setCopiandoId(null);
    }
  };

  const alternarFiltroCard = (alvo: PmocMonthPlanStatus) => {
    setFiltroSituacao((atual) => (atual === alvo ? 'todos' : alvo));
  };

  const contagens = resumo?.counts ?? {
    sem_os: 0,
    os_agendada: 0,
    executada: 0,
    atrasada: 0,
  };

  return (
    <div className="space-y-5">
      {/* Barra do seletor de mês */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Visitas preventivas de {formatarMesReferencia(mesSelecionado)}
          </h2>
          <p className="text-xs text-slate-500">
            Acompanhe quais planos vigentes já têm OS agendada, execução concluída ou pendência no mês.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMesSelecionado((m) => deslocarMesReferencia(m, -1))}
            aria-label="Mês anterior"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>

          <label htmlFor="pmoc-painel-mes-input" className="sr-only">
            Mês de referência
          </label>
          <input
            id="pmoc-painel-mes-input"
            type="month"
            value={mesSelecionado}
            onChange={(e) => {
              if (e.target.value) setMesSelecionado(e.target.value);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
          />

          <button
            type="button"
            onClick={() => setMesSelecionado((m) => deslocarMesReferencia(m, 1))}
            aria-label="Próximo mês"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>

          {mesSelecionado !== mesAtualLocal() && (
            <button
              type="button"
              onClick={() => setMesSelecionado(mesAtualLocal())}
              className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              Mês atual
            </button>
          )}
        </div>
      </div>

      {/* 4 Cartões de resumo no topo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => alternarFiltroCard('sem_os')}
          className={`flex items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-xs transition ${
            filtroSituacao === 'sem_os'
              ? 'border-amber-400 ring-1 ring-amber-400'
              : 'border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Clock size={20} aria-hidden="true" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Sem OS</div>
            <div className="mt-0.5 text-2xl font-bold text-amber-700">{contagens.sem_os}</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => alternarFiltroCard('os_agendada')}
          className={`flex items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-xs transition ${
            filtroSituacao === 'os_agendada'
              ? 'border-blue-500 ring-1 ring-blue-500'
              : 'border-slate-200 hover:border-blue-300'
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <CalendarClock size={20} aria-hidden="true" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">OS agendada</div>
            <div className="mt-0.5 text-2xl font-bold text-blue-700">{contagens.os_agendada}</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => alternarFiltroCard('executada')}
          className={`flex items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-xs transition ${
            filtroSituacao === 'executada'
              ? 'border-emerald-500 ring-1 ring-emerald-500'
              : 'border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={20} aria-hidden="true" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Executada</div>
            <div className="mt-0.5 text-2xl font-bold text-emerald-700">{contagens.executada}</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => alternarFiltroCard('atrasada')}
          className={`flex items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-xs transition ${
            filtroSituacao === 'atrasada'
              ? 'border-rose-500 ring-1 ring-rose-500'
              : 'border-slate-200 hover:border-rose-300'
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <AlertTriangle size={20} aria-hidden="true" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Atrasada</div>
            <div className="mt-0.5 text-2xl font-bold text-rose-600">{contagens.atrasada}</div>
          </div>
        </button>
      </div>

      {avisoOperacao && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900"
        >
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600" aria-hidden="true" />
            {avisoOperacao}
          </span>
          <button
            type="button"
            onClick={() => setAvisoOperacao(null)}
            className="font-semibold text-emerald-800 hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Lista / Estados */}
      {erro ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-600" aria-hidden="true" />
            <span>{erro}</span>
          </div>
          <button
            type="button"
            onClick={() => void carregarResumo(mesSelecionado)}
            className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 font-semibold text-rose-700 hover:bg-rose-100"
          >
            Tentar de novo
          </button>
        </div>
      ) : carregando ? (
        <div className="flex h-60 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <Loader2 size={24} className="animate-spin text-blue-600" aria-hidden="true" />
            <span className="text-xs font-medium">Consultando visitas previstas do mês...</span>
          </div>
        </div>
      ) : itensFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <CalendarCheck2 size={24} aria-hidden="true" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-800">
            {filtroSituacao !== 'todos'
              ? 'Nenhum plano nesta situação no mês selecionado'
              : 'Nenhum plano vigente com visita prevista neste mês'}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            {filtroSituacao !== 'todos'
              ? 'Clique novamente no cartão acima para mostrar todas as situações do mês.'
              : 'Troque o mês de referência ou verifique a vigência dos contratos na aba Planos.'}
          </p>
          {filtroSituacao !== 'todos' && (
            <button
              type="button"
              onClick={() => setFiltroSituacao('todos')}
              className="mt-4 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Mostrar todos do mês
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {itensFiltrados.map((item) => {
            const estilo = ESTILOS_SITUACAO_MES_PMOC[item.status];
            return (
              <div
                key={item.plan_id}
                className="flex flex-col gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${estilo.classeSelo}`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${estilo.classePonto}`}
                        aria-hidden="true"
                      />
                      {estilo.rotulo}
                    </span>

                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                      {item.plan_code}
                    </span>

                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
                      <Snowflake size={13} className="text-blue-600" aria-hidden="true" />
                      {item.equipment_count_in_month}{' '}
                      {item.equipment_count_in_month === 1 ? 'aparelho' : 'aparelhos'} (
                      {item.task_count_in_month} tar.)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => navigate(`/pmoc/${item.plan_id}`)}
                      className="truncate text-left text-sm font-bold text-slate-900 hover:text-blue-700 hover:underline"
                    >
                      {item.customer_name}
                      {item.customer_trade_name ? ` (${item.customer_trade_name})` : ''}
                    </button>
                  </div>

                  <p className="text-xs text-slate-500">
                    {formatarEnderecoResumo(item.address_snapshot)}
                  </p>

                  {/* Detalhes de OS, técnico, agendamento ou execução */}
                  {(item.service_order_number || item.technician_name || item.accompanied_by) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-slate-700">
                      {item.service_order_number && (
                        <Link
                          to={
                            item.service_order_id
                              ? `/ordens-de-servico?os=${item.service_order_id}`
                              : '/ordens-de-servico'
                          }
                          className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
                        >
                          <span>OS #{item.service_order_number}</span>
                          <ExternalLink size={12} aria-hidden="true" />
                        </Link>
                      )}
                      {item.technician_name && (
                        <span className="inline-flex items-center gap-1">
                          <UserCheck size={13} className="text-slate-400" aria-hidden="true" />
                          {item.technician_name}
                        </span>
                      )}
                      {item.status === 'os_agendada' && item.scheduled_start && (
                        <span className="text-slate-600">
                          Agendada: <strong>{formatarDataHora(item.scheduled_start)}</strong>
                        </span>
                      )}
                      {item.status === 'executada' && item.executed_at && (
                        <span className="text-emerald-800">
                          Concluída em <strong>{formatarDataHora(item.executed_at)}</strong>
                        </span>
                      )}
                      {item.accompanied_by && (
                        <span className="text-slate-600">
                          Acompanhada por: <strong>{item.accompanied_by}</strong>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Botões de ação conforme a situação */}
                <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                  {(item.status === 'sem_os' ||
                    (item.status === 'atrasada' && !item.service_order_number)) && (
                    <button
                      type="button"
                      onClick={() => setPlanoGerarOsId(item.plan_id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brv-navy px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800"
                    >
                      <PlayCircle size={15} aria-hidden="true" />
                      <span>Gerar OS do mês</span>
                    </button>
                  )}

                  {item.status === 'executada' && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setRelatorioAberto({
                            planId: item.plan_id,
                            mes: item.reference_month,
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <FileSpreadsheet size={15} aria-hidden="true" />
                        <span>Relatório do mês</span>
                      </button>

                      <button
                        type="button"
                        disabled={enviandoWhatsId === item.plan_id}
                        onClick={() => void handleEnviarWhatsApp(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {enviandoWhatsId === item.plan_id ? (
                          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <MessageCircle size={14} aria-hidden="true" />
                        )}
                        <span>Enviar relatório pelo WhatsApp</span>
                      </button>

                      <button
                        type="button"
                        disabled={copiandoId === item.plan_id}
                        onClick={() => void handleCopiarLink(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {copiandoId === item.plan_id ? (
                          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        ) : copiadoId === item.plan_id ? (
                          <Check size={14} className="text-emerald-600" aria-hidden="true" />
                        ) : (
                          <Copy size={14} aria-hidden="true" />
                        )}
                        <span>{copiadoId === item.plan_id ? 'Link copiado' : 'Copiar link'}</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => navigate(`/pmoc/${item.plan_id}`)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                  >
                    Abrir plano
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Gerar OS do mês */}
      <GerarOsMesPmocModal
        aberto={Boolean(planoGerarOsId)}
        planId={planoGerarOsId ?? ''}
        mesInicial={mesSelecionado}
        onFechar={() => setPlanoGerarOsId(null)}
        onGerada={(res) => void handleOsGerada(res)}
      />

      {/* Modal: Relatório Mensal */}
      {relatorioAberto && (
        <RelatorioExecucaoPmoc
          planId={relatorioAberto.planId}
          referenceMonth={relatorioAberto.mes}
          onFechar={() => setRelatorioAberto(null)}
        />
      )}
    </div>
  );
}

