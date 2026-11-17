# Entrega: PMOC — Fases 2 e 3 (Telas de Operação, Campo, Relatório Público e QR Code)

Resumo técnico e auditoria da execução de `docs/gemini/pmoc-fase2-briefing.md` (Entregas 1 a 5 das fases 2 e 3 de `docs/pmoc.md`).

---

## 1. Arquivos criados e alterados

### Arquivos criados (`8` arquivos)

| Arquivo | Papel |
| --- | --- |
| `src/components/pmoc/GerarOsMesPmocModal.tsx` | Modal **"Gerar OS do mês"** (Entrega 1): resumo de aparelhos/tarefas previstas no mês, sugestão de duração (`30 min × aparelhos`), escolha de técnico ativo (`listarTecnicos`), data e hora obrigatórias (`deCamposDataHora`), bloqueio quando já existe OS no mês ou quando não há tarefas previstas. |
| `src/components/pmoc/PainelPmocDoMes.tsx` | Aba **"PMOC do mês"** na página `/pmoc` (Entrega 2): seletor de mês (`YYYY-MM`), 4 cartões de resumo, busca/filtro por situação, tabela responsiva de planos vigentes com barra de progresso (`X de Y aparelhos`), ações contextuais (`Gerar OS`, `Ver OS #N`, `Abrir relatório`, `WhatsApp`, `Copiar link`) e geração de link público. |
| `src/components/dashboard/CartaoPmocMes.tsx` | Cartão compacto **"PMOC do mês"** no Painel Inicial `/` (Entrega 2): visível apenas para `admin` e `escritorio`, mostra planos vigentes, sem OS, agendadas, executadas e atrasadas, com atalho para `/pmoc?aba=mes` (oculta-se quando `active_plans_total === 0` ou enquanto a RPC da fase 2 ainda não está publicada). |
| `src/components/campo/pmoc/ChecklistPmocAtividade.tsx` | Bloco **"Checklist do PMOC"** na tela da atividade do técnico `/campo/atividade/:id` (Entrega 3): cabeçalho com plano e barra de progresso (`X de Y aparelhos concluídos`), lista expansível de aparelhos com selo de situação e bloco final de encerramento com campo obrigatório **"Acompanhado no local por"** (`accompanied_by`). |
| `src/components/campo/pmoc/PainelAparelhoPmocCampo.tsx` | Painel individual de execução de aparelho no `/campo` (Entrega 3): tarefas previstas no mês com marcação tocável (`44 px+`), 4 medições numéricas (`inputMode="decimal"`) com indicação de obrigatoriedade e aviso amarelo de faixa plausível (`0–100 A`, `-10–60 °C`), fotos antes/depois via `BotoesFoto`, alternância para *"Não foi possível atender"* com motivo obrigatório e botão **"Salvar aparelho"**. |
| `src/components/pmoc/CorpoRelatorioMensalPmoc.tsx` | Corpo A4 compartilhado do **Relatório Mensal de Execução do PMOC** (Entrega 4): reutilizado tanto na rota interna autenticada quanto na rota pública `/relatorio-pmoc/:token`, incluindo cabeçalho institucional, dados do cliente/RT, resumo do mês (com `accompanied_by`), blocos por equipamento (tarefas, medições, fotos) e quadro de assinaturas com espaço reservado ao QR Code de conferência. |
| `src/pages/RelatorioPmocPublico.tsx` | Página pública `/relatorio-pmoc/:token` (Entrega 4): sem login, focada em celular e impressão A4 via `createPortal(..., document.body)`, com botões **"Imprimir / Salvar PDF"** (`window.print()`) e **"Falar com a BRV no WhatsApp"**, além de estados amigáveis de carregamento, erro de rede (`Tentar de novo`) e link inválido/expirado. |
| `src/pages/EquipamentoPublico.tsx` | Página pública `/equipamento/:token` da etiqueta QR Code colada no aparelho (Entrega 5 / Fase 3): sem login, exibe logo da BRV, nome fantasia do cliente (sem CPF/CNPJ, telefone ou endereço completo), ambiente, identificador (`AR-SR-0001`), tipo/BTUs, selo **"Plano vigente"** / **"Sem plano vigente"**, dados do plano ativo (código, vigência, RT + registro/TRT/ART) e histórico das últimas 12 manutenções com link **"Ver relatório do mês"**. |

