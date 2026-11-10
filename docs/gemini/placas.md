# Resumo para auditoria — Módulo Reparo de Placas e Apoio Técnico

Documento de entrega e auditoria referente a `docs/placas.md` e `docs/gemini/placas-briefing.md`.

---

## 1. Arquivos criados e alterados

### Arquivos criados (30 arquivos de código + este resumo)

#### Tipos, cores, regras, textos jurídicos e camada de dados (6)
- `src/types/placas.ts` — Todas as interfaces e tipos TypeScript do módulo (`BoardStage`, `BoardQuoteStatus`, `BoardCustomerKind`, `BoardClient`, `BoardControlOsLookup`, `BoardOrder`, `BoardListFilter`, `BoardListResult`, `BoardPhoto`, `BoardEvent`, `BoardPublicTracking`, `PlacaFichaTecnica` com as 34 colunas de `schema_fichas.sql`, `ExtracaoFichaManualResultado`, `ResultadoConsultaErro`, `ResultadoAssistenteTecnico`, `PlacaManual`, `SituacaoImpressoraPlaca`, `PedidoEtiquetaPlacaResult`, etc.), com nomes de propriedades em inglês no padrão do banco e comentários em português.
- `src/components/placas/cores.ts` — Cores centralizadas das etapas (`CORES_ETAPA_PLACA`), selos de orçamento (`CORES_ORCAMENTO_PLACA`), tipo de cliente (`CORES_TIPO_CLIENTE_PLACA`), canais de resposta, categorias de fotos e tradução amigável de colunas (`ROTULO_CAMPO_PLACA`).
- `src/components/placas/textosJuridicosPlacas.ts` — Cláusulas jurídicas, escopo técnico, política de sinal de 50% e chave PIX copiados literalmente de `ModalOrcamentoPlaca.jsx`, `ModalComprovanteEntrada.jsx` e `ModalTermoGarantia.jsx` do sistema antigo.
- `src/components/placas/regrasPlacas.ts` — Regras puras do front-end: `ETAPAS_PLACA`, `ETAPAS_KANBAN_PLACA`, `ETAPAS_FINAIS_PLACA`, `gerarNumeroPlaca` e `proximaSequenciaDiaPlaca` (`OS-DDMMAA-NNN`, único local que monta esse formato), `diasNaEtapa`, `placaEncalhada` (`>= 4` dias exceto `pronto`), `calcularValidadeGarantia` e `garantiaVigente` (90 dias), `motivoBloqueioPlaca` e `podeMoverPlaca`, `MOSTRAR_VALOR_ORCAMENTO = false`, `semAcento`, links/mensagens de WhatsApp, conversor de fotos para `VisualizadorFotos`, `criarFichaVazia` e `calcularFinanceiroPlacas`.
- `src/components/placas/dadosDemo.ts` — Massa sintética completa sem nenhum dado real: 3 parceiros instaladores + 1 cliente final (CPFs `11144477735`/`22255588846` e CNPJs alfanuméricos sintéticos `00DEM001000133`/`00DEM002000188` válidos), 2 OS do Control (`17340` com placa já vinculada e `17352` sem placa), 14 placas distribuídas pelas 8 etapas (2 garantias sendo 1 vinculada à placa original `placa-demo-09`, 1 `sem_conserto`, 1 reembolsada, 3 encalhadas, entregas em vários meses do ano), fotos SVG embutidas, linha do tempo de auditoria, 8 fichas técnicas de splits, 5 manuais (PDF e TXT, sendo 1 sem texto extraído), 3 respostas estruturadas de código de erro e 2 respostas do assistente técnico.
- `src/components/placas/fonteDeDados.ts` — Camada única assíncrona (`FONTE_DADOS_DEMO = true`) operando em memória clonada de `dadosDemo.ts` com todas as 31 funções da seção 9 do briefing.

#### Componentes visuais e documentos impressos em `src/components/placas/` (16)
- `src/components/placas/ModalDialogoPlacas.tsx` — Modal acessível sobre `<dialog>` nativo com `.showModal()`, retorno de foco, `Esc`, contenção de rolagem (`overscroll-behavior: contain`) e fechamento seguro ao clicar fora.
- `src/components/placas/FaixaDadosDemoPlacas.tsx` — Faixa discreta `"Dados de demonstração"` exibida enquanto `FONTE_DADOS_DEMO = true` e oculta na impressão (`print:hidden`).
- `src/components/placas/NavegacaoPlacas.tsx` — Submenu horizontal para computador (`<nav aria-label="Submenu de Placas">`) acompanhado de `FaixaDadosDemoPlacas`, ocultando `"Financeiro"` quando `podeVerFinanceiroPlacas(profile)` é `false`.
- `src/components/placas/CartaoPlaca.tsx` — Cartão compacto do Kanban com número `OS-DDMMAA-NNN`, tipo de cliente, marca/modelo, código da placa, dias na etapa, selos (`Garantia`, `Encalhada`, `Orçamento`, `Reembolsada`), ocultação estrita de valores/orçamento para `oficina` e de reembolso para quem não tem acesso financeiro, setas `←` `→` e gatilho de mover etapa no celular.
- `src/components/placas/KanbanPlacas.tsx` — Quadro Kanban com arraste via `@hello-pangea/dnd` em telas `>= md` e visualização de uma coluna por vez com seletor de chips no celular (`< md`).
- `src/components/placas/ListaFinalizadasPlacas.tsx` — Lista paginada (50 por página) da aba `Finalizadas` com filtro de desfecho (`Todas`, `Entregue / Faturado`, `Sem Conserto / Devolvido`), seletor de ano, cartões no celular e tabela semântica no computador.
- `src/components/placas/NovaPlacaModal.tsx` — Entrada de nova placa com escolha entre **Balcão / portador** (busca em `board_clients` + subformulário rápido `"Novo cliente"`) e **Retirada pela equipe de campo** (busca de OS do Control com alerta amarelo de duplicidade se já houver placa vinculada), periféricos, `"Sem defeito aparente"`, `"Retorno em garantia"` (listando placas entregues do mesmo cliente) e pré-visualização local de múltiplas fotos de entrada.
- `src/components/placas/PlacaDetalhes.tsx` — Gaveta lateral completa sincronizada com `?placa=<id>` contendo as 10 seções ordenadas (Topo, Equipamento e placa, Bancada com consulta integrada ao Assistente Técnico, Orçamento, Garantia, Financeiro/Reembolso, Acompanhamento do cliente, Fotos, Histórico e Rodapé de ações), respeitando os 3 níveis de visibilidade e modo somente leitura nas finalizadas.
- `src/components/placas/OrcamentoPlacaDocumento.tsx` — Proposta comercial A4 em `createPortal(..., document.body)` com cabeçalho institucional `EMPRESA_BRV`, tabela do serviço, sinal de 50% + chave PIX, cláusulas literais, impressão A4 (`window.print()`) e envio de PDF pelo WhatsApp (`gerarPdfOrcamento` + `navigator.share` ou download + `wa.me` + `registrarEnvioOrcamento`).
- `src/components/placas/ComprovanteEntradaDocumento.tsx` — Comprovante de entrada A4 em portal fora de `#root` com espaço reservado tracejado `"QR"` (`TODO(Claude)`), link público `/placa/<token>`, cláusulas literais, botão de impressão, envio pelo WhatsApp e atalho rápido para abrir a etiqueta térmica.
- `src/components/placas/TermoGarantiaDocumento.tsx` — Termo de garantia de 90 dias A4 em portal fora de `#root` com selo `"GARANTIA: 90 DIAS"`, data de saída, validade calculada (+90 dias), componentes substituídos, valor oculto para `oficina`, cláusulas literais, impressão e WhatsApp.
- `src/components/placas/EtiquetaPlacaModal.tsx` — Pré-visualização de etiqueta térmica `100×50 mm` e `80×50 mm` (`"BRV NITERÓI - PLACAS"`), cópias de 1 a 5, `IndicadorElgin`, botão `"Imprimir na Elgin"` (stub `pedirEtiquetaPlaca`) e `"Imprimir pelo navegador"` em janela dedicada.
- `src/components/placas/FotosPlaca.tsx` — Galeria por categoria (`Antes (entrada)`, `Depois (reparo/teste)`, `Outros`), upload múltiplo com legenda e ampliação reaproveitando `VisualizadorFotos` (`src/components/ordens/VisualizadorFotos.tsx`).
- `src/components/placas/HistoricoPlaca.tsx` — Linha do tempo vertical auditável (filtrando eventos de orçamento para `oficina` e eventos financeiros para quem não tem `board_finance_access`) + campo `"Anotar no histórico"`.
- `src/components/placas/ClientesPlacas.tsx` — Lista, busca sem acento, filtro por tipo, modal de criação/edição, gaveta/modal de histórico de placas do cliente com link para `/placas?placa=<id>` e bloqueio de exclusão quando `board_count > 0`.
- `src/components/placas/FinanceiroPlacas.tsx` — Painel financeiro exclusivo para `podeVerFinanceiroPlacas(profile)` com tela de `"Acesso restrito"`, 5 cartões de KPI, seletor de ano, resumo de reembolsos, gráfico mensal de colunas em HTML/CSS + tabela mensal acessível, modal de placas/reembolsos do mês clicado e rankings Top 5 Marcas e Top 5 Defeitos.
- `src/components/placas/PainelAssistenteTecnico.tsx` — Componente reutilizável do Assistente Técnico (usado tanto na rota `/placas/assistente` quanto dentro de `PlacaDetalhes` com o botão `"Usar na placa"`).
- `src/components/placas/FichaTecnicaImprimirPortal.tsx` — Folha A4 de impressão de ficha técnica de split renderizada em `createPortal(..., document.body)`.
- `src/components/placas/FormularioCamposFicha.tsx` — Formulário estruturado com todos os campos de `fichas_tecnicas_split` divididos nos 4 blocos (`Identificação`, `Linha frigorífica`, `Elétrica`, `Notas`) e destaque visual do selo `"conferir"`.
- `src/components/placas/CadastrarFichaIAModal.tsx` — Fluxo em 3 passos (`upload` PDF/TXT com arraste -> `"A IA está lendo o manual..."` -> revisão humana obrigatória destacando `campos_conferir` e `lacunas` antes de `salvarFicha`).

