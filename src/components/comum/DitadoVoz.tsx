import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';

/**
 * Ditado por voz em qualquer campo de texto grande (<textarea>) da tela.
 * Ao clicar no campo aparece um microfone no canto; clique nele, fale, e o texto entra onde está o cursor
 * (clique de novo para parar). Usa o reconhecimento de voz do navegador (Chrome/Edge); onde o navegador
 * não tem, o botão nem aparece. No Chrome o áudio é processado pelo serviço de voz do Google.
 * Para um campo não ter o microfone: `data-sem-voz` no <textarea>.
 */

interface ResultadoVoz {
  isFinal: boolean;
  0: { transcript: string };
}
interface EventoVoz {
  resultIndex: number;
  results: ArrayLike<ResultadoVoz>;
}
interface ReconhecedorVoz {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: EventoVoz) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type CriarReconhecedor = new () => ReconhecedorVoz;

function classeReconhecimento(): CriarReconhecedor | null {
  const w = window as unknown as { SpeechRecognition?: CriarReconhecedor; webkitSpeechRecognition?: CriarReconhecedor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Escreve no campo como se a pessoa tivesse digitado (o React controlado percebe pelo evento `input`). */
function inserirTexto(campo: HTMLTextAreaElement, texto: string) {
  const ini = campo.selectionStart ?? campo.value.length;
  const fim = campo.selectionEnd ?? ini;
  const antes = campo.value.slice(0, ini);
  const depois = campo.value.slice(fim);
  const espaco = antes && !/\s$/.test(antes) ? ' ' : '';
  const novo = `${antes}${espaco}${texto}${depois}`;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(campo, novo);
  const cursor = antes.length + espaco.length + texto.length;
  campo.setSelectionRange(cursor, cursor);
  campo.dispatchEvent(new Event('input', { bubbles: true }));
}

const MENSAGENS: Record<string, string> = {
  'not-allowed': 'Permita o uso do microfone no navegador.',
  'service-not-allowed': 'Permita o uso do microfone no navegador.',
  'audio-capture': 'Microfone não encontrado.',
  network: 'Sem internet para o reconhecimento de voz.',
};

export default function DitadoVoz() {
  const [alvo, setAlvo] = useState<HTMLTextAreaElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [ouvindo, setOuvindo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const reconhecedor = useRef<ReconhecedorVoz | null>(null);
  const alvoOuvindo = useRef<HTMLTextAreaElement | null>(null);
  const suportado = typeof window !== 'undefined' && classeReconhecimento() !== null;

  const parar = useCallback(() => {
    reconhecedor.current?.stop();
  }, []);

  // Qual campo está em foco
  useEffect(() => {
    if (!suportado) return;
    const aoFocar = (e: FocusEvent) => {
      const t = e.target;
      if (t instanceof HTMLTextAreaElement && !t.disabled && !t.readOnly && !('semVoz' in t.dataset)) {
        setAlvo(t);
        setAviso(null);
      }
    };
    const aoSair = (e: FocusEvent) => {
      // Ouvindo: o campo continua sendo o alvo mesmo se o foco sair
      if (e.target === alvoOuvindo.current && reconhecedor.current) return;
      if (e.target instanceof HTMLTextAreaElement) setAlvo((atual) => (atual === e.target ? null : atual));
    };
    document.addEventListener('focusin', aoFocar);
    document.addEventListener('focusout', aoSair);
    return () => {
      document.removeEventListener('focusin', aoFocar);
      document.removeEventListener('focusout', aoSair);
    };
  }, [suportado]);

  // Mantém o botão no canto do campo (a tela rola, o modal muda de tamanho...)
  useEffect(() => {
    if (!alvo) return;
    const atualizar = () => {
      if (!alvo.isConnected) {
        setAlvo(null);
        return;
      }
      const r = alvo.getBoundingClientRect();
      const visivel = r.bottom > 40 && r.top < window.innerHeight - 20 && r.width > 80;
      setPos(visivel ? { x: r.right - 44, y: Math.min(r.bottom, window.innerHeight - 8) - 52 } : null);
    };
    atualizar();
    const timer = window.setInterval(atualizar, 250);
    window.addEventListener('scroll', atualizar, true);
    window.addEventListener('resize', atualizar);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('scroll', atualizar, true);
      window.removeEventListener('resize', atualizar);
    };
  }, [alvo]);

  // Para de ouvir ao sair da tela
  useEffect(() => () => reconhecedor.current?.stop(), []);

  const alternar = () => {
    if (ouvindo) {
      parar();
      return;
    }
    const Classe = classeReconhecimento();
    if (!Classe || !alvo) return;
    const campo = alvo;
    const r = new Classe();
    r.lang = 'pt-BR';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          const texto = res[0].transcript.trim();
          if (texto) inserirTexto(campo, texto);
        }
      }
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      setAviso(MENSAGENS[e.error] ?? 'Não foi possível usar o microfone.');
    };
    r.onend = () => {
      reconhecedor.current = null;
      alvoOuvindo.current = null;
      setOuvindo(false);
    };
    setAviso(null);
    reconhecedor.current = r;
    alvoOuvindo.current = campo;
    try {
      r.start();
      setOuvindo(true);
      campo.focus();
    } catch {
      reconhecedor.current = null;
      alvoOuvindo.current = null;
      setAviso('Não foi possível iniciar o microfone.');
    }
  };

  if (!suportado || !alvo || !pos) return null;

  return (
    <div className="fixed z-[80] flex flex-col items-end gap-1" style={{ left: pos.x - 8, top: pos.y }}>
      {aviso && (
        <span className="max-w-56 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg">{aviso}</span>
      )}
      <button
        type="button"
        // Não tira o foco do campo ao clicar (o cursor é onde o texto vai entrar)
        onMouseDown={(e) => e.preventDefault()}
        onClick={alternar}
        title={ouvindo ? 'Parar de ouvir' : 'Ditar por voz'}
        aria-label={ouvindo ? 'Parar de ouvir' : 'Ditar por voz'}
        className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-md transition ${
          ouvindo
            ? 'animate-pulse border-red-600 bg-red-600 text-white'
            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
        }`}
      >
        {ouvindo ? <Square size={14} className="fill-white" /> : <Mic size={17} />}
      </button>
    </div>
  );
}
