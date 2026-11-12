import type { PersonType } from './fsm';

/** Etapas de uma placa eletrônica no laboratório (as 6 primeiras compõem o Kanban; as 2 últimas são finais). */
export type BoardStage =
  | 'entrada'
  | 'diagnostico'
  | 'aguardando_peca'
  | 'em_reparo'
  | 'teste'
  | 'pronto'
  | 'entregue'
  | 'sem_conserto';

/** Situação do orçamento dentro da etapa atual (exibida como selo, nunca como coluna). */
export type BoardQuoteStatus = 'nao_feito' | 'enviado' | 'aprovado' | 'recusado';

/** Classificação do cliente da placa: instalador parceiro ou consumidor final. */
export type BoardCustomerKind = 'instalador' | 'final';

/** Canal pelo qual o cliente respondeu ao orçamento da placa (`link` = aprovou na página pública `/orcamento-placa/:token`). */
export type BoardQuoteChannel = 'whatsapp' | 'telefone' | 'presencial' | 'email' | 'link';

/** Categoria das fotos da placa no laboratório. */
export type BoardPhotoCategory = 'antes' | 'depois' | 'outros';

/** Tipo do evento registrado na linha do tempo de auditoria da placa. */
export type BoardEventType =
  | 'entrada'
  | 'mudanca_etapa'
  | 'edicao_campo'
  | 'orcamento'
  | 'envio_orcamento'
  | 'resposta_orcamento'
  | 'reembolso'
  | 'arquivamento'
  | 'cancelamento'
  | 'reabertura'
  | 'novo_link'
  | 'nota';

/** Cadastro paralelo de clientes de placas (`board_clients`), independente de `customers` do Control. */
export interface BoardClient {
  /** Identificador único do cliente de placas (UUID). */
  id: string;
  /** Nome completo ou razão social/apelido comercial do parceiro ou cliente final. */
  name: string;
  /** Telefone principal de contato e WhatsApp. */
  phone: string;
  /** Tipo de cliente: `instalador` (parceiro) ou `final`. */
  kind: BoardCustomerKind;
  /** Cidade de atuação ou residência (ex.: Niterói, São Gonçalo, Maricá). */
  city: string | null;
  /** CPF ou CNPJ sem pontuação (usado na emissão de orçamento e termo). */
  document: string | null;
  /** Natureza jurídica do documento (`PF` ou `PJ`). */
  person_type: PersonType;
  /** Endereço textual opcional para o documento de orçamento. */
  address: string | null;
  /** Observações internas do cadastro (ex.: condições de parceria, portador habitual). */
  notes: string | null;
  /** Total de placas vinculadas a este cliente (calculado na listagem). */
  board_count: number;
  /** Data ISO da placa mais recente deste cliente (calculada na listagem). */
  last_board_at: string | null;
  /** Data ISO de criação do cadastro. */
  created_at: string;
  /** Data ISO da última atualização. */
  updated_at: string;
}

/** Dados de entrada para criar ou editar um cliente de placas. */
export interface BoardClientInput {
  /** Preenchido apenas na edição. */
  id?: string;
  /** Nome obrigatório. */
  name: string;
  /** Telefone obrigatório. */
  phone: string;
  /** Tipo (`instalador` ou `final`). */
  kind: BoardCustomerKind;
  /** Cidade opcional. */
  city?: string | null;
  /** Documento opcional (CPF/CNPJ). */
  document?: string | null;
  /** Tipo de pessoa (`PF` ou `PJ`). */
  person_type?: PersonType;
  /** Endereço opcional. */
  address?: string | null;
  /** Observação opcional. */
  notes?: string | null;
}

