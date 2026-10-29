import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import type { OrdemDestaque } from '../../services/dashboard';
import type { ServiceOrderPriority } from '../../types/fsm';
import { formatarData, infoStatusOS } from '../../utils/ordens';

interface PrecisamAtencaoProps {
  ordens: OrdemDestaque[];
}

function estaVencida(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  const dataIso = dueDate.slice(0, 10);
  const hoje = new Date();
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(
    hoje.getDate(),
  ).padStart(2, '0')}`;
  return dataIso < hojeIso;
}

function seloPrioridade(prioridade: ServiceOrderPriority) {
  switch (prioridade) {
    case 'urgente':
      return {
        rotulo: 'Urgente',
        classe: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    case 'alta':
      return {
        rotulo: 'Alta',
        classe: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    case 'normal':
      return {
        rotulo: 'Normal',
        classe: 'bg-slate-50 text-slate-700 border-slate-200',
      };
    case 'baixa':
      return {
        rotulo: 'Baixa',
        classe: 'bg-slate-50 text-slate-500 border-slate-200',
      };
  }
}

export default function PrecisamAtencao({ ordens }: PrecisamAtencaoProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Precisam de Atenção</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Ordens de serviço atrasadas ou com prioridade alta/urgente.
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            ordens.length > 0
              ? 'bg-rose-100 text-rose-700 font-bold'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {ordens.length}
        </span>
      </div>

      {ordens.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={24} />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-slate-800">Tudo em dia</h3>
          <p className="mt-1 max-w-xs text-xs text-slate-400">
            Nenhuma ordem de serviço aberta está com prazo vencido ou marcada como prioritária no momento.
          </p>
        </div>
      ) : (
        <div className="mt-4 divide-y divide-slate-100">
          {ordens.map((os) => {
            const statusInfo = infoStatusOS(os.status);
            const prioInfo = seloPrioridade(os.priority);
            const vencida = estaVencida(os.due_date);

            return (
              <div
                key={os.id}
                onClick={() => navigate(`/ordens-de-servico?os=${os.id}`)}
                className="group flex cursor-pointer items-center justify-between gap-3 py-3.5 transition hover:bg-slate-50/80 -mx-2 px-2 rounded-xl first:pt-0 last:pb-0"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  {/* Número, Prioridade e Status */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">
                      OS #{os.number}
                    </span>

                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${prioInfo.classe}`}
                    >
                      {prioInfo.rotulo}
                    </span>

                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusInfo.classe}`}
                    >
                      {statusInfo.rotulo}
                    </span>
                  </div>

                  {/* Cliente */}
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 truncate">
                    <Building2 size={13} className="shrink-0 text-slate-400" />
                    <span className="truncate">{os.customer?.name || 'Cliente não identificado'}</span>
                  </div>

                  {/* Prazo */}
                  <div className="flex items-center gap-1.5 text-xs">
                    {os.due_date ? (
                      vencida ? (
                        <span className="flex items-center gap-1 font-semibold text-rose-600">
                          <AlertCircle size={13} className="shrink-0 text-rose-600" />
                          Vencida em {formatarData(os.due_date)}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-slate-500">
                          <Calendar size={13} className="shrink-0 text-slate-400" />
                          Prazo: {formatarData(os.due_date)}
                        </span>
                      )
                    ) : (
                      <span className="flex items-center gap-1 text-amber-700">
                        <ShieldAlert size={13} className="shrink-0 text-amber-500" />
                        Sem prazo definido
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600">
                  <ChevronRight size={18} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
