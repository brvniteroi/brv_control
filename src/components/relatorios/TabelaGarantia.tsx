import { percentual, type LinhaGarantia } from '../../utils/relatorios';

/** Técnicos em ordem de garantias atendidas, com uma barra ao lado para comparar. */
export default function TabelaGarantia({ linhas, total }: { linhas: LinhaGarantia[]; total: number }) {
  const maior = Math.max(1, ...linhas.map((l) => l.garantias));

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-4 py-2.5">Técnico</th>
            <th scope="col" className="w-2/5 px-4 py-2.5" aria-hidden />
            <th scope="col" className="px-4 py-2.5 text-right">Garantias</th>
            <th scope="col" className="px-4 py-2.5 text-right">% das garantias</th>
            <th scope="col" className="px-4 py-2.5 text-right">Atividades do técnico</th>
            <th scope="col" className="px-4 py-2.5 text-right">Garantia no total dele</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {linhas.map((l) => (
            <tr key={l.id ?? 'sem-tecnico'} className="border-b border-slate-100 last:border-0">
              <th scope="row" className="px-4 py-2.5 text-left font-semibold text-slate-800">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: l.cor ?? '#94A3B8' }} />
                  {l.nome}
                </span>
              </th>
              <td className="px-4 py-2.5" aria-hidden>
                {l.garantias > 0 && (
                  <div className="h-3 rounded-r bg-blue-600" style={{ width: `${(l.garantias / maior) * 100}%` }} />
                )}
              </td>
              <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{l.garantias.toLocaleString('pt-BR')}</td>
              <td className="px-4 py-2.5 text-right text-slate-600">{percentual(l.garantias, total)}</td>
              <td className="px-4 py-2.5 text-right text-slate-600">{l.atividades.toLocaleString('pt-BR')}</td>
              <td className="px-4 py-2.5 text-right text-slate-600">{percentual(l.garantias, l.atividades)}</td>
            </tr>
          ))}
          {linhas.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">Nenhum técnico cadastrado.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
