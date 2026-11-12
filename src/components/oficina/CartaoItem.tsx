import { ArrowRightLeft, Clock, ShieldCheck, User, Wrench } from 'lucide-react';
import type { ItemOficinaTela } from '../../types/oficina';
import {
  ROTULO_PECAS,
  descricaoItem,
  diasNaOficina,
  numeroItem,
  valorEmReais,
} from '../../utils/oficina';
import { CORES_PECAS } from './cores';

interface CartaoItemProps {
  item: ItemOficinaTela;
  totalNaOs?: number;
  arrastando?: boolean;
  /** No Kanban desktop o próprio contêiner do Draggable recebe foco e clique (evita bloquear o arraste). */
  interativoComoBloco?: boolean;
  onAbrir: (id: string) => void;
  /** No celular, exibe o botão "Mover para..." direto no cartão (sem precisar arrastar). */
  onAbrirMoverCelular?: (item: ItemOficinaTela) => void;
}

export default function CartaoItem({
  item,
  totalNaOs,
  arrastando = false,
  interativoComoBloco = false,
  onAbrir,
  onAbrirMoverCelular,
}: CartaoItemProps) {
  const dias = diasNaOficina(item);
  const atrasado = dias >= 15;
  const textoDias = dias === 0 ? 'Hoje' : dias === 1 ? '1 dia' : `${dias} dias`;
  const mostrarPeca = item.parts_status !== 'nao_necessario';
  const mostrarValorOrcamento =
    item.status === 'aguardando_cliente' && item.quote_amount != null && item.quote_amount !== '';

  // Balcão = sem técnico de retirada (o cliente trouxe à loja); fundo azul claro para diferenciar das retiradas de campo
  const ehBalcao = !item.pickup_employee_id;

  const miolo = (
    <>
      {/* Linha 1: Número grande + Dias na loja */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-extrabold tracking-tight text-brv-navy">
          {numeroItem(item, totalNaOs)}
        </span>
        <span
          title="Dias desde a entrada na loja"
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            atrasado
              ? 'border border-red-200 bg-red-50 text-red-700'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          <Clock size={11} />
          {textoDias}
        </span>
      </div>

      {/* Cliente */}
      <p className="mt-1.5 truncate text-xs font-semibold text-slate-800">
        {item.customer_name || 'Cliente não informado'}
      </p>

      {/* Equipamento + unidade recolhida */}
      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{descricaoItem(item)}</p>

      {/* Selos: Garantia, Peça, Recusado, Valor do orçamento */}
      {(item.is_warranty || mostrarPeca || item.decision === 'recusado' || mostrarValorOrcamento) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {item.is_warranty && (
            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
              <ShieldCheck size={11} />
              Garantia
            </span>
          )}

          {mostrarPeca && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CORES_PECAS[item.parts_status]}`}
            >
              <Wrench size={10} />
              {ROTULO_PECAS[item.parts_status]}
            </span>
          )}

          {item.decision === 'recusado' && (
            <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
              Recusado
            </span>
          )}

          {mostrarValorOrcamento && (
            <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900">
              {valorEmReais(item.quote_amount)}
            </span>
          )}
        </div>
      )}

      {/* Técnico de bancada */}
      {item.bench_employee_name && (
        <div className="mt-2.5 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
          <User size={12} className="shrink-0 text-slate-400" />
          <span className="truncate">{item.bench_employee_name}</span>
        </div>
      )}
    </>
  );

  return (
    <div
      onClick={interativoComoBloco ? () => onAbrir(item.id) : undefined}
      title={
        ehBalcao
          ? 'Entrada de balcão (cliente trouxe à loja)'
          : item.pickup_employee_name
            ? `Recolhido por ${item.pickup_employee_name}`
            : undefined
      }
      className={`group rounded-xl border p-3.5 shadow-2xs transition ${
        ehBalcao ? 'bg-sky-100' : 'bg-white'
      } ${interativoComoBloco ? 'cursor-grab active:cursor-grabbing' : ''} ${
        arrastando
          ? 'rotate-1 border-blue-400 shadow-lg ring-2 ring-blue-500/20'
          : ehBalcao
            ? 'border-sky-300 hover:border-blue-400 hover:shadow-xs'
            : 'border-slate-200 hover:border-blue-300 hover:shadow-xs'
      }`}
    >
      {interativoComoBloco ? (
        miolo
      ) : (
        <button
          type="button"
          onClick={() => onAbrir(item.id)}
          className="block w-full text-left focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
        >
          {miolo}
        </button>
      )}

      {onAbrirMoverCelular && (
        <div className="mt-2.5 border-t border-slate-100 pt-2">
          <button
            type="button"
            onClick={() => onAbrirMoverCelular(item)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 active:bg-slate-200"
          >
            <ArrowRightLeft size={13} />
            Mover para...
          </button>
        </div>
      )}
    </div>
  );
}
