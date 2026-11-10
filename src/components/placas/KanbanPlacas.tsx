import { useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { ArrowRight, Lock } from 'lucide-react';
import type { ProfileRole } from '../../types/fsm';
import type { BoardOrder, BoardStage } from '../../types/placas';
import CartaoPlaca from './CartaoPlaca';
import { CORES_ETAPA_PLACA } from './cores';
import ModalDialogoPlacas from './ModalDialogoPlacas';
import {
  ETAPAS_KANBAN_PLACA,
  ROTULO_ETAPA_PLACA,
  motivoBloqueioPlaca,
  podeMoverPlaca,
} from './regrasPlacas';

interface KanbanPlacasProps {
  placas: BoardOrder[];
  papel: ProfileRole | undefined;
  podeVerFinanceiro: boolean;
  onAbrirPlaca: (id: string) => void;
  onMoverPlaca: (placa: BoardOrder, destino: BoardStage) => Promise<void>;
  onAvisoBloqueio: (mensagem: string) => void;
}

export default function KanbanPlacas({
  placas,
  papel,
  podeVerFinanceiro,
  onAbrirPlaca,
  onMoverPlaca,
  onAvisoBloqueio,
}: KanbanPlacasProps) {
  const [etapaCelular, setEtapaCelular] = useState<BoardStage>('entrada');
  const [placaMoverCelular, setPlacaMoverCelular] = useState<BoardOrder | null>(null);
  const [movendoCelular, setMovendoCelular] = useState(false);

  const porColuna = useMemo(() => {
    const mapa = new Map<BoardStage, BoardOrder[]>();
    for (const col of ETAPAS_KANBAN_PLACA) mapa.set(col.etapa, []);
    for (const p of placas) {
      const lista = mapa.get(p.status);
      if (lista) lista.push(p);
    }
    return mapa;
  }, [placas]);

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

  const aoSoltar = (resultado: DropResult) => {
    const { destination, source, draggableId } = resultado;
    if (!destination || destination.droppableId === source.droppableId) return;

    const placa = placas.find((p) => p.id === draggableId);
    if (!placa) return;

    const destino = destination.droppableId as BoardStage;
    const bloqueio = motivoBloqueioPlaca(placa, destino, papel);
    if (bloqueio) {
      onAvisoBloqueio(bloqueio);
      return;
    }

    void onMoverPlaca(placa, destino);
  };

  const confirmarMoverCelular = async (destino: BoardStage) => {
    if (!placaMoverCelular) return;
    setMovendoCelular(true);
    try {
      await onMoverPlaca(placaMoverCelular, destino);
      setEtapaCelular(destino);
      setPlacaMoverCelular(null);
    } finally {
      setMovendoCelular(false);
    }
  };

  const colunaAtivaCelular =
    ETAPAS_KANBAN_PLACA.find((c) => c.etapa === etapaCelular) ?? ETAPAS_KANBAN_PLACA[0];
  const placasCelular = porColuna.get(colunaAtivaCelular.etapa) ?? [];

  return (
    <>
      {/* CELULAR (< md): uma coluna por vez com chips roláveis */}
      <div className="space-y-3 md:hidden">
        <div
          role="tablist"
          aria-label="Etapas do laboratório de placas"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {ETAPAS_KANBAN_PLACA.map((col) => {
            const qtd = porColuna.get(col.etapa)?.length ?? 0;
            const ativa = col.etapa === colunaAtivaCelular.etapa;
            const estilo = CORES_ETAPA_PLACA[col.etapa];
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
                <span>{col.rotuloCurto}</span>
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
          className={`rounded-2xl border border-slate-200 border-t-4 bg-slate-100/70 p-3 ${CORES_ETAPA_PLACA[colunaAtivaCelular.etapa].bordaTopo}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">{colunaAtivaCelular.rotulo}</h2>
              <p className="text-[11px] text-slate-500">{colunaAtivaCelular.quemMexe}</p>
            </div>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-slate-700 shadow-2xs">
              {placasCelular.length}
            </span>
          </div>

          {placasCelular.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white/70 py-8 text-center text-xs text-slate-500">
              Nenhuma placa nesta etapa.
            </p>
          ) : (
            <div className="space-y-2.5">
              {placasCelular.map((placa) => (
                <CartaoPlaca
                  key={placa.id}
                  placa={placa}
                  papel={papel}
                  podeVerFinanceiro={podeVerFinanceiro}
                  onAbrir={onAbrirPlaca}
                  onMoverRapido={(p, dest) => void onMoverPlaca(p, dest)}
                  onAvisoBloqueio={onAvisoBloqueio}
                  onAbrirSeletorCelular={setPlacaMoverCelular}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* COMPUTADOR (>= md): 6 colunas com arraste @hello-pangea/dnd */}
      <div className="hidden md:block">
        <DragDropContext onDragEnd={aoSoltar}>
          <div
            ref={faixaRef}
            onMouseDown={comecarPanoramica}
            className="flex cursor-grab gap-3 overflow-x-auto pb-3 active:cursor-grabbing"
          >
            {ETAPAS_KANBAN_PLACA.map((col) => {
              const lista = porColuna.get(col.etapa) ?? [];
              const estilo = CORES_ETAPA_PLACA[col.etapa];

              return (
                <div
                  key={col.etapa}
                  className={`flex w-72 shrink-0 flex-col rounded-2xl border border-slate-200 border-t-4 bg-slate-100/80 ${estilo.bordaTopo}`}
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 px-3.5 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${estilo.ponto}`} />
                        <h2 className="truncate text-xs font-extrabold text-slate-900">
                          {col.rotulo}
                        </h2>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">{col.quemMexe}</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold tabular-nums text-slate-700 shadow-2xs">
                      {lista.length}
                    </span>
                  </div>

                  <Droppable droppableId={col.etapa}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[260px] flex-1 space-y-2.5 p-2.5 transition-colors ${
                          snapshot.isDraggingOver ? 'bg-blue-50/70' : ''
                        }`}
                      >
                        {lista.length === 0 && !snapshot.isDraggingOver && (
                          <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-300/80 bg-white/50 px-3 text-center text-xs text-slate-400">
                            Sem placas
                          </div>
                        )}

                        {lista.map((placa, indice) => (
                          <Draggable key={placa.id} draggableId={placa.id} index={indice}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={dragSnapshot.isDragging ? 'rotate-1 shadow-xl' : ''}
                              >
                                <CartaoPlaca
                                  placa={placa}
                                  papel={papel}
                                  podeVerFinanceiro={podeVerFinanceiro}
                                  onAbrir={onAbrirPlaca}
                                  onMoverRapido={(p, dest) => void onMoverPlaca(p, dest)}
                                  onAvisoBloqueio={onAvisoBloqueio}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Modal de escolha rápida de etapa no celular */}
      <ModalDialogoPlacas
        aberto={Boolean(placaMoverCelular)}
        onFechar={() => setPlacaMoverCelular(null)}
        titulo={placaMoverCelular ? `Mover ${placaMoverCelular.board_number}` : 'Mover etapa'}
        subtitulo={
          placaMoverCelular
            ? `Etapa atual: ${ROTULO_ETAPA_PLACA[placaMoverCelular.status]}`
            : undefined
        }
        larguraMax="max-w-md"
      >
        {placaMoverCelular && (
          <div className="space-y-2">
            {ETAPAS_KANBAN_PLACA.filter((c) => c.etapa !== placaMoverCelular.status).map((col) => {
              const permitido = podeMoverPlaca(placaMoverCelular, col.etapa, papel);
              const motivo = motivoBloqueioPlaca(placaMoverCelular, col.etapa, papel);
              return (
                <button
                  key={col.etapa}
                  type="button"
                  disabled={!permitido || movendoCelular}
                  onClick={() => void confirmarMoverCelular(col.etapa)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left text-xs transition ${
                    permitido
                      ? 'border-slate-200 bg-white text-slate-900 hover:border-blue-300 hover:bg-blue-50/40'
                      : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                  }`}
                >
                  <div>
                    <div className="font-bold">{col.rotulo}</div>
                    {motivo && <div className="mt-0.5 text-[11px] text-slate-500">{motivo}</div>}
                  </div>
                  {permitido ? (
                    <ArrowRight size={15} className="shrink-0 text-blue-600" aria-hidden="true" />
                  ) : (
                    <Lock size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </ModalDialogoPlacas>
    </>
  );
}