/** Resumo de uma OS do BRV Control consultada quando a placa foi retirada pela equipe de campo. */
export interface BoardControlOsLookup {
  /** UUID da OS em `service_orders`. */
  service_order_id: string;
  /** Número sequencial visível da OS no BRV Control (ex.: 17340). */
  os_number: number;
  /** UUID do cliente em `customers`. */
  customer_id: string;
  /** Nome do cliente no Control. */
  customer_name: string;
  /** Telefone principal do cliente no Control. */
  customer_phone: string | null;
  /** Documento do cliente no Control. */
  customer_document: string | null;
  /** Tipo de pessoa (`PF` ou `PJ`) do cliente no Control. */
  customer_person_type: PersonType;
  /** Endereço completo formatado do local de atendimento da OS. */
  address_summary: string;
  /** Cidade do atendimento. */
  city: string | null;
  /** UUID do colaborador/técnico responsável pela visita, se houver. */
  technician_id: string | null;
  /** Nome do técnico responsável pela visita. */
  technician_name: string | null;
  /** Relato do técnico ou descrição do chamado na OS. */
  field_report: string | null;
  /** Números `OS-DDMMAA-NNN` de placas já cadastradas para esta mesma OS (para alerta de duplicidade). */
  existing_board_numbers: string[];
}

/** Opção de técnico para seleção de retirada ou bancada. */
export interface BoardTechnicianOption {
  /** Identificador do colaborador/perfil. */
  id: string;
  /** Nome de exibição. */
  name: string;
  /** Papel principal para sugerir filtro visual (campo ou bancada). */
  area: 'campo' | 'bancada';
}

/** Registro completo de uma ordem de reparo de placa (`board_orders` com dados resolvidos). */
export interface BoardOrder {
  /** UUID da placa. */
  id: string;
  /** Número próprio formatado exclusivamente como `OS-DDMMAA-NNN`. */
  board_number: string;
  /** Token opaco do link público de acompanhamento (`/placa/:token`). */
  public_token: string;
  /** Etapa atual da placa. */
  status: BoardStage;
  /** Data/hora ISO em que a placa entrou na etapa atual (`status`). */
  stage_changed_at: string;
  /** Data/hora ISO de saída/finalização (`entregue` ou `sem_conserto`). */
  finished_at: string | null;
  /** Indica se a placa foi arquivada para sair da visão ativa sem apagar histórico. */
  archived: boolean;
  /** Data/hora ISO do arquivamento. */
  archived_at: string | null;
  /** Indica se a entrada foi cancelada por engano/desistência imediata. */
  cancelled_entry: boolean;
  /** Motivo do cancelamento da entrada. */
  cancel_reason: string | null;
  /** Motivo registrado quando finalizada como `sem_conserto`. */
  unrepaired_reason: string | null;

  /** UUID em `board_clients` (preenchido apenas quando veio de balcão/portador; nulo se veio de campo). */
  board_client_id: string | null;
  /** UUID em `customers` do Control (preenchido apenas quando veio de retirada de campo; nulo se balcão). */
  customer_id: string | null;
  /** UUID da OS do BRV Control (preenchido apenas quando veio de retirada de campo). */
  service_order_id: string | null;
  /** Número da OS do BRV Control quando retirada em campo (ex.: 17340). */
  os_number: number | null;
  /** Nome resolvido do cliente (de `board_clients` ou `customers`). */
  customer_name: string;
  /** Telefone resolvido do cliente. */
  customer_phone: string | null;
  /** Classificação do cliente (`instalador` ou `final`). */
  customer_kind: BoardCustomerKind;
  /** Cidade do cliente. */
  customer_city: string | null;
  /** CPF/CNPJ do cliente usado no orçamento/termo. */
  customer_document: string | null;
  /** Tipo de pessoa (`PF` ou `PJ`) do documento do cliente. */
  customer_person_type: PersonType;
  /** Endereço textual do cliente usado no orçamento. */
  customer_address: string | null;

  /** Tipo do equipamento (ex.: Split Inverter, VRF, Piso-Teto Inverter). */
  equipment_type: string;
  /** Marca e modelo do equipamento (ex.: Midea Springer Xtreme Save 12.000). */
  brand_model: string;
  /** Código/part number gravado na placa eletrônica (ex.: CE-KFR35GW/BP2N1Y). */
  board_code: string;
  /** Periféricos e acessórios entregues junto com a placa (sensores, display, chicotes, motor BLDC). */
  peripherals: string | null;
  /** Defeito reclamado pelo parceiro/cliente ou relato na triagem. */
  reported_defect: string;
  /** Marcação de placa deixada para teste preventivo sem defeito visível inicial. */
  no_apparent_defect: boolean;
  /**
   * Testada em bancada e sem defeito: vai direto para Pronto, sem orçamento nem aprovação do cliente.
   * O valor da avaliação em bancada fica em `quote_amount` (garantia não cobra).
   */
  no_defect_found?: boolean;
  /** UUID do colaborador que retirou/recebeu a placa. */
  pickup_technician_id: string | null;
  /** Nome do colaborador que retirou/recebeu a placa. */
  pickup_technician_name: string | null;
  /** UUID do técnico de bancada responsável pelo reparo. */
  bench_technician_id: string | null;
  /** Nome do técnico de bancada responsável pelo reparo. */
  bench_technician_name: string | null;