### Arquivos alterados (`13` arquivos)

| Arquivo | O que mudou |
| --- | --- |
| `src/App.tsx` | Registrou as duas rotas públicas fora de `<ProtectedRoute />`: `/relatorio-pmoc/:token` (`<RelatorioPmocPublico />`) e `/equipamento/:token` (`<EquipamentoPublico />`). |
| `src/pages/Pmoc.tsx` | Adicionou seletor de abas no topo (**"Planos PMOC"** e **"PMOC do mês"**), sincronizado com a query string `?aba=mes` via `useSearchParams`, renderizando `<PainelPmocDoMes />` quando `aba=mes`. |
| `src/pages/Dashboard.tsx` | Incluiu `<CartaoPmocMes />` na grade superior (ao lado de `<CartaoBackup />`) exclusivamente para perfis `admin` e `escritorio`. |
| `src/pages/campo/CampoAtividade.tsx` | Carrega `buscarChecklistDaAtividade(id)` em paralelo aos dados da atividade; quando a atividade pertence a uma OS gerada pelo PMOC, exibe `<ChecklistPmocAtividade />` entre os dados do atendimento e as fotos gerais, e repassa `bloqueioPmoc` e `onAntesDeConcluirPmoc` (`concluirChecklist`) para `<ConcluirAtividadeModal />`. |
| `src/components/campo/ConcluirAtividadeModal.tsx` | Aceita as propriedades opcionais `bloqueioPmoc?: string | null` e `onAntesDeConcluirPmoc?: () => Promise<void>`. Quando `bloqueioPmoc` está preenchido, exibe alerta âmbar explicativo e desabilita o botão **"Confirmar conclusão"**; quando liberado, executa `onAntesDeConcluirPmoc()` antes de concluir a atividade na OS. |
| `src/components/pmoc/AbaExecucaoPmoc.tsx` | Substituiu a geração direta de OS pela abertura do modal `<GerarOsMesPmocModal />`, adicionou exibição do acompanhante (`accompanied_by`) e botões **"Enviar pelo WhatsApp"** e **"Copiar link"** para meses executados. |
| `src/components/pmoc/EditorPlanoPmoc.tsx` | Conectou o callback `onOsGerada` da aba de execução para recarregar execuções e exibir aviso de confirmação após gerar a OS pelo modal. |
| `src/components/pmoc/RelatorioExecucaoPmoc.tsx` | Refatorado para usar `<CorpoRelatorioMensalPmoc />` e adicionou na barra superior os botões **"Enviar pelo WhatsApp"** e **"Copiar link"** (gerando o link público sob demanda via `gerarLinkRelatorio`). |
| `src/components/pmoc/AbaEquipamentosPmoc.tsx` | Adicionou coluna de seleção por checkbox, botão **"Imprimir etiquetas"** (com trava `"Enviando..."` e confirmação na tela), link direto para a ficha pública QR de cada aparelho e modal **"Ver etiquetas (50×30 mm)"** com pré-visualização proporcional (`50 × 30 mm`). |
| `src/types/pmoc.ts` | Adicionou `public_token` em `PmocPlanEquipment` e `PmocMonthlyReport`, `accompanied_by` em `PmocEquipmentMonthExecution` e `PmocMonthlyReport`, e os novos contratos: `PmocGenerateOsScheduleInput`, `PmocMonthPlanStatus`, `PmocMonthPlanItem`, `PmocMonthSummary`, `PmocFieldEquipmentChecklist`, `PmocActivityChecklist`, `PmocSaveEquipmentExecutionInput`, `PmocPublicEquipmentHistoryItem`, `PmocPublicEquipmentView` e `PmocPrintLabelsResult`. |
| `src/components/pmoc/regrasPmoc.ts` | Adicionou `ESTILOS_SITUACAO_MES_PMOC`, `FAIXAS_PLAUSIVEIS_MEDICAO_PMOC` (`0–100 A`, `-10–60 °C`), `avisoFaixaMedicaoPmoc`, `grandezasExigidasNasTarefas`, `validarExecucaoAparelhoPmoc`, `motivoBloqueioConclusaoChecklistPmoc`, `linkPublicoRelatorioPmoc`, `linkPublicoEquipamentoPmoc`, `textoWhatsAppRelatorioPmoc` e `montarLinkWhatsAppPmoc`. |
| `src/components/pmoc/dadosDemo.ts` | Adicionou `PLANO_3_ID` (`PMOC-2026-0002`, Colégio Horizonte Demo) e `EQ_6_ID`, `public_token` em todos os equipamentos demo (`eq-pmoc-demo-001` a `006` + `eq-pmoc-demo-sem-plano`), `accompanied_by` nas execuções concluídas, estados de novembro/2026 (`2026-11`) cobrindo `sem_os`, `os_agendada` (com 1/3 aparelhos concluídos na atividade `demo-pmoc-act-9088`) e `executada`, além de `OS_MES_META_INICIAIS_DEMO` com tokens de relatório (`rel-pmoc-demo-2026-08`, `rel-pmoc-demo-2026-09`, `rel-pmoc-demo-2026-11`). |
| `src/components/pmoc/fonteDeDados.ts` | Mantido com `USAR_BANCO_PMOC = true` para entrega final; atualizou `gerarOsDoMes` e implementou todas as novas funções das fases 2 e 3 com lógica completa em memória (`USAR_BANCO_PMOC = false`) e erro amigável `new Error('Disponível na próxima atualização do sistema.')` quando `USAR_BANCO_PMOC = true`. |

