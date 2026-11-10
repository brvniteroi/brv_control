import { FlaskConical } from 'lucide-react';
import { FONTE_DADOS_DEMO } from './fonteDeDados';

/** Faixa discreta exibida no topo das telas de Placas enquanto `FONTE_DADOS_DEMO` for `true` (oculta na impressão). */
export default function FaixaDadosDemoPlacas() {
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
          — Simulação em memória para revisão antes da migração ao banco de dados.
        </span>
      </div>
    </div>
  );
}

