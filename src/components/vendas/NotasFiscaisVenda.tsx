import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Ban,
  Check,
  Copy,
  ExternalLink,
  FileCode2,
  FileText,
  FlaskConical,
  Loader2,
  Package,
  Printer,
  RefreshCw,
  Wrench,
  X,
} from 'lucide-react';
import type {
  Sale,
  SaleDocument,
  SaleDocumentGroup,
  SaleDocumentModel,
} from '../../types/vendas';
import { formatarReais } from '../../utils/dinheiro';
import { formatarDocumento } from '../../utils/documento';
import { formatarDataHora } from '../../utils/ordens';
import { EMPRESA_BRV } from '../pmoc/empresa';
import {
  CORES_SITUACAO_VENDA,
  CORES_STATUS_NOTA,
  ROTULO_FORMA_PAGAMENTO,
  ROTULO_MODELO_NOTA,
} from './cores';
import { ESTILO_IMPRESSAO_ORCAMENTO_VENDA_A4 } from './FolhaOrcamentoVenda';
import {
  FONTE_DADOS_DEMO,
  cancelarNotaVenda,
  emitirNotaVenda,
  registrarNotaManual,
} from './fonteDeDados';
import ModalDialogoVendas from './ModalDialogoVendas';
import { situacaoVenda, sugerirModeloNotaProdutos } from './regrasVendas';

interface NotasFiscaisVendaProps {
  venda: Sale;
  podeCancelarNota: boolean;
  atorNome: string;
  onVendaAtualizada: (atualizada: Sale) => void;
}

