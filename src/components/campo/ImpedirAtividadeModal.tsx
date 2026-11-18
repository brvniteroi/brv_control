import { useState } from 'react';
import { Loader2, X } from 'lucide-react';

interface ImpedirAtividadeModalProps {
  onConfirmar: (motivo: string) => Promise<void>;
  onFechar: () => void;
}

const SUGESTOES = ['Cliente ausente', 'Ninguém atendeu / portão fechado', 'Acesso negado', 'Cliente pediu para remarcar'];

/** O técnico foi ao local, mas não conseguiu atender: registra o motivo e a visita fica na linha do tempo como "Impedida". */
export default function ImpedirAtividadeModal({ onConfirmar, onFechar }: ImpedirAtividadeModalProps) {
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const confirmar = async () => {
    if (!motivo.trim()) {
      setErro('Informe o motivo.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await onConfirmar(motivo.trim());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível registrar.');
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Não consegui atender</h3>
          <button type="button" onClick={onFechar} className="p-1 text-slate-400" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          A visita fica registrada como impedida e o escritório reagenda. Depois de registrar, você segue para a próxima atividade.
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGESTOES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setMotivo(s)}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 active:bg-slate-50"
            >
              {s}
            </button>
          ))}
        </div>

        <label htmlFor="motivo-impedimento" className="mt-4 block text-xs font-semibold text-slate-700">Motivo *</label>
        <textarea
          id="motivo-impedimento"
          rows={4}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="O que aconteceu no local..."
          className="mt-1.5 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
        />

        {erro && <p className="mt-3 text-xs text-red-600">{erro}</p>}

        <button
          type="button"
          onClick={confirmar}
          disabled={salvando}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-3.5 text-sm font-bold text-white active:bg-rose-700 disabled:opacity-60"
        >
          {salvando && <Loader2 size={18} className="animate-spin" />}
          {salvando ? 'Registrando...' : 'Registrar impedimento'}
        </button>
      </div>
    </div>
  );
}
