// Tipos do módulo PMOC (Plano de Manutenção, Operação e Controle).
// Os nomes dos campos seguem o padrão em inglês das tabelas do banco para facilitar
// a criação futura da migration e dos services em Supabase pelo Claude.

import type { PersonType } from './fsm';

/** Situação gravada do plano no banco. "vencendo" e "vencido" são derivados de `end_date`. */
export type PmocPlanBaseStatus = 'rascunho' | 'vigente' | 'encerrado';

/** Situação calculada para exibição nos selos e filtros da tela. */
export type PmocDisplayStatus = 'rascunho' | 'vigente' | 'vencendo' | 'vencido' | 'encerrado';

/** Conselho profissional do responsável técnico (padrão na BRV: CFT, com termo TRT). */
export type PmocRegistrationType = 'CFT' | 'CREA';

/** Periodicidades aceitas no cronograma de atividades do PMOC. */
export type PmocPeriodicity = 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';

/** Grandezas físicas medidas durante a visita mensal de manutenção. */
export type PmocMeasurementKey =
  | 'current_a'
  | 'temp_supply_c'
  | 'temp_return_c'
  | 'temp_ambient_c';

/** Estado visual da célula na grade anual de execução (equipamento x mês). */
export type PmocVisitCellStatus = 'prevista' | 'concluida' | 'atrasada' | 'nao_se_aplica';

/** Estado gravado de execução de um equipamento em determinado mês. */
export type PmocExecutionRecordStatus = 'pendente' | 'concluida' | 'nao_atendido';

/** Resultado individual de cada tarefa prevista na execução mensal. */
export type PmocTaskResultStatus = 'feito' | 'nao_feito' | 'nao_se_aplica';

/** Fotografia dos dados do endereço vinculado ao plano para listagem e impressão. */
export interface PmocAddressSnapshot {
  /** Nome/apelido do local (ex.: Matriz, Filial Icaraí). */
  label: string | null;
  /** Logradouro do imóvel climatizado. */
  street: string;
  /** Número do imóvel. */
  number: string | null;
  /** Complemento (sala, andar, loja, bloco). */
  complement: string | null;
  /** Bairro do imóvel. */
  district: string | null;
  /** Cidade do imóvel. */
  city: string;
  /** Sigla da UF (ex.: RJ). */
  state: string;
  /** CEP do imóvel. */
  zip_code: string | null;
}

/** Plano de Manutenção, Operação e Controle (tabela sugerida: `pmoc_plans`). */
export interface PmocPlan {
  /** Identificador único (UUID) do plano PMOC. */
  id: string;
  /** Código legível sequencial do plano (ex.: PMOC-2026-0001). */
  code: string;
  /** ID do cliente proprietário/contratante (`customers.id`). */
  customer_id: string;
  /** Nome ou razão social do cliente (snapshot/join para exibição e documento). */
  customer_name: string;
  /** Nome fantasia do cliente, quando PJ. */
  customer_trade_name: string | null;
  /** Tipo de pessoa do cliente (`PF` ou `PJ`) para formatação de documento. */
  customer_person_type: PersonType;
  /** CPF ou CNPJ do cliente (apenas dígitos/alfanuméricos ou formatado). */
  customer_document: string | null;
  /** E-mail do cliente exibido no item 1 do documento PMOC. */
  customer_email: string | null;
  /** Telefone do cliente exibido no item 1 do documento PMOC. */
  customer_phone: string | null;
  /** ID do endereço do cliente atendido pelo plano (`customer_addresses.id`). */
  address_id: string | null;
  /** Cópia dos campos do endereço para exibição rápida e impressão do PMOC. */
  address_snapshot: PmocAddressSnapshot | null;
  /** Data inicial da vigência de 12 meses (`YYYY-MM-DD`). */
  start_date: string;
  /** Data final da vigência (`YYYY-MM-DD`; sugerida = início + 12 meses - 1 dia). */
  end_date: string;
  /** Situação base salva pelo escritório (`rascunho`, `vigente`, `encerrado`). */
  status: PmocPlanBaseStatus;
  /** ID do colaborador responsável técnico (`employees.id`), quando vinculado. */
  responsible_employee_id: string | null;
  /** Nome completo do técnico responsável impresso na capa e seção 2. */
  responsible_name: string;
  /** CPF do técnico responsável impresso na capa e seção 2. */
  responsible_cpf: string | null;
  /** E-mail de contato do responsável técnico (usa o da BRV quando nulo). */
  responsible_email: string | null;
  /** Telefone de contato do responsável técnico (usa o da BRV quando nulo). */
  responsible_phone: string | null;
  /** Conselho profissional do responsável (`CFT` gera TRT; `CREA` gera ART). */
  registration_type: PmocRegistrationType;
  /** Número do registro profissional no conselho (CFT ou CREA). */
  registration_number: string;
  /** Número do Termo/Anotação de Responsabilidade Técnica (TRT ou ART). */
  responsibility_term_number: string;
  /** URL pública do arquivo PDF ou imagem do TRT/ART anexado ao plano. */
  trt_attachment_url: string | null;
  /** Nome original do arquivo do TRT/ART anexado. */
  trt_attachment_name: string | null;
  /** Tipo MIME do anexo do TRT/ART (`application/pdf`, `image/png`, `image/jpeg`, `image/webp`). */
  trt_attachment_mime: string | null;
  /** Texto do campo "Elaborado por" na capa (padrão: razão social da BRV). */
  elaborated_by: string;
  /** Observações internas do escritório sobre o contrato/plano. */
  notes: string | null;
  /** Data e hora de criação do registro (ISO 8601). */
  created_at: string;
  /** Data e hora da última alteração do registro (ISO 8601). */
  updated_at: string;
}

