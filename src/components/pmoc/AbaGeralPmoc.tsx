import { useEffect, useState, type ChangeEvent } from 'react';
import { ExternalLink, FileText, Loader2, Sparkles, Trash2, Upload } from 'lucide-react';
import SeletorCliente from '../ordens/SeletorCliente';
import { enviarAnexoTrtPmoc } from './fonteDeDados';
import {
  calcularSituacaoPlano,
  criarSnapshotEndereco,
  formatarEnderecoResumo,
  rotuloTermoResponsabilidade,
  sugerirFimVigencia,
} from './regrasPmoc';
import { listarColaboradores, type ColaboradorComLogin } from '../../services/equipe';
import { listarEnderecosDoCliente } from '../../services/ordens';
import type { Customer, CustomerAddress } from '../../types/fsm';
import type { PmocPlan, PmocPlanBaseStatus, PmocRegistrationType } from '../../types/pmoc';
import { formatarDocumento } from '../../utils/documento';
import { rotuloEndereco } from '../../utils/ordens';
import { formatarTelefone } from '../../utils/telefone';

interface AbaGeralPmocProps {
  plano: PmocPlan;
  onChange: (atualizacao: Partial<PmocPlan>) => void;
  onErroUpload: (mensagem: string | null) => void;
}

const INPUT =
  'mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400';

const OPCOES_STATUS_BASE: readonly { valor: PmocPlanBaseStatus; rotulo: string }[] = [
  { valor: 'rascunho', rotulo: 'Rascunho' },
  { valor: 'vigente', rotulo: 'Vigente' },
  { valor: 'encerrado', rotulo: 'Encerrado' },
];