export default function NotasFiscaisVenda({
  venda,
  podeCancelarNota,
  atorNome,
  onVendaAtualizada,
}: NotasFiscaisVendaProps) {
  const temProdutos = venda.products_subtotal_cents > 0;
  const temServicos = venda.services_subtotal_cents > 0;

  const docProdutos = venda.documents.find((d) => d.group === 'produtos') ?? null;
  const docServicos = venda.documents.find((d) => d.group === 'servicos') ?? null;

  const sugeridoProd = sugerirModeloNotaProdutos(
    venda.customer_person_type,
    venda.invoice_document ?? venda.customer_document,
  );
  const [modeloProdutos, setModeloProdutos] = useState<'nfce' | 'nfe'>(
    docProdutos?.model === 'nfe' ? 'nfe' : docProdutos?.model === 'nfce' ? 'nfce' : sugeridoProd,
  );

  const [emitindoGrupo, setEmitindoGrupo] = useState<SaleDocumentGroup | null>(null);
  const [erroFiscal, setErroFiscal] = useState<string | null>(null);
  const [chaveCopiadaId, setChaveCopiadaId] = useState<string | null>(null);

  // Modal Cancelar Nota
  const [notaParaCancelar, setNotaParaCancelar] = useState<SaleDocument | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [cancelandoNota, setCancelandoNota] = useState(false);

  // Modal Preparar NFS-e para o Portal Nacional
  const [prepararNfseAberto, setPrepararNfseAberto] = useState(false);
  const [numeroNfseManual, setNumeroNfseManual] = useState('');
  const [salvandoNfseManual, setSalvandoNfseManual] = useState(false);
  const [campoCopiado, setCampoCopiado] = useState<string | null>(null);

  const handleEmitir = async (grupo: SaleDocumentGroup) => {
    setEmitindoGrupo(grupo);
    setErroFiscal(null);
    try {
      const modelo: SaleDocumentModel = grupo === 'servicos' ? 'nfse' : modeloProdutos;
      const atualizada = await emitirNotaVenda(venda.id, grupo, modelo, atorNome);
      onVendaAtualizada(atualizada);
    } catch (e) {
      setErroFiscal(e instanceof Error ? e.message : 'Não foi possível emitir a nota fiscal.');
    } finally {
      setEmitindoGrupo(null);
    }
  };

  const handleConfirmarCancelarNota = async (e: FormEvent) => {
    e.preventDefault();
    if (!notaParaCancelar || !motivoCancelamento.trim()) return;
    setCancelandoNota(true);
    setErroFiscal(null);
    try {
      const atualizada = await cancelarNotaVenda(
        notaParaCancelar.id,
        motivoCancelamento,
        atorNome,
      );
      onVendaAtualizada(atualizada);
      setNotaParaCancelar(null);
      setMotivoCancelamento('');
    } catch (err) {
      setErroFiscal(err instanceof Error ? err.message : 'Não foi possível cancelar a nota.');
    } finally {
      setCancelandoNota(false);
    }
  };

  const handleRegistrarNfseManual = async (e: FormEvent) => {
    e.preventDefault();
    if (!numeroNfseManual.trim()) return;
    setSalvandoNfseManual(true);
    setErroFiscal(null);
    try {
      const atualizada = await registrarNotaManual(
        venda.id,
        'nfse',
        numeroNfseManual,
        atorNome,
      );
      onVendaAtualizada(atualizada);
      setNumeroNfseManual('');
      setPrepararNfseAberto(false);
    } catch (err) {
      setErroFiscal(err instanceof Error ? err.message : 'Não foi possível registrar a NFS-e.');
    } finally {
      setSalvandoNfseManual(false);
    }
  };

  const copiarTexto = (chave: string, texto: string) => {
    void navigator.clipboard.writeText(texto);
    setCampoCopiado(chave);
    setTimeout(() => setCampoCopiado(null), 1800);
  };

  const servicosVenda = venda.items.filter((i) => i.kind === 'servico');
  const descricaoPortalNfse = servicosVenda
    .map(
      (s) =>
        `${s.quantity} ${s.unit} - ${s.name} (${formatarReais(s.total_cents)})`,
    )
    .join('\n');
  const docTomador = venda.invoice_document ?? venda.customer_document ?? '';

  const renderCartaoNota = (
    grupo: SaleDocumentGroup,
    valorCentavos: number,
    doc: SaleDocument | null,
  ) => {
    const status =emitindoGrupo === grupo ? 'emitindo' : (doc?.status ?? 'nao_emitida');
    const estiloStatus = CORES_STATUS_NOTA[status];
    const ehProd = grupo === 'produtos';
    const modeloExibido: SaleDocumentModel = ehProd
      ? (doc?.status === 'emitida' || doc?.status === 'cancelada' ? doc.model : modeloProdutos)
      : 'nfse';

    return (
      <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  ehProd ? 'bg-sky-50 text-sky-700' : 'bg-indigo-50 text-indigo-700'
                }`}
              >
                {ehProd ? <Package size={17} /> : <Wrench size={17} />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {ehProd ? 'Produtos' : 'Serviços'} ({ROTULO_MODELO_NOTA[modeloExibido]})
                </h3>
                <p className="text-xs font-extrabold text-brv-navy">
                  Valor da nota: {formatarReais(valorCentavos)}
                </p>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${estiloStatus.selo}`}
            >
              {status === 'emitindo' && <Loader2 size={11} className="animate-spin" />}
              {estiloStatus.rotulo}
            </span>
          </div>

          {/* Escolha de NFC-e vs NF-e para produtos antes da emissão */}
          {ehProd && status !== 'emitida' && status !== 'cancelada' && venda.status !== 'cancelada' && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-700">Tipo de nota de produtos:</span>
                <span className="text-slate-400">
                  Sugestão: {sugeridoProd === 'nfe' ? 'NF-e (CNPJ)' : 'NFC-e (Consumidor)'}
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5" role="group" aria-label="Escolher modelo de nota de produtos">
                {(['nfce', 'nfe'] as const).map((mod) => (
                  <button
                    key={mod}
                    type="button"
                    aria-pressed={modeloProdutos === mod}
                    onClick={() => setModeloProdutos(mod)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
                      modeloProdutos === mod
                        ? 'border-blue-600 bg-blue-50 text-blue-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {ROTULO_MODELO_NOTA[mod]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dados da nota emitida ou cancelada */}
          {doc && (doc.status === 'emitida' || doc.status === 'cancelada') && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Nº <strong>{doc.number}</strong>
                  {doc.series ? ` · Série ${doc.series}` : ''}
                </span>
                {doc.issued_at && (
                  <span className="text-[11px] text-slate-500">
                    {formatarDataHora(doc.issued_at)}
                  </span>
                )}
              </div>

              {doc.access_key && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                  <span className="truncate font-mono text-[10px] text-slate-600">
                    Chave: {doc.access_key}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(doc.access_key ?? '');
                      setChaveCopiadaId(doc.id);
                      setTimeout(() => setChaveCopiadaId(null), 1800);
                    }}
                    className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    {chaveCopiadaId === doc.id ? <Check size={11} /> : <Copy size={11} />}
                    {chaveCopiadaId === doc.id ? 'Copiada' : 'Copiar'}
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {doc.pdf_url && (
                  <a
                    href={doc.pdf_url}
                    onClick={(e) => {
                      e.preventDefault();
                      window.alert(
                        `Simulação de abertura do DANFE / PDF da ${ROTULO_MODELO_NOTA[doc.model]} nº ${doc.number}.`,
                      );
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                  >
                    <FileText size={12} className="text-red-600" /> PDF
                  </a>
                )}
                {doc.xml_url && (
                  <a
                    href={doc.xml_url}
                    onClick={(e) => {
                      e.preventDefault();
                      window.alert(
                        `Simulação de download do XML fiscal da ${ROTULO_MODELO_NOTA[doc.model]} nº ${doc.number}.`,
                      );
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                  >
                    <FileCode2 size={12} className="text-blue-600" /> XML
                  </a>
                )}
              </div>

              {doc.status === 'cancelada' && doc.cancel_reason && (
                <p className="text-[11px] text-rose-700">
                  <strong>Cancelada:</strong> {doc.cancel_reason}
                </p>
              )}
            </div>
          )}

          {/* Mensagem de erro em português */}
          {doc?.status === 'erro' && doc.error_message && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-rose-600" />
                <div>
                  <p className="font-bold">Falha ao emitir {ROTULO_MODELO_NOTA[doc.model]}</p>
                  <p className="mt-0.5 text-[11px]">{doc.error_message}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Botões de ação da nota */}
        {venda.status !== 'cancelada' && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            {(status === 'nao_emitida' || status === 'emitindo') && (
              <button
                type="button"
                disabled={emitindoGrupo !== null}
                onClick={() => void handleEmitir(grupo)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-blue-700 disabled:opacity-50"
              >
                {status === 'emitindo' ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <FileText size={13} />
                )}
                Emitir nota
              </button>
            )}

            {status === 'erro' && (
              <button
                type="button"
                disabled={emitindoGrupo !== null}
                onClick={() => void handleEmitir(grupo)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-rose-700 disabled:opacity-50"
              >
                <RefreshCw size={13} />
                Tentar de novo
              </button>
            )}

            {!ehProd && status !== 'emitida' && (
              <button
                type="button"
                onClick={() => setPrepararNfseAberto(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800 hover:bg-indigo-100"
              >
                <ExternalLink size={13} />
                Preparar NFS-e para o portal
              </button>
            )}

            {status === 'emitida' && doc && podeCancelarNota && (
              <button
                type="button"
                onClick={() => {
                  setNotaParaCancelar(doc);
                  setMotivoCancelamento('');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
              >
                <Ban size={13} />
                Cancelar nota
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3.5">
      {FONTE_DADOS_DEMO && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-950"
        >
          <FlaskConical size={15} className="shrink-0 text-amber-700" />
          <span>Emissão fiscal de demonstração: nenhuma nota é emitida de verdade.</span>
        </div>
      )}

      {erroFiscal && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
        >
          {erroFiscal}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {temProdutos &&
          renderCartaoNota('produtos', venda.products_subtotal_cents, docProdutos)}
        {temServicos &&
          renderCartaoNota('servicos', venda.services_subtotal_cents, docServicos)}
      </div>

      {/* Modal: Cancelar Nota Fiscal */}
      {notaParaCancelar && (
        <ModalDialogoVendas
          aberto
          onFechar={() => setNotaParaCancelar(null)}
          titulo={`Cancelar ${ROTULO_MODELO_NOTA[notaParaCancelar.model]} nº ${notaParaCancelar.number ?? ''}`}
          subtitulo="Informe a justificativa fiscal de cancelamento (mínimo 15 caracteres na SEFAZ)."
          larguraMax="max-w-md"
        >
          <form onSubmit={(e) => void handleConfirmarCancelarNota(e)} className="space-y-3.5">
            <div>
              <label htmlFor="canc-nf-motivo" className="block text-xs font-semibold text-slate-700">
                Motivo do cancelamento *
              </label>
              <textarea
                id="canc-nf-motivo"
                rows={3}
                required
                value={motivoCancelamento}
                onChange={(e) => setMotivoCancelamento(e.target.value)}
                placeholder="Ex.: Erro no preenchimento dos dados da nota fiscal..."
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNotaParaCancelar(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={cancelandoNota || !motivoCancelamento.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {cancelandoNota && <Loader2 size={13} className="animate-spin" />}
                Confirmar cancelamento
              </button>
            </div>
          </form>
        </ModalDialogoVendas>
      )}

      {/* Modal: Preparar NFS-e para o Portal Nacional (nfse.gov.br) */}
      {prepararNfseAberto && (
        <ModalDialogoVendas
          aberto
          onFechar={() => setPrepararNfseAberto(false)}
          titulo="Preparar NFS-e para o Portal Nacional"
          subtitulo="Copie os dados abaixo para colar no Emissor Nacional (nfse.gov.br) e depois registre o número emitido."
          larguraMax="max-w-lg"
        >
          <div className="space-y-3.5 text-xs">
            {[
              {
                chave: 'tomador',
                rotulo: 'Tomador (Cliente)',
                valor: venda.customer_name,
              },
              {
                chave: 'doc',
                rotulo: 'CPF / CNPJ do Tomador',
                valor: docTomador
                  ? formatarDocumento(docTomador, venda.customer_person_type)
                  : 'Não informado',
              },
              {
                chave: 'endereco',
                rotulo: 'Endereço do Tomador',
                valor: venda.address_text || 'Não informado',
              },
              {
                chave: 'descricao',
                rotulo: 'Discriminação dos Serviços',
                valor: descricaoPortalNfse,
              },
              {
                chave: 'valor',
                rotulo: 'Valor Total do Serviço',
                valor: formatarReais(venda.services_subtotal_cents, { comSimbolo: false }),
              },
            ].map((c) => (
              <div
                key={c.chave}
                className="rounded-xl border border-slate-200 bg-slate-50/80 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-600">{c.rotulo}</span>
                  <button
                    type="button"
                    onClick={() => copiarTexto(c.chave, c.valor)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50"
                  >
                    {campoCopiado === c.chave ? <Check size={11} /> : <Copy size={11} />}
                    {campoCopiado === c.chave ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <p className="mt-1 whitespace-pre-line font-medium text-slate-900">{c.valor}</p>
              </div>
            ))}

            <form
              onSubmit={(e) => void handleRegistrarNfseManual(e)}
              className="space-y-2.5 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3.5"
            >
              <label htmlFor="nfse-manual-num" className="block font-bold text-indigo-950">
                Número da nota emitida no portal *
              </label>
              <div className="flex gap-2">
                <input
                  id="nfse-manual-num"
                  type="text"
                  required
                  value={numeroNfseManual}
                  onChange={(e) => setNumeroNfseManual(e.target.value)}
                  placeholder="Ex.: 2026000195"
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={salvandoNfseManual || !numeroNfseManual.trim()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {salvandoNfseManual && <Loader2 size={13} className="animate-spin" />}
                  Registrar NFS-e
                </button>
              </div>
            </form>
          </div>
        </ModalDialogoVendas>
      )}
    </div>
  );
}

// ============================================================================
// Recibo A4 da Venda (montado em Portal no document.body)
// ============================================================================

interface ReciboVendaModalProps {
  venda: Sale;
  onFechar: () => void;
}

export function ReciboVendaModal({ venda, onFechar }: ReciboVendaModalProps) {
  const sit = situacaoVenda(venda);
  const docCli = venda.invoice_document ?? venda.customer_document;

  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-xs sm:p-6 print:static print:bg-white print:p-0">
      <style>{ESTILO_IMPRESSAO_ORCAMENTO_VENDA_A4}</style>

      <div className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg print:hidden">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900">
            Recibo da Venda · {venda.number}
          </h2>
          <p className="text-xs text-slate-500">Comprovante comercial para impressão em A4</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
          >
            <Printer size={15} />
            Imprimir recibo
          </button>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar recibo"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      <div className="vendas-cor-exata mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm sm:p-8 print:max-w-none print:rounded-none print:border-none print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#0B1E3F] pb-4">
          <div className="flex items-center gap-3">
            <img
              src={EMPRESA_BRV.logoUrl}
              alt="Logo BRV"
              className="vendas-cor-exata h-12 w-auto rounded-lg bg-[#0B1E3F] p-2 object-contain"
            />
            <div>
              <h2 className="text-base font-extrabold text-[#0B1E3F]">{EMPRESA_BRV.razaoSocial}</h2>
              <p className="text-[11px] text-slate-600">
                CNPJ {EMPRESA_BRV.cnpj} · Tel. {EMPRESA_BRV.telefone}
              </p>
              <p className="text-[11px] text-slate-600">{EMPRESA_BRV.endereco}</p>
            </div>
          </div>

          <div className="text-right">
            <div className="vendas-cor-exata inline-block rounded-lg bg-[#0B1E3F] px-3 py-1 font-mono text-sm font-extrabold text-white">
              RECIBO · {venda.number}
            </div>
            <p className="mt-1 text-[11px] text-slate-600">
              Data: {formatarDataHora(venda.created_at)}
            </p>
            <p className="text-[11px] font-bold text-slate-700">
              Situação: {CORES_SITUACAO_VENDA[sit].rotulo}
            </p>
          </div>
        </header>

        <section className="mt-4 rounded-xl border border-slate-300 p-3 text-xs">
          <div className="flex flex-wrap justify-between gap-2">
            <span>
              <strong>Cliente:</strong> {venda.customer_name}
            </span>
            {docCli && (
              <span>
                <strong>CPF/CNPJ na nota:</strong>{' '}
                {formatarDocumento(docCli, venda.customer_person_type)}
              </span>
            )}
          </div>
          {venda.seller_name && (
            <p className="mt-1 text-slate-600">
              <strong>Atendente / Vendedor(a):</strong> {venda.seller_name}
            </p>
          )}
        </section>

        <section className="mt-4">
          <table className="w-full border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 text-left text-[11px] font-bold text-slate-700">
                <th className="border border-slate-300 px-2.5 py-1.5">Tipo</th>
                <th className="border border-slate-300 px-2.5 py-1.5">Descrição</th>
                <th className="border border-slate-300 px-2.5 py-1.5 text-center">Qtd.</th>
                <th className="border border-slate-300 px-2.5 py-1.5 text-right">Unitário</th>
                <th className="border border-slate-300 px-2.5 py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {venda.items.map((item) => (
                <tr key={item.id}>
                  <td className="border border-slate-300 px-2.5 py-1.5 text-[11px]">
                    {item.kind === 'produto' ? 'Produto' : 'Serviço'}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 font-medium">
                    {item.name}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 text-center tabular-nums">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums">
                    {formatarReais(item.unit_price_cents)}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 text-right font-bold tabular-nums">
                    {formatarReais(item.total_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
          <div className="rounded-xl border border-slate-300 p-3">
            <h3 className="font-bold text-slate-800">Pagamentos registrados</h3>
            {venda.payments.length === 0 ? (
              <p className="mt-1 text-slate-500">Venda a receber (nenhum pagamento no ato).</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {venda.payments.map((pg) => (
                  <li key={pg.id} className="flex justify-between">
                    <span>
                      {ROTULO_FORMA_PAGAMENTO[pg.method]}
                      {pg.method === 'credito' && pg.installments > 1
                        ? ` (${pg.installments}x)`
                        : ''}
                    </span>
                    <strong>{formatarReais(pg.amount_cents)}</strong>
                  </li>
                ))}
                {venda.change_cents > 0 && (
                  <li className="flex justify-between border-t border-slate-200 pt-1 text-slate-600">
                    <span>Troco devolvido</span>
                    <strong>{formatarReais(venda.change_cents)}</strong>
                  </li>
                )}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-300 p-3 text-right">
            <div>
              Subtotal Produtos: <strong>{formatarReais(venda.products_subtotal_cents)}</strong>
            </div>
            <div>
              Subtotal Serviços: <strong>{formatarReais(venda.services_subtotal_cents)}</strong>
            </div>
            {venda.general_discount_cents > 0 && (
              <div className="text-rose-700">
                Desconto: <strong>- {formatarReais(venda.general_discount_cents)}</strong>
              </div>
            )}
            <div className="mt-1.5 border-t border-slate-200 pt-1.5 text-base font-extrabold text-[#0B1E3F]">
              Total: {formatarReais(venda.total_cents)}
            </div>
            <div className="text-[11px] text-emerald-700">
              Valor pago: <strong>{formatarReais(venda.paid_cents)}</strong>
            </div>
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}