  /** Código de erro apresentado no display ou piscadas de LED (ex.: E1, CH05, P4). */
  error_code: string | null;
  /** Diagnóstico técnico interno de bancada (nunca exibido na página pública). */
  technical_diagnosis: string | null;
  /** Relação de componentes eletrônicos substituídos no reparo (sai no termo de garantia). */
  replaced_components: string | null;

  /** Estado atual do orçamento (`nao_feito`, `enviado`, `aprovado`, `recusado`). */
  quote_status: BoardQuoteStatus;
  /** Valor total orçado em reais (só escritório/admin; fora da página pública de acompanhamento). */
  quote_amount: number | null;
  /** Prazo de validade da proposta comercial em dias corridos (padrão 10). */
  quote_validity_days: number;
  /** Parecer técnico formal que sai impresso na proposta de orçamento ao cliente. */
  quote_technical_opinion: string | null;
  /** Data/hora ISO do envio do PDF do orçamento ao cliente. */
  quote_sent_at: string | null;
  /** Data/hora ISO em que a resposta do cliente foi registrada. */
  quote_responded_at: string | null;
  /** Canal da resposta do cliente (`whatsapp`, `telefone`, `presencial`, `email`). */
  quote_response_channel: BoardQuoteChannel | null;
  /** Observação sobre a aprovação ou recusa do orçamento. */
  quote_response_notes: string | null;
  /** Nome de quem registrou a resposta do orçamento. */
  quote_responded_by_name: string | null;

  /** Indica retorno em garantia (isento de novo orçamento). */
  is_warranty: boolean;
  /** UUID da placa entregue original que deu origem a esta garantia. */
  warranty_origin_id: string | null;
  /** Número `OS-DDMMAA-NNN` da placa original de garantia. */
  warranty_origin_number: string | null;

  /** Valor efetivamente cobrado/faturado na entrega (visível só com `board_finance_access`). */
  charged_amount: number | null;
  /** Indica se houve estorno/reembolso financeiro desta placa. */
  refunded: boolean;
  /** Valor reembolsado em reais (visível só com `board_finance_access`). */
  refund_amount: number | null;
  /** Data ISO do reembolso. */
  refunded_at: string | null;
  /** Motivo do reembolso. */
  refund_reason: string | null;

  /** Dias inteiros desde a entrada; não zera ao mudar de etapa; congela na saída (`diasDesdeEntrada`). */
  days_since_entry: number;
  /** Verdadeiro quando está em aberto (inclusive `pronto`) há >= 4 dias desde a entrada. */
  stalled: boolean;
  /** Data/hora ISO de entrada da placa no laboratório. */
  created_at: string;
  /** Data/hora ISO da última atualização. */
  updated_at: string;
}

/** Filtros aceitos por `listarPlacas`. */
export interface BoardListFilter {
  /** Aba selecionada: `andamento` (Kanban ativo) ou `finalizadas` (histórico paginado). */
  aba: 'andamento' | 'finalizadas';
  /** Busca livre por número, cliente, marca/modelo ou código da placa. */
  busca?: string;
  /** Chip rápido na aba Em andamento. */
  recorte?: 'todas' | 'parceiros' | 'final' | 'garantias' | 'encalhadas';
  /** Filtro de desfecho na aba Finalizadas (`todas`, `entregue`, `sem_conserto`). */
  desfecho?: 'todas' | 'entregue' | 'sem_conserto';
  /** Ano de referência na aba Finalizadas (ex.: 2026). */
  ano?: number;
  /** Página atual na aba Finalizadas (base 1, 50 itens por página). */
  pagina?: number;
}