#### Páginas em `src/pages/` (8)
- `src/pages/PlacasKanban.tsx` — Rota `/placas` (Kanban ativo + aba Finalizadas + abertura por `?placa=<id>`).
- `src/pages/PlacasClientes.tsx` — Rota `/placas/clientes`.
- `src/pages/PlacasFinanceiro.tsx` — Rota `/placas/financeiro`.
- `src/pages/PlacasFichas.tsx` — Rota `/placas/fichas`.
- `src/pages/PlacasErros.tsx` — Rota `/placas/erros`.
- `src/pages/PlacasAssistente.tsx` — Rota `/placas/assistente`.
- `src/pages/PlacasManuais.tsx` — Rota `/placas/manuais`.
- `src/pages/AcompanhamentoPlaca.tsx` — Rota pública `/placa/:token` (sem login, fora do `Layout`).

### Arquivos alterados (2)
- `src/App.tsx` — Registrada a rota pública `<Route path="/placa/:token" element={<AcompanhamentoPlaca />} />` ao lado de `/avaliar/:token` e as 7 rotas internas dentro de `<Route element={<Layout />}>`: `placas`, `placas/clientes`, `placas/financeiro`, `placas/fichas`, `placas/erros`, `placas/assistente` e `placas/manuais`.
- `src/components/Sidebar.tsx` — Adicionado exclusivamente o grupo recolhível `"Placas"` (logo abaixo de `"Oficina"`), a propriedade opcional `financeiroPlacas?: boolean` filtrada por `podeVerFinanceiroPlacas(profile)` e `end={rota === '/placas'}` nos links filhos do grupo.

*(Confirmação de escopo: nenhum arquivo foi tocado em `supabase/`, `src/services/`, `src/contexts/`, `src/components/ProtectedRoute.tsx`, `src/hooks/useOficina.ts`, `src/utils/oficina.ts`, `src/utils/etiquetaOficina.ts`, `src/types/oficina.ts`, `src/pages/Oficina.tsx`, `src/ajuda/`, `src/components/campo/`, `src/pages/campo/`, `public/sw.js`, `android/`, `scripts/` ou `.env`. Nenhuma biblioteca npm foi adicionada.)*

---

## 2. Telas e rotas (quem abre)

| Rota | Página | Dentro do `Layout`? | Quem vê no menu e abre | Observações de permissão |
|---|---|---|---|---|
| `/placas` | `PlacasKanban.tsx` | Sim | `admin`, `escritorio`, `oficina` | `oficina` não vê valores, seção de orçamento, reembolso nem botões de finalizar/arquivar/cancelar/reabrir. Reabrir placa finalizada é exclusivo de `admin`. |
| `/placas/clientes` | `PlacasClientes.tsx` | Sim | `admin`, `escritorio`, `oficina` | `admin` e `escritorio` criam, editam e excluem; `oficina` opera em modo somente consulta (e sem valores no histórico de placas do cliente). |
| `/placas/financeiro` | `PlacasFinanceiro.tsx` | Sim | Somente quem passa em `podeVerFinanceiroPlacas(profile)` (`board_finance_access === true`, hoje o Braulio) | Para qualquer outro usuário (inclusive `admin` ou `escritorio` sem a marca `board_finance_access`), o item some do menu e a rota exibe o cartão `"Acesso restrito"`. |
| `/placas/fichas` | `PlacasFichas.tsx` | Sim | `admin`, `escritorio`, `oficina` | Todos consultam e imprimem A4. Botão `"Cadastrar ficha com IA"` visível para `admin` e `escritorio`. Edição e exclusão de fichas restritas a `admin`. |
| `/placas/erros` | `PlacasErros.tsx` | Sim | `admin`, `escritorio`, `oficina` | Todos pesquisam códigos/sintomas e veem o histórico local da sessão. |
| `/placas/assistente` | `PlacasAssistente.tsx` | Sim | `admin`, `escritorio`, `oficina` | Todos geram hipóteses e roteiros de medição em bancada. |
| `/placas/manuais` | `PlacasManuais.tsx` | Sim | `admin`, `escritorio`, `oficina` | Todos listam e abrem o arquivo em nova aba. `"Enviar manual"` visível para `admin` e `escritorio`; `"Excluir"` restrito a `admin`. |
| `/placa/:token` | `AcompanhamentoPlaca.tsx` | **Não** (pública, fora de `ProtectedRoute`) | Qualquer pessoa com o link (sem login) | Exibe apenas dados públicos seguros (`BoardPublicTracking`); nunca expõe diagnóstico interno, valores internos nem reembolsos. |

