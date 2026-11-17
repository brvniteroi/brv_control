import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  PlayCircle,
  Snowflake,
  UserCheck,
  X,
} from 'lucide-react';
import { listarTecnicos } from '../../services/ordens';
import type {
  PmocEnvironment,
  PmocEquipmentMonthExecution,
  PmocEquipmentTask,
  PmocGenerateOsResult,
  PmocPlan,
  PmocPlanEquipment,
} from '../../types/pmoc';
import { deCamposDataHora, formatarDataHora } from '../../utils/ordens';
import {
  buscarCronograma,
  buscarPlano,
  gerarOsDoMes,
  listarAmbientes,
  listarEquipamentosDoPlano,
  listarExecucoes,
} from './fonteDeDados';
import {
  gerarMesesDoPlano,
  hojeLocalIso,
  letraEquipamento,
  mesAtualLocal,
  tarefasPrevistasNoMes,
} from './regrasPmoc';

interface GerarOsMesPmocModalProps {
  aberto: boolean;
  planId: string;
  mesInicial?: string;
  onFechar: () => void;
  onGerada: (resultado: PmocGenerateOsResult) => void;
}

interface OpcaoTecnico {
  id: string;
  name: string;
}

const TECNICOS_FALLBACK_DEMO: readonly OpcaoTecnico[] = [
  { id: '00000000-0000-4000-8000-000000000401', name: 'Carlos Eduardo Mendes (Demo)' },
  { id: '00000000-0000-4000-8000-000000000402', name: 'Roberto Alves Rocha (Demo)' },
];

