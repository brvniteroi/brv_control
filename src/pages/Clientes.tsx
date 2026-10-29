import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Archive,
  Building2,
  CheckCircle2,
  Phone,
  Plus,
  Search,
  User,
  Users,
} from 'lucide-react';
import {
  CLIENTES_POR_PAGINA,
  listarClientes,
  type FiltroStatusCliente,
} from '../services/clientes';
import type { Customer } from '../types/fsm';
import ClienteDetalhes from '../components/clientes/ClienteDetalhes';

export default function Clientes() {
  const [clientes, setClientes] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatusCliente>('ativos');
  const ultimaRequisicao = useRef(0);

  // Cliente selecionado para visualização/edição ou 'novo'
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string | 'novo' | null>(null);

  const carregar = useCallback(async () => {
    const requisicao = ++ultimaRequisicao.current;
    setCarregando(true);
    setErroLista(null);
    try {
      const resultado = await listarClientes(busca, filtroStatus, pagina);
      // Descarta respostas antigas que chegaram depois de uma busca mais nova
      if (requisicao !== ultimaRequisicao.current) return;
      setClientes(resultado.itens);
      setTotal(resultado.total);
    } catch (err) {
      if (requisicao !== ultimaRequisicao.current) return;
      console.error('Erro ao buscar clientes:', err);
      setErroLista('Não foi possível carregar a lista de clientes. Tente novamente.');
    } finally {
      if (requisicao === ultimaRequisicao.current) setCarregando(false);
    }
  }, [busca, filtroStatus, pagina]);

  useEffect(() => {
    const timer = setTimeout(() => {
      carregar();
    }, 300);
    return () => clearTimeout(timer);
  }, [carregar]);

  const totalPaginas = Math.max(1, Math.ceil(total / CLIENTES_POR_PAGINA));

  const mudarFiltro = (filtro: FiltroStatusCliente) => {
    setFiltroStatus(filtro);
    setPagina(0);
  };

  // Se houver um cliente aberto ou criando novo, renderiza a tela detalhada do Field Control
  if (clienteSelecionadoId) {
    return (
      <ClienteDetalhes
        clienteId={clienteSelecionadoId}
        onFechar={() => setClienteSelecionadoId(null)}
        onSalvo={(id) => {
          // Cliente novo passa a ser editado (evita criar duplicado no próximo "Salvar")
          setClienteSelecionadoId(id);
          carregar();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho da página de Clientes */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Clientes</h1>
          <p className="mt-1 text-xs text-slate-500">
            Gerencie os clientes, contatos, equipamentos e ordens de serviço.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setClienteSelecionadoId('novo')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700"
        >
          <Plus size={18} />
          Adicionar cliente
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        {/* Campo de Busca */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(0);
            }}
            placeholder="Buscar cliente por nome, CPF/CNPJ, e-mail..."
            className="block w-full rounded-xl border border-slate-200 py-2.5 pr-3 pl-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Filtros de Status */}
        <div className="flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => mudarFiltro('ativos')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filtroStatus === 'ativos'
                ? 'bg-white text-blue-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ativos
          </button>
          <button
            type="button"
            onClick={() => mudarFiltro('arquivados')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filtroStatus === 'arquivados'
                ? 'bg-white text-blue-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Arquivados
          </button>
          <button
            type="button"
            onClick={() => mudarFiltro('todos')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filtroStatus === 'todos'
                ? 'bg-white text-blue-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos
          </button>
        </div>
      </div>

      {/* Lista de Clientes */}
      {erroLista ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <span>{erroLista}</span>
          <button
            type="button"
            onClick={() => carregar()}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 font-semibold text-red-700 hover:bg-red-100"
          >
            Tentar de novo
          </button>
        </div>
      ) : carregando ? (
        <div className="flex h-64 w-full items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <span className="text-xs font-medium">Carregando lista de clientes...</span>
          </div>
        </div>
      ) : clientes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 px-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-2xs">
            <Users size={28} />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-800">
            {busca ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            {busca
              ? `Não encontramos nenhum cliente correspondente à pesquisa "${busca}".`
              : 'Comece adicionando seu primeiro cliente para organizar atendimentos e ordens de serviço.'}
          </p>
          <button
            type="button"
            onClick={() => setClienteSelecionadoId('novo')}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
          >
            <Plus size={16} />
            Cadastrar primeiro cliente
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="px-5 py-3.5">Cliente</th>
                  <th className="px-5 py-3.5">Documento</th>
                  <th className="px-5 py-3.5">Contato</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {clientes.map((cli) => (
                  <tr
                    key={cli.id}
                    onClick={() => setClienteSelecionadoId(cli.id)}
                    className="cursor-pointer transition hover:bg-slate-50/80"
                  >
                    {/* Cliente: Avatar + Nome */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold text-xs">
                          {cli.person_type === 'PJ' ? <Building2 size={16} /> : <User size={16} />}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">
                            {cli.name}
                          </div>
                          {cli.trade_name && (
                            <div className="text-[11px] text-slate-400">
                              {cli.trade_name}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Documento */}
                    <td className="px-5 py-4 font-mono text-slate-600">
                      {cli.document || '—'}
                    </td>

                    {/* Contato */}
                    <td className="px-5 py-4">
                      <div className="space-y-0.5">
                        {cli.phone && (
                          <div className="flex items-center gap-1.5 text-slate-800">
                            <Phone size={13} className="text-blue-500" />
                            <span>{cli.phone}</span>
                          </div>
                        )}
                        {cli.email && (
                          <div className="text-slate-400 text-[11px]">
                            {cli.email}
                          </div>
                        )}
                        {!cli.phone && !cli.email && <span className="text-slate-400">—</span>}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      {cli.active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-100">
                          <CheckCircle2 size={12} /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          <Archive size={12} /> Arquivado
                        </span>
                      )}
                    </td>

                    {/* Ação */}
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setClienteSelecionadoId(cli.id);
                        }}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                      >
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            <span>
              {total} {total === 1 ? 'cliente' : 'clientes'} · página {pagina + 1} de {totalPaginas}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagina === 0}
                onClick={() => setPagina((p) => p - 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={pagina + 1 >= totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
