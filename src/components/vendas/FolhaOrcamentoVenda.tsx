import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, Printer, X } from 'lucide-react';
import type { PublicQuoteView, Quote } from '../../types/vendas';
import { formatarReais } from '../../utils/dinheiro';
import { formatarDocumento } from '../../utils/documento';
import { formatarData } from '../../utils/ordens';
import { formatarTelefone } from '../../utils/telefone';
import { EMPRESA_BRV } from '../pmoc/empresa';

export const ESTILO_IMPRESSAO_ORCAMENTO_VENDA_A4 = `
@media print {
  @page {
    size: A4 portrait;
    margin: 12mm 14mm 14mm 14mm;
  }
  .vendas-cor-exata {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
`;

export type DadosFolhaOrcamentoVenda = Pick<
  PublicQuoteView,
  | 'number'
  | 'customer_name'
  | 'customer_person_type'
  | 'customer_document'
  | 'address_text'
  | 'contact_name'
  | 'contact_phone'
  | 'seller_name'
  | 'validity_days'
  | 'valid_until'
  | 'products_subtotal_cents'
  | 'services_subtotal_cents'
  | 'general_discount_cents'
  | 'freight_cents'
  | 'total_cents'
  | 'payment_terms_note'
  | 'notes'
  | 'items'
  | 'created_at'
>;

interface FolhaOrcamentoVendaProps {
  dados: DadosFolhaOrcamentoVenda;
  aceiteCliente?: ReactNode;
}

/**
 * Folha A4 retrato de orçamento de produtos e serviços.
 * Compartilhada entre o modal de impressão do escritório e a página pública `/orcamento/:token`.
 */
