import { FlaskConical } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { FONTE_DADOS_DEMO, USAR_BANCO_PLACAS } from './fonteDeDados';

/** Telas do apoio técnico que dependem da IA (fase P7b): fichas e manuais já usam o banco real. */
const ROTAS_APOIO = ['/placas/erros', '/placas/assistente'];

/**
 * Faixa discreta de "Dados de demonstração" (oculta na impressão). Com as placas ligadas ao banco
 * (`USAR_BANCO_PLACAS`), só aparece nas telas de códigos de erro e do assistente, que esperam a IA.
 */
export default function FaixaDadosDemoPlacas() {
  const { pathname } = useLocation();
  if (!FONTE_DADOS_DEMO) return null;
  if (USAR_BANCO_PLACAS && !ROTAS_APOIO.some((r) => pathname.startsWith(r))) return null;

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
