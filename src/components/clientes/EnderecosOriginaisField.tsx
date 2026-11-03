import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { enderecosOriginaisField } from '../../services/clientes';
import type { CustomerAddress } from '../../types/fsm';

interface EnderecosOriginaisFieldProps {
  enderecos: CustomerAddress[];
}

/** Só para o escritório: o endereço exatamente como estava no Field Control, para consulta em caso de dúvida. */
export default function EnderecosOriginaisField({ enderecos }: EnderecosOriginaisFieldProps) {
  const [originais, setOriginais] = useState<Map<string, string>>(new Map());
  const chave = enderecos.map((e) => e.id).join(',');

  useEffect(() => {
    let cancelado = false;
    enderecosOriginaisField(chave ? chave.split(',') : [])
      .then((m) => !cancelado && setOriginais(m))
      .catch((e: unknown) => console.error('Erro ao carregar o endereço antigo do Field:', e));
    return () => {
      cancelado = true;
    };
  }, [chave]);

  const itens = enderecos.filter((e) => originais.has(e.id));
  if (itens.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <History size={13} /> Endereço antigo no Field
        <span className="font-normal text-slate-400">(como foi importado; só o escritório vê)</span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {itens.map((e) => (
          <li key={e.id} className="text-xs text-slate-600">
            {itens.length > 1 && e.label && <span className="font-semibold">{e.label}: </span>}
            {originais.get(e.id)}
          </li>
        ))}
      </ul>
    </div>
  );
}