---

## 3. Contrato de dados que o Claude precisa implementar

### 3.1. Funções exportadas por `src/components/placas/fonteDeDados.ts`

Quando `src/services/placas.ts`, migrations e Edge Functions estiverem prontos, basta trocar o corpo destas funções e mudar `FONTE_DADOS_DEMO` para `false`:

| Função | Assinatura resumida | Retorno | Comportamento esperado no banco / servidor |
|---|---|---|---|
| `listarPlacas` | `(filtro: BoardListFilter)` | `Promise<BoardListResult>` | Filtra placas ativas (`aba === 'andamento'`, `archived = false`, `cancelled_entry = false`, `status NOT IN ('entregue','sem_conserto')`) ou finalizadas/arquivadas (`aba === 'finalizadas'`, paginadas em 50), resolvendo cliente (`board_clients` ou `customers`), `days_in_stage`, `stalled` e contadores dos chips. |
| `buscarPlaca` | `(id: string)` | `Promise<BoardOrder \| null>` | Retorna a placa completa com nomes resolvidos de cliente, técnicos (`pickup_technician_name`, `bench_technician_name`), número da OS do Control (`os_number`) e placa de origem da garantia (`warranty_origin_number`). |
| `criarPlaca` | `(dados: CreateBoardInput, atorNome?)` | `Promise<BoardOrder>` | Gera `board_number` (`OS-DDMMAA-NNN` com sequência atômica do dia no servidor) e `public_token` único, grava vínculo exclusivo (`board_client_id` **ou** `service_order_id + customer_id`), sobe `entry_photos` (categoria `'antes'`) para a HostGator e registra evento `'entrada'`. |
| `atualizarPlaca` | `(id: string, campos: UpdateBoardFields, opcoes?)` | `Promise<BoardOrder>` | Atualiza apenas os campos enviados, gravando eventos `'edicao_campo'` em `board_events`. RLS/trigger impede `oficina` de alterar `charged_amount`, orçamento ou reembolso e bloqueia edição em placa finalizada. |
| `moverPlaca` | `(id: string, etapa: BoardStage, extra?: MoveBoardExtra, opcoes?)` | `Promise<BoardOrder>` | Valida transição (`podeMoverPlaca`), atualiza `status`, `stage_changed_at`, `finished_at` (em `entregue`/`sem_conserto`), `unrepaired_reason` e `charged_amount` opcional, registrando evento `'mudanca_etapa'`. |
| `registrarOrcamento` | `(id: string, dados: BoardQuoteInput, atorNome?)` | `Promise<BoardOrder>` | Salva `quote_amount`, `quote_validity_days`, `customer_document`, `customer_person_type`, `customer_address` e `quote_technical_opinion`; grava evento `'orcamento'` (`visibility = 'escritorio'`). Bloqueia se `is_warranty = true`. |
| `registrarEnvioOrcamento` | `(id: string, atorNome?)` | `Promise<BoardOrder>` | Define `quote_sent_at = now()`, muda `quote_status` para `'enviado'` (se não estava `'aprovado'`) e grava evento `'envio_orcamento'` (`visibility = 'escritorio'`). |
| `registrarRespostaOrcamento` | `(id: string, dados: BoardQuoteResponseInput, atorNome?)` | `Promise<BoardOrder>` | Atualiza `quote_status` (`'aprovado'` \| `'recusado'`), `quote_responded_at`, `quote_response_channel`, `quote_response_notes`, `quote_responded_by` e grava evento `'resposta_orcamento'` (`visibility = 'escritorio'`). |
| `registrarReembolso` | `(id: string, dados: BoardRefundInput, atorNome?)` | `Promise<BoardOrder>` | Exclusivo `tem_financeiro_placas()`: grava `refunded`, `refund_amount`, `refunded_at`, `refund_reason` e evento `'reembolso'` (`visibility = 'financeiro'`). |
| `arquivarPlaca` | `(id: string, atorNome?)` | `Promise<BoardOrder>` | Marca `archived = true`, `archived_at = now()` e grava evento `'arquivamento'`. |
| `cancelarPlaca` | `(id: string, motivo: string, atorNome?)` | `Promise<BoardOrder>` | Exige motivo, marca `cancelled_entry = true`, `cancel_reason` e grava evento `'cancelamento'`. |
| `reabrirPlaca` | `(id: string, opcoes?)` | `Promise<BoardOrder>` | Exclusivo `admin`: limpa `finished_at` e `archived`, retorna `status` para `'pronto'` (se estava `'entregue'`) ou `'diagnostico'` (se estava `'sem_conserto'`) e grava evento `'reabertura'`. |
| `gerarNovoLinkAcompanhamento` | `(id: string, atorNome?)` | `Promise<BoardOrder>` | Substitui `public_token` por novo token aleatório (invalidando o anterior) e grava evento `'novo_link'`. |
| `anotarNoHistorico` | `(id: string, nota: string, atorNome?)` | `Promise<BoardEvent>` | Insere nota livre (`event_type = 'nota'`, `visibility = 'todos'`) em `board_events`. |
| `historicoDaPlaca` | `(id: string)` | `Promise<BoardEvent[]>` | Lista `board_events` da placa em ordem `created_at DESC` (no banco, RLS já deve filtrar linhas `'escritorio'` para `oficina` e `'financeiro'` para quem não tem `tem_financeiro_placas()`). |
| `fotosDaPlaca` | `(id: string)` | `Promise<BoardPhoto[]>` | Lista fotos de `board_photos` da placa (`created_at DESC`). |
| `anexarFotoPlaca` | `(arquivo: File, id: string, categoria: BoardPhotoCategory, legenda?, atorNome?)` | `Promise<BoardPhoto>` | Envia imagem para a HostGator (`upload.php`), grava linha em `board_photos` com `stage_at_capture` igual à etapa atual da placa. |
| `excluirFotoPlaca` | `(fotoId: string)` | `Promise<void>` | Remove registro em `board_photos` (e arquivo correspondente na HostGator). |
| `listarClientesPlacas` | `(filtro?: { busca?: string; tipo?: 'todos' \| BoardCustomerKind })` | `Promise<BoardClient[]>` | Consulta `board_clients` com busca sem acento (`unaccent` ou normalização) e agrega `board_count` e `last_board_at`. |
| `salvarClientePlaca` | `(dados: BoardClientInput)` | `Promise<BoardClient>` | `INSERT` ou `UPDATE` em `board_clients` (`admin` e `escritorio`). |
| `excluirClientePlaca` | `(id: string)` | `Promise<void>` | Exclui de `board_clients` somente se não houver nenhuma linha em `board_orders` referenciando `board_client_id` (`ON DELETE RESTRICT`). |
| `placasDoCliente` | `(clienteId: string)` | `Promise<BoardOrder[]>` | Lista placas vinculadas a `board_client_id = clienteId` (`created_at DESC`). |
| `buscarOsControl` | `(numero: number \| string)` | `Promise<BoardControlOsLookup \| null>` | Consulta `service_orders` por `number` trazendo cliente (`customers`), endereço formatado, técnico da tarefa e lista `existing_board_numbers` já ligadas a `service_order_id`. |
| `listarTecnicos` | `()` | `Promise<BoardTechnicianOption[]>` | Lista colaboradores/perfis ativos para os seletores de retirada e bancada. |
| `listarPlacasParaFinanceiro` | `(ano: number)` | `Promise<BoardOrder[]>` | Exclusivo `tem_financeiro_placas()`: retorna placas ativas na bancada + placas entregues ou reembolsadas no `ano` solicitado. |
| `listarFichas` / `buscarFicha` | `(filtro?: FiltroFichasPlacas)` / `(id: string)` | `Promise<PlacaFichaTecnica[]>` / `Promise<PlacaFichaTecnica \| null>` | Consulta `fichas_tecnicas_split` com busca sem acento, filtro de fabricante e filtro de capacidade em BTUs. |
| `salvarFicha` / `excluirFicha` | `(dados: PlacaFichaInput, papel?)` / `(id: string, papel?)` | `Promise<PlacaFichaTecnica>` / `Promise<void>` | `INSERT` permitido para `admin` e `escritorio` (fluxo de cadastro com IA revisado); `UPDATE` e `DELETE` restritos a `admin`. |
| `extrairFichaDoManual` | `(arquivo: File)` | `Promise<ExtracaoFichaManualResultado>` | **Edge Function (`extrair-ficha` + Gemini)**: lê PDF/TXT e devolve `{ ficha, campos_conferir }`. |
| `consultarCodigoErro` | `(dados: ConsultaCodigoErroInput)` | `Promise<ResultadoConsultaErro>` | **Edge Function (`consultar-erro` + Gemini)**: busca primeiro no texto extraído de `board_manuals` da marca e complementa com IA, identificando `fonte_tipo` (`'manual_fabricante'` \| `'pesquisa_ia'`). |
| `assistenteTecnico` | `(dados: AssistenteTecnicoInput)` | `Promise<ResultadoAssistenteTecnico>` | **Edge Function (`assistente-tecnico` + Gemini)**: devolve `resumo_diagnostico`, `hipoteses`, `testes_bancada`, `componentes_medir` e `observacoes`. |
| `listarManuais` / `enviarManual` / `excluirManual` | `(filtro?)` / `(arquivo, dados)` / `(id)` | `Promise<PlacaManual[]>` / `Promise<PlacaManual>` / `Promise<void>` | Sobe PDF/TXT na HostGator, extrai texto indexável no servidor e grava em `board_manuals` (`INSERT` para `admin`/`escritorio`; `DELETE` só `admin`). |
| `buscarAcompanhamentoPublico` | `(token: string)` | `Promise<BoardPublicTracking \| null>` | **RPC `SECURITY DEFINER` pública** (`anon`): recebe `public_token` e projeta **exclusivamente** os campos de `BoardPublicTracking` (sem cliente sensível, sem diagnóstico interno, sem valores internos e sem reembolsos). |
| `gerarPdfOrcamento` / `gerarPdfTermo` | `(id: string)` | `Promise<Blob>` | **TODO(Claude)**: geração oficial do arquivo PDF A4 para anexo/compartilhamento. |
| `pedirEtiquetaPlaca` / `situacaoImpressora` | `(id: string, copias: number)` / `()` | `Promise<PedidoEtiquetaPlacaResult>` / `Promise<SituacaoImpressoraPlaca>` | **TODO(Claude)**: enfileirar etiqueta ZPL de placa em `print_jobs` e ler sinal de vida de `print_agents`. |

