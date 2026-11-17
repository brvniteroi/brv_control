import { useId, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Ban,
  Check,
  CheckCheck,
  CheckCircle2,
  Gauge,
  Loader2,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import { anexarFoto } from '../../../services/anexos';
import type {
  PmocFieldEquipmentChecklist,
  PmocMeasurementKey,
  PmocMeasurements,
  PmocTaskExecutionItem,
  PmocTaskResultStatus,
} from '../../../types/pmoc';
import BotoesFoto from '../../comum/BotoesFoto';
import {
  FONTE_DADOS_DEMO,
  enviarFotoEquipamentoPmoc,
  salvarExecucaoAparelho,
} from '../../pmoc/fonteDeDados';
import {
  CAMPOS_MEDICAO_PMOC,
  FAIXAS_PLAUSIVEIS_MEDICAO_PMOC,
  avisoFaixaMedicaoPmoc,
  formatarBtus,
  lerNumeroDecimal,
  rotuloPeriodicidade,
  validarExecucaoAparelhoPmoc,
} from '../../pmoc/regrasPmoc';

interface PainelAparelhoPmocCampoProps {
  taskId: string;
  serviceOrderId: string | null;
  planId: string;
  referenceMonth: string;
  aparelho: PmocFieldEquipmentChecklist;
  online: boolean;
  somenteLeitura: boolean;
  onVoltar: () => void;
  onSalvo: () => Promise<void>;
}

const SUGESTOES_MOTIVO_NAO_ATENDIDO = [
  'Aparelho desligado / desativado no local',
  'Ambiente trancado ou sem acesso liberado',
  'Sala em atendimento / cliente pediu para não mexer',
  'Equipamento aguardando peça corretiva',
] as const;

function inicializarTextoMedicao(valor: number | null): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '';
  return String(valor).replace('.', ',');
}

