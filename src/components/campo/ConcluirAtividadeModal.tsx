import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import CampoAssinatura from '../formularios/CampoAssinatura';

export interface DadosConclusao {
  relato: string;
  assinatura: Blob | null;
  assinadoPor: string;
}

interface ConcluirAtividadeModalProps {
  relatoInicial: string;
  onConfirmar: (dados: DadosConclusao) => Promise<void>;
  onFechar: () => void;
}

/** Relato do técnico + assinatura do cliente (opcional) antes de concluir. */
export default function ConcluirAtividadeModal({ relatoInicial, onConfirmar, onFechar }: ConcluirAtividadeModalProps) {
  const [relato, setRelato] = useState(relatoInicial);
  const [assinatura, setAssinatura] = useState<Blob | null>(null);
  const [assinadoPor, setAssinadoPor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const confirmar = async () => {
    if (!relato.trim()) {
      setErro('Descreva o que foi feito.');
      return;
    }
    if (assinatura && !assinadoPor.trim()) {
      setErro('Informe o nome de quem assinou.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await onConfirmar({ relato: relato.trim(), assinatura, assinadoPor: assinadoPor.trim() });
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

        <label htmlFor="relato" className="mt-4 block text-xs font-semibold text-slate-700">O que foi feito *</label>
        <textarea
          id="relato"
          rows={5}
          value={relato}
          onChange={(e) => setRelato(e.target.value)}
          placeholder="Serviço realizado, peças trocadas, observações para o escritório..."
          className="mt-1.5 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
        />

        <div className="mt-4">
          <span className="block text-xs font-semibold text-slate-700">Assinatura do cliente (opcional)</span>
          <div className="mt-1.5">
            <CampoAssinatura onAssinaturaAlterada={setAssinatura} />
          </div>
          {assinatura && (
            <input
              type="text"
              value={assinadoPor}
              onChange={(e) => setAssinadoPor(e.target.value)}
              placeholder="Nome de quem assinou"
              className="mt-2 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          )}
        </div>

        {erro && <p className="mt-3 text-xs text-red-600">{erro}</p>}

        <button
          type="button"
          onClick={confirmar}
          disabled={salvando}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 text-sm font-bold text-white active:bg-green-700 disabled:opacity-60"
        >
          {salvando && <Loader2 size={18} className="animate-spin" />}
          {salvando ? 'Registrando...' : 'Concluir atividade'}
        </button>
      </div>
    </div>
  );
}
