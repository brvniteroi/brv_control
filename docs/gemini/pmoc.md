# Resumo para auditoria — Módulo PMOC

Documento de entrega e auditoria referente a `docs/gemini/pmoc-briefing.md`.

---

## 1. Arquivos criados e alterados

### Arquivos criados (18)

- `src/types/pmoc.ts` — Tipos e interfaces TypeScript do módulo PMOC (planos, ambientes, equipamentos do plano, tarefas do cronograma, execuções mensais, medições, relatórios mensais e modelos de tarefas), com nomes de campos em inglês no padrão do banco e comentários em português em cada propriedade.
- `src/components/pmoc/empresa.ts` — Constantes institucionais da BRV Niterói (`EMPRESA_BRV`), textos legais da capa/rodapé e as 4 linhas fixas exatas da Seção 6 (`RECOMENDACOES_FIXAS_PMOC`) extraídas de `PMOC BRV Control.docx`.
- `src/components/pmoc/regrasPmoc.ts` — Funções puras de regras de negócio e formatação: cálculo de fim de vigência (`+12 meses - 1 dia`), situação do plano (`Vence em N dias` até 60 dias), sugestão/normalização de sigla de ambiente, geração de identificador `AR-<SIGLA>-<0001>`, letra do bloco (`A, B, C...`), meses do plano, cálculo de incidência por periodicidade, estado da célula de execução e formatadores (`BTUs`, `m²`, medições e endereço).
- `src/components/pmoc/dadosDemo.ts` — Conjunto inicial de dados de demonstração (4 modelos de tarefas incluindo as 22 tarefas oficiais de split da BRV com medições nas tarefas 2 e 3, 2 planos fictícios com CNPJs alfanuméricos sintéticos `00DEM...`, 3 ambientes, 5 equipamentos com fotos SVG embutidas, cronograma completo e execuções mensais concluídas, não atendidas, atrasadas e previstas).
- `src/components/pmoc/fonteDeDados.ts` — Única camada assíncrona de leitura e gravação consumida pelas telas do PMOC (`FONTE_DADOS_DEMO = true`), operando hoje em memória sobre uma cópia clonada de `dadosDemo.ts`.
- `src/components/pmoc/FaixaDadosDemo.tsx` — Faixa discreta `"Dados de demonstração"` exibida no topo das telas enquanto `FONTE_DADOS_DEMO` for `true` e ocultada na impressão (`print:hidden`).
- `src/pages/Pmoc.tsx` — Entrega 1: listagem `/pmoc` com resumo no topo (vigentes, vencendo em até 60 dias, visitas atrasadas), busca textual, filtro por situação, tabela em telas médias/grandes, cartões no celular e estados de carregando, erro com `"Tentar de novo"` e vazio.
- `src/pages/PmocEditorPage.tsx` — Página das rotas `/pmoc/novo` e `/pmoc/:id`, aplicando bloqueio visual de perfil (`admin` e `escritorio`) e montando `EditorPlanoPmoc`.
- `src/components/pmoc/EditorPlanoPmoc.tsx` — Entrega 2 (orquestrador): cabeçalho com cliente, situação, `"Documento (imprimir/PDF)"` e `"Salvar"` (`"Salvando..."` com trava de clique duplo), controle de alterações não salvas (`beforeunload` + confirmação ao sair), validação completa em português e navegação entre as 6 abas.
- `src/components/pmoc/AbaGeralPmoc.tsx` — Aba **Geral** do editor: escolha de cliente com `SeletorCliente`, seleção de endereço via `listarEnderecosDoCliente` (`src/services/ordens.ts`), vigência com sugestão de término, seleção de colaborador ativo via `listarColaboradores` (`src/services/equipe.ts`), registro `CFT`/`CREA` com rótulo dinâmico `TRT`/`ART`, anexo PDF/imagem do termo, observações e situação base do plano.
- `src/components/pmoc/AbaAmbientesPmoc.tsx` — Aba **Ambientes** do editor: tabela editável com adicionar, duplicar e remover linha, sugestão automática de sigla (2 a 3 letras maiúsculas), alertas visuais de nome/sigla repetidos e linha de totais no rodapé (ocupantes fixos, flutuantes e área em `m²`).
- `src/components/pmoc/AbaEquipamentosPmoc.tsx` — Aba **Equipamentos** do editor: vínculo com ambiente (com alerta `"Escolha o ambiente"` quando vazio), identificador automático `AR-<SIGLA>-<0001>` editável e único no plano, miniatura de foto com ampliação/troca/remoção, modal `"Adicionar equipamento do cliente"` consumindo `listarEquipamentos` (`src/services/equipamentos.ts`) e atalho `"Cadastrar novo"` para `/equipamentos`.
- `src/components/pmoc/AbaCronogramaPmoc.tsx` — Aba **Cronograma** do editor: blocos recolhíveis por equipamento (`A · Nome · Identificador · BTUs`), edição de descrição/periodicidade/mês inicial, ativação/desativação (tarefas inativas ficam riscadas), reordenação, adição de tarefa avulsa, `"Aplicar modelo padrão"`, `"Copiar cronograma para os outros equipamentos do mesmo tipo"` e grade lateral de visão anual (12 meses com contagem de tarefas por mês).
- `src/components/pmoc/AbaExecucaoPmoc.tsx` — Aba **Execução** do editor: grade `equipamentos × 12 meses` com células coloridas (`Prevista`, `Concluída`, `Atrasada`, `Não se aplica`), painel detalhado ao clicar (OS ligada, técnico, data/hora, medições, observações, fotos, tarefas previstas no mês e botão `"Ver relatório"`), seletor de mês e botão `"Gerar OS do mês"`.
- `src/components/pmoc/DocumentoPmoc.tsx` — Entrega 3: documento PMOC oficial imprimível em A4 retrato (usando `createPortal` em `document.body` para contornar `body > #root { display: none !important }` no `@media print`), reproduzindo Capa, Seções 1 a 6, Anexo de TRT/ART e rodapé repetido `"Criado em {data} pela plataforma BRV Control"`.
- `src/components/pmoc/RelatorioExecucaoPmoc.tsx` — Entrega 4: relatório mensal de execução imprimível em A4 retrato (`createPortal` em `document.body` + `window.print()`), exibindo cabeçalho da visita, equipamentos atendidos com checklist, medições (`A` e `°C`), observações e miniaturas de fotos, seção `"Não atendidos"` com motivo e bloco final de assinatura do responsável técnico.
- `src/pages/PmocModelo.tsx` — Entrega 5: editor `/pmoc/modelo` de modelos padrão de tarefas por tipo de equipamento, com aviso fixo `"Alterar o modelo não muda planos já criados."`, criação/duplicação de tipo, busca interna, periodicidade, mês relativo (1 a 12), exigência e seleção de grandezas de medição, reordenação, adição e remoção.
- `docs/gemini/pmoc.md` — Este documento de auditoria.

