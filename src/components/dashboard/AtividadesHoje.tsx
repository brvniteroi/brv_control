import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Calendar,
  ChevronRight,
  Clock,
  User,
} from 'lucide-react';
import type { AtividadeDoDia } from '../../services/dashboard';
import { infoStatusAtividade } from '../../utils/ordens';

interface AtividadesHojeProps {
  atividades: AtividadeDoDia[];
}

function formatarHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export default function AtividadesHoje({ atividades }: AtividadesHojeProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Atividades de Hoje</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Compromissos e atendimentos de campo programados para hoje.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          {atividades.length}
        </span>
      </div>

      {atividades.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Calendar size={22} />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-slate-800">
            Nenhuma atividade agendada para hoje
          </h3>
          <p className="mt-1 max-w-xs text-xs text-slate-400">
            Atividades criadas ou agendadas para o dia de hoje aparecerão organizadas aqui por horário.
          </p>
        </div>
      ) : (
        <div className="mt-4 divide-y divide-slate-100">
          {atividades.map((atv) => {
            const statusInfo = infoStatusAtividade(atv.status);
            const horaInicio = formatarHora(atv.scheduled_start);
            const horaFim = formatarHora(atv.scheduled_end);
            const os = atv.service_order;

            return (
              <div
                key={atv.id}
                onClick={() => {
                  if (os?.id) {
                    navigate(`/ordens-de-servico?os=${os.id}`);
                  }
                }}
                className={`group flex items-center justify-between gap-3 py-3.5 transition first:pt-0 last:pb-0 ${
                  os?.id ? 'cursor-pointer hover:bg-slate-50/80 -mx-2 px-2 rounded-xl' : ''
                }`}
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  {/* Horário e Status */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                      <Clock size={11} className="text-slate-400" />
                      {horaInicio} – {horaFim}
                    </span>

                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusInfo.classe}`}
                    >
                      {statusInfo.rotulo}
                    </span>

                    {os && (
                      <span className="text-[11px] font-semibold text-blue-600">
                        OS #{os.number}
                      </span>
                    )}
                  </div>

                  {/* Título da Atividade */}
                  <h4 className="font-semibold text-sm text-slate-900 truncate">
                    {atv.title}
                  </h4>

                  {/* Cliente e Técnico */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    {os?.customer && (
                      <span className="flex items-center gap-1 truncate font-medium text-slate-700">
                        <Building2 size={12} className="shrink-0 text-slate-400" />
                        <span className="truncate">{os.customer.name}</span>
                      </span>
                    )}

                    {atv.employee && (
                      <span className="flex items-center gap-1 truncate text-slate-600">
                        <User size={12} className="shrink-0 text-slate-400" />
                        <span className="truncate">{atv.employee.name}</span>
                      </span>
                    )}
                  </div>
                </div>

                {os?.id && (
                  <div className="flex items-center text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600">
                    <ChevronRight size={18} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
