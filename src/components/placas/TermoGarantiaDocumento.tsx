import { createPortal } from 'react-dom';
import { ArrowLeft, Printer, ShieldCheck, X } from 'lucide-react';
import type { ProfileRole } from '../../types/fsm';
import type { BoardOrder } from '../../types/placas';
import { formatarDocumento } from '../../utils/documento';
import { valorEmReais } from '../../utils/oficina';
import { formatarData } from '../../utils/ordens';
import { formatarTelefone } from '../../utils/telefone';
import { EMPRESA_BRV } from '../pmoc/empresa';
import { calcularValidadeGarantia, ehEscritorioOuAdminPlaca, valorReceitaPlaca } from './regrasPlacas';
import { CLAUSULAS_TERMO_GARANTIA } from './textosJuridicosPlacas';

interface TermoGarantiaDocumentoProps {
  placa: BoardOrder;
  papelUsuario?: ProfileRole;
  onFechar: () => void;
}

const ESTILO_IMPRESSAO_GARANTIA = `
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

export default function TermoGarantiaDocumento({
  placa,
  papelUsuario,
  onFechar,
}: TermoGarantiaDocumentoProps) {
  const validadeIso = calcularValidadeGarantia(placa.finished_at);
  const mostrarValor = ehEscritorioOuAdminPlaca(papelUsuario);
  const valorServico = valorReceitaPlaca(placa);
  const docFormatado = placa.customer_document
    ? formatarDocumento(placa.customer_document, placa.customer_person_type)
    : 'Não informado';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Termo de Garantia ${placa.board_number}`}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-100 print:static print:overflow-visible print:bg-white"
    >
      <style>{ESTILO_IMPRESSAO_GARANTIA}</style>

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
              Termo de Garantia de Reparo · {placa.board_number}
            </h1>
            <p className="text-xs text-slate-500">
              Garantia legal de 90 dias a contar da data de saída ({formatarData(placa.finished_at)}). Imprima e entregue
              na retirada, com a assinatura do cliente.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700"
          >
            <Printer size={15} aria-hidden="true" />
            Imprimir termo
          </button>

          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar termo de garantia"
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
              <div className="placas-cor-exata inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-900">
                <ShieldCheck size={16} aria-hidden="true" />
                GARANTIA: 90 DIAS
              </div>
              <p className="mt-1 font-mono text-xs font-bold text-[#0B1E3F]">{placa.board_number}</p>
            </div>
          </header>

          <div className="mt-4 text-center">
            <h3 className="text-base font-extrabold tracking-wide text-[#0B1E3F] uppercase">
              CERTIFICADO E TERMO DE GARANTIA DE REPARO ELETRÔNICO
            </h3>
          </div>

          {/* Quadro de vigência */}
          <div className="placas-cor-exata mt-4 grid grid-cols-3 gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-center text-xs">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Data de Saída</div>
              <div className="mt-0.5 text-sm font-extrabold text-slate-900">
                {formatarData(placa.finished_at)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Prazo Legal</div>
              <div className="mt-0.5 text-sm font-extrabold text-emerald-800">90 dias corridos</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Válida até</div>
              <div className="mt-0.5 text-sm font-extrabold text-[#0B1E3F]">
                {formatarData(validadeIso)}
              </div>
            </div>
          </div>

          {/* Dados da placa e do cliente */}
          <section className="mt-4">
            <div className="placas-cor-exata bg-[#0B1E3F] px-3 py-1.5 text-[11px] font-bold tracking-wider text-white uppercase">
              1. Identificação da Ordem de Serviço e do Cliente
            </div>
            <table className="w-full border-collapse border border-slate-300 text-xs">
              <tbody>
                <tr>
                  <td className="w-3/5 border border-slate-300 px-3 py-2">
                    <strong>Cliente / Parceiro:</strong> {placa.customer_name}
                  </td>
                  <td className="w-2/5 border border-slate-300 px-3 py-2">
                    <strong>CPF/CNPJ:</strong> {docFormatado}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 px-3 py-2">
                    <strong>Telefone:</strong>{' '}
                    {placa.customer_phone ? formatarTelefone(placa.customer_phone) : '—'}
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <strong>Nº da Ordem de Serviço:</strong>{' '}
                    <span className="font-mono font-bold">{placa.board_number}</span>
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
                {placa.is_warranty && (
                  <tr>
                    <td colSpan={2} className="border border-slate-300 px-3 py-2">
                      <strong>Retorno em garantia</strong> da placa{' '}
                      <span className="font-mono font-bold">{placa.warranty_origin_number ?? '—'}</span>. O serviço refeito
                      tem nova garantia de 90 dias a partir desta saída, restrita ao que foi refeito.
                    </td>
                  </tr>
                )}
                {mostrarValor && (
                  <tr>
                    <td colSpan={2} className="border border-slate-300 px-3 py-2">
                      <strong>Valor do Serviço Executado:</strong>{' '}
                      {placa.is_warranty && valorServico === 0
                        ? 'Isento (retorno em garantia)'
                        : valorEmReais(valorServico) || '—'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {/* Componentes substituídos */}
          <section className="mt-4">
            <div className="placas-cor-exata bg-[#0B1E3F] px-3 py-1.5 text-[11px] font-bold tracking-wider text-white uppercase">
              2. Circuito Reparado e Componentes Substituídos
            </div>
            <div className="space-y-2 border border-t-0 border-slate-300 p-3.5 text-xs leading-relaxed">
              <p>
                <strong>Componentes substituídos / intervenção realizada:</strong>{' '}
                {placa.replaced_components || 'Conforme registro interno de bancada.'}
              </p>
              {placa.bench_technician_name && (
                <p className="text-slate-600">
                  <strong>Técnico responsável pelo reparo e teste:</strong>{' '}
                  {placa.bench_technician_name}
                </p>
              )}
            </div>
          </section>

          {/* Cláusulas jurídicas literais */}
          <section className="mt-4">
            <div className="placas-cor-exata bg-[#0B1E3F] px-3 py-1.5 text-[11px] font-bold tracking-wider text-white uppercase">
              3. Termos e Condições de Garantia Legal (Art. 26 do CDC)
            </div>
            <div className="space-y-2 border border-t-0 border-slate-300 p-3.5 text-xs leading-relaxed text-slate-800">
              {CLAUSULAS_TERMO_GARANTIA.map((clausula, idx) => (
                <p key={idx}>{clausula}</p>
              ))}
            </div>
          </section>

          <div className="placas-cor-exata mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-center text-xs font-bold text-amber-950">
            IMPORTANTE: Guarde este documento. Para acionar a garantia é indispensável informar o nº{' '}
            <span className="font-mono">{placa.board_number}</span> e manter o selo de garantia de bancada sem violação.
          </div>

          <footer className="mt-10 grid grid-cols-2 gap-8 pt-6 text-center text-xs">
            <div className="border-t border-slate-800 pt-1.5">
              <div className="font-bold text-slate-900">{EMPRESA_BRV.nomeCurto}</div>
              <div className="text-[11px] text-slate-500">Laboratório de Eletrônica</div>
            </div>
            <div className="border-t border-slate-800 pt-1.5">
              <div className="font-bold text-slate-900">{placa.customer_name}</div>
              <div className="text-[11px] text-slate-500">Ciente das condições e retirada</div>
            </div>
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  );
}