### Arquivos alterados (2)

- `src/App.tsx` — Importadas as páginas `Pmoc`, `PmocEditorPage` e `PmocModelo` e registradas 4 rotas protegidas dentro de `<Route element={<Layout />}>`: `pmoc`, `pmoc/modelo`, `pmoc/novo` e `pmoc/:id`.
- `src/components/Sidebar.tsx` — Importado o ícone `FileCheck2` (`lucide-react`) e adicionado o item `{ rota: '/pmoc', rotulo: 'PMOC', icone: FileCheck2, apenasEscritorio: true }` dentro do grupo `'Serviços'`.

*(Observação: nenhum arquivo em `supabase/`, `src/services/`, `src/contexts/`, `src/components/campo/`, `src/pages/campo/`, `public/sw.js`, `android/` ou `scripts/field-control/` foi alterado.)*

---

## 2. Telas e rotas

| Rota | Componente principal | Quem pode abrir | Entregas cobertas |
| --- | --- | --- | --- |
| `/pmoc` | `src/pages/Pmoc.tsx` | Autenticados no `Layout`, visível no menu e liberado na tela apenas para `admin` e `escritorio` (`tecnico` vê bloqueio de acesso restrito) | **Entrega 1** (lista de planos, indicadores de resumo, busca e filtro por situação) |
| `/pmoc/novo` | `src/pages/PmocEditorPage.tsx` → `EditorPlanoPmoc.tsx` | Apenas `admin` e `escritorio` | **Entrega 2** (criação de plano com as 6 abas) e **Entrega 3** (aba Documento + modal de impressão) |
| `/pmoc/:id` | `src/pages/PmocEditorPage.tsx` → `EditorPlanoPmoc.tsx` | Apenas `admin` e `escritorio` | **Entrega 2** (edição completa das 6 abas), **Entrega 3** (`DocumentoPmoc` na aba Documento e no botão do cabeçalho) e **Entrega 4** (`RelatorioExecucaoPmoc` aberto pela aba Execução) |
| `/pmoc/modelo` | `src/pages/PmocModelo.tsx` | Apenas `admin` e `escritorio` | **Entrega 5** (editor do modelo padrão de tarefas por tipo de equipamento) |

---

## 3. Contrato de dados que o Claude precisa implementar

### 3.1. Funções exportadas por `src/components/pmoc/fonteDeDados.ts`

