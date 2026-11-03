import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { enderecosOriginaisField, observacoesOriginaisField } from '../../services/clientes';
import type { CustomerAddress } from '../../types/fsm';

interface EnderecosOriginaisFieldProps {
  clienteId: string;
  enderecos: CustomerAddress[];
}

/** Só para o escritório: o endereço e as observações exatamente como estava no Field Control, para consulta em caso de dúvida. */
export default function EnderecosOriginaisField({ clienteId, enderecos }: EnderecosOriginaisFieldProps) {
  const [originais, setOriginais] = useState<Map<string, string>>(new Map());
  const [observacoes, setObservacoes] = useState<string | null>(null);
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

  useEffect(() => {
    let cancelado = false;
    observacoesOriginaisField(clienteId)
      .then((n) => !cancelado && setObservacoes(n))
      .catch((e: unknown) => console.error('Erro ao carregar as observações antigas do Field:', e));
    return () => {
      cancelado = true;
    };
  }, [clienteId]);

  const itens = enderecos.filter((e) => originais.has(e.id));
  if (itens.length === 0 && !observacoes) return null;

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
      {observacoes && (
        <div className={itens.length > 0 ? 'mt-2.5 border-t border-slate-200 pt-2.5' : ''}>
          <div className="text-[11px] font-semibold text-slate-500">Observações do cliente</div>
          <p className="mt-0.5 whitespace-pre-line text-xs text-slate-600">{observacoes}</p>
        </div>
      )}
    </div>
  );
}
