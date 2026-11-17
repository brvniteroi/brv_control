import { useState } from 'react';
import {
  Ban,
  CheckCircle2,
  ChevronRight,
  Clock,
  Snowflake,
  WifiOff,
} from 'lucide-react';
import type {
  PmocActivityChecklist,
  PmocExecutionRecordStatus,
  PmocFieldEquipmentChecklist,
} from '../../../types/pmoc';
import { formatarMesReferencia } from '../../pmoc/regrasPmoc';
import PainelAparelhoPmocCampo from './PainelAparelhoPmocCampo';

interface ChecklistPmocAtividadeProps {
  checklist: PmocActivityChecklist;
  online: boolean;
  somenteLeitura: boolean;
  onRecarregar: () => Promise<void>;
}

const SELO_ESTADO_APARELHO: Record<
  PmocExecutionRecordStatus,
  { rotulo: string; classe: string }
> = {
  pendente: {
    rotulo: 'Pendente',
    classe: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  concluida: {
    rotulo: 'Feito',
    classe: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  nao_atendido: {
    rotulo: 'Não atendido',
    classe: 'border-rose-200 bg-rose-50 text-rose-700',
  },
};

export default function ChecklistPmocAtividade({
  checklist,
  online,
  somenteLeitura,
  onRecarregar,
}: ChecklistPmocAtividadeProps) {
  const [aparelhoAbertoId, setAparelhoAbertoId] = useState<string | null>(null);

  const total = checklist.equipments.length;
  const resolvidos = checklist.equipments.filter(
    (e) => e.status === 'concluida' || e.status === 'nao_atendido',
  ).length;
  const percentual = total > 0 ? Math.round((resolvidos / total) * 100) : 0;

  const aparelhoSelecionado: PmocFieldEquipmentChecklist | null =
    checklist.equipments.find((e) => e.plan_equipment_id === aparelhoAbertoId) ?? null;

  return (
    <div className="space-y-3">
      {!online && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-950"
        >
          <WifiOff size={16} className="shrink-0 text-amber-700" aria-hidden="true" />
          <span>O checklist do PMOC precisa de internet</span>
        </div>
      )}

      {/* Barra de progresso ("3 de 5 aparelhos") */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-bold text-blue-950">
            Progresso: {resolvidos} de {total} {total === 1 ? 'aparelho' : 'aparelhos'}
          </span>
          {checklist.reference_month && (
            <span className="font-semibold text-blue-800">
              {formatarMesReferencia(checklist.reference_month)}
            </span>
          )}
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-blue-200/70">
          <div
            style={{ width: `${percentual}%` }}
            className="h-full rounded-full bg-emerald-600 transition-all"
          />
        </div>
        {checklist.accompanied_by && (
          <p className="mt-2 text-[11px] font-medium text-blue-900">
            Visita acompanhada por: <strong>{checklist.accompanied_by}</strong>
          </p>
        )}
      </div>

      {/* Lista de aparelhos do mês (botões grandes, sem tabela) */}
      <div className="space-y-2">
        {checklist.equipments.map((eq) => {
          const selo = SELO_ESTADO_APARELHO[eq.status];
          return (
            <button
              key={eq.plan_equipment_id}
              type="button"
              onClick={() => setAparelhoAbertoId(eq.plan_equipment_id)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 text-left transition active:bg-slate-100"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white ${
                    eq.status === 'concluida'
                      ? 'bg-emerald-600'
                      : eq.status === 'nao_atendido'
                        ? 'bg-rose-600'
                        : 'bg-slate-900'
                  }`}
                >
                  {eq.letter}
                </span>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs font-extrabold text-slate-900">
                      {eq.identifier}
                    </span>
                    <span className="truncate text-sm font-bold text-slate-900">{eq.name}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span>{eq.environment_name || 'Sem ambiente'}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Snowflake size={11} className="text-blue-600" aria-hidden="true" />
                      {eq.scheduled_tasks.length} tar.
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${selo.classe}`}
                >
                  {eq.status === 'concluida' ? (
                    <CheckCircle2 size={13} aria-hidden="true" />
                  ) : eq.status === 'nao_atendido' ? (
                    <Ban size={13} aria-hidden="true" />
                  ) : (
                    <Clock size={13} aria-hidden="true" />
                  )}
                  {selo.rotulo}
                </span>
                <ChevronRight size={18} className="text-slate-400" aria-hidden="true" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Painel em tela cheia do aparelho selecionado */}
      {aparelhoSelecionado && checklist.plan_id && checklist.reference_month && (
        <PainelAparelhoPmocCampo
          taskId={checklist.task_id}
          serviceOrderId={checklist.service_order_id}
          planId={checklist.plan_id}
          referenceMonth={checklist.reference_month}
          aparelho={aparelhoSelecionado}
          online={online}
          somenteLeitura={somenteLeitura}
          onVoltar={() => setAparelhoAbertoId(null)}
          onSalvo={async () => {
            setAparelhoAbertoId(null);
            await onRecarregar();
          }}
        />
      )}
    </div>
  );
}