/** Retorno paginado de `listarPlacas`. */
export interface BoardListResult {
  /** Lista de placas da consulta atual. */
  itens: BoardOrder[];
  /** Total de registros que atendem ao filtro (para paginação de 50 nas finalizadas). */
  total: number;
  /** Tamanho da página aplicado nas finalizadas (50). */
  por_pagina: number;
  /** Contadores rápidos dos chips na aba Em andamento (considerando a busca textual ativa). */
  contagens: {
    todas: number;
    parceiros: number;
    final: number;
    garantias: number;
    encalhadas: number;
  };
}

/** Foto anexada durante a entrada, reparo ou teste de uma placa (`board_photos`). */
export interface BoardPhoto {
  /** UUID da foto. */
  id: string;
  /** UUID da placa. */
  board_order_id: string;
  /** Categoria da foto (`antes`, `depois`, `outros`). */
  category: BoardPhotoCategory;
  /** URL pública (ou Data URL SVG/local na demonstração). */
  public_url: string;
  /** Nome original do arquivo. */
  file_name: string;
  /** Legenda descritiva opcional. */
  caption: string | null;
  /** Etapa em que a placa estava quando a foto foi anexada. */
  stage_at_capture: BoardStage;
  /** Nome de quem anexou. */
  uploaded_by_name: string;
  /** Data/hora ISO do envio. */
  created_at: string;
}

/** Evento auditável na linha do tempo de uma placa (`board_events`). */
export interface BoardEvent {
  /** UUID do evento. */
  id: string;
  /** UUID da placa. */
  board_order_id: string;
  /** Tipo semântico do evento. */
  event_type: BoardEventType;
  /** Etapa anterior (quando `event_type === 'mudanca_etapa'`). */
  from_stage: BoardStage | null;
  /** Nova etapa (quando `event_type === 'mudanca_etapa'`). */
  to_stage: BoardStage | null;
  /** Nome técnico da coluna alterada (quando `event_type === 'edicao_campo'`). */
  field_name: string | null;
  /** Valor anterior resumido em texto. */
  old_value: string | null;
  /** Novo valor resumido em texto. */
  new_value: string | null;
  /** Nota ou resumo legível do evento. */
  note: string | null;
  /** Visibilidade do evento: `todos`, `escritorio` (orçamento) ou `financeiro` (reembolso/cobrado, só com a marca). */
  visibility: 'todos' | 'escritorio' | 'financeiro';
  /** Nome do usuário que realizou a ação. */
  actor_name: string;
  /** Data/hora ISO do evento. */
  created_at: string;
}

/** Dados para criar uma nova placa no laboratório (`criarPlaca`). */
export interface CreateBoardInput {
  /** Origem da entrada: `balcao` (usa `board_client_id`) ou `campo` (usa `service_order_id` + `customer_id`). */
  origem: 'balcao' | 'campo';
  /** UUID do cliente de placas quando `origem === 'balcao'`. */
  board_client_id?: string | null;
  /** UUID da OS do Control quando `origem === 'campo'`. */
  service_order_id?: string | null;
  /** Tipo do cliente (`instalador` ou `final`). */
  customer_kind: BoardCustomerKind;
  /** Cidade do atendimento/cliente. */
  customer_city?: string | null;
  /** Colaborador que retirou ou recebeu no balcão. */
  pickup_technician_id?: string | null;
  /** Técnico de bancada designado inicialmente. */
  bench_technician_id?: string | null;
  /** Tipo de equipamento (padrão `"Split Inverter"`). */
  equipment_type: string;
  /** Marca e modelo do equipamento. */
  brand_model: string;
  /** Código da placa eletrônica. */
  board_code: string;
  /** Periféricos/acessórios entregues junto. */
  peripherals?: string | null;
  /** Defeito reclamado. */
  reported_defect: string;
  /** Código de erro inicial, se relatado. */
  error_code?: string | null;
  /** Sem defeito aparente (revisão/teste). */
  no_apparent_defect: boolean;
  /** Retorno em garantia. */
  is_warranty: boolean;
  /** UUID da placa entregue original quando `is_warranty === true`. */
  warranty_origin_id?: string | null;
  /** Fotos iniciais anexadas na triagem. */
  entry_photos?: { file: File; caption?: string }[];
}

