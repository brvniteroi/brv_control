import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ExternalLink, FileText, FileWarning, Printer, X } from 'lucide-react';
import { EMPRESA_BRV, RECOMENDACOES_FIXAS_PMOC } from './empresa';
import {
  formatarAreaM2,
  formatarBtus,
  formatarDataIsoCurta,
  formatarEnderecoDocumento,
  gerarMesesDoPlano,
  letraEquipamento,
  nomeExtensoTermoResponsabilidade,
  rotuloPeriodicidade,
  rotuloTermoResponsabilidade,
} from './regrasPmoc';
import type {
  PmocEnvironment,
  PmocEquipmentTask,
  PmocPlan,
  PmocPlanEquipment,
} from '../../types/pmoc';
import { formatarDocumento } from '../../utils/documento';
import { formatarTelefone } from '../../utils/telefone';

interface DocumentoPmocProps {
  plano: PmocPlan;
  ambientes: PmocEnvironment[];
  equipamentos: PmocPlanEquipment[];
  tarefas: PmocEquipmentTask[];
  /** `embutido` exibe na aba Documento; `modal` abre em tela cheia sobre o editor. */
  modo?: 'embutido' | 'modal';
  /** Quando `false`, suprime o portal oculto de impressão (evita duplicidade se houver modal aberto). */
  ativarPortalImpressao?: boolean;
  onFechar?: () => void;
}

