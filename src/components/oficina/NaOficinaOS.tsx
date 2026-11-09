import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, ShieldCheck, Wrench } from 'lucide-react';
import { itensDaOS, itensDoCliente } from '../../services/oficina';
import type { ItemOficinaTela } from '../../types/oficina';
import { ROTULO_ETAPA, descricaoItem, numeroItem } from '../../utils/oficina';
import { formatarData } from '../../utils/ordens';
import { CORES_ETAPA, mapaTotaisPorOs } from './cores';
import ItemOficinaDetalhes from './ItemOficinaDetalhes';

// =====================================================================
// 1. Bloco "Na oficina" dentro de OrdemDetalhes (só admin/escritório)
// =====================================================================

interface NaOficinaOSProps {
  ordemId: string;
  onAlterado?: () => void | Promise<void>;
}

export default function NaOficinaOS({ ordemId, onAlterado }: NaOficinaOSProps) {
  const [itens, setItens] = useState<ItemOficinaTela[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [itemAbertoId, setItemAbertoId] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    try {
      const lista = await itensDaOS(ordemId);
      setItens(lista);
    } catch {
      // Se não houver acesso ou falhar silenciosamente, não quebra a tela da OS
    }
  }, [ordemId]);

  useEffect(() => {
    let ativo = true;
    itensDaOS(ordemId)
      .then((lista) => {
        if (ativo) setItens(lista);
      })
      .catch(() => {
        // Se não houver acesso ou falhar silenciosamente, não quebra a tela da OS
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [ordemId]);

  if (carregando || itens.length === 0) return null;

  const totaisPorOs = mapaTotaisPorOs(itens);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex items-center gap-2 text-slate-800">
        <Wrench size={18} className="text-blue-600" />
        <h2 className="text-base font-bold">Na oficina ({itens.length})</h2>
      </div>

      <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
        {itens.map((item) => {
          const ehDevolucaoDestaOs = item.return_service_order_id === ordemId;
          const totalOrigem = item.service_order_id ? totaisPorOs.get(item.service_order_id) : undefined;
          const codigo = numeroItem(item, totalOrigem);

          return (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50/80"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setItemAbertoId(item.id)}
                    className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:underline"
                  >
                    {ehDevolucaoDestaOs ? `Devolução de: ${codigo}` : codigo}
                    <ExternalLink size={13} />
                  </button>

                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CORES_ETAPA[item.status].selo}`}
                  >
                    {ROTULO_ETAPA[item.status]}
                  </span>

                  {item.is_warranty && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                      <ShieldCheck size={11} /> Garantia
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{descricaoItem(item)}</p>
              </div>

              <button
                type="button"
                onClick={() => setItemAbertoId(item.id)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Ver na oficina
              </button>
            </li>
          );
        })}
      </ul>

      {itemAbertoId && (
        <ItemOficinaDetalhes
          itemId={itemAbertoId}
          ordemPaiId={ordemId}
          onFechar={() => setItemAbertoId(null)}
          onAlterado={async () => {
            await recarregar();
            await onAlterado?.();
          }}
        />
      )}
    </div>
  );
}

// =====================================================================
// 2. Lista "Oficina" na aba Atendimento de ClienteDetalhes
// =====================================================================

interface ItensOficinaClienteProps {
  clienteId: string | 'novo';
}

export function ItensOficinaCliente({ clienteId }: ItensOficinaClienteProps) {
  const [itens, setItens] = useState<ItemOficinaTela[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [itemAbertoId, setItemAbertoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (clienteId === 'novo') return;
    setErro(null);
    try {
      const lista = await itensDoCliente(clienteId);
      setItens(lista);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar os itens da oficina.');
    }
  }, [clienteId]);

  useEffect(() => {
    if (clienteId === 'novo') return;
    let ativo = true;
    itensDoCliente(clienteId)
      .then((lista) => {
        if (ativo) {
          setErro(null);
          setItens(lista);
        }
      })
      .catch((e: unknown) => {
        if (ativo) {
          setErro(e instanceof Error ? e.message : 'Não foi possível carregar os itens da oficina.');
        }
      });
    return () => {
      ativo = false;
    };
  }, [clienteId, tentativa]);

  const totaisPorOs = mapaTotaisPorOs(itens ?? []);

  return (
    <div className="mx-6 mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex items-center gap-2 text-slate-800">
        <Wrench size={18} className="text-blue-600" />
        <h2 className="text-base font-bold">
          Oficina{itens ? ` (${itens.length})` : ''}
        </h2>
      </div>

      {clienteId === 'novo' ? (
        <p className="mt-4 text-xs text-slate-400">Salve o cliente para consultar itens na oficina.</p>
      ) : erro ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <span>{erro}</span>
          <button
            type="button"
            onClick={() => setTentativa((v) => v + 1)}
            className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1 font-semibold text-red-700 hover:bg-red-100"
          >
            <RefreshCw size={12} /> Tentar de novo
          </button>
        </div>
      ) : itens === null ? (
        <p className="mt-4 text-xs text-slate-400">Carregando...</p>
      ) : itens.length === 0 ? (
        <p className="mt-4 text-xs text-slate-400">
          Nenhum equipamento deste cliente registrado na oficina.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2.5">Item</th>
                <th className="px-3 py-2.5">Equipamento</th>
                <th className="px-3 py-2.5">Etapa</th>
                <th className="px-3 py-2.5">Técnico da oficina</th>
                <th className="px-3 py-2.5">Entrada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {itens.map((item) => {
                const totalOs = item.service_order_id ? totaisPorOs.get(item.service_order_id) : undefined;
                return (
                  <tr
                    key={item.id}
                    onClick={() => setItemAbertoId(item.id)}
                    className="cursor-pointer transition hover:bg-slate-50/80"
                  >
                    <td className="px-3 py-3 font-bold">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setItemAbertoId(item.id);
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        {numeroItem(item, totalOs)}
                      </button>
                      {item.is_warranty && (
                        <span className="ml-2 rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                          Garantia
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">{descricaoItem(item)}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CORES_ETAPA[item.status].selo}`}
                      >
                        {ROTULO_ETAPA[item.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-500">{item.bench_employee_name || '—'}</td>
                    <td className="px-3 py-3 text-slate-500">
                      {formatarData(item.received_at ?? item.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {itemAbertoId && (
        <ItemOficinaDetalhes
          itemId={itemAbertoId}
          ordemPaiId="cliente"
          onFechar={() => setItemAbertoId(null)}
          onAlterado={carregar}
        />
      )}
    </div>
  );
}