> **Arquivos intocados (conforme seção 7 do briefing):** nenhum arquivo em `supabase/`, `src/services/`, `src/contexts/`, `public/sw.js`, `android/`, `hostgator-api/` ou `src/ajuda/` foi alterado.

---

## 2. Telas e rotas

| Rota / Componente | Perfil que acessa | Entregas cobertas |
| --- | --- | --- |
| `/pmoc` (aba **"PMOC do mês"** / `?aba=mes`) | `admin`, `escritorio` | **Entrega 1** (abre `GerarOsMesPmocModal`), **Entrega 2** (`PainelPmocDoMes`), **Entrega 4** (botões WhatsApp e copiar link público). |
| `/` (`Dashboard.tsx` → `<CartaoPmocMes />`) | `admin`, `escritorio` | **Entrega 2** (cartão de resumo do mês com link direto para `/pmoc?aba=mes`). |
| `/pmoc/:id` (aba **"Execução Mensal"**) | `admin`, `escritorio` | **Entrega 1** (modal **"Gerar OS do mês"**) e **Entrega 4** (modal do relatório mensal + envio por WhatsApp e cópia do link público). |
| `/pmoc/:id` (aba **"Equipamentos"**) | `admin`, `escritorio` | **Entrega 5 (Fase 3)** (seleção de aparelhos, botão **"Imprimir etiquetas"** e modal de pré-visualização `50 × 30 mm`). |
| `/campo/atividade/:id` (`CampoAtividade.tsx`) | `tecnico` (app mobile `/campo`) | **Entrega 3** (`ChecklistPmocAtividade`, `PainelAparelhoPmocCampo` e trava de conclusão em `ConcluirAtividadeModal`). |
| `/relatorio-pmoc/:token` (`RelatorioPmocPublico.tsx`) | **Público** (sem login, celular e impressão A4) | **Entrega 4** (relatório mensal público com botão `"Imprimir / Salvar PDF"` e WhatsApp da BRV). |
| `/equipamento/:token` (`EquipamentoPublico.tsx`) | **Público** (sem login, celular) | **Entrega 5 (Fase 3)** (ficha pública do aparelho aberta pelo QR Code da etiqueta `50 × 30 mm`). |