/** Campos editáveis da placa em `atualizarPlaca`. */
export interface UpdateBoardFields {
  equipment_type?: string;
  brand_model?: string;
  board_code?: string;
  peripherals?: string | null;
  reported_defect?: string;
  no_apparent_defect?: boolean;
  pickup_technician_id?: string | null;
  bench_technician_id?: string | null;
  error_code?: string | null;
  technical_diagnosis?: string | null;
  replaced_components?: string | null;
  charged_amount?: number | null;
}

/** Dados extras exigidos ao mover para etapas finais (`moverPlaca`). */
export interface MoveBoardExtra {
  /** Data/hora ISO de saída ao finalizar em `entregue` (padrão hoje). */
  finished_at?: string;
  /** Valor efetivamente cobrado ao entregar (opcional, para quem tem financeiro). */
  charged_amount?: number | null;
  /** Motivo obrigatório ao finalizar em `sem_conserto`. */
  unrepaired_reason?: string;
}

/** Dados para salvar/atualizar o orçamento de uma placa (`registrarOrcamento`). */
export interface BoardQuoteInput {
  /** Valor total do orçamento em reais (> 0). */
  quote_amount: number;
  /** Validade da proposta em dias (padrão 10). */
  quote_validity_days: number;
  /** CPF/CNPJ do cliente. */
  customer_document?: string | null;
  /** Tipo de pessoa (`PF` ou `PJ`). */
  customer_person_type?: PersonType;
  /** Endereço completo do cliente. */
  customer_address?: string | null;
  /** Parecer técnico formal para o documento de orçamento. */
  quote_technical_opinion: string;
}

/** Dados da resposta do cliente ao orçamento (`registrarRespostaOrcamento`). */
export interface BoardQuoteResponseInput {
  /** Decisão do cliente. */
  decision: 'aprovado' | 'recusado';
  /** Canal da resposta. */
  channel: BoardQuoteChannel;
  /** Observação opcional. */
  notes?: string | null;
}

/** Dados de reembolso financeiro (`registrarReembolso`). */
export interface BoardRefundInput {
  /** Marcar ou desmarcar reembolso. */
  refunded: boolean;
  /** Valor reembolsado em reais (obrigatório quando `refunded === true`). */
  refund_amount: number | null;
  /** Data ISO do reembolso (`AAAA-MM-DD`). */
  refunded_at: string | null;
  /** Motivo do reembolso. */
  refund_reason: string | null;
}

/** Etapa pública simplificada exibida em `/placa/:token`. */
export interface BoardPublicStageStep {
  /** Código da etapa. */
  stage: BoardStage;
  /** Rótulo amigável para o cliente/parceiro. */
  label: string;
  /** Situação deste passo na linha do tempo pública. */
  state: 'concluida' | 'atual' | 'proxima';
  /** Data ISO em que passou pela etapa, quando conhecida. */
  reached_at: string | null;
}

/** Projeção estritamente segura para acompanhamento público sem login (`/placa/:token`). */
export interface BoardPublicTracking {
  /** Número da placa (`OS-DDMMAA-NNN`). */
  board_number: string;
  /** Tipo do equipamento. */
  equipment_type: string;
  /** Marca e modelo. */
  brand_model: string;
  /** Código da placa. */
  board_code: string;
  /** Etapa atual. */
  status: BoardStage;
  /** Data ISO de entrada. */
  created_at: string;
  /** Data ISO de saída/entrega (quando finalizada). */
  finished_at: string | null;
  /** Estado público do orçamento (NUNCA inclui valor em reais por padrão). */
  quote_status: BoardQuoteStatus;
  /** Valor do orçamento (só preenchido se `MOSTRAR_VALOR_ORCAMENTO` for `true`; hoje sempre `null`). */
  quote_amount: number | null;
  /** Indica retorno em garantia. */
  is_warranty: boolean;
  /** Data limite ISO da garantia de 90 dias quando `status === 'entregue'`. */
  warranty_until: string | null;
  /** Indica se a garantia de 90 dias segue vigente hoje. */
  warranty_active: boolean;
  /** Linha de etapas com datas. */
  steps: BoardPublicStageStep[];
  /** Fotos públicas da placa (sem observações internas). */
  photos: Pick<BoardPhoto, 'id' | 'category' | 'public_url' | 'caption' | 'created_at'>[];
}