Quando as tabelas e RPCs/services em `src/services/pmoc.ts` estiverem prontos, basta delegar estas funções e alterar `FONTE_DADOS_DEMO` para `false`:

| Função | Parâmetros | Retorno | Comportamento esperado no banco |
| --- | --- | --- | --- |
| `listarPlanos` | `()` | `Promise<PmocPlanSummary[]>` | Lista planos ordenados por `start_date DESC`, agregando `equipment_count` (ativos), `next_visit_month` (`YYYY-MM`) e `overdue_visits_count`. |
| `buscarPlano` | `(id: string)` | `Promise<PmocPlan \| null>` | Busca um plano por UUID com dados do cliente e snapshot/endereço, ou `null` se não existir. |
| `salvarPlano` | `(dados: PmocPlanInput)` | `Promise<PmocPlan>` | Faz `insert` (gerando `code` sequencial `PMOC-YYYY-NNNN` no servidor) quando `dados.id` está ausente, ou `update` quando presente. |
| `listarAmbientes` | `(planId: string)` | `Promise<PmocEnvironment[]>` | Lista ambientes do plano ordenados por `sort_order ASC`. |
| `salvarAmbientes` | `(planId: string, itens: SalvarAmbienteItemInput[])` | `Promise<PmocEnvironment[]>` | Sincroniza ambientes do plano (upsert + remoção dos excluídos). Equipamentos vinculados a ambiente removido devem ter `environment_id = NULL` (`ON DELETE SET NULL`). |
| `listarEquipamentosDoPlano` | `(planId: string)` | `Promise<PmocPlanEquipment[]>` | Lista equipamentos do plano ordenados por `sort_order ASC`. |
| `salvarEquipamentosDoPlano` | `(planId: string, itens: SalvarEquipamentoPlanoInput[])` | `Promise<PmocPlanEquipment[]>` | Sincroniza equipamentos do plano (`sort_order` 1..N). Para novos aparelhos sem tarefas ainda gravadas, inicializa tarefas a partir de `pmoc_task_templates` correspondente ao `equipment_type`. |
| `buscarCronograma` | `(planId: string)` | `Promise<PmocEquipmentTask[]>` | Lista todas as tarefas dos equipamentos do plano ordenadas por `sort_order ASC`. |
| `salvarCronograma` | `(planId: string, tarefas: PmocEquipmentTask[])` | `Promise<PmocEquipmentTask[]>` | Grava as alterações de tarefas (descrição, periodicidade, `start_month_offset`, `active`, reordenação, novas e excluídas) por equipamento do plano. |
| `listarExecucoes` | `(planId: string)` | `Promise<PmocEquipmentMonthExecution[]>` | Lista os registros mensais de execução de todos os equipamentos do plano, incluindo número da OS e nome do técnico executor. |
| `gerarOsDoMes` | `(planId: string, referenceMonth: string)` | `Promise<PmocGenerateOsResult>` | Regra transacional no servidor (RPC): localiza equipamentos ativos com tarefas previstas no mês, evita duplicar OS caso já exista para o mês, cria `service_orders` + `service_order_equipments` + `tasks` (e formulários/checklists de campo quando integrados) e vincula `pmoc_executions.service_order_id`. |
| `buscarRelatorioMensal` | `(planId: string, referenceMonth: string)` | `Promise<PmocMonthlyReport \| null>` | Monta o consolidado do mês para impressão do relatório de execução (dados do plano, ambientes, OS/técnico/data, aparelhos atendidos com tarefas/medições/fotos e aparelhos não atendidos com justificativa). |
| `listarModelosDeTarefa` | `()` | `Promise<PmocTaskTemplate[]>` | Lista modelos de tarefas ordenados por `equipment_type` com seus itens ordenados por `sort_order`. |
| `salvarModeloDeTarefa` | `(dados: SalvarModeloDeTarefaInput)` | `Promise<PmocTaskTemplate>` | Cria ou atualiza um modelo padrão e seus itens, garantindo unicidade de `equipment_type` (case-insensitive) e sem alterar `pmoc_equipment_tasks` de planos existentes. |
| `enviarFotoEquipamentoPmoc` | `(arquivo: File)` | `Promise<{ url: string; attachment_id: string \| null }>` | Faz upload comprimido da foto de identificação do equipamento (reaproveitando `anexarFoto` / `hostgator-api` com `category: 'placa_equipamento'` ou `'outros'`) e retorna `public_url` + `attachments.id`. |
| `enviarAnexoTrtPmoc` | `(arquivo: File)` | `Promise<{ url: string; file_name: string; mime_type: string }>` | Faz upload do PDF ou imagem do TRT/ART do plano e retorna URL pública, nome original e MIME type. |

### 3.2. Tipos e campos de `src/types/pmoc.ts`

