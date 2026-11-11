import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, CheckCircle2, Copy, Loader2, MessageCircle, Printer, X } from 'lucide-react';
import type { BoardOrder } from '../../types/placas';
import FolhaOrcamentoPlaca, { ESTILO_IMPRESSAO_ORCAMENTO_A4 } from './FolhaOrcamentoPlaca';
import { enviarOrcamentoPorLink } from './fonteDeDados';
import { montarLinkWhatsAppPlaca, prepararJanelaWhatsApp, textoWhatsAppOrcamentoPlaca } from './regrasPlacas';

interface OrcamentoPlacaDocumentoProps {
  placa: BoardOrder;
  atorNome: string;
  onFechar: () => void;
  onPlacaAtualizada?: (placa: BoardOrder) => void;
}

export default function OrcamentoPlacaDocumento({
  placa,
  atorNome,
  onFechar,
  onPlacaAtualizada,
}: OrcamentoPlacaDocumentoProps) {
  const [enviandoWhats, setEnviandoWhats] = useState(false);
  const [avisoEnvio, setAvisoEnvio] = useState<string | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [linkEnviado, setLinkEnviado] = useState<string | null>(null);
  // Emissão = data do envio (a mesma que o cliente vê no link); antes do primeiro envio, hoje
  const [agora] = useState(() => new Date());
  const dataEmissao = placa.quote_sent_at ? new Date(placa.quote_sent_at) : agora;

  const handleEnviarWhatsApp = async () => {
    setEnviandoWhats(true);
    setAvisoEnvio(null);
    setErroEnvio(null);
    const janela = prepararJanelaWhatsApp();
    try {
      const { placa: atualizada, link } = await enviarOrcamentoPorLink(placa.id, atorNome);
      onPlacaAtualizada?.(atualizada);
      setLinkEnviado(link);
      janela.ir(montarLinkWhatsAppPlaca(atualizada.customer_phone, textoWhatsAppOrcamentoPlaca(atualizada, link)));
      setAvisoEnvio(
        'WhatsApp aberto com a mensagem e o link do orçamento. O cliente vê, salva em PDF e aprova pelo link; a aprovação fica registrada na placa e no histórico.',
      );
    } catch (e) {
      janela.cancelar();
      setErroEnvio(e instanceof Error ? e.message : 'Não foi possível enviar o orçamento.');
    } finally {
      setEnviandoWhats(false);
    }
  };

  const copiarLink = async () => {
    if (!linkEnviado) return;
    try {
      await navigator.clipboard.writeText(linkEnviado);
      setAvisoEnvio('Link do orçamento copiado.');
    } catch {
      setErroEnvio('Não foi possível copiar. Selecione o link e copie à mão.');
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Proposta de Orçamento ${placa.board_number}`}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-100 print:static print:overflow-visible print:bg-white"
    >
      <style>{ESTILO_IMPRESSAO_ORCAMENTO_A4}</style>

      {/* Barra de ações (oculta no papel) */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-xs sm:px-6 print:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onFechar}
            aria-label="Voltar aos detalhes da placa"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-900">Proposta de Orçamento · {placa.board_number}</h1>
            <p className="text-xs text-slate-500">
              Documento A4 — imprima / salve em PDF ou envie o link pelo WhatsApp (o cliente aprova pelo link).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-2xs transition hover:bg-slate-50"
          >
            <Printer size={15} aria-hidden="true" />
            Imprimir / Salvar PDF
          </button>

          <button
            type="button"
            onClick={() => void handleEnviarWhatsApp()}
            disabled={enviandoWhats}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {enviandoWhats ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <MessageCircle size={15} aria-hidden="true" />
            )}
            Enviar pelo WhatsApp (link para aprovar)
          </button>

          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar orçamento"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {(avisoEnvio || erroEnvio) && (
        <div className="mx-auto mt-4 max-w-4xl space-y-2 px-4 sm:px-6 print:hidden">
          {avisoEnvio && (
            <div
              role="status"
              className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900"
            >
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" aria-hidden="true" />
              <span className="flex-1">{avisoEnvio}</span>
              {linkEnviado && (
                <button
                  type="button"
                  onClick={() => void copiarLink()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  <Copy size={13} aria-hidden="true" />
                  Copiar link
                </button>
              )}
            </div>
          )}
          {erroEnvio && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-800">
              {erroEnvio}
            </div>
          )}
        </div>
      )}

      {/* Folha A4 */}
      <div className="mx-auto my-6 max-w-4xl px-4 sm:px-6 print:m-0 print:max-w-none print:p-0">
        <FolhaOrcamentoPlaca dados={placa} dataEmissao={dataEmissao} />
      </div>
    </div>,
    document.body,
  );
}