const ESTILO_IMPRESSAO_PMOC = `
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

function ConteudoFolhaPmoc({
  plano,
  ambientes,
  equipamentos,
  tarefas,
  onAmpliarImagem,
}: {
  plano: PmocPlan;
  ambientes: PmocEnvironment[];
  equipamentos: PmocPlanEquipment[];
  tarefas: PmocEquipmentTask[];
  onAmpliarImagem?: (url: string) => void;
}) {
  const termoSigla = rotuloTermoResponsabilidade(plano.registration_type);
  const termoExtenso = nomeExtensoTermoResponsabilidade(plano.registration_type);
  const mesesDoPlano = useMemo(() => gerarMesesDoPlano(plano.start_date), [plano.start_date]);

  const nomeAmbientePorId = useMemo(
    () => new Map(ambientes.map((a) => [a.id, a.name])),
    [ambientes],
  );

  const equipamentosAtivos = useMemo(
    () => [...equipamentos].filter((e) => e.active).sort((a, b) => a.sort_order - b.sort_order),
    [equipamentos],
  );

  const docClienteFormatado = plano.customer_document
    ? formatarDocumento(plano.customer_document, plano.customer_person_type)
    : '—';

  const cpfResponsavelFormatado = plano.responsible_cpf
    ? formatarDocumento(plano.responsible_cpf, 'PF')
    : '—';

  const dataCriacaoRodape = formatarDataIsoCurta(plano.created_at || plano.start_date);
  const ehAnexoPdf = plano.trt_attachment_mime === 'application/pdf';
  const ehAnexoImagem =
    Boolean(plano.trt_attachment_url) && !ehAnexoPdf;

  return (
    <div className="pmoc-cor-exata relative bg-white text-slate-900">
      <style>{ESTILO_IMPRESSAO_PMOC}</style>

      {/* Tabela estrutural externa para reservar espaço do rodapé fixo em cada quebra de página */}
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td className="p-0 align-top">
              {/* CAPA DO PMOC */}
              <section className="flex min-h-[235mm] flex-col justify-between border-b border-slate-200 pb-8 print:min-h-[245mm] print:break-after-page print:border-none print:pb-0">
                <div className="space-y-6">
                  {/* Topo da capa: logo e identificação da BRV */}
                  <div className="flex items-center justify-between border-b-2 border-[#0B1E3F] pb-5">
                    <div className="flex items-center gap-3.5">
                      <img
                        src={EMPRESA_BRV.logoUrl}
                        alt="Logo BRV Control"
                        className="h-14 w-auto rounded-lg bg-[#0B1E3F] p-2 object-contain pmoc-cor-exata"
                      />
                      <div>
                        <div className="text-lg font-extrabold tracking-tight text-[#0B1E3F]">
                          {EMPRESA_BRV.nomeCurto}
                        </div>
                        <div className="text-xs font-medium text-slate-600">
                          CNPJ {EMPRESA_BRV.cnpj}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block rounded border border-slate-300 bg-slate-50 px-2.5 py-1 font-mono text-xs font-bold text-slate-700">
                        {plano.code}
                      </span>
                    </div>
                  </div>

                  {/* Título oficial e base legal */}
                  <div className="py-6">
                    <p className="text-xs font-bold tracking-widest text-blue-800 uppercase">
                      Plano de Manutenção
                    </p>
                    <h2 className="mt-2 text-2xl leading-tight font-extrabold text-[#0B1E3F] sm:text-3xl">
                      PLANO DE MANUTENÇÃO, OPERAÇÃO E CONTROLE (PMOC)
                    </h2>
                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      {EMPRESA_BRV.subtituloPmoc}
                    </p>
                    <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">
                      {EMPRESA_BRV.fraseLegal}
                    </p>
                  </div>

                  {/* Período de vigência */}
                  <table className="w-full border-collapse border border-slate-300 text-xs">
                    <tbody>
                      <tr>
                        <td className="w-1/2 border border-slate-300 bg-slate-50 px-4 py-3">
                          <span className="font-bold text-slate-700">Início do período: </span>
                          <span className="font-semibold text-slate-900">
                            {formatarDataIsoCurta(plano.start_date)}
                          </span>
                        </td>
                        <td className="w-1/2 border border-slate-300 bg-slate-50 px-4 py-3">
                          <span className="font-bold text-slate-700">Final do período: </span>
                          <span className="font-semibold text-slate-900">
                            {formatarDataIsoCurta(plano.end_date)}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Cliente resumido na capa */}
                  <div className="rounded-lg border border-slate-300 p-4 text-xs">
                    <div className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                      Unidade atendida
                    </div>
                    <div className="mt-1 text-sm font-bold text-slate-900">
                      {plano.customer_name || '—'}
                    </div>
                    <div className="mt-0.5 text-slate-600">
                      {formatarEnderecoDocumento(plano.address_snapshot)}
                    </div>
                  </div>
                </div>

                {/* Rodapé da capa: Elaborado por e Responsável técnico */}
                <div className="mt-8 border-t border-slate-300 pt-5 text-xs leading-relaxed text-slate-800">
                  <div className="flex items-center gap-3 pb-3">
                    <img
                      src={EMPRESA_BRV.logoUrl}
                      alt=""
                      className="h-9 w-auto rounded bg-[#0B1E3F] p-1.5 object-contain pmoc-cor-exata"
                    />
                    <div>
                      <div className="font-bold text-slate-900">
                        Elaborado por {plano.elaborated_by || EMPRESA_BRV.razaoSocial}
                      </div>
                      <div className="text-[11px] text-slate-600">CNPJ {EMPRESA_BRV.cnpj}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 print:grid-cols-2">
                    <div>
                      <strong>Responsável técnico:</strong> {plano.responsible_name || '—'}
                    </div>
                    <div>
                      <strong>CPF:</strong> {cpfResponsavelFormatado}
                    </div>
                    <div>
                      <strong>Registro no {plano.registration_type}:</strong>{' '}
                      {plano.registration_number || '—'}
                    </div>
                    <div>
                      <strong>{termoSigla}:</strong> {plano.responsibility_term_number || '—'}
                    </div>
                  </div>
                </div>
              </section>

              {/* SEÇÕES 1 E 2: IDENTIFICAÇÃO DO ENDEREÇO E DO RESPONSÁVEL TÉCNICO */}
              <section className="mt-8 space-y-6 print:mt-0 print:break-after-page">
                {/* 1. Identificação do endereço do PMOC */}
                <table className="w-full border-collapse border border-slate-300 text-xs print:break-inside-avoid">
                  <thead>
                    <tr>
                      <th
                        colSpan={2}
                        className="pmoc-cor-exata border border-[#0B1E3F] bg-[#0B1E3F] px-3.5 py-2 text-left text-xs font-bold tracking-wide text-white uppercase"
                      >
                        1. IDENTIFICAÇÃO DO ENDEREÇO DO PMOC
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="w-3/5 border border-slate-300 px-3.5 py-2.5">
                        <strong>Nome/Razão social:</strong> {plano.customer_name || '—'}
                      </td>
                      <td className="w-2/5 border border-slate-300 px-3.5 py-2.5">
                        <strong>CPF/CNPJ:</strong> {docClienteFormatado}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={2} className="border border-slate-300 px-3.5 py-2.5">
                        <strong>Endereço completo:</strong>{' '}
                        {formatarEnderecoDocumento(plano.address_snapshot)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={2} className="border border-slate-300 px-3.5 py-2.5">
                        <strong>Complemento:</strong>{' '}
                        {plano.address_snapshot?.complement || '—'}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-3.5 py-2.5">
                        <strong>E-mail:</strong> {plano.customer_email || '—'}
                      </td>
                      <td className="border border-slate-300 px-3.5 py-2.5">
                        <strong>Telefone:</strong>{' '}
                        {plano.customer_phone ? formatarTelefone(plano.customer_phone) : '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* 2. Identificação do responsável técnico */}
                <table className="w-full border-collapse border border-slate-300 text-xs print:break-inside-avoid">
                  <thead>
                    <tr>
                      <th
                        colSpan={2}
                        className="pmoc-cor-exata border border-[#0B1E3F] bg-[#0B1E3F] px-3.5 py-2 text-left text-xs font-bold tracking-wide text-white uppercase"
                      >
                        2. IDENTIFICAÇÃO DO RESPONSÁVEL TÉCNICO
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="w-3/5 border border-slate-300 px-3.5 py-2.5">
                        <strong>Razão social:</strong> {EMPRESA_BRV.razaoSocial}
                      </td>
                      <td className="w-2/5 border border-slate-300 px-3.5 py-2.5">
                        <strong>CNPJ:</strong> {EMPRESA_BRV.cnpj}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-3.5 py-2.5">
                        <strong>E-mail:</strong> {EMPRESA_BRV.email}
                      </td>
                      <td className="border border-slate-300 px-3.5 py-2.5">
                        <strong>Telefone:</strong> {EMPRESA_BRV.telefone}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={2} className="border border-slate-300 px-3.5 py-2.5">
                        <strong>Endereço completo:</strong> {EMPRESA_BRV.endereco}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-3.5 py-2.5">
                        <strong>Nome do responsável:</strong> {plano.responsible_name || '—'}
                      </td>
                      <td className="border border-slate-300 px-3.5 py-2.5">
                        <strong>CPF:</strong> {cpfResponsavelFormatado}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-3.5 py-2.5">
                        <strong>E-mail:</strong> {plano.responsible_email || EMPRESA_BRV.email}
                      </td>
                      <td className="border border-slate-300 px-3.5 py-2.5">
                        <strong>Telefone:</strong>{' '}
                        {formatarTelefone(plano.responsible_phone || EMPRESA_BRV.telefone)}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-3.5 py-2.5">
                        <strong>Registro no {plano.registration_type}:</strong>{' '}
                        {plano.registration_number || '—'}
                      </td>
                      <td className="border border-slate-300 px-3.5 py-2.5">
                        <strong>{termoSigla}:</strong> {plano.responsibility_term_number || '—'}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={2} className="border border-slate-300 px-3.5 pt-12 pb-4 text-center">
                        <div className="mx-auto max-w-xs border-t border-slate-800 pt-1.5 font-semibold text-slate-800">
                          Assinatura do técnico responsável
                        </div>
                        {plano.responsible_name && (
                          <div className="mt-0.5 text-[11px] text-slate-600">
                            {plano.responsible_name} · {plano.registration_type}{' '}
                            {plano.registration_number || '—'}
                          </div>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>

              {/* SEÇÕES 3 E 4: AMBIENTES CLIMATIZADOS E EQUIPAMENTOS */}
              <section className="mt-8 space-y-6 print:mt-0 print:break-after-page">
                {/* 3. Identificação dos ambientes climatizados (colunas corrigidas: fixos, flutuantes, área) */}
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr>
                      <th
                        colSpan={4}
                        className="pmoc-cor-exata border border-[#0B1E3F] bg-[#0B1E3F] px-3.5 py-2 text-left text-xs font-bold tracking-wide text-white uppercase"
                      >
                        3. IDENTIFICAÇÃO DOS AMBIENTES CLIMATIZADOS
                      </th>
                    </tr>
                    <tr className="pmoc-cor-exata bg-slate-100 text-slate-800">
                      <th scope="col" className="border border-slate-300 px-3 py-2 text-left font-bold">
                        Nome do ambiente ou conjunto
                      </th>
                      <th scope="col" className="border border-slate-300 px-3 py-2 text-center font-bold">
                        Ocupantes fixos
                      </th>
                      <th scope="col" className="border border-slate-300 px-3 py-2 text-center font-bold">
                        Ocupantes flutuantes
                      </th>
                      <th scope="col" className="border border-slate-300 px-3 py-2 text-right font-bold">
                        Área climatizada total (m²)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ambientes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="border border-slate-300 px-3 py-4 text-center italic text-slate-500">
                          Nenhum ambiente climatizado cadastrado neste plano.
                        </td>
                      </tr>
                    ) : (
                      ambientes.map((amb) => (
                        <tr key={amb.id} className="print:break-inside-avoid">
                          <td className="border border-slate-300 px-3 py-2 font-medium">
                            {amb.name}{' '}
                            <span className="font-mono text-[10px] text-slate-500">
                              ({amb.code})
                            </span>
                          </td>
                          <td className="border border-slate-300 px-3 py-2 text-center">
                            {amb.fixed_occupants}
                          </td>
                          <td className="border border-slate-300 px-3 py-2 text-center">
                            {amb.floating_occupants}
                          </td>
                          <td className="border border-slate-300 px-3 py-2 text-right">
                            {formatarAreaM2(amb.area_m2, false)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* 4. Identificação dos equipamentos */}
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr>
                      <th
                        colSpan={6}
                        className="pmoc-cor-exata border border-[#0B1E3F] bg-[#0B1E3F] px-3.5 py-2 text-left text-xs font-bold tracking-wide text-white uppercase"
                      >
                        4. IDENTIFICAÇÃO DOS EQUIPAMENTOS
                      </th>
                    </tr>
                    <tr className="pmoc-cor-exata bg-slate-100 text-slate-800">
                      <th scope="col" className="border border-slate-300 px-2.5 py-2 text-left font-bold">
                        Ambiente ou conjunto
                      </th>
                      <th scope="col" className="border border-slate-300 px-2.5 py-2 text-left font-bold">
                        Tipo
                      </th>
                      <th scope="col" className="border border-slate-300 px-2.5 py-2 text-left font-bold">
                        Nome
                      </th>
                      <th scope="col" className="border border-slate-300 px-2.5 py-2 text-right font-bold">
                        Carga térmica (BTUs)
                      </th>
                      <th scope="col" className="border border-slate-300 px-2.5 py-2 text-center font-bold">
                        Identificador
                      </th>
                      <th scope="col" className="border border-slate-300 px-2.5 py-2 text-center font-bold">
                        Foto
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipamentosAtivos.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="border border-slate-300 px-3 py-4 text-center italic text-slate-500">
                          Nenhum equipamento vinculado a este plano.
                        </td>
                      </tr>
                    ) : (
                      equipamentosAtivos.map((eq) => (
                        <tr key={eq.id} className="print:break-inside-avoid">
                          <td className="border border-slate-300 px-2.5 py-2">
                            {(eq.environment_id && nomeAmbientePorId.get(eq.environment_id)) || '—'}
                          </td>
                          <td className="border border-slate-300 px-2.5 py-2">
                            {eq.equipment_type || '—'}
                          </td>
                          <td className="border border-slate-300 px-2.5 py-2 font-medium">
                            {eq.name || '—'}
                          </td>
                          <td className="border border-slate-300 px-2.5 py-2 text-right whitespace-nowrap">
                            {formatarBtus(eq.capacity_btu, false)}
                          </td>
                          <td className="border border-slate-300 px-2.5 py-2 text-center font-mono font-semibold">
                            {eq.identifier}
                          </td>
                          <td className="border border-slate-300 px-2 py-1.5 text-center">
                            {eq.photo_url ? (
                              <img
                                src={eq.photo_url}
                                alt={`Equipamento ${eq.identifier}`}
                                onClick={() => onAmpliarImagem?.(eq.photo_url!)}
                                className="mx-auto h-12 w-16 rounded border border-slate-200 object-cover print:cursor-default"
                              />
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </section>

              {/* SEÇÃO 5: CRONOGRAMA DE ATIVIDADES */}
              <section className="mt-8 space-y-4 print:mt-0">
                <div className="pmoc-cor-exata border border-[#0B1E3F] bg-[#0B1E3F] px-3.5 py-2 text-xs font-bold tracking-wide text-white uppercase">
                  5. CRONOGRAMA DE ATIVIDADES
                </div>

                {equipamentosAtivos.length === 0 ? (
                  <p className="border border-slate-300 p-4 text-center text-xs italic text-slate-500">
                    Nenhum equipamento ativo para gerar o cronograma de atividades.
                  </p>
                ) : (
                  equipamentosAtivos.map((eq, idx) => {
                    const letra = letraEquipamento(idx);
                    const tarefasAtivas = tarefas
                      .filter((t) => t.plan_equipment_id === eq.id && t.active)
                      .sort((a, b) => a.sort_order - b.sort_order);

                    return (
                      <table
                        key={eq.id}
                        className="w-full border-collapse border border-slate-300 text-xs print:break-inside-avoid"
                      >
                        <thead>
                          <tr className="pmoc-cor-exata bg-[#F3F3F3] text-slate-900">
                            <th
                              scope="col"
                              className="w-10 border border-slate-300 px-2.5 py-2 text-center font-extrabold"
                            >
                              {letra}
                            </th>
                            <th
                              scope="col"
                              className="border border-slate-300 px-3 py-2 text-left font-bold"
                            >
                              {eq.name} - {eq.identifier} ({formatarBtus(eq.capacity_btu)})
                            </th>
                            <th
                              scope="col"
                              className="w-28 border border-slate-300 px-2.5 py-2 text-center font-bold"
                            >
                              Periodicidade
                            </th>
                            <th
                              scope="col"
                              className="w-24 border border-slate-300 px-2.5 py-2 text-center font-bold"
                            >
                              Inicia em
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {tarefasAtivas.length === 0 ? (
                            <tr>
                              <td
                                colSpan={4}
                                className="border border-slate-300 px-3 py-3 text-center italic text-slate-500"
                              >
                                Nenhuma tarefa ativa selecionada para este equipamento.
                              </td>
                            </tr>
                          ) : (
                            tarefasAtivas.map((t, indiceTarefa) => {
                              const mesInicio =
                                mesesDoPlano[Math.max(0, (t.start_month_offset || 1) - 1)]
                                  ?.nomeMes ?? mesesDoPlano[0]?.nomeMes ?? '—';
                              return (
                                <tr key={t.id}>
                                  <td className="border border-slate-300 px-2 py-1.5 text-center font-semibold text-slate-700">
                                    {indiceTarefa + 1}
                                  </td>
                                  <td className="border border-slate-300 px-3 py-1.5">
                                    {t.description}
                                  </td>
                                  <td className="border border-slate-300 px-2 py-1.5 text-center whitespace-nowrap">
                                    {rotuloPeriodicidade(t.periodicity)}
                                  </td>
                                  <td className="border border-slate-300 px-2 py-1.5 text-center whitespace-nowrap">
                                    {mesInicio}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    );
                  })
                )}
              </section>

              {/* SEÇÃO 6: RECOMENDAÇÕES */}
              <section className="mt-8 print:mt-6 print:break-inside-avoid">
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr>
                      <th
                        colSpan={2}
                        className="pmoc-cor-exata border border-[#0B1E3F] bg-[#0B1E3F] px-3.5 py-2 text-left text-xs font-bold tracking-wide text-white uppercase"
                      >
                        6. RECOMENDAÇÕES
                      </th>
                    </tr>
                    <tr className="pmoc-cor-exata bg-slate-100 text-slate-800">
                      <th
                        scope="col"
                        className="w-1/3 border border-slate-300 px-3 py-2 text-left font-bold"
                      >
                        Descrição da situação
                      </th>
                      <th
                        scope="col"
                        className="w-2/3 border border-slate-300 px-3 py-2 text-left font-bold"
                      >
                        Recomendação
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {RECOMENDACOES_FIXAS_PMOC.map((rec, idx) => (
                      <tr key={idx}>
                        <td className="border border-slate-300 px-3 py-2.5 align-top font-semibold text-slate-800">
                          {rec.situacao}
                        </td>
                        <td className="border border-slate-300 px-3 py-2.5 align-top leading-relaxed text-slate-700">
                          {rec.recomendacao}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {/* ANEXO: TRT / ART */}
              <section className="mt-8 print:mt-6 print:break-before-page">
                <div className="pmoc-cor-exata border border-[#0B1E3F] bg-[#0B1E3F] px-3.5 py-2 text-xs font-bold tracking-wide text-white uppercase">
                  #1 Anexo - {termoSigla} ({termoExtenso})
                </div>

                <div className="border border-t-0 border-slate-300 p-6">
                  {ehAnexoImagem && plano.trt_attachment_url ? (
                    <div className="text-center">
                      <img
                        src={plano.trt_attachment_url}
                        alt={`Anexo ${termoSigla}`}
                        onClick={() => onAmpliarImagem?.(plano.trt_attachment_url!)}
                        className="mx-auto max-h-[210mm] max-w-full rounded border border-slate-200 object-contain"
                      />
                      {plano.trt_attachment_name && (
                        <p className="mt-2 text-[11px] text-slate-500">
                          Arquivo: {plano.trt_attachment_name}
                        </p>
                      )}
                    </div>
                  ) : ehAnexoPdf && plano.trt_attachment_url ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
                        <div className="flex items-center gap-2.5">
                          <FileText size={20} className="text-blue-600" aria-hidden="true" />
                          <div>
                            <div className="font-bold text-slate-900">
                              {plano.trt_attachment_name || `Documento ${termoSigla}.pdf`}
                            </div>
                            <div className="text-slate-500">
                              {termoSigla} nº {plano.responsibility_term_number || '—'} · Arquivo PDF anexado ao plano
                            </div>
                          </div>
                        </div>
                        <a
                          href={plano.trt_attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-50 print:hidden"
                        >
                          <ExternalLink size={14} aria-hidden="true" />
                          Abrir PDF em nova guia
                        </a>
                      </div>
                      <iframe
                        src={plano.trt_attachment_url}
                        title={`Visualização do documento ${termoSigla}`}
                        className="h-96 w-full rounded-lg border border-slate-200 print:hidden"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center text-slate-500">
                      <FileWarning size={28} className="text-amber-500" aria-hidden="true" />
                      <p className="mt-2 text-sm font-bold text-slate-700">
                        {termoSigla} não anexado
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Envie o PDF ou imagem do {termoSigla} na aba &ldquo;Geral&rdquo; do plano para exibi-lo aqui.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </td>
          </tr>
        </tbody>

        {/* Espaçador repetido ao fim de cada página impressa para não colidir com o rodapé fixo */}
        <tfoot className="hidden print:table-footer-group">
          <tr>
            <td className="h-9" />
          </tr>
        </tfoot>
      </table>

      {/* Rodapé repetido em todas as páginas impressas e visível ao fim da prévia */}
      <footer className="mt-8 border-t border-slate-300 pt-2.5 text-center text-[10px] text-slate-500 print:fixed print:inset-x-0 print:bottom-0 print:mt-0 print:bg-white print:pt-1.5">
        Criado em {dataCriacaoRodape} pela plataforma BRV Control
      </footer>
    </div>
  );
}

export default function DocumentoPmoc({
  plano,
  ambientes,
  equipamentos,
  tarefas,
  modo = 'embutido',
  ativarPortalImpressao = true,
  onFechar,
}: DocumentoPmocProps) {
  const [imagemAmpliadaUrl, setImagemAmpliadaUrl] = useState<string | null>(null);

  const handleImprimir = () => {
    window.print();
  };

  if (modo === 'modal') {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Documento PMOC ${plano.code}`}
        className="fixed inset-0 z-50 overflow-y-auto bg-slate-100 print:static print:overflow-visible print:bg-white"
      >
        <div className="min-h-screen pb-14 print:min-h-0 print:pb-0">
          {/* Barra superior oculta no papel */}
          <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-xs sm:px-6 print:hidden">
            <div className="flex items-center gap-3">
              {onFechar && (
                <button
                  type="button"
                  onClick={onFechar}
                  aria-label="Voltar ao editor do plano"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                >
                  <ArrowLeft size={18} aria-hidden="true" />
                </button>
              )}
              <div>
                <h1 className="text-base font-bold text-slate-900">
                  Documento PMOC · {plano.code}
                </h1>
                <p className="text-xs text-slate-500">
                  Formato A4 retrato pronto para impressão ou gravação em PDF pelo navegador.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleImprimir}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700"
              >
                <Printer size={15} aria-hidden="true" />
                Imprimir / PDF
              </button>
              {onFechar && (
                <button
                  type="button"
                  onClick={onFechar}
                  aria-label="Fechar pré-visualização"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div className="mx-auto mt-6 max-w-4xl px-4 sm:px-6 print:m-0 print:max-w-none print:p-0">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10 print:rounded-none print:border-none print:p-0 print:shadow-none">
              <ConteudoFolhaPmoc
                plano={plano}
                ambientes={ambientes}
                equipamentos={equipamentos}
                tarefas={tarefas}
                onAmpliarImagem={setImagemAmpliadaUrl}
              />
            </div>
          </div>

          {imagemAmpliadaUrl && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 print:hidden"
              onClick={() => setImagemAmpliadaUrl(null)}
            >
              <div className="relative max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setImagemAmpliadaUrl(null)}
                  aria-label="Fechar imagem ampliada"
                  className="absolute -top-10 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40"
                >
                  <X size={18} aria-hidden="true" />
                </button>
                <img
                  src={imagemAmpliadaUrl}
                  alt="Visualização ampliada"
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs print:hidden">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Pré-visualização do Documento PMOC</h2>
          <p className="text-xs text-slate-500">
            Use &ldquo;Imprimir / PDF&rdquo; e escolha &ldquo;Salvar como PDF&rdquo; na janela do navegador (formato A4 retrato).
          </p>
        </div>

        <button
          type="button"
          onClick={handleImprimir}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700"
        >
          <Printer size={15} aria-hidden="true" />
          Imprimir / PDF
        </button>
      </div>

      {/* Prévia em tela dentro da aba Documento */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-10 print:hidden">
        <div className="min-w-[640px] sm:min-w-0">
          <ConteudoFolhaPmoc
            plano={plano}
            ambientes={ambientes}
            equipamentos={equipamentos}
            tarefas={tarefas}
            onAmpliarImagem={setImagemAmpliadaUrl}
          />
        </div>
      </div>

      {/* Cópia direta em document.body visível exclusivamente no @media print (pois index.css oculta #root) */}
      {ativarPortalImpressao &&
        createPortal(
          <div className="hidden print:block print:bg-white">
            <ConteudoFolhaPmoc
              plano={plano}
              ambientes={ambientes}
              equipamentos={equipamentos}
              tarefas={tarefas}
            />
          </div>,
          document.body,
        )}

      {imagemAmpliadaUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 print:hidden"
          onClick={() => setImagemAmpliadaUrl(null)}
        >
          <div className="relative max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setImagemAmpliadaUrl(null)}
              aria-label="Fechar imagem ampliada"
              className="absolute -top-10 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40"
            >
              <X size={18} aria-hidden="true" />
            </button>
            <img
              src={imagemAmpliadaUrl}
              alt="Visualização ampliada"
              className="max-h-[85vh] max-w-full rounded-xl bg-white object-contain p-2 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