#### `PmocAddressSnapshot` (objeto JSONB ou projeção de `customer_addresses`)
- `label: string | null` — Apelido do endereço (ex.: Matriz, Unidade Icaraí).
- `street: string` — Logradouro.
- `number: string | null` — Número.
- `complement: string | null` — Complemento (exibido em coluna própria no item 1 do documento).
- `district: string | null` — Bairro.
- `city: string` — Cidade.
- `state: string` — UF.
- `zip_code: string | null` — CEP.

#### `PmocPlan` (tabela nova sugerida: `pmoc_plans`)
- `id: string` — UUID PK.
- `code: string` — Código sequencial legível (ex.: `PMOC-2026-0001`), único.
- `customer_id: string` — FK para `customers.id`.
- `customer_name: string`, `customer_trade_name: string | null`, `customer_person_type: 'PF' | 'PJ'`, `customer_document: string | null`, `customer_email: string | null`, `customer_phone: string | null` — Dados do contratante (podem vir de join com `customers` ou snapshot no plano).
- `address_id: string | null` — FK opcional para `customer_addresses.id`.
- `address_snapshot: PmocAddressSnapshot | null` — Snapshot JSONB do endereço do plano.
- `start_date: string` (`DATE`) — Início da vigência.
- `end_date: string` (`DATE`) — Fim da vigência (`>= start_date`).
- `status: 'rascunho' | 'vigente' | 'encerrado'` — Situação base salva (`vencendo` e `vencido` são calculados a partir de `end_date`).
- `responsible_employee_id: string | null` — FK opcional para `employees.id`.
- `responsible_name: string` — Nome do responsável técnico impresso na capa, seção 2 e relatórios.
- `responsible_cpf: string | null` — CPF do responsável técnico.
- `responsible_email: string | null`, `responsible_phone: string | null` — Contato na seção 2 (fallback para e-mail/telefone da BRV).
- `registration_type: 'CFT' | 'CREA'` — Conselho profissional (define `TRT` ou `ART`).
- `registration_number: string` — Número do registro no CFT/CREA.
- `responsibility_term_number: string` — Número do TRT ou ART.
- `trt_attachment_url: string | null`, `trt_attachment_name: string | null`, `trt_attachment_mime: string | null` — Metadados do arquivo PDF/imagem do TRT/ART.
- `elaborated_by: string` — Texto de `"Elaborado por"` na capa (padrão: razão social da BRV).
- `notes: string | null` — Observações internas do escritório.
- `created_at: string`, `updated_at: string` — Timestamps ISO.
- Em `PmocPlanSummary`: acrescenta `equipment_count: number`, `next_visit_month: string | null` e `overdue_visits_count: number`.

#### `PmocEnvironment` (tabela nova sugerida: `pmoc_environments`)
- `id: string` — UUID PK.
- `plan_id: string` — FK para `pmoc_plans.id` (`ON DELETE CASCADE`).
- `name: string` — Nome do ambiente (`UNIQUE (plan_id, lower(name))`).
- `code: string` — Sigla de 2 a 3 letras maiúsculas (`UNIQUE (plan_id, code)`).
- `fixed_occupants: number` (`INTEGER >= 0`) — Ocupantes fixos.
- `floating_occupants: number` (`INTEGER >= 0`) — Ocupantes flutuantes.
- `area_m2: number` (`NUMERIC(10,2) >= 0`) — Área climatizada em m².
- `sort_order: number` — Ordem da linha.
- `created_at: string` — Timestamp ISO.

#### `PmocPlanEquipment` (tabela nova sugerida: `pmoc_plan_equipments`)
- `id: string` — UUID PK.
- `plan_id: string` — FK para `pmoc_plans.id` (`ON DELETE CASCADE`).
- `equipment_id: string | null` — FK opcional para `equipments.id` (`ON DELETE SET NULL`).
- `environment_id: string | null` — FK opcional para `pmoc_environments.id` (`ON DELETE SET NULL`).
- `equipment_type: string` — Tipo do equipamento (ex.: `Split Hi-Wall`, `Cassete`).
- `name: string` — Nome amigável do aparelho dentro do plano.
- `brand: string | null`, `model: string | null`, `serial_number: string | null` — Marca, modelo e série.
- `capacity_btu: number` (`INTEGER >= 0`) — Carga térmica em BTUs.
- `identifier: string` — Identificador `AR-<SIGLA>-<0001>` (`UNIQUE (plan_id, identifier)`).
- `photo_url: string | null`, `photo_attachment_id: string | null` — Foto de identificação do aparelho no item 4 do PMOC (FK opcional para `attachments.id`).
- `sort_order: number` — Define a letra do bloco (`1 -> A`, `2 -> B`, ...).
- `active: boolean` — Indica se o equipamento está ativo no plano.
- `created_at: string` — Timestamp ISO.