/** Item retornado na listagem `/pmoc`, com contadores agregados do plano. */
export interface PmocPlanSummary extends PmocPlan {
  /** Total de equipamentos ativos vinculados ao plano. */
  equipment_count: number;
  /** Mês da próxima visita prevista (`YYYY-MM`), ou `null` quando não houver. */
  next_visit_month: string | null;
  /** Quantidade de meses anteriores ao atual com visitas pendentes/não concluídas. */
  overdue_visits_count: number;
}

/** Dados de entrada para criar ou atualizar os dados gerais de um plano PMOC. */
export type PmocPlanInput = Omit<PmocPlan, 'id' | 'code' | 'created_at' | 'updated_at'> & {
  /** Informado apenas na edição de um plano existente. */
  id?: string;
};

/** Ambiente climatizado do plano (tabela sugerida: `pmoc_environments`). */
export interface PmocEnvironment {
  /** Identificador único do ambiente no plano. */
  id: string;
  /** ID do plano PMOC (`pmoc_plans.id`). */
  plan_id: string;
  /** Nome do ambiente ou conjunto climatizado (único dentro do plano). */
  name: string;
  /** Sigla de 2 a 3 letras maiúsculas usada para formar `AR-<SIGLA>-<0001>` (única no plano). */
  code: string;
  /** Quantidade de ocupantes fixos no ambiente. */
  fixed_occupants: number;
  /** Quantidade de ocupantes flutuantes no ambiente. */
  floating_occupants: number;
  /** Área climatizada total em metros quadrados (m²). */
  area_m2: number;
  /** Posição da linha na tabela de ambientes. */
  sort_order: number;
  /** Data e hora de criação do ambiente (ISO 8601). */
  created_at: string;
}

