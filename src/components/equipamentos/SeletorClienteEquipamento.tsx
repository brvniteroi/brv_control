import { useEffect, useRef, useState } from 'react';
import { Building2, Check, Lock, Search, X } from 'lucide-react';
import { buscarClientesParaSeletor } from '../../services/equipamentos';

interface ClienteItem {
  id: string;
  name: string;
}

interface SeletorClienteEquipamentoProps {
  /** Cliente já escolhido (id e nome) ou null. */
  valor: ClienteItem | null;
  onChange: (cliente: ClienteItem | null) => void;
  desabilitado?: boolean;
}

export default function SeletorClienteEquipamento({
  valor,
  onChange,
  desabilitado,
}: SeletorClienteEquipamentoProps) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<ClienteItem[]>([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const ultima = useRef(0);

  useEffect(() => {
    if (!aberto) return;
    const requisicao = ++ultima.current;
    const timer = setTimeout(async () => {
      setCarregando(true);
      try {
        const lista = await buscarClientesParaSeletor(busca);
        if (requisicao === ultima.current) {
          setResultados(lista);
        }
      } catch (e) {
        console.error('Erro ao buscar clientes para seletor:', e);
      } finally {
        if (requisicao === ultima.current) {
          setCarregando(false);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [busca, aberto]);

  if (valor) {
    return (
      <div className="mt-1.5 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800">
        <div className="flex items-center gap-2.5 truncate">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <Building2 size={15} />
          </div>
          <span className="truncate font-semibold text-slate-900">{valor.name}</span>
        </div>
        {desabilitado ? (
          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
            <Lock size={12} />
            Não editável
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-2 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-600"
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
        onBlur={() => setTimeout(() => setAberto(false), 200)}
        placeholder="Buscar cliente por nome..."
        className="block w-full rounded-xl border border-slate-200 py-2.5 pr-3 pl-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
      />
      {aberto && (
        <ul className="absolute z-30 mt-1.5 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          {carregando && (
            <li className="px-3 py-2.5 text-xs text-slate-400">Buscando clientes...</li>
          )}
          {!carregando && resultados.length === 0 && (
            <li className="px-3 py-2.5 text-xs text-slate-400">
              {busca ? 'Nenhum cliente encontrado.' : 'Digite para buscar um cliente ativo.'}
            </li>
          )}
          {resultados.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onMouseDown={() => {
                  onChange(c);
                  setBusca('');
                  setAberto(false);
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-blue-50"
              >
                <div className="flex items-center gap-2 truncate">
                  <Building2 size={15} className="shrink-0 text-slate-400" />
                  <span className="truncate font-medium text-slate-800">{c.name}</span>
                </div>
                <Check size={14} className="text-transparent group-hover:text-blue-500" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
