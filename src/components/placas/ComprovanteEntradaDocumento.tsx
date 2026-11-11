import { createPortal } from 'react-dom';
import { ArrowLeft, MessageCircle, Printer, Tag, X } from 'lucide-react';
import type { BoardOrder } from '../../types/placas';
import { formatarDataHora } from '../../utils/ordens';
import { formatarTelefone } from '../../utils/telefone';
import { EMPRESA_BRV } from '../pmoc/empresa';
import { CORES_TIPO_CLIENTE_PLACA } from './cores';
import {
  linkPublicoPlaca,
  montarLinkWhatsAppPlaca,
  textoWhatsAppEntradaPlaca,
} from './regrasPlacas';
import { CLAUSULAS_COMPROVANTE_ENTRADA } from './textosJuridicosPlacas';

interface ComprovanteEntradaDocumentoProps {
  placa: BoardOrder;
  onFechar: () => void;
  /** Quando aberto logo após criar a placa, permite abrir a etiqueta térmica em um clique. */
  onAbrirEtiqueta?: () => void;
}

const ESTILO_IMPRESSAO_COMPROVANTE = `
@media print {
  @page {
    size: A4 portrait;
    margin: 12mm 14mm 14mm 14mm;
  }
  .placas-cor-exata {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
`;

export default function ComprovanteEntradaDocumento({
  placa,
  onFechar,
  onAbrirEtiqueta,
}: ComprovanteEntradaDocumentoProps) {
  const linkAcompanhamento = linkPublicoPlaca(placa.public_token);
  const urlWhatsApp = montarLinkWhatsAppPlaca(
    placa.customer_phone,
    textoWhatsAppEntradaPlaca(placa),
  );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Comprovante de Entrada ${placa.board_number}`}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-100 print:static print:overflow-visible print:bg-white"
    >
      <style>{ESTILO_IMPRESSAO_COMPROVANTE}</style>

      {/* Barra superior (oculta na impressão) */}
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
              Comprovante de Entrada · {placa.board_number}
            </h1>
            <p className="text-xs text-slate-500">
              Entregue impresso no balcão ou envie o link de acompanhamento pelo WhatsApp.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onAbrirEtiqueta && (
            <button
              type="button"
              onClick={onAbrirEtiqueta}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-2xs transition hover:bg-slate-50"
            >
              <Tag size={15} aria-hidden="true" />
              Etiqueta
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700"
          >
            <Printer size={15} aria-hidden="true" />
            Imprimir
          </button>

          <a
            href={urlWhatsApp}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700"
          >
            <MessageCircle size={15} aria-hidden="true" />
            Enviar o link pelo WhatsApp
          </a>

          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar comprovante"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Folha A4 */}
      <div className="mx-auto my-6 max-w-4xl px-4 sm:px-6 print:m-0 print:max-w-none print:p-0">
        <div className="placas-cor-exata rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm sm:p-10 print:rounded-none print:border-none print:p-0 print:shadow-none">
          <header className="flex items-start justify-between gap-4 border-b-2 border-[#0B1E3F] pb-4">
            <div className="flex items-center gap-3.5">
              <img
                src={EMPRESA_BRV.logoUrl}
                alt="Logo BRV Niterói"
                className="placas-cor-exata h-13 w-auto rounded-lg bg-[#0B1E3F] p-2 object-contain"
              />
              <div>
                <h2 className="text-base font-extrabold text-[#0B1E3F]">
                  {EMPRESA_BRV.razaoSocial}
                </h2>
                <p className="text-[11px] text-slate-600">
                  CNPJ {EMPRESA_BRV.cnpj} · Tel./WhatsApp {EMPRESA_BRV.telefone}
                </p>
                <p className="text-[11px] text-slate-600">{EMPRESA_BRV.endereco}</p>
              </div>
            </div>

            <div className="text-right">
              <div className="placas-cor-exata inline-block rounded-lg bg-[#0B1E3F] px-3 py-1.5 font-mono text-sm font-extrabold text-white">
                {placa.board_number}
              </div>
              <p className="mt-1 text-[11px] font-semibold text-slate-600">
                Entrada: {formatarDataHora(placa.created_at)}
              </p>
              {placa.is_warranty && (
                <span className="placas-cor-exata mt-1 inline-block rounded border border-purple-300 bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-800 uppercase">
                  Retorno em Garantia
                </span>
              )}
            </div>
          </header>

          <div className="mt-4 text-center">
            <h3 className="text-base font-extrabold tracking-wide text-[#0B1E3F] uppercase">
              COMPROVANTE DE RECEBIMENTO E TRIAGEM — LABORATÓRIO DE PLACAS
            </h3>
          </div>

          {/* Dados do Cliente e da Placa */}
          <section className="mt-4">
            <div className="placas-cor-exata bg-[#0B1E3F] px-3 py-1.5 text-[11px] font-bold tracking-wider text-white uppercase">
              1. Dados de Entrada e Identificação
            </div>
            <table className="w-full border-collapse border border-slate-300 text-xs">
              <tbody>
                <tr>
                  <td className="w-3/5 border border-slate-300 px-3 py-2">
                    <strong>Cliente / Parceiro:</strong> {placa.customer_name}{' '}
                    <span className="text-[11px] text-slate-500">
                      ({CORES_TIPO_CLIENTE_PLACA[placa.customer_kind].rotulo})
                    </span>
                  </td>
                  <td className="w-2/5 border border-slate-300 px-3 py-2">
                    <strong>Telefone:</strong>{' '}
                    {placa.customer_phone ? formatarTelefone(placa.customer_phone) : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 px-3 py-2">
                    <strong>Cidade:</strong> {placa.customer_city || '—'}
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <strong>Recebido / Retirado por:</strong>{' '}
                    {placa.pickup_technician_name || 'Recepção BRV'}
                    {placa.os_number ? ` · OS do Control ${placa.os_number}` : ''}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 px-3 py-2">
                    <strong>Equipamento:</strong> {placa.equipment_type} — {placa.brand_model}
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <strong>Código da Placa:</strong>{' '}
                    <span className="font-mono font-bold">{placa.board_code}</span>
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="border border-slate-300 px-3 py-2">
                    <strong>Periféricos e acessórios entregues:</strong>{' '}
                    {placa.peripherals || 'Apenas a placa eletrônica (sem acessórios)'}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="border border-slate-300 px-3 py-2">
                    <strong>Defeito reclamado / Relato inicial:</strong> {placa.reported_defect}
                    {placa.error_code ? ` (Código de erro: ${placa.error_code})` : ''}
                    {placa.no_apparent_defect ? ' [Sem defeito aparente]' : ''}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Acompanhamento online (só o link; QR descartado pelo Braulio em 2026-11-11) */}
          <section className="mt-4">
            <div className="placas-cor-exata bg-[#0B1E3F] px-3 py-1.5 text-[11px] font-bold tracking-wider text-white uppercase">
              2. Acompanhamento em Tempo Real pelo Parceiro / Cliente
            </div>
            <div className="border border-t-0 border-slate-300 p-4 text-xs">
              <div className="min-w-0 space-y-1">
                <p className="font-bold text-slate-900">
                  Acompanhe a etapa atual, fotos de bancada e situação do orçamento sem precisar de senha:
                </p>
                <p className="break-all rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs font-semibold text-[#0B1E3F]">
                  {linkAcompanhamento}
                </p>
                <p className="text-[11px] text-slate-500">
                  Em caso de dúvidas, fale com o laboratório no WhatsApp {EMPRESA_BRV.telefone} informando o número{' '}
                  <strong>{placa.board_number}</strong>.
                </p>
              </div>
            </div>
          </section>

          {/* Termos de entrada */}
          <section className="mt-4">
            <div className="placas-cor-exata bg-[#0B1E3F] px-3 py-1.5 text-[11px] font-bold tracking-wider text-white uppercase">
              3. Condições de Triagem, Prazo e Guarda (Art. 1.275, III do Código Civil)
            </div>
            <div className="space-y-1.5 border border-t-0 border-slate-300 p-3 text-[11px] leading-snug text-slate-700">
              {CLAUSULAS_COMPROVANTE_ENTRADA.map((clausula, idx) => (
                <p key={idx}>{clausula}</p>
              ))}
            </div>
          </section>

          {/* Duas linhas de assinatura */}
          <footer className="mt-10 grid grid-cols-2 gap-8 pt-6 text-center text-xs">
            <div className="border-t border-slate-800 pt-1.5">
              <div className="font-bold text-slate-900">{placa.customer_name}</div>
              <div className="text-[11px] text-slate-500">Assinatura do Cliente / Portador</div>
            </div>
            <div className="border-t border-slate-800 pt-1.5">
              <div className="font-bold text-slate-900">{EMPRESA_BRV.nomeCurto}</div>
              <div className="text-[11px] text-slate-500">
                Recebido por: {placa.pickup_technician_name || 'Recepção / Laboratório'}
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  );
}