---

## 3. Contrato de dados que o Claude precisa implementar

Todas as funções abaixo estão em `src/components/pmoc/fonteDeDados.ts` e atualmente lançam `new Error('Disponível na próxima atualização do sistema.')` quando `USAR_BANCO_PMOC = true` (exceto `gerarOsDoMes`, que encaminha para `real.gerarOsDoMes(planId, referenceMonth)` enquanto `src/services/pmoc.ts` ainda não aceita o 3º argumento `agendamento`).

| Função em `fonteDeDados.ts` | Parâmetros | Retorno (`Promise<...>`) | Dependências no banco / servidor (`src/services/pmoc.ts` e migrations) |
| --- | --- | --- | --- |
| `gerarOsDoMes` | `(planId: string, referenceMonth: string, agendamento?: PmocGenerateOsScheduleInput)` | `PmocGenerateOsResult` (`{ service_order_id, order_number, created, activity_id?, scheduled_start_at?, estimated_duration_minutes?, technician_id?, technician_name? }`) | Estender a RPC `generate_pmoc_month_os` (ou `src/services/pmoc.ts`) para receber `technician_id`, `scheduled_start_at`, `estimated_duration_minutes` e `notes`, criando a atividade (`activities`) e o vínculo do técnico (`activity_collaborators`) junto com a OS. |
| `resumoDoMes` | `(referenceMonth: string)` | `PmocMonthSummary` | Consultar planos vigentes no mês (`YYYY-MM`), cruzar com `pmoc_equipment_month_executions`, `service_orders` e `activities`, calculando `PmocMonthPlanStatus` (`sem_os`, `os_aberta`, `os_agendada`, `em_execucao`, `executada`, `atrasada`), contagens de aparelhos (`equipments_done_count` / `equipments_with_tasks_count`) e `report_public_token`. |
| `buscarChecklistDaAtividade` | `(activityId: string)` | `PmocActivityChecklist \| null` | Identificar se `activities.service_order_id` pertence a uma execução mensal PMOC (`pmoc_equipment_month_executions.service_order_id`); retornar metadados do plano, `accompanied_by` e a lista `PmocFieldEquipmentChecklist[]` de aparelhos com tarefas previstas no mês. Retornar `null` quando a atividade não for de PMOC. |
| `salvarExecucaoAparelho` | `(executionId: string, dados: PmocSaveEquipmentExecutionInput)` | `PmocEquipmentMonthExecution` | Atualizar a linha de `pmoc_equipment_month_executions` pelo técnico em campo (`status`, `tasks_executed`, `measurements`, `notes`, `before_photo_attachment_id`, `after_photo_attachment_id`, `executed_at`, `technician_user_id`). |
| `concluirChecklist` | `(activityId: string, acompanhadoPor: string)` | `void` | Validar que todos os aparelhos da OS no mês estão `concluida` ou `nao_atendido`, gravar `accompanied_by = acompanhadoPor.trim()` nas execuções do mês (ou em tabela/cabeçalho mensal do relatório) e gerar/garantir o `public_token` do relatório mensal. |
| `gerarLinkRelatorio` | `(planId: string, referenceMonth: string)` | `{ token: string; url: string }` | Gerar (se ainda não existir) e persistir `public_token` único para o par `(plan_id, reference_month)`, retornando `{ token, url: `${window.location.origin}/relatorio-pmoc/${token}` }`. |
| `buscarRelatorioPublico` | `(token: string)` | `PmocMonthlyReport \| null` | RPC pública (`SECURITY DEFINER`, acessível por `anon`) que busca o relatório mensal pelo `public_token` e retorna `PmocMonthlyReport` (incluindo `accompanied_by` e `public_token`), ou `null` se inválido. |
| `buscarEquipamentoPublico` | `(token: string)` | `PmocPublicEquipmentView \| null` | Coluna `public_token text unique` em `pmoc_plan_equipments` (ou `equipments`) + RPC pública (`SECURITY DEFINER` para `anon`) que retorna apenas nome de exibição do cliente (`customer_display_name` — **nunca** CPF/CNPJ, telefone ou endereço completo), ambiente, identificador, tipo/BTUs, dados do plano vigente (se houver) e as últimas 12 manutenções (`recent_maintenances`) com `report_token`. |
| `imprimirEtiquetas` | `(planId: string, equipmentIds: string[])` | `PmocPrintLabelsResult` (`{ count, message }`) | Garantir que cada equipamento tenha `public_token` e enfileirar etiquetas térmicas `50 × 30 mm` usando a fila de impressão existente em `src/services/etiquetas.ts`. |

