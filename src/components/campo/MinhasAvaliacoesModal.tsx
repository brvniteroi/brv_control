import { Star, X } from 'lucide-react';
import type { MinhasAvaliacoes } from '../../services/avaliacoes';
import Estrelas from '../avaliacoes/Estrelas';

interface Props {
  dados: MinhasAvaliacoes;
  dias: number;
  onFechar: () => void;
}

/** Lista das avaliações que o técnico recebeu no período (aberta pela estrela do cabeçalho). */
export default function MinhasAvaliacoesModal({ dados, dias, onFechar }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onFechar}>
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Star size={18} className="fill-amber-400 text-amber-400" /> Minhas avaliações
          </h2>
          <button type="button" onClick={onFechar} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">Últimos {dias} dias</p>

        {dados.quantidade === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Nenhuma avaliação de cliente neste período.</p>
        ) : (
          <>
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3">
              <span className="text-3xl font-bold text-amber-600">
                {dados.media!.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </span>
              <div>
                <Estrelas nota={dados.media!} tamanho={16} />
                <div className="text-xs text-amber-800">
                  {dados.quantidade} {dados.quantidade === 1 ? 'avaliação' : 'avaliações'}
                </div>
              </div>
            </div>

            <ul className="mt-3 divide-y divide-slate-100">
              {dados.itens.map((a, i) => (
                <li key={i} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <Estrelas nota={a.estrelas} />
                    <span className="text-[11px] text-slate-400">
                      OS {a.os} · {new Date(a.data).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  {a.comentario && <p className="mt-1 whitespace-pre-line text-sm text-slate-700">"{a.comentario}"</p>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