/**
 * Orçamento visto pelo cliente na página pública `/orcamento-placa/:token` (função `placa_orcamento_ver`).
 * Tem os dados da folha do orçamento; nada de diagnóstico interno, financeiro ou histórico.
 */
export interface BoardPublicQuote {
  board_number: string;
  status: BoardStage;
  customer_name: string;
  customer_phone: string | null;
  customer_kind: BoardCustomerKind;
  customer_document: string | null;
  customer_person_type: PersonType;
  customer_address: string | null;
  equipment_type: string;
  brand_model: string;
  board_code: string;
  peripherals: string | null;
  reported_defect: string;
  error_code: string | null;
  quote_technical_opinion: string | null;
  quote_amount: number | null;
  quote_validity_days: number;
  quote_status: BoardQuoteStatus;
  /** Data ISO do envio (= emissão da proposta). */
  quote_sent_at: string | null;
  /** Data ISO limite da proposta (envio + validade). */
  quote_valid_until: string | null;
  /** Enviado e com a validade vencida (não aceita mais aprovação). */
  quote_expired: boolean;
  quote_responded_at: string | null;
  quote_response_channel: BoardQuoteChannel | null;
  quote_response_notes: string | null;
}

/** Ficha técnica de ar-condicionado split (`fichas_tecnicas_split`, espelhando as 34 colunas do schema). */
export interface PlacaFichaTecnica {
  /** UUID da ficha técnica. */
  id: string;
  /** Marca/fabricante (ex.: Midea, LG, Daikin, Samsung, Elgin). */
  fabricante: string;
  /** Linha comercial (ex.: Xtreme Save Connect, Dual Inverter Voice). */
  linha: string | null;
  /** Tipo construtivo (ex.: Hi-Wall Inverter, Piso-Teto Inverter, Cassete). */
  tipo_split: string | null;
  /** Capacidade térmica nominal em BTU/h (ex.: 12.000 BTU/h). */
  capacidade_btu: string | null;
  /** Capacidade térmica em Watts (ex.: 3.517 W). */
  capacidade_w: string | null;
  /** Código comercial da unidade interna (evaporadora). */
  evaporadora: string | null;
  /** Dimensões LxAxP da evaporadora em mm. */
  medida_evaporadora: string | null;
  /** Código de referência/part number da placa ou conjunto da evaporadora. */
  ref_evaporadora: string | null;
  /** Código comercial da unidade externa (condensadora). */
  condensadora: string | null;
  /** Dimensões LxAxP da condensadora em mm. */
  medida_condensadora: string | null;
  /** Código de referência/part number da placa ou conjunto da condensadora. */
  ref_condensadora: string | null;
  /** Versão/revisão do manual técnico de origem. */
  revisao_manual: string | null;
  /** Fluido refrigerante (ex.: R-32, R-410A). */
  gas: string | null;
  /** Bitola da linha de líquido (ex.: 1/4"). */
  cobre_liquido: string | null;
  /** Bitola da linha de sucção (ex.: 3/8", 1/2"). */
  cobre_succao: string | null;
  /** Comprimento mínimo de tubulação (ex.: 2 m, 3 m). */
  dist_min: string | null;
  /** Comprimento máximo atendido pela carga de fábrica sem adicional (ex.: 5 m, 7,5 m). */
  dist_padrao: string | null;
  /** Comprimento máximo total permitido (ex.: 25 m). */
  dist_max: string | null;
  /** Desnível máximo entre unidades (ex.: 10 m). */
  desnivel_max: string | null;
  /** Massa de fluido refrigerante de fábrica (ex.: 620 g). */
  carga_fabrica: string | null;
  /** Adicional de fluido por metro excedente (ex.: 12 g/m após 5 m). */
  carga_extra: string | null;
  /** Regra especial de alteração de bitola para longas distâncias. */
  regra_bitola: string | null;
  /** Tensão nominal e fases (ex.: 220V ~ 60Hz 1F). */
  tensao: string | null;
  /** Ponto de entrada da alimentação elétrica (Evaporadora ou Condensadora). */
  alimentacao_em: string | null;
  /** Potência elétrica nominal consumida (W). */
  p_nominal: string | null;
  /** Potência elétrica máxima de dimensionamento (W). */
  p_max_dim: string | null;
  /** Corrente nominal em refrigeração (A). */
  i_refrigeracao: string | null;
  /** Corrente nominal em aquecimento (A). */
  i_aquecimento: string | null;
  /** Corrente máxima de dimensionamento (A). */
  i_max_dim: string | null;
  /** Ponto de origem/referência da recomendação elétrica no manual. */
  origem_eletrica: string | null;
  /** Seção mínima recomendada para o cabo de alimentação (ex.: 3 x 2,5 mm²). */
  cabo_alimentacao: string | null;
  /** Seção e vias do cabo PP/interligação entre unidades (ex.: 4 x 1,5 mm²). */
  cabo_interligacao: string | null;
  /** Disjuntor/fusível recomendado (ex.: 16 A Curva C). */
  protecao: string | null;
  /** Observações técnicas gerais de instalação e bancada. */
  observacao: string | null;
  /** Campos ausentes ou ambíguos apontados na leitura do manual. */
  lacunas: string | null;
  /** Nome do manual ou documento de origem. */
  fonte: string | null;
  /** Link para abrir o manual PDF/TXT original, quando disponível. */
  arquivo_original_url: string | null;
  /** Data ISO de cadastro da ficha. */
  created_at: string;
}

