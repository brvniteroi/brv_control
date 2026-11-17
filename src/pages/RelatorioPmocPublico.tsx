import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import {
  Link2Off,
  Loader2,
  MessageCircle,
  Printer,
  RotateCcw,
} from 'lucide-react';
import CorpoRelatorioMensalPmoc, {
  ESTILO_IMPRESSAO_RELATORIO_PMOC,
} from '../components/pmoc/CorpoRelatorioMensalPmoc';
import FaixaDadosDemo from '../components/pmoc/FaixaDadosDemo';
import { EMPRESA_BRV } from '../components/pmoc/empresa';
import { buscarRelatorioPublico } from '../components/pmoc/fonteDeDados';
import {
  formatarMesReferencia,
  montarLinkWhatsAppPmoc,
} from '../components/pmoc/regrasPmoc';
import type { PmocMonthlyReport } from '../types/pmoc';

/**
 * Página pública (sem login, focada em celular) do Relatório Mensal do PMOC:
 * `/relatorio-pmoc/:token` (`Entrega 4`).
 * Montada por portal em `document.body` para que `window.print()` imprima o relatório A4
 * sem ser ocultado pelo `@media print` de `src/index.css`.
 */
export default function RelatorioPmocPublico() {
  const { token = '' } = useParams();
  const [relatorio, setRelatorio] = useState<PmocMonthlyReport | null | undefined>(undefined);
  const [erroRede, setErroRede] = useState<string | null>(null);
  const [chaveRecarga, setChaveRecarga] = useState(0);

  useEffect(() => {
    let ativo = true;
    Promise.resolve()
      .then(() => {
        if (!ativo) return null;
        setRelatorio(undefined);
        setErroRede(null);
        return buscarRelatorioPublico(token);
      })
      .then((res) => {
        if (ativo) setRelatorio(res ?? null);
      })
      .catch((err) => {
        if (!ativo) return;
        setErroRede(
          err instanceof Error
            ? err.message
            : 'Não foi possível abrir o relatório mensal agora.',
        );
        setRelatorio(null);
      });

    return () => {
      ativo = false;
    };
  }, [token, chaveRecarga]);

  const linkWhatsBrv = montarLinkWhatsAppPmoc(
    EMPRESA_BRV.telefone,
    relatorio
      ? `Olá, BRV Niterói! Gostaria de falar sobre o relatório mensal do PMOC ${relatorio.plan.code} (${formatarMesReferencia(relatorio.reference_month)}).`
      : 'Olá, BRV Niterói! Gostaria de informações sobre um relatório mensal de PMOC.',
  );

  return createPortal(
    <div className="min-h-dvh bg-[#F4F6F8] pb-12 print:min-h-0 print:bg-white print:pb-0">
      <style>{ESTILO_IMPRESSAO_RELATORIO_PMOC}</style>

      {/* Cabeçalho e controles na tela (ocultos na impressão) */}
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 pt-6 sm:px-6 print:hidden">
        <FaixaDadosDemo />

        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <img
              src={EMPRESA_BRV.logoUrl}
              alt="BRV Niterói"
              className="h-11 w-11 shrink-0 object-contain"
            />
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-900">
                BRV Niterói · Relatório Mensal PMOC
              </h1>
              <p className="text-xs text-slate-500">
                {relatorio
                  ? `${relatorio.plan.code} · ${formatarMesReferencia(relatorio.reference_month)}`
                  : 'Comprovante de manutenção preventiva'}
              </p>
            </div>
          </div>

          {relatorio && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 sm:text-sm"
              >
                <Printer size={16} aria-hidden="true" />
                <span>Salvar em PDF / Imprimir</span>
              </button>
            </div>
          )}
        </header>

        {/* Estado: Carregando */}
        {relatorio === undefined && !erroRede && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-14 text-slate-500 shadow-2xs">
            <Loader2 size={26} className="animate-spin text-blue-600" aria-hidden="true" />
            <p className="text-sm font-medium">Abrindo relatório mensal do PMOC...</p>
          </div>
        )}

        {/* Estado: Erro */}
        {erroRede && (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-2xs"
          >
            <p className="text-sm font-semibold text-rose-900">{erroRede}</p>
            <button
              type="button"
              onClick={() => setChaveRecarga((c) => c + 1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span>Tentar de novo</span>
            </button>
          </div>
        )}

        {/* Estado: Token inválido */}
        {relatorio === null && !erroRede && (
          <div className="mx-auto max-w-lg space-y-3 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xs">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Link2Off size={22} aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Relatório não encontrado ou link inválido
            </h2>
            <p className="text-xs leading-relaxed text-slate-600">
              Confira se o endereço foi copiado por inteiro ou solicite o link atualizado à equipe da BRV Niterói.
            </p>
            <a
              href={linkWhatsBrv}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <MessageCircle size={17} aria-hidden="true" />
              <span>Falar com a BRV no WhatsApp</span>
            </a>
          </div>
        )}
      </div>

      {/* Corpo A4 do relatório */}
      {relatorio && (
        <div className="mx-auto mt-4 max-w-4xl px-4 sm:px-6 print:m-0 print:max-w-none print:p-0">
          <CorpoRelatorioMensalPmoc relatorio={relatorio} />
        </div>
      )}
    </div>,
    document.body,
  );
}