/** Equipamento vinculado a um plano PMOC (tabela sugerida: `pmoc_plan_equipments`). */
export interface PmocPlanEquipment {
  /** Identificador único do equipamento dentro do plano. */
  id: string;
  /** ID do plano PMOC (`pmoc_plans.id`). */
  plan_id: string;
  /** ID do equipamento no cadastro geral (`equipments.id`), ou `null` quando avulso. */
  equipment_id: string | null;
  /** ID do ambiente climatizado no plano (`pmoc_environments.id`); `null` pede escolha. */
  environment_id: string | null;
  /** Tipo/categoria do aparelho (ex.: Split Hi-Wall, Cassete, Split Piso-Teto, VRF). */
  equipment_type: string;
  /** Nome descritivo do equipamento no plano (ex.: Split da Sala de Reunião). */
  name: string;
  /** Marca do fabricante (opcional, herdada de `equipments`). */
  brand: string | null;
  /** Modelo comercial/técnico (opcional, herdado de `equipments`). */
  model: string | null;
  /** Número de série do aparelho (opcional, herdado de `equipments`). */
  serial_number: string | null;
  /** Carga térmica nominal em BTUs (ex.: 12000). */
  capacity_btu: number;
  /** Código identificador único no plano no padrão `AR-<SIGLA>-<0001>`. */
  identifier: string;
  /** URL pública da foto de identificação do equipamento exibida no item 4 do PMOC. */
  photo_url: string | null;
  /** ID do anexo na tabela `attachments`, quando persistido no banco. */
  photo_attachment_id: string | null;
  /** Ordem de exibição do aparelho (define a letra A, B, C... no cronograma). */
  sort_order: number;
  /** Indica se o equipamento está ativo no plano. */
  active: boolean;
  /** Token público opaco do equipamento (`equipments.public_token`) para `/equipamento/:token`. */
  public_token?: string | null;
  /** Data e hora de inclusão no plano (ISO 8601). */
  created_at: string;
}

/** Tarefa do cronograma de um equipamento específico do plano (tabela sugerida: `pmoc_equipment_tasks`). */
export interface PmocEquipmentTask {
  /** Identificador único da tarefa no cronograma do equipamento. */
  id: string;
  /** ID do plano PMOC (`pmoc_plans.id`). */
  plan_id: string;
  /** ID do equipamento do plano (`pmoc_plan_equipments.id`). */
  plan_equipment_id: string;
  /** ID do item do modelo padrão de origem, ou `null` se adicionada manualmente. */
  template_item_id: string | null;
  /** Descrição técnica da atividade de manutenção preventiva. */
  description: string;
  /** Periodicidade de execução da tarefa no ano. */
  periodicity: PmocPeriodicity;
  /** Mês inicial relativo ao início do plano (1 a 12, onde 1 = primeiro mês da vigência). */
  start_month_offset: number;
  /** Indica se a tarefa pede registro numérico de medições na visita. */
  requires_measurement: boolean;
  /** Lista de grandezas exigidas nesta tarefa (`current_a`, `temp_supply_c`, etc.). */
  measurement_fields: PmocMeasurementKey[];
  /** Ordem de exibição da tarefa dentro do bloco do equipamento. */
  sort_order: number;
  /** Se `false`, fica riscada no editor e é omitida do documento e das execuções. */
  active: boolean;
}

/** Valores das medições aferidas em um equipamento durante a visita mensal. */
export interface PmocMeasurements {
  /** Corrente elétrica do ventilador/compressor em Ampères (A). */
  current_a: number | null;
  /** Temperatura do ar de insuflamento em graus Celsius (°C). */
  temp_supply_c: number | null;
  /** Temperatura do ar de retorno em graus Celsius (°C). */
  temp_return_c: number | null;
  /** Temperatura do ar ambiente em graus Celsius (°C). */
  temp_ambient_c: number | null;
}

/** Resultado apurado de uma tarefa específica na execução mensal de um equipamento. */
export interface PmocTaskExecutionItem {
  /** ID da tarefa correspondente no cronograma (`pmoc_equipment_tasks.id`). */
  equipment_task_id: string;
  /** Cópia da descrição da tarefa no momento da execução. */
  description: string;
  /** Periodicidade da tarefa executada. */
  periodicity: PmocPeriodicity;
  /** Situação apurada pelo técnico (`feito`, `nao_feito`, `nao_se_aplica`). */
  result: PmocTaskResultStatus;
  /** Observação opcional específica desta tarefa. */
  notes: string | null;
}

