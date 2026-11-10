import { FlaskConical } from 'lucide-react';
import { FONTE_DADOS_DEMO, USAR_BANCO_PLACAS } from './fonteDeDados';

/**
 * Faixa discreta de "Dados de demonstração" (oculta na impressão); só aparece se `USAR_BANCO_PLACAS` for desligado.
 */
export default function FaixaDadosDemoPlacas() {
  if (!FONTE_DADOS_DEMO) return null;
  if (USAR_BANCO_PLACAS) return null; // tudo ligado ao banco e à IA real (P7b)

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2 text-xs text-amber-900 print:hidden"
    >
      <div className="flex items-center gap-2">
        <FlaskConical size={14} className="shrink-0 text-amber-700" aria-hidden="true" />
        <span className="font-semibold">Em preparação</span>
        <span className="hidden text-amber-800/90 sm:inline">
          — A IA desta tela ainda não foi ligada; a consulta ainda não responde.
        </span>
      </div>
    </div>
  );
}
