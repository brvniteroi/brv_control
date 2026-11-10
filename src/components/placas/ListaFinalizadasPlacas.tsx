import { ChevronLeft, ChevronRight, RotateCcw, ShieldCheck } from 'lucide-react';
import type { ProfileRole } from '../../types/fsm';
import type { BoardOrder } from '../../types/placas';
import { valorEmReais } from '../../utils/oficina';
import { formatarData } from '../../utils/ordens';
import { CORES_ETAPA_PLACA, CORES_TIPO_CLIENTE_PLACA } from './cores';
import {
  PLACAS_FINALIZADAS_POR_PAGINA,
  ROTULO_ETAPA_PLACA,
  ehEscritorioOuAdminPlaca,
  valorReceitaPlaca,
} from './regrasPlacas';

interface ListaFinalizadasPlacasProps {
  itens: BoardOrder[];
  total: number;
  pagina: number;
  desfecho: 'todas' | 'entregue' | 'sem_conserto';
  ano: number;
  papel: ProfileRole | undefined;
  podeVerFinanceiro: boolean;
  onMudarDesfecho: (d: 'todas' | 'entregue' | 'sem_conserto') => void;
  onMudarAno: (ano: number) => void;
  onMudarPagina: (pagina: number) => void;
  onAbrirPlaca: (id: string) => void;
}

const ANO_ATUAL_PADRAO = new Date().getFullYear();

export default function ListaFinalizadasPlacas({
  itens,
  total,
  pagina,
  desfecho,
  ano,
  papel,
  podeVerFinanceiro,
  onMudarDesfecho,
  onMudarAno,
  onMudarPagina,
  onAbrirPlaca,
}: ListaFinalizadasPlacasProps) {
  const anosDisponiveis = [ANO_ATUAL_PADRAO, ANO_ATUAL_PADRAO - 1, ANO_ATUAL_PADRAO - 2];
  const mostrarValores = ehEscritorioOuAdminPlaca(papel);
  const totalPaginas = Math.max(1, Math.ceil(total / PLACAS_FINALIZADAS_POR_PAGINA));

  return (
    <div className="space-y-4">
      {/* Filtros de desfecho e ano */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtro de desfecho">
          {(
            [
              { valor: 'todas', rotulo: 'Todas' },
              { valor: 'entregue', rotulo: 'Entregue / Faturado' },
              { valor: 'sem_conserto', rotulo: 'Sem Conserto / Devolvido' },
            ] as const
          ).map((op) => (
            <button
              key={op.valor}
              type="button"
              onClick={() => onMudarDesfecho(op.valor)}
              aria-pressed={desfecho === op.valor}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                desfecho === op.valor
                  ? 'border-brv-navy bg-brv-navy text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {op.rotulo}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="placas-finalizadas-ano" className="text-xs font-semibold text-slate-600">
            Ano:
          </label>
          <select
            id="placas-finalizadas-ano"
            value={ano}
            onChange={(e) => onMudarAno(Number(e.target.value))}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-blue-600 focus:outline-none"
          >
            {anosDisponiveis.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {itens.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-bold text-slate-700">
            Nenhuma placa finalizada encontrada para este filtro em {ano}.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Ajuste o desfecho, o ano ou o termo pesquisado na barra superior.
          </p>
        </div>
      ) : (
        <>
          {/* Cartões no celular */}
          <div className="space-y-2.5 md:hidden">
            {itens.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onAbrirPlaca(p.id)}
                className="block w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:border-blue-300"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-extrabold text-brv-navy">
                    {p.board_number}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CORES_ETAPA_PLACA[p.status].selo}`}
                  >
                    {ROTULO_ETAPA_PLACA[p.status]}
                  </span>
                </div>
                <p className="mt-1.5 text-xs font-bold text-slate-900">{p.customer_name}</p>
                <p className="mt-0.5 text-xs text-slate-600">
                  {p.brand_model} · <span className="font-mono">{p.board_code}</span>
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Saída: {formatarData(p.finished_at ?? p.stage_changed_at)}</span>
                  {mostrarValores && p.status === 'entregue' && (
                    <span className="font-bold text-slate-900">
                      {valorEmReais(valorReceitaPlaca(p)) || '—'}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Tabela semântica no computador */}
          <div
            tabIndex={0}
            role="region"
            aria-label="Lista de placas finalizadas"
            className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs md:block"
          >
            <table className="w-full border-collapse text-left text-xs">
              <caption className="sr-only">
                Placas finalizadas e arquivadas no ano de {ano}
              </caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold tracking-wide text-slate-600 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Placa
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Cliente
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Equipamento / Código
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Desfecho
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Data de Saída
                  </th>
                  {mostrarValores && (
                    <th scope="col" className="px-4 py-3 text-right">
                      Valor
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itens.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => onAbrirPlaca(p.id)}
                    className="cursor-pointer transition hover:bg-blue-50/40"
                  >
                    <th scope="row" className="px-4 py-3 font-mono font-bold text-brv-navy">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAbrirPlaca(p.id);
                        }}
                        className="text-left hover:underline"
                      >
                        {p.board_number}
                      </button>
                    </th>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{p.customer_name}</div>
                      <span
                        className={`mt-0.5 inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold ${CORES_TIPO_CLIENTE_PLACA[p.customer_kind].selo}`}
                      >
                        {CORES_TIPO_CLIENTE_PLACA[p.customer_kind].rotuloCurto}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-800">{p.brand_model}</div>
                      <div className="font-mono text-[11px] text-slate-500">{p.board_code}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CORES_ETAPA_PLACA[p.status].selo}`}
                        >
                          {ROTULO_ETAPA_PLACA[p.status]}
                        </span>
                        {p.is_warranty && (
                          <span className="inline-flex items-center gap-1 rounded border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-800">
                            <ShieldCheck size={11} aria-hidden="true" />
                            Garantia
                          </span>
                        )}
                        {podeVerFinanceiro && p.refunded && (
                          <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                            <RotateCcw size={11} aria-hidden="true" />
                            Reembolsada
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {formatarData(p.finished_at ?? p.stage_changed_at)}
                    </td>
                    {mostrarValores && (
                      <td className="px-4 py-3 text-right font-bold whitespace-nowrap text-slate-900">
                        {p.status === 'entregue'
                          ? valorEmReais(
                              podeVerFinanceiro ? valorReceitaPlaca(p) : (p.quote_amount ?? null),
                            ) || '—'
                          : '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
              <span>
                Mostrando página <strong>{pagina}</strong> de <strong>{totalPaginas}</strong> ({total}{' '}
                registro(s))
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={pagina <= 1}
                  onClick={() => onMudarPagina(pagina - 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={pagina >= totalPaginas}
                  onClick={() => onMudarPagina(pagina + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold hover:bg-slate-50 disabled:opacity-40"
                >
                  Próxima
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
