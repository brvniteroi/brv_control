import { memo } from 'react';
import type { AtividadeLinha } from '../../hooks/useLinhaDoTempo';
import type { TecnicoLinha } from '../../services/linhaDoTempo';
import { COR_STATUS_ATIVIDADE } from '../../utils/ordens';
import { bateBusca, dicaAtividade, horaDe, ordenarPelaBusca } from './formato';
import EtiquetasNoBloco from '../etiquetas/EtiquetasNoBloco';

const DIAS_SEMANA = ['Dom.', 'Seg.', 'Ter.', 'Qua.', 'Qui.', 'Sex.', 'Sáb.'];
/** Atividades visíveis por dia; o resto fica no "Ver mais". */
const MAX_POR_DIA = 3;

export function Avatar({ tecnico }: { tecnico: TecnicoLinha | undefined }) {
  return (
    <span
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ring-1 ring-white/70"
      style={{ backgroundColor: tecnico?.timeline_color ?? '#94A3B8' }}
      title={tecnico?.name}
    >
      {tecnico?.name.trim().charAt(0).toUpperCase() ?? '?'}
    </span>
  );
}

interface GradeMesProps {
  mes: string;
  dias: string[];
  hoje: string;
  porDia: Map<string, AtividadeLinha[]>;
  tecnicos: Map<string, TecnicoLinha>;
  /** Termo da busca por cliente (vazio = sem busca): destaca as que batem e apaga as demais. */
  termo: string;
  aoAbrirOrdem: (ordemId: string) => void;
  aoAbrirDia: (dia: string) => void;
}

export default memo(function GradeMes({ mes, dias, hoje, porDia, tecnicos, termo, aoAbrirOrdem, aoAbrirDia }: GradeMesProps) {
  const semanas = dias.length / 7;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {d}
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-7 overflow-y-auto" style={{ gridTemplateRows: `repeat(${semanas}, minmax(7.5rem, 1fr))` }}>
        {dias.map((dia, i) => {
          const atividades = ordenarPelaBusca(porDia.get(dia) ?? [], termo);
          const doMes = dia.startsWith(mes);
          const fimDeSemana = i % 7 === 0 || i % 7 === 6;
          const extras = atividades.length - MAX_POR_DIA;
          const encontradas = atividades.filter((a) => bateBusca(a, termo)).length;
          return (
            <div
              key={dia}
              className={`flex min-w-0 flex-col gap-1 border-b border-r border-slate-100 p-1.5 [&:nth-child(7n)]:border-r-0 ${
                fimDeSemana || !doMes ? 'bg-slate-50/70' : ''
              }`}
            >
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => aoAbrirDia(dia)}
                  title="Ver o dia"
                  className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold transition hover:bg-slate-200 ${
                    dia === hoje ? 'bg-blue-600 text-white hover:bg-blue-700' : doMes ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {Number(dia.slice(8))}
                </button>
              </div>

              {/* Computador: as primeiras atividades do dia */}
              <div className="hidden flex-col gap-1 md:flex">
                {atividades.slice(0, MAX_POR_DIA).map((a) => {
                  const tecnico = a.employee_id ? tecnicos.get(a.employee_id) : undefined;
                  const destaque = !termo ? '' : bateBusca(a, termo) ? 'ring-2 ring-amber-400 ring-offset-1' : 'opacity-25';
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => aoAbrirOrdem(a.service_order_id)}
                      title={dicaAtividade(a, tecnico)}
                      className={`flex min-w-0 items-center gap-1 rounded-md border-b-2 px-1.5 py-0.5 text-left text-[11px] font-semibold text-white transition hover:brightness-110 ${
                        COR_STATUS_ATIVIDADE[a.status]
                      } ${a.status === 'cancelada' ? 'line-through' : ''} ${destaque}`}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {horaDe(a.scheduled_start)} - {a.ordem?.customer?.name ?? a.title}
                      </span>
                      <EtiquetasNoBloco etiquetas={a.ordem?.etiquetas} modo="ponto" />
                      <Avatar tecnico={tecnico} />
                    </button>
                  );
                })}
                {extras > 0 && (
                  <button
                    type="button"
                    onClick={() => aoAbrirDia(dia)}
                    className={`rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-left text-[11px] font-semibold text-blue-600 hover:bg-blue-50 ${
                      termo && encontradas <= MAX_POR_DIA ? 'opacity-25' : ''
                    }`}
                  >
                    Ver mais (+ {extras})
                  </button>
                )}
              </div>

              {/* Celular: só a quantidade */}
              {(termo ? encontradas : atividades.length) > 0 && (
                <button
                  type="button"
                  onClick={() => aoAbrirDia(dia)}
                  className={`rounded-md px-1 py-0.5 text-[11px] font-bold md:hidden ${
                    termo ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'
                  }`}
                >
                  {termo ? encontradas : atividades.length}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
