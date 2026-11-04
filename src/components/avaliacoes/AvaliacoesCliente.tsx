import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { avaliacoesDoCliente, type Avaliacao } from '../../services/avaliacoes';
import { formatarData } from '../../utils/ordens';
import Estrelas from './Estrelas';

/** Avaliações que o cliente já deu (média e lista), na aba Atendimento do cliente. */
export default function AvaliacoesCliente({ clienteId, onAbrirOrdem }: { clienteId: string; onAbrirOrdem: (id: string) => void }) {
  const [lista, setLista] = useState<Avaliacao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    avaliacoesDoCliente(clienteId)
      .then((l) => ativo && setLista(l))
      .catch((e: unknown) => ativo && setErro(e instanceof Error ? e.message : 'Não foi possível carregar as avaliações.'));
    return () => {
      ativo = false;
    };
  }, [clienteId]);

  if (!erro && (lista === null || lista.length === 0)) return null;
  const media = lista && lista.length ? lista.reduce((s, a) => s + a.stars, 0) / lista.length : 0;

  return (
    <div className="mx-6 mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-800">
        <Star size={18} className="text-amber-500" />
        <h2 className="text-base font-bold">Avaliações{lista ? ` (${lista.length})` : ''}</h2>
        {lista && lista.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <Estrelas nota={media} /> média {media.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
          </span>
        )}
      </div>

      {erro ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {lista!.map((a) => (
            <li key={a.id} className="py-2.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Estrelas nota={a.stars} />
                <span className="text-[11px] text-slate-500">
                  {formatarData(a.created_at)}
                  {a.service_order && (
                    <>
                      {' · '}
                      <button type="button" onClick={() => onAbrirOrdem(a.service_order!.id)} className="text-blue-600 hover:underline">
                        OS {a.service_order.number}
                      </button>
                    </>
                  )}
                  {a.employee ? ` · ${a.employee.name}` : ''}
                </span>
              </div>
              {a.comment && <p className="mt-1 whitespace-pre-line text-xs text-slate-700">"{a.comment}"</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