export default function PainelAparelhoPmocCampo({
  taskId,
  serviceOrderId,
  planId,
  referenceMonth,
  aparelho,
  online,
  somenteLeitura,
  onVoltar,
  onSalvo,
}: PainelAparelhoPmocCampoProps) {
  const idBase = useId();

  // Modo: preenchimento normal ('concluida') ou justificativa ('nao_atendido')
  const [modoNaoAtendido, setModoNaoAtendido] = useState<boolean>(
    aparelho.status === 'nao_atendido',
  );
  const [motivoNaoAtendido, setMotivoNaoAtendido] = useState<string>(
    aparelho.unattended_reason ?? '',
  );

  // Mapa de resultados por ID da tarefa prevista no mês
  const [resultadosPorTarefa, setResultadosPorTarefa] = useState<
    Record<string, { result: PmocTaskResultStatus; notes: string }>
  >(() => {
    const inicial: Record<string, { result: PmocTaskResultStatus; notes: string }> = {};
    const existentes = new Map(
      aparelho.task_results.map((r) => [r.equipment_task_id, r]),
    );
    for (const t of aparelho.scheduled_tasks) {
      const salvo = existentes.get(t.id);
      if (salvo) {
        inicial[t.id] = {
          result: salvo.result,
          notes: salvo.notes ?? '',
        };
      }
    }
    return inicial;
  });

  // Textos das 4 medições (aceitam vírgula ou ponto)
  const [textosMedicoes, setTextosMedicoes] = useState<Record<PmocMeasurementKey, string>>(() => ({
    current_a: inicializarTextoMedicao(aparelho.measurements.current_a),
    temp_supply_c: inicializarTextoMedicao(aparelho.measurements.temp_supply_c),
    temp_return_c: inicializarTextoMedicao(aparelho.measurements.temp_return_c),
    temp_ambient_c: inicializarTextoMedicao(aparelho.measurements.temp_ambient_c),
  }));

  const [observacoesAparelho, setObservacoesAparelho] = useState<string>(
    aparelho.technician_notes ?? '',
  );
  const [fotosUrls, setFotosUrls] = useState<string[]>(() => [...aparelho.photo_urls]);

  const [enviandoFotos, setEnviandoFotos] = useState(false);
  const [textoEnviandoFoto, setTextoEnviandoFoto] = useState<string | undefined>(undefined);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const medicoesNumericas: PmocMeasurements = useMemo(
    () => ({
      current_a: lerNumeroDecimal(textosMedicoes.current_a),
      temp_supply_c: lerNumeroDecimal(textosMedicoes.temp_supply_c),
      temp_return_c: lerNumeroDecimal(textosMedicoes.temp_return_c),
      temp_ambient_c: lerNumeroDecimal(textosMedicoes.temp_ambient_c),
    }),
    [textosMedicoes],
  );

  const camposMedicaoDoMes = useMemo(
    () =>
      CAMPOS_MEDICAO_PMOC.filter((c) => aparelho.required_measurements.includes(c.chave)),
    [aparelho.required_measurements],
  );

  const marcarTarefa = (taskIdAlvo: string, resultado: PmocTaskResultStatus) => {
    if (somenteLeitura) return;
    setErro(null);
    setResultadosPorTarefa((atual) => ({
      ...atual,
      [taskIdAlvo]: {
        result: resultado,
        notes: atual[taskIdAlvo]?.notes ?? '',
      },
    }));
  };

  const atualizarNotaTarefa = (taskIdAlvo: string, nota: string) => {
    if (somenteLeitura) return;
    setResultadosPorTarefa((atual) => ({
      ...atual,
      [taskIdAlvo]: {
        result: atual[taskIdAlvo]?.result ?? 'nao_feito',
        notes: nota,
      },
    }));
  };

  const marcarTodasComoFeito = () => {
    if (somenteLeitura) return;
    setErro(null);
    setResultadosPorTarefa((atual) => {
      const novo = { ...atual };
      for (const t of aparelho.scheduled_tasks) {
        novo[t.id] = {
          result: 'feito',
          notes: novo[t.id]?.notes ?? '',
        };
      }
      return novo;
    });
  };

  const handleReceberFotos = async (arquivos: File[]) => {
    if (!online || somenteLeitura || arquivos.length === 0) return;
    setErro(null);
    setEnviandoFotos(true);
    try {
      const novasUrls: string[] = [];
      for (let i = 0; i < arquivos.length; i++) {
        setTextoEnviandoFoto(
          arquivos.length > 1 ? `Enviando ${i + 1} de ${arquivos.length}…` : 'Enviando foto…',
        );
        if (FONTE_DADOS_DEMO) {
          const resDemo = await enviarFotoEquipamentoPmoc(arquivos[i]);
          novasUrls.push(resDemo.url);
        } else {
          const anexo = await anexarFoto(arquivos[i], {
            serviceOrderId: serviceOrderId ?? undefined,
            taskId,
            equipmentId: aparelho.equipment_id ?? undefined,
            category: 'depois',
            caption: `PMOC ${aparelho.identifier} · ${aparelho.name}`,
          });
          novasUrls.push(anexo.public_url);
        }
      }
      setFotosUrls((prev) => [...prev, ...novasUrls]);
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : 'Não foi possível enviar a foto do aparelho.',
      );
    } finally {
      setEnviandoFotos(false);
      setTextoEnviandoFoto(undefined);
    }
  };

  const removerFotoLocal = (indice: number) => {
    if (somenteLeitura) return;
    setFotosUrls((prev) => prev.filter((_, idx) => idx !== indice));
  };

  const handleSalvar = async () => {
    if (!online || somenteLeitura || salvando) return;
    setErro(null);

    const statusAlvo: 'concluida' | 'nao_atendido' = modoNaoAtendido
      ? 'nao_atendido'
      : 'concluida';

    const listaResultados: PmocTaskExecutionItem[] = [];
    if (statusAlvo === 'concluida') {
      for (const t of aparelho.scheduled_tasks) {
        const estado = resultadosPorTarefa[t.id];
        if (!estado) {
          setErro(`Marque o resultado da tarefa "${t.description}".`);
          return;
        }
        listaResultados.push({
          equipment_task_id: t.id,
          description: t.description,
          periodicity: t.periodicity,
          result: estado.result,
          notes: estado.notes.trim() || null,
        });
      }
    }

    const erroValidacao = validarExecucaoAparelhoPmoc({
      status: statusAlvo,
      tarefasPrevistas: aparelho.scheduled_tasks,
      resultadosTarefas: listaResultados,
      medicoes: medicoesNumericas,
      motivoNaoAtendido,
    });

    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setSalvando(true);
    try {
      await salvarExecucaoAparelho({
        task_id: taskId,
        plan_id: planId,
        plan_equipment_id: aparelho.plan_equipment_id,
        reference_month: referenceMonth,
        status: statusAlvo,
        task_results: listaResultados,
        measurements: medicoesNumericas,
        technician_notes: observacoesAparelho.trim() || null,
        photo_urls: fotosUrls,
        unattended_reason: statusAlvo === 'nao_atendido' ? motivoNaoAtendido.trim() : null,
      });
      await onSalvo();
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : 'Não foi possível salvar os dados do aparelho.',
      );
    } finally {
      setSalvando(false);
    }
  };

  const qtdMarcadas = aparelho.scheduled_tasks.filter(
    (t) => Boolean(resultadosPorTarefa[t.id]),
  ).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Checklist do aparelho ${aparelho.identifier}`}
      className="fixed inset-0 z-50 flex flex-col bg-[#F4F6F8]"
    >
      {/* Cabeçalho fixo para celular */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 shadow-2xs">
        <button
          type="button"
          onClick={onVoltar}
          disabled={salvando}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 active:bg-slate-100"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Voltar</span>
        </button>

        <div className="min-w-0 flex-1 text-center">
          <div className="truncate font-mono text-xs font-extrabold text-blue-700">
            {aparelho.letter} · {aparelho.identifier}
          </div>
          <div className="truncate text-xs font-bold text-slate-900">{aparelho.name}</div>
        </div>

        <button
          type="button"
          onClick={onVoltar}
          disabled={salvando}
          aria-label="Fechar painel do aparelho"
          className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      {/* Corpo rolável */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
        {!online && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-950"
          >
            <WifiOff size={18} className="shrink-0 text-amber-700" aria-hidden="true" />
            <span>O checklist do PMOC precisa de internet</span>
          </div>
        )}

        {/* Resumo do aparelho e alternância "Aparelho não atendido" */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-slate-500">
                {aparelho.environment_name || 'Sem ambiente'} · {aparelho.equipment_type} ·{' '}
                {formatarBtus(aparelho.capacity_btu)}
              </div>
              <div className="mt-0.5 text-sm font-extrabold text-slate-900">
                {aparelho.name} ({aparelho.identifier})
              </div>
            </div>

            {!somenteLeitura && (
              <button
                type="button"
                onClick={() => {
                  setModoNaoAtendido((v) => !v);
                  setErro(null);
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition ${
                  modoNaoAtendido
                    ? 'border-blue-300 bg-blue-50 text-blue-800'
                    : 'border-rose-300 bg-rose-50 text-rose-800 active:bg-rose-100'
                }`}
              >
                <Ban size={15} aria-hidden="true" />
                <span>
                  {modoNaoAtendido ? 'Voltar para o checklist' : 'Aparelho não atendido'}
                </span>
              </button>
            )}
          </div>
        </section>

        {modoNaoAtendido ? (
          /* Painel de justificativa quando o aparelho não pôde ser atendido */
          <section className="rounded-2xl border border-rose-200 bg-white p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-rose-800">
              <AlertTriangle size={18} aria-hidden="true" />
              <h3 className="text-sm font-bold">Motivo de aparelho não atendido *</h3>
            </div>
            <p className="text-xs text-slate-600">
              Escolha um motivo rápido ou descreva por que a manutenção deste aparelho não pôde ser feita hoje.
            </p>

            <div className="flex flex-wrap gap-2">
              {SUGESTOES_MOTIVO_NAO_ATENDIDO.map((sugestao) => (
                <button
                  key={sugestao}
                  type="button"
                  disabled={somenteLeitura}
                  onClick={() => setMotivoNaoAtendido(sugestao)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700 active:bg-slate-200"
                >
                  {sugestao}
                </button>
              ))}
            </div>

            <div>
              <label
                htmlFor={`${idBase}-motivo-nao-atendido`}
                className="mb-1 block text-xs font-bold text-slate-700"
              >
                Justificativa *
              </label>
              <textarea
                id={`${idBase}-motivo-nao-atendido`}
                rows={3}
                disabled={somenteLeitura}
                value={motivoNaoAtendido}
                onChange={(e) => setMotivoNaoAtendido(e.target.value)}
                placeholder="Ex.: Sala trancada; responsável informou que o aparelho estava desligado..."
                className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </section>
        ) : (
          <>
            {/* 1. Tarefas previstas no mês */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Tarefas previstas no mês ({qtdMarcadas} de {aparelho.scheduled_tasks.length})
                  </h3>
                </div>

                {!somenteLeitura && aparelho.scheduled_tasks.length > 1 && (
                  <button
                    type="button"
                    onClick={marcarTodasComoFeito}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 active:bg-emerald-100"
                  >
                    <CheckCheck size={15} aria-hidden="true" />
                    <span>Marcar todas como Feito</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {aparelho.scheduled_tasks.map((tarefa, idx) => {
                  const sel = resultadosPorTarefa[tarefa.id];
                  const resultado = sel?.result;

                  return (
                    <div
                      key={tarefa.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold leading-snug text-slate-900">
                          {idx + 1}. {tarefa.description}
                        </p>
                        <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {rotuloPeriodicidade(tarefa.periodicity)}
                        </span>
                      </div>

                      {/* 3 botões grandes para uso no celular com luvas */}
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          disabled={somenteLeitura}
                          onClick={() => marcarTarefa(tarefa.id, 'feito')}
                          className={`flex min-h-11 items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-extrabold transition ${
                            resultado === 'feito'
                              ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-700 active:bg-slate-100'
                          }`}
                        >
                          <Check size={15} aria-hidden="true" />
                          <span>Feito</span>
                        </button>

                        <button
                          type="button"
                          disabled={somenteLeitura}
                          onClick={() => marcarTarefa(tarefa.id, 'nao_feito')}
                          className={`flex min-h-11 items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-extrabold transition ${
                            resultado === 'nao_feito'
                              ? 'border-rose-600 bg-rose-600 text-white shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-700 active:bg-slate-100'
                          }`}
                        >
                          <X size={15} aria-hidden="true" />
                          <span>Não feito</span>
                        </button>

                        <button
                          type="button"
                          disabled={somenteLeitura}
                          onClick={() => marcarTarefa(tarefa.id, 'nao_se_aplica')}
                          className={`flex min-h-11 items-center justify-center rounded-xl border px-2 py-2.5 text-xs font-extrabold transition ${
                            resultado === 'nao_se_aplica'
                              ? 'border-slate-700 bg-slate-700 text-white shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-700 active:bg-slate-100'
                          }`}
                        >
                          <span>Não se aplica</span>
                        </button>
                      </div>

                      {/* Observação obrigatória quando "Não feito" */}
                      {resultado === 'nao_feito' && (
                        <div>
                          <label
                            htmlFor={`${idBase}-obs-t-${tarefa.id}`}
                            className="mb-1 block text-xs font-bold text-rose-800"
                          >
                            Observação obrigatória (por que não foi feito) *
                          </label>
                          <input
                            id={`${idBase}-obs-t-${tarefa.id}`}
                            type="text"
                            disabled={somenteLeitura}
                            value={sel?.notes ?? ''}
                            onChange={(e) => atualizarNotaTarefa(tarefa.id, e.target.value)}
                            placeholder="Descreva o motivo..."
                            className="block w-full rounded-xl border border-rose-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-rose-600 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 2. Medições pedidas pelas tarefas do mês */}
            {camposMedicaoDoMes.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <Gauge size={17} className="text-blue-600" aria-hidden="true" />
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                    Medições obrigatórias do mês
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {camposMedicaoDoMes.map((campo) => {
                    const valorNum = medicoesNumericas[campo.chave];
                    const avisoFaixa = avisoFaixaMedicaoPmoc(campo.chave, valorNum);
                    const faixaInfo = FAIXAS_PLAUSIVEIS_MEDICAO_PMOC[campo.chave];

                    return (
                      <div key={campo.chave} className="space-y-1">
                        <label
                          htmlFor={`${idBase}-med-${campo.chave}`}
                          className="block text-xs font-bold text-slate-800"
                        >
                          {campo.rotulo} *
                        </label>
                        <div className="relative">
                          <input
                            id={`${idBase}-med-${campo.chave}`}
                            type="text"
                            inputMode="decimal"
                            disabled={somenteLeitura}
                            value={textosMedicoes[campo.chave]}
                            onChange={(e) => {
                              setErro(null);
                              setTextosMedicoes((atual) => ({
                                ...atual,
                                [campo.chave]: e.target.value,
                              }));
                            }}
                            placeholder={`Faixa habitual: ${faixaInfo.descricaoFaixa}`}
                            className={`block w-full rounded-xl border bg-white py-3 pr-12 pl-3.5 text-base font-bold text-slate-900 focus:outline-none ${
                              avisoFaixa
                                ? 'border-amber-400 bg-amber-50/40 focus:border-amber-600'
                                : 'border-slate-300 focus:border-blue-600'
                            }`}
                          />
                          <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs font-extrabold text-slate-500">
                            {campo.unidade}
                          </span>
                        </div>
                        {avisoFaixa && (
                          <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-800">
                            <AlertTriangle size={12} className="shrink-0" aria-hidden="true" />
                            <span>{avisoFaixa}</span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}

        {/* 3. Observações livres do aparelho */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2">
          <label
            htmlFor={`${idBase}-obs-aparelho`}
            className="block text-xs font-bold uppercase tracking-wide text-slate-500"
          >
            Observações do aparelho (opcional)
          </label>
          <textarea
            id={`${idBase}-obs-aparelho`}
            rows={3}
            disabled={somenteLeitura}
            value={observacoesAparelho}
            onChange={(e) => setObservacoesAparelho(e.target.value)}
            placeholder="Estado das serpentinas, ruídos, peças recomendadas..."
            className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          />
        </section>

        {/* 4. Fotos do aparelho */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Fotos do aparelho ({fotosUrls.length})
          </h3>

          {!somenteLeitura && (
            <BotoesFoto
              tamanho="grande"
              multiplo
              desabilitado={!online}
              enviando={enviandoFotos}
              textoEnviando={textoEnviandoFoto}
              onArquivos={(arqs) => void handleReceberFotos(arqs)}
            />
          )}

          {fotosUrls.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5 pt-1 sm:grid-cols-4">
              {fotosUrls.map((url, idx) => (
                <div
                  key={`${url}-${idx}`}
                  className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                >
                  <img
                    src={url}
                    alt={`Foto ${idx + 1} do aparelho ${aparelho.identifier}`}
                    className="h-24 w-full object-cover"
                  />
                  {!somenteLeitura && (
                    <button
                      type="button"
                      onClick={() => removerFotoLocal(idx)}
                      aria-label={`Remover foto ${idx + 1}`}
                      className="absolute top-1.5 right-1.5 rounded-lg bg-slate-900/75 p-1.5 text-white active:bg-rose-600"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {erro && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800"
          >
            <AlertCircle size={16} className="shrink-0 text-rose-600" aria-hidden="true" />
            <span>{erro}</span>
          </div>
        )}
      </div>

      {/* Rodapé fixo com botão grande "Salvar aparelho" */}
      {!somenteLeitura && (
        <footer className="sticky bottom-0 z-10 border-t border-slate-200 bg-white p-4 shadow-lg">
          <button
            type="button"
            disabled={!online || salvando || enviandoFotos}
            onClick={() => void handleSalvar()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-extrabold text-white shadow-xs transition active:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvando ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={18} aria-hidden="true" />
                <span>Salvar aparelho</span>
              </>
            )}
          </button>
        </footer>
      )}
    </div>
  );
}

