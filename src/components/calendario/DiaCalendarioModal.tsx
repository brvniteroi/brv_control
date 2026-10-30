import { CalendarRange, Plus, X } from 'lucide-react';
import type { AtividadeLinha } from '../../hooks/useLinhaDoTempo';
import type { TecnicoLinha } from '../../services/linhaDoTempo';
import { infoStatusAtividade } from '../../utils/ordens';
import { horaDe } from './formato';
import { Avatar } from './GradeMes';

interface Props {
  dia: string;
  atividades: AtividadeLinha[];
  tecnicos: Map<string, TecnicoLinha>;
  aoFechar: () => void;
  aoAbrirOrdem: (ordemId: string) => void;
  aoAbrirLinhaDoTempo: () => void;
  aoNovaAtividade: () => void;
}

/** Todas as atividades de um dia do calendário. */
export default function DiaCalendarioModal({
  dia, atividades, tecnicos, aoFechar, aoAbrirOrdem, aoAbrirLinhaDoTempo, aoNovaAtividade,
}: Props) {
  const titulo = new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={aoFechar}>
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-bold capitalize text-slate-800">{titulo}</h3>
            <p className="text-xs text-slate-500">
              {atividades.length} {atividades.length === 1 ? 'atividade' : 'atividades'}
            </p>
          </div>
          <button type="button" onClick={aoFechar} className="text-slate-400 hover:text-slate-600" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {atividades.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">Nenhuma atividade neste dia.</p>
          ) : (
            <ul className="space-y-1.5">
              {atividades.map((a) => {
                const tecnico = a.employee_id ? tecnicos.get(a.employee_id) : undefined;
                const info = infoStatusAtividade(a.status);
                const o = a.ordem;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => aoAbrirOrdem(a.service_order_id)}
                      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-left text-xs transition hover:bg-slate-50"
                    >
                      <span className="font-mono font-bold text-slate-700">{horaDe(a.scheduled_start)}</span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate font-semibold text-slate-800 ${a.status === 'cancelada' ? 'line-through' : ''}`}>
                          {o?.customer?.name ?? a.title}
                        </span>
                        <span className="block truncate text-[11px] text-slate-500">
                          {[o ? `OS ${o.number}` : null, o?.service_type?.name, o?.local].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="hidden items-center gap-1.5 text-[11px] text-slate-600 sm:flex">
                        <Avatar tecnico={tecnico} />
                        <span className="max-w-24 truncate">{tecnico?.name ?? 'A distribuir'}</span>
                      </span>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${info.classe}`}>
                        {info.rotulo}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={aoAbrirLinhaDoTempo}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <CalendarRange size={14} /> Abrir na linha do tempo
          </button>
          <button
            type="button"
            onClick={aoNovaAtividade}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={14} /> Nova atividade
          </button>
        </div>
      </div>
    </div>
  );
}