### 3.2. Tabelas e colunas supostas no banco

1. **`public.board_clients`** (cadastro paralelo de clientes de placas):
   - `id uuid PK`, `name text NOT NULL`, `phone text NOT NULL`, `kind text CHECK (kind IN ('instalador','final'))`, `city text`, `person_type text DEFAULT 'PF'`, `document text`, `address text`, `notes text`, `created_at timestamptz`, `updated_at timestamptz`.
2. **`public.board_orders`** (reparos de placas):
   - Identificação e etapa: `id uuid PK`, `board_number text UNIQUE NOT NULL` (`OS-DDMMAA-NNN`), `public_token text UNIQUE NOT NULL`, `status text NOT NULL`, `stage_changed_at timestamptz NOT NULL`, `finished_at timestamptz`, `archived boolean DEFAULT false`, `archived_at timestamptz`, `cancelled_entry boolean DEFAULT false`, `cancel_reason text`, `unrepaired_reason text`.
   - Vínculo exclusivo de origem (`CHECK` garantindo `board_client_id IS NOT NULL` XOR `customer_id IS NOT NULL`): `board_client_id uuid REFERENCES board_clients(id) ON DELETE RESTRICT`, `customer_id uuid REFERENCES customers(id)`, `service_order_id uuid REFERENCES service_orders(id)`, `customer_kind text NOT NULL`, `customer_city text`, `customer_document text`, `customer_person_type text`, `customer_address text`.
   - Equipamento e bancada: `equipment_type text NOT NULL DEFAULT 'Split Inverter'`, `brand_model text NOT NULL`, `board_code text NOT NULL`, `peripherals text`, `reported_defect text NOT NULL`, `no_apparent_defect boolean DEFAULT false`, `pickup_technician_id uuid`, `bench_technician_id uuid`, `error_code text`, `technical_diagnosis text`, `replaced_components text`.
   - Orçamento: `quote_status text DEFAULT 'nao_feito'`, `quote_amount numeric(10,2)`, `quote_validity_days integer DEFAULT 10`, `quote_technical_opinion text`, `quote_sent_at timestamptz`, `quote_responded_at timestamptz`, `quote_response_channel text`, `quote_response_notes text`, `quote_responded_by uuid REFERENCES profiles(id)`.
   - Garantia: `is_warranty boolean DEFAULT false`, `warranty_origin_id uuid REFERENCES board_orders(id)`.
   - Financeiro (`tem_financeiro_placas()`): `charged_amount numeric(10,2)`, `refunded boolean DEFAULT false`, `refund_amount numeric(10,2)`, `refunded_at date`, `refund_reason text`.
   - Auditoria: `created_by uuid`, `created_at timestamptz`, `updated_at timestamptz`.
   - *Nota importante para RLS de `oficina`:* como `SELECT` em PostgreSQL não filtra colunas sozinho sem view/RPC, recomenda-se que `services/placas.ts` ou uma view/função no banco omita `quote_amount`, `charged_amount` e campos `refund_*` para `role = 'oficina'`, e omita `charged_amount`/`refund_*` quando `NOT tem_financeiro_placas()`.