#### `PmocEquipmentTask` (tabela nova sugerida: `pmoc_equipment_tasks`)
- `id: string` — UUID PK.
- `plan_id: string` — FK para `pmoc_plans.id` (`ON DELETE CASCADE`).
- `plan_equipment_id: string` — FK para `pmoc_plan_equipments.id` (`ON DELETE CASCADE`).
- `template_item_id: string | null` — Referência opcional ao item de modelo de origem.
- `description: string` — Descrição da tarefa preventiva.
- `periodicity: 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'` — Periodicidade.
- `start_month_offset: number` (`1..12`) — Mês relativo de início dentro da vigência do plano.
- `requires_measurement: boolean` — Indica se exige medições numéricas.
- `measurement_fields: PmocMeasurementKey[]` — Subconjunto de `['current_a', 'temp_supply_c', 'temp_return_c', 'temp_ambient_c']`.
- `sort_order: number` — Ordem dentro do bloco do equipamento.
- `active: boolean` — Se `false`, fica riscada no editor e não sai no documento nem nas execuções.

#### `PmocEquipmentMonthExecution`, `PmocMeasurements`, `PmocTaskExecutionItem` (tabela nova sugerida: `pmoc_executions`)
- `id: string` — UUID PK (`UNIQUE (plan_equipment_id, reference_month)`).
- `plan_id: string`, `plan_equipment_id: string` — FKs do plano e aparelho.
- `reference_month: string` — Mês no formato `YYYY-MM`.
- `status: 'pendente' | 'concluida' | 'nao_atendido'` — Estado gravado da manutenção do aparelho no mês.
- `service_order_id: string | null`, `service_order_number: number | null` — Vínculo com `service_orders`.
- `technician_id: string | null`, `technician_name: string | null` — Vínculo com `employees`.
- `executed_at: string | null` — Data/hora de conclusão em campo.
- `measurements: PmocMeasurements` — `{ current_a, temp_supply_c, temp_return_c, temp_ambient_c }` (`number | null`).
- `task_results: PmocTaskExecutionItem[]` — Lista `{ equipment_task_id, description, periodicity, result: 'feito' | 'nao_feito' | 'nao_se_aplica', notes }`.
- `technician_notes: string | null` — Observações gerais do técnico sobre o aparelho.
- `photo_urls: string[]` — URLs públicas das fotos tiradas na manutenção mensal.
- `unattended_reason: string | null` — Motivo quando `status = 'nao_atendido'`.
- `updated_at: string` — Timestamp ISO.

#### `PmocTaskTemplate` e `PmocTaskTemplateRow` (tabelas novas sugeridas: `pmoc_task_templates` + `pmoc_task_template_items`)
- `id: string`, `equipment_type: string` (único), `description: string | null`, `updated_at: string`.
- Itens (`tasks`): `id`, `description`, `periodicity`, `relative_start_month` (`1..12`), `requires_measurement`, `measurement_fields`, `sort_order`.

### 3.3. O que depende de tabelas novas, colunas em tabelas existentes e regras no servidor

1. **Tabelas novas necessárias no banco**:
   - `pmoc_plans`, `pmoc_environments`, `pmoc_plan_equipments`, `pmoc_equipment_tasks`, `pmoc_executions` (e opcionalmente `pmoc_execution_items` se preferir normalizar `task_results`), `pmoc_task_templates` e `pmoc_task_template_items` (com seed inicial das 22 tarefas da BRV).
   - Opcionalmente `company_settings` para substituir as constantes de `src/components/pmoc/empresa.ts`.
2. **Colunas candidatas em tabelas existentes**:
   - Em `equipments` (`src/types/fsm.ts`): hoje existem `category`, `brand`, `model`, `serial_number`, `capacity_btu` e `location`, mas **não existem** `name` (nome amigável do aparelho) nem foto de identificação padrão (`photo_attachment_id`). Quando o operador importa um aparelho do cliente na aba Equipamentos, o front monta uma sugestão de nome a partir de `category + brand + location`. Se o Claude adicionar `name` em `equipments`, ambos os cadastros podem compartilhar o mesmo nome.
   - Em `employees` (`src/types/fsm.ts`): hoje existem `name`, `role`, `phone`, `email`, mas **não existem** `cpf`, `registration_type` (`CFT`/`CREA`) nem `registration_number`. Ao adicioná-los em `employees`, a seleção do responsável técnico na aba Geral já poderá preencher CPF e registro automaticamente.
   - Em `attachments` / upload (`hostgator-api/upload.php`): o pipeline atual de anexos aceita imagens (`jpeg`, `png`, `webp`) e vídeos importados, mas **não aceita `application/pdf`**. Para persistir o PDF do TRT/ART (`enviarAnexoTrtPmoc`), será preciso habilitar upload de PDF (no Supabase Storage ou no endpoint da HostGator).
