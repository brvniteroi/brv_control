import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CalendarRange,
  ChevronDown,
  Copy,
  Gauge,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  PERIODICIDADES_PMOC,
  formatarBtus,
  gerarMesesDoPlano,
  letraEquipamento,
  tarefasPrevistasNoMes,
} from './regrasPmoc';
import type {
  PmocEquipmentTask,
  PmocPeriodicity,
  PmocPlanEquipment,
  PmocTaskTemplate,
} from '../../types/pmoc';

interface AbaCronogramaPmocProps {
  planId: string;
  startDate: string;
  equipamentos: PmocPlanEquipment[];
  tarefas: PmocEquipmentTask[];
  modelos: PmocTaskTemplate[];
  onChange: (novas: PmocEquipmentTask[]) => void;
}

const INPUT_LINHA =
  'block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400';

export default function AbaCronogramaPmoc({
  planId,
  startDate,
  equipamentos,
  tarefas,
  modelos,
  onChange,
}: AbaCronogramaPmocProps) {
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [avisoCopia, setAvisoCopia] = useState<string | null>(null);

  const mesesDoPlano = useMemo(() => gerarMesesDoPlano(startDate), [startDate]);

  const equipamentosAtivos = useMemo(
    () => [...equipamentos].filter((e) => e.active).sort((a, b) => a.sort_order - b.sort_order),
    [equipamentos],
  );

  const obterTarefasDoEquipamento = (eqId: string): PmocEquipmentTask[] =>
    tarefas
      .filter((t) => t.plan_equipment_id === eqId)
      .sort((a, b) => a.sort_order - b.sort_order);

  const substituirTarefasDoEquipamento = (eqId: string, novasDoAparelho: PmocEquipmentTask[]) => {
    const numeradas = novasDoAparelho.map((t, idx) => ({ ...t, sort_order: idx + 1 }));
    const deOutros = tarefas.filter((t) => t.plan_equipment_id !== eqId);
    onChange([...deOutros, ...numeradas]);
  };

  const aplicarModeloPadrao = (eq: PmocPlanEquipment) => {
    const tipoNorm = eq.equipment_type.trim().toLowerCase();
    const modelo =
      modelos.find((m) => m.equipment_type.trim().toLowerCase() === tipoNorm) ?? modelos[0];
    if (!modelo) return;

    const atuais = obterTarefasDoEquipamento(eq.id);
    if (
      atuais.length > 0 &&
      !window.confirm(
        `Substituir o cronograma atual de "${eq.name || eq.identifier}" pelo modelo padrão "${modelo.equipment_type}" (${modelo.tasks.length} tarefas)?`,
      )
    ) {
      return;
    }

    const geradas: PmocEquipmentTask[] = modelo.tasks.map((item, idx) => ({
      id: crypto.randomUUID(),
      plan_id: planId,
      plan_equipment_id: eq.id,
      template_item_id: item.id,
      description: item.description,
      periodicity: item.periodicity,
      start_month_offset: item.relative_start_month,
      requires_measurement: item.requires_measurement,
      measurement_fields: [...item.measurement_fields],
      sort_order: idx + 1,
      active: true,
    }));

    substituirTarefasDoEquipamento(eq.id, geradas);
  };

  const copiarParaMesmoTipo = (origem: PmocPlanEquipment) => {
    const tipoNorm = origem.equipment_type.trim().toLowerCase();
    const destinos = equipamentosAtivos.filter(
      (e) => e.id !== origem.id && e.equipment_type.trim().toLowerCase() === tipoNorm,
    );

    if (destinos.length === 0) {
      setAvisoCopia(
        `Não há outro equipamento do tipo "${origem.equipment_type}" neste plano para receber a cópia.`,
      );
      setTimeout(() => setAvisoCopia(null), 4000);
      return;
    }

    if (
      !window.confirm(
        `Copiar o cronograma de "${origem.name || origem.identifier}" para ${destinos.length} outro(s) equipamento(s) do tipo "${origem.equipment_type}"?`,
      )
    ) {
      return;
    }

    const modeloOrigem = obterTarefasDoEquipamento(origem.id);
    const idsDestinos = new Set(destinos.map((d) => d.id));
    const preservadas = tarefas.filter((t) => !idsDestinos.has(t.plan_equipment_id));

    const clonadas: PmocEquipmentTask[] = [];
    for (const dest of destinos) {
      modeloOrigem.forEach((t, idx) => {
        clonadas.push({
          ...t,
          id: crypto.randomUUID(),
          plan_id: planId,
          plan_equipment_id: dest.id,
          measurement_fields: [...t.measurement_fields],
          sort_order: idx + 1,
        });
      });
    }

    onChange([...preservadas, ...clonadas]);
    setAvisoCopia(
      `Cronograma copiado com sucesso para ${destinos.length} equipamento(s) "${origem.equipment_type}".`,
    );
    setTimeout(() => setAvisoCopia(null), 4000);
  };

  const adicionarTarefaAvulsa = (eqId: string) => {
    const atuais = obterTarefasDoEquipamento(eqId);
    const nova: PmocEquipmentTask = {
      id: crypto.randomUUID(),
      plan_id: planId,
      plan_equipment_id: eqId,
      template_item_id: null,
      description: '',
      periodicity: 'mensal',
      start_month_offset: 1,
      requires_measurement: false,
      measurement_fields: [],
      sort_order: atuais.length + 1,
      active: true,
    };
    substituirTarefasDoEquipamento(eqId, [...atuais, nova]);
  };

  const moverTarefa = (eqId: string, indice: number, direcao: -1 | 1) => {
    const atuais = [...obterTarefasDoEquipamento(eqId)];
    const destino = indice + direcao;
    if (destino < 0 || destino >= atuais.length) return;
    const temp = atuais[indice];
    atuais[indice] = atuais[destino];
    atuais[destino] = temp;
    substituirTarefasDoEquipamento(eqId, atuais);
  };

  const atualizarTarefa = (eqId: string, taskId: string, mudanca: Partial<PmocEquipmentTask>) => {
    const atuais = obterTarefasDoEquipamento(eqId).map((t) =>
      t.id === taskId ? { ...t, ...mudanca } : t,
    );
    substituirTarefasDoEquipamento(eqId, atuais);
  };

  const removerTarefaAvulsa = (eqId: string, taskId: string) => {
    const atuais = obterTarefasDoEquipamento(eqId).filter((t) => t.id !== taskId);
    substituirTarefasDoEquipamento(eqId, atuais);
  };

  if (equipamentosAtivos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-14 text-center">
        <CalendarRange size={28} className="text-slate-300" aria-hidden="true" />
        <h3 className="mt-3 text-sm font-bold text-slate-800">
          Adicione equipamentos antes de montar o cronograma
        </h3>
        <p className="mt-1 max-w-sm text-xs text-slate-500">
          Cada equipamento vinculado na aba &ldquo;Equipamentos&rdquo; recebe seu bloco de tarefas preventivas aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {avisoCopia && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-800"
        >
          {avisoCopia}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        {/* Coluna esquerda: Blocos recolhíveis por equipamento */}
        <div className="space-y-4 xl:col-span-7">
          {equipamentosAtivos.map((eq, idxEquip) => {
            const letra = letraEquipamento(idxEquip);
            // Por padrão, abre o primeiro bloco para facilitar a leitura imediata
            const aberto = abertos[eq.id] ?? idxEquip === 0;
            const listaTarefas = obterTarefasDoEquipamento(eq.id);
            const qtdAtivas = listaTarefas.filter((t) => t.active).length;

            let contadorAtiva = 0;

            return (
              <div
                key={eq.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
              >
                {/* Cabeçalho recolhível do bloco */}
                <button
                  type="button"
                  aria-expanded={aberto}
                  onClick={() => setAbertos((prev) => ({ ...prev, [eq.id]: !aberto }))}
                  className="flex w-full items-center justify-between gap-3 bg-slate-50/80 px-4 py-3.5 text-left transition hover:bg-slate-100/80"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#0B1E3F] text-xs font-extrabold text-white">
                      {letra}
                    </span>
                    <span className="font-bold text-slate-900">
                      {letra} · {eq.name || 'Sem nome'} ·{' '}
                      <span className="font-mono">{eq.identifier}</span> ·{' '}
                      {formatarBtus(eq.capacity_btu)}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                      {qtdAtivas}/{listaTarefas.length} ativas
                    </span>
                    <ChevronDown
                      size={18}
                      aria-hidden="true"
                      className={`text-slate-500 transition-transform ${
                        aberto ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {aberto && (
                  <div className="border-t border-slate-200 p-4 space-y-3">
                    {/* Barra de ações do equipamento */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => aplicarModeloPadrao(eq)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <RotateCcw size={13} aria-hidden="true" />
                        Aplicar modelo padrão
                      </button>

                      <button
                        type="button"
                        onClick={() => copiarParaMesmoTipo(eq)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Copy size={13} aria-hidden="true" />
                        Copiar cronograma para os outros equipamentos do mesmo tipo
                      </button>

                      <button
                        type="button"
                        onClick={() => adicionarTarefaAvulsa(eq.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                      >
                        <Plus size={13} aria-hidden="true" />
                        Adicionar tarefa avulsa
                      </button>
                    </div>

                    {/* Tabela de tarefas do equipamento */}
                    <div
                      role="region"
                      aria-label={`Cronograma do equipamento ${letra}`}
                      tabIndex={0}
                      className="overflow-x-auto rounded-xl border border-slate-200"
                    >
                      <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-500 uppercase">
                            <th scope="col" className="w-10 px-2.5 py-2.5 text-center">
                              #
                            </th>
                            <th scope="col" className="px-3 py-2.5">
                              Descrição da tarefa
                            </th>
                            <th scope="col" className="w-32 px-2.5 py-2.5">
                              Periodicidade
                            </th>
                            <th scope="col" className="w-32 px-2.5 py-2.5">
                              Inicia em
                            </th>
                            <th scope="col" className="w-16 px-2 py-2.5 text-center">
                              Ativa
                            </th>
                            <th scope="col" className="w-24 px-2.5 py-2.5 text-right">
                              Ordem
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {listaTarefas.map((t, idxTarefa) => {
                            if (t.active) contadorAtiva += 1;
                            const numExibido = t.active ? String(contadorAtiva) : '—';
                            const ehAvulsa = t.template_item_id === null;

                            return (
                              <tr
                                key={t.id}
                                className={t.active ? 'bg-white' : 'bg-slate-50/70 text-slate-400'}
                              >
                                <td className="px-2.5 py-2 text-center font-semibold">
                                  {numExibido}
                                </td>

                                <td className="px-3 py-2">
                                  {ehAvulsa ? (
                                    <input
                                      type="text"
                                      aria-label={`Descrição da tarefa avulsa ${idxTarefa + 1}`}
                                      value={t.description}
                                      disabled={!t.active}
                                      onChange={(e) =>
                                        atualizarTarefa(eq.id, t.id, {
                                          description: e.target.value,
                                        })
                                      }
                                      placeholder="Descreva a tarefa preventiva..."
                                      className={`${INPUT_LINHA} ${
                                        !t.active ? 'line-through' : ''
                                      }`}
                                    />
                                  ) : (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className={t.active ? 'text-slate-800' : 'line-through'}>
                                        {t.description}
                                      </span>
                                      {t.requires_measurement && (
                                        <span className="inline-flex items-center gap-0.5 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                                          <Gauge size={10} aria-hidden="true" />
                                          Medição
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>

                                <td className="px-2.5 py-2">
                                  <select
                                    aria-label={`Periodicidade de ${t.description || `tarefa ${idxTarefa + 1}`}`}
                                    value={t.periodicity}
                                    disabled={!t.active}
                                    onChange={(e) =>
                                      atualizarTarefa(eq.id, t.id, {
                                        periodicity: e.target.value as PmocPeriodicity,
                                      })
                                    }
                                    className={INPUT_LINHA}
                                  >
                                    {PERIODICIDADES_PMOC.map((p) => (
                                      <option key={p.valor} value={p.valor}>
                                        {p.rotulo}
                                      </option>
                                    ))}
                                  </select>
                                </td>

                                <td className="px-2.5 py-2">
                                  <select
                                    aria-label={`Mês de início de ${t.description || `tarefa ${idxTarefa + 1}`}`}
                                    value={t.start_month_offset}
                                    disabled={!t.active}
                                    onChange={(e) =>
                                      atualizarTarefa(eq.id, t.id, {
                                        start_month_offset: Number(e.target.value),
                                      })
                                    }
                                    className={INPUT_LINHA}
                                  >
                                    {mesesDoPlano.map((m) => (
                                      <option key={m.offset} value={m.offset}>
                                        {m.nomeMes}
                                      </option>
                                    ))}
                                  </select>
                                </td>

                                <td className="px-2 py-2 text-center">
                                  <input
                                    type="checkbox"
                                    aria-label={`Manter tarefa ativa: ${t.description || idxTarefa + 1}`}
                                    checked={t.active}
                                    onChange={(e) =>
                                      atualizarTarefa(eq.id, t.id, {
                                        active: e.target.checked,
                                      })
                                    }
                                    className="h-4 w-4 cursor-pointer accent-blue-600"
                                  />
                                </td>

                                <td className="px-2.5 py-2 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center gap-0.5">
                                    <button
                                      type="button"
                                      disabled={idxTarefa === 0}
                                      onClick={() => moverTarefa(eq.id, idxTarefa, -1)}
                                      aria-label={`Subir tarefa ${idxTarefa + 1}`}
                                      className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                                    >
                                      <ArrowUp size={13} aria-hidden="true" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idxTarefa === listaTarefas.length - 1}
                                      onClick={() => moverTarefa(eq.id, idxTarefa, 1)}
                                      aria-label={`Descer tarefa ${idxTarefa + 1}`}
                                      className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                                    >
                                      <ArrowDown size={13} aria-hidden="true" />
                                    </button>
                                    {ehAvulsa && (
                                      <button
                                        type="button"
                                        onClick={() => removerTarefaAvulsa(eq.id, t.id)}
                                        aria-label={`Remover tarefa avulsa ${idxTarefa + 1}`}
                                        className="rounded p-1 text-rose-500 hover:bg-rose-50"
                                      >
                                        <Trash2 size={13} aria-hidden="true" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Coluna direita: Visão anual de 12 meses */}
        <div className="xl:sticky xl:top-24 xl:col-span-5">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3.5">
              <h3 className="text-xs font-bold tracking-wide text-slate-800 uppercase">
                Visão anual (12 meses)
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Quantidade de tarefas ativas que caem em cada mês por equipamento.
              </p>
            </div>

            <div
              role="region"
              aria-label="Visão anual de tarefas por mês"
              tabIndex={0}
              className="overflow-x-auto"
            >
              <table className="w-full border-collapse text-center text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                    <th scope="col" className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left">
                      Aparelho
                    </th>
                    {mesesDoPlano.map((m) => (
                      <th key={m.offset} scope="col" className="px-2 py-2 whitespace-nowrap">
                        {m.rotuloCurto}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {equipamentosAtivos.map((eq, idx) => {
                    const letra = letraEquipamento(idx);
                    const doEq = obterTarefasDoEquipamento(eq.id);
                    return (
                      <tr key={eq.id} className="hover:bg-slate-50/50">
                        <th
                          scope="row"
                          className="sticky left-0 z-10 bg-white px-3 py-2.5 text-left font-mono font-bold whitespace-nowrap text-slate-800"
                        >
                          {letra} · {eq.identifier}
                        </th>
                        {mesesDoPlano.map((m) => {
                          const qtd = tarefasPrevistasNoMes(doEq, m.offset).length;
                          return (
                            <td key={m.offset} className="px-1.5 py-2">
                              <span
                                className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1 font-bold ${
                                  qtd === 0
                                    ? 'bg-slate-100 text-slate-400'
                                    : qtd > 18
                                      ? 'bg-indigo-100 text-indigo-800'
                                      : 'bg-blue-50 text-blue-700'
                                }`}
                              >
                                {qtd}
                              </span>
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
        </div>
      </div>
    </div>
  );
}