3. **`public.board_photos`**:
   - `id uuid PK`, `board_order_id uuid REFERENCES board_orders(id) ON DELETE CASCADE`, `category text CHECK (category IN ('antes','depois','outros'))`, `storage_path text`, `public_url text NOT NULL`, `file_name text`, `caption text`, `stage_at_capture text`, `uploaded_by uuid`, `uploaded_by_name text`, `created_at timestamptz`.
4. **`public.board_events`**:
   - `id uuid PK`, `board_order_id uuid REFERENCES board_orders(id) ON DELETE CASCADE`, `event_type text NOT NULL`, `from_stage text`, `to_stage text`, `field_name text`, `old_value text`, `new_value text`, `note text`, `visibility text CHECK (visibility IN ('todos','escritorio','financeiro')) DEFAULT 'todos'`, `actor_id uuid`, `actor_name text`, `created_at timestamptz`.
5. **`public.fichas_tecnicas_split`**:
   - Espelha exatamente as 34 colunas de `D:\BRV_Equipamentos\backend\schema_fichas.sql` + `arquivo_original_url text` opcional para abrir o manual PDF/TXT de origem.
6. **`public.board_manuals`**:
   - `id uuid PK`, `manufacturer text NOT NULL`, `title text NOT NULL`, `file_name text NOT NULL`, `file_type text CHECK (file_type IN ('PDF','TXT'))`, `file_size_bytes bigint`, `storage_path text`, `file_url text NOT NULL`, `extracted_text text`, `has_extracted_text boolean GENERATED/computed`, `uploaded_by uuid`, `uploaded_by_name text`, `created_at timestamptz`.

---

## 4. Regras de negócio implementadas no front-end

1. **Numeração própria `OS-DDMMAA-NNN` centralizada**:
   - Implementada **exclusivamente** em `gerarNumeroPlaca(data, sequenciaDoDia)` e `proximaSequenciaDiaPlaca(numerosExistentes, data)` em `src/components/placas/regrasPlacas.ts`. Nenhum componente concatena `"OS-"` manualmente.
2. **Separação estrita entre clientes de placas e clientes do Control**:
   - Placa de **Balcão / portador** preenche apenas `board_client_id` (cadastro paralelo `board_clients`) e mantém `customer_id = null` e `service_order_id = null`.
   - Placa de **Retirada pela equipe de campo** consulta `buscarOsControl(numero)`, preenche `service_order_id` + `customer_id` + `os_number` e mantém `board_client_id = null`, exibindo alerta amarelo se `existing_board_numbers.length > 0`.
3. **Placa encalhada (`4 dias ou mais`)**:
   - `diasNaEtapa(placa)` calcula `Math.floor((fim - inicio) / 86_400_000)` sobre `stage_changed_at` (congelando em `finished_at` quando finalizada).
   - `placaEncalhada(placa)` retorna `true` quando `!placa.archived && !placa.cancelled_entry && !ehEtapaFinalPlaca(placa.status) && placa.status !== 'pronto' && diasNaEtapa(placa) >= 4`.
4. **Garantia legal de 90 dias**:
   - `calcularValidadeGarantia(finished_at)` soma exatamente `90 * 86_400_000 ms` (90 dias corridos) à data de saída (`finished_at`).
   - `garantiaVigente(finished_at)` verifica se a data limite calculada é `>= agora`.
   - Placas marcadas como `is_warranty = true` ficam isentas de orçamento (a seção de Orçamento informa a isenção e libera avanço direto para reparo/teste/pronto).
5. **Bloqueios de movimentação entre etapas (`motivoBloqueioPlaca` / `podeMoverPlaca`)**:
   - Placa cancelada ou arquivada não muda de etapa.
   - Placa em etapa final (`entregue` ou `sem_conserto`) fica em modo somente leitura; só volta ao Kanban pelo botão `"Reabrir"` (`admin` apenas).
   - `oficina` move apenas entre as 6 etapas do Kanban (`entrada` até `pronto`); etapas finais (`entregue` e `sem_conserto`) exigem `admin` ou `escritorio`.
   - Mover para `aguardando_peca`, `em_reparo`, `teste`, `pronto` ou `entregue` exige `quote_status === 'aprovado'`, exceto quando `is_warranty === true`. Se `quote_status === 'recusado'`, orienta finalizar como `Sem Conserto / Devolvido`.
   - Mover para `entregue` exige que a placa esteja previamente em `pronto` e pede data de saída (padrão hoje). Mover para `sem_conserto` exige motivo obrigatório.
6. **Ocultação em 3 camadas por perfil (esconder do DOM, não apenas desabilitar)**:
   - `oficina` (Gustavo): não renderiza valores nos cartões nem nas listas, oculta toda a seção **Orçamento**, oculta a seção **Financeiro e reembolso**, oculta o rodapé de finalização/cancelamento/arquivamento, oculta eventos `'escritorio'` e `'financeiro'` do histórico e abre `/placas/clientes`, `/placas/fichas` e `/placas/manuais` em modo consulta.
   - `admin` / `escritorio` **sem** `podeVerFinanceiroPlacas(profile)`: vê valores de orçamento e opera orçamento, clientes, IA de fichas e upload de manuais, mas **não vê** o item `Financeiro` no menu/abas, vê `"Acesso restrito"` em `/placas/financeiro` e não vê `charged_amount`, seção/selo de `Reembolso` nem eventos `'financeiro'`.
   - `admin` / `escritorio` **com** `podeVerFinanceiroPlacas(profile)` (Braulio): vê tudo acima + dashboard `/placas/financeiro`, `charged_amount` e `Reembolso`.
7. **Privacidade da página pública (`/placa/:token`)**:
   - Controlada por `MOSTRAR_VALOR_ORCAMENTO = false` em `regrasPlacas.ts`: mostra a situação do orçamento (`Aguardando diagnóstico / orçamento`, `Orçamento enviado para aprovação`, `Orçamento aprovado`, `Orçamento não aprovado`) sem revelar valores em reais, diagnósticos internos ou reembolsos.