---

## 4. Regras de negócio implementadas no front

| Regra | Onde está implementada |
| --- | --- |
| **Sugestão de duração da visita (`30 min × aparelhos com tarefa no mês`)** e montagem de data+hora ISO com fuso (`deCamposDataHora`, nunca data sem hora) | `src/components/pmoc/GerarOsMesPmocModal.tsx` |
| **Bloqueio de geração duplicada de OS no mesmo mês** (exibe `"OS #N já gerada para este mês"` com botão `"Abrir OS"`) e bloqueio quando `0` aparelhos têm tarefas previstas no mês | `src/components/pmoc/GerarOsMesPmocModal.tsx` |
| **Detecção de grandezas exigidas pelas tarefas do mês** (`current_a`, `temp_supply_c`, `temp_return_c`, `temp_ambient_c`) a partir do texto das tarefas previstas | `grandezasExigidasNasTarefas` em `src/components/pmoc/regrasPmoc.ts` |
| **Validação por aparelho no checklist de campo**: se `"Atendido"`, exige 100% das tarefas previstas marcadas + todas as medições exigidas preenchidas; se `"Não foi possível atender"`, exige motivo (`notes`) não vazio | `validarExecucaoAparelhoPmoc` em `src/components/pmoc/regrasPmoc.ts` e `src/components/campo/pmoc/PainelAparelhoPmocCampo.tsx` |
| **Aviso amarelo não-bloqueante para medições fora da faixa plausível**: corrente fora de `0 a 100 A` e temperaturas fora de `-10 a 60 °C` exibem *"Valor fora do comum — confira se digitou certo"* | `FAIXAS_PLAUSIVEIS_MEDICAO_PMOC` e `avisoFaixaMedicaoPmoc` em `src/components/pmoc/regrasPmoc.ts` |
| **Bloqueio da conclusão da atividade no `/campo`** enquanto houver aparelho pendente ou enquanto o campo **"Acompanhado no local por"** (`accompanied_by`) estiver em branco | `motivoBloqueioConclusaoChecklistPmoc` em `src/components/pmoc/regrasPmoc.ts`, `src/pages/campo/CampoAtividade.tsx` e `src/components/campo/ConcluirAtividadeModal.tsx` |
| **Formatação de link e mensagem de WhatsApp do relatório mensal** (limpa telefone, prefixa `55` quando tem 10–11 dígitos, monta texto com cliente, mês, resumo de aparelhos e link `/relatorio-pmoc/<token>`) | `textoWhatsAppRelatorioPmoc` e `montarLinkWhatsAppPmoc` em `src/components/pmoc/regrasPmoc.ts` |
| **Privacidade na página pública do aparelho (`/equipamento/:token`)**: exibe exclusivamente `customer_display_name` (nome fantasia), ambiente, identificador, tipo/BTUs, dados técnicos do plano e histórico de manutenções (sem CPF/CNPJ, telefone nem endereço do cliente) | `src/pages/EquipamentoPublico.tsx` e `buscarEquipamentoPublico` em `src/components/pmoc/fonteDeDados.ts` |

---

## 5. Premissas e decisões