export default function GerarOsMesPmocModal({
  aberto,
  planId,
  mesInicial,
  onFechar,
  onGerada,
}: GerarOsMesPmocModalProps) {
  const idBase = useId();

  const [carregandoDados, setCarregandoDados] = useState(false);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const [plano, setPlano] = useState<PmocPlan | null>(null);
  const [ambientes, setAmbientes] = useState<PmocEnvironment[]>([]);
  const [equipamentos, setEquipamentos] = useState<PmocPlanEquipment[]>([]);
  const [tarefas, setTarefas] = useState<PmocEquipmentTask[]>([]);
  const [execucoes, setExecucoes] = useState<PmocEquipmentMonthExecution[]>([]);
  const [tecnicosAtivos, setTecnicosAtivos] = useState<OpcaoTecnico[]>([]);

  const [mesReferencia, setMesReferencia] = useState<string>(mesInicial || mesAtualLocal());
  const [tecnicoId, setTecnicoId] = useState<string>('');
  const [dataAgendada, setDataAgendada] = useState<string>(() => hojeLocalIso());
  const [horaAgendada, setHoraAgendada] = useState<string>('09:00');
  const [duracaoMinutos, setDuracaoMinutos] = useState<string>('30');
  const [duracaoEditadaManual, setDuracaoEditadaManual] = useState(false);

  const [gerando, setGerando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto || !planId) return;
    let ativo = true;

    Promise.resolve()
      .then(() => {
        if (!ativo) return null;
        setCarregandoDados(true);
        setErroCarga(null);
        setErroEnvio(null);
        setDuracaoEditadaManual(false);
        return Promise.all([
          buscarPlano(planId),
          listarAmbientes(planId),
          listarEquipamentosDoPlano(planId),
          buscarCronograma(planId),
          listarExecucoes(planId),
          listarTecnicos().catch(() => []),
        ]);
      })
      .then((res) => {
        if (!ativo || !res) return;
        const [pl, ambs, eqs, tars, execs, listaTecs] = res;
        if (!pl) {
          setErroCarga('Plano PMOC não encontrado.');
          return;
        }
        setPlano(pl);
        setAmbientes(ambs);
        setEquipamentos(eqs);
        setTarefas(tars);
        setExecucoes(execs);

        const ativos = listaTecs
          .filter((t) => t.active && t.role === 'tecnico')
          .map((t) => ({ id: t.id, name: t.name }));
        const opcoesTecs = ativos.length > 0 ? ativos : [...TECNICOS_FALLBACK_DEMO];
        setTecnicosAtivos(opcoesTecs);

        const meses = gerarMesesDoPlano(pl.start_date);
        const mesHoje = mesAtualLocal();
        const inicialValido =
          mesInicial && meses.some((m) => m.referencia === mesInicial)
            ? mesInicial
            : meses.some((m) => m.referencia === mesHoje)
              ? mesHoje
              : (meses[0]?.referencia ?? mesHoje);
        setMesReferencia(inicialValido);

        const padraoTec =
          (pl.responsible_employee_id &&
            opcoesTecs.find((t) => t.id === pl.responsible_employee_id)?.id) ||
          opcoesTecs[0]?.id ||
          '';
        setTecnicoId(padraoTec);
      })
      .catch((err) => {
        if (!ativo) return;
        setErroCarga(
          err instanceof Error ? err.message : 'Não foi possível carregar os dados do plano.',
        );
      })
      .finally(() => {
        if (ativo) setCarregandoDados(false);
      });

    return () => {
      ativo = false;
    };
  }, [aberto, planId, mesInicial]);

  const mesesDoPlano = useMemo(
    () => (plano ? gerarMesesDoPlano(plano.start_date) : []),
    [plano],
  );

  const infoMesSelecionado = useMemo(
    () => mesesDoPlano.find((m) => m.referencia === mesReferencia) ?? null,
    [mesesDoPlano, mesReferencia],
  );

  const nomeAmbientePorId = useMemo(
    () => new Map(ambientes.map((a) => [a.id, a.name])),
    [ambientes],
  );

  // Lista dos aparelhos ativos que possuem tarefas previstas neste mês
  const aparelhosDoMes = useMemo(() => {
    if (!infoMesSelecionado) return [];
    const ativos = [...equipamentos]
      .filter((e) => e.active)
      .sort((a, b) => a.sort_order - b.sort_order);

    const lista: Array<{
      equipamento: PmocPlanEquipment;
      letra: string;
      ambienteNome: string;
      qtdTarefas: number;
    }> = [];

    ativos.forEach((eq, idx) => {
      const tarefasEq = tarefas.filter((t) => t.plan_equipment_id === eq.id);
      const previstas = tarefasPrevistasNoMes(tarefasEq, infoMesSelecionado.offset);
      if (previstas.length === 0) return;
      lista.push({
        equipamento: eq,
        letra: letraEquipamento(idx),
        ambienteNome: eq.environment_id
          ? (nomeAmbientePorId.get(eq.environment_id) ?? 'Sem ambiente')
          : 'Sem ambiente',
        qtdTarefas: previstas.length,
      });
    });

    return lista;
  }, [equipamentos, infoMesSelecionado, nomeAmbientePorId, tarefas]);

  // Verifica se este mês já possui OS gerada
  const osExistenteNoMes = useMemo(() => {
    const comOs = execucoes.find(
      (x) => x.reference_month === mesReferencia && x.service_order_number != null,
    );
    if (!comOs || !comOs.service_order_number) return null;
    return {
      serviceOrderId: comOs.service_order_id,
      serviceOrderNumber: comOs.service_order_number,
      technicianName: comOs.technician_name,
      executedAt: comOs.executed_at,
    };
  }, [execucoes, mesReferencia]);

  const duracaoSugerida = Math.max(30, aparelhosDoMes.length * 30);
  const valorDuracaoExibido = duracaoEditadaManual ? duracaoMinutos : String(duracaoSugerida);

  if (!aberto) return null;

  const handleConfirmar = async (e: FormEvent) => {
    e.preventDefault();
    setErroEnvio(null);

    if (osExistenteNoMes || aparelhosDoMes.length === 0) return;

    if (!tecnicoId) {
      setErroEnvio('Escolha o técnico responsável pela visita.');
      return;
    }
    if (!dataAgendada) {
      setErroEnvio('Informe a data da visita.');
      return;
    }
    if (!horaAgendada) {
      setErroEnvio('Informe o horário de início da visita.');
      return;
    }

    const inicioIso = deCamposDataHora(dataAgendada, horaAgendada);
    if (!inicioIso) {
      setErroEnvio('Data ou hora de agendamento inválida.');
      return;
    }

    const minutos = Number.parseInt(valorDuracaoExibido, 10);
    if (!Number.isFinite(minutos) || minutos <= 0) {
      setErroEnvio('Informe uma duração prevista válida em minutos (ex.: 60).');
      return;
    }

    const tecEscolhido = tecnicosAtivos.find((t) => t.id === tecnicoId);

    setGerando(true);
    try {
      const resultado = await gerarOsDoMes(planId, mesReferencia, {
        technician_id: tecnicoId,
        technician_name: tecEscolhido?.name ?? null,
        scheduled_start: inicioIso,
        estimated_minutes: minutos,
      });
      onGerada(resultado);
    } catch (err) {
      setErroEnvio(
        err instanceof Error ? err.message : 'Não foi possível gerar a OS preventiva do mês.',
      );
    } finally {
      setGerando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${idBase}-titulo`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[1px]"
      onClick={() => {
        if (!gerando) onFechar();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brv-navy text-white">
              <CalendarCheck2 size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 id={`${idBase}-titulo`} className="text-base font-bold text-slate-900">
                Gerar OS do mês
              </h2>
              <p className="text-xs text-slate-500">
                {plano
                  ? `${plano.code} · ${plano.customer_trade_name || plano.customer_name}`
                  : 'Carregando plano...'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={gerando}
            onClick={onFechar}
            aria-label="Fechar modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Corpo */}
        <form onSubmit={handleConfirmar} noValidate className="flex-1 overflow-y-auto p-5 space-y-4">
          {carregandoDados ? (
            <div className="flex h-48 items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 size={20} className="animate-spin text-blue-600" aria-hidden="true" />
              <span>Carregando cronograma e aparelhos do mês...</span>
            </div>
          ) : erroCarga ? (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800"
            >
              {erroCarga}
            </div>
          ) : (
            <>
              {/* Seletor de mês de referência */}
              <div>
                <label
                  htmlFor={`${idBase}-mes`}
                  className="mb-1 block text-xs font-semibold text-slate-700"
                >
                  Mês de referência *
                </label>
                <select
                  id={`${idBase}-mes`}
                  value={mesReferencia}
                  onChange={(e) => {
                    setMesReferencia(e.target.value);
                    setDuracaoEditadaManual(false);
                    setErroEnvio(null);
                  }}
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  {mesesDoPlano.map((m) => (
                    <option key={m.referencia} value={m.referencia}>
                      Mês {m.offset} — {m.rotuloExtenso}
                    </option>
                  ))}
                </select>
              </div>

              {/* Caso 1: Mês já possui OS gerada */}
              {osExistenteNoMes && (
                <div
                  role="status"
                  className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-xs text-blue-950 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold text-sm text-blue-900">
                      <CheckCircle2 size={18} className="text-blue-600" aria-hidden="true" />
                      <span>OS #{osExistenteNoMes.serviceOrderNumber} já gerada para este mês</span>
                    </div>
                    <Link
                      to={
                        osExistenteNoMes.serviceOrderId
                          ? `/ordens-de-servico?os=${osExistenteNoMes.serviceOrderId}`
                          : '/ordens-de-servico'
                      }
                      onClick={onFechar}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <span>Abrir OS</span>
                      <ExternalLink size={13} aria-hidden="true" />
                    </Link>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-blue-900">
                    <span>
                      <strong>Técnico:</strong>{' '}
                      {osExistenteNoMes.technicianName || 'Definido na OS'}
                    </span>
                    {osExistenteNoMes.executedAt && (
                      <span>
                        <strong>Execução:</strong> {formatarDataHora(osExistenteNoMes.executedAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-blue-800">
                    Para alterar horário ou técnico desta visita, abra a Ordem de Serviço acima.
                  </p>
                </div>
              )}

              {/* Lista de aparelhos com tarefa no mês */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Aparelhos com tarefas no mês ({aparelhosDoMes.length})
                  </span>
                  {aparelhosDoMes.length > 0 && (
                    <span className="text-[11px] text-slate-500">
                      Sugestão: 30 min por aparelho ({duracaoSugerida} min)
                    </span>
                  )}
                </div>

                {aparelhosDoMes.length === 0 ? (
                  <div
                    role="alert"
                    className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"
                  >
                    <AlertCircle size={16} className="shrink-0 text-amber-600" aria-hidden="true" />
                    <span>
                      Nenhum equipamento deste plano possui tarefas preventivas previstas para{' '}
                      <strong>{infoMesSelecionado?.rotuloExtenso ?? mesReferencia}</strong>.
                    </span>
                  </div>
                ) : (
                  <div className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50">
                    {aparelhosDoMes.map(({ equipamento, letra, ambienteNome, qtdTarefas }) => (
                      <div
                        key={equipamento.id}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-900 text-[11px] font-bold text-white">
                            {letra}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-900">
                              {equipamento.name || 'Equipamento'} ·{' '}
                              <span className="font-mono text-slate-700">
                                {equipamento.identifier}
                              </span>
                            </div>
                            <div className="truncate text-[11px] text-slate-500">{ambienteNome}</div>
                          </div>
                        </div>

                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-800">
                          <Snowflake size={11} aria-hidden="true" />
                          {qtdTarefas} {qtdTarefas === 1 ? 'tarefa' : 'tarefas'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Campos de agendamento (só quando ainda não tem OS e há aparelhos no mês) */}
              {!osExistenteNoMes && aparelhosDoMes.length > 0 && (
                <div className="space-y-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div>
                    <label
                      htmlFor={`${idBase}-tecnico`}
                      className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700"
                    >
                      <UserCheck size={14} className="text-blue-600" aria-hidden="true" />
                      <span>Técnico responsável pela visita *</span>
                    </label>
                    <select
                      id={`${idBase}-tecnico`}
                      value={tecnicoId}
                      onChange={(e) => setTecnicoId(e.target.value)}
                      className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    >
                      <option value="">Selecione o técnico...</option>
                      {tecnicosAtivos.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label
                        htmlFor={`${idBase}-data`}
                        className="mb-1 block text-xs font-semibold text-slate-700"
                      >
                        Data da visita *
                      </label>
                      <input
                        id={`${idBase}-data`}
                        type="date"
                        value={dataAgendada}
                        onChange={(e) => setDataAgendada(e.target.value)}
                        className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`${idBase}-hora`}
                        className="mb-1 block text-xs font-semibold text-slate-700"
                      >
                        Hora de início *
                      </label>
                      <input
                        id={`${idBase}-hora`}
                        type="time"
                        value={horaAgendada}
                        onChange={(e) => setHoraAgendada(e.target.value)}
                        className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`${idBase}-duracao`}
                        className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700"
                      >
                        <Clock size={13} className="text-slate-500" aria-hidden="true" />
                        <span>Duração prevista (min) *</span>
                      </label>
                      <input
                        id={`${idBase}-duracao`}
                        type="number"
                        min={10}
                        step={5}
                        value={valorDuracaoExibido}
                        onChange={(e) => {
                          setDuracaoEditadaManual(true);
                          setDuracaoMinutos(e.target.value);
                        }}
                        className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {erroEnvio && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
                >
                  <AlertCircle size={15} className="shrink-0 text-rose-600" aria-hidden="true" />
                  <span>{erroEnvio}</span>
                </div>
              )}
            </>
          )}

          {/* Rodapé */}
          <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={gerando}
              onClick={onFechar}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Fechar
            </button>

            {!osExistenteNoMes && (
              <button
                type="submit"
                disabled={
                  carregandoDados ||
                  Boolean(erroCarga) ||
                  aparelhosDoMes.length === 0 ||
                  gerando
                }
                className="inline-flex items-center gap-2 rounded-xl bg-brv-navy px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {gerando ? (
                  <>
                    <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                    <span>Gerando...</span>
                  </>
                ) : (
                  <>
                    <PlayCircle size={15} aria-hidden="true" />
                    <span>Gerar OS e agendar</span>
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