8. **Fórmulas exatas do Dashboard Financeiro (`calcularFinanceiroPlacas` em `regrasPlacas.ts`)**:
   - **Valor efetivo de receita da placa (`valorReceitaPlaca`)**: `Math.max(0, Number(placa.charged_amount ?? placa.quote_amount ?? 0))`.
   - **Critério de placa faturada líquida**: `status === 'entregue' && !cancelled_entry && !refunded && (!is_warranty || valorReceitaPlaca(p) > 0)`, alocada no ano/mês local de `finished_at` (fallback `stage_changed_at` / `created_at`). Placas `sem_conserto`, canceladas, garantias gratuitas e placas marcadas como `refunded` **não entram** na receita líquida nem na contagem de entregues faturadas.
   - **Faturamento do mês**: soma de `valorReceitaPlaca(p)` das placas faturadas líquidas no mês de referência (`dataReferencia.getMonth()` quando `anoSelecionado === anoAtual`, ou Dezembro para anos passados).
   - **Ticket médio do mês**: `qtdEntreguesMes > 0 ? faturamentoMes / qtdEntreguesMes : 0` (e anual: `qtdEntreguesAno > 0 ? totalAno / qtdEntreguesAno : 0`).
   - **Valor na bancada (em aberto)**: soma de `Math.max(0, Number(p.quote_amount ?? 0))` das placas com `!ehEtapaFinalPlaca(status) && !archived && !cancelled_entry`.
   - **Placas encalhadas**: contagem de placas ativas na bancada com `placaEncalhada(p) === true`.
   - **Total do ano**: soma do `faturamento` líquido dos 12 meses do `anoSelecionado`.
   - **Reembolsos do mês / ano (`valorEstornoPlaca`)**: para placas com `refunded === true`, soma `Math.max(0, Number(refund_amount ?? charged_amount ?? quote_amount ?? 0))` no ano/mês de `refunded_at` (fallback `finished_at` / `stage_changed_at`).
   - **Top 5 Marcas e Top 5 Defeitos**: agrupados sobre todas as placas não canceladas do `anoSelecionado` (pela primeira palavra em maiúsculas de `brand_model` e por `error_code + reported_defect`), ordenados por quantidade decrescente com percentual sobre o total do ano.

---

## 5. Premissas e decisões tomadas

1. **Hierarquia de camadas (`z-index` vs Top Layer) para não esconder `VisualizadorFotos` nem impressões A4**:
   - O componente existente `VisualizadorFotos.tsx` usa `createPortal(<div className="fixed inset-0 z-[70]">, document.body)` (fora da *top layer* nativa de `<dialog>`). Por isso, `PlacaDetalhes.tsx` foi construído como gaveta portal (`z-40` em `document.body`, `role="dialog" aria-modal="true"`), os documentos A4 (`OrcamentoPlacaDocumento`, `ComprovanteEntradaDocumento`, `TermoGarantiaDocumento`, `FichaTecnicaImprimirPortal`) ficam em `z-50` em `document.body`, `VisualizadorFotos` abre acima de tudo em `z-[70]`, e os modais folha de confirmação/formulário usam `ModalDialogoPlacas` (`<dialog>.showModal()`).
2. **Impressão A4 da Ficha Técnica**:
   - Como `src/index.css` oculta `body > #root` durante `@media print`, a impressão de fichas em `/placas/fichas` também foi isolada em `FichaTecnicaImprimirPortal.tsx` via `createPortal(..., document.body)`.
3. **Registro de reembolso em placas já entregues**:
   - Embora placas em `entregue` abram em modo somente leitura para equipamento/bancada/orçamento, a subseção de **Reembolso** permanece editável para quem possui `podeVerFinanceiroPlacas(profile)`, pois na prática o estorno financeiro ocorre justamente após uma placa entregue retornar sem reparo viável.
4. **Criação com IA vs edição de fichas técnicas**:
   - Seguindo simultaneamente as seções 3.11 ("Edição e exclusão só para admin") e 3.12 ("Botão 'Cadastrar ficha com IA' para admin e escritório"), `salvarFicha` aceita `INSERT` (sem `id`) para `admin` e `escritorio` (após a revisão obrigatória da leitura por IA) e restringe `UPDATE` (com `id`) e `excluirFicha` exclusivamente a `admin`.

---

## 6. Pendências, limitações e itens `TODO(Claude)`

### O que ficou marcado como `TODO(Claude)` (conforme escopo do briefing)
1. **Geração oficial de PDF (`gerarPdfOrcamento` e `gerarPdfTermo` em `fonteDeDados.ts`)**: hoje devolvem um `Blob` `application/pdf` mínimo válido de demonstração para exercitar `navigator.share({ files })` e download; na tela, a impressão A4 completa já funciona via `window.print()`.
2. **Código QR real no Comprovante de Entrada (`ComprovanteEntradaDocumento.tsx`)**: como não adicionamos bibliotecas npm, há um quadro pontilhado identificado como `"QR"` ao lado do link textual completo `/placa/<token>`.
3. **ZPL e fila real da Elgin L42 Pro (`pedirEtiquetaPlaca` e `situacaoImpressora` em `fonteDeDados.ts`)**: hoje operam como stubs de demonstração; o botão `"Imprimir pelo navegador"` já gera a etiqueta `100×50 mm` ou `80×50 mm` pronta para impressão imediata.
4. **Anexo direto no WhatsApp Web em computadores**: navegadores desktop normalmente não suportam `navigator.canShare({ files })` para o WhatsApp Web; nesses casos, o sistema baixa automaticamente o PDF no computador e abre `https://wa.me/...` com a mensagem preenchida para o escritório arrastar o arquivo baixado (no celular compatível, abre a folha nativa de compartilhamento com o PDF anexado).
5. **Edge Functions reais do Gemini (`extrairFichaDoManual`, `consultarCodigoErro`, `assistenteTecnico`) e extração de texto de PDFs na HostGator (`enviarManual`)**: hoje simulados com atraso realista (`1,5 s` a `2 s`) e respostas técnicas fixas em `dadosDemo.ts`.
6. **Banco de dados, migrations, RLS, importador do sistema antigo, textos da Ajuda F1 (`src/ajuda/`) e botão `"Recolher placa"` em `/campo`**: fora do escopo desta tarefa (responsabilidade do Claude).

### O que não foi testado ao vivo
- As telas foram validadas estaticamente com `tsc` (`npm run typecheck`), `oxlint` (`npm run lint`, zero avisos e zero erros) e empacotamento completo de produção (`npm run build`). **Não foi executada navegação interativa autenticada contra o Supabase real** nesta sessão (já que a abertura das rotas internas exige sessão autenticada em `ProtectedRoute`).

---

## 7. Saída exata de `typecheck`, `lint` e `build`

```text
> brv-control@0.1.0 typecheck
> tsc -p tsconfig.json


> brv-control@0.1.0 lint
> oxlint

Found 0 warnings and 0 errors.
Finished in 277ms on 235 files with 116 rules using 12 threads.

> brv-control@0.1.0 build
> tsc -p tsconfig.json && vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 2215 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.84 kB │ gzip:   0.40 kB
dist/assets/index-zNYgTWdC.css    110.58 kB │ gzip:  17.76 kB
dist/assets/index-BdJsdqeJ.js   1,905.92 kB │ gzip: 463.36 kB

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.18s
```

---

## 8. Como testar

1. **Página pública sem login (`/placa/:token`)**:
   - Com `npm run dev` ligado, abra em aba anônima (ou celular):
     - `/placa/demo-placa-002` — placa em andamento (`Diagnóstico / Orçamento`), mostrando etapa atual, linha do tempo com datas, situação do orçamento **sem valor em reais**, fotos ampliáveis e botão `"Falar com a BRV no WhatsApp"`.
     - `/placa/demo-placa-009` — placa entregue (`Entregue / Faturado`), exibindo o cartão verde de **Garantia legal de 90 dias** com data de validade calculada.
     - `/placa/link-inexistente` — exibe o estado `"Link inválido ou expirado"`.
