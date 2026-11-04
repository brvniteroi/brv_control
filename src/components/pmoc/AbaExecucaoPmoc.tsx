import { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  Gauge,
  Loader2,
  PlayCircle,
  UserCheck,
  X,
} from 'lucide-react';
import RelatorioExecucaoPmoc from './RelatorioExecucaoPmoc';
import { gerarOsDoMes } from './fonteDeDados';
import {
  CAMPOS_MEDICAO_PMOC,
  ESTILOS_CELULA_EXECUCAO,
  calcularEstadoCelulaExecucao,
  formatarBtus,
  formatarMedicao,
  gerarMesesDoPlano,
  letraEquipamento,
  mesAtualLocal,
  rotuloPeriodicidade,
  tarefasPrevistasNoMes,
} from './regrasPmoc';
import type {
  PmocEnvironment,
  PmocEquipmentMonthExecution,
  PmocEquipmentTask,
  PmocPlanEquipment,
  PmocTaskResultStatus,
  PmocVisitCellStatus,
} from '../../types/pmoc';
import { formatarDataHora } from '../../utils/ordens';

interface AbaExecucaoPmocProps {
  planId: string;
  ehNovo: boolean;
  temAlteracoesNaoSalvas: boolean;
  startDate: string;
  ambientes: PmocEnvironment[];
  equipamentos: PmocPlanEquipment[];
  tarefas: PmocEquipmentTask[];
  execucoes: PmocEquipmentMonthExecution[];
  onRecarregarExecucoes: () => Promise<void>;
}

interface CelulaSelecionada {
  planEquipmentId: string;
  referenciaMes: string;
}

const SELO_RESULTADO_TAREFA: Record<
  PmocTaskResultStatus,
  { rotulo: string; classe: string }
