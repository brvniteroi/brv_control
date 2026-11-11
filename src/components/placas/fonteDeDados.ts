// Camada única de acesso a dados do módulo de Reparo de Placas e Apoio Técnico.
// Enquanto `FONTE_DADOS_DEMO = true`, opera sobre estado em memória clonado de `dadosDemo.ts`.
// O Claude trocará o corpo destas funções por `src/services/placas.ts` + Edge Functions sem tocar nas telas.

import type { ProfileRole } from '../../types/fsm';
import type {
  BoardClient,
  BoardClientInput,
  BoardControlOsLookup,
  BoardCustomerKind,
  BoardEvent,
  BoardListFilter,
  BoardListResult,
  BoardOrder,
  BoardPhoto,
  BoardPhotoCategory,
  BoardPublicStageStep,
  BoardPublicTracking,
  BoardQuoteInput,
  BoardQuoteResponseInput,
  BoardRefundInput,
  BoardStage,
  BoardTechnicianOption,
  ConsultaCodigoErroInput,
  CreateBoardInput,
  EnviarManualPlacaInput,
  ExtracaoFichaManualResultado,
  FiltroFichasPlacas,
  MoveBoardExtra,
  PedidoEtiquetaPlacaResult,
  PlacaFichaInput,
  PlacaFichaTecnica,
  PlacaManual,
  ResultadoConsultaErro,
  SituacaoImpressoraPlaca,
  UpdateBoardFields,
} from '../../types/placas';
import * as real from '../../services/placas';
import { acompanharPedido, situacaoImpressora as situacaoElgin } from '../../services/oficina';
import { valorEmReais } from '../../utils/oficina';
import { limparDocumento } from '../../utils/documento';
import { formatarTelefone } from '../../utils/telefone';
import {
  CLIENTES_PLACAS_DEMO_INICIAL,
  EVENTOS_PLACAS_DEMO_INICIAL,
  FICHAS_PLACAS_DEMO_INICIAL,
  FOTOS_PLACAS_DEMO_INICIAL,
  MANUAIS_PLACAS_DEMO_INICIAL,
  OS_CONTROL_DEMO,
  PLACAS_DEMO_INICIAL,
  TECNICOS_DEMO_PLACAS,
  gerarExtracaoFichaDemo,
  obterRespostaErroDemo,
} from './dadosDemo';
import {
  ETAPAS_KANBAN_PLACA,
  MOSTRAR_VALOR_ORCAMENTO,
  PLACAS_FINALIZADAS_POR_PAGINA,
  ROTULO_ETAPA_PLACA,
  calcularValidadeGarantia,
  diasDesdeEntrada,
  ehEtapaFinalPlaca,
  garantiaVigente,
  gerarNumeroPlaca,
  motivoBloqueioPlaca,
  placaEncalhada,
  proximaSequenciaDiaPlaca,
  semAcento,
} from './regrasPlacas';

/** Enquanto `true`, exibe a faixa discreta `"Dados de demonstração"` nas telas do módulo Placas. */
export const FONTE_DADOS_DEMO = true;

/**
 * Placas, clientes de placas, orçamento, financeiro, fotos, histórico e página pública vêm do banco
 * (services/placas.ts, migration 20261110100000_placas_base.sql). Fichas técnicas, manuais, códigos de erro,
 * assistente, PDF e etiqueta ainda usam dados de demonstração (fase P7/P4). Para voltar tudo à demonstração: false.
 */
export const USAR_BANCO_PLACAS = true;

const TAMANHO_MAX_MANUAL_BYTES = 20 * 1024 * 1024; // 20 MB

// Estado mutável em memória da sessão de demonstração
let memoriaPlacas: BoardOrder[] = structuredClone(PLACAS_DEMO_INICIAL);
let memoriaClientes: Omit<BoardClient, 'board_count' | 'last_board_at'>[] = structuredClone(
  CLIENTES_PLACAS_DEMO_INICIAL,
);
let memoriaFotos: BoardPhoto[] = structuredClone(FOTOS_PLACAS_DEMO_INICIAL);
let memoriaEventos: BoardEvent[] = structuredClone(EVENTOS_PLACAS_DEMO_INICIAL);
let memoriaFichas: PlacaFichaTecnica[] = structuredClone(FICHAS_PLACAS_DEMO_INICIAL);
let memoriaManuais: PlacaManual[] = structuredClone(MANUAIS_PLACAS_DEMO_INICIAL);

const atraso = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function gerarUuidDemo(prefixo: string): string {
  const aleatorio = Math.random().toString(36).slice(2, 10);
  return `${prefixo}-${Date.now().toString(36)}-${aleatorio}`;
}

function gerarTokenPublico(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function recalcularPlaca(p: BoardOrder): BoardOrder {
  const cli = p.board_client_id
    ? memoriaClientes.find((c) => c.id === p.board_client_id)
    : undefined;
  const atualizada: BoardOrder = cli
    ? {
        ...p,
        customer_name: cli.name,
        customer_phone: cli.phone,
        customer_kind: cli.kind,
        customer_city: cli.city,
        customer_document: p.customer_document ?? cli.document,
        customer_person_type: p.customer_document ? p.customer_person_type : cli.person_type,
        customer_address: p.customer_address ?? cli.address,
      }
    : { ...p };
  return {
    ...atualizada,
    days_since_entry: diasDesdeEntrada(atualizada),
    stalled: placaEncalhada(atualizada),
  };
}

function registrarEventoMemoria(evento: Omit<BoardEvent, 'id' | 'created_at'> & { created_at?: string }): BoardEvent {
  const criado: BoardEvent = {
    ...evento,
    id: gerarUuidDemo('bevt'),
    created_at: evento.created_at ?? new Date().toISOString(),
  };
  memoriaEventos = [criado, ...memoriaEventos];
  return criado;
}

function nomeTecnicoPorId(id: string | null | undefined): string | null {
  if (!id) return null;
  return TECNICOS_DEMO_PLACAS.find((t) => t.id === id)?.name ?? null;
}

function lerArquivoComoDataUrl(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result ?? ''));
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
    leitor.readAsDataURL(arquivo);
  });
}

function combinaBuscaPlaca(p: BoardOrder, termo: string): boolean {
  const limpo = semAcento(termo.trim());
  if (!limpo) return true;
  const alvo = semAcento(
    [
      p.board_number,
      p.customer_name,
      p.brand_model,
      p.equipment_type,
      p.board_code,
      p.error_code ?? '',
      p.os_number ? `os ${p.os_number}` : '',
    ].join(' '),
  );
  return alvo.includes(limpo);
}

// ============================================================================
// 1. PLACAS (KANBAN, FINALIZADAS, DETALHE, ETAPAS, ORÇAMENTO, REEMBOLSO)
// ============================================================================

async function listarPlacasDemo(filtro: BoardListFilter): Promise<BoardListResult> {
  await atraso(100);
  const todas = memoriaPlacas.filter((p) => !p.cancelled_entry).map(recalcularPlaca);

  if (filtro.aba === 'andamento') {
    const ativas = todas
      .filter((p) => !ehEtapaFinalPlaca(p.status) && !p.archived)
      .filter((p) => combinaBuscaPlaca(p, filtro.busca ?? ''))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const contagens = {
      todas: ativas.length,
      parceiros: ativas.filter((p) => p.customer_kind === 'instalador').length,
      final: ativas.filter((p) => p.customer_kind === 'final').length,
      garantias: ativas.filter((p) => p.is_warranty).length,
      encalhadas: ativas.filter((p) => p.stalled).length,
    };

    const recorte = filtro.recorte ?? 'todas';
    const recortadas = ativas.filter((p) => {
      if (recorte === 'parceiros') return p.customer_kind === 'instalador';
      if (recorte === 'final') return p.customer_kind === 'final';
      if (recorte === 'garantias') return p.is_warranty;
      if (recorte === 'encalhadas') return p.stalled;
      return true;
    });

    return {
      itens: recortadas,
      total: recortadas.length,
      por_pagina: PLACAS_FINALIZADAS_POR_PAGINA,
      contagens,
    };
  }

  // Aba Finalizadas (paginada em 50)
  const finalizadas = todas
    .filter((p) => ehEtapaFinalPlaca(p.status) || p.archived)
    .filter((p) => {
      if (filtro.desfecho && filtro.desfecho !== 'todas') {
        return p.status === filtro.desfecho;
      }
      return true;
    })
    .filter((p) => {
      if (!filtro.ano) return true;
      const refIso = p.finished_at ?? p.stage_changed_at ?? p.created_at;
      return new Date(refIso).getFullYear() === filtro.ano;
    })
    .filter((p) => combinaBuscaPlaca(p, filtro.busca ?? ''))
    .sort((a, b) => {
      const da = new Date(a.finished_at ?? a.stage_changed_at ?? a.created_at).getTime();
      const db = new Date(b.finished_at ?? b.stage_changed_at ?? b.created_at).getTime();
      return db - da;
    });

  const pagina = Math.max(1, filtro.pagina ?? 1);
  const inicio = (pagina - 1) * PLACAS_FINALIZADAS_POR_PAGINA;
  const itensPagina = finalizadas.slice(inicio, inicio + PLACAS_FINALIZADAS_POR_PAGINA);

  return {
    itens: itensPagina,
    total: finalizadas.length,
    por_pagina: PLACAS_FINALIZADAS_POR_PAGINA,
    contagens: { todas: 0, parceiros: 0, final: 0, garantias: 0, encalhadas: 0 },
  };
}

