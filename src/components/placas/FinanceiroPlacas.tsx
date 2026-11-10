import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Award,
  BarChart3,
  Clock,
  DollarSign,
  ExternalLink,
  Loader2,
  Lock,
  RotateCcw,
  TrendingUp,
  Undo2,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import type { BoardOrder } from '../../types/placas';
import { podeVerFinanceiroPlacas } from '../../utils/acessoPlacas';
import { valorEmReais } from '../../utils/oficina';
import { formatarData } from '../../utils/ordens';
import { listarPlacasParaFinanceiro } from './fonteDeDados';
import ModalDialogoPlacas from './ModalDialogoPlacas';
import {
  calcularFinanceiroPlacas,
  valorEstornoPlaca,
  valorReceitaPlaca,
  type MesFinanceiroPlacas,
} from './regrasPlacas';

const ANO_ATUAL_PADRAO = new Date().getFullYear();

export default function FinanceiroPlacas() {
  const { profile } = useAuth();
  const autorizado = podeVerFinanceiroPlacas(profile);

  const [ano, setAno] = useState<number>(ANO_ATUAL_PADRAO);
  const [dataReferencia] = useState<Date>(() => new Date());
  const [placas, setPlacas] = useState<BoardOrder[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [chaveRecarga, setChaveRecarga] = useState(0);
  const [mesDetalhe, setMesDetalhe] = useState<MesFinanceiroPlacas | null>(null);

  const anosDisponiveis = [ANO_ATUAL_PADRAO, ANO_ATUAL_PADRAO - 1, ANO_ATUAL_PADRAO - 2];

  useEffect(() => {
    if (!autorizado) return;
    let cancelado = false;
    Promise.resolve()
      .then(() => {
        if (cancelado) return null;
        setCarregando(true);
        setErroCarga(null);
        return listarPlacasParaFinanceiro(ano);
      })
      .then((lista) => {
        if (cancelado || !lista) return;
        setPlacas(lista);
      })
      .catch((err) => {
        if (!cancelado) {
          setErroCarga(
            err instanceof Error
              ? err.message
              : 'Não foi possível carregar os indicadores financeiros.',
          );
        }
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [autorizado, ano, chaveRecarga]);

  const consolidado = useMemo(
    () => calcularFinanceiroPlacas(placas, ano, dataReferencia),
    [placas, ano, dataReferencia],
  );

  // Tela limpa de Acesso Restrito para qualquer perfil sem `board_finance_access === true`
  if (!autorizado) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xs space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <Lock size={22} aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-extrabold text-slate-900">Acesso restrito</h1>
          <p className="text-xs leading-relaxed text-slate-600">
            O painel financeiro do laboratório de placas é restrito aos perfis habilitados com permissão específica de gestão financeira.
          </p>
        </div>
        <Link
          to="/placas"
          className="inline-flex items-center justify-center rounded-xl bg-brv-navy px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Voltar para Reparos (Kanban)
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho + Seletor de Ano */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brv-navy text-white">
            <DollarSign size={18} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
              Financeiro de Placas
            </h1>
            <p className="text-xs text-slate-500">
              Receita líquida por data de entrega, ticket médio, reembolsos e giro de bancada.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="placas-fin-ano" className="text-xs font-semibold text-slate-600">
            Ano de competência:
          </label>
          <select
            id="placas-fin-ano"
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
          >
            {anosDisponiveis.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {carregando ? (
        <div className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white py-16 text-slate-500">
          <Loader2 size={24} className="animate-spin text-blue-600" aria-hidden="true" />
          <p className="text-sm font-medium">Calculando indicadores financeiros de {ano}...</p>
        </div>
      ) : erroCarga ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 py-12 text-center"
        >
          <p className="text-sm font-semibold text-rose-900">{erroCarga}</p>
          <button
            type="button"
            onClick={() => setChaveRecarga((c) => c + 1)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>Tentar de novo</span>
          </button>
        </div>
      ) : (
        <>
          {/* 5 Cartões no topo */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Faturamento do mês</span>
                <DollarSign size={15} className="text-emerald-600" aria-hidden="true" />
              </div>
              <p className="mt-2 text-xl font-extrabold text-slate-900">
                {valorEmReais(consolidado.faturamentoMes)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {consolidado.mesReferenciaNome} · {consolidado.qtdEntreguesMes} entregue(s)
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Ticket médio do mês</span>
                <TrendingUp size={15} className="text-blue-600" aria-hidden="true" />
              </div>
              <p className="mt-2 text-xl font-extrabold text-slate-900">
                {valorEmReais(consolidado.ticketMedioMes)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Média anual: {valorEmReais(consolidado.ticketMedioAno)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Valor na bancada (em aberto)</span>
                <Wrench size={15} className="text-indigo-600" aria-hidden="true" />
              </div>
              <p className="mt-2 text-xl font-extrabold text-slate-900">
                {valorEmReais(consolidado.valorBancadaAberto)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {consolidado.qtdBancadaAberta} placa(s) ativa(s) no Kanban
              </p>
            </div>

            <div
              className={`rounded-2xl border p-4 shadow-2xs ${
                consolidado.qtdEncalhadas > 0
                  ? 'border-rose-200 bg-rose-50/50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>Placas encalhadas</span>
                <Clock
                  size={15}
                  className={consolidado.qtdEncalhadas > 0 ? 'text-rose-600' : 'text-slate-400'}
                  aria-hidden="true"
                />
              </div>
              <p
                className={`mt-2 text-xl font-extrabold ${
                  consolidado.qtdEncalhadas > 0 ? 'text-rose-800' : 'text-slate-900'
                }`}
              >
                {consolidado.qtdEncalhadas}
              </p>
              <p className="mt-1 text-[11px] text-slate-600">
                Paradas há ≥ 4 dias (exceto Pronto)
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
                <span>Total do ano ({ano})</span>
                <BarChart3 size={15} className="text-emerald-700" aria-hidden="true" />
              </div>
              <p className="mt-2 text-xl font-extrabold text-emerald-950">
                {valorEmReais(consolidado.totalAno)}
              </p>
              <p className="mt-1 text-[11px] text-emerald-800">
                {consolidado.qtdEntreguesAno} placa(s) faturada(s) líquidas
              </p>
            </div>
          </div>

          {/* Resumo anual de reembolsos */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-2xs text-xs">
            <div className="flex items-center gap-2.5">
              <Undo2 size={16} className="text-rose-600" aria-hidden="true" />
              <span className="font-semibold text-slate-800">
                Resumo de reembolsos em {ano}:
              </span>
              <span className="text-slate-600">
                <strong>{consolidado.qtdReembolsosAno}</strong> placa(s) reembolsada(s) (já descontadas do faturamento líquido)
              </span>
            </div>
            <span className="font-mono text-sm font-bold text-rose-700">
              {valorEmReais(consolidado.totalReembolsosAno)}
            </span>
          </div>

          {/* Gráfico mensal de colunas em HTML/CSS + Tabela mensal semântica */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-2xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Faturamento mensal ({ano})
                </h2>
                <p className="text-xs text-slate-500">
                  Clique em qualquer mês para listar as placas entregues e reembolsos do período.
                </p>
              </div>
              <span className="text-[11px] font-medium text-slate-400">
                Regra: competência pela data de saída (Entregue / Faturado)
              </span>
            </div>

            {/* Gráfico de colunas em HTML/CSS */}
            <div
              role="group"
              aria-label={`Gráfico de colunas de faturamento mensal em ${ano}`}
              className="grid grid-cols-6 gap-2 pt-4 sm:grid-cols-12 sm:gap-2.5"
            >
              {consolidado.meses.map((mes) => {
                const proporcao =
                  consolidado.maiorFaturamentoMensal > 0
                    ? Math.max(6, Math.round((mes.faturamento / consolidado.maiorFaturamentoMensal) * 100))
                    : 0;
                const ehMesRef = mes.mesIndice === consolidado.mesReferenciaIndice;
                const temMovimento = mes.qtdEntregues > 0 || mes.qtdReembolsos > 0;

                return (
                  <button
                    key={mes.mesIndice}
                    type="button"
                    onClick={() => setMesDetalhe(mes)}
                    aria-label={`${mes.nomeCompleto}: ${valorEmReais(mes.faturamento)}, ${mes.qtdEntregues} placas entregues`}
                    className={`group flex flex-col items-center rounded-xl border p-2 transition focus-visible:outline-2 focus-visible:outline-blue-600 ${
                      ehMesRef
                        ? 'border-blue-200 bg-blue-50/40'
                        : 'border-slate-100 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="mb-1 text-[10px] font-bold text-slate-600">
                      {mes.faturamento > 0
                        ? `R$ ${Math.round(mes.faturamento).toLocaleString('pt-BR')}`
                        : '—'}
                    </span>
                    <div className="flex h-28 w-full items-end justify-center rounded-lg bg-slate-100/80 px-1.5 py-1">
                      <div
                        style={{ height: mes.faturamento > 0 ? `${proporcao}%` : '4px' }}
                        className={`w-full max-w-[26px] rounded-t-md transition-all ${
                          mes.faturamento > 0
                            ? ehMesRef
                              ? 'bg-blue-600 group-hover:bg-blue-700'
                              : 'bg-brv-navy group-hover:bg-blue-700'
                            : 'bg-slate-300'
                        }`}
                      />
                    </div>
                    <span className="mt-1.5 text-xs font-bold text-slate-800">
                      {mes.nomeCurto}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {temMovimento ? `${mes.qtdEntregues} pl.` : '0'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tabela mensal acessível */}
            <div
              role="region"
              aria-label={`Tabela mensal de faturamento de ${ano}`}
              tabIndex={0}
              className="overflow-x-auto rounded-xl border border-slate-200"
            >
              <table className="w-full text-left text-xs">
                <caption className="sr-only">
                  Detalhamento mensal de placas entregues, faturamento líquido, ticket médio e reembolsos em {ano}
                </caption>
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-semibold">
                      Mês
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-semibold text-right">
                      Entregues
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-semibold text-right">
                      Faturamento líquido
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-semibold text-right">
                      Ticket médio
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-semibold text-right">
                      Reembolsos
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-semibold text-right">
                      Detalhe
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {consolidado.meses.map((mes) => (
                    <tr key={mes.mesIndice} className="hover:bg-slate-50/80">
                      <th scope="row" className="px-4 py-2.5 font-semibold text-slate-900">
                        {mes.nomeCompleto}
                      </th>
                      <td className="px-4 py-2.5 text-right text-slate-700">
                        {mes.qtdEntregues}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                        {valorEmReais(mes.faturamento)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700">
                        {mes.qtdEntregues > 0 ? valorEmReais(mes.ticketMedio) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-rose-700">
                        {mes.qtdReembolsos > 0
                          ? `${mes.qtdReembolsos} (${valorEmReais(mes.totalReembolsos)})`
                          : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setMesDetalhe(mes)}
                          className="font-semibold text-blue-700 hover:underline"
                        >
                          Ver placas
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Rankings: Top 5 Marcas & Top 5 Defeitos */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3.5">
              <div className="flex items-center gap-2">
                <Award size={17} className="text-blue-600" aria-hidden="true" />
                <h2 className="text-sm font-bold text-slate-900">
                  Top 5 marcas mais atendidas ({ano})
                </h2>
              </div>
              {consolidado.rankingMarcas.length === 0 ? (
                <p className="text-xs text-slate-500">Sem placas registradas neste ano.</p>
              ) : (
                <ol className="space-y-3">
                  {consolidado.rankingMarcas.map((item, idx) => (
                    <li key={item.rotulo} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800">
                          {idx + 1}. {item.rotulo}
                        </span>
                        <span className="text-slate-600">
                          <strong>{item.quantidade}</strong> ({Math.round(item.percentual)}%)
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          style={{ width: `${Math.max(6, Math.round(item.percentual))}%` }}
                          className="h-full rounded-full bg-blue-600"
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3.5">
              <div className="flex items-center gap-2">
                <AlertTriangle size={17} className="text-amber-600" aria-hidden="true" />
                <h2 className="text-sm font-bold text-slate-900">
                  Top 5 defeitos e códigos de erro ({ano})
                </h2>
              </div>
              {consolidado.rankingDefeitos.length === 0 ? (
                <p className="text-xs text-slate-500">Sem placas registradas neste ano.</p>
              ) : (
                <ol className="space-y-3">
                  {consolidado.rankingDefeitos.map((item, idx) => (
                    <li key={item.rotulo} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-slate-800">
                          {idx + 1}. {item.rotulo}
                        </span>
                        <span className="shrink-0 text-slate-600">
                          <strong>{item.quantidade}</strong> ({Math.round(item.percentual)}%)
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          style={{ width: `${Math.max(6, Math.round(item.percentual))}%` }}
                          className="h-full rounded-full bg-amber-500"
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </>
      )}

      {/* Modal: Detalhe das placas do mês clicado */}
      <ModalDialogoPlacas
        aberto={!!mesDetalhe}
        onFechar={() => setMesDetalhe(null)}
        titulo={mesDetalhe ? `${mesDetalhe.nomeCompleto} de ${ano}` : 'Detalhe do mês'}
        subtitulo={
          mesDetalhe
            ? `Faturamento líquido: ${valorEmReais(mesDetalhe.faturamento)} · ${mesDetalhe.qtdEntregues} entregue(s)`
            : undefined
        }
        larguraMax="max-w-3xl"
      >
        {mesDetalhe && (
          <div className="space-y-5 text-xs">
            <div className="space-y-2">
              <h3 className="font-bold uppercase tracking-wider text-slate-600">
                Placas entregues e faturadas ({mesDetalhe.placasEntregues.length})
              </h3>
              {mesDetalhe.placasEntregues.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-500">
                  Nenhuma placa entregue faturada neste mês.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                  {mesDetalhe.placasEntregues.map((pl) => (
                    <div
                      key={pl.id}
                      className="flex flex-wrap items-center justify-between gap-2 p-3"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          <span className="font-mono">{pl.board_number}</span> · {pl.customer_name}
                        </p>
                        <p className="text-slate-500">
                          {pl.brand_model} · Saída em {formatarData(pl.finished_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-emerald-800">
                          {valorEmReais(valorReceitaPlaca(pl))}
                        </span>
                        <Link
                          to={`/placas?placa=${pl.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-blue-800 hover:bg-blue-100"
                        >
                          <span>Abrir</span>
                          <ExternalLink size={12} aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {mesDetalhe.placasReembolsadas.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold uppercase tracking-wider text-rose-700">
                  Placas reembolsadas neste mês ({mesDetalhe.placasReembolsadas.length})
                </h3>
                <div className="divide-y divide-rose-100 rounded-xl border border-rose-200 bg-rose-50/40">
                  {mesDetalhe.placasReembolsadas.map((pl) => (
                    <div
                      key={pl.id}
                      className="flex flex-wrap items-center justify-between gap-2 p-3"
                    >
                      <div>
                        <p className="font-semibold text-rose-950">
                          <span className="font-mono">{pl.board_number}</span> · {pl.customer_name}
                        </p>
                        <p className="text-rose-800">
                          Motivo: {pl.refund_reason || 'Não informado'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-rose-800">
                          - {valorEmReais(valorEstornoPlaca(pl))}
                        </span>
                        <Link
                          to={`/placas?placa=${pl.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-white px-2.5 py-1 font-semibold text-rose-800 hover:bg-rose-100"
                        >
                          <span>Abrir</span>
                          <ExternalLink size={12} aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ModalDialogoPlacas>
    </div>
  );
}