/** Dados para criar ou atualizar uma ficha técnica. */
export type PlacaFichaInput = Omit<PlacaFichaTecnica, 'id' | 'created_at'> & {
  id?: string;
};

/** Filtro de busca de fichas técnicas (`listarFichas`). */
export interface FiltroFichasPlacas {
  /** Busca textual sem acento (fabricante, linha, evaporadora, condensadora, refs, capacidade). */
  busca?: string;
  /** Filtro exato por fabricante. */
  fabricante?: string;
  /** Filtro por capacidade em BTUs (ex.: `"9.000"`, `"12.000"`, `"18.000"`, `"24.000"`). */
  btus?: string;
}

/** Resultado retornado pela Edge Function de leitura de manual com IA (`extrairFichaDoManual`). */
export interface ExtracaoFichaManualResultado {
  /** Dados extraídos pré-preenchidos para revisão humana. */
  ficha: Omit<PlacaFichaTecnica, 'id' | 'created_at'>;
  /** Lista de chaves que a IA considerou incertas/ausentes e que devem exibir o selo `"conferir"`. */
  campos_conferir: (keyof Omit<PlacaFichaTecnica, 'id' | 'created_at'>)[];
}

/** Parâmetros para consulta de código de erro (`consultarCodigoErro`). */
export interface ConsultaCodigoErroInput {
  /** Marca do equipamento (ex.: Midea, LG, Daikin). */
  marca: string;
  /** Modelo opcional do split ou placa. */
  modelo?: string;
  /** Código de erro ou sintoma pesquisado (ex.: E1, CH05, pisca 5x). */
  consulta: string;
}

/** Resposta estruturada da consulta de código de erro (`consultarCodigoErro`). */
export interface ResultadoConsultaErro {
  /** Marca consultada. */
  marca: string;
  /** Modelo informado, se houver. */
  modelo: string | null;
  /** Código ou sintoma consultado. */
  codigo_ou_sintoma: string;
  /** Significado direto do código de erro. */
  significado: string;
  /** Causas prováveis em ordem de frequência. */
  causas_provaveis: string[];
  /** Passo a passo objetivo de verificação técnica. */
  verificacoes: string[];
  /** Componentes da placa ou periféricos envolvidos. */
  componentes_envolvidos: string[];
  /** Alerta de segurança elétrica na bancada/campo, quando aplicável. */
  aviso_seguranca: string | null;
  /** Tipo da fonte utilizada para responder. */
  fonte_tipo: 'manual_fabricante' | 'pesquisa_ia';
  /** Identificação explícita da fonte (ex.: Manual Técnico LG Dual Inverter S4-Q12JA31A ou Pesquisa da IA). */
  fonte_descricao: string;
  /** Data/hora ISO da consulta (para histórico da sessão). */
  consultado_em: string;
}

/** Parâmetros do Assistente Técnico de Bancada (`assistenteTecnico`). */
export interface AssistenteTecnicoInput {
  /** Marca do equipamento/placa. */
  marca: string;
  /** Código de erro no display ou LED. */
  codigoErro: string;
  /** Modelo ou part number da placa eletrônica. */
  modeloPlaca: string;
  /** Sintoma detalhado observado na bancada. */
  sintoma: string;
}

