import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Copy, MessageCircle, Printer, X } from 'lucide-react';
import type { ItemOficinaTela } from '../../types/oficina';
import { telefoneDoClienteDoItem } from '../../services/oficina';
import { formatarDataHora } from '../../utils/ordens';
import { formatarTelefone } from '../../utils/telefone';
import {
  CLAUSULAS_COMPROVANTE_OFICINA,
  ROTULO_UNIDADE,
  WHATSAPP_OFICINA,
  linkAcompanhamentoOficina,
  numeroItem,
  textoWhatsAppEntradaOficina,
} from '../../utils/oficina';
import { EMPRESA_BRV } from '../pmoc/empresa';
import { montarLinkWhatsAppPlaca } from '../placas/regrasPlacas';

interface ComprovanteEntradaOficinaProps {
  item: ItemOficinaTela;
  /** Itens da mesma OS (para mostrar "OS 17300 · item 2" quando houver mais de um). */
  totalNaOs?: number;
  onFechar: () => void;
}

const ESTILO_IMPRESSAO = `
@media print {
  @page {
    size: A4 portrait;
    margin: 12mm 14mm 14mm 14mm;
  }
  .oficina-cor-exata {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
`;

/**
 * Comprovante de entrada de um equipamento na oficina (A4 para imprimir) com o link de acompanhamento,
 * que vai pelo WhatsApp para o cliente. Mesmo modelo do comprovante das placas (`ComprovanteEntradaDocumento`).
 * Só admin/escritório abre (o telefone do cliente vem de `oficina_contato_cliente`).
 */
