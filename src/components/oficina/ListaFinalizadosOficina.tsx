import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, PackageCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { ITENS_POR_PAGINA, listarItensFinalizados } from '../../services/oficina';
import type { ItemOficinaTela } from '../../types/oficina';
import { ROTULO_ETAPA, descricaoItem, numeroItem } from '../../utils/oficina';
import { formatarData } from '../../utils/ordens';
import { CORES_ETAPA, mapaTotaisPorOs } from './cores';

type FiltroEtapaFinal = 'todos' | 'entregue' | 'descarte' | 'cancelado';

const FILTROS_FINAIS: { valor: FiltroEtapaFinal; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'entregue', rotulo: 'Entregue' },
  { valor: 'descarte', rotulo: 'Descartado' },
  { valor: 'cancelado', rotulo: 'Cancelado' },
];

interface ListaFinalizadosOficinaProps {
  busca: string;
  versao: number;
  onAbrirItem: (id: string) => void;
}

export default function ListaFinalizadosOficina({
  busca,
  versao,
  onAbrirItem,
}: ListaFinalizadosOficinaProps) {
  const [etapa, setEtapa] = useState<FiltroEtapaFinal>('todos');
  const [pagina, setPagina] = useState(0);
  const [buscaDebounced, setBuscaDebounced] = useState(busca);
  const [itens, setItens] = useState<ItemOficinaTela[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaDebounced(busca);
      setPagina(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  useEffect(() => {
    let ativo = true;
    const buscar = async () => {
      setCarregando(true);
      setErro(null);
      try {
        const resposta = await listarItensFinalizados({
          pagina,
          busca: buscaDebounced,
          etapa: etapa === 'todos' ? undefined : etapa,
        });
        if (!ativo) return;
        setItens(resposta.itens);
        setTotal(resposta.total);
      } catch (e) {
        if (!ativo) return;
        setErro(e instanceof Error ? e.message : 'Não foi possível carregar os itens finalizados.');
      } finally {
        if (ativo) setCarregando(false);
      }
    };
    void buscar();
    return () => {
      ativo = false;
    };
  }, [pagina, buscaDebounced, etapa, versao, tentativa]);

  const trocarFiltro = useCallback((novo: FiltroEtapaFinal) => {
    setEtapa(novo);
    setPagina(0);
  }, []);

  const totaisPorOs = mapaTotaisPorOs(itens);
  const totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));

  return (
    <div className="space-y-4">
      {/* Filtros por situação final */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por situação final">
          {FILTROS_FINAIS.map((f) => {
            const ativo = etapa === f.valor;
            return (
              <button
                key={f.valor}
                type="button"
                aria-pressed={ativo}
                onClick={() => trocarFiltro(f.valor)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  ativo
                    ? 'border-brv-navy bg-brv-navy text-white shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.rotulo}
              </button>
            );
          })}
        </div>

        {!carregando && !erro && (
          <span className="text-xs text-slate-500">
            {total === 1 ? '1 item finalizado' : `${total} itens finalizados`}
          </span>
        )}
      </div>

      {/* Estados: Carregando / Erro / Vazio / Lista */}
      {carregando ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-2xs">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          <span className="text-sm font-medium">Carregando itens finalizados...</span>
        </div>
      ) : erro ? (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-8 text-center"
        >
          <AlertCircle size={28} className="text-red-600" />
          <p className="max-w-md text-sm font-medium text-red-800">{erro}</p>
          <button
            type="button"
            onClick={() => setTentativa((v) => v + 1)}
            className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
          >
            <RefreshCw size={14} />
            Tentar de novo
          </button>
        </div>
      ) : itens.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <PackageCheck size={32} className="text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">Nenhum item finalizado encontrado</p>
          <p className="max-w-sm text-xs text-slate-400">
            {buscaDebounced.trim() || etapa !== 'todos'
              ? 'Tente ajustar a busca ou mudar o filtro de situação acima.'
              : 'Os equipamentos entregues, descartados ou cancelados aparecerão aqui.'}
          </p>
        </div>
      ) : (
        <>
          {/* Cartões no celular */}
          <div className="space-y-2.5 md:hidden">
            {itens.map((item) => {
              const totalOs = item.service_order_id ? totaisPorOs.get(item.service_order_id) : undefined;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onAbrirItem(item.id)}
                  className="block w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:border-blue-300"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-bold text-brv-navy">{numeroItem(item, totalOs)}</span>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CORES_ETAPA[item.status].selo}`}
                    >
                      {ROTULO_ETAPA[item.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-800">
                    {item.customer_name || 'Cliente não informado'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{descricaoItem(item)}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                    <span>
                      Finalizado em {item.finished_at ? formatarData(item.finished_at) : formatarData(item.updated_at)}
                    </span>
                    {item.is_warranty && (
                      <span className="inline-flex items-center gap-1 font-semibold text-indigo-600">
                        <ShieldCheck size={11} /> Garantia
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tabela no computador */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs md:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Equipamento</th>
                    <th className="px-4 py-3">Situação</th>
                    <th className="px-4 py-3">Técnico da oficina</th>
                    <th className="px-4 py-3">Finalizado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {itens.map((item) => {
                    const totalOs = item.service_order_id ? totaisPorOs.get(item.service_order_id) : undefined;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => onAbrirItem(item.id)}
                        className="cursor-pointer transition hover:bg-blue-50/40"
                      >
                        <td className="px-4 py-3 font-bold text-brv-navy">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAbrirItem(item.id);
                              }}
                              className="text-left font-bold text-blue-600 hover:underline"
                            >
                              {numeroItem(item, totalOs)}
                            </button>
                            {item.is_warranty && (
                              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                                Garantia
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {item.customer_name || '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{descricaoItem(item)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CORES_ETAPA[item.status].selo}`}
                          >
                            {ROTULO_ETAPA[item.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{item.bench_employee_name || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {item.finished_at ? formatarData(item.finished_at) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginação */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600">
              <span>
                Página <strong>{pagina + 1}</strong> de <strong>{totalPaginas}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagina === 0}
                  onClick={() => setPagina((p) => Math.max(0, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold transition hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <button
                  type="button"
                  disabled={pagina + 1 >= totalPaginas}
                  onClick={() => setPagina((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold transition hover:bg-slate-50 disabled:opacity-40"
                >
                  Próxima <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

