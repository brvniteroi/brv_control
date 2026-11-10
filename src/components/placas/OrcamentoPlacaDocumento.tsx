import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, CheckCircle2, Loader2, MessageCircle, Printer, X } from 'lucide-react';
import type { BoardOrder } from '../../types/placas';
import { formatarDocumento } from '../../utils/documento';
import { valorEmReais } from '../../utils/oficina';
import { formatarData } from '../../utils/ordens';
import { formatarTelefone } from '../../utils/telefone';
import { EMPRESA_BRV } from '../pmoc/empresa';
import { CORES_TIPO_CLIENTE_PLACA } from './cores';
import { gerarPdfOrcamento, registrarEnvioOrcamento } from './fonteDeDados';
import { montarLinkWhatsAppPlaca, textoWhatsAppOrcamentoPlaca } from './regrasPlacas';
import {
  CHAVE_PIX_ORCAMENTO_PLACA,
  CLAUSULAS_ORCAMENTO_PLACA,
  ESCOPO_ORCAMENTO_PLACA,
  textoPoliticaExecucaoOrcamento,
} from './textosJuridicosPlacas';

interface OrcamentoPlacaDocumentoProps {
  placa: BoardOrder;
  atorNome: string;
  onFechar: () => void;
  onPlacaAtualizada?: (placa: BoardOrder) => void;
}

