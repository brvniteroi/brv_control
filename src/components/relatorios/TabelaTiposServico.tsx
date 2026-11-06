import { Star } from 'lucide-react';
import { percentual, umaCasa, type LinhaTipo } from '../../utils/relatorios';

/** Tipos de serviço em ordem de quantidade, com uma barra ao lado para comparar (mesma cor: a barra só mostra o tamanho). */
export default function TabelaTiposServico({ linhas, total }: { linhas: LinhaTipo[]; total: number }) {
  const maior = Math.max(1, ...linhas.map((l) => l.realizadas));

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-4 py-2.5">Tipo de serviço</th>
            <th scope="col" className="w-2/5 px-4 py-2.5" aria-hidden />
            <th scope="col" className="px-4 py-2.5 text-right">Realizadas</th>
            <th scope="col" className="px-4 py-2.5 text-right">% do total</th>
            <th scope="col" className="px-4 py-2.5 text-right">Avaliação média</th>
            <th scope="col" className="px-4 py-2.5 text-right">Avaliações</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {linhas.map((l) => (
            <tr key={l.id ?? 'sem-tipo'} className="border-b border-slate-100 last:border-0">
              <th scope="row" className="px-4 py-2.5 text-left font-semibold text-slate-800">{l.nome}</th>
              <td className="px-4 py-2.5" aria-hidden>
                {l.realizadas > 0 && (
                  <div className="h-3 rounded-r bg-blue-600" style={{ width: `${(l.realizadas / maior) * 100}%` }} />
                )}
              </td>
              <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{l.realizadas.toLocaleString('pt-BR')}</td>
              <td className="px-4 py-2.5 text-right text-slate-600">{percentual(l.realizadas, total)}</td>
              <td className="px-4 py-2.5 text-right text-slate-600">
                {l.mediaEstrelas === null ? (
                  '—'
                ) : (
                  <span className="inline-flex items-center gap-1">
                    {umaCasa(l.mediaEstrelas)} <Star size={12} className="fill-amber-400 text-amber-400" />
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right text-slate-600">{l.avaliacoes}</td>
            </tr>
          ))}
          {linhas.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">Nenhuma atividade concluída neste mês.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