/** Hipótese diagnóstica ordenada por probabilidade no Assistente Técnico. */
export interface HipoteseAssistentePlaca {
  /** Título curto da hipótese no circuito. */
  titulo: string;
  /** Probabilidade estimada (`Alta`, `Média`, `Baixa`). */
  probabilidade: 'Alta' | 'Média' | 'Baixa';
  /** Explicação técnica da causa no estágio eletrônico. */
  explicacao: string;
}

/** Teste prático de bancada/multímetro sugerido pelo Assistente Técnico. */
export interface TesteBancadaAssistente {
  /** Passo sequencial (1, 2, 3...). */
  passo: number;
  /** Instrumento ou escala recomendada (ex.: Multímetro — Diodo, Osciloscópio, DCV). */
  instrumento_escala: string;
  /** Ponto exato de medição no circuito. */
  ponto_medicao: string;
  /** Leitura esperada em placa íntegra. */
  leitura_normal: string;
  /** Leitura que confirma falha. */
  sinal_defeito: string;
}

/** Componente eletrônico crítico listado para medição no Assistente Técnico. */
export interface ComponenteMedirAssistente {
  /** Identificação do componente (ex.: Optoacoplador PC817 / U3, IPM PS21964). */
  componente: string;
  /** Função no circuito da placa. */
  funcao: string;
  /** O que ocorre quando entra em curto/aberto/fuga. */
  falha_tipica: string;
}

/** Resposta estruturada do Assistente Técnico (`assistenteTecnico`). */
export interface ResultadoAssistenteTecnico {
  /** Resumo direto para eventual uso no campo de diagnóstico da placa. */
  resumo_diagnostico: string;
  /** Hipóteses ordenadas da mais provável para a menos provável. */
  hipoteses: HipoteseAssistentePlaca[];
  /** Procedimentos práticos de medição em bancada. */
  testes_bancada: TesteBancadaAssistente[];
  /** Componentes prioritários a medir. */
  componentes_medir: ComponenteMedirAssistente[];
  /** Observações adicionais e cuidados de segurança (descarga de barramento DC etc.). */
  observacoes: string[];
}

/** Manual técnico de fabricante armazenado para fichas e consultas de erro (`board_manuals`). */
export interface PlacaManual {
  /** UUID do manual. */
  id: string;
  /** Fabricante (ex.: Midea, LG, Daikin, Samsung, Gree). */
  manufacturer: string;
  /** Título ou linha/modelo coberto pelo manual. */
  title: string;
  /** Nome original do arquivo enviado. */
  file_name: string;
  /** Formato do arquivo (`PDF` ou `TXT`). */
  file_type: 'PDF' | 'TXT';
  /** Tamanho do arquivo em bytes. */
  file_size_bytes: number;
  /** URL pública do arquivo (HostGator na versão final; Blob/Data URL na demonstração). */
  file_url: string;
  /** Indica se o servidor já extraiu o texto indexável para consultas de código de erro. */
  has_extracted_text: boolean;
  /** Nome de quem enviou o manual. */
  uploaded_by_name: string;
  /** Data ISO do envio. */
  created_at: string;
}

/** Dados para envio de novo manual (`enviarManual`). */
export interface EnviarManualPlacaInput {
  /** Fabricante obrigatório. */
  manufacturer: string;
  /** Título/modelo obrigatório. */
  title: string;
}

/** Situação resumida da impressora térmica Elgin para o cabeçalho e modal de etiqueta. */
export interface SituacaoImpressoraPlaca {
  /** `true` quando o agente da loja respondeu recentemente. */
  online: boolean;
  /** Nome da impressora configurada. */
  printer_name: string;
  /** Data/hora ISO do último sinal do agente local, se houver. */
  last_seen_at: string | null;
}

/** Retorno do pedido de etiqueta térmica na fila da Elgin (`pedirEtiquetaPlaca`). */
export interface PedidoEtiquetaPlacaResult {
  /** Identificador do pedido na fila. */
  id: string;
  /** Situação inicial/simulada do pedido. */
  status: 'pendente' | 'impressa' | 'falhou';
  /** Mensagem amigável em português para exibir no modal. */
  mensagem: string;
}