3. **Regras que devem subir para o servidor (banco / RPC / RLS)**:
   - RLS restringindo escrita/leitura administrativa de PMOC a `admin` e `escritorio`, e leitura/preenchimento das execuções vinculadas às atividades do próprio `tecnico` quando o checklist de campo for ligado.
   - Sequência/geração concorrente segura para `pmoc_plans.code` (`PMOC-YYYY-NNNN`) e constraint `UNIQUE (plan_id, identifier)` para `AR-<SIGLA>-<0001>`.
   - RPC transacional `gerar_os_mes_pmoc(plan_id, reference_month)` criando uma única OS preventiva para o mês (ou reaproveitando a existente), vinculando os equipamentos aplicáveis e gerando os formulários/checklists de campo.
   - Cálculo SQL/view para `overdue_visits_count` e `next_visit_month` na listagem de planos sem precisar trafegar todas as tarefas e execuções de todos os planos para o cliente.

---

## 4. Regras de negócio implementadas no front

- **Sugestão de término da vigência (`início + 12 meses - 1 dia`)**: `sugerirFimVigencia` em `src/components/pmoc/regrasPmoc.ts`, acionada ao alterar a data de início ou clicar em `"Sugerir +12 meses"` em `src/components/pmoc/AbaGeralPmoc.tsx` (continua livremente editável).
- **Situação calculada do plano (`Rascunho`, `Vigente`, `Vence em N dias`, `Vencido`, `Encerrado`)**: `calcularSituacaoPlano` em `src/components/pmoc/regrasPmoc.ts`. Planos com `status === 'vigente'` cujo `end_date` esteja entre `0` e `60` dias à frente recebem situação `'vencendo'` com selo âmbar (`"Vence hoje"`, `"Vence em 1 dia"` ou `"Vence em N dias"`); datas anteriores a hoje recebem `'vencido'` (vermelho).
- **Rótulo dinâmico `CFT/TRT` vs `CREA/ART`**: `rotuloTermoResponsabilidade` e `nomeExtensoTermoResponsabilidade` em `src/components/pmoc/regrasPmoc.ts`, refletidos em `AbaGeralPmoc.tsx`, `DocumentoPmoc.tsx` e `RelatorioExecucaoPmoc.tsx`.
- **Sugestão e normalização de sigla do ambiente**: `sugerirSiglaAmbiente` (ignora preposições como `de/da/do/e` e extrai 2 a 3 letras maiúsculas sem acento) e `normalizarSiglaAmbiente` em `src/components/pmoc/regrasPmoc.ts`, usadas em `src/components/pmoc/AbaAmbientesPmoc.tsx`.
- **Desvínculo imediato ao remover ambiente**: ao remover um ambiente em `EditorPlanoPmoc.tsx` (`atualizarAmbientes`) e em `fonteDeDados.ts` (`salvarAmbientes`), equipamentos daquele ambiente passam a ter `environment_id = null` e exibem o alerta `"Escolha o ambiente"` na aba Equipamentos.
- **Identificador automático `AR-<SIGLA>-<0001>`**: `gerarProximoIdentificador` e `ehIdentificadorAutomatico` em `src/components/pmoc/regrasPmoc.ts`, acionados em `src/components/pmoc/AbaEquipamentosPmoc.tsx` ao adicionar equipamento ou trocar de ambiente (preservando códigos customizados manualmente).
- **Letra do bloco do equipamento (`A, B, C...`)**: `letraEquipamento` em `src/components/pmoc/regrasPmoc.ts`.
- **Incidência mensal das tarefas por periodicidade**: `gerarMesesDoPlano`, `tarefaCaiNoMes` e `tarefasPrevistasNoMes` em `src/components/pmoc/regrasPmoc.ts`. Tarefas com `active === false` ficam riscadas em `AbaCronogramaPmoc.tsx` e são excluídas da contagem anual, do `DocumentoPmoc.tsx` e das execuções.
- **Estado da célula na grade de Execução**: `calcularEstadoCelulaExecucao` em `src/components/pmoc/regrasPmoc.ts` (`0 tarefas -> nao_se_aplica`; `concluida -> concluida`; `nao_atendido` ou mês passado pendente -> `atrasada`; demais -> `prevista`).
- **Validações antes de salvar (mensagens em português)**:
  - No editor do plano (`validarAntesDeSalvar` em `src/components/pmoc/EditorPlanoPmoc.tsx`): cliente obrigatório; validação de dígitos verificadores de CPF/CNPJ via `documentoValido` (`src/utils/documento.ts`); `end_date >= start_date`; endereço, nome do responsável, número do conselho e número do TRT/ART obrigatórios quando o plano sai de `rascunho`; nome e sigla (`2..3` letras) obrigatórios e únicos nos ambientes; nome, tipo e identificador obrigatórios e identificador único nos equipamentos; ambiente obrigatório em todos os equipamentos ativos quando `status === 'vigente'`; descrição obrigatória nas tarefas ativas. Em caso de erro, o editor troca automaticamente para a aba correspondente.
  - No modelo de tarefas (`handleSalvar` em `src/pages/PmocModelo.tsx`): tipo de equipamento obrigatório e sem duplicidade, mínimo de 1 tarefa, descrição preenchida em todas as tarefas e ao menos 1 grandeza marcada quando `"Exige medição numérica"` estiver ativo.