async function buscarPlacaDemo(id: string): Promise<BoardOrder | null> {
  await atraso(80);
  const encontrada = memoriaPlacas.find((p) => p.id === id);
  return encontrada ? recalcularPlaca(encontrada) : null;
}

async function criarPlacaDemo(
  dados: CreateBoardInput,
  atorNome = 'Atendimento BRV',
): Promise<BoardOrder> {
  await atraso(180);

  if (!dados.brand_model.trim()) {
    throw new Error('Informe a marca e o modelo do equipamento.');
  }
  if (!dados.board_code.trim()) {
    throw new Error('Informe o código da placa eletrônica.');
  }
  if (!dados.reported_defect.trim() && !dados.no_apparent_defect) {
    throw new Error('Descreva o defeito reclamado ou marque "Sem defeito aparente".');
  }

  let boardClientId: string | null = null;
  let customerId: string | null = null;
  let serviceOrderId: string | null = null;
  let osNumber: number | null = null;
  let customerName = '';
  let customerPhone: string | null = null;
  let customerKind: BoardCustomerKind = dados.customer_kind;
  let customerCity: string | null = dados.customer_city?.trim() || null;
  let customerDocument: string | null = null;
  let customerPersonType: 'PF' | 'PJ' = 'PF';
  let customerAddress: string | null = null;

  if (dados.origem === 'campo') {
    if (!dados.service_order_id) {
      throw new Error('Consulte e selecione a OS do BRV Control antes de salvar a placa.');
    }
    const osCtrl = OS_CONTROL_DEMO.find((o) => o.service_order_id === dados.service_order_id);
    if (!osCtrl) {
      throw new Error('OS do BRV Control não encontrada.');
    }
    customerId = osCtrl.customer_id;
    serviceOrderId = osCtrl.service_order_id;
    osNumber = osCtrl.os_number;
    customerName = osCtrl.customer_name;
    customerPhone = osCtrl.customer_phone;
    customerKind = 'final';
    customerCity = customerCity ?? osCtrl.city;
    customerDocument = osCtrl.customer_document;
    customerPersonType = osCtrl.customer_person_type;
    customerAddress = osCtrl.address_summary;
  } else {
    if (!dados.board_client_id) {
      throw new Error('Selecione o cliente de placas ou cadastre um novo.');
    }
    const cli = memoriaClientes.find((c) => c.id === dados.board_client_id);
    if (!cli) {
      throw new Error('Cliente de placas não encontrado.');
    }
    boardClientId = cli.id;
    customerName = cli.name;
    customerPhone = cli.phone;
    customerKind = dados.customer_kind || cli.kind;
    customerCity = customerCity ?? cli.city;
    customerDocument = cli.document;
    customerPersonType = cli.person_type;
    customerAddress = cli.address;
  }

  const agora = new Date();
  const agoraIso = agora.toISOString();
  const seq = proximaSequenciaDiaPlaca(
    memoriaPlacas.map((p) => p.board_number),
    agora,
  );
  const numeroPlaca = gerarNumeroPlaca(agora, seq);

  const origemGarantia =
    dados.is_warranty && dados.warranty_origin_id
      ? memoriaPlacas.find((p) => p.id === dados.warranty_origin_id)
      : undefined;

  const nova: BoardOrder = recalcularPlaca({
    id: gerarUuidDemo('placa'),
    board_number: numeroPlaca,
    public_token: gerarTokenPublico(),
    status: 'entrada',
    stage_changed_at: agoraIso,
    finished_at: null,
    archived: false,
    archived_at: null,
    cancelled_entry: false,
    cancel_reason: null,
    unrepaired_reason: null,
    board_client_id: boardClientId,
    customer_id: customerId,
    service_order_id: serviceOrderId,
    os_number: osNumber,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_kind: customerKind,
    customer_city: customerCity,
    customer_document: customerDocument,
    customer_person_type: customerPersonType,
    customer_address: customerAddress,
    equipment_type: dados.equipment_type.trim() || 'Split Inverter',
    brand_model: dados.brand_model.trim(),
    board_code: dados.board_code.trim(),
    peripherals: dados.peripherals?.trim() || null,
    reported_defect:
      dados.reported_defect.trim() || 'Sem defeito aparente na entrada (teste em bancada).',
    no_apparent_defect: dados.no_apparent_defect,
    pickup_technician_id: dados.pickup_technician_id || null,
    pickup_technician_name: nomeTecnicoPorId(dados.pickup_technician_id),
    bench_technician_id: dados.bench_technician_id || null,
    bench_technician_name: nomeTecnicoPorId(dados.bench_technician_id),
    error_code: dados.error_code?.trim() || null,
    technical_diagnosis: null,
    replaced_components: null,
    quote_status: 'nao_feito',
    quote_amount: null,
    quote_validity_days: 10,
    quote_technical_opinion: null,
    quote_sent_at: null,
    quote_responded_at: null,
    quote_response_channel: null,
    quote_response_notes: null,
    quote_responded_by_name: null,
    is_warranty: dados.is_warranty,
    warranty_origin_id: dados.is_warranty ? (origemGarantia?.id ?? null) : null,
    warranty_origin_number: dados.is_warranty ? (origemGarantia?.board_number ?? null) : null,
    charged_amount: dados.is_warranty ? 0 : null,
    refunded: false,
    refund_amount: null,
    refunded_at: null,
    refund_reason: null,
    days_since_entry: 0,
    stalled: false,
    created_at: agoraIso,
    updated_at: agoraIso,
  });

  memoriaPlacas = [nova, ...memoriaPlacas];

  if (dados.entry_photos && dados.entry_photos.length > 0) {
    for (const itemFoto of dados.entry_photos) {
      const urlLocal = await lerArquivoComoDataUrl(itemFoto.file);
      const registroFoto: BoardPhoto = {
        id: gerarUuidDemo('bfoto'),
        board_order_id: nova.id,
        category: 'antes',
        public_url: urlLocal,
        file_name: itemFoto.file.name,
        caption: itemFoto.caption?.trim() || 'Foto de entrada na triagem',
        stage_at_capture: 'entrada',
        uploaded_by_name: atorNome,
        created_at: agoraIso,
      };
      memoriaFotos = [registroFoto, ...memoriaFotos];
    }
  }

  registrarEventoMemoria({
    board_order_id: nova.id,
    event_type: 'entrada',
    from_stage: null,
    to_stage: 'entrada',
    field_name: null,
    old_value: null,
    new_value: null,
    note:
      dados.origem === 'campo' && osNumber
        ? `Entrada vinculada à OS ${osNumber} do BRV Control (${customerName}).`
        : dados.is_warranty
          ? `Entrada em garantia${origemGarantia ? ` vinculada à ${origemGarantia.board_number}` : ''}.`
          : `Entrada cadastrada no balcão (${customerName}).`,
    visibility: 'todos',
    actor_name: atorNome,
    created_at: agoraIso,
  });

  return nova;
}

