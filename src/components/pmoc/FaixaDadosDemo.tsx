import { FlaskConical } from 'lucide-react';
import { FONTE_DADOS_DEMO } from './fonteDeDados';

/** Faixa discreta exibida no topo das telas do PMOC apenas enquanto `FONTE_DADOS_DEMO` estiver ativa. */
export default function FaixaDadosDemo() {
  if (!FONTE_DADOS_DEMO) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2 text-xs text-amber-900 print:hidden"
    >
      <div className="flex items-center gap-2">
        <FlaskConical size={14} className="shrink-0 text-amber-700" aria-hidden="true" />
        <span className="font-semibold">Dados de demonstração</span>
        <span className="hidden text-amber-800/90 sm:inline">
          — Alterações feitas aqui ficam em memória nesta sessão até a ligação com o banco de dados.
        </span>
      </div>
    </div>
  );
}

