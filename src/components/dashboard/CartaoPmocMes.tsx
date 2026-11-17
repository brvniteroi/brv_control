import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileCheck2,
} from 'lucide-react';
import { resumoDoMes } from '../pmoc/fonteDeDados';
import { formatarMesReferencia, mesAtualLocal } from '../pmoc/regrasPmoc';
import type { PmocMonthSummary } from '../../types/pmoc';

/**
 * Cartão "PMOC do mês" no Dashboard (só admin e escritório).
 * Exibe os 4 contadores do mês atual e leva ao painel `/pmoc?aba=mes`.
 * Se não houver nenhum plano vigente (`active_plans_total === 0`), não aparece.
 */
export default function CartaoPmocMes() {
  const navigate = useNavigate();
  const [mesAtual] = useState(() => mesAtualLocal());
  const [resumo, setResumo] = useState<PmocMonthSummary | null>(null);

  useEffect(() => {
    let ativo = true;
    resumoDoMes(mesAtual)
      .then((dados) => {
        if (ativo) setResumo(dados);
      })
      .catch(() => {
        // Quando a função do banco ainda não estiver publicada ou se falhar em segundo plano, oculta sem quebrar o Dashboard
        if (ativo) setResumo(null);
      });
    return () => {
      ativo = false;
    };
  }, [mesAtual]);

  if (!resumo || resumo.active_plans_total === 0) {
    return null;
  }

  const { sem_os, os_agendada, executada, atrasada } = resumo.counts;

  return (
    <section
      aria-label="PMOC do mês"
      onClick={() => navigate('/pmoc?aba=mes')}
      className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-blue-300 hover:shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <FileCheck2 size={18} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              PMOC do mês · {formatarMesReferencia(mesAtual)}
            </h2>
            <p className="text-[11px] text-slate-500">
              {resumo.active_plans_total}{' '}
              {resumo.active_plans_total === 1 ? 'plano vigente' : 'planos vigentes'} · toque para abrir o painel mensal
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate('/pmoc?aba=mes');
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
        >
          <span>Abrir painel do mês</span>
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/50 px-3 py-2.5">
          <Clock size={17} className="shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <div className="text-[11px] font-medium text-amber-900">Sem OS</div>
            <div className="text-lg font-extrabold text-amber-800">{sem_os}</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/50 px-3 py-2.5">
          <CalendarClock size={17} className="shrink-0 text-blue-600" aria-hidden="true" />
          <div>
            <div className="text-[11px] font-medium text-blue-900">Agendados</div>
            <div className="text-lg font-extrabold text-blue-800">{os_agendada}</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-3 py-2.5">
          <CheckCircle2 size={17} className="shrink-0 text-emerald-600" aria-hidden="true" />
          <div>
            <div className="text-[11px] font-medium text-emerald-900">Executados</div>
            <div className="text-lg font-extrabold text-emerald-800">{executada}</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200/80 bg-rose-50/50 px-3 py-2.5">
          <AlertTriangle size={17} className="shrink-0 text-rose-600" aria-hidden="true" />
          <div>
            <div className="text-[11px] font-medium text-rose-900">Atrasados</div>
            <div className="text-lg font-extrabold text-rose-700">{atrasada}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