- **Impressão A4 via Portal**: como `src/index.css` oculta `body > #root` em `@media print`, tanto `DocumentoPmoc.tsx` quanto `RelatorioExecucaoPmoc.tsx` montam a árvore de impressão diretamente em `document.body` via `createPortal`, garantindo que `window.print()` imprima apenas o documento A4 sem menus nem botões.

---

## 5. Premissas e decisões

1. **IDs de demonstração em formato UUID v4 válido**: os clientes fictícios de `dadosDemo.ts` usam UUIDs válidos (`00000000-0000-4000-8000-...`) para que chamadas aos services reais (`listarEnderecosDoCliente`, `listarEquipamentos`) ao abrir um plano demo nunca disparem erro de sintaxe `22P02` no PostgREST.
2. **CNPJs sintéticos alfanuméricos nos dados demo**: usamos `00DEM001000133` (`00.DEM.001/0001-33`) e `00DEM002000188` (`00.DEM.002/0001-88`), que passam no cálculo de dígitos verificadores de `src/utils/documento.ts` (padrão alfanumérico da Receita Federal) e deixam explícito pelo prefixo `00.DEM` que não pertencem a nenhuma empresa real; os CPFs dos responsáveis demo foram mantidos `null`.
3. **Permissão flexível para salvar `Rascunho`**: enquanto o plano está em `rascunho`, o escritório pode salvá-lo mesmo antes de ter o número definitivo do TRT/ART ou de alocar todos os equipamentos em ambientes; ao mudar a situação para `vigente`, todos esses vínculos passam a ser exigidos na validação.
4. **Anexo do TRT/ART no documento impresso**: imagens (`PNG/JPG/WebP/SVG`) são renderizadas diretamente na folha do Anexo; quando o anexo é um arquivo `application/pdf`, a visualização em tela exibe um `<object type="application/pdf">` com botão para abrir em nova guia e, na impressão, informa o nome do PDF anexado para juntada ao documento físico.
5. **Cabeçalho da Seção 3 do documento PMOC**: corrigida a inversão presente no `.docx` de exemplo, separando explicitamente em três colunas numéricas distintas: `Ocupantes fixos`, `Ocupantes flutuantes` e `Área climatizada (m²)`.

---

## 6. Pendências e limitações

- **Persistência apenas em memória na sessão atual**: conforme especificado no briefing, `fonteDeDados.ts` grava em memória (`structuredClone` de `dadosDemo.ts`). Recarregar a página (`F5`) restaura os dados iniciais de demonstração até que o Claude implemente as migrations e `src/services/pmoc.ts`.
- **Geração de OS do mês simulada**: `gerarOsDoMes` em `fonteDeDados.ts` gera um número sequencial em memória (`#9101`, `#9102`...) para demonstrar o fluxo na aba Execução, mas **não grava** registros reais na tabela `service_orders` do Supabase, pois `src/services/` estava fora do escopo permitido.
- **Execução pelo técnico no celular (`/campo`) fora do escopo**: nenhuma rota ou componente em `src/pages/campo/` ou `src/components/campo/` foi criado ou modificado; o preenchimento em campo das tarefas e medições será integrado depois pelo Claude no motor de formulários existente.
- **Numeração `"Página X de Y"` no rodapé impresso**: navegadores Chromium/Firefox/Safari ainda não expõem `counter(pages)` de forma confiável fora de cabeçalhos/rodapés nativos do diálogo de impressão do navegador. O rodapé fixo `"Criado em {data} pela plataforma BRV Control"` se repete em todas as páginas via `tfoot` / layout de impressão, mas a contagem numérica de páginas depende da opção `"Cabeçalhos e rodapés"` da janela de impressão do navegador.
- **O que não foi testado ao vivo neste ambiente**:
  - Não foi feita impressão física em papel A4 nem inspeção visual página a página na pré-visualização nativa do `window.print()` do Chrome/Edge (apenas conferência estática das regras `@media print`, `@page`, `print:break-inside-avoid` e do padrão de `createPortal` já usado em `VisualizarFormulario.tsx`).
  - Não foi executado teste interativo autenticado no navegador nem em aparelho celular real durante esta sessão (verificado estaticamente via `tsc`, `oxlint` e `vite build`).

