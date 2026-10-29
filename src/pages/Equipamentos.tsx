import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Cpu,
  MapPin,
  Plus,
  Power,
  QrCode,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import {
  EQUIPAMENTOS_POR_PAGINA,
  listarEquipamentos,
  type EquipamentoComCliente,
  type FiltroStatusEquipamento,
} from '../services/equipamentos';
import EquipamentoDetalhes from '../components/equipamentos/EquipamentoDetalhes';
import { formatarData } from '../utils/ordens';

function formatarDataGarantia(dataStr: string | null | undefined): string {
  if (!dataStr) return '—';
  const limpa = dataStr.slice(0, 10);
  const partes = limpa.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return formatarData(dataStr);
}

function obterStatusGarantia(warrantyUntil: string | null | undefined): {
  emGarantia: boolean;
  dataFmt: string;
} | null {
  if (!warrantyUntil) return null;
  const dataIso = warrantyUntil.slice(0, 10);
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  const hojeIso = `${ano}-${mes}-${dia}`;

  const emGarantia = dataIso >= hojeIso;
  const dataFmt = formatarDataGarantia(warrantyUntil);
  return {
    emGarantia,
    dataFmt,
  };
}

export default function Equipamentos() {
  const [equipamentos, setEquipamentos] = useState<EquipamentoComCliente[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatusEquipamento>('ativos');
  const ultimaRequisicao = useRef(0);

  // Equipamento selecionado para edição ou 'novo'
  const [equipamentoSelecionadoId, setEquipamentoSelecionadoId] = useState<
    string | 'novo' | null
  >(null);

  const carregar = useCallback(async () => {
    const requisicao = ++ultimaRequisicao.current;
    setCarregando(true);
    setErroLista(null);
    try {
      const resultado = await listarEquipamentos(busca, filtroStatus, pagina);
      if (requisicao !== ultimaRequisicao.current) return;
      setEquipamentos(resultado.itens);
      setTotal(resultado.total);
    } catch (err) {
      if (requisicao !== ultimaRequisicao.current) return;
      console.error('Erro ao carregar equipamentos:', err);
      setErroLista('Não foi possível carregar a lista de equipamentos. Tente novamente.');
    } finally {
      if (requisicao === ultimaRequisicao.current) {
        setCarregando(false);
      }
    }
  }, [busca, filtroStatus, pagina]);

  useEffect(() => {
    const timer = setTimeout(() => {
      carregar();
    }, 300);
    return () => clearTimeout(timer);
  }, [carregar]);

  const totalPaginas = Math.max(1, Math.ceil(total / EQUIPAMENTOS_POR_PAGINA));

  const mudarFiltro = (filtro: FiltroStatusEquipamento) => {
    setFiltroStatus(filtro);
    setPagina(0);
  };

  // Se houver um equipamento aberto para edição ou novo
  if (equipamentoSelecionadoId) {
    return (
      <EquipamentoDetalhes
        equipamentoId={equipamentoSelecionadoId}
        onFechar={() => setEquipamentoSelecionadoId(null)}
        onSalvo={(id) => {
          setEquipamentoSelecionadoId(id);
          carregar();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho da página */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Equipamentos</h1>
          <p className="mt-1 text-xs text-slate-500">
            Gerencie os equipamentos instalados nos clientes, especificações técnicas e garantias.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setEquipamentoSelecionadoId('novo')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700"
        >
          <Plus size={18} />
          Novo equipamento
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
            placeholder="Buscar por categoria, marca, modelo, série, etiqueta ou local..."
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
            onClick={() => mudarFiltro('inativos')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filtroStatus === 'inativos'
                ? 'bg-white text-blue-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Inativos
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

      {/* Conteúdo da Listagem */}
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
            <span className="text-xs font-medium">Carregando lista de equipamentos...</span>
          </div>
        </div>
      ) : equipamentos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 px-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-2xs">
            <Cpu size={28} />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-800">
            {busca ? 'Nenhum equipamento encontrado' : 'Nenhum equipamento cadastrado'}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            {busca
              ? `Não encontramos nenhum equipamento correspondente à pesquisa "${busca}".`
              : 'Comece adicionando seu primeiro equipamento para controlar o histórico de manutenções e garantias.'}
          </p>
          <button
            type="button"
            onClick={() => setEquipamentoSelecionadoId('novo')}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
          >
            <Plus size={16} />
            Cadastrar primeiro equipamento
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          {/* Tabela para Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="px-5 py-3.5">Categoria & Modelo</th>
                  <th className="px-5 py-3.5">Cliente</th>
                  <th className="px-5 py-3.5">Local no imóvel</th>
                  <th className="px-5 py-3.5">Garantia</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {equipamentos.map((eq) => {
                  const infoGarantia = obterStatusGarantia(eq.warranty_until);
                  const detalhesModelo = [eq.brand, eq.model].filter(Boolean).join(' ');

                  return (
                    <tr
                      key={eq.id}
                      onClick={() => setEquipamentoSelecionadoId(eq.id)}
                      className="cursor-pointer transition hover:bg-slate-50/80"
                    >
                      {/* Categoria + Marca/Modelo */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <Cpu size={18} />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{eq.category}</div>
                            {detalhesModelo && (
                              <div className="text-[11px] text-slate-500">{detalhesModelo}</div>
                            )}
                            {eq.qr_code && (
                              <div className="mt-0.5 inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                                <QrCode size={10} />
                                {eq.qr_code}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Cliente */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="shrink-0 text-slate-400" />
                          <span className="font-semibold text-slate-800">
                            {eq.customer?.name || 'Cliente não identificado'}
                          </span>
                        </div>
                      </td>

                      {/* Local no Imóvel */}
                      <td className="px-5 py-4 text-slate-600">
                        {eq.location ? (
                          <div className="flex items-center gap-1.5">
                            <MapPin size={13} className="shrink-0 text-slate-400" />
                            <span>{eq.location}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Garantia */}
                      <td className="px-5 py-4">
                        {infoGarantia ? (
                          infoGarantia.emGarantia ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                              <ShieldCheck size={12} /> Em garantia ({infoGarantia.dataFmt})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                              <ShieldAlert size={12} /> Vencida ({infoGarantia.dataFmt})
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        {eq.active ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                            <CheckCircle2 size={12} /> Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                            <Power size={12} /> Inativo
                          </span>
                        )}
                      </td>

                      {/* Ação */}
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEquipamentoSelecionadoId(eq.id);
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                        >
                          Abrir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Lista em Cartões para Celular */}
          <div className="md:hidden divide-y divide-slate-100">
            {equipamentos.map((eq) => {
              const infoGarantia = obterStatusGarantia(eq.warranty_until);
              const detalhesModelo = [eq.brand, eq.model].filter(Boolean).join(' ');

              return (
                <div
                  key={eq.id}
                  onClick={() => setEquipamentoSelecionadoId(eq.id)}
                  className="cursor-pointer p-4 transition hover:bg-slate-50/80 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Cpu size={16} />
                      </div>
                      <div>
                        <span className="font-bold text-sm text-slate-900">{eq.category}</span>
                        {detalhesModelo && (
                          <p className="text-xs text-slate-500">{detalhesModelo}</p>
                        )}
                      </div>
                    </div>

                    {eq.active ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        Inativo
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                    <Building2 size={13} className="text-slate-400" />
                    <span>{eq.customer?.name || 'Cliente não identificado'}</span>
                  </div>

                  {eq.location && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <MapPin size={13} className="text-slate-400" />
                      <span>{eq.location}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {eq.qr_code && (
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                        <Tag size={10} />
                        {eq.qr_code}
                      </span>
                    )}

                    {infoGarantia && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          infoGarantia.emGarantia
                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border border-rose-200 bg-rose-50 text-rose-700'
                        }`}
                      >
                        {infoGarantia.emGarantia ? (
                          <ShieldCheck size={11} />
                        ) : (
                          <ShieldAlert size={11} />
                        )}
                        {infoGarantia.emGarantia ? 'Em garantia' : 'Vencida'} (
                        {infoGarantia.dataFmt})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            <span>
              {total} {total === 1 ? 'equipamento' : 'equipamentos'} · página {pagina + 1} de{' '}
              {totalPaginas}
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