const ESTILO_IMPRESSAO_A4 = `
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

export default function OrcamentoPlacaDocumento({
  placa,
  atorNome,
  onFechar,
  onPlacaAtualizada,
}: OrcamentoPlacaDocumentoProps) {
  const [enviandoWhats, setEnviandoWhats] = useState(false);
  const [avisoEnvio, setAvisoEnvio] = useState<string | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const valorTotal = placa.quote_amount ?? 0;
  const valorEntrada = valorTotal / 2;
  const diasValidade = placa.quote_validity_days || 10;
  const [dataEmissao] = useState(() => new Date());
  const dataValidade = new Date(dataEmissao.getTime() + diasValidade * 86_400_000);

  const docFormatado = placa.customer_document
    ? formatarDocumento(placa.customer_document, placa.customer_person_type)
    : 'Não informado';

  const handleEnviarWhatsApp = async () => {
    setEnviandoWhats(true);
    setAvisoEnvio(null);
    setErroEnvio(null);

    try {
      const blob = await gerarPdfOrcamento(placa.id);
      const nomeArquivo = `Orcamento_${placa.board_number}.pdf`;
      const arquivo = new File([blob], nomeArquivo, { type: 'application/pdf' });
      const mensagem = textoWhatsAppOrcamentoPlaca(placa);

      const atualizada = await registrarEnvioOrcamento(placa.id, atorNome);
      onPlacaAtualizada?.(atualizada);

      const navegadorComShare = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };

      if (
        typeof navegadorComShare.share === 'function' &&
        typeof navegadorComShare.canShare === 'function' &&
        navegadorComShare.canShare({ files: [arquivo] })
      ) {
        await navegadorComShare.share({
          title: `Orçamento ${placa.board_number} — ${EMPRESA_BRV.nomeCurto}`,
          text: mensagem,
          files: [arquivo],
        });
        setAvisoEnvio('PDF compartilhado e estado da placa atualizado para "Orçamento enviado".');
      } else {
        // Computador ou navegador sem compartilhamento de arquivos: baixa o PDF e abre o WhatsApp
        const urlBlob = URL.createObjectURL(blob);
        const linkDownload = document.createElement('a');
        linkDownload.href = urlBlob;
        linkDownload.download = nomeArquivo;
        document.body.appendChild(linkDownload);
        linkDownload.click();
        linkDownload.remove();
        setTimeout(() => URL.revokeObjectURL(urlBlob), 5000);

        const urlWa = montarLinkWhatsAppPlaca(placa.customer_phone, mensagem);
        window.open(urlWa, '_blank', 'noopener,noreferrer');
        setAvisoEnvio(
          `PDF "${nomeArquivo}" baixado e conversa do WhatsApp aberta. Anexe o PDF baixado na conversa.`,
        );
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setAvisoEnvio('Compartilhamento cancelado pelo usuário.');
      } else {
        setErroEnvio(e instanceof Error ? e.message : 'Não foi possível preparar o PDF do orçamento.');
      }
    } finally {
      setEnviandoWhats(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Proposta de Orçamento ${placa.board_number}`}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-100 print:static print:overflow-visible print:bg-white"
    >
      <style>{ESTILO_IMPRESSAO_A4}</style>

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
            <h1 className="text-base font-bold text-slate-900">
              Proposta de Orçamento · {placa.board_number}
            </h1>
            <p className="text-xs text-slate-500">
              Documento A4 retrato oficial — use Imprimir / Salvar PDF ou envie pelo WhatsApp.
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
            Enviar PDF pelo WhatsApp
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
        <div className="mx-auto mt-4 max-w-4xl px-4 sm:px-6 print:hidden">
          {avisoEnvio && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900"
            >
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" aria-hidden="true" />
              <span>{avisoEnvio}</span>
            </div>
          )}
          {erroEnvio && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-800"
            >
              {erroEnvio}
            </div>
          )}
        </div>
      )}

      {/* Folha A4 */}
      <div className="mx-auto my-6 max-w-4xl px-4 sm:px-6 print:m-0 print:max-w-none print:p-0">
        <div className="placas-cor-exata rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm sm:p-10 print:rounded-none print:border-none print:p-0 print:shadow-none">
          {/* Cabeçalho institucional */}
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
                Emissão: {formatarData(dataEmissao.toISOString())}
              </p>
              <p className="text-[11px] font-semibold text-amber-800">
                Validade: {diasValidade} dias (até {formatarData(dataValidade.toISOString())})
              </p>
            </div>
          </header>

          <div className="mt-4 text-center">
            <h3 className="text-base font-extrabold tracking-wide text-[#0B1E3F] uppercase">
              LAUDO TÉCNICO E PROPOSTA DE ORÇAMENTO — LABORATÓRIO DE ELETRÔNICA
            </h3>
          </div>

          {/* 1. Identificação do Cliente e Equipamento */}
          <section className="mt-4">
            <div className="placas-cor-exata bg-[#0B1E3F] px-3 py-1.5 text-[11px] font-bold tracking-wider text-white uppercase">
              1. Identificação do Cliente e do Equipamento
            </div>
            <table className="w-full border-collapse border border-slate-300 text-xs">
              <tbody>
                <tr>
                  <td className="w-3/5 border border-slate-300 px-3 py-2">
                    <strong>Cliente:</strong> {placa.customer_name}{' '}
                    <span className="text-[11px] text-slate-500">
                      ({CORES_TIPO_CLIENTE_PLACA[placa.customer_kind].rotulo})
                    </span>
                  </td>
                  <td className="w-2/5 border border-slate-300 px-3 py-2">
                    <strong>CPF/CNPJ:</strong> {docFormatado}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 px-3 py-2">
                    <strong>Endereço:</strong> {placa.customer_address || 'Não informado'}
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <strong>Telefone:</strong>{' '}
                    {placa.customer_phone ? formatarTelefone(placa.customer_phone) : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 px-3 py-2">
                    <strong>Equipamento / Marca-Modelo:</strong> {placa.equipment_type} —{' '}
                    {placa.brand_model}
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <strong>Código da Placa:</strong>{' '}
                    <span className="font-mono font-bold">{placa.board_code}</span>
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="border border-slate-300 px-3 py-2">
                    <strong>Periféricos / Acessórios recebidos:</strong>{' '}
                    {placa.peripherals || 'Apenas a placa eletrônica'}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 2. Diagnóstico e Parecer Técnico */}
          <section className="mt-4">
            <div className="placas-cor-exata bg-[#0B1E3F] px-3 py-1.5 text-[11px] font-bold tracking-wider text-white uppercase">
              2. Defeito Relatado e Parecer Técnico de Bancada
            </div>
            <div className="space-y-2 border border-t-0 border-slate-300 p-3 text-xs leading-relaxed">
              <p>
                <strong>Sintoma / Defeito reclamado:</strong> {placa.reported_defect}
                {placa.error_code ? ` (Código de erro: ${placa.error_code})` : ''}
              </p>
              <p>
                <strong>Parecer técnico laboratorial:</strong>{' '}
                {placa.quote_technical_opinion ||
                  placa.technical_diagnosis ||
                  'Reparo eletrônico em bancada especializada.'}
              </p>
            </div>
          </section>

          {/* 3. Escopo Técnico */}
          <section className="mt-4">
            <div className="placas-cor-exata bg-[#0B1E3F] px-3 py-1.5 text-[11px] font-bold tracking-wider text-white uppercase">
              3. Escopo dos Serviços Inclusos
            </div>
            <ul className="space-y-1 border border-t-0 border-slate-300 p-3 text-xs leading-relaxed text-slate-800">
              {ESCOPO_ORCAMENTO_PLACA.map((linha, idx) => (
                <li key={idx}>• {linha}</li>
              ))}
            </ul>
          </section>

          {/* 4. Investimento e Condições Comerciais */}
          <section className="mt-4">
            <div className="placas-cor-exata bg-[#0B1E3F] px-3 py-1.5 text-[11px] font-bold tracking-wider text-white uppercase">
              4. Investimento Total e Condições Comerciais
            </div>
            <div className="border border-t-0 border-slate-300 p-3.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">
                    Valor Total do Reparo Eletrônico
                  </div>
                  <div className="text-xl font-extrabold text-[#0B1E3F]">
                    {valorEmReais(valorTotal) || 'R$ 0,00'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-600">
                    <strong>Entrada (50% via PIX):</strong> {valorEmReais(valorEntrada)}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    <strong>Saldo na retirada (50%):</strong> {valorEmReais(valorEntrada)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-700">
                    <strong>Chave PIX (E-mail):</strong>{' '}
                    <span className="font-mono font-bold">{CHAVE_PIX_ORCAMENTO_PLACA}</span> (
                    {EMPRESA_BRV.razaoSocial})
                  </div>
                </div>
              </div>

              <p className="placas-cor-exata mt-2.5 rounded border border-amber-300 bg-amber-50 p-2.5 text-[11px] leading-relaxed font-semibold text-amber-950">
                {textoPoliticaExecucaoOrcamento(valorEmReais(valorEntrada) || '50%')}
              </p>
            </div>
          </section>

          {/* 5. Termos de Garantia Legal e Cláusula de Abandono */}
          <section className="mt-4">
            <div className="placas-cor-exata bg-[#0B1E3F] px-3 py-1.5 text-[11px] font-bold tracking-wider text-white uppercase">
              5. Condições Gerais, Garantia Legal (CDC) e Guarda de Bem
            </div>
            <div className="space-y-1.5 border border-t-0 border-slate-300 p-3 text-[10.5px] leading-snug text-slate-700">
              {CLAUSULAS_ORCAMENTO_PLACA.map((clausula, idx) => (
                <p key={idx}>
                  <strong>{clausula.titulo}</strong> {clausula.texto}
                </p>
              ))}
            </div>
          </section>

          {/* Assinaturas */}
          <footer className="mt-8 grid grid-cols-2 gap-8 pt-6 text-center text-xs">
            <div className="border-t border-slate-800 pt-1.5">
              <div className="font-bold text-slate-900">{EMPRESA_BRV.nomeCurto}</div>
              <div className="text-[11px] text-slate-500">Laboratório de Eletrônica</div>
            </div>
            <div className="border-t border-slate-800 pt-1.5">
              <div className="font-bold text-slate-900">{placa.customer_name}</div>
              <div className="text-[11px] text-slate-500">De acordo / Autorização do Cliente</div>
            </div>
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  );
}