export default function ComprovanteEntradaOficina({ item, totalNaOs, onFechar }: ComprovanteEntradaOficinaProps) {
  const [telefone, setTelefone] = useState<string | null | undefined>(undefined);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let ativo = true;
    telefoneDoClienteDoItem(item.id)
      .then((t) => ativo && setTelefone(t))
      .catch(() => ativo && setTelefone(null));
    return () => {
      ativo = false;
    };
  }, [item.id]);

  const numero = numeroItem(item, totalNaOs);
  const link = linkAcompanhamentoOficina(item.public_token);
  const urlWhatsApp = montarLinkWhatsAppPlaca(telefone, textoWhatsAppEntradaOficina(item, totalNaOs));
  const marcaModelo = [item.brand, item.model].filter(Boolean).join(' ') || 'Não informado';
  const capacidade = item.capacity_btu ? `${item.capacity_btu.toLocaleString('pt-BR')} BTU` : null;

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt('Copie o link:', link);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Comprovante de entrada ${numero}`}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-100 print:static print:overflow-visible print:bg-white"
    >
      <style>{ESTILO_IMPRESSAO}</style>

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
            <h1 className="text-base font-bold text-slate-900">Comprovante de Entrada · {numero}</h1>
            <p className="text-xs text-slate-500">
              Entregue impresso no balcão ou envie o link de acompanhamento pelo WhatsApp.
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
            Imprimir
          </button>

          <button
            type="button"
            onClick={() => void copiarLink()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-2xs transition hover:bg-slate-50"
          >
            <Copy size={15} aria-hidden="true" />
            {copiado ? 'Link copiado' : 'Copiar link'}
          </button>

          <a
            href={urlWhatsApp}
            target="_blank"
            rel="noreferrer"
            aria-disabled={telefone === undefined}
            onClick={(e) => telefone === undefined && e.preventDefault()}
            className={`inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 ${
              telefone === undefined ? 'pointer-events-none opacity-60' : ''
            }`}
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
        {telefone === null && (
          <p className="w-full text-xs font-medium text-amber-700">
            Cliente sem telefone no cadastro: o WhatsApp abre para você escolher o contato.
          </p>
        )}
      </div>

      {/* Folha A4 */}
      <div className="mx-auto my-6 max-w-4xl px-4 sm:px-6 print:m-0 print:max-w-none print:p-0">
        <div className="oficina-cor-exata rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm sm:p-10 print:rounded-none print:border-none print:p-0 print:shadow-none">
          <header className="flex items-start justify-between gap-4 border-b-2 border-[#0B1E3F] pb-4">
            <div className="flex items-center gap-3.5">
              <img
                src={EMPRESA_BRV.logoUrl}
                alt="Logo BRV Niterói"
                className="oficina-cor-exata h-13 w-auto rounded-lg bg-[#0B1E3F] p-2 object-contain"
              />
              <div>
                <h2 className="text-base font-extrabold text-[#0B1E3F]">{EMPRESA_BRV.razaoSocial}</h2>
                <p className="text-[11px] text-slate-600">
                  CNPJ {EMPRESA_BRV.cnpj} · WhatsApp {WHATSAPP_OFICINA}
                </p>
                <p className="text-[11px] text-slate-600">{EMPRESA_BRV.endereco}</p>
              </div>
            </div>

            <div className="text-right">
              <div className="oficina-cor-exata inline-block rounded-lg bg-[#0B1E3F] px-3 py-1.5 font-mono text-sm font-extrabold text-white">
                {numero}
              </div>
              <p className="mt-1 text-[11px] font-semibold text-slate-600">
                Entrada: {formatarDataHora(item.received_at ?? item.created_at)}
              </p>
              {item.is_warranty && (
                <span className="oficina-cor-exata mt-1 inline-block rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-800 uppercase">
                  Retorno em garantia
                </span>
              )}
            </div>
          </header>

          <div className="mt-4 text-center">
            <h3 className="text-base font-extrabold tracking-wide text-[#0B1E3F] uppercase">
              Comprovante de recebimento de equipamento — Oficina
            </h3>
          </div>

          {/* 1. Dados */}
          <section className="mt-4">
            <div className="oficina-cor-exata bg-[#0B1E3F] px-3 py-1.5 text-[11px] font-bold tracking-wider text-white uppercase">
              1. Dados de entrada e identificação
            </div>
            <table className="w-full border-collapse border border-slate-300 text-xs">
              <tbody>
                <tr>
                  <td className="w-3/5 border border-slate-300 px-3 py-2">
                    <strong>Cliente:</strong> {item.customer_name || '—'}
                  </td>
                  <td className="w-2/5 border border-slate-300 px-3 py-2">
                    <strong>Telefone:</strong> {telefone ? formatarTelefone(telefone) : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 px-3 py-2">
                    <strong>Equipamento:</strong> {item.equipment_type} — {ROTULO_UNIDADE[item.units_collected]}
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <strong>Recebido / retirado por:</strong> {item.pickup_employee_name || 'Recepção BRV'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 px-3 py-2">
                    <strong>Marca / modelo:</strong> {marcaModelo}
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <strong>Nº de série:</strong>{' '}
                    <span className="font-mono">{item.serial_number || '—'}</span>
                  </td>
                </tr>
                {(capacidade || item.voltage) && (
                  <tr>
                    <td className="border border-slate-300 px-3 py-2">
                      <strong>Capacidade:</strong> {capacidade || '—'}
                    </td>
                    <td className="border border-slate-300 px-3 py-2">
                      <strong>Tensão:</strong> {item.voltage || '—'}
                    </td>
                  </tr>
                )}
                <tr>
                  <td colSpan={2} className="border border-slate-300 px-3 py-2">
                    <strong>Acessórios entregues:</strong> {item.accessories || 'Nenhum acessório'}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="border border-slate-300 px-3 py-2">
                    <strong>Defeito relatado:</strong> {item.reported_defect || 'Não informado'}
                  </td>
                </tr>
                {item.intake_notes && (
                  <tr>
                    <td colSpan={2} className="border border-slate-300 px-3 py-2">
                      <strong>Conferência na entrada (estado e avarias aparentes):</strong> {item.intake_notes}
                    </td>
                  </tr>
                )}
                {item.is_warranty && item.warranty_origin_os_number && (
                  <tr>
                    <td colSpan={2} className="border border-slate-300 px-3 py-2">
                      <strong>Garantia do serviço anterior:</strong> OS {item.warranty_origin_os_number}
                      {item.warranty_origin_item ? ` · item ${item.warranty_origin_item}` : ''}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {/* 2. Acompanhamento */}
          <section className="mt-4">
            <div className="oficina-cor-exata bg-[#0B1E3F] px-3 py-1.5 text-[11px] font-bold tracking-wider text-white uppercase">
              2. Acompanhe o andamento pelo celular
            </div>
            <div className="space-y-1 border border-t-0 border-slate-300 p-4 text-xs">
              <p className="font-bold text-slate-900">
                Veja em que etapa está o seu equipamento, sem precisar de senha:
              </p>
              <p className="break-all rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs font-semibold text-[#0B1E3F]">
                {link}
              </p>
              <p className="text-[11px] text-slate-500">
                Em caso de dúvidas, fale com a BRV no WhatsApp {WHATSAPP_OFICINA} informando o número{' '}
                <strong>{numero}</strong>.
              </p>
            </div>
          </section>

          {/* 3. Condições */}
          <section className="mt-4">
            <div className="oficina-cor-exata bg-[#0B1E3F] px-3 py-1.5 text-[11px] font-bold tracking-wider text-white uppercase">
              3. Condições de guarda e garantia
            </div>
            <div className="space-y-1.5 border border-t-0 border-slate-300 p-3 text-[11px] leading-snug text-slate-700">
              {CLAUSULAS_COMPROVANTE_OFICINA.map((clausula) => (
                <p key={clausula}>{clausula}</p>
              ))}
            </div>
          </section>

          <footer className="mt-10 grid grid-cols-2 gap-8 pt-6 text-center text-xs">
            <div className="border-t border-slate-800 pt-1.5">
              <div className="font-bold text-slate-900">{item.customer_name || 'Cliente'}</div>
              <div className="text-[11px] text-slate-500">Assinatura do cliente / portador</div>
            </div>
            <div className="border-t border-slate-800 pt-1.5">
              <div className="font-bold text-slate-900">{EMPRESA_BRV.nomeCurto}</div>
              <div className="text-[11px] text-slate-500">
                Recebido por: {item.pickup_employee_name || 'Recepção / Oficina'}
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  );
}
