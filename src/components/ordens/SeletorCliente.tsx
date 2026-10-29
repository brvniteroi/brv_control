import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { listarClientes } from '../../services/clientes';
import type { Customer } from '../../types/fsm';

interface SeletorClienteProps {
  /** Cliente já escolhido (id e nome) ou null. */
  valor: { id: string; name: string } | null;
  onChange: (cliente: Customer | null) => void;
  desabilitado?: boolean;
}

export default function SeletorCliente({ valor, onChange, desabilitado }: SeletorClienteProps) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<Customer[]>([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const ultima = useRef(0);

  useEffect(() => {
    if (!aberto) return;
    const requisicao = ++ultima.current;
    const timer = setTimeout(async () => {
      setCarregando(true);
      try {
        const r = await listarClientes(busca, 'ativos', 0);
        if (requisicao === ultima.current) setResultados(r.itens.slice(0, 15));
      } catch (e) {
        console.error('Erro ao buscar clientes:', e);
      } finally {
        if (requisicao === ultima.current) setCarregando(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [busca, aberto]);

  if (valor) {
    return (
      <div className="mt-1.5 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
        <span className="truncate font-medium">{valor.name}</span>
        {!desabilitado && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-2 text-slate-400 hover:text-slate-600"
            aria-label="Trocar cliente"
          >
            <X size={16} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative mt-1.5">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
        <Search size={16} />
      </div>
      <input
        type="text"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        placeholder="Buscar cliente por nome, CPF/CNPJ ou telefone..."
        className="block w-full rounded-lg border border-slate-200 py-2 pr-3 pl-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
      />
      {aberto && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {carregando && <li className="px-3 py-2 text-xs text-slate-400">Buscando...</li>}
          {!carregando && resultados.length === 0 && (
            <li className="px-3 py-2 text-xs text-slate-400">Nenhum cliente encontrado.</li>
          )}
          {resultados.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                // mouseDown dispara antes do blur do campo, que fecharia a lista
                onMouseDown={() => {
                  onChange(c);
                  setBusca('');
                  setAberto(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
              >
                <span className="font-medium text-slate-800">{c.name}</span>
                {(c.phone || c.document) && (
                  <span className="ml-2 text-[11px] text-slate-400">{c.phone || c.document}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