> = {
  feito: {
    rotulo: 'Feito',
    classe: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  nao_feito: {
    rotulo: 'Não feito',
    classe: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  nao_se_aplica: {
    rotulo: 'Não se aplica',
    classe: 'border-slate-200 bg-slate-100 text-slate-600',
  },
};

export default function AbaExecucaoPmoc({
  planId,
  ehNovo,
  temAlteracoesNaoSalvas,
  startDate,
  ambientes,
  equipamentos,
  tarefas,
  execucoes,
  onRecarregarExecucoes,
}: AbaExecucaoPmocProps) {
  const mesesDoPlano = useMemo(() => gerarMesesDoPlano(startDate), [startDate]);
  const mesHoje = useMemo(() => mesAtualLocal(), []);

  const [mesEscolhido, setMesEscolhido] = useState<string>(mesHoje);
  const [celulaAberta, setCelulaAberta] = useState<CelulaSelecionada | null>(null);
  const [gerandoOs, setGerandoOs] = useState(false);
  const [avisoGeracao, setAvisoGeracao] = useState<{
    tipo: 'sucesso' | 'info' | 'erro';
    texto: string;
    mesReferencia?: string;
  } | null>(null);
  const [mesRelatorioModal, setMesRelatorioModal] = useState<string | null>(null);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  // Garante que o mês selecionado para gerar OS sempre pertença à janela atual de 12 meses
  const mesReferenciaOs = useMemo(() => {
    if (mesesDoPlano.some((m) => m.referencia === mesEscolhido)) {
      return mesEscolhido;
    }
    const atualNaVigencia = mesesDoPlano.find((m) => m.referencia === mesHoje);
    return atualNaVigencia?.referencia ?? mesesDoPlano[0]?.referencia ?? '';
  }, [mesEscolhido, mesHoje, mesesDoPlano]);

  const ambientePorId = useMemo(
    () => new Map(ambientes.map((a) => [a.id, a.name])),
    [ambientes],
  );

  const equipamentosAtivos = useMemo(
    () => [...equipamentos].filter((e) => e.active).sort((a, b) => a.sort_order - b.sort_order),
    [equipamentos],
  );

  const execucaoPorChave = useMemo(() => {
    const mapa = new Map<string, PmocEquipmentMonthExecution>();
    for (const ex of execucoes) {
      mapa.set(`${ex.plan_equipment_id}::${ex.reference_month}`, ex);
    }
    return mapa;
  }, [execucoes]);

  const tarefasPorEquipamento = useMemo(() => {
    const mapa = new Map<string, PmocEquipmentTask[]>();
    for (const t of tarefas) {
      const lista = mapa.get(t.plan_equipment_id) ?? [];
      lista.push(t);
      mapa.set(t.plan_equipment_id, lista);
    }
    return mapa;
  }, [tarefas]);

  // Contadores gerais da grade para legenda rápida
  const resumoGrade = useMemo(() => {
    const contagem: Record<PmocVisitCellStatus, number> = {
      concluida: 0,
      prevista: 0,
      atrasada: 0,
      nao_se_aplica: 0,
    };

    for (const eq of equipamentosAtivos) {
      const listaTarefas = tarefasPorEquipamento.get(eq.id) ?? [];
      for (const mes of mesesDoPlano) {
        const qtd = tarefasPrevistasNoMes(listaTarefas, mes.offset).length;
        const exec = execucaoPorChave.get(`${eq.id}::${mes.referencia}`);
        const estado = calcularEstadoCelulaExecucao(qtd, exec, mes.referencia, mesHoje);
        contagem[estado] += 1;
      }
    }

    return contagem;
  }, [equipamentosAtivos, execucaoPorChave, mesHoje, mesesDoPlano, tarefasPorEquipamento]);

  const dispararGeracaoOs = async (referenciaAlvo: string) => {
    if (ehNovo || !referenciaAlvo || gerandoOs) return;
    setGerandoOs(true);
    setAvisoGeracao(null);
    try {
      const resultado = await gerarOsDoMes(planId, referenciaAlvo);
      await onRecarregarExecucoes();
      setAvisoGeracao({
        tipo: resultado.already_existed ? 'info' : 'sucesso',
        texto: resultado.message,
        mesReferencia: resultado.reference_month,
      });
    } catch (e) {
      setAvisoGeracao({
        tipo: 'erro',
        texto: e instanceof Error ? e.message : 'Não foi possível gerar a OS preventiva do mês.',
      });
    } finally {
      setGerandoOs(false);
    }
  };

  // Resolve dados completos do painel de detalhes quando uma célula está selecionada
  const detalhesCelula = useMemo(() => {
    if (!celulaAberta) return null;
    const indiceEq = equipamentosAtivos.findIndex((e) => e.id === celulaAberta.planEquipmentId);
    if (indiceEq < 0) return null;
    const eq = equipamentosAtivos[indiceEq];
    const infoMes = mesesDoPlano.find((m) => m.referencia === celulaAberta.referenciaMes);
    if (!infoMes) return null;

    const listaTarefas = tarefasPorEquipamento.get(eq.id) ?? [];
    const previstas = tarefasPrevistasNoMes(listaTarefas, infoMes.offset);
    const exec = execucaoPorChave.get(`${eq.id}::${infoMes.referencia}`);
    const estado = calcularEstadoCelulaExecucao(
      previstas.length,
      exec,
      infoMes.referencia,
      mesHoje,
    );

    const resultadoPorTarefaId = new Map(
      (exec?.task_results ?? []).map((r) => [r.equipment_task_id, r]),
    );

    return {
      equipamento: eq,
      letra: letraEquipamento(indiceEq),
      ambienteNome: eq.environment_id ? (ambientePorId.get(eq.environment_id) ?? null) : null,
      mes: infoMes,
      previstas,
      execucao: exec,
      estado,
      resultadoPorTarefaId,
    };
  }, [
    ambientePorId,
    celulaAberta,
    equipamentosAtivos,
    execucaoPorChave,
    mesHoje,
    mesesDoPlano,
    tarefasPorEquipamento,
  ]);

  if (equipamentosAtivos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
        <CalendarCheck2 size={36} className="mx-auto text-slate-300" aria-hidden="true" />
        <h3 className="mt-3 text-sm font-semibold text-slate-800">
          Nenhum equipamento ativo para acompanhar execuções
        </h3>
        <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
          Adicione ao menos um equipamento na aba Equipamentos e configure o cronograma para
          visualizar a grade anual de visitas preventivas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Avisos de rascunho não salvo */}
      {ehNovo && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="font-semibold">Plano ainda não salvo</p>
            <p className="mt-0.5 text-amber-800">
              Você já pode conferir abaixo os meses previstos conforme o cronograma. Salve o plano
              primeiro para liberar a geração de OS do mês e o relatório mensal imprimível.
            </p>
          </div>
        </div>
      )}

      {!ehNovo && temAlteracoesNaoSalvas && (
        <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-sky-600" aria-hidden="true" />
          <p>
            Existem alterações não salvas neste plano. Salve antes de gerar a OS do mês ou imprimir
            o relatório para refletir os equipamentos e tarefas mais recentes.
          </p>
        </div>
      )}

      {/* Barra superior: ação Gerar OS do mês + acesso rápido ao relatório mensal */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Acompanhamento anual de execução
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Clique em qualquer célula da grade para consultar a OS vinculada, medições e tarefas
              previstas do equipamento naquele mês.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
            <div className="sm:w-52">
              <label
                htmlFor="pmoc-execucao-mes"
                className="block text-xs font-medium text-slate-700"
              >
                Mês de referência
              </label>
              <select
                id="pmoc-execucao-mes"
                value={mesReferenciaOs}
                onChange={(e) => setMesEscolhido(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                {mesesDoPlano.map((m) => (
                  <option key={m.referencia} value={m.referencia}>
                    Mês {m.offset} — {m.rotuloExtenso}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={ehNovo || gerandoOs || !mesReferenciaOs}
                onClick={() => void dispararGeracaoOs(mesReferenciaOs)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brv-navy px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-brv-navy-light focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {gerandoOs ? (
                  <>
                    <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                    Gerando OS...
                  </>
                ) : (
                  <>
                    <PlayCircle size={15} aria-hidden="true" />
                    Gerar OS do mês
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={ehNovo || !mesReferenciaOs}
                onClick={() => setMesRelatorioModal(mesReferenciaOs)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileSpreadsheet size={15} aria-hidden="true" />
                Relatório do mês
              </button>
            </div>
          </div>
        </div>

        {/* Retorno da ação "Gerar OS do mês" */}
        {avisoGeracao && (
          <div
            role="status"
            className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs ${
              avisoGeracao.tipo === 'sucesso'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : avisoGeracao.tipo === 'info'
                  ? 'border-blue-200 bg-blue-50 text-blue-900'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {avisoGeracao.tipo === 'erro' ? (
                <AlertCircle size={15} className="shrink-0" aria-hidden="true" />
              ) : (
                <CheckCircle2 size={15} className="shrink-0" aria-hidden="true" />
              )}
              <span className="font-medium">{avisoGeracao.texto}</span>
            </div>
            <div className="flex items-center gap-2">
              {avisoGeracao.mesReferencia && !ehNovo && (
                <button
                  type="button"
                  onClick={() => setMesRelatorioModal(avisoGeracao.mesReferencia ?? null)}
                  className="font-semibold underline hover:no-underline"
                >
                  Ver relatório
                </button>
              )}
              <button
                type="button"
                onClick={() => setAvisoGeracao(null)}
                aria-label="Fechar aviso"
                className="rounded p-0.5 hover:bg-black/5"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* Legenda de estados */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3.5 text-xs">
          <span className="font-medium text-slate-500">Legenda:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            Concluída ({resumoGrade.concluida})
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 font-medium text-blue-700">
            <span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />
            Prevista ({resumoGrade.prevista})
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 font-medium text-rose-700">
            <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" />
            Atrasada ({resumoGrade.atrasada})
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">
            <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />
            Não se aplica ({resumoGrade.nao_se_aplica})
          </span>
        </div>
      </div>

      {/* Grade equipamentos x 12 meses */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div
          role="region"
          aria-label="Grade de execução mensal por equipamento"
          tabIndex={0}
          className="overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <table className="w-full min-w-[1040px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th scope="col" className="w-64 px-3.5 py-3 font-semibold">
                  Equipamento
                </th>
                {mesesDoPlano.map((mes) => {
                  const ehAtual = mes.referencia === mesHoje;
                  return (
                    <th
                      key={mes.referencia}
                      scope="col"
                      className={`px-1.5 py-2.5 text-center font-semibold ${
                        ehAtual ? 'bg-blue-50/70 text-blue-900' : ''
                      }`}
                    >
                      <div>{mes.rotuloCurto}</div>
                      <div className="text-[10px] font-normal text-slate-400">
                        M{mes.offset}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {equipamentosAtivos.map((eq, idx) => {
                const letra = letraEquipamento(idx);
                const listaTarefas = tarefasPorEquipamento.get(eq.id) ?? [];
                const nomeAmbiente = eq.environment_id
                  ? (ambientePorId.get(eq.environment_id) ?? 'Ambiente removido')
                  : 'Sem ambiente';

                return (
                  <tr key={eq.id} className="hover:bg-slate-50/50">
                    <th scope="row" className="px-3.5 py-3 align-middle font-normal">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-900 text-[11px] font-bold text-white">
                          {letra}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">
                            {eq.name || 'Sem nome'}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                            <span className="font-mono font-medium text-slate-700">
                              {eq.identifier || '—'}
                            </span>
                            <span>·</span>
                            <span className="truncate">{nomeAmbiente}</span>
                          </div>
                        </div>
                      </div>
                    </th>

                    {mesesDoPlano.map((mes) => {
                      const previstas = tarefasPrevistasNoMes(listaTarefas, mes.offset);
                      const exec = execucaoPorChave.get(`${eq.id}::${mes.referencia}`);
                      const estado = calcularEstadoCelulaExecucao(
                        previstas.length,
                        exec,
                        mes.referencia,
                        mesHoje,
                      );
                      const visual = ESTILOS_CELULA_EXECUCAO[estado];
                      const selecionada =
                        celulaAberta?.planEquipmentId === eq.id &&
                        celulaAberta?.referenciaMes === mes.referencia;

                      return (
                        <td
                          key={mes.referencia}
                          className={`p-1.5 text-center align-middle ${
                            mes.referencia === mesHoje ? 'bg-blue-50/30' : ''
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setCelulaAberta(
                                selecionada
                                  ? null
                                  : { planEquipmentId: eq.id, referenciaMes: mes.referencia },
                              )
                            }
                            aria-pressed={selecionada}
                            aria-label={`${eq.name || eq.identifier}, ${mes.rotuloExtenso}: ${visual.rotulo}`}
                            className={`flex w-full min-w-[68px] flex-col items-center justify-center rounded-lg border px-1.5 py-1.5 text-center transition-all focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${visual.classe} ${
                              selecionada ? 'ring-2 ring-slate-900 ring-offset-1' : ''
                            }`}
                          >
                            <span className="text-[11px] leading-tight font-semibold">
                              {visual.rotuloCurto}
                            </span>
                            <span className="mt-0.5 text-[10px] opacity-80">
                              {exec?.service_order_number
                                ? `OS #${exec.service_order_number}`
                                : previstas.length > 0
                                  ? `${previstas.length} tar.`
                                  : '—'}
                            </span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Painel detalhado da célula clicada */}
      {detalhesCelula && (
        <section
          aria-label="Detalhes da visita mensal do equipamento"
          className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white">
                  {detalhesCelula.letra}
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  {detalhesCelula.equipamento.name || 'Equipamento'} ·{' '}
                  <span className="font-mono text-sm font-semibold text-slate-700">
                    {detalhesCelula.equipamento.identifier}
                  </span>
                </h3>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    ESTILOS_CELULA_EXECUCAO[detalhesCelula.estado].classe
                  }`}
                >
                  {ESTILOS_CELULA_EXECUCAO[detalhesCelula.estado].rotulo}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                <strong>{detalhesCelula.mes.rotuloExtenso}</strong> (Mês {detalhesCelula.mes.offset}
                ) · {detalhesCelula.ambienteNome ?? 'Sem ambiente definido'} ·{' '}
                {detalhesCelula.equipamento.equipment_type} ·{' '}
                {formatarBtus(detalhesCelula.equipamento.capacity_btu)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!ehNovo && (
                <button
                  type="button"
                  onClick={() => setMesRelatorioModal(detalhesCelula.mes.referencia)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                >
                  <FileSpreadsheet size={15} aria-hidden="true" />
                  Ver relatório
                </button>
              )}
              <button
                type="button"
                onClick={() => setCelulaAberta(null)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <X size={14} aria-hidden="true" />
                Fechar
              </button>
            </div>
          </div>

          {/* Resumo da OS vinculada */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <ClipboardList size={14} aria-hidden="true" />
                Ordem de Serviço ligada
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {detalhesCelula.execucao?.service_order_number ? (
                  `OS #${detalhesCelula.execucao.service_order_number}`
                ) : (
                  <span className="text-slate-500">Nenhuma OS vinculada</span>
                )}
              </div>
              {!detalhesCelula.execucao?.service_order_number &&
                detalhesCelula.previstas.length > 0 &&
                !ehNovo && (
                  <button
                    type="button"
                    disabled={gerandoOs}
                    onClick={() => void dispararGeracaoOs(detalhesCelula.mes.referencia)}
                    className="mt-1.5 text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50"
                  >
                    Gerar OS deste mês agora
                  </button>
                )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <UserCheck size={14} aria-hidden="true" />
                Técnico responsável pela visita
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {detalhesCelula.execucao?.technician_name || 'Não atribuído'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <Clock size={14} aria-hidden="true" />
                Data da execução
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {detalhesCelula.execucao?.executed_at
                  ? formatarDataHora(detalhesCelula.execucao.executed_at)
                  : 'Aguardando realização'}
              </div>
            </div>
          </div>

          {/* Alerta caso não tenha sido atendido na visita */}
          {detalhesCelula.execucao?.status === 'nao_atendido' && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900">
              <p className="font-semibold">Equipamento não atendido na visita do mês</p>
              <p className="mt-0.5">
                Motivo registrado:{' '}
                <strong>
                  {detalhesCelula.execucao.unattended_reason || 'Motivo não informado.'}
                </strong>
              </p>
            </div>
          )}

          {/* Medições aferidas quando existentes */}
          {detalhesCelula.execucao &&
            CAMPOS_MEDICAO_PMOC.some(
              (c) => detalhesCelula.execucao?.measurements[c.chave] !== null,
            ) && (
              <div className="mt-4 rounded-xl border border-slate-200 p-3.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <Gauge size={14} className="text-blue-600" aria-hidden="true" />
                  Medições registradas em campo
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {CAMPOS_MEDICAO_PMOC.map((campo) => (
                    <div
                      key={campo.chave}
                      className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      <div className="text-[11px] text-slate-500">{campo.rotuloCurto}</div>
                      <div className="mt-0.5 text-sm font-bold text-slate-900">
                        {formatarMedicao(
                          detalhesCelula.execucao?.measurements[campo.chave],
                          campo.unidade,
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Observações e fotos da visita */}
          {(detalhesCelula.execucao?.technician_notes ||
            (detalhesCelula.execucao?.photo_urls.length ?? 0) > 0) && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {detalhesCelula.execucao?.technician_notes && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs">
                  <div className="font-semibold text-slate-700">Observações do técnico</div>
                  <p className="mt-1 text-slate-600">
                    {detalhesCelula.execucao.technician_notes}
                  </p>
                </div>
              )}

              {(detalhesCelula.execucao?.photo_urls.length ?? 0) > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs">
                  <div className="font-semibold text-slate-700">Fotos da manutenção</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detalhesCelula.execucao?.photo_urls.map((url, i) => (
                      <button
                        key={`${url}-${i}`}
                        type="button"
                        onClick={() => setFotoAmpliada(url)}
                        className="overflow-hidden rounded-lg border border-slate-200 bg-white transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                      >
                        <img
                          src={url}
                          alt={`Foto ${i + 1} da manutenção`}
                          className="h-14 w-20 object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Lista de tarefas previstas no mês */}
          <div className="mt-4">
            <h4 className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
              Tarefas do cronograma neste mês ({detalhesCelula.previstas.length})
            </h4>

            {detalhesCelula.previstas.length === 0 ? (
              <p className="mt-2 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3 text-xs text-slate-500">
                Nenhuma tarefa preventiva recai sobre este equipamento em{' '}
                {detalhesCelula.mes.rotuloExtenso}.
              </p>
            ) : (
              <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th scope="col" className="w-10 px-3 py-2 font-semibold">
                        #
                      </th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Atividade preventiva
                      </th>
                      <th scope="col" className="w-28 px-3 py-2 font-semibold">
                        Periodicidade
                      </th>
                      <th scope="col" className="w-32 px-3 py-2 text-right font-semibold">
                        Resultado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detalhesCelula.previstas.map((tarefa, idx) => {
                      const apurado = detalhesCelula.resultadoPorTarefaId.get(tarefa.id);
                      const seloApurado = apurado
                        ? SELO_RESULTADO_TAREFA[apurado.result]
                        : detalhesCelula.execucao?.status === 'concluida'
                          ? SELO_RESULTADO_TAREFA.feito
                          : null;

                      return (
                        <tr key={tarefa.id} className="hover:bg-slate-50/60">
                          <td className="px-3 py-2 font-mono text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2 text-slate-800">
                            <div>{tarefa.description}</div>
                            {apurado?.notes && (
                              <div className="mt-0.5 text-[11px] text-slate-500">
                                Obs.: {apurado.notes}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {rotuloPeriodicidade(tarefa.periodicity)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {seloApurado ? (
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${seloApurado.classe}`}
                              >
                                {seloApurado.rotulo}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">Pendente</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Modal de ampliação de foto da manutenção */}
      {fotoAmpliada && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Foto ampliada da manutenção"
          onClick={() => setFotoAmpliada(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-2xl bg-white p-2 shadow-xl"
          >
            <button
              type="button"
              onClick={() => setFotoAmpliada(null)}
              aria-label="Fechar imagem"
              className="absolute top-3 right-3 rounded-full bg-slate-900/80 p-1.5 text-white hover:bg-slate-900"
            >
              <X size={16} aria-hidden="true" />
            </button>
            <img
              src={fotoAmpliada}
              alt="Registro fotográfico da manutenção"
              className="max-h-[82vh] w-auto rounded-xl object-contain"
            />
          </div>
        </div>
      )}

      {/* Modal A4 do Relatório Mensal de Execução (Entrega 4) */}
      {mesRelatorioModal && !ehNovo && (
        <RelatorioExecucaoPmoc
          planId={planId}
          referenceMonth={mesRelatorioModal}
          onFechar={() => setMesRelatorioModal(null)}
        />
      )}
    </div>
  );
}