1. **Comportamento suave enquanto as migrations/RPCs da Fase 2 ainda não foram aplicadas (`USAR_BANCO_PMOC = true`)**:
   - Em `CartaoPmocMes.tsx` (Painel Inicial `/`) e `CampoAtividade.tsx` (`/campo/atividade/:id`), quando `resumoDoMes` ou `buscarChecklistDaAtividade` lança a mensagem `'Disponível na próxima atualização do sistema.'`, o componente silencia esse erro específico e não renderiza o cartão/bloco. Assim, o Dashboard e as atividades normais de campo continuam 100% funcionais em produção antes mesmo de o Claude publicar o backend da Fase 2.
   - Já nas telas acionadas explicitamente pelo usuário (`PainelPmocDoMes.tsx`, `RelatorioPmocPublico.tsx`, `EquipamentoPublico.tsx` e botão `"Imprimir etiquetas"`), o erro amigável é exibido claramente com botão `"Tentar de novo"`.
2. **Impressão A4 em `/relatorio-pmoc/:token`**:
   - Como `src/index.css` oculta `body > #root` em `@media print`, `RelatorioPmocPublico.tsx` monta seu conteúdo via `createPortal(..., document.body)` com a classe `.pmoc-folha-impressao` (mesma estratégia validada em `RelatorioExecucaoPmoc.tsx` e `OrcamentoPlacaPublico.tsx`).
3. **Sem biblioteca de geração de QR Code em `package.json`**:
   - Conforme instruído na seção 2 (Entrega 4) e na seção 7 do briefing (não instalar pacotes npm), tanto o rodapé do relatório mensal quanto a pré-visualização da etiqueta `50 × 30 mm` exibem um quadro tracejado reservado (`"QR de conferência"`) com ícone `QrCode` do `lucide-react` e atributo `title` contendo a URL pública completa.

---

## 6. Pendências e limitações

1. **Backend das Fases 2 e 3 pendente de implementação pelo Claude**:
   - `USAR_BANCO_PMOC` foi entregue como `true` em `src/components/pmoc/fonteDeDados.ts`. As 8 funções novas e o agendamento em `gerarOsDoMes` precisam ser conectados a `src/services/pmoc.ts` e às migrations do Supabase (listadas na Seção 3 acima).
2. **Renderização matricial (bitmap/SVG) do QR Code**:
   - Não há pacote gerador de QR Code (`qrcode`, `qrcode.react`, etc.) instalado em `package.json`. Quando o Claude integrar a impressão/relatório, pode instalar uma biblioteca leve ou gerar o SVG do QR Code no utilitário de etiquetas.
3. **Testes não realizados ao vivo**:
   - Não foi testado em aparelho celular físico, nem em impressora térmica real (`50 × 30 mm`), nem em modo sem internet (offline/fila de sincronização).

---

## 7. Verificação (`typecheck`, `lint` e `build`)

Saída exata da execução final:

```text
> brv-control@0.1.0 typecheck
> tsc -p tsconfig.json


> brv-control@0.1.0 lint
> oxlint

Found 0 warnings and 0 errors.
Finished in 303ms on 255 files with 116 rules using 12 threads.

> brv-control@0.1.0 build
> tsc -p tsconfig.json && vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 2229 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.81 kB │ gzip:   0.38 kB
dist/assets/index-DmrEDeLa.css    113.93 kB │ gzip:  18.19 kB
dist/assets/index-DoEU24aC.js   2,004.67 kB │ gzip: 485.64 kB
✓ built in 4.65s
```

---

## 8. Como testar cada tela com os dados de demonstração

Para testar todo o fluxo em memória sem depender das migrations da Fase 2:

1. Abra `src/components/pmoc/fonteDeDados.ts` e altere temporariamente a linha 52 para:
   ```ts
   export const USAR_BANCO_PMOC = false;
   ```
