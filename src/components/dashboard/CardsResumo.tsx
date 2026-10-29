import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Zap,
} from 'lucide-react';
import type { ResumoOrdens } from '../../services/dashboard';

interface CardsResumoProps {
  resumo: ResumoOrdens;
}

export default function CardsResumo({ resumo }: CardsResumoProps) {
  const navigate = useNavigate();

  const totalAbertas =
    resumo.porStatus.aberta +
    resumo.porStatus.agendada +
    resumo.porStatus.em_andamento +
    resumo.porStatus.pausada;

  const temAtrasadas = resumo.atrasadas > 0;
  const temUrgentes = resumo.urgentes > 0;

  // Percentuais para a barra de proporção das OS ativas
  const pctAberta = totalAbertas > 0 ? (resumo.porStatus.aberta / totalAbertas) * 100 : 0;
  const pctAgendada = totalAbertas > 0 ? (resumo.porStatus.agendada / totalAbertas) * 100 : 0;
  const pctEmAndamento =
    totalAbertas > 0 ? (resumo.porStatus.em_andamento / totalAbertas) * 100 : 0;
  const pctPausada = totalAbertas > 0 ? (resumo.porStatus.pausada / totalAbertas) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Grade de Cartões Numéricos */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Card 1: Total em Aberto */}
        <button
          type="button"
          onClick={() => navigate('/ordens-de-servico')}
          className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:border-blue-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">OS em aberto</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:scale-105">
              <ClipboardList size={18} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {totalAbertas}
            </span>
            <p className="mt-0.5 text-[11px] text-slate-400">Total não finalizadas</p>
          </div>
        </button>

        {/* Card 2: Em Andamento */}
        <button
          type="button"
          onClick={() => navigate('/ordens-de-servico')}
          className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:border-amber-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Em andamento</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition group-hover:scale-105">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {resumo.porStatus.em_andamento}
            </span>
            <p className="mt-0.5 text-[11px] text-slate-400">Em execução no momento</p>
          </div>
        </button>

        {/* Card 3: Atrasadas (destaque vermelho se > 0) */}
        <button
          type="button"
          onClick={() => navigate('/ordens-de-servico')}
          className={`group flex flex-col justify-between rounded-2xl border p-4 text-left shadow-xs transition hover:shadow-sm ${
            temAtrasadas
              ? 'border-rose-200 bg-rose-50/40 hover:border-rose-300'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-semibold ${
                temAtrasadas ? 'text-rose-700' : 'text-slate-500'
              }`}
            >
              Atrasadas
            </span>
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition group-hover:scale-105 ${
                temAtrasadas ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="mt-3">
            <span
              className={`text-2xl font-bold tracking-tight sm:text-3xl ${
                temAtrasadas ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {resumo.atrasadas}
            </span>
            <p
              className={`mt-0.5 text-[11px] ${
                temAtrasadas ? 'text-rose-600 font-medium' : 'text-slate-400'
              }`}
            >
              {temAtrasadas ? 'Prazo de conclusão vencido' : 'Nenhuma OS atrasada'}
            </p>
          </div>
        </button>

        {/* Card 4: Urgentes (destaque âmbar se > 0) */}
        <button
          type="button"
          onClick={() => navigate('/ordens-de-servico')}
          className={`group flex flex-col justify-between rounded-2xl border p-4 text-left shadow-xs transition hover:shadow-sm ${
            temUrgentes
              ? 'border-amber-200 bg-amber-50/40 hover:border-amber-300'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-semibold ${
                temUrgentes ? 'text-amber-800' : 'text-slate-500'
              }`}
            >
              Urgentes / Alta
            </span>
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition group-hover:scale-105 ${
                temUrgentes ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Zap size={18} />
            </div>
          </div>
          <div className="mt-3">
            <span
              className={`text-2xl font-bold tracking-tight sm:text-3xl ${
                temUrgentes ? 'text-amber-700' : 'text-slate-900'
              }`}
            >
              {resumo.urgentes}
            </span>
            <p
              className={`mt-0.5 text-[11px] ${
                temUrgentes ? 'text-amber-700 font-medium' : 'text-slate-400'
              }`}
            >
              {temUrgentes ? 'Prioridade alta ou urgente' : 'Sem urgências pendentes'}
            </p>
          </div>
        </button>
      </div>

      {/* Barra de Distribuição e Indicador dos Últimos 30 Dias */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        {/* Distribuição por status das abertas */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Composição das OS abertas</span>
            <span>{totalAbertas} no total</span>
          </div>

          {/* Barra proporcional */}
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            {pctAberta > 0 && (
              <div
                style={{ width: `${pctAberta}%` }}
                className="bg-slate-400 transition-all duration-300"
                title={`Abertas: ${resumo.porStatus.aberta}`}
              />
            )}
            {pctAgendada > 0 && (
              <div
                style={{ width: `${pctAgendada}%` }}
                className="bg-blue-500 transition-all duration-300"
                title={`Agendadas: ${resumo.porStatus.agendada}`}
              />
            )}
            {pctEmAndamento > 0 && (
              <div
                style={{ width: `${pctEmAndamento}%` }}
                className="bg-amber-500 transition-all duration-300"
                title={`Em andamento: ${resumo.porStatus.em_andamento}`}
              />
            )}
            {pctPausada > 0 && (
              <div
                style={{ width: `${pctPausada}%` }}
                className="bg-pink-500 transition-all duration-300"
                title={`Pausadas: ${resumo.porStatus.pausada}`}
              />
            )}
          </div>

          {/* Legenda compacta */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              Abertas: <strong className="text-slate-700">{resumo.porStatus.aberta}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Agendadas: <strong className="text-slate-700">{resumo.porStatus.agendada}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Em andamento:{' '}
              <strong className="text-slate-700">{resumo.porStatus.em_andamento}</strong>
            </span>
            {resumo.porStatus.pausada > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-pink-500" />
                Pausadas: <strong className="text-slate-700">{resumo.porStatus.pausada}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Separador no Desktop */}
        <div className="hidden h-10 w-px bg-slate-200 sm:block" />

        {/* Concluídas nos últimos 30 dias */}
        <div className="flex items-center gap-2.5 sm:shrink-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800">
              {resumo.concluidas30dias}{' '}
              {resumo.concluidas30dias === 1 ? 'OS concluída' : 'OS concluídas'}
            </span>
            <p className="text-[11px] text-slate-400">nos últimos 30 dias</p>
          </div>
        </div>
      </div>
    </div>
  );
}
