import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalDialogoPlacasProps {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  subtitulo?: string;
  larguraMax?: 'max-w-md' | 'max-w-lg' | 'max-w-2xl' | 'max-w-3xl' | 'max-w-4xl';
  /** Quando `true` (padrão), clique/toque fora da caixa fecha o diálogo; em formulários com dados sujos use `false`. */
  fecharAoClicarFora?: boolean;
  children: ReactNode;
}

const ESTILO_DIALOGO_MODAL = `
dialog.placas-modal-nativo:modal {
  overscroll-behavior: contain;
}
dialog.placas-modal-nativo::backdrop {
  background: rgb(15 23 42 / 0.55);
  backdrop-filter: blur(2px);
  overflow: hidden;
  overscroll-behavior: contain;
}
`;

/**
 * Modal acessível baseado no elemento nativo `<dialog>` aberto com `.showModal()`.
 * Garante topo de camada, retorno automático de foco, tecla `Esc` nativa e contenção de rolagem.
 */
export default function ModalDialogoPlacas({
  aberto,
  onFechar,
  titulo,
  subtitulo,
  larguraMax = 'max-w-lg',
  fecharAoClicarFora = true,
  children,
}: ModalDialogoPlacasProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressionouForaRef = useRef(false);
  const tituloId = useId();

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (aberto && !el.open) {
      el.showModal();
    } else if (!aberto && el.open) {
      el.returnValue = '';
      el.close();
    }
  }, [aberto]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const aoFecharNativo = () => {
      el.returnValue = '';
      onFechar();
    };
    el.addEventListener('close', aoFecharNativo);
    return () => el.removeEventListener('close', aoFecharNativo);
  }, [onFechar]);

  const pontoFora = (clientX: number, clientY: number): boolean => {
    const el = dialogRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom;
  };

  if (!aberto) return null;

  return (
    <>
      <style>{ESTILO_DIALOGO_MODAL}</style>
      <dialog
        ref={dialogRef}
        aria-labelledby={tituloId}
        {...({ closedby: fecharAoClicarFora ? 'any' : 'closerequest' } as Record<string, string>)}
        onPointerDown={(e) => {
          pressionouForaRef.current = fecharAoClicarFora && pontoFora(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (fecharAoClicarFora && pressionouForaRef.current && pontoFora(e.clientX, e.clientY)) {
            dialogRef.current?.close();
          }
          pressionouForaRef.current = false;
        }}
        className={`placas-modal-nativo m-auto w-[calc(100%-1.5rem)] ${larguraMax} max-h-[90dvh] rounded-2xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl open:flex open:flex-col print:hidden`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id={tituloId} className="text-base font-bold text-slate-900">
              {titulo}
            </h2>
            {subtitulo && <p className="mt-0.5 text-xs text-slate-500">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Fechar janela"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </dialog>
    </>
  );
}

