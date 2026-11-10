import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { DragDropContext, Draggable, Droppable, type DragStart, type DropResult } from '@hello-pangea/dnd';
import { ArrowRight, Lock, Printer, X } from 'lucide-react';
import type { ProfileRole } from '../../types/fsm';
import type { EtapaOficina, ItemOficinaTela } from '../../types/oficina';
import {
  COLUNAS_KANBAN,
  ROTULO_ETAPA,
  descricaoItem,
  motivoBloqueio,
  numeroItem,
  podeMover,
} from '../../utils/oficina';
import CartaoItem from './CartaoItem';
import { CORES_ETAPA } from './cores';

type EtapaKanban = Exclude<EtapaOficina, 'entregue' | 'descarte' | 'cancelado'>;

interface KanbanOficinaProps {
  itens: ItemOficinaTela[];
  totaisPorOs: Map<string, number>;
  papel: ProfileRole | undefined;
  onAbrirItem: (id: string) => void;
  onMoverEtapa: (item: ItemOficinaTela, destino: EtapaKanban) => Promise<void>;
  onAvisoBloqueio: (mensagem: string) => void;
}

export default function KanbanOficina({
  itens,
  totaisPorOs,
  papel,
  onAbrirItem,
  onMoverEtapa,
  onAvisoBloqueio,
}: KanbanOficinaProps) {
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [etapaCelular, setEtapaCelular] = useState<EtapaOficina>('entrada');
  const [itemMoverCelular, setItemMoverCelular] = useState<ItemOficinaTela | null>(null);
  const [movendoCelular, setMovendoCelular] = useState(false);
  const dialogMoverRef = useRef<HTMLDialogElement>(null);

  const porColuna = useMemo(() => {
    const mapa = new Map<EtapaOficina, ItemOficinaTela[]>();
    for (const col of COLUNAS_KANBAN) mapa.set(col.etapa, []);
    for (const item of itens) {
      const lista = mapa.get(item.status);
      if (lista) lista.push(item);
    }
    return mapa;
  }, [itens]);

  const itemArrastando = useMemo(
    () => (arrastandoId ? itens.find((i) => i.id === arrastandoId) ?? null : null),
    [arrastandoId, itens],
  );

  useEffect(() => {
    const dlg = dialogMoverRef.current;
    if (!dlg) return;
    if (itemMoverCelular) {
      if (!dlg.open) dlg.showModal();
    } else if (dlg.open) {
      dlg.close();
    }
  }, [itemMoverCelular]);

  // Arrastar o fundo do quadro (fora dos cartões e botões) com o mouse rola para os lados, como a "mãozinha".
  const faixaRef = useRef<HTMLDivElement>(null);
  const comecarPanoramica = (e: ReactMouseEvent<HTMLDivElement>) => {
    const faixa = faixaRef.current;
    if (!faixa || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-rfd-draggable-id], button, a, input, select, textarea')) return;
    const xInicial = e.clientX;
    const rolagemInicial = faixa.scrollLeft;
    e.preventDefault();
    const mover = (ev: MouseEvent) => {
      faixa.scrollLeft = rolagemInicial - (ev.clientX - xInicial);
    };
    const soltar = () => {
      window.removeEventListener('mousemove', mover);
      window.removeEventListener('mouseup', soltar);
    };
    window.addEventListener('mousemove', mover);
    window.addEventListener('mouseup', soltar);
  };

  const aoIniciarArraste =(inicio: DragStart) => {
    setArrastandoId(inicio.draggableId);
  };

  const aoSoltar = (resultado: DropResult) => {
    setArrastandoId(null);
    const { destination, source, draggableId } = resultado;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const item = itens.find((i) => i.id === draggableId);
    if (!item) return;

    const destino = destination.droppableId as EtapaKanban;
    if (!podeMover(item, destino, papel)) {
      const motivo =
        motivoBloqueio(item, destino) ??
        `Não é permitido mover de "${ROTULO_ETAPA[item.status]}" para "${ROTULO_ETAPA[destino]}" com o seu perfil.`;
      onAvisoBloqueio(motivo);
      return;
    }

    void onMoverEtapa(item, destino);
  };

  const confirmarMoverCelular = async (destino: EtapaKanban) => {
    if (!itemMoverCelular) return;
    setMovendoCelular(true);
    try {
      await onMoverEtapa(itemMoverCelular, destino);
      setEtapaCelular(destino);
      setItemMoverCelular(null);
    } finally {
      setMovendoCelular(false);
    }
  };

  const colunaAtivaCelular = COLUNAS_KANBAN.find((c) => c.etapa === etapaCelular) ?? COLUNAS_KANBAN[1];
  const itensCelular = porColuna.get(colunaAtivaCelular.etapa) ?? [];

  return (
    <>
      {/* ================================================================= */}
      {/* CELULAR (< md): uma coluna por vez + chips roláveis + Mover para  */}
      {/* ================================================================= */}
      <div className="space-y-3 md:hidden">
        <div
          role="tablist"
          aria-label="Etapas da oficina"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {COLUNAS_KANBAN.map((col) => {
            const qtd = porColuna.get(col.etapa)?.length ?? 0;
            const ativa = col.etapa === colunaAtivaCelular.etapa;
            const estilo = CORES_ETAPA[col.etapa];
            return (
              <button
                key={col.etapa}
                type="button"
                role="tab"
                aria-selected={ativa}
                onClick={() => setEtapaCelular(col.etapa)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                  ativa
                    ? `${estilo.chipAtivo} shadow-xs`
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {!ativa && <span className={`h-2 w-2 rounded-full ${estilo.ponto}`} />}
                <span>{col.rotulo}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                    ativa ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {qtd}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className={`rounded-2xl border border-slate-200 border-t-4 bg-slate-100/70 p-3 ${CORES_ETAPA[colunaAtivaCelular.etapa].bordaTopo}`}
        >
          <div className="mb-3 flex items-center justify-between gap-2 px-1">
            <div>
              <h2 className="text-sm font-bold text-slate-800">{colunaAtivaCelular.rotulo}</h2>
              <p className="text-[11px] text-slate-500">{colunaAtivaCelular.quem}</p>
            </div>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-700 shadow-2xs">
              {itensCelular.length}
            </span>
          </div>

          {itensCelular.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-8 text-center text-xs text-slate-400">
              Nenhum item nesta etapa.
            </div>
          ) : (
            <div className="space-y-2.5">
              {itensCelular.map((item) => (
                <CartaoItem
                  key={item.id}
                  item={item}
                  totalNaOs={item.service_order_id ? totaisPorOs.get(item.service_order_id) : undefined}
                  onAbrir={onAbrirItem}
                  onAbrirMoverCelular={setItemMoverCelular}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* COMPUTADOR (>= md): Kanban completo com arraste                   */}
      {/* ================================================================= */}
      <div className="hidden md:block">
        <DragDropContext onDragStart={aoIniciarArraste} onDragEnd={aoSoltar}>
          <div
            ref={faixaRef}
            onMouseDown={comecarPanoramica}
            className="flex cursor-grab items-start gap-3.5 overflow-x-auto pb-4 active:cursor-grabbing"
          >
            {COLUNAS_KANBAN.map((col) => {
              const lista = porColuna.get(col.etapa) ?? [];
              const estilo = CORES_ETAPA[col.etapa];
              const mesmaColuna = itemArrastando?.status === col.etapa;
              const destinoPermitido = itemArrastando
                ? !mesmaColuna && podeMover(itemArrastando, col.etapa, papel)
                : true;
              const bloqueio =
                itemArrastando && !mesmaColuna && !destinoPermitido
                  ? motivoBloqueio(itemArrastando, col.etapa)
                  : null;

              return (
                <section
                  key={col.etapa}
                  aria-label={col.rotulo}
                  className={`flex w-72 shrink-0 flex-col rounded-2xl border border-slate-200 border-t-4 bg-slate-100/75 transition ${
                    estilo.bordaTopo
                  } ${
                    itemArrastando && !mesmaColuna && !destinoPermitido ? 'opacity-55' : ''
                  }`}
                >
                  {/* Cabeçalho da coluna */}
                  <div className="flex items-start justify-between gap-2 px-3.5 pt-3 pb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${estilo.ponto}`} />
                        <h2 className="truncate text-xs font-bold uppercase tracking-wide text-slate-800">
                          {col.rotulo}
                        </h2>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">{col.quem}</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold tabular-nums text-slate-700 shadow-2xs">
                      {lista.length}
                    </span>
                  </div>

                  {bloqueio && (
                    <p className="mx-3 mb-1.5 flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
                      <Lock size={11} className="shrink-0" />
                      <span className="truncate">{bloqueio}</span>
                    </p>
                  )}

                  <Droppable droppableId={col.etapa}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-32 flex-1 space-y-2.5 rounded-b-2xl px-2.5 pt-1 pb-3 transition ${
                          snapshot.isDraggingOver
                            ? destinoPermitido
                              ? 'bg-blue-50/80 ring-2 ring-inset ring-blue-400/50'
                              : 'bg-rose-50/60 ring-2 ring-inset ring-rose-300/60'
                            : ''
                        }`}
                      >
                        {lista.length === 0 && !snapshot.isDraggingOver && (
                          <div className="rounded-xl border border-dashed border-slate-200/90 bg-white/50 px-3 py-6 text-center text-[11px] text-slate-400">
                            Nenhum item
                          </div>
                        )}

                        {lista.map((item, indice) => (
                          <Draggable key={item.id} draggableId={item.id} index={indice}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !dragSnapshot.isDragging) {
                                    e.preventDefault();
                                    onAbrirItem(item.id);
                                  }
                                }}
                                className="focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                              >
                                <CartaoItem
                                  item={item}
                                  totalNaOs={
                                    item.service_order_id ? totaisPorOs.get(item.service_order_id) : undefined
                                  }
                                  arrastando={dragSnapshot.isDragging}
                                  interativoComoBloco
                                  onAbrir={onAbrirItem}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </section>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Modal "Mover para..." do celular */}
      <dialog
        ref={dialogMoverRef}
        onCancel={(e) => {
          e.preventDefault();
          if (!movendoCelular) setItemMoverCelular(null);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !movendoCelular) setItemMoverCelular(null);
        }}
        aria-labelledby="titulo-mover-celular"
        className="m-auto w-[calc(100%-1.5rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-xs"
      >
        {itemMoverCelular && (
          <div className="p-5">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 id="titulo-mover-celular" className="text-base font-bold text-slate-900">
                  Mover {numeroItem(itemMoverCelular, itemMoverCelular.service_order_id ? totaisPorOs.get(itemMoverCelular.service_order_id) : undefined)}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">{descricaoItem(itemMoverCelular)}</p>
              </div>
              <button
                type="button"
                onClick={() => setItemMoverCelular(null)}
                disabled={movendoCelular}
                aria-label="Fechar"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-3 max-h-[65dvh] space-y-2 overflow-y-auto">
              {COLUNAS_KANBAN.filter((c) => c.etapa !== itemMoverCelular.status).map((col) => {
                const permitido = podeMover(itemMoverCelular, col.etapa, papel);
                const motivo = !permitido
                  ? motivoBloqueio(itemMoverCelular, col.etapa) ?? 'Reservado ao escritório'
                  : null;
                const ehRecebimento =
                  itemMoverCelular.status === 'em_transito' && col.etapa === 'entrada';

                return (
                  <button
                    key={col.etapa}
                    type="button"
                    disabled={!permitido || movendoCelular}
                    onClick={() => void confirmarMoverCelular(col.etapa as EtapaKanban)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                      permitido
                        ? 'border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/50 active:bg-blue-50'
                        : 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${CORES_ETAPA[col.etapa].ponto}`} />
                        <span className="text-sm font-semibold text-slate-800">{col.rotulo}</span>
                        {ehRecebimento && permitido && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            <Printer size={10} /> Etiqueta
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">{motivo ?? col.quem}</p>
                    </div>
                    {permitido ? (
                      <ArrowRight size={16} className="shrink-0 text-blue-600" />
                    ) : (
                      <Lock size={14} className="shrink-0 text-slate-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}

