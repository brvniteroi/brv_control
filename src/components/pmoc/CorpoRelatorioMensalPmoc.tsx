import QrCodeImagem from './QrCodeImagem';
import { useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  QrCode,
  UserCheck,
  X,
} from 'lucide-react';
import type { PmocMonthlyReport, PmocTaskResultStatus } from '../../types/pmoc';
import { formatarDataHora } from '../../utils/ordens';
import { EMPRESA_BRV } from './empresa';
import {
  formatarBtus,
  formatarDataIsoCurta,
  formatarEnderecoDocumento,
  formatarMedicao,
  formatarMesReferencia,
  linkPublicoRelatorioPmoc,
  rotuloPeriodicidade,
  rotuloTermoResponsabilidade,
} from './regrasPmoc';

export const ESTILO_IMPRESSAO_RELATORIO_PMOC = `
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

interface CorpoRelatorioMensalPmocProps {
  relatorio: PmocMonthlyReport;
  dataEmissao?: string;
}

/**
 * Corpo compartilhado do Relatório Mensal de Execução do PMOC (Entrega 4).
 * Usado tanto pelo modal interno do escritório (`RelatorioExecucaoPmoc`) quanto
 * pela página pública sem login (`RelatorioPmocPublico` em `/relatorio-pmoc/:token`).
 */
export default function CorpoRelatorioMensalPmoc({
  relatorio,
  dataEmissao: dataEmissaoProp,
}: CorpoRelatorioMensalPmocProps) {
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);
  const [dataEmissaoPadrao] = useState(() => formatarDataIsoCurta(new Date().toISOString()));
  const dataEmissao = dataEmissaoProp ?? dataEmissaoPadrao;

  const linkConferencia = relatorio.public_token
    ? linkPublicoRelatorioPmoc(relatorio.public_token)
    : null;

  return (
    <>
      <div className="pmoc-cor-exata rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm sm:p-10 print:rounded-none print:border-none print:p-0 print:shadow-none">
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
                      {relatorio.executed_at ? formatarDataHora(relatorio.executed_at) : 'Pendente'}
                      {relatorio.service_order_number
                        ? ` · OS #${relatorio.service_order_number}`
                        : ''}
                    </div>
                    <div className="sm:col-span-2 print:col-span-2 flex items-center gap-1.5 border-t border-slate-200 pt-2 text-slate-900">
                      <UserCheck size={14} className="shrink-0 text-[#0B1E3F]" aria-hidden="true" />
                      <span>
                        <strong>Visita acompanhada por:</strong>{' '}
                        {relatorio.accompanied_by || 'Não informado'}
                      </span>
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
                              {equipment.equipment_type} · {formatarBtus(equipment.capacity_btu)}
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
                                      <div>{item.description}</div>
                                      {item.notes && (
                                        <div className="mt-0.5 text-[11px] font-medium text-rose-700">
                                          Obs.: {item.notes}
                                        </div>
                                      )}
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

                          {/* Observações do técnico e Galeria de fotos do aparelho */}
                          {(execution.technician_notes || execution.photo_urls.length > 0) && (
                            <div className="space-y-2.5 border-t border-slate-200 bg-slate-50/50 px-3.5 py-3 text-xs">
                              {execution.technician_notes && (
                                <p className="text-slate-700">
                                  <strong>Observações do aparelho:</strong>{' '}
                                  {execution.technician_notes}
                                </p>
                              )}

                              {execution.photo_urls.length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase">
                                    <Camera size={13} aria-hidden="true" />
                                    <span>
                                      Galeria de fotos do aparelho ({execution.photo_urls.length})
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-2.5">
                                    {execution.photo_urls.map((url, idxFoto) => (
                                      <button
                                        key={`${url}-${idxFoto}`}
                                        type="button"
                                        onClick={() => setFotoAmpliada(url)}
                                        className="overflow-hidden rounded-lg border border-slate-300 bg-white transition hover:scale-105 print:cursor-default"
                                      >
                                        <img
                                          src={url}
                                          alt={`Foto ${idxFoto + 1} do aparelho ${equipment.identifier}`}
                                          className="h-20 w-28 object-cover"
                                        />
                                      </button>
                                    ))}
                                  </div>
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

                {/* Bloco final: Responsável Técnico, Assinatura e QR de Conferência */}
                <section className="mt-8 rounded-lg border border-slate-300 p-5 text-xs print:break-inside-avoid">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-[#0B1E3F] uppercase">
                        <CheckCircle2 size={14} aria-hidden="true" />
                        Responsável técnico pelo PMOC
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 text-slate-700 sm:grid-cols-2 print:grid-cols-2">
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
                        <div className="sm:col-span-2 print:col-span-2">
                          <strong>Visita acompanhada por:</strong>{' '}
                          {relatorio.accompanied_by || 'Não informado'}
                        </div>
                      </div>

                      <div className="pt-8 text-center sm:max-w-xs">
                        <div className="border-t border-slate-800 pt-1.5 font-semibold text-slate-800">
                          Assinatura do responsável técnico
                        </div>
                      </div>
                    </div>

                    {/* QR de conferência: abre o próprio relatório online (só existe depois que o link do mês é gerado) */}
                    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-3 text-center sm:w-44">
                      {linkConferencia ? (
                        <QrCodeImagem valor={linkConferencia} tamanho={88} alt="QR Code para conferir este relatório online" className="rounded-lg bg-white" />
                      ) : (
                        <div className="flex h-20 w-20 flex-col items-center justify-center rounded-lg border border-dashed border-slate-400 bg-white text-slate-500">
                          <QrCode size={28} aria-hidden="true" />
                          <span className="mt-1 text-[9px] font-bold uppercase">
                            QR de conferência
                          </span>
                        </div>
                      )}
                      <span className="mt-1.5 text-[10px] font-semibold text-slate-600">
                        Autenticidade online
                      </span>
                      {linkConferencia && (
                        <span className="mt-0.5 max-w-[150px] break-all font-mono text-[9px] text-slate-400">
                          {linkConferencia}
                        </span>
                      )}
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

      {fotoAmpliada && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Foto ampliada da manutenção"
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
    </>
  );
}