export default function AbaGeralPmoc({ plano, onChange, onErroUpload }: AbaGeralPmocProps) {
  const [enderecos, setEnderecos] = useState<CustomerAddress[]>([]);
  const [colaboradores, setColaboradores] = useState<ColaboradorComLogin[]>([]);
  const [enviandoTrt, setEnviandoTrt] = useState(false);

  // Carrega colaboradores ativos uma única vez do serviço real de equipe
  useEffect(() => {
    let ativo = true;
    listarColaboradores()
      .then((lista) => {
        if (ativo) setColaboradores(lista);
      })
      .catch((err) => {
        // Caso sem conexão/permissão no ambiente local, mantém preenchimento manual liberado
        console.error('Aviso ao listar colaboradores para o PMOC:', err);
      });
    return () => {
      ativo = false;
    };
  }, []);

  // Carrega endereços reais quando um cliente está selecionado
  const clienteId = plano.customer_id;
  useEffect(() => {
    if (!clienteId) return;
    let ativo = true;
    listarEnderecosDoCliente(clienteId)
      .then((lista) => {
        if (!ativo) return;
        setEnderecos(lista);
      })
      .catch((err) => {
        console.error('Aviso ao buscar endereços do cliente para o PMOC:', err);
      });
    return () => {
      ativo = false;
    };
  }, [clienteId]);

  const handleEscolherCliente = async (c: Customer | null) => {
    if (!c) {
      setEnderecos([]);
      onChange({
        customer_id: '',
        customer_name: '',
        customer_trade_name: null,
        customer_document: null,
        customer_email: null,
        customer_phone: null,
        address_id: null,
        address_snapshot: null,
      });
      return;
    }

    onChange({
      customer_id: c.id,
      customer_name: c.name,
      customer_trade_name: c.trade_name,
      customer_person_type: c.person_type,
      customer_document: c.document,
      customer_email: c.email,
      customer_phone: c.phone,
      address_id: null,
      address_snapshot: null,
    });

    try {
      const lista = await listarEnderecosDoCliente(c.id);
      setEnderecos(lista);
      const principal = lista.find((e) => e.is_primary && e.active) ?? lista.find((e) => e.active);
      if (principal) {
        onChange({
          address_id: principal.id,
          address_snapshot: criarSnapshotEndereco(principal),
        });
      }
    } catch (err) {
      console.error('Erro ao buscar endereços do cliente selecionado:', err);
    }
  };

  const handleTrocarEndereco = (idSelecionado: string) => {
    if (!idSelecionado) {
      onChange({ address_id: null, address_snapshot: null });
      return;
    }
    const encontrado = enderecos.find((e) => e.id === idSelecionado);
    if (encontrado) {
      onChange({
        address_id: encontrado.id,
        address_snapshot: criarSnapshotEndereco(encontrado),
      });
    }
  };

  const handleInicioChange = (novoInicio: string) => {
    const fimSugeridoAnterior = sugerirFimVigencia(plano.start_date);
    const fimSugeridoNovo = sugerirFimVigencia(novoInicio);
    const deveAtualizarFim =
      !plano.end_date || plano.end_date === fimSugeridoAnterior;

    onChange({
      start_date: novoInicio,
      ...(deveAtualizarFim && fimSugeridoNovo ? { end_date: fimSugeridoNovo } : {}),
    });
  };

  const handleEscolherColaborador = (empId: string) => {
    if (!empId) {
      onChange({ responsible_employee_id: null });
      return;
    }
    const colab = colaboradores.find((c) => c.id === empId);
    if (colab) {
      onChange({
        responsible_employee_id: colab.id,
        responsible_name: colab.name,
        responsible_email: colab.email || plano.responsible_email,
        responsible_phone: colab.phone || plano.responsible_phone,
      });
    }
  };

  const handleUploadTrt = async (e: ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;

    onErroUpload(null);
    setEnviandoTrt(true);
    try {
      const enviado = await enviarAnexoTrtPmoc(arquivo);
      onChange({
        trt_attachment_url: enviado.url,
        trt_attachment_name: enviado.file_name,
        trt_attachment_mime: enviado.mime_type,
      });
    } catch (err) {
      onErroUpload(
        err instanceof Error ? err.message : 'Não foi possível anexar o arquivo do termo.',
      );
    } finally {
      setEnviandoTrt(false);
    }
  };

  const termoSigla = rotuloTermoResponsabilidade(plano.registration_type);
  const infoSituacao = calcularSituacaoPlano(plano.status, plano.end_date);

  const colaboradoresAtivos = colaboradores.filter(
    (c) => c.active || c.id === plano.responsible_employee_id,
  );
  const temColaboradorDemoForaDaLista =
    Boolean(plano.responsible_employee_id) &&
    !colaboradoresAtivos.some((c) => c.id === plano.responsible_employee_id);

  const temEnderecoSnapshotForaDaLista =
    Boolean(plano.address_id) &&
    Boolean(plano.address_snapshot) &&
    !enderecos.some((e) => e.id === plano.address_id);

  return (
    <div className="space-y-6">
      {/* Bloco 1: Cliente, Endereço e Vigência */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <h2 className="text-sm font-bold text-slate-900">Cliente, local e período de vigência</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Defina o contratante, o imóvel climatizado e o ciclo anual de 12 meses do plano.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <span className="block text-xs font-medium text-slate-700">Cliente *</span>
            <SeletorCliente
              valor={
                plano.customer_id
                  ? { id: plano.customer_id, name: plano.customer_name }
                  : null
              }
              onChange={(c) => void handleEscolherCliente(c)}
            />
          </div>

          <div>
            <label htmlFor="pmoc-endereco" className="block text-xs font-medium text-slate-700">
              Endereço do PMOC *
            </label>
            <select
              id="pmoc-endereco"
              value={plano.address_id ?? ''}
              onChange={(e) => handleTrocarEndereco(e.target.value)}
              disabled={!plano.customer_id}
              className={INPUT}
            >
              <option value="">
                {plano.customer_id ? 'Escolha o endereço...' : 'Escolha o cliente primeiro'}
              </option>
              {temEnderecoSnapshotForaDaLista && plano.address_id && plano.address_snapshot && (
                <option value={plano.address_id}>
                  {formatarEnderecoResumo(plano.address_snapshot)}
                </option>
              )}
              {enderecos
                .filter((e) => e.active || e.id === plano.address_id)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {rotuloEndereco(e)}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Dados complementares do cliente impressos no item 1 */}
        {plano.customer_id && (
          <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 sm:grid-cols-3">
            <div>
              <label htmlFor="pmoc-cli-doc" className="block text-xs font-medium text-slate-700">
                {plano.customer_person_type === 'PF' ? 'CPF do cliente' : 'CNPJ do cliente'}
              </label>
              <input
                id="pmoc-cli-doc"
                type="text"
                value={
                  plano.customer_document
                    ? formatarDocumento(plano.customer_document, plano.customer_person_type)
                    : ''
                }
                onChange={(e) =>
                  onChange({
                    customer_document: formatarDocumento(
                      e.target.value,
                      plano.customer_person_type,
                    ),
                  })
                }
                autoCorrect="off"
                spellCheck={false}
                placeholder={
                  plano.customer_person_type === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'
                }
                className={INPUT}
              />
            </div>

            <div>
              <label htmlFor="pmoc-cli-email" className="block text-xs font-medium text-slate-700">
                E-mail no documento
              </label>
              <input
                id="pmoc-cli-email"
                type="email"
                value={plano.customer_email ?? ''}
                onChange={(e) => onChange({ customer_email: e.target.value || null })}
                autoCorrect="off"
                spellCheck={false}
                placeholder="financeiro@cliente.com.br"
                className={INPUT}
              />
            </div>

            <div>
              <label htmlFor="pmoc-cli-tel" className="block text-xs font-medium text-slate-700">
                Telefone no documento
              </label>
              <input
                id="pmoc-cli-tel"
                type="tel"
                value={formatarTelefone(plano.customer_phone)}
                onChange={(e) =>
                  onChange({ customer_phone: formatarTelefone(e.target.value) || null })
                }
                placeholder="(21) 99999-9999"
                className={INPUT}
              />
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="pmoc-inicio" className="block text-xs font-medium text-slate-700">
              Início da vigência *
            </label>
            <input
              id="pmoc-inicio"
              type="date"
              value={plano.start_date}
              onChange={(e) => handleInicioChange(e.target.value)}
              className={INPUT}
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="pmoc-fim" className="block text-xs font-medium text-slate-700">
                Fim da vigência *
              </label>
              {plano.start_date && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({ end_date: sugerirFimVigencia(plano.start_date) })
                  }
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
                >
                  <Sparkles size={11} aria-hidden="true" />
                  12 meses
                </button>
              )}
            </div>
            <input
              id="pmoc-fim"
              type="date"
              value={plano.end_date}
              onChange={(e) => onChange({ end_date: e.target.value })}
              className={INPUT}
            />
          </div>

          <div>
            <label htmlFor="pmoc-status" className="block text-xs font-medium text-slate-700">
              Situação do plano
            </label>
            <select
              id="pmoc-status"
              value={plano.status}
              onChange={(e) =>
                onChange({ status: e.target.value as PmocPlanBaseStatus })
              }
              className={INPUT}
            >
              {OPCOES_STATUS_BASE.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.rotulo}
                </option>
              ))}
            </select>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
              <span>Exibição atual:</span>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${infoSituacao.classeSelo}`}
              >
                {infoSituacao.rotulo}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bloco 2: Responsável Técnico e TRT / ART */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <h2 className="text-sm font-bold text-slate-900">Responsável técnico e registro (CFT / CREA)</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Informações impressas na capa, na seção 2 do PMOC e nos relatórios mensais.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="pmoc-colab" className="block text-xs font-medium text-slate-700">
              Selecionar da equipe
            </label>
            <select
              id="pmoc-colab"
              value={plano.responsible_employee_id ?? ''}
              onChange={(e) => handleEscolherColaborador(e.target.value)}
              className={INPUT}
            >
              <option value="">Preenchimento manual / escolher...</option>
              {temColaboradorDemoForaDaLista && plano.responsible_employee_id && (
                <option value={plano.responsible_employee_id}>
                  {plano.responsible_name}
                </option>
              )}
              {colaboradoresAtivos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="pmoc-resp-nome" className="block text-xs font-medium text-slate-700">
              Nome do responsável técnico *
            </label>
            <input
              id="pmoc-resp-nome"
              type="text"
              value={plano.responsible_name}
              onChange={(e) => onChange({ responsible_name: e.target.value })}
              placeholder="Nome completo conforme registro profissional"
              className={INPUT}
            />
          </div>

          <div>
            <label htmlFor="pmoc-resp-cpf" className="block text-xs font-medium text-slate-700">
              CPF do responsável
            </label>
            <input
              id="pmoc-resp-cpf"
              type="text"
              inputMode="numeric"
              autoCorrect="off"
              spellCheck={false}
              value={
                plano.responsible_cpf
                  ? formatarDocumento(plano.responsible_cpf, 'PF')
                  : ''
              }
              onChange={(e) =>
                onChange({
                  responsible_cpf: formatarDocumento(e.target.value, 'PF') || null,
                })
              }
              placeholder="000.000.000-00"
              className={INPUT}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <fieldset>
            <legend className="block text-xs font-medium text-slate-700">
              Tipo de registro profissional *
            </legend>
            <div className="mt-1.5 flex gap-2">
              {(['CFT', 'CREA'] as PmocRegistrationType[]).map((conselho) => {
                const selecionado = plano.registration_type === conselho;
                return (
                  <label
                    key={conselho}
                    className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                      selecionado
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="registration_type"
                      value={conselho}
                      checked={selecionado}
                      onChange={() => onChange({ registration_type: conselho })}
                      className="accent-blue-600"
                    />
                    <span>
                      {conselho} ({conselho === 'CFT' ? 'TRT' : 'ART'})
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="pmoc-reg-num" className="block text-xs font-medium text-slate-700">
              Número do registro no {plano.registration_type} *
            </label>
            <input
              id="pmoc-reg-num"
              type="text"
              value={plano.registration_number}
              onChange={(e) => onChange({ registration_number: e.target.value })}
              autoCorrect="off"
              spellCheck={false}
              placeholder={`Ex.: ${plano.registration_type}-RJ ...`}
              className={INPUT}
            />
          </div>

          <div>
            <label htmlFor="pmoc-termo-num" className="block text-xs font-medium text-slate-700">
              Número {termoSigla === 'TRT' ? 'do TRT' : 'da ART'} *
            </label>
            <input
              id="pmoc-termo-num"
              type="text"
              value={plano.responsibility_term_number}
              onChange={(e) => onChange({ responsibility_term_number: e.target.value })}
              autoCorrect="off"
              spellCheck={false}
              placeholder={`Número ${termoSigla}`}
              className={INPUT}
            />
          </div>
        </div>

        {/* Upload / visualização do Anexo TRT/ART */}
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-800">
                Anexo {termoSigla === 'TRT' ? 'do TRT' : 'da ART'} (PDF ou imagem)
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Exibido na página final de anexos do documento PMOC impresso.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50">
                {enviandoTrt ? (
                  <Loader2 size={14} className="animate-spin text-blue-600" aria-hidden="true" />
                ) : (
                  <Upload size={14} className="text-blue-600" aria-hidden="true" />
                )}
                <span>
                  {enviandoTrt
                    ? 'Carregando...'
                    : plano.trt_attachment_url
                      ? `Trocar ${termoSigla}`
                      : `Enviar ${termoSigla}`}
                </span>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp,image/svg+xml"
                  disabled={enviandoTrt}
                  onChange={(e) => void handleUploadTrt(e)}
                  className="sr-only"
                />
              </label>

              {plano.trt_attachment_url && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      trt_attachment_url: null,
                      trt_attachment_name: null,
                      trt_attachment_mime: null,
                    })
                  }
                  aria-label={`Remover anexo ${termoSigla}`}
                  className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Remover
                </button>
              )}
            </div>
          </div>

          {plano.trt_attachment_url && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-xs">
              <div className="flex items-center gap-3">
                {plano.trt_attachment_mime === 'application/pdf' ? (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                    <FileText size={22} aria-hidden="true" />
                  </div>
                ) : (
                  <img
                    src={plano.trt_attachment_url}
                    alt={`Miniatura ${termoSigla}`}
                    className="h-12 w-16 rounded border border-slate-200 object-cover"
                  />
                )}
                <div>
                  <div className="font-semibold text-slate-800">
                    {plano.trt_attachment_name || `Arquivo ${termoSigla}`}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {plano.trt_attachment_mime === 'application/pdf'
                      ? 'Documento PDF anexado'
                      : 'Imagem anexada'}
                  </div>
                </div>
              </div>

              <a
                href={plano.trt_attachment_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline"
              >
                <ExternalLink size={13} aria-hidden="true" />
                Visualizar
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Bloco 3: Observações internas */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <label htmlFor="pmoc-notas" className="block text-sm font-bold text-slate-900">
          Observações internas do contrato
        </label>
        <p className="mt-0.5 text-xs text-slate-500">
          Restrições de horário, contato do síndico/gerente ou detalhes operacionais (visível só para o escritório).
        </p>
        <textarea
          id="pmoc-notas"
          rows={3}
          value={plano.notes ?? ''}
          onChange={(e) => onChange({ notes: e.target.value || null })}
          placeholder="Ex.: Visitas sempre na primeira terça-feira do mês, procurar a gerência..."
          className={INPUT}
        />
      </div>
    </div>
  );
}

