import { useState } from 'react';
import { AlertTriangle, Loader2, WifiOff, X } from 'lucide-react';

export interface DadosConclusao {
  relato: string;
  acompanhadoPor?: string;
}

interface ConcluirAtividadeModalProps {
  relatoInicial: string;
  ehPmoc?: boolean;
  online?: boolean;
  bloqueioPmoc?: string | null;
  acompanhadoPorInicial?: string;
  onConfirmar: (dados: DadosConclusao) => Promise<void>;
  onFechar: () => void;
}

/** Relato do técnico antes de concluir (e nome de quem acompanhou a visita nas atividades de PMOC). */
export default function ConcluirAtividadeModal({
  relatoInicial,
  ehPmoc = false,
  online = true,
  bloqueioPmoc = null,
  acompanhadoPorInicial = '',
  onConfirmar,
  onFechar,
}: ConcluirAtividadeModalProps) {
  const [relato, setRelato] = useState(relatoInicial);
  const [acompanhadoPor, setAcompanhadoPor] = useState(acompanhadoPorInicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const semInternetPmoc = ehPmoc && !online;
  const bloqueadoPorChecklist = ehPmoc && Boolean(bloqueioPmoc);

  const confirmar = async () => {
    if (semInternetPmoc || bloqueadoPorChecklist) return;
    if (ehPmoc && !acompanhadoPor.trim()) {
      setErro('Informe o nome de quem acompanhou a visita.');
      return;
    }
    if (!relato.trim()) {
      setErro('Descreva o que foi feito.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await onConfirmar({
        relato: relato.trim(),
        ...(ehPmoc ? { acompanhadoPor: acompanhadoPor.trim() } : {}),
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir.');
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Concluir atividade</h3>
          <button type="button" onClick={onFechar} className="p-1 text-slate-400" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        {semInternetPmoc && (
          <div
            role="alert"
            className="mt-4 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-950"
          >
            <WifiOff size={16} className="shrink-0 text-amber-700" aria-hidden="true" />
            <span>O checklist do PMOC precisa de internet</span>
          </div>
        )}

        {bloqueioPmoc && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-900"
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-600" aria-hidden="true" />
            <span>{bloqueioPmoc}</span>
          </div>
        )}

        {ehPmoc && (
          <div className="mt-4">
            <label htmlFor="acompanhado-por" className="block text-xs font-semibold text-slate-700">
              Nome de quem acompanhou a visita *
            </label>
            <input
              id="acompanhado-por"
              type="text"
              value={acompanhadoPor}
              onChange={(e) => setAcompanhadoPor(e.target.value)}
              placeholder="Nome completo do responsável no local..."
              className="mt-1.5 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        )}

        <label htmlFor="relato" className="mt-4 block text-xs font-semibold text-slate-700">O que foi feito *</label>
        <textarea
          id="relato"
          rows={5}
          value={relato}
          onChange={(e) => setRelato(e.target.value)}
          placeholder="Serviço realizado, peças trocadas, observações para o escritório..."
          className="mt-1.5 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
        />

        {erro && <p className="mt-3 text-xs text-red-600">{erro}</p>}

        <button
          type="button"
          onClick={confirmar}
          disabled={salvando || semInternetPmoc || bloqueadoPorChecklist}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 text-sm font-bold text-white active:bg-green-700 disabled:opacity-60"
        >
          {salvando && <Loader2 size={18} className="animate-spin" />}
          {salvando ? 'Registrando...' : 'Concluir atividade'}
        </button>
      </div>
    </div>
  );
}
