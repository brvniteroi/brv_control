import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, MoreVertical, Printer, XCircle } from 'lucide-react';
import { acompanharPedido, pedirEtiquetaTeste } from '../../services/oficina';
import type { AgenteImpressao, PedidoImpressao } from '../../types/oficina';
import { formatarDataHora } from '../../utils/ordens';

const SITUACAO_TESTE: Record<PedidoImpressao['status'], string> = {
  pendente: 'Na fila...',
  imprimindo: 'Imprimindo...',
  impressa: 'Etiqueta de teste impressa.',
  falhou: 'Não imprimiu.',
  cancelada: 'Pedido cancelado.',
};

function textoSituacaoElgin(online: boolean | null, agente: AgenteImpressao | null): string {
  if (online === null) return 'Conferindo impressora...';
  if (online) return 'Elgin pronta';
  if (agente) return `Servidor da loja sem sinal desde ${formatarDataHora(agente.last_seen_at)}`;
  return 'Servidor da loja sem sinal (agente não instalado)';
}

interface IndicadorElginProps {
  online: boolean | null;
  agente: AgenteImpressao | null;
  compacto?: boolean;
}

/** Bolinha verde "Elgin pronta" ou cinza "Servidor da loja sem sinal desde ...". */
export function IndicadorElgin({ online, agente, compacto = false }: IndicadorElginProps) {
  const texto = textoSituacaoElgin(online, agente);
  return (
    <div
      title={texto}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
        online
          ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
          : 'border-slate-200 bg-white text-slate-600'
      }`}
    >
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
          online === null ? 'animate-pulse bg-slate-300' : online ? 'bg-emerald-500' : 'bg-slate-400'
        }`}
      />
      <span className={compacto ? 'max-w-44 truncate sm:max-w-72' : ''}>{texto}</span>
    </div>
  );
}

interface MenuImpressoraCabecalhoProps {
  online: boolean | null;
  agente: AgenteImpressao | null;
  nomeUsuario: string;
}

/**
 * Menu discreto "..." no cabeçalho da Oficina (apenas admin/escritório)
 * com o cartão "Impressora de etiquetas" e o botão "Imprimir etiqueta de teste".
 */
export function MenuImpressoraCabecalho({ online, agente, nomeUsuario }: MenuImpressoraCabecalhoProps) {
  const [aberto, setAberto] = useState(false);
  const [pedido, setPedido] = useState<PedidoImpressao | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false);
    };
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTecla);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTecla);
    };
  }, [aberto]);

  const testarImpressora = async () => {
    setEnviando(true);
    setErro(null);
    try {
      const novo = await pedirEtiquetaTeste(nomeUsuario || 'usuário');
      setPedido(novo);
      const final = await acompanharPedido(novo.id, setPedido);
      if (final?.status === 'pendente') {
        setErro('O servidor da loja não respondeu');
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar o teste.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-label="Impressora de etiquetas"
        title="Impressora de etiquetas"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
      >
        <MoreVertical size={17} />
      </button>

      {aberto && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="flex items-center gap-2 text-slate-800">
            <Printer size={17} className="text-brv-navy" />
            <h2 className="text-sm font-bold">Impressora de etiquetas</h2>
          </div>

          <p className="mt-2.5 flex items-start gap-2 text-xs text-slate-600">
            <span
              className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                online === null ? 'bg-slate-300' : online ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            <span>{textoSituacaoElgin(online, agente)}</span>
          </p>

          <button
            type="button"
            onClick={() => void testarImpressora()}
            disabled={enviando}
            className="mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-100 disabled:opacity-50"
          >
            {enviando ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
            Imprimir etiqueta de teste
          </button>

          {pedido && (
            <p
              className={`mt-2.5 flex items-center gap-1.5 text-xs font-medium ${
                pedido.status === 'impressa'
                  ? 'text-emerald-700'
                  : pedido.status === 'falhou'
                    ? 'text-red-600'
                    : 'text-slate-600'
              }`}
            >
              {pedido.status === 'impressa' && <CheckCircle2 size={14} className="shrink-0" />}
              {pedido.status === 'falhou' && <XCircle size={14} className="shrink-0" />}
              <span>
                {pedido.status === 'falhou' && pedido.error
                  ? `Não imprimiu: ${pedido.error}`
                  : SITUACAO_TESTE[pedido.status]}
              </span>
            </p>
          )}

          {erro && <p className="mt-2 text-xs font-medium text-red-600">{erro}</p>}
        </div>
      )}
    </div>
  );
}
