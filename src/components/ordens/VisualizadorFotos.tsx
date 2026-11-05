import { useCallback, useEffect, useRef, useState, type PointerEvent as PonteiroReact } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Maximize, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { Attachment } from '../../types/fsm';
import { formatarDataHora } from '../../utils/ordens';

const ESCALA_MAX = 8;
const PASSO_LUPA = 1.5;
const ESCALA_AO_CLICAR = 2.5;
const VISTA_INICIAL = { escala: 1, x: 0, y: 0 };

type Vista = typeof VISTA_INICIAL;

interface VisualizadorFotosProps {
  fotos: Attachment[];
  indiceInicial: number;
  onFechar: () => void;
}

/** Janela por cima da OS: amplia com a lupa, a rolagem do mouse ou o clique; arrasta para mover a foto ampliada. */
export default function VisualizadorFotos({ fotos, indiceInicial, onFechar }: VisualizadorFotosProps) {
  const [indice, setIndice] = useState(indiceInicial);
  const [vista, setVista] = useState<Vista>(VISTA_INICIAL);
  const [situacao, setSituacao] = useState<'carregando' | 'pronta' | 'erro'>('carregando');
  const [arrastando, setArrastando] = useState(false);
  const palcoRef = useRef<HTMLDivElement>(null);
  const imagemRef = useRef<HTMLImageElement>(null);
  const arrasto = useRef({ x: 0, y: 0 });

  // A lista pode encolher enquanto a janela está aberta (Realtime, exclusão)
  const atual = Math.min(indice, fotos.length - 1);
  const foto = fotos[atual];
  const assinatura = foto?.category === 'assinatura';
  const ampliada = vista.escala > 1;

  // Não deixa a foto sair do palco: só anda o quanto ela ultrapassa a área visível
  const limitar = useCallback((v: Vista): Vista => {
    const palco = palcoRef.current;
    const imagem = imagemRef.current;
    if (!palco || !imagem) return v;
    const maxX = Math.max(0, (imagem.offsetWidth * v.escala - palco.clientWidth) / 2);
    const maxY = Math.max(0, (imagem.offsetHeight * v.escala - palco.clientHeight) / 2);
    return {
      escala: v.escala,
      x: Math.min(maxX, Math.max(-maxX, v.x)),
      y: Math.min(maxY, Math.max(-maxY, v.y)),
    };
  }, []);

  // Muda a escala mantendo parado o ponto (cx, cy), medido a partir do centro do palco
  const ampliarEm = useCallback(
    (calcular: (escala: number) => number, cx = 0, cy = 0) => {
      setVista((v) => {
        const escala = Math.min(ESCALA_MAX, Math.max(1, calcular(v.escala)));
        const k = escala / v.escala;
        return limitar({ escala, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k });
      });
    },
    [limitar],
  );

  const pontoNoPalco = (clientX: number, clientY: number) => {
    const r = palcoRef.current!.getBoundingClientRect();
    return { cx: clientX - r.left - r.width / 2, cy: clientY - r.top - r.height / 2 };
  };

  const irPara = useCallback(
    (novo: number) => {
      if (novo < 0 || novo >= fotos.length) return;
      setIndice(novo);
      setVista(VISTA_INICIAL);
      setSituacao('carregando');
    },
    [fotos.length],
  );

  useEffect(() => {
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
      else if (e.key === 'ArrowLeft') irPara(atual - 1);
      else if (e.key === 'ArrowRight') irPara(atual + 1);
      else if (e.key === '+' || e.key === '=') ampliarEm((s) => s * PASSO_LUPA);
      else if (e.key === '-') ampliarEm((s) => s / PASSO_LUPA);
      else if (e.key === '0') setVista(VISTA_INICIAL);
    };
    window.addEventListener('keydown', aoTecla);
    return () => window.removeEventListener('keydown', aoTecla);
  }, [atual, irPara, ampliarEm, onFechar]);

  // Ouvinte nativo: o onWheel do React é passivo e não impede a rolagem da OS que está atrás
  useEffect(() => {
    const palco = palcoRef.current;
    if (!palco) return;
    const aoRolar = (e: WheelEvent) => {
      e.preventDefault();
      const { cx, cy } = pontoNoPalco(e.clientX, e.clientY);
      ampliarEm((s) => s * Math.exp(-e.deltaY * 0.0015), cx, cy);
    };
    palco.addEventListener('wheel', aoRolar, { passive: false });
    return () => palco.removeEventListener('wheel', aoRolar);
  }, [ampliarEm]);

  const iniciarArrasto = (e: PonteiroReact<HTMLImageElement>) => {
    if (!ampliada) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = { x: e.clientX - vista.x, y: e.clientY - vista.y };
    setArrastando(true);
  };

  const moverArrasto = (e: PonteiroReact<HTMLImageElement>) => {
    if (!arrastando) return;
    setVista(limitar({ escala: vista.escala, x: e.clientX - arrasto.current.x, y: e.clientY - arrasto.current.y }));
  };

  if (!foto) return null;

  const botaoBarra =
    'flex h-9 w-9 items-center justify-center rounded-lg text-white transition hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent';
  const botaoLado =
    'absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/75';

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-xs sm:p-6 print:hidden"
      onClick={onFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Visualizar foto"
        className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-1 border-b border-white/10 px-3 py-2">
          <div className="mr-auto min-w-0 pr-3 text-xs text-slate-300">
            <p className="truncate font-semibold text-white">{foto.caption ?? foto.file_name ?? 'Foto da OS'}</p>
            <p>
              {fotos.length > 1 && `${atual + 1} de ${fotos.length} · `}
              {formatarDataHora(foto.created_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => ampliarEm((s) => s / PASSO_LUPA)}
            disabled={!ampliada}
            title="Diminuir"
            aria-label="Diminuir"
            className={botaoBarra}
          >
            <ZoomOut size={20} />
          </button>
          <span className="w-12 text-center text-xs tabular-nums text-slate-300">{Math.round(vista.escala * 100)}%</span>
          <button
            type="button"
            onClick={() => ampliarEm((s) => s * PASSO_LUPA)}
            disabled={vista.escala >= ESCALA_MAX}
            title="Ampliar"
            aria-label="Ampliar"
            className={botaoBarra}
          >
            <ZoomIn size={20} />
          </button>
          <button
            type="button"
            onClick={() => setVista(VISTA_INICIAL)}
            disabled={!ampliada}
            title="Ajustar à janela"
            aria-label="Ajustar à janela"
            className={botaoBarra}
          >
            <Maximize size={18} />
          </button>
          <a
            href={foto.public_url}
            target="_blank"
            rel="noreferrer"
            title="Abrir em nova aba"
            aria-label="Abrir em nova aba"
            className={botaoBarra}
          >
            <ExternalLink size={18} />
          </a>
          <button type="button" onClick={onFechar} title="Fechar (Esc)" aria-label="Fechar" className={botaoBarra}>
            <X size={20} />
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          <div
            ref={palcoRef}
            className="absolute inset-0 flex items-center justify-center overflow-hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget) onFechar();
            }}
          >
            {situacao === 'erro' ? (
              <p className="px-4 text-center text-sm text-slate-300">Não foi possível carregar esta foto.</p>
            ) : (
              <img
                key={foto.id}
                ref={imagemRef}
                src={foto.public_url}
                alt={foto.caption ?? 'Foto da OS'}
                draggable={false}
                onLoad={() => setSituacao('pronta')}
                onError={() => setSituacao('erro')}
                onClick={(e) => {
                  if (ampliada) return;
                  const { cx, cy } = pontoNoPalco(e.clientX, e.clientY);
                  ampliarEm(() => ESCALA_AO_CLICAR, cx, cy);
                }}
                onPointerDown={iniciarArrasto}
                onPointerMove={moverArrasto}
                onPointerUp={() => setArrastando(false)}
                onPointerCancel={() => setArrastando(false)}
                style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.escala})` }}
                className={`max-h-full max-w-full touch-none select-none ${assinatura ? 'bg-white' : ''} ${
                  arrastando ? 'cursor-grabbing' : `transition-transform duration-100 ${ampliada ? 'cursor-grab' : 'cursor-zoom-in'}`
                }`}
              />
            )}
            {situacao === 'carregando' && <Loader2 size={32} className="absolute animate-spin text-slate-400" />}
          </div>

          {atual > 0 && (
            <button type="button" onClick={() => irPara(atual - 1)} title="Foto anterior" aria-label="Foto anterior" className={`${botaoLado} left-3`}>
              <ChevronLeft size={24} />
            </button>
          )}
          {atual < fotos.length - 1 && (
            <button type="button" onClick={() => irPara(atual + 1)} title="Próxima foto" aria-label="Próxima foto" className={`${botaoLado} right-3`}>
              <ChevronRight size={24} />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
