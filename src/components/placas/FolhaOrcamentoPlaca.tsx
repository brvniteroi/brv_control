import type { ReactNode } from 'react';
import type { BoardPublicQuote } from '../../types/placas';
import { formatarDocumento } from '../../utils/documento';
import { valorEmReais } from '../../utils/oficina';
import { formatarData } from '../../utils/ordens';
import { formatarTelefone } from '../../utils/telefone';
import { EMPRESA_BRV } from '../pmoc/empresa';
import { CORES_TIPO_CLIENTE_PLACA } from './cores';
import { exigeSinalPlaca } from './regrasPlacas';
import {
  CHAVE_PIX_ORCAMENTO_PLACA,
  CLAUSULAS_ORCAMENTO_PLACA,
  textoPoliticaExecucaoOrcamento,
} from './textosJuridicosPlacas';

/** Campos que a folha usa: servem tanto a placa do escritório (`BoardOrder`) quanto o orçamento público (`BoardPublicQuote`). */
export type DadosFolhaOrcamento = Pick<
  BoardPublicQuote,
  | 'board_number'
  | 'customer_name'
  | 'customer_phone'
  | 'customer_kind'
  | 'customer_document'
  | 'customer_person_type'
  | 'customer_address'
  | 'equipment_type'
  | 'brand_model'
  | 'board_code'
  | 'peripherals'
  | 'reported_defect'
  | 'error_code'
  | 'quote_technical_opinion'
  | 'quote_amount'
  | 'quote_validity_days'
> & { technical_diagnosis?: string | null };

