import { useRef } from 'react';
import { Camera, ImagePlus, Loader2 } from 'lucide-react';

interface BotoesFotoProps {
  /** Recebe as fotos escolhidas (da câmera ou da galeria). */
  onArquivos: (arquivos: File[]) => void;
  desabilitado?: boolean;
  /** Mostra o giro de carregamento e bloqueia os botões. */
  enviando?: boolean;
  /** Texto no lugar de "Tirar foto" enquanto envia (ex.: "Enviando 2 de 5…"). */
  textoEnviando?: string;
  /** Galeria aceita várias fotos de uma vez (padrão). A câmera sempre tira uma por vez. */
  multiplo?: boolean;
  /** grande = dois botões largos (celular); compacto = botões pequenos; mini = para tabelas. */
  tamanho?: 'grande' | 'compacto' | 'mini';
  className?: string;
}

/**
 * Anexo de foto padrão do sistema: "Tirar foto" abre a câmera do celular (`capture`) e "Galeria" abre
 * o seletor de arquivos/fotos. No computador, "Tirar foto" cai no seletor de arquivos (ou na webcam, conforme o navegador).
 */
export default function BotoesFoto({
  onArquivos,
  desabilitado,
  enviando,
  textoEnviando,
  multiplo = true,
  tamanho = 'compacto',
  className = '',
}: BotoesFotoProps) {
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const bloqueado = !!desabilitado || !!enviando;

  const aoEscolher = (arquivos: FileList | null) => {
    const lista = Array.from(arquivos ?? []);
    if (lista.length > 0) onArquivos(lista);
  };

  const classeBotao = {
    grande:
      'flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold disabled:opacity-60',
    compacto:
      'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60',
    mini: 'inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition disabled:opacity-60',
  }[tamanho];
  const icone = tamanho === 'grande' ? 18 : tamanho === 'compacto' ? 14 : 13;
  const corPrimaria = 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700';
  const corSecundaria = 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50';
  const grade = tamanho === 'grande' ? 'grid grid-cols-2 gap-2' : 'inline-flex flex-wrap items-center gap-1.5';

  return (
    <div className={`${grade} ${className}`}>
      <button
        type="button"
        disabled={bloqueado}
        onClick={() => camera.current?.click()}
        className={`${classeBotao} ${corPrimaria}`}
      >
        {enviando ? <Loader2 size={icone} className="animate-spin" aria-hidden="true" /> : <Camera size={icone} aria-hidden="true" />}
        {enviando ? (textoEnviando ?? 'Enviando…') : tamanho === 'mini' ? 'Câmera' : 'Tirar foto'}
      </button>
      <button
        type="button"
        disabled={bloqueado}
        onClick={() => galeria.current?.click()}
        className={`${classeBotao} ${corSecundaria}`}
      >
        <ImagePlus size={icone} aria-hidden="true" /> Galeria
      </button>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          aoEscolher(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={galeria}
        type="file"
        accept="image/*"
        multiple={multiplo}
        hidden
        onChange={(e) => {
          aoEscolher(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
