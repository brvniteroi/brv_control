import { useMemo, useState } from 'react';
import BotoesFoto from '../comum/BotoesFoto';
import {
  AlertTriangle,
  Check,
  ExternalLink,
  ImagePlus,
  Loader2,
  Plus,
  Snowflake,
  Trash2,
  X,
} from 'lucide-react';
import { enviarFotoEquipamentoPmoc } from './fonteDeDados';
import {
  TIPOS_EQUIPAMENTO_SUGERIDOS,
  ehIdentificadorAutomatico,
  formatarBtus,
  gerarProximoIdentificador,
  letraEquipamento,
} from './regrasPmoc';
import { listarEquipamentos, type EquipamentoComCliente } from '../../services/equipamentos';
import type { PmocEnvironment, PmocPlanEquipment } from '../../types/pmoc';

interface AbaEquipamentosPmocProps {
  planId: string;
  customerId: string;
  ambientes: PmocEnvironment[];
  equipamentos: PmocPlanEquipment[];
  onChange: (novos: PmocPlanEquipment[]) => void;
  onInicializarTarefasDosNovos: (novos: PmocPlanEquipment[]) => void;
  onIrCadastroEquipamentos: () => void;
  onErro: (msg: string | null) => void;
}

const INPUT_TABELA =
  'block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none';

