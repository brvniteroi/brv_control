import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Clock,
  Cpu,
  RotateCcw,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import type { ProfileRole } from '../../types/fsm';
import type { BoardOrder, BoardStage } from '../../types/placas';
import { valorEmReais } from '../../utils/oficina';
import { CORES_ORCAMENTO_PLACA, CORES_TIPO_CLIENTE_PLACA } from './cores';
import {
  DIAS_PLACA_ENCALHADA,
  ROTULO_ETAPA_CURTO_PLACA,
  ehEscritorioOuAdminPlaca,
  etapasAdjacentesKanban,
  motivoBloqueioPlaca,
} from './regrasPlacas';

interface CartaoPlacaProps {
  placa: BoardOrder;
  papel: ProfileRole | undefined;
  podeVerFinanceiro: boolean;
  onAbrir: (id: string) => void;
  onMoverRapido: (placa: BoardOrder, destino: BoardStage) => void;
  onAvisoBloqueio: (mensagem: string) => void;
  /** Em telas pequenas exibe um botão para escolher diretamente a etapa de destino. */
  onAbrirSeletorCelular?: (placa: BoardOrder) => void;
}

export default function CartaoPlaca({
  placa,
  papel,
  podeVerFinanceiro,
  onAbrir,
  onMoverRapido,
  onAvisoBloqueio,
  onAbrirSeletorCelular,
}: CartaoPlacaProps) {
  const mostrarOrcamento = ehEscritorioOuAdminPlaca(papel);
  const { anterior, proxima } = etapasAdjacentesKanban(placa.status);
  const diasCritico = placa.days_since_entry >= DIAS_PLACA_ENCALHADA;
  const infoCliente = CORES_TIPO_CLIENTE_PLACA[placa.customer_kind];
  const infoOrcamento = CORES_ORCAMENTO_PLACA[placa.quote_status];

  const acionarPasso = (destino: BoardStage) => {
    const bloqueio = motivoBloqueioPlaca(placa, destino, papel);
    if (bloqueio) {
      onAvisoBloqueio(bloqueio);
      return;
    }
    onMoverRapido(placa, destino);
  };

  return (
    <article className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs transition hover:border-blue-300 hover:shadow-sm">
      <div
        onClick={() => onAbrir(placa.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onAbrir(placa.id);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Abrir detalhes da placa ${placa.board_number} de ${placa.customer_name}`}
        className="cursor-pointer text-left focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        {/* Linha 1: Número grande + Dias desde a entrada */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="font-mono text-sm font-extrabold tracking-tight text-brv-navy">
              {placa.board_number}
            </span>
            {placa.os_number && (
              <span className="ml-1.5 inline-block rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                OS {placa.os_number}
              </span>
            )}
          </div>

          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums ${
              diasCritico
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}
            title="Dias corridos desde a entrada da placa"
          >
            <Clock size={11} aria-hidden="true" />
            {placa.days_since_entry}d
          </span>
        </div>

        {/* Linha 2: Cliente + selo Parceiro/Final */}
        <div className="mt-2 flex items-center justify-between gap-1.5">
          <p className="truncate text-xs font-bold text-slate-900">{placa.customer_name}</p>
          <span
            className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${infoCliente.selo}`}
          >
            {infoCliente.rotuloCurto}
          </span>
        </div>

        {/* Linha 3: Equipamento + Código da placa */}
        <p className="mt-1.5 line-clamp-1 text-xs text-slate-700">{placa.brand_model}</p>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
          <Cpu size={12} className="shrink-0 text-slate-400" aria-hidden="true" />
          <span className="truncate font-mono font-semibold text-slate-700">
            {placa.board_code}
          </span>
          {placa.error_code && (
            <span className="shrink-0 rounded bg-rose-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-700">
              {placa.error_code}
            </span>
          )}
        </div>

        {/* Linha 4: Técnico de bancada */}
        {placa.bench_technician_name && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
            <Wrench size={11} className="shrink-0 text-slate-400" aria-hidden="true" />
            <span className="truncate">{placa.bench_technician_name}</span>
          </div>
        )}

        {/* Linha 5: Selos de estado (Garantia / Reembolsada / Encalhada / Orçamento) */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {placa.is_warranty && (
            <span className="inline-flex items-center gap-1 rounded-md border border-purple-300 bg-purple-50 px-2 py-0.5 text-[10px] font-extrabold text-purple-800">
              <ShieldCheck size={11} aria-hidden="true" />
              Garantia
            </span>
          )}

          {placa.stalled && (
            <span className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-extrabold text-rose-800">
              <AlertTriangle size={11} aria-hidden="true" />
              Encalhada
            </span>
          )}

          {podeVerFinanceiro && placa.refunded && (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-900">
              <RotateCcw size={11} aria-hidden="true" />
              Reembolsada
            </span>
          )}

          {mostrarOrcamento && !placa.is_warranty && (
            <span
              className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold ${infoOrcamento.selo}`}
            >
              {infoOrcamento.rotulo}
            </span>
          )}
        </div>

        {/* Linha 6: Valor do orçamento — EXCLUSIVO para escritório/admin */}
        {mostrarOrcamento && placa.quote_amount != null && placa.quote_amount > 0 && (
          <div className="mt-2 border-t border-slate-100 pt-1.5 text-right text-xs font-extrabold text-slate-900">
            {valorEmReais(placa.quote_amount)}
          </div>
        )}
      </div>

      {/* Rodapé de movimentação rápida ← → */}
      <div className="mt-2.5 flex items-center justify-between gap-1.5 border-t border-slate-100 pt-2">
        <button
          type="button"
          disabled={!anterior}
          onClick={() => anterior && acionarPasso(anterior)}
          aria-label={
            anterior
              ? `Voltar placa ${placa.board_number} para ${ROTULO_ETAPA_CURTO_PLACA[anterior]}`
              : 'Primeira etapa'
          }
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100 disabled:invisible"
        >
          <ArrowLeft size={12} aria-hidden="true" />
          <span className="hidden xl:inline">
            {anterior ? ROTULO_ETAPA_CURTO_PLACA[anterior] : ''}
          </span>
        </button>

        {onAbrirSeletorCelular && (
          <button
            type="button"
            onClick={() => onAbrirSeletorCelular(placa)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 md:hidden"
          >
            Mover etapa
          </button>
        )}

        <button
          type="button"
          disabled={!proxima}
          onClick={() => proxima && acionarPasso(proxima)}
          aria-label={
            proxima
              ? `Avançar placa ${placa.board_number} para ${ROTULO_ETAPA_CURTO_PLACA[proxima]}`
              : 'Última coluna do Kanban'
          }
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 disabled:invisible"
        >
          <span className="hidden xl:inline">
            {proxima ? ROTULO_ETAPA_CURTO_PLACA[proxima] : ''}
          </span>
          <ArrowRight size={12} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