async function atualizarPlacaDemo(
  id: string,
  campos: UpdateBoardFields,
  opcoes?: { papel?: ProfileRole; atorNome?: string },
): Promise<BoardOrder> {
  await atraso(140);
  const idx = memoriaPlacas.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('Placa não encontrada.');

  const atual = memoriaPlacas[idx];
  if (ehEtapaFinalPlaca(atual.status)) {
    throw new Error('Placa finalizada está em modo somente leitura.');
  }

  const papel = opcoes?.papel ?? 'admin';
  const atorNome = opcoes?.atorNome ?? 'Usuário BRV';
  const copia: BoardOrder = { ...atual };

  const registrarSeMudou = (
    chave: string,
    antes: string | null | undefined,
    depois: string | null | undefined,
    visibilidade: BoardEvent['visibility'] = 'todos',
  ) => {
    const a = (antes ?? '').trim();
    const d = (depois ?? '').trim();
    if (a === d) return;
    registrarEventoMemoria({
      board_order_id: id,
      event_type: 'edicao_campo',
      from_stage: null,
      to_stage: null,
      field_name: chave,
      old_value: a || '—',
      new_value: d || '—',
      note: null,
      visibility: visibilidade,
      actor_name: atorNome,
    });
  };

  if (campos.equipment_type !== undefined) {
    registrarSeMudou('equipment_type', copia.equipment_type, campos.equipment_type);
    copia.equipment_type = campos.equipment_type.trim() || 'Split Inverter';
  }
  if (campos.brand_model !== undefined) {
    if (!campos.brand_model.trim()) throw new Error('Marca / modelo não pode ficar em branco.');
    registrarSeMudou('brand_model', copia.brand_model, campos.brand_model);
    copia.brand_model = campos.brand_model.trim();
  }
  if (campos.board_code !== undefined) {
    if (!campos.board_code.trim()) throw new Error('O código da placa não pode ficar em branco.');
    registrarSeMudou('board_code', copia.board_code, campos.board_code);
    copia.board_code = campos.board_code.trim();
  }
  if (campos.peripherals !== undefined) {
    registrarSeMudou('peripherals', copia.peripherals, campos.peripherals);
    copia.peripherals = campos.peripherals?.trim() || null;
  }
  if (campos.reported_defect !== undefined) {
    registrarSeMudou('reported_defect', copia.reported_defect, campos.reported_defect);
    copia.reported_defect = campos.reported_defect.trim();
  }
  if (campos.no_apparent_defect !== undefined && campos.no_apparent_defect !== copia.no_apparent_defect) {
    registrarSeMudou(
      'no_apparent_defect',
      copia.no_apparent_defect ? 'Sim' : 'Não',
      campos.no_apparent_defect ? 'Sim' : 'Não',
    );
    copia.no_apparent_defect = campos.no_apparent_defect;
  }
  if (campos.pickup_technician_id !== undefined) {
    const novoNome = nomeTecnicoPorId(campos.pickup_technician_id);
    registrarSeMudou('pickup_technician_id', copia.pickup_technician_name, novoNome);
    copia.pickup_technician_id = campos.pickup_technician_id || null;
    copia.pickup_technician_name = novoNome;
  }
  if (campos.bench_technician_id !== undefined) {
    const novoNome = nomeTecnicoPorId(campos.bench_technician_id);
    registrarSeMudou('bench_technician_id', copia.bench_technician_name, novoNome);
    copia.bench_technician_id = campos.bench_technician_id || null;
    copia.bench_technician_name = novoNome;
  }
  if (campos.error_code !== undefined) {
    registrarSeMudou('error_code', copia.error_code, campos.error_code);
    copia.error_code = campos.error_code?.trim().toUpperCase() || null;
  }
  if (campos.technical_diagnosis !== undefined) {
    registrarSeMudou('technical_diagnosis', copia.technical_diagnosis, campos.technical_diagnosis);
    copia.technical_diagnosis = campos.technical_diagnosis?.trim() || null;
  }
  if (campos.replaced_components !== undefined) {
    registrarSeMudou('replaced_components', copia.replaced_components, campos.replaced_components);
    copia.replaced_components = campos.replaced_components?.trim() || null;
  }

  // Papel `oficina` nunca altera valor cobrado/orçamento/reembolso
  if (campos.charged_amount !== undefined && papel !== 'oficina') {
    const antesFmt = copia.charged_amount != null ? valorEmReais(copia.charged_amount) : '—';
    const depoisFmt = campos.charged_amount != null ? valorEmReais(campos.charged_amount) : '—';
    registrarSeMudou('charged_amount', antesFmt, depoisFmt, 'financeiro');
    copia.charged_amount = campos.charged_amount;
  }

  copia.updated_at = new Date().toISOString();
  const recalculada = recalcularPlaca(copia);
  memoriaPlacas[idx] = recalculada;
  return recalculada;
}

async function moverPlacaDemo(
  id: string,
  etapa: BoardStage,
  extra?: MoveBoardExtra,
  opcoes?: { papel?: ProfileRole; atorNome?: string },
): Promise<BoardOrder> {
  await atraso(130);
  const idx = memoriaPlacas.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('Placa não encontrada.');

  const atual = memoriaPlacas[idx];
  const papel = opcoes?.papel ?? 'admin';
  const atorNome = opcoes?.atorNome ?? 'Usuário BRV';

  const bloqueio = motivoBloqueioPlaca(atual, etapa, papel);
  if (bloqueio) {
    throw new Error(bloqueio);
  }

  if (etapa === 'sem_conserto' && !extra?.unrepaired_reason?.trim()) {
    throw new Error('Informe o motivo de sem conserto ou devolução.');
  }

  const agoraIso = new Date().toISOString();
  const dataSaidaIso =
    etapa === 'entregue'
      ? extra?.finished_at
        ? new Date(`${extra.finished_at}T12:00:00`).toISOString()
        : agoraIso
      : etapa === 'sem_conserto'
        ? agoraIso
        : null;

  const etapaAnterior = atual.status;
  const atualizada: BoardOrder = recalcularPlaca({
    ...atual,
    status: etapa,
    stage_changed_at: dataSaidaIso ?? agoraIso,
    finished_at: ehEtapaFinalPlaca(etapa) ? (dataSaidaIso ?? agoraIso) : null,
    unrepaired_reason:
      etapa === 'sem_conserto' ? (extra?.unrepaired_reason?.trim() ?? null) : atual.unrepaired_reason,
    charged_amount:
      etapa === 'entregue'
        ? (extra?.charged_amount ?? atual.charged_amount ?? atual.quote_amount)
        : atual.charged_amount,
    updated_at: agoraIso,
  });

  memoriaPlacas[idx] = atualizada;

  registrarEventoMemoria({
    board_order_id: id,
    event_type: 'mudanca_etapa',
    from_stage: etapaAnterior,
    to_stage: etapa,
    field_name: null,
    old_value: ROTULO_ETAPA_PLACA[etapaAnterior],
    new_value: ROTULO_ETAPA_PLACA[etapa],
    note:
      etapa === 'sem_conserto'
        ? `Motivo: ${extra?.unrepaired_reason?.trim()}`
        : etapa === 'entregue'
          ? 'Placa entregue e garantia de 90 dias iniciada.'
          : null,
    visibility: 'todos',
    actor_name: atorNome,
    created_at: agoraIso,
  });

  return atualizada;
}

async function registrarOrcamentoDemo(
  id: string,
  dados: BoardQuoteInput,
  atorNome = 'Escritório BRV',
): Promise<BoardOrder> {
  await atraso(140);
  const idx = memoriaPlacas.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('Placa não encontrada.');

  const atual = memoriaPlacas[idx];
  if (atual.is_warranty) {
    throw new Error('Placa em garantia não gera orçamento.');
  }
  if (!Number.isFinite(dados.quote_amount) || dados.quote_amount <= 0) {
    throw new Error('Informe um valor de orçamento maior que zero.');
  }
  if (!dados.quote_technical_opinion.trim()) {
    throw new Error('Preencha o parecer técnico que constará no orçamento.');
  }

  const tipoDoc = dados.customer_person_type ?? atual.customer_person_type ?? 'PF';
  const docLimpo = dados.customer_document
    ? limparDocumento(dados.customer_document, tipoDoc)
    : null;

  const agoraIso = new Date().toISOString();
  const antesFmt = atual.quote_amount != null ? valorEmReais(atual.quote_amount) : '—';
  const depoisFmt = valorEmReais(dados.quote_amount);

  const atualizada = recalcularPlaca({
    ...atual,
    quote_amount: dados.quote_amount,
    quote_validity_days: Math.max(1, Math.floor(dados.quote_validity_days || 10)),
    customer_document: docLimpo,
    customer_person_type: tipoDoc,
    customer_address: dados.customer_address?.trim() || null,
    quote_technical_opinion: dados.quote_technical_opinion.trim(),
    updated_at: agoraIso,
  });

  memoriaPlacas[idx] = atualizada;

  registrarEventoMemoria({
    board_order_id: id,
    event_type: 'orcamento',
    from_stage: null,
    to_stage: null,
    field_name: 'quote_amount',
    old_value: antesFmt,
    new_value: depoisFmt,
    note: `Orçamento salvo com validade de ${atualizada.quote_validity_days} dias.`,
    visibility: 'escritorio',
    actor_name: atorNome,
    created_at: agoraIso,
  });

  return atualizada;
}

async function registrarEnvioOrcamentoDemo(
  id: string,
  atorNome = 'Escritório BRV',
): Promise<BoardOrder> {
  await atraso(100);
  const idx = memoriaPlacas.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('Placa não encontrada.');

  const atual = memoriaPlacas[idx];
  if (atual.quote_amount == null || atual.quote_amount <= 0) {
    throw new Error('Salve o valor e o parecer técnico do orçamento antes de enviá-lo.');
  }

  const agoraIso = new Date().toISOString();
  const novoStatus = atual.quote_status === 'aprovado' ? 'aprovado' : 'enviado';
  const atualizada = recalcularPlaca({
    ...atual,
    quote_status: novoStatus,
    quote_sent_at: agoraIso,
    updated_at: agoraIso,
  });
  memoriaPlacas[idx] = atualizada;

  registrarEventoMemoria({
    board_order_id: id,
    event_type: 'envio_orcamento',
    from_stage: null,
    to_stage: null,
    field_name: 'quote_status',
    old_value: atual.quote_status,
    new_value: novoStatus,
    note: `Orçamento (${valorEmReais(atual.quote_amount)}) enviado pelo WhatsApp.`,
    visibility: 'escritorio',
    actor_name: atorNome,
    created_at: agoraIso,
  });

  return atualizada;
}

async function registrarRespostaOrcamentoDemo(
  id: string,
  dados: BoardQuoteResponseInput,
  atorNome = 'Escritório BRV',
): Promise<BoardOrder> {
  await atraso(130);
  const idx = memoriaPlacas.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('Placa não encontrada.');

  const atual = memoriaPlacas[idx];
  if (atual.quote_amount == null || atual.quote_amount <= 0) {
    throw new Error('Registre o valor do orçamento antes de salvar a resposta do cliente.');
  }

  const agoraIso = new Date().toISOString();
  const atualizada = recalcularPlaca({
    ...atual,
    quote_status: dados.decision,
    quote_responded_at: agoraIso,
    quote_response_channel: dados.channel,
    quote_response_notes: dados.notes?.trim() || null,
    quote_responded_by_name: atorNome,
    updated_at: agoraIso,
  });
  memoriaPlacas[idx] = atualizada;

  registrarEventoMemoria({
    board_order_id: id,
    event_type: 'resposta_orcamento',
    from_stage: null,
    to_stage: null,
    field_name: 'quote_status',
    old_value: atual.quote_status,
    new_value: dados.decision,
    note: `Cliente ${dados.decision === 'aprovado' ? 'APROVOU' : 'RECUSOU'} via ${dados.channel}${dados.notes?.trim() ? ` — ${dados.notes.trim()}` : ''}.`,
    visibility: 'escritorio',
    actor_name: atorNome,
    created_at: agoraIso,
  });

  return atualizada;
}

