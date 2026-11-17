import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  UserCheck,
  Wrench,
} from 'lucide-react';
import FaixaDadosDemo from '../components/pmoc/FaixaDadosDemo';
import { EMPRESA_BRV } from '../components/pmoc/empresa';
import { buscarEquipamentoPublico } from '../components/pmoc/fonteDeDados';
import {
  formatarBtus,
  formatarDataIsoCurta,
  formatarMesReferencia,
  montarLinkWhatsAppPmoc,
} from '../components/pmoc/regrasPmoc';
import type { PmocExecutionRecordStatus, PmocPublicEquipmentView } from '../types/pmoc';

const ESTILOS_STATUS_MANUTENCAO: Record<
  PmocExecutionRecordStatus,
  { rotulo: string; classes: string; ponto: string }
> = {
  concluida: {
    rotulo: 'Concluída',
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    ponto: 'bg-emerald-500',
  },
  nao_atendido: {
    rotulo: 'Não atendido',
    classes: 'border-rose-200 bg-rose-50 text-rose-800',
    ponto: 'bg-rose-500',
  },
  pendente: {
    rotulo: 'Pendente',
    classes: 'border-amber-200 bg-amber-50 text-amber-800',
    ponto: 'bg-amber-500',
  },
};

export default function EquipamentoPublico() {
  const { token = '' } = useParams<{ token: string }>();

  const [dados, setDados] = useState<PmocPublicEquipmentView | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [chaveRecarga, setChaveRecarga] = useState(0);

  useEffect(() => {
    let ativo = true;
    const tokenLimpo = token.trim();

    Promise.resolve()
      .then(() => {
        if (!ativo) return null;
        setDados(undefined);
        setErro(null);
        if (!tokenLimpo) return null;
        return buscarEquipamentoPublico(tokenLimpo);
      })
      .then((resultado) => {
        if (ativo) {
          setDados(resultado ?? null);
        }
      })
      .catch((err) => {
        if (!ativo) return;
        setErro(
          err instanceof Error
            ? err.message
            : 'Não foi possível carregar a ficha pública deste equipamento.',
        );
        setDados(null);
      });

    return () => {
      ativo = false;
    };
  }, [token, chaveRecarga]);

  useEffect(() => {
    if (!dados) return;
    const tituloAnterior = document.title;
    document.title = `${dados.identifier} · ${dados.customer_display_name} · Manutenção PMOC`;
    return () => {
      document.title = tituloAnterior;
    };
  }, [dados]);

  const linkWhatsAppBrv = montarLinkWhatsAppPmoc(
    EMPRESA_BRV.telefone,
    dados
      ? `Olá, equipe BRV! Escancei a etiqueta do aparelho ${dados.identifier} (${dados.environment_name} - ${dados.customer_display_name}) e gostaria de atendimento.`
      : 'Olá, equipe BRV! Escancei uma etiqueta de manutenção PMOC e preciso de atendimento.',
  );

  if (dados === undefined) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 p-6 text-center">
        <Loader2 size={28} className="animate-spin text-blue-600" aria-hidden="true" />
        <p className="mt-3 text-sm font-bold text-slate-700">
          Consultando ficha de manutenção do aparelho...
        </p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <img
            src={EMPRESA_BRV.logoUrl}
            alt={EMPRESA_BRV.nomeCurto}
            className="mx-auto h-11 w-auto object-contain"
          />
          <div className="mx-auto mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertTriangle size={24} aria-hidden="true" />
          </div>
          <h1 className="mt-3 text-base font-bold text-slate-900">
            Não foi possível abrir a ficha do equipamento
          </h1>
          <p className="mt-1.5 text-xs text-slate-600">{erro}</p>

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setChaveRecarga((c) => c + 1)}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-700"
            >
              <RefreshCw size={14} aria-hidden="true" />
              Tentar de novo
            </button>
            <a
              href={linkWhatsAppBrv}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700"
            >
              <MessageCircle size={15} aria-hidden="true" />
              Falar com a BRV no WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <img
            src={EMPRESA_BRV.logoUrl}
            alt={EMPRESA_BRV.nomeCurto}
            className="mx-auto h-11 w-auto object-contain"
          />
          <div className="mx-auto mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <AlertTriangle size={24} aria-hidden="true" />
          </div>
          <h1 className="mt-3 text-base font-bold text-slate-900">
            Etiqueta não encontrada ou inativa
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            Não localizamos um equipamento vinculado a este QR Code. Se precisar de suporte técnico
            ou de uma segunda via da etiqueta, fale direto com a BRV.
          </p>

          <div className="mt-5">
            <a
              href={linkWhatsAppBrv}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700"
            >
              <MessageCircle size={15} aria-hidden="true" />
              Falar com a BRV no WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-12">
      {/* Cabeçalho institucional */}
      <header className="border-b border-slate-200 bg-white shadow-xs">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <img
              src={EMPRESA_BRV.logoUrl}
              alt={EMPRESA_BRV.nomeCurto}
              className="h-9 w-auto object-contain"
            />
            <div>
              <div className="text-xs font-extrabold text-slate-900">
                {EMPRESA_BRV.nomeCurto}
              </div>
              <div className="text-[11px] text-slate-500">
                Conferência Pública de Manutenção PMOC
              </div>
            </div>
          </div>

          <a
            href={linkWhatsAppBrv}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700"
          >
            <MessageCircle size={14} aria-hidden="true" />
            WhatsApp BRV
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 px-4 pt-4">
        <FaixaDadosDemo />

        {/* Cartão principal do aparelho */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-100 bg-slate-900 px-5 py-4 text-white">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  Identificador do aparelho
                </span>
                <h1 className="mt-0.5 font-mono text-2xl font-black tracking-tight text-white">
                  {dados.identifier}
                </h1>
              </div>

              {dados.has_active_plan ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-200">
                  <ShieldCheck size={14} aria-hidden="true" />
                  Plano vigente
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-200">
                  <ShieldAlert size={14} aria-hidden="true" />
                  Sem plano vigente
                </span>
              )}
            </div>

            <p className="mt-2 text-sm font-bold text-slate-200">
              {dados.customer_display_name}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase">
                <MapPin size={13} className="text-blue-600" aria-hidden="true" />
                Ambiente
              </div>
              <div className="mt-1 text-sm font-bold text-slate-900">
                {dados.environment_name}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase">
                <Snowflake size={13} className="text-blue-600" aria-hidden="true" />
                Tipo e capacidade
              </div>
              <div className="mt-1 text-sm font-bold text-slate-900">
                {dados.equipment_type} · {formatarBtus(dados.capacity_btu)}
              </div>
              {(dados.brand || dados.model) && (
                <div className="mt-0.5 text-xs text-slate-500">
                  {[dados.brand, dados.model].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Dados do plano vigente (se houver) */}
        {dados.has_active_plan && dados.active_plan ? (
          <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <ClipboardCheck size={17} className="text-emerald-600" aria-hidden="true" />
                Plano PMOC Ativo ({dados.active_plan.code})
              </h2>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                Lei 13.589/2018
              </span>
            </div>

            <div className="mt-3 space-y-2 text-xs text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-500">
                  <Calendar size={13} aria-hidden="true" />
                  Vigência do plano
                </span>
                <span className="font-bold text-slate-900">
                  <time dateTime={dados.active_plan.start_date}>
                    {formatarDataIsoCurta(dados.active_plan.start_date)}
                  </time>{' '}
                  a{' '}
                  {dados.active_plan.end_date ? (
                    <time dateTime={dados.active_plan.end_date}>
                      {formatarDataIsoCurta(dados.active_plan.end_date)}
                    </time>
                  ) : (
                    'Indeterminada'
                  )}
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <div className="flex items-center gap-1.5 font-semibold text-slate-500">
                  <UserCheck size={13} aria-hidden="true" />
                  Responsável Técnico
                </div>
                <div className="mt-1 font-bold text-slate-900">
                  {dados.active_plan.responsible_name}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-600">
                  {dados.active_plan.registration_type}:{' '}
                  <strong className="font-semibold text-slate-800">
                    {dados.active_plan.registration_number}
                  </strong>
                  {dados.active_plan.responsibility_term_number
                    ? ` · TRT/ART: ${dados.active_plan.responsibility_term_number}`
                    : ''}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
            <div className="flex items-start gap-2.5">
              <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
              <div>
                <p className="font-bold">Este aparelho não possui plano PMOC ativo no momento.</p>
                <p className="mt-0.5 text-amber-800">
                  O histórico das manutenções anteriores permanece disponível abaixo para consulta e
                  fiscalização.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Histórico das últimas manutenções (até 12) */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Wrench size={16} className="text-blue-600" aria-hidden="true" />
                Últimas manutenções
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Registro das últimas intervenções preventivas realizadas neste aparelho (até 12
                meses).
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
              {dados.recent_maintenances.length}
            </span>
          </div>

          {dados.recent_maintenances.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
              Nenhuma manutenção registrada para este equipamento até o momento.
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {dados.recent_maintenances.slice(0, 12).map((item, idx) => {
                const estiloStatus =
                  ESTILOS_STATUS_MANUTENCAO[item.status] ?? ESTILOS_STATUS_MANUTENCAO.pendente;
                return (
                  <div
                    key={`${item.reference_month}-${idx}`}
                    className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 sm:flex-row sm:items-center"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-900 capitalize">
                          {formatarMesReferencia(item.reference_month)}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${estiloStatus.classes}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${estiloStatus.ponto}`}
                          />
                          {estiloStatus.rotulo}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                        <span>
                          Execução:{' '}
                          <strong className="font-semibold text-slate-800">
                            {formatarDataIsoCurta(item.executed_at)}
                          </strong>
                        </span>
                        {item.status === 'concluida' && item.tasks_total_count > 0 && (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 size={12} aria-hidden="true" />
                            {item.tasks_done_count} de {item.tasks_total_count} tarefas feitas
                          </span>
                        )}
                      </div>
                    </div>

                    {item.report_token && (
                      <Link
                        to={`/relatorio-pmoc/${item.report_token}`}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                      >
                        <FileText size={13} aria-hidden="true" />
                        Ver relatório do mês
                        <ExternalLink size={12} aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Rodapé de contato */}
        <footer className="rounded-2xl border border-slate-200 bg-white p-4 text-center text-xs text-slate-500 shadow-xs">
          <div className="font-bold text-slate-800">{EMPRESA_BRV.razaoSocial}</div>
          <div className="mt-0.5">
            CNPJ {EMPRESA_BRV.cnpj} · Tel. {EMPRESA_BRV.telefone}
          </div>
          <div className="mt-3">
            <a
              href={linkWhatsAppBrv}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
            >
              <MessageCircle size={14} aria-hidden="true" />
              Solicitar atendimento técnico para este aparelho
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