/** Estilo A4 da impressão; vai junto de quem monta a folha (portal em `document.body`, porque o `#root` some ao imprimir). */
export const ESTILO_IMPRESSAO_ORCAMENTO_A4 = `
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

interface FolhaOrcamentoPlacaProps {
  dados: DadosFolhaOrcamento;
  /** Data de emissão (envio do orçamento); a validade conta a partir dela. */
  dataEmissao: Date;
  /** Substitui o campo de assinatura do cliente (ex.: "Aprovado pelo link em ..."). */
  aceiteCliente?: ReactNode;
}

/** Folha A4 do orçamento de placa (mesmo documento no escritório e na página pública do cliente). */
export default function FolhaOrcamentoPlaca({ dados, dataEmissao, aceiteCliente }: FolhaOrcamentoPlacaProps) {
  const valorTotal = dados.quote_amount ?? 0;
  const valorEntrada = valorTotal / 2;
  const comSinal = exigeSinalPlaca(valorTotal);
  const diasValidade = dados.quote_validity_days || 10;
  const dataValidade = new Date(dataEmissao.getTime() + diasValidade * 86_400_000);
  const docFormatado = dados.customer_document
    ? formatarDocumento(dados.customer_document, dados.customer_person_type)
    : 'Não informado';

  return (
    <div className="placas-cor-exata rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm sm:p-10 print:rounded-none print:border-none print:p-0 print:shadow-none">
      {/* Cabeçalho institucional */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#0B1E3F] pb-4">
        <div className="flex items-center gap-3.5">
          <img
            src={EMPRESA_BRV.logoUrl}
            alt="Logo BRV Niterói"
            className="placas-cor-exata h-13 w-auto rounded-lg bg-[#0B1E3F] p-2 object-contain"
          />
          <div>
            <h2 className="text-base font-extrabold text-[#0B1E3F]">{EMPRESA_BRV.razaoSocial}</h2>
            <p className="text-[11px] text-slate-600">
              CNPJ {EMPRESA_BRV.cnpj} · Tel./WhatsApp {EMPRESA_BRV.telefone}
            </p>
            <p className="text-[11px] text-slate-600">{EMPRESA_BRV.endereco}</p>
          </div>
        </div>

        <div className="text-right">
          <div className="placas-cor-exata inline-block rounded-lg bg-[#0B1E3F] px-3 py-1.5 font-mono text-sm font-extrabold text-white">
            {dados.board_number}
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
                <strong>Cliente:</strong> {dados.customer_name}{' '}
                <span className="text-[11px] text-slate-500">
                  ({CORES_TIPO_CLIENTE_PLACA[dados.customer_kind].rotulo})
                </span>
              </td>
              <td className="w-2/5 border border-slate-300 px-3 py-2">
                <strong>CPF/CNPJ:</strong> {docFormatado}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-300 px-3 py-2">
                <strong>Endereço:</strong> {dados.customer_address || 'Não informado'}
              </td>
              <td className="border border-slate-300 px-3 py-2">
                <strong>Telefone:</strong> {dados.customer_phone ? formatarTelefone(dados.customer_phone) : '—'}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-300 px-3 py-2">
                <strong>Equipamento / Marca-Modelo:</strong> {dados.equipment_type} — {dados.brand_model}
              </td>
              <td className="border border-slate-300 px-3 py-2">
                <strong>Código da Placa:</strong> <span className="font-mono font-bold">{dados.board_code}</span>
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="border border-slate-300 px-3 py-2">
                <strong>Periféricos / Acessórios recebidos:</strong> {dados.peripherals || 'Apenas a placa eletrônica'}
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
            <strong>Sintoma / Defeito reclamado:</strong> {dados.reported_defect}
            {dados.error_code ? ` (Código de erro: ${dados.error_code})` : ''}
          </p>
          <p>
            <strong>Parecer técnico laboratorial:</strong>{' '}
            {dados.quote_technical_opinion || dados.technical_diagnosis || 'Reparo eletrônico em bancada especializada.'}
          </p>
        </div>
      </section>

      {/* 3. Investimento e Condições Comerciais */}
      <section className="mt-4">
        <div className="placas-cor-exata bg-[#0B1E3F] px-3 py-1.5 text-[11px] font-bold tracking-wider text-white uppercase">
          3. Investimento Total e Condições Comerciais
        </div>
        <div className="border border-t-0 border-slate-300 p-3.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
            <div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Valor Total do Reparo Eletrônico</div>
              <div className="text-xl font-extrabold text-[#0B1E3F]">{valorEmReais(valorTotal) || 'R$ 0,00'}</div>
            </div>
            <div className="text-right">
              {comSinal ? (
                <>
                  <div className="text-[11px] text-slate-600">
                    <strong>Entrada (50% via PIX):</strong> {valorEmReais(valorEntrada)}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    <strong>Saldo na retirada (50%):</strong> {valorEmReais(valorEntrada)}
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-slate-600">
                  <strong>Pagamento via PIX na retirada da placa</strong> (sem sinal)
                </div>
              )}
              <div className="mt-0.5 text-[11px] text-slate-700">
                <strong>Chave PIX (E-mail):</strong>{' '}
                <span className="font-mono font-bold">{CHAVE_PIX_ORCAMENTO_PLACA}</span> ({EMPRESA_BRV.razaoSocial})
              </div>
            </div>
          </div>

          {comSinal && (
            <p className="placas-cor-exata mt-2.5 rounded border border-amber-300 bg-amber-50 p-2.5 text-[11px] leading-relaxed font-semibold text-amber-950">
              {textoPoliticaExecucaoOrcamento(valorEmReais(valorEntrada) || '50%')}
            </p>
          )}
        </div>
      </section>

      {/* 4. Termos de Garantia Legal e Cláusula de Abandono */}
      <section className="mt-4">
        <div className="placas-cor-exata bg-[#0B1E3F] px-3 py-1.5 text-[11px] font-bold tracking-wider text-white uppercase">
          4. Condições Gerais, Garantia Legal (CDC) e Guarda de Bem
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
          <div className="font-bold text-slate-900">{dados.customer_name}</div>
          <div className="text-[11px] text-slate-500">{aceiteCliente ?? 'De acordo / Autorização do Cliente'}</div>
        </div>
      </footer>
    </div>
  );
}