async function registrarReembolsoDemo(
  id: string,
  dados: BoardRefundInput,
  atorNome = 'Braulio',
): Promise<BoardOrder> {
  await atraso(130);
  const idx = memoriaPlacas.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('Placa não encontrada.');

  if (dados.refunded) {
    if (!dados.refund_amount || dados.refund_amount <= 0) {
      throw new Error('Informe o valor reembolsado maior que zero.');
    }
    if (!dados.refunded_at) {
      throw new Error('Informe a data do reembolso.');
    }
    if (!dados.refund_reason?.trim()) {
      throw new Error('Informe o motivo do reembolso.');
    }
  }

  const atual = memoriaPlacas[idx];
  const agoraIso = new Date().toISOString();
  const atualizada = recalcularPlaca({
    ...atual,
    refunded: dados.refunded,
    refund_amount: dados.refunded ? dados.refund_amount : null,
    refunded_at: dados.refunded ? dados.refunded_at : null,
    refund_reason: dados.refunded ? (dados.refund_reason?.trim() ?? null) : null,
    updated_at: agoraIso,
  });
  memoriaPlacas[idx] = atualizada;

  registrarEventoMemoria({
    board_order_id: id,
    event_type: 'reembolso',
    from_stage: null,
    to_stage: null,
    field_name: 'refunded',
    old_value: atual.refunded ? valorEmReais(atual.refund_amount) : 'Não reembolsada',
    new_value: dados.refunded ? valorEmReais(dados.refund_amount) : 'Reembolso removido',
    note: dados.refunded ? `Motivo: ${dados.refund_reason?.trim()}` : 'Marcação de reembolso desfeita.',
    visibility: 'financeiro',
    actor_name: atorNome,
    created_at: agoraIso,
  });

  return atualizada;
}

async function arquivarPlacaDemo(id: string, atorNome = 'Escritório BRV'): Promise<BoardOrder> {
  await atraso(100);
  const idx = memoriaPlacas.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('Placa não encontrada.');

  const agoraIso = new Date().toISOString();
  const atual = memoriaPlacas[idx];
  const atualizada = recalcularPlaca({
    ...atual,
    archived: true,
    archived_at: agoraIso,
    updated_at: agoraIso,
  });
  memoriaPlacas[idx] = atualizada;

  registrarEventoMemoria({
    board_order_id: id,
    event_type: 'arquivamento',
    from_stage: null,
    to_stage: null,
    field_name: null,
    old_value: null,
    new_value: null,
    note: 'Placa arquivada.',
    visibility: 'todos',
    actor_name: atorNome,
    created_at: agoraIso,
  });

  return atualizada;
}

async function cancelarPlacaDemo(
  id: string,
  motivo: string,
  atorNome = 'Escritório BRV',
): Promise<BoardOrder> {
  await atraso(120);
  if (!motivo.trim()) {
    throw new Error('Informe o motivo do cancelamento da entrada.');
  }
  const idx = memoriaPlacas.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('Placa não encontrada.');

  const agoraIso = new Date().toISOString();
  const atual = memoriaPlacas[idx];
  const atualizada = recalcularPlaca({
    ...atual,
    cancelled_entry: true,
    cancel_reason: motivo.trim(),
    archived: true,
    archived_at: agoraIso,
    updated_at: agoraIso,
  });
  memoriaPlacas[idx] = atualizada;

  registrarEventoMemoria({
    board_order_id: id,
    event_type: 'cancelamento',
    from_stage: atual.status,
    to_stage: null,
    field_name: null,
    old_value: null,
    new_value: null,
    note: `Entrada cancelada: ${motivo.trim()}`,
    visibility: 'todos',
    actor_name: atorNome,
    created_at: agoraIso,
  });

  return atualizada;
}

async function reabrirPlacaDemo(
  id: string,
  opcoes?: { papel?: ProfileRole; atorNome?: string },
): Promise<BoardOrder> {
  await atraso(120);
  if (opcoes?.papel && opcoes.papel !== 'admin') {
    throw new Error('Apenas administradores podem reabrir uma placa finalizada.');
  }
  const idx = memoriaPlacas.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('Placa não encontrada.');

  const atual = memoriaPlacas[idx];
  const agoraIso = new Date().toISOString();
  const etapaRetorno: BoardStage = atual.status === 'entregue' ? 'pronto' : 'diagnostico';

  const atualizada = recalcularPlaca({
    ...atual,
    status: etapaRetorno,
    stage_changed_at: agoraIso,
    finished_at: null,
    archived: false,
    archived_at: null,
    cancelled_entry: false,
    updated_at: agoraIso,
  });
  memoriaPlacas[idx] = atualizada;

  registrarEventoMemoria({
    board_order_id: id,
    event_type: 'reabertura',
    from_stage: atual.status,
    to_stage: etapaRetorno,
    field_name: null,
    old_value: ROTULO_ETAPA_PLACA[atual.status],
    new_value: ROTULO_ETAPA_PLACA[etapaRetorno],
    note: 'Placa reaberta pelo administrador e devolvida ao Kanban.',
    visibility: 'todos',
    actor_name: opcoes?.atorNome ?? 'Administrador',
    created_at: agoraIso,
  });

  return atualizada;
}

async function gerarNovoLinkAcompanhamentoDemo(
  id: string,
  atorNome = 'Escritório BRV',
): Promise<BoardOrder> {
  await atraso(110);
  const idx = memoriaPlacas.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('Placa não encontrada.');

  const agoraIso = new Date().toISOString();
  const atual = memoriaPlacas[idx];
  const novoToken = gerarTokenPublico();
  const atualizada = recalcularPlaca({
    ...atual,
    public_token: novoToken,
    updated_at: agoraIso,
  });
  memoriaPlacas[idx] = atualizada;

  registrarEventoMemoria({
    board_order_id: id,
    event_type: 'novo_link',
    from_stage: null,
    to_stage: null,
    field_name: null,
    old_value: null,
    new_value: null,
    note: 'Novo link público de acompanhamento gerado (o anterior foi revogado).',
    visibility: 'todos',
    actor_name: atorNome,
    created_at: agoraIso,
  });

  return atualizada;
}

async function anotarNoHistoricoDemo(
  id: string,
  nota: string,
  atorNome = 'Usuário BRV',
): Promise<BoardEvent> {
  await atraso(90);
  if (!nota.trim()) {
    throw new Error('Digite uma anotação antes de salvar.');
  }
  return registrarEventoMemoria({
    board_order_id: id,
    event_type: 'nota',
    from_stage: null,
    to_stage: null,
    field_name: null,
    old_value: null,
    new_value: null,
    note: nota.trim(),
    visibility: 'todos',
    actor_name: atorNome,
  });
}