/** Registro mensal de execução por equipamento (tabela sugerida: `pmoc_executions`). */
export interface PmocEquipmentMonthExecution {
  /** Identificador único do registro de execução mensal do equipamento. */
  id: string;
  /** ID do plano PMOC (`pmoc_plans.id`). */
  plan_id: string;
  /** ID do equipamento no plano (`pmoc_plan_equipments.id`). */
  plan_equipment_id: string;
  /** Mês de referência da manutenção no formato `YYYY-MM` (ex.: `2026-10`). */
  reference_month: string;
  /** Estado gravado da manutenção deste aparelho no mês. */
  status: PmocExecutionRecordStatus;
  /** ID da Ordem de Serviço vinculada (`service_orders.id`), quando já gerada. */
  service_order_id: string | null;
  /** Número sequencial da OS vinculada (`service_orders.number`) para exibição. */
  service_order_number: number | null;
  /** ID do técnico que executou ou está escalado (`employees.id`). */
  technician_id: string | null;
  /** Nome do técnico executor para exibição na grade e no relatório mensal. */
  technician_name: string | null;
  /** Data e hora da conclusão/execução em campo (ISO 8601). */
  executed_at: string | null;
  /** Medições elétricas e térmicas registradas para o aparelho no mês. */
  measurements: PmocMeasurements;
  /** Resultados das tarefas previstas naquele mês para o aparelho. */
  task_results: PmocTaskExecutionItem[];
  /** Observações gerais anotadas pelo técnico sobre o equipamento. */
  technician_notes: string | null;
  /** URLs públicas das fotos registradas na manutenção mensal do equipamento. */
  photo_urls: string[];
  /** Motivo informado quando o equipamento não foi atendido na visita (`nao_atendido`). */
  unattended_reason: string | null;
  /** Nome de quem acompanhou a visita presencial no cliente (registrado ao concluir a atividade). */
  accompanied_by?: string | null;
  /** Data e hora da última atualização do registro (ISO 8601). */
  updated_at: string;
}

/** Dados de agendamento escolhidos pelo escritório ao gerar a OS do mês (Entrega 1). */
export interface PmocGenerateOsScheduleInput {
  /** ID do técnico ativo escalado para a visita (`employees.id`). */
  technician_id: string;
  /** Nome do técnico (usado na demonstração em memória). */
  technician_name?: string | null;
  /** Data e hora de início agendadas em ISO 8601 completo (montado via `deCamposDataHora`). */
  scheduled_start: string;
  /** Duração prevista da visita em minutos (obrigatória; sugerida 30 min por aparelho). */
  estimated_minutes: number;
}

/** Retorno da ação "Gerar OS do mês" na aba Execução e no painel PMOC do mês. */
export interface PmocGenerateOsResult {
  /** ID da Ordem de Serviço criada ou já existente para o mês. */
  service_order_id: string;
  /** Número da Ordem de Serviço criada ou já existente. */
  service_order_number: number;
  /** ID da atividade (`tasks.id`) criada para a visita do mês. */
  task_id?: string | null;
  /** Mês de referência (`YYYY-MM`) para o qual a OS foi gerada. */
  reference_month: string;
  /** Quantidade de equipamentos com tarefas previstas incluídos na OS. */
  equipments_included: number;
  /** Indica se já havia OS vinculada para todos os aparelhos daquele mês. */
  already_existed: boolean;
  /** Mensagem amigável em português para exibir ao operador do escritório. */
  message: string;
}

/** Situação mensal de um plano vigente no painel "PMOC do mês" (Entrega 2). */
export type PmocMonthPlanStatus = 'sem_os' | 'os_agendada' | 'executada' | 'atrasada';

