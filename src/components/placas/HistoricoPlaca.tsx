import { useId, useState, type FormEvent } from 'react';
import { ArrowRight, Loader2, MessageSquarePlus } from 'lucide-react';
import type { ProfileRole } from '../../types/fsm';
import type { BoardEvent } from '../../types/placas';
import { formatarDataHora } from '../../utils/ordens';
import { ROTULO_CAMPO_PLACA } from './cores';
import { anotarNoHistorico } from './fonteDeDados';
import { ROTULO_ETAPA_PLACA, ehEscritorioOuAdminPlaca } from './regrasPlacas';

interface HistoricoPlacaProps {
  placaId: string;
  eventos: BoardEvent[];
  papel: ProfileRole | undefined;
  podeVerFinanceiro: boolean;
  atorNome: string;
  onNovoEvento: (evento: BoardEvent) => void;
}

export default function HistoricoPlaca({
  placaId,
  eventos,
  papel,
  podeVerFinanceiro,
  atorNome,
  onNovoEvento,
}: HistoricoPlacaProps) {
  const [nota, setNota] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const campoNotaId = useId();

  const ehEscritorio = ehEscritorioOuAdminPlaca(papel);

  // Filtra eventos que o usuário não deve enxergar (orçamento só escritório/admin; reembolso/cobrado só com a marca do financeiro)
  const visiveis = eventos.filter((ev) => {
    if (ev.visibility === 'financeiro') return podeVerFinanceiro;
    if (ev.visibility === 'escritorio') return ehEscritorio;
    return true;
  });

  const handleAnotar = async (e: FormEvent) => {
    e.preventDefault();
    if (!nota.trim()) {
      setErro('Digite uma observação antes de registrar no histórico.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const criado = await anotarNoHistorico(placaId, nota, atorNome);
      setNota('');
      onNovoEvento(criado);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar a anotação.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => void handleAnotar(e)} className="space-y-2">
        <label htmlFor={campoNotaId} className="block text-xs font-semibold text-slate-700">
          Anotar no histórico
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={campoNotaId}
            type="text"
            value={nota}
            onChange={(e) => {
              setNota(e.target.value);
              if (erro) setErro(null);
            }}
            placeholder="Ex.: Parceiro avisado por ligação; aguardando portador amanhã cedo..."
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={salvando}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-900 disabled:opacity-50"
          >
            {salvando ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <MessageSquarePlus size={14} aria-hidden="true" />
            )}
            Anotar no histórico
          </button>
        </div>
        {erro && (
          <p role="alert" className="text-xs font-medium text-rose-700">
            {erro}
          </p>
        )}
      </form>

      {visiveis.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-500">
          Nenhum evento registrado nesta placa até o momento.
        </p>
      ) : (
        <ol className="relative ml-2 space-y-3 border-l-2 border-slate-200 pl-4">
          {visiveis.map((ev) => {
            const rotuloCampo = ev.field_name
              ? (ROTULO_CAMPO_PLACA[ev.field_name] ?? ev.field_name)
              : null;

            return (
              <li key={ev.id} className="relative text-xs">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brv-navy" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-800">{ev.actor_name}</span>
                  <span className="text-[11px] text-slate-400">{formatarDataHora(ev.created_at)}</span>
                </div>

                {ev.event_type === 'mudanca_etapa' && ev.from_stage && ev.to_stage && (
                  <p className="mt-1 inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    <span>{ROTULO_ETAPA_PLACA[ev.from_stage]}</span>
                    <ArrowRight size={12} aria-hidden="true" />
                    <span className="text-brv-navy">{ROTULO_ETAPA_PLACA[ev.to_stage]}</span>
                  </p>
                )}

                {ev.event_type === 'edicao_campo' && rotuloCampo && (
                  <p className="mt-1 text-slate-700">
                    Alterou <strong>{rotuloCampo}</strong>: de{' '}
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                      {ev.old_value || '—'}
                    </span>{' '}
                    para{' '}
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-900">
                      {ev.new_value || '—'}
                    </span>
                  </p>
                )}

                {(ev.event_type === 'orcamento' ||
                  ev.event_type === 'resposta_orcamento' ||
                  ev.event_type === 'reembolso') &&
                  ev.new_value && (
                    <p className="mt-1 font-semibold text-slate-800">
                      {rotuloCampo ? `${rotuloCampo}: ` : ''}
                      {ev.old_value ? `${ev.old_value} → ` : ''}
                      {ev.new_value}
                    </p>
                  )}

                {ev.note && <p className="mt-1 leading-relaxed text-slate-600">{ev.note}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

