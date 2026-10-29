import { useMemo, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { Clock, GripVertical, MapPin, Search } from 'lucide-react';
import type { AtividadeLinha } from '../../hooks/useLinhaDoTempo';
import { duracaoPrevista } from './janela';
import type { EspecArrasto } from './useArrasto';

function textoDuracao(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m}`;
}

interface Props {
  atividades: AtividadeLinha[];
  destacar: boolean;
  painelRef: RefObject<HTMLDivElement | null>;
  arrastandoId: string | null;
  aoIniciarArrasto: (e: ReactPointerEvent, spec: EspecArrasto) => void;
  aoAbrirOrdem: (ordemId: string) => void;
}

export default function PainelAAgendar({ atividades, destacar, painelRef, arrastandoId, aoIniciarArrasto, aoAbrirOrdem }: Props) {
  const [busca, setBusca] = useState('');

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return atividades;
    return atividades.filter((a) =>
      [a.title, a.ordem?.customer?.name, a.ordem ? String(a.ordem.number) : '', a.ordem?.service_type?.name]
        .filter(Boolean)
        .some((t) => t!.toLowerCase().includes(termo)),
    );
  }, [atividades, busca]);

  return (
    <aside
      ref={painelRef}
      className={`flex w-72 shrink-0 flex-col rounded-2xl border bg-white shadow-xs transition ${
        destacar ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'
      }`}
    >
      <div className="border-b border-slate-200 p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">A agendar</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{atividades.length}</span>
        </div>
        <div className="relative mt-2">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Cliente ou nº da OS"
            className="w-full rounded-lg border border-slate-200 py-1.5 pr-2 pl-8 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          {destacar ? 'Solte aqui para tirar da agenda.' : 'Arraste para a grade para agendar.'}
        </p>
      </div>

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {filtradas.map((a) => {
          const duracao = duracaoPrevista(a);
          return (
            <li
              key={a.id}
              onPointerDown={(e) =>
                aoIniciarArrasto(e, {
                  id: a.id,
                  origem: 'fila',
                  modo: 'mover',
                  inicioMin: 0,
                  fimMin: duracao,
                  employeeId: null,
                })
              }
              style={{ touchAction: 'none' }}
              className={`cursor-grab select-none rounded-xl border border-slate-200 bg-slate-50 p-2.5 transition hover:border-blue-300 hover:bg-white ${
                arrastandoId === a.id ? 'opacity-40' : ''
              }`}
            >
              <div className="flex items-start gap-1.5">
                <GripVertical size={14} className="mt-0.5 shrink-0 text-slate-300" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-slate-800">{a.ordem?.customer?.name ?? a.title}</div>
                  <div className="truncate text-[11px] text-slate-600">
                    {a.ordem ? `OS ${a.ordem.number}` : ''}
                    {a.ordem?.service_type ? ` · ${a.ordem.service_type.name}` : ''}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} /> {textoDuracao(duracao)}
                    </span>
                    {a.ordem?.local && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPin size={11} className="shrink-0" />
                        <span className="truncate">{a.ordem.local}</span>
                      </span>
                    )}
                  </div>
                </div>
                {a.ordem && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => aoAbrirOrdem(a.service_order_id)}
                    className="shrink-0 text-[11px] font-semibold text-blue-600 hover:underline"
                  >
                    Abrir
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {filtradas.length === 0 && (
          <li className="py-8 text-center text-xs text-slate-400">
            {atividades.length === 0 ? 'Nenhuma atividade esperando horário.' : 'Nada encontrado.'}
          </li>
        )}
      </ul>
    </aside>
  );
}