/** Linha de um plano vigente no painel "PMOC do mês" (Entrega 2). */
export interface PmocMonthPlanItem {
  /** ID do plano PMOC (`pmoc_plans.id`). */
  plan_id: string;
  /** Código legível do plano (`PMOC-AAAA-NNNN`). */
  plan_code: string;
  /** ID do cliente (`customers.id`). */
  customer_id: string;
  /** Razão social ou nome do cliente. */
  customer_name: string;
  /** Nome fantasia do cliente, quando houver. */
  customer_trade_name: string | null;
  /** Telefone do cliente para envio do relatório pelo WhatsApp. */
  customer_phone: string | null;
  /** Endereço resumido do plano. */
  address_snapshot: PmocAddressSnapshot | null;
  /** Mês consultado (`YYYY-MM`). */
  reference_month: string;
  /** Posição do mês na vigência do plano (`1..12`). */
  month_offset: number;
  /** Quantidade de equipamentos ativos com tarefas previstas neste mês. */
  equipment_count_in_month: number;
  /** Soma das tarefas previstas nos equipamentos do plano neste mês. */
  task_count_in_month: number;
  /** Situação consolidada do plano no mês (`sem_os`, `os_agendada`, `executada`, `atrasada`). */
  status: PmocMonthPlanStatus;
  /** ID da OS vinculada ao mês, se já gerada. */
  service_order_id: string | null;
  /** Número da OS vinculada ao mês, se já gerada. */
  service_order_number: number | null;
  /** ID da atividade (`tasks.id`) vinculada à OS do mês, se houver. */
  task_id: string | null;
  /** ID do técnico escalado ou executor. */
  technician_id: string | null;
  /** Nome do técnico escalado ou executor. */
  technician_name: string | null;
  /** Data/hora agendada da visita (ISO 8601), quando disponível. */
  scheduled_start: string | null;
  /** Data/hora de conclusão da execução (ISO 8601), quando executada. */
  executed_at: string | null;
  /** Nome de quem acompanhou a visita no cliente. */
  accompanied_by: string | null;
  /** Token público do relatório mensal, quando já gerado. */
  report_token: string | null;
}

/** Resumo consolidado retornado por `resumoDoMes(mes)` para o painel "PMOC do mês" e cartão do Dashboard. */
export interface PmocMonthSummary {
  /** Mês de referência consultado (`YYYY-MM`). */
  reference_month: string;
  /** Total de planos vigentes no sistema (se `0`, o cartão do Dashboard não é exibido). */
  active_plans_total: number;
  /** Contadores das 4 situações no mês selecionado. */
  counts: {
    sem_os: number;
    os_agendada: number;
    executada: number;
    atrasada: number;
  };
  /** Planos vigentes que possuem visita prevista no mês selecionado. */
  items: PmocMonthPlanItem[];
}

/** Dados de um equipamento do plano para preenchimento do checklist no app do técnico (Entrega 3). */
export interface PmocFieldEquipmentChecklist {
  /** ID do vínculo do aparelho no plano (`pmoc_plan_equipments.id`). */
  plan_equipment_id: string;
  /** ID do aparelho no cadastro geral (`equipments.id`), usado ao anexar fotos. */
  equipment_id: string | null;
  /** Letra do aparelho no plano (`A`, `B`, `C`...). */
  letter: string;
  /** Nome descritivo do aparelho no plano. */
  name: string;
  /** Identificador no padrão `AR-<SIGLA>-<0001>`. */
  identifier: string;
  /** Nome do ambiente climatizado. */
  environment_name: string | null;
  /** Categoria/tipo do equipamento. */
  equipment_type: string;
  /** Capacidade em BTUs. */
  capacity_btu: number;
  /** Estado atual do preenchimento deste aparelho no mês (`pendente`, `concluida`, `nao_atendido`). */
  status: PmocExecutionRecordStatus;
  /** Tarefas previstas especificamente para este aparelho neste mês. */
  scheduled_tasks: PmocEquipmentTask[];
  /** Grandezas de medição pedidas pelas tarefas previstas deste mês. */
  required_measurements: PmocMeasurementKey[];
  /** Resultados salvos por tarefa. */
  task_results: PmocTaskExecutionItem[];
  /** Medições salvas para o aparelho no mês. */
  measurements: PmocMeasurements;
  /** Observações gerais do aparelho na visita. */
  technician_notes: string | null;
  /** Fotos já registradas para este aparelho na visita do mês. */
  photo_urls: string[];
  /** Motivo obrigatório quando `status === 'nao_atendido'`. */
  unattended_reason: string | null;
  /** Data/hora da última gravação deste aparelho. */
  updated_at: string | null;
}

