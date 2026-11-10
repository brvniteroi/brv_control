import { useEffect, useState } from 'react';
import { CheckCircle2, Info, Loader2, Printer, Tag } from 'lucide-react';
import type { BoardOrder, SituacaoImpressoraPlaca } from '../../types/placas';
import { formatarData } from '../../utils/ordens';
import { IndicadorElgin } from '../oficina/SituacaoElgin';
import { CORES_TIPO_CLIENTE_PLACA } from './cores';
import { pedirEtiquetaPlaca, situacaoImpressora } from './fonteDeDados';
import ModalDialogoPlacas from './ModalDialogoPlacas';

interface EtiquetaPlacaModalProps {
  placa: BoardOrder | null;
  onFechar: () => void;
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function montarHtmlEtiquetaPlaca(
  placa: BoardOrder,
  formato: '100x50' | '80x50',
  copias: number,
): string {
  const larguraMm = formato === '80x50' ? 80 : 100;
  const alturaUtilMm = 47.5;
  const cliente = escaparHtml(placa.customer_name.slice(0, 34));
  const tipoCli = escaparHtml(CORES_TIPO_CLIENTE_PLACA[placa.customer_kind].rotuloCurto);
  const equipamento = escaparHtml(`${placa.equipment_type} · ${placa.brand_model}`.slice(0, 42));
  const codPlaca = escaparHtml(placa.board_code.slice(0, 26));
  const defeito = escaparHtml((placa.reported_defect || 'Em análise técnica').slice(0, 52));
  const dataEnt = escaparHtml(formatarData(placa.created_at));
  const numero = escaparHtml(placa.board_number);
  const sufixoOs = placa.os_number ? ` · OS Control ${placa.os_number}` : '';
  const sufixoGarantia = placa.is_warranty ? ' · [GARANTIA]' : '';

  const folhas = Array.from({ length: copias })
    .map(
      (_, i) => `
    <div class="folha"${i < copias - 1 ? ' style="page-break-after: always; break-after: page;"' : ''}>
      <div class="topo">
        <h2>BRV NITERÓI - PLACAS</h2>
        <div class="os">${numero}</div>
      </div>
      <div class="corpo">
        <div><strong>Cliente:</strong> ${cliente} (${tipoCli})</div>
        <div><strong>Equip.:</strong> ${equipamento}</div>
        <div><strong>Cód. Placa:</strong> ${codPlaca}${placa.error_code ? ` | <strong>Erro:</strong> ${escaparHtml(placa.error_code)}` : ''}</div>
        <div><strong>Defeito:</strong> ${defeito}</div>
      </div>
      <div class="rodape">
        <span>Entrada: ${dataEnt}${sufixoOs}${sufixoGarantia}</span>
        <span>BRV PLACAS</span>
      </div>
    </div>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Etiqueta ${numero}</title>
  <style>
    @page { size: ${larguraMm}mm 50mm; margin: 0mm !important; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, Segoe UI, Arial, sans-serif; color: #000; }
    html, body { background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .folha {
      width: ${larguraMm}mm;
      height: ${alturaUtilMm}mm;
      padding: 2.2mm 4mm 1.8mm 4.5mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }
    .topo { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 1.2mm; }
    .topo h2 { font-size: 11pt; font-weight: 900; letter-spacing: 0.2px; }
    .topo .os { font-size: 11.5pt; font-weight: 900; background: #000 !important; color: #fff !important; padding: 1.5px 6px; border-radius: 3px; font-family: monospace; }
    .corpo { flex: 1; display: flex; flex-direction: column; justify-content: space-evenly; font-size: 9.5pt; line-height: 1.25; }
    .corpo div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rodape { display: flex; justify-content: space-between; border-top: 1.5px solid #000; padding-top: 1mm; font-size: 8pt; font-weight: 600; }
  </style>
</head>
<body>
  ${folhas}
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.focus(); window.print(); }, 200);
    });
  </script>
</body>
</html>`;
}

export default function EtiquetaPlacaModal({ placa, onFechar }: EtiquetaPlacaModalProps) {
  const [copias, setCopias] = useState(1);
  const [formato, setFormato] = useState<'100x50' | '80x50'>('100x50');
  const [impressora, setImpressora] = useState<SituacaoImpressoraPlaca | null>(null);
  const [enviandoElgin, setEnviandoElgin] = useState(false);
  const [retornoElgin, setRetornoElgin] = useState<string | null>(null);
  const [erroElgin, setErroElgin] = useState<string | null>(null);

  useEffect(() => {
    if (!placa) return;
    let ativo = true;
    situacaoImpressora()
      .then((s) => {
        if (ativo) setImpressora(s);
      })
      .catch(() => {
        if (ativo) setImpressora({ online: false, printer_name: 'Elgin', last_seen_at: null });
      });
    return () => {
      ativo = false;
    };
  }, [placa]);

  if (!placa) return null;

  const handleImprimirElgin = async () => {
    setEnviandoElgin(true);
    setRetornoElgin(null);
    setErroElgin(null);
    try {
      const resp = await pedirEtiquetaPlaca(placa.id, copias);
      setRetornoElgin(resp.mensagem);
    } catch (e) {
      setErroElgin(e instanceof Error ? e.message : 'Não foi possível enviar para a Elgin.');
    } finally {
      setEnviandoElgin(false);
    }
  };

  // Contingência síncrona no clique (evita bloqueio de pop-up no celular)
  const handleImprimirNavegador = () => {
    const html = montarHtmlEtiquetaPlaca(placa, formato, copias);
    const janela = window.open('', '_blank');
    if (!janela) {
      setErroElgin('Permita janelas pop-up neste navegador para imprimir a etiqueta.');
      return;
    }
    janela.document.open();
    janela.document.write(html);
    janela.document.close();
  };

  return (
    <ModalDialogoPlacas
      aberto={Boolean(placa)}
      onFechar={onFechar}
      titulo={`Etiqueta da Placa · ${placa.board_number}`}
      subtitulo="Pré-visualização térmica 100×50 mm para identificação física na bancada."
      larguraMax="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Tag size={15} className="text-brv-navy" aria-hidden="true" />
            <span>Impressora do laboratório:</span>
          </div>
          <IndicadorElgin
            online={impressora ? impressora.online : null}
            agente={
              impressora?.last_seen_at
                ? {
                    id: 'elgin-demo',
                    printer: impressora.printer_name,
                    version: null,
                    info: null,
                    last_seen_at: impressora.last_seen_at,
                  }
                : null
            }
            compacto
          />
        </div>

        {/* Pré-visualização proporcional da etiqueta */}
        <div className="flex justify-center rounded-2xl border border-slate-200 bg-slate-100 p-4 sm:p-6">
          <div
            className={`flex flex-col justify-between rounded-lg border-2 border-dashed border-slate-400 bg-white p-3.5 text-black shadow-md ${
              formato === '80x50' ? 'w-full max-w-[340px]' : 'w-full max-w-[420px]'
            }`}
            style={{ minHeight: '205px' }}
          >
            <div className="flex items-center justify-between gap-2 border-b-2 border-black pb-1.5">
              <span className="text-xs font-black tracking-wide">BRV NITERÓI - PLACAS</span>
              <span className="rounded bg-black px-2 py-0.5 font-mono text-xs font-black text-white">
                {placa.board_number}
              </span>
            </div>

            <div className="my-2 space-y-1 text-xs leading-snug">
              <div className="truncate">
                <strong>Cliente:</strong> {placa.customer_name}{' '}
                <span className="text-[11px] text-slate-600">
                  ({CORES_TIPO_CLIENTE_PLACA[placa.customer_kind].rotuloCurto})
                </span>
              </div>
              <div className="truncate">
                <strong>Equipamento:</strong> {placa.equipment_type} · {placa.brand_model}
              </div>
              <div className="truncate">
                <strong>Código da placa:</strong>{' '}
                <span className="font-mono font-bold">{placa.board_code}</span>
                {placa.error_code ? ` · Erro ${placa.error_code}` : ''}
              </div>
              <div className="truncate">
                <strong>Defeito:</strong> {placa.reported_defect}
              </div>
            </div>

            <div className="flex items-center justify-between border-t-2 border-black pt-1 text-[10px] font-semibold text-slate-800">
              <span>
                Entrada: {formatarData(placa.created_at)}
                {placa.os_number ? ` · OS ${placa.os_number}` : ''}
                {placa.is_warranty ? ' · [GARANTIA]' : ''}
              </span>
              <span>BRV PLACAS</span>
            </div>
          </div>
        </div>

        {/* Opções de cópias e formato */}
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:grid-cols-2">
          <div>
            <span className="block text-xs font-semibold text-slate-700">Quantidade de cópias</span>
            <div className="mt-1.5 flex items-center gap-1.5" role="group" aria-label="Quantidade de cópias">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCopias(n)}
                  aria-pressed={copias === n}
                  className={`h-9 w-9 rounded-lg border text-xs font-bold transition ${
                    copias === n
                      ? 'border-brv-navy bg-brv-navy text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700">Largura da etiqueta</span>
            <div className="mt-1.5 flex items-center gap-2" role="group" aria-label="Largura da etiqueta">
              <button
                type="button"
                onClick={() => setFormato('100x50')}
                aria-pressed={formato === '100x50'}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  formato === '100x50'
                    ? 'border-brv-navy bg-brv-navy text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                100×50 mm
              </button>
              <button
                type="button"
                onClick={() => setFormato('80x50')}
                aria-pressed={formato === '80x50'}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  formato === '80x50'
                    ? 'border-brv-navy bg-brv-navy text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                80×50 mm
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
          <Info size={15} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
          <span>
            Ao usar <strong>Imprimir pelo navegador</strong>, escolha{' '}
            <strong>Margens: Nenhuma</strong> na janela do Chrome para não deslocar a etiqueta na fita térmica.
          </span>
        </div>

        {retornoElgin && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-900"
          >
            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>{retornoElgin}</span>
          </div>
        )}

        {erroElgin && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800"
          >
            {erroElgin}
          </div>
        )}

        <div className="flex flex-col-reverse justify-end gap-2 border-t border-slate-200 pt-3 sm:flex-row">
          <button
            type="button"
            onClick={handleImprimirNavegador}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            <Printer size={15} aria-hidden="true" />
            Imprimir pelo navegador
          </button>

          <button
            type="button"
            onClick={() => void handleImprimirElgin()}
            disabled={enviandoElgin}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {enviandoElgin ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <Printer size={15} aria-hidden="true" />
            )}
            Imprimir na Elgin
          </button>
        </div>
      </div>
    </ModalDialogoPlacas>
  );
}