2. **Painel Inicial (`/`) e Painel `"PMOC do mês"` (`/pmoc?aba=mes`) — Entrega 2**:
   - No Dashboard (`/`), confira o cartão **"PMOC do mês"** e clique em **"Ver painel do mês"**.
   - Em `/pmoc?aba=mes`, selecione o mês **Novembro/2026 (`2026-11`)** para visualizar os 3 cenários simultâneos:
     - `PMOC-2026-0001` (Clínica São Lucas Demo): **OS agendada** (`OS #9088`, `1 de 3 aparelhos`).
     - `PMOC-2026-0002` (Colégio Horizonte Demo): **Executada** (`OS #9092`, `1 de 1 aparelhos`, com botões **WhatsApp**, **Copiar link** e **Abrir relatório**).
     - `PMOC-2025-0014` (Edifício Comercial Solar Demo): **Sem OS** (com botão **"Gerar OS"**).
3. **Modal `"Gerar OS do mês"` — Entrega 1**:
   - No plano `PMOC-2025-0014` em `2026-11` (ou na aba **Execução Mensal** de qualquer plano em um mês sem OS), clique em **"Gerar OS"**.
   - Confira a quantidade de aparelhos e tarefas previstas, a duração sugerida (`30 min × aparelhos`), escolha técnico, data e hora e clique em **"Gerar OS e agendar"**.
4. **Checklist do PMOC no app do técnico (`/campo`) — Entrega 3**:
   - Acesse `/campo/atividade/demo-pmoc-act-9088` (ou qualquer atividade aberta com um usuário técnico em modo demo).
   - O bloco **"Checklist do PMOC"** exibirá os 3 aparelhos do plano `PMOC-2026-0001` (`AR-RC-0001` já concluído, `AR-RC-0002` e `AR-CT-0001` pendentes).
   - Abra um aparelho pendente, teste digitar uma medição fora da faixa (ex.: corrente `150` A ou temperatura `75` °C) para ver o aviso amarelo *"Valor fora do comum — confira se digitou certo"*, marque as tarefas e clique em **"Salvar aparelho"**.
   - Tente concluir a atividade sem preencher **"Acompanhado no local por"** ou com aparelhos pendentes para verificar o bloqueio em `ConcluirAtividadeModal`.
5. **Relatório mensal público (`/relatorio-pmoc/:token`) e WhatsApp — Entrega 4**:
   - Abra diretamente no navegador:
     - `/relatorio-pmoc/rel-pmoc-demo-2026-08` (Clínica São Lucas — Agosto/2026, 3 aparelhos atendidos)
     - `/relatorio-pmoc/rel-pmoc-demo-2026-09` (Clínica São Lucas — Setembro/2026, 2 atendidos e 1 não atendido com justificativa)
     - `/relatorio-pmoc/rel-pmoc-demo-2026-11` (Colégio Horizonte — Novembro/2026)
     - `/relatorio-pmoc/token-invalido-teste` (para ver o estado amigável de link inválido com botão do WhatsApp da BRV).
6. **QR Code do aparelho (`/equipamento/:token`) e Etiquetas `50 × 30 mm` — Entrega 5 (Fase 3)**:
   - Em `/pmoc/11111111-1111-4111-8111-111111111101`, abra a aba **Equipamentos**, clique em **"Ver etiquetas (50×30 mm)"** e em **"Imprimir etiquetas"**.
   - Abra as fichas públicas de demonstração:
     - `/equipamento/eq-pmoc-demo-001` (`AR-RC-0001` — com **Plano vigente** e histórico de manutenções com link **"Ver relatório do mês"**)
     - `/equipamento/eq-pmoc-demo-003` (`AR-CT-0001` — inclui registro de mês **Não atendido**)
     - `/equipamento/eq-pmoc-demo-sem-plano` (`AR-DP-0009` — estado **"Sem plano vigente"** mantendo histórico anterior)
     - `/equipamento/token-invalido` (estado amigável de etiqueta não encontrada).
7. Ao finalizar os testes em memória, volte `USAR_BANCO_PMOC = true` em `src/components/pmoc/fonteDeDados.ts`.

