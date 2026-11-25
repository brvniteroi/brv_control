import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalDialogoVendasProps {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  subtitulo?: string;
  larguraMax?: 'max-w-md' | 'max-w-lg' | 'max-w-xl' | 'max-w-2xl' | 'max-w-3xl' | 'max-w-4xl';
  fecharAoClicarFora?: boolean;
  children: ReactNode;
}

const ESTILO_DIALOGO_VENDAS = `
dialog.vendas-modal-nativo:modal {
  overscroll-behavior: contain;
}
dialog.vendas-modal-nativo::backdrop {
  background: rgb(0 0 0 / 0.4);
  overflow: hidden;
  overscroll-behavior: contain;
}
`;

export default function ModalDialogoVendas({
  aberto,
  onFechar,
  titulo,
  larguraMax = 'max-w-lg',
  fecharAoClicarFora = true,
  children,
}: ModalDialogoVendasProps) {
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
      <style>{ESTILO_DIALOGO_VENDAS}</style>
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
        className={`vendas-modal-nativo m-auto w-[calc(100%-2rem)] ${larguraMax} max-h-[calc(100dvh-2rem)] rounded-2xl border border-slate-200 bg-white p-0 text-slate-800 shadow-sm open:flex open:flex-col print:hidden`}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 id={tituloId} className="text-base font-bold text-slate-900">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Fechar"
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-auto overflow-y-auto px-5 pb-5">{children}</div>
      </dialog>
    </>
  );
}