2. **Login como Braulio (`admin` com `board_finance_access = true`)**:
   - No menu lateral, expanda **Placas** e confira todos os 7 itens (incluindo **Financeiro**).
   - Em `/placas`, teste os chips (`Todas`, `Parceiros`, `Cliente final`, `Garantias`, `Encalhadas`), arraste cartões entre colunas, tente mover uma placa sem orçamento aprovado para `Em Reparo` (deve exibir o aviso de bloqueio) e abra a aba **Finalizadas**.
   - Clique em **Nova placa**:
     - Teste **Balcão / portador** + botão **Novo cliente** e marque **Retorno em garantia** selecionando um parceiro que já tem placas entregues.
     - Troque para **Retirada pela equipe de campo**, digite `17340` e clique em **Buscar OS** (deve exibir o alerta amarelo informando que a placa `OS-061126-001` já está vinculada); depois teste `17352` (OS limpa).
     - Ao salvar, confira a abertura imediata do **Comprovante de Entrada** A4 e o botão **Etiqueta** no topo dele.
   - Clique em uma placa para abrir `PlacaDetalhes`: teste **Consultar assistente técnico** -> **Gerar diagnóstico** -> **Usar na placa**, salve e imprima o **Orçamento**, registre resposta (`Aprovado`/`Recusado`), edite **Valor efetivamente cobrado** e **Reembolso**, gere **Termo de garantia** (numa placa entregue, ex.: `OS-151026-001`) e clique no link da placa original numa garantia (`OS-081126-002` -> abre `OS-151026-001`).
   - Em `/placas/financeiro`, confira os 5 cartões, o resumo de reembolsos, clique nas barras dos meses para abrir as placas entregues/reembolsadas do mês e confira os rankings Top 5.
3. **Login como `escritorio` ou `admin` comum (sem `board_finance_access`)**:
   - Confira que o item **Financeiro** não aparece no menu lateral nem em `NavegacaoPlacas`, que acessar `/placas/financeiro` diretamente exibe `"Acesso restrito"`, que `charged_amount` e `Reembolso` somem de `PlacaDetalhes`, mas que a seção **Orçamento** e os valores de orçamento permanecem visíveis.
4. **Login como Gustavo (`oficina`)**:
   - No menu lateral, aparecem apenas **Oficina** e **Placas** (6 subitens, sem **Financeiro**).
   - Em `/placas`, confira que nenhum cartão mostra valor ou selo de orçamento/reembolso, que `PlacaDetalhes` oculta Orçamento, Financeiro e o rodapé de finalização, e que `/placas/clientes`, `/placas/fichas` e `/placas/manuais` abrem apenas para consulta.
5. **Apoio Técnico (`/placas/fichas`, `/placas/erros`, `/placas/assistente`, `/placas/manuais`)**:
   - Em `/placas/fichas`, busque sem acento, abra uma ficha (campos vazios exibem `"—"`), clique em **Imprimir ficha A4** e teste **Cadastrar ficha com IA** enviando qualquer `.pdf` ou `.txt` para ver a revisão com selos `"conferir"`.
   - Em `/placas/erros`, clique nos exemplos rápidos (`LG · CH05`, `Daikin · U4`, `Samsung · E464`) e confira os selos `"Sugestão da IA: confirme na bancada"` e `"Manual do fabricante"` vs `"Pesquisa da IA"`.

---

## 9. Nomes exatos de botões, abas, campos e selos para a Ajuda (F1)

### Menu lateral e barra superior (`NavegacaoPlacas`)
- Grupo no menu lateral: `Placas`
- Subitens / abas de navegação: `Reparos (Kanban)`, `Clientes de placas`, `Financeiro`, `Fichas técnicas`, `Códigos de erro`, `Assistente técnico`, `Manuais`

### `/placas` — Reparos (Kanban e Finalizadas)
- Abas principais: `Em andamento`, `Finalizadas`
- Botão principal: `Nova placa`
- Campo de busca: `Buscar nº OS-DDMMAA, cliente, marca ou placa...`
- Chips de filtro rápido (`Em andamento`): `Todas`, `Parceiros`, `Cliente final`, `Garantias`, `Encalhadas`
- Filtros (`Finalizadas`): `Todas`, `Entregue / Faturado`, `Sem Conserto / Devolvido`, seletor `Ano`
- Colunas do Kanban: `Entrada / Triagem`, `Diagnóstico / Orçamento`, `Aguardando Peça`, `Em Reparo`, `Teste em Simulador`, `Pronto para Entrega`
- Selos nos cartões e cabeçalhos: `Parceiro`, `Final`, `Garantia`, `Encalhada · Nd`, `Sem orçamento`, `Orçamento enviado`, `Orçamento aprovado`, `Orçamento recusado`, `Reembolsada`

### Modal `Nova entrada de placa`
- Opções de origem: `Balcão / portador`, `Retirada pela equipe de campo`
- Botões auxiliares: `Novo cliente`, `Salvar e selecionar cliente`, `Buscar OS`, `Selecionar fotos`
- Campos: `Cliente de placas *`, `Tipo nesta entrada`, `Cidade`, `Número da OS no BRV Control *`, `Tipo de equipamento`, `Marca / modelo *`, `Código da placa (part number) *`, `Código de erro (opcional)`, `Periféricos / acessórios entregues junto`, `Defeito reclamado`, `Quem recebeu / retirou a placa`, `Técnico de bancada responsável`, `Sem defeito aparente`, `Retorno em garantia`, `Placa original entregue`
- Botões de rodapé: `Cancelar`, `Registrar entrada e gerar comprovante`

### Gaveta `PlacaDetalhes` e Documentos
- Botões do cabeçalho: `Etiqueta`, `Comprovante`
- Seção Equipamento e placa: `Salvar equipamento`
- Seção Bancada e diagnóstico: `Consultar assistente técnico`, `Salvar bancada`, campos `Código de erro`, `Componentes trocados (sai no Termo de Garantia)`, `Diagnóstico técnico de bancada`
- Seção Orçamento: campos `Valor do orçamento (R$) *`, `Validade (dias corridos)`, `CPF / CNPJ no orçamento`, `Endereço do cliente (para o PDF)`, `Parecer técnico para a proposta *`; botões `Salvar orçamento`, `Ver/Imprimir orçamento`, `Enviar PDF pelo WhatsApp`, `Registrar resposta` (opções `Aprovado`, `Recusado`, `Canal da resposta`, `Salvar resposta`)
- Seção Garantia: `Termo de garantia`, `Abrir placa original OS-DDMMAA-NNN`, selos `Garantia vigente` / `Garantia expirada`
- Seção Financeiro e reembolso: `Valor efetivamente cobrado (R$)`, `Salvar valor cobrado`, `Reembolsada (desconta do faturamento líquido)`, `Valor reembolsado (R$) *`, `Data do reembolso *`, `Motivo do reembolso *`, `Salvar reembolso`
- Seção Acompanhamento do cliente: `Copiar link`, `Enviar pelo WhatsApp`, `Abrir página pública`, `Gerar novo link` (`Revogar anterior e gerar novo`)
- Seção Fotos: filtro `Todas`, `Antes (entrada)`, `Depois (reparo/teste)`, `Outros`, botão `Anexar fotos`
- Seção Histórico: `Anotar no histórico`
- Rodapé de ações: `Arquivar`, `Cancelar entrada`, `Sem Conserto / Devolvido`, `Entregue / Faturado`, `Reabrir`
- Modal de etiqueta: `100 × 50 mm (padrão)`, `80 × 50 mm`, `Quantidade de cópias`, `Imprimir na Elgin`, `Imprimir pelo navegador`
- Comprovante de entrada: `Imprimir comprovante`, `Enviar o link pelo WhatsApp`, `Etiqueta`
- Proposta de orçamento A4: `Imprimir / Salvar PDF`, `Enviar PDF pelo WhatsApp`
- Termo de garantia A4: `Imprimir termo`, `Enviar pelo WhatsApp`

