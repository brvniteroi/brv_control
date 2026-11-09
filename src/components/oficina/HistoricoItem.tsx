import { useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  History,
  Loader2,
  MessageSquarePlus,
  Pencil,
  PlusCircle,
} from 'lucide-react';
import { anotarNoHistorico } from '../../services/oficina';
import type {
  EventoOficina,
  SituacaoPecas,
  UnidadeRecolhida,
} from '../../types/oficina';
import {
  ROTULO_ETAPA,
  ROTULO_PECAS,
  ROTULO_UNIDADE,
  valorEmReais,
} from '../../utils/oficina';
import { formatarDataHora } from '../../utils/ordens';
import { CORES_ETAPA, ROTULO_CAMPO_HISTORICO } from './cores';

const CAMPOS_FEMININOS = new Set([
  'units_collected',
  'brand',
  'capacity_btu',
  'voltage',
  'intake_notes',
  'parts_needed',
  'parts_status',
  'is_warranty',
  'warranty_origin_id',
  'return_service_order_id',
  'service_order_id',
  'task_id',
]);

function tituloAlteracao(chaves: string[]): string {
  if (chaves.length === 0) return 'Dados alterados';
  if (chaves.length === 1) {
    const k = chaves[0];
    const nome = ROTULO_CAMPO_HISTORICO[k] ?? k;
    if (k === 'accessories') return `${nome} alterados`;
    if (k === 'parts_needed') return `${nome} alteradas`;
    return `${nome} ${CAMPOS_FEMININOS.has(k) ? 'alterada' : 'alterado'}`;
  }
  const nomes = chaves.map((k) => ROTULO_CAMPO_HISTORICO[k] ?? k);
  return `${nomes.join(', ')} alterados`;
}

function formatarValorCampo(
  campo: string,
  valor: unknown,
  nomesFuncionarios: Map<string, string>,
): string {
  if (valor === null || valor === undefined || valor === '') return 'Vazio';
  if (campo === 'is_warranty') return valor ? 'Sim' : 'Não';
  if (campo === 'units_collected' && typeof valor === 'string' && valor in ROTULO_UNIDADE) {
    return ROTULO_UNIDADE[valor as UnidadeRecolhida];
  }
  if (campo === 'parts_status' && typeof valor === 'string' && valor in ROTULO_PECAS) {
    return ROTULO_PECAS[valor as SituacaoPecas];
  }
  if (campo === 'quote_amount') {
    return valorEmReais(valor as number | string) || String(valor);
  }
  if (campo === 'quote_sent_at' && typeof valor === 'string') {
    return formatarDataHora(valor);
  }
  if ((campo === 'bench_employee_id' || campo === 'pickup_employee_id') && typeof valor === 'string') {
    return nomesFuncionarios.get(valor) ?? ' Técnico atualizado';
  }
  if (campo === 'capacity_btu') {
    return `${Number(valor).toLocaleString('pt-BR')} BTUs`;
  }
  return String(valor);
}

interface HistoricoItemProps {
  itemId: string;
  eventos: EventoOficina[];
  carregando: boolean;
  somenteLeitura: boolean;
  nomesFuncionarios: Map<string, string>;
  onAnotado: () => Promise<void> | void;
}