---

## 7. Verificação

Saída exata da execução final de `npm run typecheck`, `npm run lint` e `npm run build`:

```text
> brv-control@0.1.0 typecheck
> tsc -p tsconfig.json


> brv-control@0.1.0 lint
> oxlint

Found 0 warnings and 0 errors.
Finished in 194ms on 158 files with 116 rules using 12 threads.

> brv-control@0.1.0 build
> tsc -p tsconfig.json && vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 2136 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.84 kB │ gzip:   0.40 kB
dist/assets/index-Ca8DRBDT.css     71.80 kB │ gzip:  12.78 kB
dist/assets/esm-cq0K-PuC.js         0.10 kB │ gzip:   0.10 kB
dist/assets/index-CrjV3uRx.js   1,130.06 kB │ gzip: 282.62 kB

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 928ms
```

---

## 8. Como testar

1. Inicie o servidor local com `npm run dev` e entre no sistema com um usuário de perfil **`admin`** ou **`escritorio`**.
2. No menu lateral esquerdo, abra o grupo **Serviços** e clique em **PMOC** (`/pmoc`):
   - Confira a faixa discreta `"Dados de demonstração"` no topo e os 3 cartões de resumo (**Vigentes**, **Vencendo em até 60 dias** e **Visitas atrasadas**).
   - Teste a busca por cliente (`"Baía Sul"`, `"Maré Mansa"`) e o filtro por situação (note o selo verde `Vigente` no primeiro plano e o selo âmbar `Vence em N dias` no segundo).
3. Clique no plano **`Centro Médico Baía Sul Ltda (Fictício)`** para abrir o editor (`/pmoc/00000000-0000-4000-8000-000000000401`):
   - **Aba Geral**: altere o conselho entre `CFT` e `CREA` e veja os rótulos trocarem entre `TRT` e `ART`; teste trocar um cliente real do banco via `SeletorCliente` ou alterar a data de início para ver a sugestão de fim (`+12 meses - 1 dia`).
   - **Aba Ambientes**: adicione um ambiente (ex.: `"Sala de Esterilização"`), observe a sigla `SE` sugerida automaticamente e os totais de ocupantes e `m²` no rodapé; teste repetir uma sigla para ver o alerta imediato.
   - **Aba Equipamentos**: adicione um aparelho avulso ou via `"Adicionar equipamento do cliente"`, troque o ambiente no `<select>` e veja o identificador `AR-<SIGLA>-<0001>` atualizar em sequência; clique na miniatura de foto para ampliar ou envie outra imagem.
   - **Aba Cronograma**: expanda o bloco `A`, desative uma tarefa (ela fica riscada), altere uma periodicidade e veja os contadores na grade lateral de 12 meses mudarem na hora; teste `"Copiar cronograma para os outros do tipo"`.
   - **Aba Execução**: observe as células verdes (`Concluída`), vermelhas (`Atrasada`), azuis (`Prevista`) e cinzas (`N/A`). Clique numa célula de **Set/26** ou **Out/26** para abrir o painel com a OS ligada, técnico, medições (`A` e `°C`), fotos e checklist; clique em **"Ver relatório"** para abrir o **Relatório Mensal de Execução** (Entrega 4) — em **Out/26**, confira também a seção `"Não atendidos"` com o motivo do equipamento `C`. Teste ainda o botão **"Gerar OS do mês"** para **Nov/26**.
   - **Aba Documento** (ou botão **"Documento (imprimir/PDF)"** no cabeçalho): confira a Capa com logo da BRV, Seções 1 a 6 na ordem exata de `PMOC BRV Control.docx`, Anexo do TRT e clique em **"Imprimir / Salvar PDF"** para acionar `window.print()` em A4 retrato.
4. Volte para `/pmoc` e clique em **"Modelo de tarefas"** (`/pmoc/modelo`):
   - Confira o aviso fixo `"Alterar o modelo não muda planos já criados."`.
   - Navegue entre `Split Hi-Wall` (22 tarefas com medições configuradas nas tarefas 2 e 3), `Cassete`, `Split Piso-Teto` e `VRF`, reordene tarefas, marque/desmarque grandezas de medição e clique em **"Salvar modelo"**.