export default function FolhaOrcamentoVenda({
  dados,
  aceiteCliente,
}: FolhaOrcamentoVendaProps) {
  const produtos = dados.items.filter((i) => i.kind === 'produto');
  const servicos = dados.items.filter((i) => i.kind === 'servico');
  const docFormatado = dados.customer_document
    ? formatarDocumento(dados.customer_document, dados.customer_person_type)
    : 'Não informado';

  return (
    <div className="vendas-cor-exata rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm sm:p-10 print:rounded-none print:border-none print:p-0 print:shadow-none">
      {/* Cabeçalho institucional */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#0B1E3F] pb-4">
        <div className="flex items-center gap-3.5">
          <img
            src={EMPRESA_BRV.logoUrl}
            alt="Logo BRV Niterói"
            className="vendas-cor-exata h-13 w-auto rounded-lg bg-[#0B1E3F] p-2 object-contain"
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
          <div className="vendas-cor-exata inline-block rounded-lg bg-[#0B1E3F] px-3 py-1.5 font-mono text-sm font-extrabold text-white">
            {dados.number}
          </div>
          <p className="mt-1 text-[11px] font-semibold text-slate-600">
            Data: {formatarData(dados.created_at)}
          </p>
          <p className="text-[11px] font-semibold text-amber-800">
            Validade: {dados.validity_days} dias (até {formatarData(dados.valid_until)})
          </p>
          {dados.seller_name && (
            <p className="text-[11px] text-slate-500">Vendedor(a): {dados.seller_name}</p>
          )}
        </div>
      </header>

      <div className="mt-4 text-center">
        <h3 className="text-base font-extrabold tracking-wide text-[#0B1E3F] uppercase">
          PROPOSTA COMERCIAL DE PRODUTOS E SERVIÇOS DE CLIMATIZAÇÃO
        </h3>
      </div>

      {/* 1. Identificação do Cliente */}
      <section className="mt-4">
        <div className="vendas-cor-exata bg-[#0B1E3F] px-3 py-1.5 text-[11px] font-bold tracking-wider text-white uppercase">
          1. Dados do Cliente
        </div>
        <table className="w-full border-collapse border border-slate-300 text-xs">
          <tbody>
            <tr>
              <td className="w-3/5 border border-slate-300 px-3 py-2">
                <strong>Cliente:</strong> {dados.customer_name}
              </td>
              <td className="w-2/5 border border-slate-300 px-3 py-2">
                <strong>CPF/CNPJ:</strong> {docFormatado}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-300 px-3 py-2">
                <strong>Endereço:</strong> {dados.address_text || 'Não informado'}
              </td>
              <td className="border border-slate-300 px-3 py-2">
                <strong>Contato / Telefone:</strong>{' '}
                {[
                  dados.contact_name,
                  dados.contact_phone ? formatarTelefone(dados.contact_phone) : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 2. Tabela de Produtos */}
      {produtos.length > 0 && (
        <section className="mt-4">
          <div className="vendas-cor-exata flex items-center justify-between bg-[#0B1E3F] px-3 py-1.5 text-[11px] font-bold tracking-wider text-white uppercase">
            <span>2. Materiais e Produtos</span>
            <span>Subtotal: {formatarReais(dados.products_subtotal_cents)}</span>
          </div>
          <table className="w-full border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 text-left text-[11px] font-bold text-slate-700">
                <th className="border border-slate-300 px-2.5 py-1.5">Código</th>
                <th className="border border-slate-300 px-2.5 py-1.5">Produto</th>
                <th className="border border-slate-300 px-2.5 py-1.5 text-center">Qtd.</th>
                <th className="border border-slate-300 px-2.5 py-1.5 text-right">Unitário</th>
                <th className="border border-slate-300 px-2.5 py-1.5 text-right">Desconto</th>
                <th className="border border-slate-300 px-2.5 py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((item) => (
                <tr key={item.id}>
                  <td className="border border-slate-300 px-2.5 py-1.5 font-mono text-[11px]">
                    {item.code}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 font-medium">
                    {item.name}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 text-center tabular-nums">
                    {item.quantity.toLocaleString('pt-BR')} {item.unit}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums">
                    {formatarReais(item.unit_price_cents)}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums text-slate-500">
                    {item.discount_cents > 0 ? `- ${formatarReais(item.discount_cents)}` : '—'}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 text-right font-bold tabular-nums">
                    {formatarReais(item.total_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 3. Tabela de Serviços */}
      {servicos.length > 0 && (
        <section className="mt-4">
          <div className="vendas-cor-exata flex items-center justify-between bg-[#0B1E3F] px-3 py-1.5 text-[11px] font-bold tracking-wider text-white uppercase">
            <span>{produtos.length > 0 ? '3. Mão de Obra e Serviços' : '2. Mão de Obra e Serviços'}</span>
            <span>Subtotal: {formatarReais(dados.services_subtotal_cents)}</span>
          </div>
          <table className="w-full border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 text-left text-[11px] font-bold text-slate-700">
                <th className="border border-slate-300 px-2.5 py-1.5">Código</th>
                <th className="border border-slate-300 px-2.5 py-1.5">Serviço</th>
                <th className="border border-slate-300 px-2.5 py-1.5 text-center">Qtd.</th>
                <th className="border border-slate-300 px-2.5 py-1.5 text-right">Unitário</th>
                <th className="border border-slate-300 px-2.5 py-1.5 text-right">Desconto</th>
                <th className="border border-slate-300 px-2.5 py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {servicos.map((item) => (
                <tr key={item.id}>
                  <td className="border border-slate-300 px-2.5 py-1.5 font-mono text-[11px]">
                    {item.code}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 font-medium">
                    {item.name}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 text-center tabular-nums">
                    {item.quantity.toLocaleString('pt-BR')} {item.unit}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums">
                    {formatarReais(item.unit_price_cents)}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums text-slate-500">
                    {item.discount_cents > 0 ? `- ${formatarReais(item.discount_cents)}` : '—'}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 text-right font-bold tabular-nums">
                    {formatarReais(item.total_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Resumo Financeiro e Condições */}
      <section className="mt-4">
        <div className="vendas-cor-exata bg-[#0B1E3F] px-3 py-1.5 text-[11px] font-bold tracking-wider text-white uppercase">
          Resumo e Condições Comerciais
        </div>
        <div className="grid grid-cols-1 gap-4 border border-t-0 border-slate-300 p-3.5 text-xs sm:grid-cols-2">
          <div className="space-y-1">
            <p>
              <strong>Forma de pagamento prevista:</strong>{' '}
              {dados.payment_terms_note || 'A combinar com o atendimento'}
            </p>
            <p>
              <strong>Validade da proposta:</strong> {dados.validity_days} dias corridos (até{' '}
              {formatarData(dados.valid_until)})
            </p>
          </div>

          <div className="space-y-1 text-right">
            {produtos.length > 0 && (
              <div className="text-slate-600">
                Subtotal Produtos: <strong>{formatarReais(dados.products_subtotal_cents)}</strong>
              </div>
            )}
            {servicos.length > 0 && (
              <div className="text-slate-600">
                Subtotal Serviços: <strong>{formatarReais(dados.services_subtotal_cents)}</strong>
              </div>
            )}
            {dados.general_discount_cents > 0 && (
              <div className="text-rose-700">
                Desconto Geral: <strong>- {formatarReais(dados.general_discount_cents)}</strong>
              </div>
            )}
            {dados.freight_cents > 0 && (
              <div className="text-slate-600">
                Frete / Outras despesas: <strong>+ {formatarReais(dados.freight_cents)}</strong>
              </div>
            )}
            <div className="border-t border-slate-200 pt-1.5 text-base font-extrabold text-[#0B1E3F]">
              Total Geral: {formatarReais(dados.total_cents)}
            </div>
          </div>
        </div>
      </section>

      {/* Observações */}
      {dados.notes && (
        <section className="mt-4">
          <div className="vendas-cor-exata bg-[#0B1E3F] px-3 py-1.5 text-[11px] font-bold tracking-wider text-white uppercase">
            Observações e Condições Técnicas
          </div>
          <div className="whitespace-pre-line border border-t-0 border-slate-300 p-3 text-xs leading-relaxed text-slate-800">
            {dados.notes}
          </div>
        </section>
      )}

      {/* Linha de aceite */}
      <footer className="mt-8 grid grid-cols-2 gap-8 pt-6 text-center text-xs">
        <div className="border-t border-slate-800 pt-1.5">
          <div className="font-bold text-slate-900">{EMPRESA_BRV.nomeCurto}</div>
          <div className="text-[11px] text-slate-500">
            {dados.seller_name || 'Departamento Comercial'}
          </div>
        </div>
        <div className="border-t border-slate-800 pt-1.5">
          <div className="font-bold text-slate-900">{dados.customer_name}</div>
          <div className="text-[11px] text-slate-500">
            {aceiteCliente ?? 'De acordo / Autorização do Cliente'}
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// Modal A4 em Portal no document.body (para o escritório imprimir / enviar WhatsApp)
// ============================================================================

interface OrcamentoDocumentoModalProps {
  orcamento: Quote;
  onFechar: () => void;
  onEnviarWhatsApp: () => void;
}

export function OrcamentoDocumentoModal({
  orcamento,
  onFechar,
  onEnviarWhatsApp,
}: OrcamentoDocumentoModalProps) {
  const aceite =
    orcamento.status === 'aprovado' || orcamento.status === 'convertido'
      ? `Aprovado por ${orcamento.responded_by_name || 'cliente'}${orcamento.responded_at ? ` em ${formatarData(orcamento.responded_at)}` : ''}`
      : undefined;

  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-xs sm:p-6 print:static print:bg-white print:p-0">
      <style>{ESTILO_IMPRESSAO_ORCAMENTO_VENDA_A4}</style>

      {/* Barra de ações (some na impressão) */}
      <div className="mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg print:hidden">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900">
            Documento do Orçamento · {orcamento.number}
          </h2>
          <p className="text-xs text-slate-500">
            Imprima em A4 ou envie o link de aprovação pelo WhatsApp
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
          >
            <Printer size={15} />
            Imprimir / Salvar PDF
          </button>

          <button
            type="button"
            onClick={onEnviarWhatsApp}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700"
          >
            <MessageCircle size={15} />
            Enviar pelo WhatsApp (link para aprovar)
          </button>

          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar documento"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl print:max-w-none">
        <FolhaOrcamentoVenda dados={orcamento} aceiteCliente={aceite} />
      </div>
    </div>,
    document.body,
  );
}

