import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  ListTodo,
  Loader2,
  Lock,
  MapPin,
  Plus,
  Search,
  Snowflake,
} from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import FaixaDadosDemo from '../components/pmoc/FaixaDadosDemo';
import { listarPlanos } from '../components/pmoc/fonteDeDados';
import {
  calcularSituacaoPlano,
  formatarDataIsoCurta,
  formatarEnderecoResumo,
  formatarMesReferencia,
} from '../components/pmoc/regrasPmoc';
import type { PmocDisplayStatus, PmocPlanSummary } from '../types/pmoc';

type FiltroSituacaoPmoc = 'todos' | PmocDisplayStatus;

const OPCOES_FILTRO: readonly { valor: FiltroSituacaoPmoc; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todas as situações' },
  { valor: 'vigente', rotulo: 'Vigente' },
  { valor: 'vencendo', rotulo: 'Vence em até 60 dias' },
  { valor: 'vencido', rotulo: 'Vencido' },
  { valor: 'rascunho', rotulo: 'Rascunho' },
  { valor: 'encerrado', rotulo: 'Encerrado' },
];

function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export default function Pmoc() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const podeGerenciar = profile?.role === 'admin' || profile?.role === 'escritorio';

  const [planos, setPlanos] = useState<PmocPlanSummary[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState<FiltroSituacaoPmoc>('todos');

  const recarregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await listarPlanos();
      setPlanos(lista);
    } catch (err) {
      console.error('Erro ao carregar planos PMOC:', err);
      setErro('Não foi possível carregar a lista de planos PMOC. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (!podeGerenciar) return;
    let ativo = true;

    listarPlanos()
      .then((lista) => {
        if (ativo) setPlanos(lista);
      })
      .catch((err) => {
        if (!ativo) return;
        console.error('Erro ao carregar planos PMOC:', err);
        setErro('Não foi possível carregar a lista de planos PMOC. Tente novamente.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [podeGerenciar]);

  const planosComSituacao = useMemo(
    () =>
      planos.map((plano) => ({
        plano,
        infoSituacao: calcularSituacaoPlano(plano.status, plano.end_date),
      })),
    [planos],
  );

  const resumo = useMemo(() => {
    let vigentes = 0;
    let vencendo = 0;
    let visitasAtrasadas = 0;

    for (const { plano, infoSituacao } of planosComSituacao) {
      if (infoSituacao.situacao === 'vigente' || infoSituacao.situacao === 'vencendo') {
        vigentes += 1;
      }
      if (infoSituacao.situacao === 'vencendo') {
        vencendo += 1;
      }
      visitasAtrasadas += plano.overdue_visits_count;
    }

    return { vigentes, vencendo, visitasAtrasadas };
  }, [planosComSituacao]);

  const filtrados = useMemo(() => {
    const termo = normalizarBusca(busca);
    return planosComSituacao.filter(({ plano, infoSituacao }) => {
      if (filtroSituacao !== 'todos' && infoSituacao.situacao !== filtroSituacao) {
        return false;
      }
      if (!termo) return true;
      const campos = [
        plano.customer_name,
        plano.customer_trade_name ?? '',
        plano.code,
        plano.customer_document ?? '',
        formatarEnderecoResumo(plano.address_snapshot),
      ];
      return campos.some((c) => normalizarBusca(c).includes(termo));
    });
  }, [planosComSituacao, filtroSituacao, busca]);

  if (!podeGerenciar) {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Lock size={24} aria-hidden="true" />
        </div>
        <h1 className="mt-3 text-base font-bold text-slate-800">Acesso Restrito</h1>
        <p className="mt-1 max-w-sm text-xs text-slate-500">
          A gestão de planos PMOC é restrita aos perfis de escritório e administração.
        </p>
      </div>
    );
  }

  const temFiltroAtivo = Boolean(busca.trim()) || filtroSituacao !== 'todos';

  return (
    <div className="space-y-5">
      <FaixaDadosDemo />

      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Planos PMOC</h1>
          <p className="mt-1 text-xs text-slate-500">
            Contratos anuais de manutenção preventiva, ambientes climatizados, cronogramas e relatórios mensais.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/pmoc/modelo')}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50"
          >
            <ListTodo size={16} aria-hidden="true" />
            Modelo de tarefas
          </button>

          <button
            type="button"
            onClick={() => navigate('/pmoc/novo')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700"
          >
            <Plus size={18} aria-hidden="true" />
            Novo plano
          </button>
        </div>
      </div>

      {/* Cards de resumo operacional */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={22} aria-hidden="true" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Planos vigentes</div>
            <div className="mt-0.5 text-2xl font-bold text-slate-900">{resumo.vigentes}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            setFiltroSituacao((atual) => (atual === 'vencendo' ? 'todos' : 'vencendo'))
          }
          className={`flex items-center gap-3.5 rounded-2xl border bg-white p-4 text-left shadow-xs transition ${
            filtroSituacao === 'vencendo'
              ? 'border-amber-400 ring-1 ring-amber-400'
              : 'border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <CalendarClock size={22} aria-hidden="true" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Vencendo em até 60 dias</div>
            <div className="mt-0.5 text-2xl font-bold text-amber-700">{resumo.vencendo}</div>
          </div>
        </button>

        <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              resumo.visitasAtrasadas > 0
                ? 'bg-rose-50 text-rose-600'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            <AlertTriangle size={22} aria-hidden="true" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Visitas atrasadas</div>
            <div
              className={`mt-0.5 text-2xl font-bold ${
                resumo.visitasAtrasadas > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {resumo.visitasAtrasadas}
            </div>
          </div>
        </div>
      </div>

      {/* Busca e filtro por situação */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label htmlFor="pmoc-busca-cliente" className="sr-only">
            Buscar plano por cliente, código ou endereço
          </label>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search size={18} aria-hidden="true" />
          </div>
          <input
            id="pmoc-busca-cliente"
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            autoCorrect="off"
            spellCheck={false}
            placeholder="Buscar por cliente, código do plano ou endereço..."
            className="block w-full rounded-xl border border-slate-200 py-2.5 pr-3 pl-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div className="sm:w-60">
          <label htmlFor="pmoc-filtro-situacao" className="sr-only">
            Filtrar por situação
          </label>
          <select
            id="pmoc-filtro-situacao"
            value={filtroSituacao}
            onChange={(e) => setFiltroSituacao(e.target.value as FiltroSituacaoPmoc)}
            className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          >
            {OPCOES_FILTRO.map((op) => (
              <option key={op.valor} value={op.valor}>
                {op.rotulo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Estados de erro, carregamento, vazio e lista */}
      {erro ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-600" aria-hidden="true" />
            <span>{erro}</span>
          </div>
          <button
            type="button"
            onClick={() => void recarregar()}
            className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 font-semibold text-rose-700 hover:bg-rose-100"
          >
            Tentar de novo
          </button>
        </div>
      ) : carregando ? (
        <div className="flex h-64 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <Loader2 size={26} className="animate-spin text-blue-600" aria-hidden="true" />
            <span className="text-xs font-medium">Carregando planos PMOC...</span>
          </div>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-2xs">
            <FileCheck2 size={28} aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-800">
            {temFiltroAtivo ? 'Nenhum plano encontrado' : 'Nenhum plano PMOC cadastrado'}
          </h2>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            {temFiltroAtivo
              ? 'Nenhum plano corresponde aos filtros selecionados. Limpe a busca ou troque a situação.'
              : 'Cadastre o primeiro plano PMOC para organizar ambientes climatizados, cronogramas e relatórios mensais.'}
          </p>
          {temFiltroAtivo ? (
            <button
              type="button"
              onClick={() => {
                setBusca('');
                setFiltroSituacao('todos');
              }}
              className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Limpar filtros
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/pmoc/novo')}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
            >
              <Plus size={16} aria-hidden="true" />
              Criar primeiro plano
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          {/* Tabela Desktop com rolagem horizontal acessível */}
          <div
            role="region"
            aria-label="Lista de planos PMOC"
            tabIndex={0}
            className="hidden overflow-x-auto md:block"
          >
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold tracking-wider text-slate-500 uppercase">
                  <th scope="col" className="px-5 py-3.5">
                    Cliente
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Endereço
                  </th>
                  <th scope="col" className="px-5 py-3.5 whitespace-nowrap">
                    Vigência
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-center whitespace-nowrap">
                    Equipamentos
                  </th>
                  <th scope="col" className="px-5 py-3.5 whitespace-nowrap">
                    Próxima visita
                  </th>
                  <th scope="col" className="px-5 py-3.5 whitespace-nowrap">
                    Situação
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtrados.map(({ plano, infoSituacao }) => (
                  <tr
                    key={plano.id}
                    onClick={() => navigate(`/pmoc/${plano.id}`)}
                    className="cursor-pointer transition hover:bg-slate-50/80"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                          <Building2 size={17} aria-hidden="true" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            {plano.customer_name}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                            <span className="font-mono font-medium text-slate-500">
                              {plano.code}
                            </span>
                            {plano.customer_trade_name && (
                              <span>· {plano.customer_trade_name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="max-w-xs px-5 py-4 text-slate-600">
                      <div className="line-clamp-2">
                        {formatarEnderecoResumo(plano.address_snapshot)}
                      </div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-slate-700">
                      <div>
                        {formatarDataIsoCurta(plano.start_date)} a{' '}
                        {formatarDataIsoCurta(plano.end_date)}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                        <Snowflake size={12} className="text-blue-600" aria-hidden="true" />
                        {plano.equipment_count}
                      </span>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-medium text-slate-800">
                        {formatarMesReferencia(plano.next_visit_month, true)}
                      </div>
                      {plano.overdue_visits_count > 0 && (
                        <div className="mt-0.5 text-[11px] font-semibold text-rose-600">
                          {plano.overdue_visits_count}{' '}
                          {plano.overdue_visits_count === 1
                            ? 'visita atrasada'
                            : 'visitas atrasadas'}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${infoSituacao.classeSelo}`}
                      >
                        {infoSituacao.rotulo}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        aria-label={`Abrir plano ${plano.code} de ${plano.customer_name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/pmoc/${plano.id}`);
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

          {/* Cartões para Celular */}
          <div className="divide-y divide-slate-100 md:hidden">
            {filtrados.map(({ plano, infoSituacao }) => (
              <div
                key={plano.id}
                onClick={() => navigate(`/pmoc/${plano.id}`)}
                className="cursor-pointer space-y-2.5 p-4 transition hover:bg-slate-50/80"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{plano.customer_name}</div>
                    <div className="font-mono text-[11px] text-slate-500">{plano.code}</div>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${infoSituacao.classeSelo}`}
                  >
                    {infoSituacao.rotulo}
                  </span>
                </div>

                <div className="flex items-start gap-1.5 text-xs text-slate-600">
                  <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                  <span>{formatarEnderecoResumo(plano.address_snapshot)}</span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
                  <span>
                    <strong>Vigência:</strong> {formatarDataIsoCurta(plano.start_date)} a{' '}
                    {formatarDataIsoCurta(plano.end_date)}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                    <Snowflake size={12} className="text-blue-600" aria-hidden="true" />
                    {plano.equipment_count} ap.
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">
                    <strong>Próx. visita:</strong>{' '}
                    {formatarMesReferencia(plano.next_visit_month, true)}
                  </span>
                  {plano.overdue_visits_count > 0 && (
                    <span className="font-semibold text-rose-600">
                      {plano.overdue_visits_count} atrasada(s)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            <span>
              {filtrados.length} {filtrados.length === 1 ? 'plano exibido' : 'planos exibidos'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