export default function HistoricoItem({
  itemId,
  eventos,
  carregando,
  somenteLeitura,
  nomesFuncionarios,
  onAnotado,
}: HistoricoItemProps) {
  const [nota, setNota] = useState('');
  const [salvandoNota, setSalvandoNota] = useState(false);
  const [erroNota, setErroNota] = useState<string | null>(null);

  const enviarNota = async (e: FormEvent) => {
    e.preventDefault();
    if (!nota.trim()) return;
    setSalvandoNota(true);
    setErroNota(null);
    try {
      await anotarNoHistorico(itemId, nota);
      setNota('');
      await onAnotado();
    } catch (err) {
      setErroNota(err instanceof Error ? err.message : 'Não foi possível salvar a anotação.');
    } finally {
      setSalvandoNota(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
      <div className="flex items-center gap-2 text-slate-800">
        <History size={18} className="text-blue-600" />
        <h2 className="text-base font-bold">Histórico ({eventos.length})</h2>
      </div>

      {carregando ? (
        <p className="mt-4 text-xs text-slate-400">Carregando histórico...</p>
      ) : eventos.length === 0 ? (
        <p className="mt-4 text-xs text-slate-400">Nenhum evento registrado ainda.</p>
      ) : (
        <ol className="relative mt-5 ml-3 space-y-4 border-l-2 border-slate-200 pl-5">
          {eventos.map((ev) => {
            const autor = ev.actor_name || 'Sistema';
            const dataHora = formatarDataHora(ev.created_at);

            if (ev.event === 'descarte_autorizado') {
              return (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[29px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-white ring-4 ring-white">
                    <AlertTriangle size={10} />
                  </span>
                  <div className="rounded-xl border-2 border-rose-200 bg-rose-50/80 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                      <span className="font-bold text-rose-900">Descarte autorizado pelo cliente</span>
                      <span className="text-[11px] text-rose-700">
                        {autor} · {dataHora}
                      </span>
                    </div>
                    {ev.note && <p className="mt-1.5 whitespace-pre-line text-xs text-rose-900">{ev.note}</p>}
                  </div>
                </li>
              );
            }

            if (ev.event === 'criado') {
              return (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[29px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white ring-4 ring-white">
                    <PlusCircle size={10} />
                  </span>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-800">Entrada registrada</span>
                    {ev.to_status && (
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CORES_ETAPA[ev.to_status].selo}`}
                      >
                        {ROTULO_ETAPA[ev.to_status]}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">
                      por {autor} · {dataHora}
                    </span>
                  </div>
                </li>
              );
            }

            if (ev.event === 'etapa') {
              return (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[29px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-white ring-4 ring-white">
                    <ArrowRight size={10} />
                  </span>
                  <div className="space-y-1 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {ev.from_status && (
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CORES_ETAPA[ev.from_status].selo}`}
                        >
                          {ROTULO_ETAPA[ev.from_status]}
                        </span>
                      )}
                      <ArrowRight size={12} className="text-slate-400" />
                      {ev.to_status && (
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CORES_ETAPA[ev.to_status].selo}`}
                        >
                          {ROTULO_ETAPA[ev.to_status]}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">
                        por {autor} · {dataHora}
                      </span>
                    </div>
                    {ev.note && (
                      <p className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
                        Motivo: {ev.note}
                      </p>
                    )}
                  </div>
                </li>
              );
            }

            if (ev.event === 'decisao') {
              return (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[29px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white ring-4 ring-white">
                    <CheckCircle2 size={10} />
                  </span>
                  <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-bold text-slate-800">Resposta do cliente ao orçamento</span>
                      <span className="text-[11px] text-slate-500">
                        {autor} · {dataHora}
                      </span>
                    </div>
                    {ev.note && <p className="mt-1 whitespace-pre-line text-slate-700">{ev.note}</p>}
                  </div>
                </li>
              );
            }

            if (ev.event === 'alteracao') {
              const entradas = Object.entries(ev.changes ?? {});
              const chaves = entradas.map(([k]) => k);
              return (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[29px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-400 text-white ring-4 ring-white">
                    <Pencil size={9} />
                  </span>
                  <div className="text-xs">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-semibold text-slate-800">{tituloAlteracao(chaves)}</span>
                      <span className="text-[11px] text-slate-400">
                        por {autor} · {dataHora}
                      </span>
                    </div>

                    {entradas.length > 0 && (
                      <details className="mt-1 group">
                        <summary className="cursor-pointer select-none text-[11px] font-semibold text-blue-600 hover:underline">
                          Ver antes e depois
                        </summary>
                        <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          {entradas.map(([campo, par]) => {
                            const antes = Array.isArray(par) ? par[0] : null;
                            const depois = Array.isArray(par) ? par[1] : null;
                            return (
                              <div key={campo} className="text-[11px]">
                                <p className="font-bold text-slate-700">
                                  {ROTULO_CAMPO_HISTORICO[campo] ?? campo}
                                </p>
                                <div className="mt-0.5 grid grid-cols-1 gap-1 sm:grid-cols-2">
                                  <div className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-500">
                                    <span className="font-semibold text-slate-400">Antes: </span>
                                    <span className="whitespace-pre-line">
                                      {formatarValorCampo(campo, antes, nomesFuncionarios)}
                                    </span>
                                  </div>
                                  <div className="rounded-md border border-blue-200 bg-blue-50/50 px-2 py-1 text-slate-800">
                                    <span className="font-semibold text-blue-600">Depois: </span>
                                    <span className="whitespace-pre-line">
                                      {formatarValorCampo(campo, depois, nomesFuncionarios)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    )}
                  </div>
                </li>
              );
            }

            // ev.event === 'nota'
            return (
              <li key={ev.id} className="relative">
                <span className="absolute -left-[29px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white ring-4 ring-white">
                  <MessageSquarePlus size={9} />
                </span>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700">{autor}</span>
                    <span>{dataHora}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-slate-800">{ev.note}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Formulário "Anotar no histórico" */}
      {!somenteLeitura && (
        <form onSubmit={enviarNota} className="mt-5 border-t border-slate-100 pt-4">
          <label htmlFor="oficina-anotar-historico" className="block text-xs font-semibold text-slate-700">
            Anotar no histórico
          </label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <textarea
              id="oficina-anotar-historico"
              rows={2}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Escreva uma observação sobre este equipamento..."
              className="block min-h-[4.5rem] w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-800 [field-sizing:content] placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:text-xs"
            />
            <button
              type="submit"
              disabled={salvandoNota || !nota.trim()}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 self-end rounded-xl bg-brv-navy px-4 py-2.5 text-xs font-bold text-white transition hover:opacity-95 disabled:opacity-40 sm:self-stretch"
            >
              {salvandoNota ? <Loader2 size={14} className="animate-spin" /> : <MessageSquarePlus size={14} />}
              Salvar anotação
            </button>
          </div>
          {erroNota && <p className="mt-2 text-xs font-medium text-red-600">{erroNota}</p>}
        </form>
      )}
    </section>
  );
}