### `/placas/clientes` e `/placas/financeiro`
- Clientes: `Novo cliente`, chips `Todos`, `Parceiros`, `Cliente final`, ações `Ver placas`, `Abrir placa`, `Salvar alterações`, `Cadastrar cliente`, `Excluir cadastro`
- Financeiro: seletor `Ano de competência`, cartões `Faturamento do mês`, `Ticket médio do mês`, `Valor na bancada (em aberto)`, `Placas encalhadas`, `Total do ano`, ação `Ver placas`

### Apoio Técnico (`/placas/fichas`, `/placas/erros`, `/placas/assistente`, `/placas/manuais`)
- Fichas técnicas: `Cadastrar ficha com IA`, `Escolher manual e ler com IA`, selo `conferir`, `Confirmar revisão e salvar ficha`, `Abrir ficha completa`, `Abrir manual original`, `Imprimir ficha A4`, `Editar`, `Excluir`, blocos `Identificação`, `Linha frigorífica`, `Elétrica`, `Notas`
- Códigos de erro: campos `Marca *`, `Modelo (opcional)`, `Código ou sintoma *`, botão `Pesquisar código`, selos `Sugestão da IA: confirme na bancada`, `Manual do fabricante`, `Pesquisa da IA`
- Assistente técnico: campos `Marca *`, `Código de erro`, `Modelo / código da placa`, `Sintoma observado na bancada *`, botões `Gerar diagnóstico`, `Usar na placa`, selos `Probabilidade Alta`, `Probabilidade Média`, `Probabilidade Baixa`
- Manuais: botão `Enviar manual`, selos `PDF`, `TXT`, `Texto extraído`, `Sem texto extraído`, ações `Abrir` / `Abrir em nova aba`, `Excluir`

---

## 10. Textos jurídicos e comerciais copiados literalmente para revisão do Braulio

Todos os textos abaixo estão centralizados em `src/components/placas/textosJuridicosPlacas.ts` e foram copiados **literalmente** dos modais do sistema antigo (`D:\BRV_Equipamentos\frontend\src\pages\Reparos\`):

### 10.1. Proposta de Orçamento (`ModalOrcamentoPlaca.jsx` → `OrcamentoPlacaDocumento.tsx`)

- **Chave PIX exibida:**
  > `brvloja@brvniteroi.com.br`

- **Escopo técnico do orçamento (Seção 3):**
  1. `"Reparo eletrônico dos estágios de controle e potência, incluindo substituição de semicondutores e componentes periféricos defeituosos;"`
  2. `"Reconstituição de trilhas condutoras e reforço de soldas térmicas;"`
  3. `"Aplicação de verniz quando necessário;"`
  4. `"Simulação dinâmica em bancada com acionamento de compressor inverter e monitoramento de sinais de comunicação."`

- **Política de execução (Seção 4):**
  > `"POLÍTICA DE EXECUÇÃO: O início dos serviços em bancada, alocação de peças de precisão e testes é estritamente condicionado ao envio do comprovante bancário da entrada de 50% ({entradaFormatada}). O saldo restante de 50% deverá ser quitado no ato da retirada/entrega."`

- **Termos de Garantia Legal e Custódia Técnica (Seção 5):**
  - **1. Prazo da Garantia:** `"Este serviço possui Garantia Legal de 90 (noventa) dias (3 meses) a contar da data de retirada/entrega da placa, nos termos do Art. 26, II do Código de Defesa do Consumidor (Lei Federal nº 8.078/90)."`
  - **2. Cobertura:** `"A garantia abrange estritamente o circuito reparado e os componentes substituídos descritos neste laudo."`
  - **3. Condições de Validade:** `"A garantia perderá vigência caso ocorra: rompimento do selo/lacre de garantia de bancada; descargas atmosféricas (raios); sobretensão da rede elétrica externa; infiltração de água/líquidos; infestação de insetos/lagartixas ou intervenção de terceiros não autorizados."`
  - **4. Cláusula de Abandono (90 Dias):** `"Conforme os termos dos artigos 1.263 e 1.275, inciso III do Código Civil Brasileiro e a legislação consumerista correlata, o cliente declara-se expressamente ciente de que a placa ou equipamento disponibilizado para retirada (consertada ou não), que não for retirado no prazo de até 90 (noventa) dias corridos a contar da comunicação formal de conclusão ou impossibilidade do serviço, será legalmente caracterizado como BEM ABANDONADO (res derelicta), autorizando expressamente a BRV Niterói a realizar seu descarte ecologicamente adequado, reciclagem ou alienação para custeio das despesas de guarda, alocação e bancada, cessando em definitivo qualquer responsabilidade de guarda ou dever indenizatório."`

### 10.2. Comprovante de Entrada (`ModalComprovanteEntrada.jsx` → `ComprovanteEntradaDocumento.tsx`)

1. `"1. O prazo médio de diagnóstico de bancada laboratorial com instrumentação é de 24h a 48h úteis."`
2. `"2. Os aparelhos ou placas disponibilizados para retirada que não forem retirados no prazo de até 90 (noventa) dias corridos após notificação formal de liberação serão legalmente caracterizados como BEM ABANDONADO (Art. 1.275, III do Código Civil), autorizando descarte ecológico ou leilão para custeio de guarda."`
3. `"3. A garantia para serviços executados em bancada é de 90 (noventa) dias conforme Art. 26 do CDC a contar da data de retirada, restrita estritamente aos componentes reparados/substituídos."`

### 10.3. Termo de Garantia (`ModalTermoGarantia.jsx` → `TermoGarantiaDocumento.tsx`)

1. `"1. A garantia cobre exclusivamente os componentes substituídos e o circuito reparado descritos neste termo pelo prazo legal de 90 (noventa) dias (Art. 26 do CDC)."`
2. `"2. A garantia perderá total validade em caso de: descarga atmosférica (raio), sobretensão da rede elétrica externa, infestação de insetos/lagartixas, oxidação por maresia/umidade excessiva ou intervenção de terceiros não autorizados."`
3. `"3. Para acionamento de garantia, é obrigatório apresentar este número de Ordem de Serviço e o selo de bancada intacto."`

