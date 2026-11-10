import { Sparkles } from 'lucide-react';
import NavegacaoPlacas from '../components/placas/NavegacaoPlacas';
import PainelAssistenteTecnico from '../components/placas/PainelAssistenteTecnico';

export default function PlacasAssistente() {
  return (
    <div className="space-y-5">
      <NavegacaoPlacas />

      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brv-navy text-white">
          <Sparkles size={18} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
            Assistente técnico de bancada
          </h1>
          <p className="text-xs text-slate-500">
            Hipóteses por probabilidade, escalas de multímetro e componentes prioritários para aferição.
          </p>
        </div>
      </div>

      <PainelAssistenteTecnico />
    </div>
  );
}

