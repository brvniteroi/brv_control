import { useCallback, useEffect, useRef, useState } from 'react';
import { ClipboardList, Plus, Search } from 'lucide-react';
import OrdemDetalhes from '../components/ordens/OrdemDetalhes';
import {
  ORDENS_POR_PAGINA,
  listarOrdens,
  listarTipos,
  type FiltrosOrdens,
  type OrdemResumo,
} from '../services/ordens';
import type { ServiceOrderStatus, ServiceType } from '../types/fsm';
import { STATUS_OS, formatarData, formatarDataHora, infoStatusOS } from '../utils/ordens';

const SELECT =
  'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

/** Técnicos e próximo agendamento, ignorando atividades canceladas. */
function resumoAtividades(o: OrdemResumo) {
  const validas = o.tasks.filter((t) => t.status !== 'cancelada');
  const nomes = [...new Set(validas.map((t) => t.employee?.name).filter((n): n is string => Boolean(n)))];
  const datas = validas.map((t) => t.scheduled_start).filter((d): d is string => Boolean(d)).sort();
  return { tecnicos: nomes.join(', '), agendamento: datas.length ? datas[datas.length - 1] : null };
}

export default function OrdensServico() {
  const [ordens, setOrdens] = useState<OrdemResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<FiltrosOrdens>({ termo: '', status: '', tipoId: '' });
  const [tipos, setTipos] = useState<ServiceType[]>([]);
  const [selecionada, setSelecionada] = useState<string | 'nova' | null>(null);
  const ultimaRequisicao = useRef(0);

  useEffect(() => {
    listarTipos().then(setTipos).catch((e: unknown) => console.error('Erro ao listar tipos:', e));
  }, []);

  const carregar = useCallback(async () => {
    const requisicao = ++ultimaRequisicao.current;
    setCarregando(true);
    setErro(null);
    try {
      const r = await listarOrdens(filtros, pagina);
      if (requisicao !== ultimaRequisicao.current) return;
      setOrdens(r.itens);
      setTotal(r.total);
    } catch (e) {
      if (requisicao !== ultimaRequisicao.current) return;
      console.error('Erro ao listar OS:', e);
      setErro('Não foi possível carregar as ordens de serviço. Tente novamente.');
    } finally {
      if (requisicao === ultimaRequisicao.current) setCarregando(false);
    }
  }, [filtros, pagina]);

  useEffect(() => {
    const timer = setTimeout(carregar, 300);
    return () => clearTimeout(timer);
  }, [carregar]);

  const totalPaginas = Math.max(1, Math.ceil(total / ORDENS_POR_PAGINA));
  const mudarFiltro = (parcial: Partial<FiltrosOrdens>) => {
    setFiltros((f) => ({ ...f, ...parcial }));
    setPagina(0);
  };

  if (selecionada) {
    return (
      <OrdemDetalhes
        ordemId={selecionada}
        onFechar={() => setSelecionada(null)}
        onSalvo={(id) => {
          setSelecionada(id);
          carregar();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ordens de Serviço</h1>
          <p className="mt-1 text-xs text-slate-500">Acompanhe as OS, as atividades agendadas e as fotos de campo.</p>
        </div>
        <button
          type="button"
          onClick={() => setSelecionada('nova')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700"
        >
          <Plus size={18} />
          Nova OS
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            value={filtros.termo}
            onChange={(e) => mudarFiltro({ termo: e.target.value })}
            placeholder="Buscar por número, cliente ou descrição..."
            className="block w-full rounded-xl border border-slate-200 py-2.5 pr-3 pl-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <select
          aria-label="Filtrar por situação"
          value={filtros.status}
          onChange={(e) => mudarFiltro({ status: e.target.value as ServiceOrderStatus | '' })}
          className={SELECT}
        >
          <option value="">Todas as situações</option>
          {STATUS_OS.map((s) => (
            <option key={s.valor} value={s.valor}>{s.rotulo}</option>
          ))}
        </select>
        <select
          aria-label="Filtrar por tipo"
          value={filtros.tipoId}
          onChange={(e) => mudarFiltro({ tipoId: e.target.value })}
          className={SELECT}
        >
          <option value="">Todos os tipos</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>{t.name}{t.active ? '' : ' (arquivado)'}</option>
          ))}
        </select>
      </div>

      {erro ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <span>{erro}</span>
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
            <span className="text-xs font-medium">Carregando ordens de serviço...</span>
          </div>
        </div>
      ) : ordens.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-2xs">
            <ClipboardList size={28} />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-800">Nenhuma OS encontrada</h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            {filtros.termo || filtros.status || filtros.tipoId
              ? 'Nenhuma OS corresponde aos filtros escolhidos.'
              : 'Crie a primeira ordem de serviço para começar.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Nº</th>
                  <th className="px-5 py-3.5">Cliente</th>
                  <th className="px-5 py-3.5">Tipo</th>
                  <th className="px-5 py-3.5">Situação</th>
                  <th className="px-5 py-3.5">Técnico</th>
                  <th className="px-5 py-3.5">Agendamento</th>
                  <th className="px-5 py-3.5">Abertura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {ordens.map((o) => {
                  const info = infoStatusOS(o.status);
                  const { tecnicos, agendamento } = resumoAtividades(o);
                  return (
                    <tr
                      key={o.id}
                      onClick={() => setSelecionada(o.id)}
                      className="cursor-pointer transition hover:bg-slate-50/80"
                    >
                      <td className="px-5 py-4 font-mono font-bold text-slate-900">{o.number}</td>
                      <td className="max-w-64 px-5 py-4">
                        <div className="truncate text-sm font-semibold text-slate-900">{o.customer?.name ?? '—'}</div>
                        {o.description && <div className="truncate text-[11px] text-slate-400">{o.description}</div>}
                      </td>
                      <td className="px-5 py-4">{o.service_type?.name ?? '—'}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${info.classe}`}>
                          {info.rotulo}
                        </span>
                      </td>
                      <td className="px-5 py-4">{tecnicos || <span className="text-slate-400">A distribuir</span>}</td>
                      <td className="px-5 py-4">{agendamento ? formatarDataHora(agendamento) : <span className="text-slate-400">—</span>}</td>
                      <td className="px-5 py-4 text-slate-500">{formatarData(o.opened_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            <span>
              {total} {total === 1 ? 'OS' : 'OS'} · página {pagina + 1} de {totalPaginas}
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
