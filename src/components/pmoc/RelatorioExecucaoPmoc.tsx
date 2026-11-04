import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Printer,
  X,
} from 'lucide-react';
import { EMPRESA_BRV } from './empresa';
import { buscarRelatorioMensal } from './fonteDeDados';
import {
  formatarBtus,
  formatarDataIsoCurta,
  formatarEnderecoDocumento,
  formatarMedicao,
  formatarMesReferencia,
  rotuloPeriodicidade,
  rotuloTermoResponsabilidade,
} from './regrasPmoc';
import type { PmocMonthlyReport, PmocTaskResultStatus } from '../../types/pmoc';
import { formatarDataHora } from '../../utils/ordens';

interface RelatorioExecucaoPmocProps {
  planId: string;
  referenceMonth: string;
  onFechar: () => void;
}

const ESTILO_IMPRESSAO_RELATORIO = `
@media print {
  @page {
    size: A4 portrait;
    margin: 15mm 15mm 18mm 15mm;
  }
  .pmoc-cor-exata {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
`;

const ROTULO_RESULTADO_TAREFA: Record<
  PmocTaskResultStatus,
  { texto: string; classe: string }
> = {
  feito: {
    texto: 'Feito',
    classe: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  nao_feito: {
    texto: 'Não feito',
    classe: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  nao_se_aplica: {
    texto: 'Não se aplica',
    classe: 'border-slate-200 bg-slate-100 text-slate-600',
  },
};

export default function RelatorioExecucaoPmoc({
  planId,
  referenceMonth,
  onFechar,
}: RelatorioExecucaoPmocProps) {
  const [relatorio, setRelatorio] = useState<PmocMonthlyReport | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);
  const [dataEmissao] = useState(() => formatarDataIsoCurta(new Date().toISOString()));

  const recarregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await buscarRelatorioMensal(planId, referenceMonth);
      if (!dados) {
        setErro('Relatório mensal não encontrado para este plano.');
      } else {
        setRelatorio(dados);
      }
    } catch (e) {
      console.error('Erro ao buscar relatório mensal PMOC:', e);
      setErro('Não foi possível carregar o relatório mensal de execução.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    let ativo = true;
    buscarRelatorioMensal(planId, referenceMonth)
      .then((dados) => {
        if (!ativo) return;
        if (!dados) setErro('Relatório mensal não encontrado para este plano.');
        else setRelatorio(dados);
      })
      .catch((e) => {
        if (!ativo) return;
        console.error('Erro ao buscar relatório mensal PMOC:', e);
        setErro('Não foi possível carregar o relatório mensal de execução.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [planId, referenceMonth]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Relatório mensal PMOC ${formatarMesReferencia(referenceMonth)}`}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-100 print:static print:overflow-visible print:bg-white"
    >
      <style>{ESTILO_IMPRESSAO_RELATORIO}</style>

      <div className="min-h-screen pb-14 print:min-h-0 print:pb-0">
        {/* Barra superior de ações (oculta na impressão) */}
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-xs sm:px-6 print:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onFechar}
              aria-label="Voltar"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900">
                Relatório Mensal de Execução · {formatarMesReferencia(referenceMonth)}
              </h1>
              <p className="text-xs text-slate-500">
                Comprovante técnico mensal de manutenção preventiva para entrega ao cliente.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={carregando || Boolean(erro)}
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
            >
              <Printer size={15} aria-hidden="true" />
              Imprimir / PDF
            </button>
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar relatório"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mx-auto mt-6 max-w-4xl px-4 sm:px-6 print:m-0 print:max-w-none print:p-0">
          {carregando ? (
            <div className="flex h-72 items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <Loader2 size={24} className="animate-spin text-blue-600" aria-hidden="true" />
                <span className="text-xs font-medium">Carregando relatório mensal...</span>
              </div>
            </div>
          ) : erro || !relatorio ? (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700"
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{erro || 'Relatório indisponível.'}</span>
              </div>
              <button
                type="button"
                onClick={() => void recarregar()}
                className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 font-semibold text-rose-700 hover:bg-rose-100"
              >
                Tentar de novo
              </button>
            </div>
          ) : (
            <div className="pmoc-cor-exata rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm sm:p-10 print:rounded-none print:border-none print:p-0 print:shadow-none">
              <table className="w-full border-collapse">
                <tbody>
                  <tr>
                    <td className="p-0 align-top">
                      {/* Cabeçalho do Relatório Mensal */}
                      <header className="border-b-2 border-[#0B1E3F] pb-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={EMPRESA_BRV.logoUrl}
                              alt="Logo BRV Control"
                              className="pmoc-cor-exata h-12 w-auto rounded-lg bg-[#0B1E3F] p-1.5 object-contain"
                            />
                            <div>
                              <div className="text-xs font-bold tracking-wider text-blue-800 uppercase">
                                {EMPRESA_BRV.razaoSocial}
                              </div>
                              <h2 className="text-lg font-extrabold text-[#0B1E3F] sm:text-xl">
                                RELATÓRIO MENSAL DE EXECUÇÃO — PMOC
                              </h2>
                            </div>
                          </div>

                          <div className="text-right text-xs">
                            <div className="inline-block rounded border border-slate-300 bg-slate-50 px-2.5 py-1 font-mono font-bold text-slate-800">
                              {relatorio.plan.code}
                            </div>
                            <div className="mt-1 font-bold text-[#0B1E3F]">
                              Ref.: {formatarMesReferencia(relatorio.reference_month)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-2 rounded-lg border border-slate-300 bg-slate-50 p-3.5 text-xs sm:grid-cols-2 print:grid-cols-2">
                          <div>
                            <strong>Cliente:</strong> {relatorio.plan.customer_name}
                          </div>
                          <div>
                            <strong>Vigência do plano:</strong>{' '}
                            {formatarDataIsoCurta(relatorio.plan.start_date)} a{' '}
                            {formatarDataIsoCurta(relatorio.plan.end_date)}
                          </div>
                          <div className="sm:col-span-2 print:col-span-2">
                            <strong>Endereço:</strong>{' '}
                            {formatarEnderecoDocumento(relatorio.plan.address_snapshot)}
                          </div>
                          <div>
                            <strong>Técnico executor:</strong>{' '}
                            {relatorio.technician_name || 'Não registrado'}
                          </div>
                          <div>
                            <strong>Data da execução / OS:</strong>{' '}
                            {relatorio.executed_at
                              ? formatarDataHora(relatorio.executed_at)
                              : 'Pendente'}
                            {relatorio.service_order_number
                              ? ` · OS #${relatorio.service_order_number}`
                              : ''}
                          </div>
                        </div>
                      </header>

                      {/* Equipamentos Atendidos */}
                      <section className="mt-6 space-y-5">
                        <h3 className="pmoc-cor-exata border border-[#0B1E3F] bg-[#0B1E3F] px-3.5 py-2 text-xs font-bold tracking-wide text-white uppercase">
                          Equipamentos atendidos no mês ({relatorio.attended_equipments.length})
                        </h3>

                        {relatorio.attended_equipments.length === 0 ? (
                          <div className="rounded-lg border border-slate-300 p-4 text-center text-xs italic text-slate-500">
                            Nenhum equipamento consta como concluído neste mês de referência.
                          </div>
                        ) : (
                          relatorio.attended_equipments.map(
                            ({ equipment, letter, environment_name, execution }) => (
                              <div
                                key={equipment.id}
                                className="overflow-hidden rounded-lg border border-slate-300 print:break-inside-avoid"
                              >
                                <div className="pmoc-cor-exata flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 bg-[#F3F3F3] px-3.5 py-2.5 text-xs">
                                  <div className="font-bold text-slate-900">
                                    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded bg-[#0B1E3F] text-[11px] font-extrabold text-white">
                                      {letter}
                                    </span>
                                    {equipment.name} ·{' '}
                                    <span className="font-mono">{equipment.identifier}</span>
                                  </div>
                                  <div className="text-slate-700">
                                    {environment_name ? `${environment_name} · ` : ''}
                                    {equipment.equipment_type} ·{' '}
                                    {formatarBtus(equipment.capacity_btu)}
                                  </div>
                                </div>

                                {/* Medições aferidas */}
                                <div className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs sm:grid-cols-4 print:grid-cols-4">
                                  <div>
                                    <span className="block text-[10px] font-semibold text-slate-500 uppercase">
                                      Corrente elétrica
                                    </span>
                                    <span className="font-bold text-slate-900">
                                      {formatarMedicao(execution.measurements.current_a, 'A')}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] font-semibold text-slate-500 uppercase">
                                      Temp. insuflamento
                                    </span>
                                    <span className="font-bold text-slate-900">
                                      {formatarMedicao(execution.measurements.temp_supply_c, '°C')}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] font-semibold text-slate-500 uppercase">
                                      Temp. retorno
                                    </span>
                                    <span className="font-bold text-slate-900">
                                      {formatarMedicao(execution.measurements.temp_return_c, '°C')}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] font-semibold text-slate-500 uppercase">
                                      Temp. ambiente
                                    </span>
                                    <span className="font-bold text-slate-900">
                                      {formatarMedicao(execution.measurements.temp_ambient_c, '°C')}
                                    </span>
                                  </div>
                                </div>

                                {/* Checklist de tarefas do mês */}
                                <table className="w-full border-collapse text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-200 bg-white text-slate-600">
                                      <th
                                        scope="col"
                                        className="w-10 border-r border-slate-200 px-2 py-1.5 text-center font-semibold"
                                      >
                                        #
                                      </th>
                                      <th scope="col" className="px-3 py-1.5 text-left font-semibold">
                                        Tarefa preventiva do mês
                                      </th>
                                      <th
                                        scope="col"
                                        className="w-24 border-l border-slate-200 px-2 py-1.5 text-center font-semibold"
                                      >
                                        Período
                                      </th>
                                      <th
                                        scope="col"
                                        className="w-28 border-l border-slate-200 px-2 py-1.5 text-center font-semibold"
                                      >
                                        Resultado
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200">
                                    {execution.task_results.map((item, idx) => {
                                      const infoRes = ROTULO_RESULTADO_TAREFA[item.result];
                                      return (
                                        <tr key={`${item.equipment_task_id}-${idx}`}>
                                          <td className="border-r border-slate-200 px-2 py-1.5 text-center text-slate-500">
                                            {idx + 1}
                                          </td>
                                          <td className="px-3 py-1.5 text-slate-800">
                                            {item.description}
                                          </td>
                                          <td className="border-l border-slate-200 px-2 py-1.5 text-center text-slate-600">
                                            {rotuloPeriodicidade(item.periodicity)}
                                          </td>
                                          <td className="border-l border-slate-200 px-2 py-1.5 text-center">
                                            <span
                                              className={`pmoc-cor-exata inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${infoRes.classe}`}
                                            >
                                              {infoRes.texto}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>

                                {/* Observações do técnico e fotos */}
                                {(execution.technician_notes || execution.photo_urls.length > 0) && (
                                  <div className="space-y-2.5 border-t border-slate-200 bg-slate-50/50 px-3.5 py-3 text-xs">
                                    {execution.technician_notes && (
                                      <p className="text-slate-700">
                                        <strong>Observações do técnico:</strong>{' '}
                                        {execution.technician_notes}
                                      </p>
                                    )}

                                    {execution.photo_urls.length > 0 && (
                                      <div className="flex flex-wrap gap-2.5 pt-1">
                                        {execution.photo_urls.map((url, idxFoto) => (
                                          <img
                                            key={idxFoto}
                                            src={url}
                                            alt={`Foto ${idxFoto + 1} do aparelho ${equipment.identifier}`}
                                            onClick={() => setFotoAmpliada(url)}
                                            className="h-20 w-28 cursor-pointer rounded border border-slate-300 bg-white object-cover print:cursor-default"
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ),
                          )
                        )}
                      </section>

                      {/* Equipamentos Não Atendidos */}
                      {relatorio.unattended_equipments.length > 0 && (
                        <section className="mt-6 print:break-inside-avoid">
                          <h3 className="pmoc-cor-exata flex items-center gap-2 border border-amber-800 bg-amber-700 px-3.5 py-2 text-xs font-bold tracking-wide text-white uppercase">
                            <AlertTriangle size={14} aria-hidden="true" />
                            Não atendidos ({relatorio.unattended_equipments.length})
                          </h3>
                          <table className="w-full border-collapse border border-t-0 border-slate-300 text-xs">
                            <thead>
                              <tr className="pmoc-cor-exata bg-amber-50 text-slate-800">
                                <th
                                  scope="col"
                                  className="w-1/3 border border-slate-300 px-3 py-2 text-left font-bold"
                                >
                                  Equipamento
                                </th>
                                <th
                                  scope="col"
                                  className="w-1/4 border border-slate-300 px-3 py-2 text-left font-bold"
                                >
                                  Ambiente
                                </th>
                                <th
                                  scope="col"
                                  className="border border-slate-300 px-3 py-2 text-left font-bold"
                                >
                                  Motivo
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {relatorio.unattended_equipments.map(
                                ({ equipment, letter, environment_name, reason }) => (
                                  <tr key={equipment.id}>
                                    <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-900">
                                      {letter} · {equipment.name} ({equipment.identifier})
                                    </td>
                                    <td className="border border-slate-300 px-3 py-2 text-slate-700">
                                      {environment_name || '—'}
                                    </td>
                                    <td className="border border-slate-300 px-3 py-2 text-slate-700">
                                      {reason}
                                    </td>
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </section>
                      )}

                      {/* Bloco final: Responsável Técnico e Assinatura */}
                      <section className="mt-8 rounded-lg border border-slate-300 p-5 text-xs print:break-inside-avoid">
                        <div className="flex items-center gap-1.5 font-bold text-[#0B1E3F] uppercase">
                          <CheckCircle2 size={14} aria-hidden="true" />
                          Responsável técnico pelo PMOC
                        </div>
                        <div className="mt-2 grid grid-cols-1 gap-1.5 text-slate-700 sm:grid-cols-2 print:grid-cols-2">
                          <div>
                            <strong>Nome:</strong> {relatorio.plan.responsible_name || '—'}
                          </div>
                          <div>
                            <strong>
                              Registro ({relatorio.plan.registration_type}) /{' '}
                              {rotuloTermoResponsabilidade(relatorio.plan.registration_type)}:
                            </strong>{' '}
                            {relatorio.plan.registration_number || '—'} ·{' '}
                            {relatorio.plan.responsibility_term_number || '—'}
                          </div>
                        </div>

                        <div className="mt-12 text-center">
                          <div className="mx-auto max-w-xs border-t border-slate-800 pt-1.5 font-semibold text-slate-800">
                            Assinatura do responsável técnico
                          </div>
                        </div>
                      </section>
                    </td>
                  </tr>
                </tbody>

                <tfoot className="hidden print:table-footer-group">
                  <tr>
                    <td className="h-9" />
                  </tr>
                </tfoot>
              </table>

              <footer className="mt-8 border-t border-slate-300 pt-2.5 text-center text-[10px] text-slate-500 print:fixed print:inset-x-0 print:bottom-0 print:mt-0 print:bg-white print:pt-1.5">
                Emitido em {dataEmissao} pela plataforma BRV Control · {EMPRESA_BRV.razaoSocial}
              </footer>
            </div>
          )}
        </div>

        {fotoAmpliada && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 print:hidden"
            onClick={() => setFotoAmpliada(null)}
          >
            <div className="relative max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setFotoAmpliada(null)}
                aria-label="Fechar foto ampliada"
                className="absolute -top-10 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40"
              >
                <X size={18} aria-hidden="true" />
              </button>
              <img
                src={fotoAmpliada}
                alt="Foto ampliada da manutenção"
                className="max-h-[85vh] max-w-full rounded-xl bg-white object-contain p-2 shadow-2xl"
              />
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