async function historicoDaPlacaDemo(id: string): Promise<BoardEvent[]> {
  await atraso(70);
  return memoriaEventos
    .filter((e) => e.board_order_id === id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// ============================================================================
// 2. FOTOS DA PLACA
// ============================================================================

async function fotosDaPlacaDemo(id: string): Promise<BoardPhoto[]> {
  await atraso(70);
  return memoriaFotos
    .filter((f) => f.board_order_id === id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

async function anexarFotoPlacaDemo(
  arquivo: File,
  id: string,
  categoria: BoardPhotoCategory,
  legenda?: string,
  atorNome = 'Usuário BRV',
): Promise<BoardPhoto> {
  await atraso(150);
  if (!arquivo.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem válido (JPG, PNG, WEBP ou SVG).');
  }
  const placa = memoriaPlacas.find((p) => p.id === id);
  if (!placa) throw new Error('Placa não encontrada.');

  const urlLocal = await lerArquivoComoDataUrl(arquivo);
  const novaFoto: BoardPhoto = {
    id: gerarUuidDemo('bfoto'),
    board_order_id: id,
    category: categoria,
    public_url: urlLocal,
    file_name: arquivo.name,
    caption: legenda?.trim() || null,
    stage_at_capture: placa.status,
    uploaded_by_name: atorNome,
    created_at: new Date().toISOString(),
  };
  memoriaFotos = [novaFoto, ...memoriaFotos];
  return novaFoto;
}

async function excluirFotoPlacaDemo(fotoId: string): Promise<void> {
  await atraso(90);
  memoriaFotos = memoriaFotos.filter((f) => f.id !== fotoId);
}

// ============================================================================
// 3. CLIENTES DE PLACAS (`board_clients`) E OS DO CONTROL
// ============================================================================

function montarClienteComContagem(
  base: Omit<BoardClient, 'board_count' | 'last_board_at'>,
): BoardClient {
  const placasCli = memoriaPlacas.filter(
    (p) => !p.cancelled_entry && p.board_client_id === base.id,
  );
  let ultima: string | null = null;
  for (const p of placasCli) {
    if (!ultima || new Date(p.created_at).getTime() > new Date(ultima).getTime()) {
      ultima = p.created_at;
    }
  }
  return {
    ...base,
    board_count: placasCli.length,
    last_board_at: ultima,
  };
}

async function listarClientesPlacasDemo(filtro?: {
  busca?: string;
  tipo?: 'todos' | BoardCustomerKind;
}): Promise<BoardClient[]> {
  await atraso(90);
  const termo = semAcento(filtro?.busca?.trim() ?? '');
  const digitosBusca = (filtro?.busca ?? '').replace(/\D/g, '');
  const tipo = filtro?.tipo ?? 'todos';

  return memoriaClientes
    .map(montarClienteComContagem)
    .filter((c) => {
      if (tipo !== 'todos' && c.kind !== tipo) return false;
      if (!termo) return true;
      const textoCliente = semAcento(`${c.name} ${c.city ?? ''} ${c.phone}`);
      const digitosTel = c.phone.replace(/\D/g, '');
      return (
        textoCliente.includes(termo) ||
        (digitosBusca.length >= 3 && digitosTel.includes(digitosBusca))
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

async function salvarClientePlacaDemo(dados: BoardClientInput): Promise<BoardClient> {
  await atraso(130);
  if (!dados.name.trim()) {
    throw new Error('Informe o nome do cliente ou parceiro instalador.');
  }
  const telFormatado = formatarTelefone(dados.phone);
  if (telFormatado.replace(/\D/g, '').length < 10) {
    throw new Error('Informe um telefone válido com DDD.');
  }

  const agoraIso = new Date().toISOString();
  const personType = dados.person_type ?? 'PF';
  const docLimpo = dados.document ? limparDocumento(dados.document, personType) : null;

  if (dados.id) {
    const idx = memoriaClientes.findIndex((c) => c.id === dados.id);
    if (idx === -1) throw new Error('Cliente não encontrado.');
    const atualizado = {
      ...memoriaClientes[idx],
      name: dados.name.trim(),
      phone: telFormatado,
      kind: dados.kind,
      city: dados.city?.trim() || null,
      document: docLimpo,
      person_type: personType,
      address: dados.address?.trim() || null,
      notes: dados.notes?.trim() || null,
      updated_at: agoraIso,
    };
    memoriaClientes[idx] = atualizado;
    return montarClienteComContagem(atualizado);
  }

  const criado: Omit<BoardClient, 'board_count' | 'last_board_at'> = {
    id: gerarUuidDemo('bcli'),
    name: dados.name.trim(),
    phone: telFormatado,
    kind: dados.kind,
    city: dados.city?.trim() || null,
    document: docLimpo,
    person_type: personType,
    address: dados.address?.trim() || null,
    notes: dados.notes?.trim() || null,
    created_at: agoraIso,
    updated_at: agoraIso,
  };
  memoriaClientes = [criado, ...memoriaClientes];
  return montarClienteComContagem(criado);
}

async function excluirClientePlacaDemo(id: string): Promise<void> {
  await atraso(110);
  const vinculadas = memoriaPlacas.filter(
    (p) => !p.cancelled_entry && p.board_client_id === id,
  );
  if (vinculadas.length > 0) {
    throw new Error(
      `Não é possível excluir este cliente porque ele já possui ${vinculadas.length} placa(s) registrada(s) no histórico.`,
    );
  }
  memoriaClientes = memoriaClientes.filter((c) => c.id !== id);
}

async function placasDoClienteDemo(clienteId: string): Promise<BoardOrder[]> {
  await atraso(80);
  return memoriaPlacas
    .filter((p) => !p.cancelled_entry && p.board_client_id === clienteId)
    .map(recalcularPlaca)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

async function buscarOsControlDemo(numero: number | string): Promise<BoardControlOsLookup | null> {
  await atraso(140);
  const numLimpo = Number.parseInt(String(numero).replace(/\D/g, ''), 10);
  if (Number.isNaN(numLimpo)) return null;

  const encontrada = OS_CONTROL_DEMO.find((o) => o.os_number === numLimpo);
  if (!encontrada) return null;

  const existentes = memoriaPlacas
    .filter((p) => !p.cancelled_entry && p.service_order_id === encontrada.service_order_id)
    .map((p) => p.board_number);

  return {
    ...encontrada,
    existing_board_numbers: existentes,
  };
}

async function listarTecnicosDemo(): Promise<BoardTechnicianOption[]> {
  await atraso(60);
  return [...TECNICOS_DEMO_PLACAS];
}

// ============================================================================
// 4. FINANCEIRO DAS PLACAS
// ============================================================================

async function listarPlacasParaFinanceiroDemo(ano: number): Promise<BoardOrder[]> {
  await atraso(110);
  return memoriaPlacas
    .filter((p) => {
      if (p.cancelled_entry) return false;
      const ativa = !ehEtapaFinalPlaca(p.status) && !p.archived;
      if (ativa) return true;
      const anoSaida = new Date(p.finished_at ?? p.stage_changed_at ?? p.created_at).getFullYear();
      const anoReembolso = p.refunded_at ? Number(p.refunded_at.slice(0, 4)) : null;
      return anoSaida === ano || anoReembolso === ano;
    })
    .map(recalcularPlaca);
}

// ============================================================================
// 5. APOIO TÉCNICO: FICHAS, IA DE FICHAS, ERROS, ASSISTENTE E MANUAIS
// ============================================================================

async function listarFichasDemo(filtro?: FiltroFichasPlacas): Promise<PlacaFichaTecnica[]> {
  await atraso(90);
  const busca = semAcento(filtro?.busca?.trim() ?? '');
  const fab = semAcento(filtro?.fabricante?.trim() ?? '');
  const btusDigitos = (filtro?.btus ?? '').replace(/\D/g, '');

  return memoriaFichas
    .filter((f) => {
      if (fab && semAcento(f.fabricante) !== fab) return false;
      if (btusDigitos) {
        const capDigitos = (f.capacidade_btu ?? '').replace(/\D/g, '');
        if (capDigitos !== btusDigitos) return false;
      }
      if (!busca) return true;
      const alvo = semAcento(
        [
          f.fabricante,
          f.linha,
          f.tipo_split,
          f.capacidade_btu,
          f.evaporadora,
          f.condensadora,
          f.ref_evaporadora,
          f.ref_condensadora,
          f.gas,
        ]
          .filter(Boolean)
          .join(' '),
      );
      return alvo.includes(busca);
    })
    .sort((a, b) =>
      `${a.fabricante} ${a.linha ?? ''} ${a.capacidade_btu ?? ''}`.localeCompare(
        `${b.fabricante} ${b.linha ?? ''} ${b.capacidade_btu ?? ''}`,
        'pt-BR',
      ),
    );
}

async function buscarFichaDemo(id: string): Promise<PlacaFichaTecnica | null> {
  await atraso(60);
  return memoriaFichas.find((f) => f.id === id) ?? null;
}

async function salvarFichaDemo(
  dados: PlacaFichaInput,
  papel: ProfileRole = 'admin',
): Promise<PlacaFichaTecnica> {
  await atraso(140);
  // Edição só para admin; criação com IA é liberada para admin e escritório (seções 3.11 e 3.12)
  if (dados.id && papel !== 'admin') {
    throw new Error('Apenas administradores podem editar fichas técnicas já cadastradas.');
  }
  if (!dados.id && papel !== 'admin' && papel !== 'escritorio') {
    throw new Error('Seu perfil não possui permissão para cadastrar fichas técnicas.');
  }
  if (!dados.fabricante.trim()) {
    throw new Error('Informe o fabricante do equipamento.');
  }
  if (!dados.evaporadora?.trim() && !dados.condensadora?.trim()) {
    throw new Error('Informe ao menos o modelo da evaporadora ou da condensadora.');
  }

  const normalizar = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

  const limpa: Omit<PlacaFichaTecnica, 'id' | 'created_at'> = {
    fabricante: dados.fabricante.trim(),
    linha: normalizar(dados.linha),
    tipo_split: normalizar(dados.tipo_split),
    capacidade_btu: normalizar(dados.capacidade_btu),
    capacidade_w: normalizar(dados.capacidade_w),
    evaporadora: normalizar(dados.evaporadora),
    medida_evaporadora: normalizar(dados.medida_evaporadora),
    ref_evaporadora: normalizar(dados.ref_evaporadora),
    condensadora: normalizar(dados.condensadora),
    medida_condensadora: normalizar(dados.medida_condensadora),
    ref_condensadora: normalizar(dados.ref_condensadora),
    revisao_manual: normalizar(dados.revisao_manual),
    gas: normalizar(dados.gas),
    cobre_liquido: normalizar(dados.cobre_liquido),
    cobre_succao: normalizar(dados.cobre_succao),
    dist_min: normalizar(dados.dist_min),
    dist_padrao: normalizar(dados.dist_padrao),
    dist_max: normalizar(dados.dist_max),
    desnivel_max: normalizar(dados.desnivel_max),
    carga_fabrica: normalizar(dados.carga_fabrica),
    carga_extra: normalizar(dados.carga_extra),
    regra_bitola: normalizar(dados.regra_bitola),
    tensao: normalizar(dados.tensao),
    alimentacao_em: normalizar(dados.alimentacao_em),
    p_nominal: normalizar(dados.p_nominal),
    p_max_dim: normalizar(dados.p_max_dim),
    i_refrigeracao: normalizar(dados.i_refrigeracao),
    i_aquecimento: normalizar(dados.i_aquecimento),
    i_max_dim: normalizar(dados.i_max_dim),
    origem_eletrica: normalizar(dados.origem_eletrica),
    cabo_alimentacao: normalizar(dados.cabo_alimentacao),
    cabo_interligacao: normalizar(dados.cabo_interligacao),
    protecao: normalizar(dados.protecao),
    observacao: normalizar(dados.observacao),
    lacunas: normalizar(dados.lacunas),
    fonte: normalizar(dados.fonte),
    arquivo_original_url: normalizar(dados.arquivo_original_url),
  };

  if (dados.id) {
    const idx = memoriaFichas.findIndex((f) => f.id === dados.id);
    if (idx === -1) throw new Error('Ficha técnica não encontrada.');
    const atualizada: PlacaFichaTecnica = {
      ...memoriaFichas[idx],
      ...limpa,
    };
    memoriaFichas[idx] = atualizada;
    return atualizada;
  }

  const nova: PlacaFichaTecnica = {
    id: gerarUuidDemo('ficha'),
    ...limpa,
    created_at: new Date().toISOString(),
  };
  memoriaFichas = [nova, ...memoriaFichas];
  return nova;
}

async function excluirFichaDemo(id: string, papel: ProfileRole = 'admin'): Promise<void> {
  await atraso(100);
  if (papel !== 'admin') {
    throw new Error('Apenas administradores podem excluir fichas técnicas.');
  }
  memoriaFichas = memoriaFichas.filter((f) => f.id !== id);
}

/**
 * TODO(Claude): ligar à Edge Function `extrair-ficha` (Gemini) no Supabase.
 * Na demonstração valida tipo/tamanho, aguarda 2 s e devolve ficha pré-preenchida fixa com `lacunas`.
 */
async function extrairFichaDoManualDemo(arquivo: File): Promise<ExtracaoFichaManualResultado> {
  const nome = arquivo.name.toLowerCase();
  const formatoAceito =
    arquivo.type === 'application/pdf' ||
    arquivo.type === 'text/plain' ||
    nome.endsWith('.pdf') ||
    nome.endsWith('.txt');

  if (!formatoAceito) {
    throw new Error('Formato não suportado. Envie apenas arquivos PDF ou TXT.');
  }
  if (arquivo.size > TAMANHO_MAX_MANUAL_BYTES) {
    throw new Error('Este arquivo é muito grande (máximo de 20 MB).');
  }
  if (arquivo.size === 0) {
    throw new Error('Não foi possível ler este arquivo.');
  }

  await atraso(2000);
  return gerarExtracaoFichaDemo(arquivo.name);
}

/**
 * TODO(Claude): ligar à Edge Function `consultar-erro` (busca nos manuais + Gemini).
 * Na demonstração aguarda 1,5 s e devolve uma das 3 respostas estruturadas coerentes.
 */
async function consultarCodigoErroDemo(
  dados: ConsultaCodigoErroInput,
): Promise<ResultadoConsultaErro> {
  if (!dados.marca.trim()) {
    throw new Error('Informe a marca do equipamento.');
  }
  if (!dados.consulta.trim()) {
    throw new Error('Informe o código de erro ou sintoma observado.');
  }
  await atraso(1500);
  return obterRespostaErroDemo(dados.marca, dados.modelo, dados.consulta);
}

async function listarManuaisDemo(filtro?: {
  busca?: string;
  fabricante?: string;
}): Promise<PlacaManual[]> {
  await atraso(80);
  const busca = semAcento(filtro?.busca?.trim() ?? '');
  const fab = semAcento(filtro?.fabricante?.trim() ?? '');

  return memoriaManuais
    .filter((m) => {
      if (fab && semAcento(m.manufacturer) !== fab) return false;
      if (!busca) return true;
      return semAcento(`${m.manufacturer} ${m.title} ${m.file_name}`).includes(busca);
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

async function enviarManualDemo(
  arquivo: File,
  dados: EnviarManualPlacaInput,
  atorNome = 'Escritório BRV',
): Promise<PlacaManual> {
  await atraso(200);
  if (!dados.manufacturer.trim()) {
    throw new Error('Informe o fabricante do manual.');
  }
  if (!dados.title.trim()) {
    throw new Error('Informe o título ou linha de modelos do manual.');
  }
  const nome = arquivo.name.toLowerCase();
  const ehPdf = arquivo.type === 'application/pdf' || nome.endsWith('.pdf');
  const ehTxt = arquivo.type === 'text/plain' || nome.endsWith('.txt');
  if (!ehPdf && !ehTxt) {
    throw new Error('Envie apenas manuais nos formatos PDF ou TXT.');
  }
  if (arquivo.size > TAMANHO_MAX_MANUAL_BYTES) {
    throw new Error('O manual excede o tamanho máximo de 20 MB.');
  }

  const urlLocal = await lerArquivoComoDataUrl(arquivo);
  const novo: PlacaManual = {
    id: gerarUuidDemo('man'),
    manufacturer: dados.manufacturer.trim(),
    title: dados.title.trim(),
    file_name: arquivo.name,
    file_type: ehPdf ? 'PDF' : 'TXT',
    file_size_bytes: arquivo.size,
    file_url: urlLocal,
    // TODO(Claude): extração real do texto do PDF/TXT no servidor ao subir para a HostGator
    has_extracted_text: true,
    uploaded_by_name: atorNome,
    created_at: new Date().toISOString(),
  };
  memoriaManuais = [novo, ...memoriaManuais];
  return novo;
}

async function excluirManualDemo(id: string, papel: ProfileRole = 'admin'): Promise<void> {
  await atraso(90);
  if (papel !== 'admin') {
    throw new Error('Apenas administradores podem excluir manuais.');
  }
  memoriaManuais = memoriaManuais.filter((m) => m.id !== id);
}

// ============================================================================
// 6. ACOMPANHAMENTO PÚBLICO (`/placa/:token`) — DADOS ESTRITAMENTE SEGUROS
// ============================================================================

async function buscarAcompanhamentoPublicoDemo(
  token: string,
): Promise<BoardPublicTracking | null> {
  await atraso(140);
  const limpo = token.trim();
  if (!limpo) return null;

  const placa = memoriaPlacas.find((p) => !p.cancelled_entry && p.public_token === limpo);
  if (!placa) return null;

  const eventosEtapa = memoriaEventos
    .filter((e) => e.board_order_id === placa.id && (e.event_type === 'entrada' || e.event_type === 'mudanca_etapa'))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const datasPorEtapa = new Map<BoardStage, string>();
  datasPorEtapa.set('entrada', placa.created_at);
  for (const ev of eventosEtapa) {
    if (ev.to_stage) {
      datasPorEtapa.set(ev.to_stage, ev.created_at);
    }
  }
  datasPorEtapa.set(placa.status, placa.finished_at ?? placa.stage_changed_at);

  const etapasLinha: BoardStage[] =
    placa.status === 'sem_conserto'
      ? ['entrada', 'diagnostico', 'sem_conserto']
      : [...ETAPAS_KANBAN_PLACA.map((e) => e.etapa), 'entregue'];

  const indiceAtual = etapasLinha.indexOf(placa.status);
  const steps: BoardPublicStageStep[] = etapasLinha.map((etapa, idx) => ({
    stage: etapa,
    label: ROTULO_ETAPA_PLACA[etapa],
    state: idx < indiceAtual ? 'concluida' : idx === indiceAtual ? 'atual' : 'proxima',
    reached_at: idx <= indiceAtual ? (datasPorEtapa.get(etapa) ?? null) : null,
  }));

  const fotosSeguras = memoriaFotos
    .filter((f) => f.board_order_id === placa.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((f) => ({
      id: f.id,
      category: f.category,
      public_url: f.public_url,
      caption: f.caption,
      created_at: f.created_at,
    }));

  const entregue = placa.status === 'entregue';
  return {
    board_number: placa.board_number,
    equipment_type: placa.equipment_type,
    brand_model: placa.brand_model,
    board_code: placa.board_code,
    status: placa.status,
    created_at: placa.created_at,
    finished_at: placa.finished_at,
    quote_status: placa.quote_status,
    quote_amount: MOSTRAR_VALOR_ORCAMENTO ? placa.quote_amount : null,
    is_warranty: placa.is_warranty,
    warranty_until: entregue ? calcularValidadeGarantia(placa.finished_at) : null,
    warranty_active: entregue ? garantiaVigente(placa.finished_at) : false,
    steps,
    photos: fotosSeguras,
  };
}

// ============================================================================
// 7. STUBS E TODO(Claude): PDF DE ORÇAMENTO/TERMO E IMPRESSORA ELGIN
// ============================================================================

function criarPdfMinimoDemo(titulo: string, subtitulo: string): Blob {
  // PDF 1.4 sintético válido de 1 página para permitir download e `navigator.share({ files })` na demo
  const limparPdf = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[()\\]/g, '');
  const t1 = limparPdf(titulo);
  const t2 = limparPdf(subtitulo);
  const stream = `BT /F1 14 Tf 50 760 Td (${t1}) Tj 0 -24 Td /F1 10 Tf (${t2}) Tj 0 -20 Td (Arquivo de demonstracao - TODO Claude: geracao oficial do PDF.) Tj ET`;
  const pdf = [
    '%PDF-1.4',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    'xref',
    '0 6',
    '0000000000 65535 f ',
    'trailer << /Size 6 /Root 1 0 R >>',
    'startxref',
    '0',
    '%%EOF',
  ].join('\n');
  return new Blob([pdf], { type: 'application/pdf' });
}

/**
 * TODO(Claude): gerar o PDF real do orçamento (no servidor ou cliente) com layout oficial A4.
 * Na demonstração devolve um `Blob` `application/pdf` mínimo válido para testar compartilhamento/download.
 */
async function gerarPdfOrcamentoDemo(id: string): Promise<Blob> {
  await atraso(180);
  const placa = memoriaPlacas.find((p) => p.id === id);
  if (!placa) throw new Error('Placa não encontrada para gerar o PDF do orçamento.');
  return criarPdfMinimoDemo(
    `BRV Niteroi - Orcamento ${placa.board_number}`,
    `Cliente: ${placa.customer_name} | Placa: ${placa.board_code}`,
  );
}

/**
 * TODO(Claude): gerar o PDF real do termo de garantia de 90 dias.
 */
async function gerarPdfTermoDemo(id: string): Promise<Blob> {
  await atraso(180);
  const placa = memoriaPlacas.find((p) => p.id === id);
  if (!placa) throw new Error('Placa não encontrada para gerar o termo de garantia.');
  return criarPdfMinimoDemo(
    `BRV Niteroi - Termo de Garantia 90 dias ${placa.board_number}`,
    `Cliente: ${placa.customer_name} | Placa: ${placa.board_code}`,
  );
}

/**
 * TODO(Claude): enfileirar pedido real com ZPL de placa na tabela de impressão da Elgin L42 Pro.
 */
async function pedirEtiquetaPlacaDemo(
  id: string,
  copias: number,
  _largura?: 100 | 80,
): Promise<PedidoEtiquetaPlacaResult> {
  await atraso(250);
  const placa = memoriaPlacas.find((p) => p.id === id);
  if (!placa) throw new Error('Placa não encontrada para impressão da etiqueta.');
  const qtd = Math.min(5, Math.max(1, Math.floor(copias || 1)));
  return {
    id: gerarUuidDemo('job-elgin'),
    status: 'pendente',
    mensagem: `Demonstração: ${qtd} cópia(s) da etiqueta ${placa.board_number} registrada(s) no stub da fila Elgin. Use "Imprimir pelo navegador" enquanto o ZPL da fila não estiver ligado.`,
  };
}

/**
 * TODO(Claude): consultar `print_agents` real da loja (mesmo mecanismo de `services/oficina.ts`).
 */
async function situacaoImpressoraDemo(): Promise<SituacaoImpressoraPlaca> {
  await atraso(80);
  return {
    online: true,
    printer_name: 'Elgin L42 Pro (Laboratório — Demo)',
    last_seen_at: new Date().toISOString(),
  };
}


// ---------------------------------------------------------------------
// Funções ligadas ao banco (com a demonstração como reserva)
// ---------------------------------------------------------------------

/** O PDF automático (orçamento e termo) ainda não existe com o banco ligado: a tela cai no "imprimir / salvar PDF" (fase P4). */
export class PdfIndisponivelError extends Error {
  constructor() {
    super('O PDF automático ainda não está ligado. Use "Imprimir / Salvar PDF" e anexe o arquivo na conversa do WhatsApp.');
    this.name = 'PdfIndisponivelError';
  }
}

export function gerarPdfOrcamento(...args: Parameters<typeof gerarPdfOrcamentoDemo>): ReturnType<typeof gerarPdfOrcamentoDemo> {
  if (USAR_BANCO_PLACAS) return Promise.reject(new PdfIndisponivelError());
  return gerarPdfOrcamentoDemo(...args);
}

/**
 * Envia o orçamento por link (o wa.me só leva texto): marca como enviado e devolve o link público
 * `/orcamento-placa/<token>`, onde o cliente vê, salva em PDF e aprova.
 */
export async function enviarOrcamentoPorLink(id: string, atorNome: string): Promise<{ placa: BoardOrder; link: string }> {
  if (USAR_BANCO_PLACAS) return real.enviarOrcamentoPorLink(id);
  const placa = await registrarEnvioOrcamentoDemo(id, atorNome);
  return { placa, link: real.linkOrcamentoPlaca('demonstracao-sem-banco') };
}

export function gerarPdfTermo(...args: Parameters<typeof gerarPdfTermoDemo>): ReturnType<typeof gerarPdfTermoDemo> {
  if (USAR_BANCO_PLACAS) return Promise.reject(new PdfIndisponivelError());
  return gerarPdfTermoDemo(...args);
}

/**
 * Etiqueta da placa na Elgin, pela fila da loja (mesmo agente da Oficina). Espera até 60 s o resultado:
 * impressa, falhou (com o motivo) ou sem resposta do servidor da loja.
 */
export async function pedirEtiquetaPlaca(id: string, copias: number, largura: 100 | 80 = 100): Promise<PedidoEtiquetaPlacaResult> {
  if (!USAR_BANCO_PLACAS) return pedirEtiquetaPlacaDemo(id, copias, largura);
  const placa = await real.buscarPlaca(id);
  if (!placa) throw new Error('Placa não encontrada para imprimir a etiqueta.');
  const pedido = await real.pedirEtiquetaPlacaNaFila(placa, { copias, largura });
  const final = (await acompanharPedido(pedido.id)) ?? pedido;
  if (final.status === 'impressa') {
    return { id: final.id, status: 'impressa', mensagem: `Etiqueta impressa na Elgin (${final.copies} ${final.copies === 1 ? 'cópia' : 'cópias'}).` };
  }
  if (final.status === 'falhou' || final.status === 'cancelada') {
    return { id: final.id, status: 'falhou', mensagem: `Não imprimiu: ${final.error || 'o pedido foi cancelado'}. Tente de novo ou use "Imprimir pelo navegador".` };
  }
  return {
    id: final.id,
    status: 'pendente',
    mensagem: 'O servidor da loja não respondeu em 1 minuto. O pedido continua na fila e sai quando o servidor voltar; se for urgente, use "Imprimir pelo navegador".',
  };
}

/** Situação real da Elgin (o agente da loja manda um sinal de vida; sem sinal há 90 s = servidor desligado). */
export async function situacaoImpressora(): Promise<SituacaoImpressoraPlaca> {
  if (!USAR_BANCO_PLACAS) return situacaoImpressoraDemo();
  const { online, agente } = await situacaoElgin();
  return { online, printer_name: agente?.printer ?? 'Elgin', last_seen_at: agente?.last_seen_at ?? null };
}

export function listarPlacas(...args: Parameters<typeof listarPlacasDemo>): ReturnType<typeof listarPlacasDemo> {
  return USAR_BANCO_PLACAS ? real.listarPlacas(...(args as unknown as Parameters<typeof real.listarPlacas>)) : listarPlacasDemo(...args);
}

export function buscarPlaca(...args: Parameters<typeof buscarPlacaDemo>): ReturnType<typeof buscarPlacaDemo> {
  return USAR_BANCO_PLACAS ? real.buscarPlaca(...(args as unknown as Parameters<typeof real.buscarPlaca>)) : buscarPlacaDemo(...args);
}

export function criarPlaca(...args: Parameters<typeof criarPlacaDemo>): ReturnType<typeof criarPlacaDemo> {
  return USAR_BANCO_PLACAS ? real.criarPlaca(...(args as unknown as Parameters<typeof real.criarPlaca>)) : criarPlacaDemo(...args);
}

export function atualizarPlaca(...args: Parameters<typeof atualizarPlacaDemo>): ReturnType<typeof atualizarPlacaDemo> {
  return USAR_BANCO_PLACAS ? real.atualizarPlaca(...(args as unknown as Parameters<typeof real.atualizarPlaca>)) : atualizarPlacaDemo(...args);
}

export function moverPlaca(...args: Parameters<typeof moverPlacaDemo>): ReturnType<typeof moverPlacaDemo> {
  return USAR_BANCO_PLACAS ? real.moverPlaca(...(args as unknown as Parameters<typeof real.moverPlaca>)) : moverPlacaDemo(...args);
}

export function registrarOrcamento(...args: Parameters<typeof registrarOrcamentoDemo>): ReturnType<typeof registrarOrcamentoDemo> {
  return USAR_BANCO_PLACAS ? real.registrarOrcamento(...(args as unknown as Parameters<typeof real.registrarOrcamento>)) : registrarOrcamentoDemo(...args);
}

export function registrarEnvioOrcamento(...args: Parameters<typeof registrarEnvioOrcamentoDemo>): ReturnType<typeof registrarEnvioOrcamentoDemo> {
  return USAR_BANCO_PLACAS ? real.registrarEnvioOrcamento(...(args as unknown as Parameters<typeof real.registrarEnvioOrcamento>)) : registrarEnvioOrcamentoDemo(...args);
}

export function registrarRespostaOrcamento(...args: Parameters<typeof registrarRespostaOrcamentoDemo>): ReturnType<typeof registrarRespostaOrcamentoDemo> {
  return USAR_BANCO_PLACAS ? real.registrarRespostaOrcamento(...(args as unknown as Parameters<typeof real.registrarRespostaOrcamento>)) : registrarRespostaOrcamentoDemo(...args);
}

export function registrarReembolso(...args: Parameters<typeof registrarReembolsoDemo>): ReturnType<typeof registrarReembolsoDemo> {
  return USAR_BANCO_PLACAS ? real.registrarReembolso(...(args as unknown as Parameters<typeof real.registrarReembolso>)) : registrarReembolsoDemo(...args);
}

export function arquivarPlaca(...args: Parameters<typeof arquivarPlacaDemo>): ReturnType<typeof arquivarPlacaDemo> {
  return USAR_BANCO_PLACAS ? real.arquivarPlaca(...(args as unknown as Parameters<typeof real.arquivarPlaca>)) : arquivarPlacaDemo(...args);
}

export function cancelarPlaca(...args: Parameters<typeof cancelarPlacaDemo>): ReturnType<typeof cancelarPlacaDemo> {
  return USAR_BANCO_PLACAS ? real.cancelarPlaca(...(args as unknown as Parameters<typeof real.cancelarPlaca>)) : cancelarPlacaDemo(...args);
}

export function reabrirPlaca(...args: Parameters<typeof reabrirPlacaDemo>): ReturnType<typeof reabrirPlacaDemo> {
  return USAR_BANCO_PLACAS ? real.reabrirPlaca(...(args as unknown as Parameters<typeof real.reabrirPlaca>)) : reabrirPlacaDemo(...args);
}

export function gerarNovoLinkAcompanhamento(...args: Parameters<typeof gerarNovoLinkAcompanhamentoDemo>): ReturnType<typeof gerarNovoLinkAcompanhamentoDemo> {
  return USAR_BANCO_PLACAS ? real.gerarNovoLinkAcompanhamento(...(args as unknown as Parameters<typeof real.gerarNovoLinkAcompanhamento>)) : gerarNovoLinkAcompanhamentoDemo(...args);
}

export function anotarNoHistorico(...args: Parameters<typeof anotarNoHistoricoDemo>): ReturnType<typeof anotarNoHistoricoDemo> {
  return USAR_BANCO_PLACAS ? real.anotarNoHistorico(...(args as unknown as Parameters<typeof real.anotarNoHistorico>)) : anotarNoHistoricoDemo(...args);
}

export function historicoDaPlaca(...args: Parameters<typeof historicoDaPlacaDemo>): ReturnType<typeof historicoDaPlacaDemo> {
  return USAR_BANCO_PLACAS ? real.historicoDaPlaca(...(args as unknown as Parameters<typeof real.historicoDaPlaca>)) : historicoDaPlacaDemo(...args);
}

export function fotosDaPlaca(...args: Parameters<typeof fotosDaPlacaDemo>): ReturnType<typeof fotosDaPlacaDemo> {
  return USAR_BANCO_PLACAS ? real.fotosDaPlaca(...(args as unknown as Parameters<typeof real.fotosDaPlaca>)) : fotosDaPlacaDemo(...args);
}

export function anexarFotoPlaca(...args: Parameters<typeof anexarFotoPlacaDemo>): ReturnType<typeof anexarFotoPlacaDemo> {
  return USAR_BANCO_PLACAS ? real.anexarFotoPlaca(...(args as unknown as Parameters<typeof real.anexarFotoPlaca>)) : anexarFotoPlacaDemo(...args);
}

export function excluirFotoPlaca(...args: Parameters<typeof excluirFotoPlacaDemo>): ReturnType<typeof excluirFotoPlacaDemo> {
  return USAR_BANCO_PLACAS ? real.excluirFotoPlaca(...(args as unknown as Parameters<typeof real.excluirFotoPlaca>)) : excluirFotoPlacaDemo(...args);
}

export function listarClientesPlacas(...args: Parameters<typeof listarClientesPlacasDemo>): ReturnType<typeof listarClientesPlacasDemo> {
  return USAR_BANCO_PLACAS ? real.listarClientesPlacas(...(args as unknown as Parameters<typeof real.listarClientesPlacas>)) : listarClientesPlacasDemo(...args);
}

export function salvarClientePlaca(...args: Parameters<typeof salvarClientePlacaDemo>): ReturnType<typeof salvarClientePlacaDemo> {
  return USAR_BANCO_PLACAS ? real.salvarClientePlaca(...(args as unknown as Parameters<typeof real.salvarClientePlaca>)) : salvarClientePlacaDemo(...args);
}

export function excluirClientePlaca(...args: Parameters<typeof excluirClientePlacaDemo>): ReturnType<typeof excluirClientePlacaDemo> {
  return USAR_BANCO_PLACAS ? real.excluirClientePlaca(...(args as unknown as Parameters<typeof real.excluirClientePlaca>)) : excluirClientePlacaDemo(...args);
}

export function placasDoCliente(...args: Parameters<typeof placasDoClienteDemo>): ReturnType<typeof placasDoClienteDemo> {
  return USAR_BANCO_PLACAS ? real.placasDoCliente(...(args as unknown as Parameters<typeof real.placasDoCliente>)) : placasDoClienteDemo(...args);
}

export function buscarOsControl(...args: Parameters<typeof buscarOsControlDemo>): ReturnType<typeof buscarOsControlDemo> {
  return USAR_BANCO_PLACAS ? real.buscarOsControl(...(args as unknown as Parameters<typeof real.buscarOsControl>)) : buscarOsControlDemo(...args);
}

export function listarTecnicos(...args: Parameters<typeof listarTecnicosDemo>): ReturnType<typeof listarTecnicosDemo> {
  return USAR_BANCO_PLACAS ? real.listarTecnicos(...(args as unknown as Parameters<typeof real.listarTecnicos>)) : listarTecnicosDemo(...args);
}

export function listarPlacasParaFinanceiro(...args: Parameters<typeof listarPlacasParaFinanceiroDemo>): ReturnType<typeof listarPlacasParaFinanceiroDemo> {
  return USAR_BANCO_PLACAS ? real.listarPlacasParaFinanceiro(...(args as unknown as Parameters<typeof real.listarPlacasParaFinanceiro>)) : listarPlacasParaFinanceiroDemo(...args);
}

export function buscarAcompanhamentoPublico(...args: Parameters<typeof buscarAcompanhamentoPublicoDemo>): ReturnType<typeof buscarAcompanhamentoPublicoDemo> {
  return USAR_BANCO_PLACAS ? real.buscarAcompanhamentoPublico(...(args as unknown as Parameters<typeof real.buscarAcompanhamentoPublico>)) : buscarAcompanhamentoPublicoDemo(...args);
}

// Apoio técnico: banco real (fichas e manuais) ou demonstração
export function listarFichas(...args: Parameters<typeof listarFichasDemo>): ReturnType<typeof listarFichasDemo> {
  return USAR_BANCO_PLACAS ? real.listarFichas(...(args as unknown as Parameters<typeof real.listarFichas>)) : listarFichasDemo(...args);
}

export function buscarFicha(...args: Parameters<typeof buscarFichaDemo>): ReturnType<typeof buscarFichaDemo> {
  return USAR_BANCO_PLACAS ? real.buscarFicha(...(args as unknown as Parameters<typeof real.buscarFicha>)) : buscarFichaDemo(...args);
}

export function salvarFicha(...args: Parameters<typeof salvarFichaDemo>): ReturnType<typeof salvarFichaDemo> {
  return USAR_BANCO_PLACAS ? real.salvarFicha(args[0]) : salvarFichaDemo(...args);
}

export function excluirFicha(...args: Parameters<typeof excluirFichaDemo>): ReturnType<typeof excluirFichaDemo> {
  return USAR_BANCO_PLACAS ? real.excluirFicha(args[0]) : excluirFichaDemo(...args);
}

export function listarManuais(...args: Parameters<typeof listarManuaisDemo>): ReturnType<typeof listarManuaisDemo> {
  return USAR_BANCO_PLACAS ? real.listarManuais(...(args as unknown as Parameters<typeof real.listarManuais>)) : listarManuaisDemo(...args);
}

export function enviarManual(...args: Parameters<typeof enviarManualDemo>): ReturnType<typeof enviarManualDemo> {
  return USAR_BANCO_PLACAS ? real.enviarManual(args[0], args[1]) : enviarManualDemo(...args);
}

export function excluirManual(...args: Parameters<typeof excluirManualDemo>): ReturnType<typeof excluirManualDemo> {
  return USAR_BANCO_PLACAS ? real.excluirManual(args[0]) : excluirManualDemo(...args);
}

export async function textoDoManual(id: string): Promise<string> {
  if (USAR_BANCO_PLACAS) return real.textoDoManual(id);
  const m = memoriaManuais.find((x) => x.id === id);
  return m ? `Manual de demonstração: ${m.title}` : '';
}

// IA do apoio técnico: Edge Function real (Gemini) ou demonstração
export function extrairFichaDoManual(...args: Parameters<typeof extrairFichaDoManualDemo>): ReturnType<typeof extrairFichaDoManualDemo> {
  return USAR_BANCO_PLACAS ? real.extrairFichaDoManual(args[0]) : extrairFichaDoManualDemo(...args);
}

export function consultarCodigoErro(...args: Parameters<typeof consultarCodigoErroDemo>): ReturnType<typeof consultarCodigoErroDemo> {
  return USAR_BANCO_PLACAS ? real.consultarCodigoErro(args[0]) : consultarCodigoErroDemo(...args);
}