export default function AbaEquipamentosPmoc({
  planId,
  customerId,
  ambientes,
  equipamentos,
  onChange,
  onInicializarTarefasDosNovos,
  onIrCadastroEquipamentos,
  onErro,
}: AbaEquipamentosPmocProps) {
  const [fotoAmpliadaUrl, setFotoAmpliadaUrl] = useState<string | null>(null);
  const [enviandoFotoId, setEnviandoFotoId] = useState<string | null>(null);

  // Modal de importação de equipamentos cadastrados do cliente
  const [modalClienteAberto, setModalClienteAberto] = useState(false);
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(false);
  const [erroCatalogo, setErroCatalogo] = useState<string | null>(null);
  const [catalogoCliente, setCatalogoCliente] = useState<EquipamentoComCliente[]>([]);
  const [selecionadosCatalogo, setSelecionadosCatalogo] = useState<Record<string, boolean>>({});

  const ambientePorId = useMemo(
    () => new Map(ambientes.map((a) => [a.id, a])),
    [ambientes],
  );

  const contagemIdentificadores = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const eq of equipamentos) {
      const chave = eq.identifier.trim().toUpperCase();
      if (!chave) continue;
      mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
    }
    return mapa;
  }, [equipamentos]);

  const idsCadastroJaNoPlano = useMemo(() => {
    const conj = new Set<string>();
    for (const eq of equipamentos) {
      if (eq.equipment_id) conj.add(eq.equipment_id);
    }
    return conj;
  }, [equipamentos]);

  const abrirModalEquipamentosDoCliente = async () => {
    if (!customerId) {
      onErro('Escolha o cliente na aba "Geral" antes de buscar os equipamentos dele.');
      return;
    }
    onErro(null);
    setModalClienteAberto(true);
    setCarregandoCatalogo(true);
    setErroCatalogo(null);
    setSelecionadosCatalogo({});

    try {
      const pagina = await listarEquipamentos('', 'ativos', 0, customerId);
      setCatalogoCliente(pagina.itens);
    } catch (err) {
      console.error('Erro ao buscar equipamentos do cliente:', err);
      setErroCatalogo('Não foi possível carregar os equipamentos cadastrados deste cliente.');
    } finally {
      setCarregandoCatalogo(false);
    }
  };

  const confirmarImportacaoDoCliente = () => {
    const escolhidos = catalogoCliente.filter(
      (c) => selecionadosCatalogo[c.id] && !idsCadastroJaNoPlano.has(c.id),
    );
    if (escolhidos.length === 0) {
      setModalClienteAberto(false);
      return;
    }

    const idsAcumulados = equipamentos.map((e) => e.identifier);
    const novos: PmocPlanEquipment[] = [];

    escolhidos.forEach((eq, idx) => {
      const locNormalizado = (eq.location ?? '').trim().toLowerCase();
      const ambCasado = locNormalizado
        ? ambientes.find((a) => a.name.trim().toLowerCase() === locNormalizado)
        : undefined;

      const sigla = ambCasado?.code || 'EQ';
      const identificador = gerarProximoIdentificador(sigla, idsAcumulados);
      idsAcumulados.push(identificador);

      const nomePadrao =
        [eq.category, eq.location ? `(${eq.location})` : eq.brand].filter(Boolean).join(' ') ||
        'Equipamento climatizador';

      novos.push({
        id: crypto.randomUUID(),
        plan_id: planId,
        equipment_id: eq.id,
        environment_id: ambCasado?.id ?? null,
        equipment_type: eq.category || 'Split Hi-Wall',
        name: nomePadrao,
        brand: eq.brand,
        model: eq.model,
        serial_number: eq.serial_number,
        capacity_btu: eq.capacity_btu ?? 12000,
        identifier: identificador,
        photo_url: null,
        photo_attachment_id: null,
        sort_order: equipamentos.length + idx + 1,
        active: true,
        created_at: new Date().toISOString(),
      });
    });

    onChange([...equipamentos, ...novos]);
    onInicializarTarefasDosNovos(novos);
    setModalClienteAberto(false);
  };

  const adicionarLinhaManual = () => {
    const primeiroAmbiente = ambientes[0] ?? null;
    const sigla = primeiroAmbiente?.code || 'EQ';
    const identificador = gerarProximoIdentificador(
      sigla,
      equipamentos.map((e) => e.identifier),
    );

    const novo: PmocPlanEquipment = {
      id: crypto.randomUUID(),
      plan_id: planId,
      equipment_id: null,
      environment_id: primeiroAmbiente?.id ?? null,
      equipment_type: 'Split Hi-Wall',
      name: '',
      brand: null,
      model: null,
      serial_number: null,
      capacity_btu: 12000,
      identifier: identificador,
      photo_url: null,
      photo_attachment_id: null,
      sort_order: equipamentos.length + 1,
      active: true,
      created_at: new Date().toISOString(),
    };

    onChange([...equipamentos, novo]);
    onInicializarTarefasDosNovos([novo]);
  };

  const atualizarAmbienteDoEquipamento = (eq: PmocPlanEquipment, novoAmbienteId: string) => {
    const amb = novoAmbienteId ? ambientePorId.get(novoAmbienteId) : undefined;
    let novoIdentificador = eq.identifier;

    // Se o identificador atual ainda estiver vazio ou no padrão automático, gera sequência na nova sigla
    if (amb?.code && (!eq.identifier.trim() || ehIdentificadorAutomatico(eq.identifier))) {
      novoIdentificador = gerarProximoIdentificador(
        amb.code,
        equipamentos.map((item) => item.identifier),
        eq.identifier,
      );
    }

    onChange(
      equipamentos.map((item) =>
        item.id === eq.id
          ? {
              ...item,
              environment_id: novoAmbienteId || null,
              identifier: novoIdentificador,
            }
          : item,
      ),
    );
  };

  const atualizarCampo = (id: string, atualizacao: Partial<PmocPlanEquipment>) => {
    onChange(
      equipamentos.map((item) => (item.id === id ? { ...item, ...atualizacao } : item)),
    );
  };

  const removerEquipamento = (id: string) => {
    onChange(
      equipamentos
        .filter((item) => item.id !== id)
        .map((item, idx) => ({ ...item, sort_order: idx + 1 })),
    );
  };

  const handleUploadFoto = async (eqId: string, arquivo: File | undefined) => {
    if (!arquivo) return;

    onErro(null);
    setEnviandoFotoId(eqId);
    try {
      const enviado = await enviarFotoEquipamentoPmoc(arquivo);
      atualizarCampo(eqId, {
        photo_url: enviado.url,
        photo_attachment_id: enviado.attachment_id,
      });
    } catch (err) {
      onErro(
        err instanceof Error ? err.message : 'Não foi possível enviar a foto do equipamento.',
      );
    } finally {
      setEnviandoFotoId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho e ações da aba */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Equipamentos do plano</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Vincule os condicionadores de ar aos ambientes. O identificador <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px]">AR-&lt;SIGLA&gt;-&lt;0001&gt;</code> é gerado pela sigla do ambiente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onIrCadastroEquipamentos}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ExternalLink size={14} aria-hidden="true" />
            Cadastrar novo
          </button>

          <button
            type="button"
            onClick={() => void abrirModalEquipamentosDoCliente()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            <Snowflake size={14} aria-hidden="true" />
            Adicionar equipamento do cliente
          </button>

          <button
            type="button"
            onClick={adicionarLinhaManual}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700"
          >
            <Plus size={15} aria-hidden="true" />
            Adicionar linha
          </button>
        </div>
      </div>

      {/* Datalist de tipos comuns de equipamentos */}
      <datalist id="pmoc-tipos-equipamento">
        {TIPOS_EQUIPAMENTO_SUGERIDOS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      {equipamentos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Snowflake size={24} aria-hidden="true" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-800">
            Nenhum equipamento neste plano
          </h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            Importe aparelhos já cadastrados para este cliente ou adicione manualmente na tabela.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => void abrirModalEquipamentosDoCliente()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              <Snowflake size={14} aria-hidden="true" />
              Adicionar equipamento do cliente
            </button>
            <button
              type="button"
              onClick={adicionarLinhaManual}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus size={14} aria-hidden="true" />
              Adicionar linha manual
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div
            role="region"
            aria-label="Tabela de equipamentos do plano PMOC"
            tabIndex={0}
            className="overflow-x-auto"
          >
            <table className="w-full min-w-[920px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 font-semibold tracking-wider text-slate-500 uppercase">
                  <th scope="col" className="w-10 px-3 py-3 text-center">
                    #
                  </th>
                  <th scope="col" className="w-48 px-3 py-3">
                    Ambiente *
                  </th>
                  <th scope="col" className="w-40 px-3 py-3">
                    Tipo *
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Nome no plano *
                  </th>
                  <th scope="col" className="w-36 px-3 py-3 text-right">
                    Capacidade (BTUs)
                  </th>
                  <th scope="col" className="w-36 px-3 py-3">
                    Identificador *
                  </th>
                  <th scope="col" className="w-36 px-3 py-3 text-center">
                    Foto
                  </th>
                  <th scope="col" className="w-14 px-3 py-3 text-right">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {equipamentos.map((eq, idx) => {
                  const letra = letraEquipamento(idx);
                  const semAmbiente =
                    !eq.environment_id || !ambientePorId.has(eq.environment_id);
                  const idNormalizado = eq.identifier.trim().toUpperCase();
                  const idRepetido =
                    Boolean(idNormalizado) &&
                    (contagemIdentificadores.get(idNormalizado) ?? 0) > 1;
                  const enviandoEstaFoto = enviandoFotoId === eq.id;

                  return (
                    <tr key={eq.id} className="align-top hover:bg-slate-50/50">
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 font-bold text-slate-700">
                          {letra}
                        </span>
                      </td>

                      <td className="px-3 py-3">
                        <select
                          aria-label={`Ambiente do equipamento ${letra}`}
                          value={semAmbiente ? '' : (eq.environment_id ?? '')}
                          onChange={(e) => atualizarAmbienteDoEquipamento(eq, e.target.value)}
                          className={`${INPUT_TABELA} ${
                            semAmbiente ? 'border-amber-400 bg-amber-50/50' : ''
                          }`}
                        >
                          <option value="">Escolha o ambiente...</option>
                          {ambientes.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name || 'Sem nome'} ({a.code || '?'})
                            </option>
                          ))}
                        </select>
                        {semAmbiente && (
                          <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                            <AlertTriangle size={12} aria-hidden="true" />
                            Escolha o ambiente
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <input
                          type="text"
                          list="pmoc-tipos-equipamento"
                          aria-label={`Tipo do equipamento ${letra}`}
                          value={eq.equipment_type}
                          onChange={(e) =>
                            atualizarCampo(eq.id, { equipment_type: e.target.value })
                          }
                          placeholder="Split Hi-Wall"
                          className={INPUT_TABELA}
                        />
                      </td>

                      <td className="px-3 py-3">
                        <input
                          type="text"
                          aria-label={`Nome do equipamento ${letra}`}
                          value={eq.name}
                          onChange={(e) => atualizarCampo(eq.id, { name: e.target.value })}
                          placeholder="Ex.: Split da Sala de Reunião"
                          className={INPUT_TABELA}
                        />
                        {(eq.brand || eq.model) && (
                          <div className="mt-1 text-[10px] text-slate-400">
                            {[eq.brand, eq.model].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label={`Carga térmica em BTUs do equipamento ${letra}`}
                          value={eq.capacity_btu > 0 ? formatarBtus(eq.capacity_btu, false) : ''}
                          onChange={(e) => {
                            const digitos = e.target.value.replace(/\D/g, '');
                            atualizarCampo(eq.id, {
                              capacity_btu: digitos ? Number.parseInt(digitos, 10) : 0,
                            });
                          }}
                          placeholder="12.000"
                          className={`${INPUT_TABELA} text-right`}
                        />
                        <div className="mt-0.5 text-right text-[10px] text-slate-400">
                          {formatarBtus(eq.capacity_btu)}
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <input
                          type="text"
                          aria-label={`Identificador do equipamento ${letra}`}
                          value={eq.identifier}
                          autoCorrect="off"
                          spellCheck={false}
                          onChange={(e) =>
                            atualizarCampo(eq.id, {
                              identifier: e.target.value.toUpperCase(),
                            })
                          }
                          placeholder="AR-SR-0001"
                          className={`${INPUT_TABELA} font-mono font-bold uppercase ${
                            idRepetido ? 'border-rose-400 bg-rose-50/40' : ''
                          }`}
                        />
                        {idRepetido && (
                          <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                            <AlertTriangle size={12} aria-hidden="true" />
                            Identificador repetido
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-center">
                        {eq.photo_url ? (
                          <div className="inline-flex flex-col items-center gap-1">
                            <img
                              src={eq.photo_url}
                              alt={`Miniatura ${eq.identifier}`}
                              onClick={() => setFotoAmpliadaUrl(eq.photo_url)}
                              className="h-11 w-16 cursor-pointer rounded-lg border border-slate-200 object-cover transition hover:opacity-90"
                            />
                            <div className="flex items-center gap-2 text-[10px]">
                              <BotoesFoto
                                tamanho="mini"
                                multiplo={false}
                                enviando={enviandoEstaFoto}
                                onArquivos={(arquivos) => void handleUploadFoto(eq.id, arquivos[0])}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  atualizarCampo(eq.id, {
                                    photo_url: null,
                                    photo_attachment_id: null,
                                  })
                                }
                                className="font-semibold text-rose-600 hover:underline"
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        ) : (
                          <BotoesFoto
                            tamanho="mini"
                            multiplo={false}
                            enviando={enviandoEstaFoto}
                            onArquivos={(arquivos) => void handleUploadFoto(eq.id, arquivos[0])}
                          />
                        )}
                      </td>

                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => removerEquipamento(eq.id)}
                          aria-label={`Remover equipamento ${eq.identifier || letra}`}
                          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Escolher equipamentos já cadastrados do cliente */}
      {modalClienteAberto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Adicionar equipamento do cliente"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onClick={() => setModalClienteAberto(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Equipamentos cadastrados do cliente
                </h3>
                <p className="text-xs text-slate-500">
                  Selecione os aparelhos que entram neste plano PMOC.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalClienteAberto(false)}
                aria-label="Fechar janela"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {carregandoCatalogo ? (
                <div className="flex h-40 items-center justify-center gap-2 text-xs text-slate-500">
                  <Loader2 size={18} className="animate-spin text-blue-600" aria-hidden="true" />
                  <span>Buscando equipamentos do cliente...</span>
                </div>
              ) : erroCatalogo ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
                  {erroCatalogo}
                </div>
              ) : catalogoCliente.length === 0 ? (
                <div className="py-10 text-center">
                  <ImagePlus size={28} className="mx-auto text-slate-300" aria-hidden="true" />
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    Nenhum equipamento cadastrado para este cliente.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Você pode cadastrar no módulo de Equipamentos ou adicionar direto na tabela deste plano.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setModalClienteAberto(false);
                      onIrCadastroEquipamentos();
                    }}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                  >
                    <ExternalLink size={14} aria-hidden="true" />
                    Ir para Cadastro de Equipamentos
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {catalogoCliente.map((item) => {
                    const jaVinculado = idsCadastroJaNoPlano.has(item.id);
                    const marcado = Boolean(selecionadosCatalogo[item.id]);
                    return (
                      <label
                        key={item.id}
                        className={`flex items-start gap-3 p-3.5 text-xs transition ${
                          jaVinculado
                            ? 'cursor-not-allowed bg-slate-50 opacity-60'
                            : 'cursor-pointer hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={jaVinculado}
                          checked={jaVinculado || marcado}
                          onChange={(e) =>
                            setSelecionadosCatalogo((prev) => ({
                              ...prev,
                              [item.id]: e.target.checked,
                            }))
                          }
                          className="mt-0.5 accent-blue-600"
                        />
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold text-slate-900">
                              {item.category}{' '}
                              {[item.brand, item.model].filter(Boolean).join(' ')}
                            </span>
                            <span className="font-semibold text-slate-600">
                              {formatarBtus(item.capacity_btu)}
                            </span>
                          </div>
                          <div className="mt-0.5 text-slate-500">
                            Local: {item.location || 'Não informado'}
                            {jaVinculado ? ' · Já adicionado ao plano' : ''}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button
                type="button"
                onClick={() => setModalClienteAberto(false)}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarImportacaoDoCliente}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Check size={14} aria-hidden="true" />
                Incluir selecionados
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de foto ampliada */}
      {fotoAmpliadaUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => setFotoAmpliadaUrl(null)}
        >
          <div className="relative max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setFotoAmpliadaUrl(null)}
              aria-label="Fechar foto ampliada"
              className="absolute -top-10 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40"
            >
              <X size={18} aria-hidden="true" />
            </button>
            <img
              src={fotoAmpliadaUrl}
              alt="Foto do equipamento ampliada"
              className="max-h-[85vh] max-w-full rounded-xl bg-white object-contain p-2 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

