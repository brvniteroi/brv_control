import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { somarMeses } from '../../hooks/useCalendario';

/** Relatórios são só para admin e escritório. */
export function SoEscritorio({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  if (profile?.role === 'admin' || profile?.role === 'escritorio') return <>{children}</>;
  return (
    <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
        <Lock size={24} />
      </div>
      <h2 className="mt-3 text-base font-bold text-slate-800">Acesso Restrito</h2>
      <p className="mt-1 max-w-sm text-xs text-slate-500">Os relatórios são restritos aos perfis de escritório e administradores.</p>
    </div>
  );
}

export function SeletorMes({ mes, onMudar }: { mes: string; onMudar: (mes: string) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
      <button type="button" onClick={() => onMudar(somarMeses(mes, -1))} aria-label="Mês anterior" className="px-2.5 py-2 text-slate-600 hover:bg-slate-50">
        <ChevronLeft size={16} />
      </button>
      <input
        type="month"
        value={mes}
        onChange={(e) => e.target.value && onMudar(e.target.value)}
        aria-label="Mês"
        className="border-x border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"
      />
      <button type="button" onClick={() => onMudar(somarMeses(mes, 1))} aria-label="Próximo mês" className="px-2.5 py-2 text-slate-600 hover:bg-slate-50">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

export function CartaoNumero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <p className="text-xs font-medium text-slate-500">{rotulo}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{valor}</p>
      {detalhe && <p className="mt-0.5 text-[11px] text-slate-500">{detalhe}</p>}
    </div>
  );
}
