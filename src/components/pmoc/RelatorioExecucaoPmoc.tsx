import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Loader2,
  MessageCircle,
  Printer,
  X,
} from 'lucide-react';
import type { PmocMonthlyReport } from '../../types/pmoc';
import { prepararJanelaWhatsApp } from '../placas/regrasPlacas';
import CorpoRelatorioMensalPmoc, {
  ESTILO_IMPRESSAO_RELATORIO_PMOC,
} from './CorpoRelatorioMensalPmoc';
import { buscarRelatorioMensal, gerarLinkRelatorio } from './fonteDeDados';
import {
  formatarDataIsoCurta,
  formatarMesReferencia,
  montarLinkWhatsAppPmoc,
  textoWhatsAppRelatorioPmoc,
} from './regrasPmoc';

interface RelatorioExecucaoPmocProps {
  planId: string;
  referenceMonth: string;
  onFechar: () => void;
}

export default function RelatorioExecucaoPmoc({
  planId,
  referenceMonth,
  onFechar,
}: RelatorioExecucaoPmocProps) {
  const [relatorio, setRelatorio] = useState<PmocMonthlyReport | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dataEmissao] = useState(() => formatarDataIsoCurta(new Date().toISOString()));

  const [enviandoWhats, setEnviandoWhats] = useState(false);
  const [copiando, setCopiando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const recarregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await buscarRelatorioMensal(planId, referenceMonth);
      if (!dados) {
        setErro('Relatório mensal não encontrado para este plano.');
      } else {
        setRelatorio(dados);
      }
    } catch (e) {
      console.error('Erro ao buscar relatório mensal PMOC:', e);
      setErro('Não foi possível carregar o relatório mensal de execução.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    let ativo = true;
    buscarRelatorioMensal(planId, referenceMonth)
      .then((dados) => {
        if (!ativo) return;
        if (!dados) setErro('Relatório mensal não encontrado para este plano.');
        else setRelatorio(dados);
      })
      .catch((e) => {
        if (!ativo) return;
        console.error('Erro ao buscar relatório mensal PMOC:', e);
        setErro('Não foi possível carregar o relatório mensal de execução.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [planId, referenceMonth]);

  const handleEnviarWhatsApp = async () => {
    if (!relatorio || enviandoWhats) return;
    const janela = prepararJanelaWhatsApp();
    setEnviandoWhats(true);
    try {
      const { token, url } = await gerarLinkRelatorio(planId, referenceMonth);
      setRelatorio((atual) => (atual ? { ...atual, public_token: token } : atual));
      const nomeCliente = relatorio.plan.customer_trade_name || relatorio.plan.customer_name;
      const msg = textoWhatsAppRelatorioPmoc(nomeCliente, referenceMonth, url);
      janela.ir(montarLinkWhatsAppPmoc(relatorio.plan.customer_phone, msg));
    } catch (e) {
      janela.cancelar();
      setErro(
        e instanceof Error
          ? e.message
          : 'Não foi possível gerar o link do relatório para o WhatsApp.',
      );
    } finally {
      setEnviandoWhats(false);
    }
  };

  const handleCopiarLink = async () => {
    if (!relatorio || copiando) return;
    setCopiando(true);
    try {
      const { token, url } = await gerarLinkRelatorio(planId, referenceMonth);
      setRelatorio((atual) => (atual ? { ...atual, public_token: token } : atual));
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : 'Não foi possível copiar o link do relatório.',
      );
    } finally {
      setCopiando(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Relatório mensal PMOC ${formatarMesReferencia(referenceMonth)}`}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-100 print:static print:overflow-visible print:bg-white"
    >
      <style>{ESTILO_IMPRESSAO_RELATORIO_PMOC}</style>

      <div className="min-h-screen pb-14 print:min-h-0 print:pb-0">
        {/* Barra superior de ações (oculta na impressão) */}
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-xs sm:px-6 print:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onFechar}
              aria-label="Voltar"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900">
                Relatório Mensal de Execução · {formatarMesReferencia(referenceMonth)}
              </h1>
              <p className="text-xs text-slate-500">
                Comprovante técnico mensal de manutenção preventiva para entrega ao cliente.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {relatorio && (
              <>
                <button
                  type="button"
                  disabled={enviandoWhats}
                  onClick={() => void handleEnviarWhatsApp()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {enviandoWhats ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <MessageCircle size={14} aria-hidden="true" />
                  )}
                  <span>Enviar relatório pelo WhatsApp</span>
                </button>

                <button
                  type="button"
                  disabled={copiando}
                  onClick={() => void handleCopiarLink()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {copiando ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  ) : copiado ? (
                    <Check size={14} className="text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Copy size={14} aria-hidden="true" />
                  )}
                  <span>{copiado ? 'Link copiado' : 'Copiar link'}</span>
                </button>
              </>
            )}

            <button
              type="button"
              disabled={carregando || Boolean(erro)}
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
            >
              <Printer size={15} aria-hidden="true" />
              Salvar em PDF / Imprimir
            </button>
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar relatório"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mx-auto mt-6 max-w-4xl px-4 sm:px-6 print:m-0 print:max-w-none print:p-0">
          {carregando ? (
            <div className="flex h-72 items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <Loader2 size={24} className="animate-spin text-blue-600" aria-hidden="true" />
                <span className="text-xs font-medium">Carregando relatório mensal...</span>
              </div>
            </div>
          ) : erro || !relatorio ? (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700"
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{erro || 'Relatório indisponível.'}</span>
              </div>
              <button
                type="button"
                onClick={() => void recarregar()}
                className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 font-semibold text-rose-700 hover:bg-rose-100"
              >
                Tentar de novo
              </button>
            </div>
          ) : (
            <CorpoRelatorioMensalPmoc relatorio={relatorio} dataEmissao={dataEmissao} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