/** Retorno de `buscarChecklistDaAtividade(taskId)` para o app de campo (`/campo/atividade/:id`). */
export interface PmocActivityChecklist {
  /** Indica se a OS da atividade é de manutenção PMOC. */
  is_pmoc: boolean;
  /** ID da atividade (`tasks.id`). */
  task_id: string;
  /** ID da OS (`service_orders.id`). */
  service_order_id: string | null;
  /** Número da OS (`service_orders.number`). */
  service_order_number: number | null;
  /** ID do plano PMOC (`pmoc_plans.id`). */
  plan_id: string | null;
  /** Código do plano (`PMOC-AAAA-NNNN`). */
  plan_code: string | null;
  /** Nome do cliente. */
  customer_name: string | null;
  /** Mês de referência da manutenção (`YYYY-MM`). */
  reference_month: string | null;
  /** Nome de quem acompanhou a visita, se já concluída. */
  accompanied_by: string | null;
  /** Lista ordenada de aparelhos do plano com tarefas previstas no mês da OS. */
  equipments: PmocFieldEquipmentChecklist[];
}

/** Dados enviados pelo técnico ao salvar um aparelho no checklist de campo (`salvarExecucaoAparelho`). */
export interface PmocSaveEquipmentExecutionInput {
  /** ID da atividade em campo (`tasks.id`). */
  task_id: string;
  /** ID do plano PMOC (`pmoc_plans.id`). */
  plan_id: string;
  /** ID do aparelho no plano (`pmoc_plan_equipments.id`). */
  plan_equipment_id: string;
  /** Mês de referência (`YYYY-MM`). */
  reference_month: string;
  /** Desfecho do aparelho na visita (`concluida` = Feito; `nao_atendido` = Não atendido). */
  status: 'concluida' | 'nao_atendido';
  /** Resultados individuais de cada tarefa prevista no mês. */
  task_results: PmocTaskExecutionItem[];
  /** Medições elétricas e térmicas aferidas. */
  measurements: PmocMeasurements;
  /** Observações livres sobre o aparelho. */
  technician_notes: string | null;
  /** URLs públicas das fotos anexadas ao aparelho nesta visita. */
  photo_urls: string[];
  /** Motivo obrigatório quando `status === 'nao_atendido'`. */
  unattended_reason: string | null;
}

/** Item do histórico de manutenções exibido na página pública do aparelho (`/equipamento/:token`). */
export interface PmocPublicEquipmentHistoryItem {
  /** Mês de referência (`YYYY-MM`). */
  reference_month: string;
  /** Data/hora da execução (ISO 8601). */
  executed_at: string | null;
  /** Situação da manutenção do aparelho naquele mês. */
  status: 'concluida' | 'nao_atendido';
  /** Quantidade de tarefas marcadas como `feito`. */
  tasks_done_count: number;
  /** Total de tarefas previstas para o aparelho naquele mês. */
  tasks_total_count: number;
  /** Token público do relatório mensal daquele mês, para abrir `/relatorio-pmoc/:token`. */
  report_token: string | null;
}

/** Dados públicos e estritamente seguros do aparelho aberto pelo QR Code (`/equipamento/:token`, Entrega 5). */
export interface PmocPublicEquipmentView {
  /** Token público consultado (`equipments.public_token`). */
  token: string;
  /** Nome fantasia do cliente (nunca exibe CPF/CNPJ, telefone ou endereço completo). */
  customer_display_name: string;
  /** Ambiente onde o aparelho está instalado. */
  environment_name: string | null;
  /** Identificador no plano (`AR-SR-0001`). */
  identifier: string;
  /** Nome descritivo do aparelho. */
  name: string;
  /** Tipo/categoria do aparelho (`Split Hi-Wall`, `Cassete`...). */
  equipment_type: string;
  /** Marca do aparelho, se informada. */
  brand: string | null;
  /** Modelo do aparelho, se informado. */
  model: string | null;
  /** Capacidade térmica em BTUs. */
  capacity_btu: number;
  /** Indica se o aparelho pertence a um plano PMOC vigente hoje. */
  has_active_plan: boolean;
  /** Dados públicos do plano vigente (ou `null` quando sem plano vigente). */
  active_plan: {
    code: string;
    start_date: string;
    end_date: string;
    responsible_name: string;
    registration_type: PmocRegistrationType;
    registration_number: string;
    responsibility_term_number: string;
  } | null;
  /** Últimas manutenções registradas para o aparelho (até 12). */
  recent_maintenances: PmocPublicEquipmentHistoryItem[];
}

