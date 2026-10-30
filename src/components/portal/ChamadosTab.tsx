import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, MapPin, CalendarClock, Wrench } from 'lucide-react';
import { listarChamados, type PortalChamado } from '../../services/portal';
import { formatarData, formatarDataHora, infoStatusOS } from '../../utils/ordens';

type Filtro = 'andamento' | 'concluidos' | 'todos';

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: 'andamento', rotulo: 'Em andamento' },
  { id: 'concluidos', rotulo: 'Concluídos' },
  { id: 'todos', rotulo: 'Todos' },
];

const finalizado = (c: PortalChamado) => c.status === 'concluida' || c.status === 'cancelada';

export default function ChamadosTab() {
  const [chamados, setChamados] = useState<PortalChamado[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('andamento');
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    listarChamados()
      .then(setChamados)
      .catch((e: Error) => setErro(e.message));
  }, []);

  if (erro) return <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</p>;
  if (!chamados) {
    return (
      <div className="flex justify-center py-16 text-blue-600">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const lista = chamados.filter((c) => (filtro === 'todos' ? true : filtro === 'andamento' ? !finalizado(c) : finalizado(c)));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
              filtro === f.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {lista.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Nenhum chamado por aqui.
        </div>
      )}

      {lista.map((c) => {
        const st = infoStatusOS(c.status);
        const expandido = aberto === c.id;
        return (
          <article key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  OS {c.number} · {c.tipo}
                </h3>
                <p className="text-xs text-slate-500">Aberta em {formatarData(c.opened_at)}</p>
              </div>
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${st.classe}`}>{st.rotulo}</span>
            </div>

            {c.description && <p className="mt-3 text-sm whitespace-pre-line text-slate-700">{c.description}</p>}

            <div className="mt-3 space-y-1 text-xs text-slate-500">
              {c.endereco && (
                <p className="flex items-center gap-1.5">
                  <MapPin size={13} /> {c.endereco}
                </p>
              )}
              {c.proxima_visita && !finalizado(c) && (
                <p className="flex items-center gap-1.5 font-semibold text-blue-700">
                  <CalendarClock size={13} /> Visita agendada: {formatarDataHora(c.proxima_visita)}
                </p>
              )}
              {c.completed_at && (
                <p className="flex items-center gap-1.5">
                  <Wrench size={13} /> Concluída em {formatarData(c.completed_at)}
                </p>
              )}
            </div>

            {c.equipamentos.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setAberto(expandido ? null : c.id)}
                  className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                >
                  {c.equipamentos.length} equipamento(s) atendido(s) {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {expandido && (
                  <ul className="mt-2 space-y-2">
                    {c.equipamentos.map((e) => (
                      <li key={e.id} className="rounded-xl bg-slate-50 px-3 py-2 text-xs">
                        <b className="text-slate-800">{e.nome}</b>
                        {e.local && <span className="text-slate-500"> · {e.local}</span>}
                        <p className="mt-0.5 text-slate-600">{e.servico || 'Serviço ainda não detalhado.'}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
