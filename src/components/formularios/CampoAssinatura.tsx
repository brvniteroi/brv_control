import { useRef, useState } from 'react';
import { Eraser, PenLine } from 'lucide-react';

interface CampoAssinaturaProps {
  valorId?: string | null;
  urlExistente?: string | null;
  desabilitado?: boolean;
  onAssinaturaAlterada: (novoCanvasBlob: Blob | null) => void;
}

export default function CampoAssinatura({
  valorId,
  urlExistente,
  desabilitado = false,
  onAssinaturaAlterada,
}: CampoAssinaturaProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [desenhando, setDesenhando] = useState(false);
  const [temTraco, setTemTraco] = useState(false);
  const [limpouAssinatura, setLimpouAssinatura] = useState(false);

  // O canvas tem 500x180 pixels, mas aparece com outro tamanho na tela: converte do CSS para o canvas
  const obterCoordenadas = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const ponto = 'touches' in e && e.touches.length > 0 ? e.touches[0] : (e as React.MouseEvent);
    return {
      x: ((ponto.clientX - rect.left) * canvas.width) / rect.width,
      y: ((ponto.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const iniciarDesenho = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    if (desabilitado) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const { x, y } = obterCoordenadas(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDesenhando(true);
    setTemTraco(true);
    setLimpouAssinatura(false);
  };

  const desenhar = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    if (!desenhando || desabilitado) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = obterCoordenadas(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const finalizarDesenho = () => {
    if (!desenhando || desabilitado) return;
    setDesenhando(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      onAssinaturaAlterada(blob);
    }, 'image/png');
  };

  const limpar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTemTraco(false);
    setLimpouAssinatura(true);
    onAssinaturaAlterada(null);
  };

  const temAssinaturaSalva = Boolean(valorId && urlExistente && !limpouAssinatura && !temTraco);

  return (
    <div className="space-y-2">
      {temAssinaturaSalva ? (
        <div className="relative rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4">
          <div className="flex h-36 items-center justify-center">
            <img
              src={urlExistente!}
              alt="Assinatura registrada"
              className="max-h-full max-w-full object-contain"
            />
          </div>
          {!desabilitado && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={limpar}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
              >
                <Eraser size={14} className="text-slate-500" />
                Refazer assinatura
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="relative">
          <div className="overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-white shadow-2xs">
            <canvas
              ref={canvasRef}
              width={500}
              height={180}
              className={`h-40 w-full touch-none select-none bg-white ${
                desabilitado ? 'cursor-not-allowed opacity-60' : 'cursor-crosshair'
              }`}
              onMouseDown={iniciarDesenho}
              onMouseMove={desenhar}
              onMouseUp={finalizarDesenho}
              onMouseLeave={finalizarDesenho}
              onTouchStart={iniciarDesenho}
              onTouchMove={desenhar}
              onTouchEnd={finalizarDesenho}
            />

            {/* Linha guia suave de assinatura */}
            <div className="pointer-events-none absolute bottom-10 left-8 right-8 border-b border-slate-200" />
            <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1 text-[11px] text-slate-400">
              <PenLine size={12} />
              Assine com o dedo ou caneta no espaço acima
            </div>
          </div>

          {!desabilitado && temTraco && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={limpar}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900"
              >
                <Eraser size={14} />
                Limpar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