/** Retorno do envio de etiquetas de QR Code dos aparelhos para a fila de impressão (`imprimirEtiquetas`). */
export interface PmocPrintLabelsResult {
  /** Quantidade de etiquetas enviadas para a fila. */
  printed_count: number;
  /** Mensagem amigável de confirmação (ex.: `"3 etiquetas enviadas para a impressora"`). */
  message: string;
}

/** Estrutura consolidada para renderizar o Relatório Mensal de Execução (Entrega 4). */
export interface PmocMonthlyReport {
  /** Dados completos do plano PMOC. */
  plan: PmocPlan;
  /** Ambientes cadastrados no plano. */
  environments: PmocEnvironment[];
  /** Mês de referência do relatório (`YYYY-MM`). */
  reference_month: string;
  /** Posição do mês dentro da vigência do plano (1 a 12). */
  month_offset: number;
  /** Número da OS principal da visita no mês, se houver. */
  service_order_number: number | null;
  /** Nome do técnico executor principal da visita no mês. */
  technician_name: string | null;
  /** Data/hora de referência da visita executada (ISO 8601). */
  executed_at: string | null;
  /** Nome de quem acompanhou a visita presencial no cliente (obrigatório ao concluir no app). */
  accompanied_by?: string | null;
  /** Token público de conferência do relatório mensal (`/relatorio-pmoc/:token`). */
  public_token?: string | null;
  /** Equipamentos efetivamente atendidos no mês com checklist, medições e fotos. */
  attended_equipments: Array<{
    /** Dados do equipamento no plano. */
    equipment: PmocPlanEquipment;
    /** Letra do equipamento no plano (A, B, C...). */
    letter: string;
    /** Nome do ambiente onde o equipamento está instalado. */
    environment_name: string | null;
    /** Dados da execução mensal daquele equipamento. */
    execution: PmocEquipmentMonthExecution;
  }>;
  /** Equipamentos que tinham tarefas no mês mas não foram atendidos, com o motivo. */
  unattended_equipments: Array<{
    /** Dados do equipamento no plano. */
    equipment: PmocPlanEquipment;
    /** Letra do equipamento no plano (A, B, C...). */
    letter: string;
    /** Nome do ambiente onde o equipamento está instalado. */
    environment_name: string | null;
    /** Justificativa pela qual não foi atendido na visita do mês. */
    reason: string;
  }>;
}

/** Item de tarefa pertencente a um modelo padrão por tipo de equipamento. */
export interface PmocTaskTemplateItem {
  /** Identificador único da tarefa dentro do modelo. */
  id: string;
  /** Descrição da tarefa preventiva. */
  description: string;
  /** Periodicidade padrão sugerida ao aplicar o modelo. */
  periodicity: PmocPeriodicity;
  /** Mês de início relativo padrão (1 a 12; 1 = mês de início do plano). */
  relative_start_month: number;
  /** Define se esta tarefa exige preenchimento de medições. */
  requires_measurement: boolean;
  /** Quais grandezas devem ser medidas quando `requires_measurement` for `true`. */
  measurement_fields: PmocMeasurementKey[];
  /** Ordem de exibição da tarefa no modelo. */
}

/** Item completo numerado do modelo de tarefas (com `sort_order`). */
export interface PmocTaskTemplateRow extends PmocTaskTemplateItem {
  /** Posição da tarefa na lista do modelo. */
  sort_order: number;
}

/** Modelo padrão de tarefas por tipo de equipamento (tabela sugerida: `pmoc_task_templates`). */
export interface PmocTaskTemplate {
  /** Identificador único do modelo. */
  id: string;
  /** Nome do tipo de equipamento ao qual o modelo se aplica (ex.: Split Hi-Wall). */
  equipment_type: string;
  /** Observação opcional sobre onde o modelo é usado. */
  description: string | null;
  /** Lista ordenada de tarefas padrão deste tipo de equipamento. */
  tasks: PmocTaskTemplateRow[];
  /** Data e hora da última edição do modelo (ISO 8601). */
  updated_at: string;
}

