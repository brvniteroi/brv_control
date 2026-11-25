# Resumo de Auditoria — Rodada 1: Catálogo, Orçamentos e Vendas

Data: 2026-11-24
Escopo executado: **Rodada 1** de `docs/gemini/vendas-financeiro-briefing.md` (Catálogo `/catalogo`, Orçamentos `/orcamentos` e `/orcamento/:token`, Vendas e Caixa/PDV `/vendas`, utilitário de dinheiro em centavos inteiros e base de permissão financeira para a Rodada 2).

---

## 1. Arquivos criados e alterados

### Criados (21 arquivos)
1. `src/utils/dinheiro.ts` — Aritmética e formatação de dinheiro em centavos inteiros (`Centavos = number`), sem ponto flutuante em somas/subtrações, com casos de teste comentados no rodapé.
2. `src/types/financeiro.ts` — Tipos base do financeiro compartilhados com Vendas e prontos para a Rodada 2 (`FinancialAccessLevel`, `FinancialOriginType`, `FinancialPaymentMethod`, `FinancialAccountType`, `FinancialAccount`, `CardMachineRateRule`, `CardMachine`).
3. `src/types/vendas.ts` — Tipos espelhando as futuras tabelas do Supabase com nomes de propriedades em inglês e comentários em português (`catalog_items`, `quotes`, `quote_items`, `quote_events`, `quote_texts`, `sales`, `sale_items`, `sale_payments`, `sale_documents` e tipos derivados `SituacaoOrcamento` e `SituacaoVenda`).
4. `src/components/financeiro/fonteDeDados.ts` — Função `nivelFinanceiro(profile)` com `TODO(Claude)` para ler `profiles.financial_access`, seletor reativo de demonstração (`"Ver como: completo / caixa / nenhum"` via `useSyncExternalStore`) e listagem demo de contas (`listarContas`) e maquininhas (`listarMaquininhas`).
5. `src/components/vendas/cores.ts` — Paleta semântica única para situações de orçamento, situações de venda, tipos de item (`servico`, `peca`, `aparelho`), origens de venda e documentos fiscais (com fundos `-50`, textos `-800` e bordas `-200`, sem `purple-*`/`violet-*`).
6. `src/components/vendas/regrasVendas.ts` — Regras puras no front: `situacaoOrcamento`, `situacaoVenda`, `recalcularTotaisOrcamentoOuVenda`, `calcularPercentualDesconto`, `LIMITE_DESCONTO_SEM_SENHA_PERCENT = 10`, `calcularTrocoCentavos`, `calcularTaxaMaquininhaCentavos`, `gerarRascunhosFiscaisVenda`, `ehEscritorioOuAdminVendas` e `dataMaisDiasISO`.
7. `src/components/vendas/dadosDemo.ts` — Base sintética realista de ar-condicionado em Niterói/RJ: **40 itens de catálogo** (12 serviços, 18 peças/insumos, 10 aparelhos), **4 textos padrão de observações**, **15 orçamentos** (`ORC-2026-0001` a `ORC-2026-0015`, tokens `demo-orc-1` a `demo-orc-15`) cobrindo as 7 situações e **12 vendas** (`VND-2026-0001` a `VND-2026-0012`) cobrindo balcão, orçamento, OS, PMOC, placas, pagamento misto, saldo em aberto e cancelada.
8. `src/components/vendas/fonteDeDados.ts` — Camada assíncrona com `export const FONTE_DADOS_DEMO = true` e todas as 26 funções do contrato da seção 8 do briefing, persistindo mutações em memória durante a sessão de testes.
9. `src/components/vendas/ModalDialogoVendas.tsx` — Componente modal acessível baseado em `<dialog>` nativo (`showModal()`, `overscroll-behavior: contain`, fechamento por coordenada de ponteiro no backdrop e `Escape`).
10. `src/components/vendas/NavegacaoVendas.tsx` — Barra superior do módulo Vendas com atalhos (`Orçamentos`, `Vendas (PDV)`, `Catálogo`), faixa discreta de modo demonstração e seletor `"Ver como: completo / caixa / nenhum"`.
11. `src/components/vendas/CatalogoModais.tsx` — `CatalogoFormModal` (criar/editar item com cálculo bidirecional de margem `((venda - custo) / venda) * 100` e NCM/código de serviço municipal recolhidos) e `RevisarTiposCatalogoModal` (classificação em lote dos itens vindos do Field Control).
12. `src/pages/Catalogo.tsx` — Tela `/catalogo` com cartões de resumo, abas por tipo, filtros de estoque e ativos, tabela responsiva (`role="region"`, `tabIndex={0}`), cartões no celular e trava de nível financeiro (`caixa` não vê custo/margem nem edita preços).
13. `src/components/vendas/FolhaOrcamentoVenda.tsx` — Folha A4 formal do orçamento comercial (`FolhaOrcamentoVenda`) com cabeçalho da BRV (`DADOS_EMPRESA_PMOC`), separação em Serviços e Peças/Equipamentos, resumo financeiro e `OrcamentoDocumentoModal` montado via `createPortal(..., document.body)` para impressão limpa.
14. `src/pages/OrcamentoPublico.tsx` — Página pública `/orcamento/:token` (fora do `Layout`, montada via `createPortal(..., document.body)`) com aprovação em 1 clique para orçamentos enviados dentro da validade, bloqueio de aprovação para vencidos/convertidos/recusados e botão `Imprimir / Salvar PDF`.
15. `src/components/vendas/OrcamentoModais.tsx` — `ModalTextosPadraoOrcamento` (gerenciar textos padrão de observações), `ModalRegistrarRespostaOrcamento` (aprovar ou recusar manualmente com canal e motivo) e `ModalItemAvulso` (item sob medida com opção de salvar no catálogo).
16. `src/components/vendas/OrcamentoEditor.tsx` — Editor completo de orçamento em 2 colunas (cliente cadastrado ou avulso, vínculo com OS/PMOC, busca rápida no catálogo, tabela de itens com desconto em `R$` ou `%`, frete, trava de 10% para nível `caixa`, previsão e cópia para WhatsApp, linha do tempo auditável `quote_events` e ações de ciclo de vida).
17. `src/pages/Orcamentos.tsx` — Tela `/orcamentos` (e `/orcamentos/textos`) com 5 cartões de resumo, abas por situação, filtro por origem e período, criação rápida a partir de `?cliente=...` ou `?os=...` e conversão em venda ou geração de OS.
18. `src/components/vendas/NotasFiscaisVenda.tsx` — Bloco e modal de notas/cupom (`NotasFiscaisVenda`) com separação automática entre **NFS-e (Prefeitura de Niterói)** para serviços e **NFC-e / NF-e (SEFAZ-RJ)** para peças e aparelhos, além do `ReciboVendaModal` A4 via `createPortal`.
19. `src/components/vendas/VendaDetalhes.tsx` — Painel/modal de detalhes da venda (`VendaDetalhes`) com itens, pagamentos, troco, líquido estimado após taxa da maquininha (`completo`), documentos fiscais, cancelamento com motivo obrigatório e `ReceberSaldoVendaModal` para quitar vendas `parcial`/`aberta`.
20. `src/components/vendas/NovaVendaModal.tsx` — Modal de **Nova venda (Caixa / PDV)** em duas colunas: carrinho com busca rápida (`F2`), quantidade, desconto por item e geral, trava de 10% e de preço mínimo de tabela para nível `caixa`, atalhos de 1 clique (`Tudo no PIX`, `Tudo no Dinheiro`, `Tudo no Débito`, `Tudo no Crédito`), pagamento misto, calculadora de troco em tempo real e resumo de taxa da maquininha.
21. `src/pages/Vendas.tsx` — Tela `/vendas` com 4 cartões de resumo (ocultando líquido estimado para nível `caixa`), filtros por situação, origem, forma de pagamento e período, suporte a `?orcamento=...`, `?os=...` e `?nova=1`, tabela desktop e cartões mobile.

### Alterados (2 arquivos)
1. `src/App.tsx` — Adicionada a rota pública `/orcamento/:token` (`OrcamentoPublico`) e as rotas internas protegidas `/orcamentos`, `/orcamentos/textos`, `/vendas` e `/catalogo`.
2. `src/components/Sidebar.tsx` — Adicionado o grupo recolhível **Vendas** (`Orçamentos`, `Vendas`, `Catálogo`, todos `apenasEscritorio: true`) logo após `Serviços`, oculto pela constante `MOSTRAR_MENU_VENDAS = false`.

---

## 2. Telas e rotas (e quem abre cada uma)

| Rota | Componente | Quem pode acessar | Observação |
|---|---|---|---|
| `/catalogo` | `src/pages/Catalogo.tsx` | `admin`, `escritorio` (`completo` ou `caixa`) | `caixa` consulta preços e estoque; só `completo` vê custo/margem, cria, edita, desativa e revisa tipos do Field Control. `nenhum` vê aviso de acesso restrito. |
| `/orcamentos` | `src/pages/Orcamentos.tsx` | `admin`, `escritorio` (`completo` ou `caixa`) | Aceita `?cliente=<id>` e `?os=<id>` para já abrir um novo orçamento preenchido. |
| `/orcamentos/textos` | `src/pages/Orcamentos.tsx` | `admin`, `escritorio` (`completo` ou `caixa`) | Abre `/orcamentos` já com o modal **Textos padrão de observações** visível (só `completo` cria/edita/exclui textos). |
| `/orcamento/:token` | `src/pages/OrcamentoPublico.tsx` | Público (sem login, fora do `Layout`) | Cliente visualiza a folha A4, salva em PDF e aprova em 1 clique quando `status === 'enviado'` e dentro de `valid_until`. |
| `/vendas` | `src/pages/Vendas.tsx` | `admin`, `escritorio` (`completo` ou `caixa`) | Aceita `?orcamento=<id>`, `?os=<id>` e `?nova=1`. `caixa` opera PDV com desconto até 10% e sem ver taxa/líquido da maquininha. |

### Notas para o Claude (`ProtectedRoute.tsx` e `src/ajuda/`)
1. **`src/components/ProtectedRoute.tsx`** (não alterado pelo Gemini):
   - Hoje `ProtectedRoute.tsx` já bloqueia automaticamente `tecnico` (redireciona para `/campo` se `!location.pathname.startsWith('/campo')`), `oficina` (redireciona para `/oficina` se `!location.pathname.startsWith('/oficina')`), `cliente` (redireciona para `/portal`) e `impressora`.
   - Mesmo assim, `Catalogo.tsx`, `Orcamentos.tsx` e `Vendas.tsx` checam explicitamente `ehEscritorioOuAdminVendas(profile?.role)` (`admin` ou `escritorio`) e `nivelFinanceiro(profile) !== 'nenhum'`, exibindo tela de **Acesso restrito** caso qualquer outro papel tente abrir.
2. **`src/ajuda/` (`telaDaRota`)** (não alterado pelo Gemini):
   - `TODO(Claude)`: registrar `/catalogo`, `/orcamentos`, `/orcamentos/textos` e `/vendas` em `telaDaRota` (`src/ajuda/`) usando os rótulos exatos documentados na **Seção 9** deste resumo.

---

## 3. Contrato de dados e tipos que o Claude precisa implementar

### 3.1. Perfil e nível financeiro (`src/types/financeiro.ts` e `src/components/financeiro/fonteDeDados.ts`)
- Coluna sugerida em `profiles`: `financial_access text not null default 'nenhum' check (financial_access in ('nenhum', 'caixa', 'completo'))`.
- Regra de `nivelFinanceiro(profile)`:
  - `admin` → sempre `'completo'` (Braulio e Renato).
  - `escritorio` → lê `profile.financial_access` (`'completo'`, `'caixa'` ou `'nenhum'`). Enquanto a coluna não existir na migração, o fallback retorna `'caixa'` para `escritorio`.
  - Demais papéis (`tecnico`, `oficina`, `cliente`, `impressora`) → `'nenhum'`.
- Funções em `src/components/financeiro/fonteDeDados.ts`:
  - `nivelFinanceiro(profile, overrideDemo?)`
  - `listarContas(): Promise<FinancialAccount[]>` (tabela `financial_accounts`)
  - `listarMaquininhas(): Promise<CardMachine[]>` (tabela `card_machines`)

### 3.2. Tabelas do banco (`src/types/vendas.ts`)
1. **`catalog_items` (`CatalogItem`)**:
   - `id`, `code` (`SRV-001`, `PEC-001`, `APA-001`), `name`, `kind` (`'servico' | 'peca' | 'aparelho'`), `category`, `unit` (`'un' | 'm' | 'kg' | 'h' | 'visita' | 'kit'`), `cost_cents` (`integer`), `sale_price_cents` (`integer`), `controls_stock` (`boolean`), `stock_quantity` (`numeric`), `min_stock` (`numeric`), `ncm` (`text | null`), `service_code` (`text | null`), `active` (`boolean`), `needs_kind_review` (`boolean`), `field_control_id` (`text | null`), `notes` (`text | null`), `created_at`, `updated_at`.
2. **`quotes` (`Quote`)**:
   - `id`, `number` (`ORC-AAAA-NNNN`), `public_token` (`unique`), `status` (`'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'convertido' | 'cancelado'`), `origin` (`'avulso' | 'os' | 'pmoc' | 'placas'`), `customer_id` (`uuid | null`), `customer_name`, `customer_document`, `customer_phone`, `customer_email`, `customer_address`, `service_order_id` (`uuid | null`), `service_order_number`, `pmoc_contract_id` (`uuid | null`), `pmoc_contract_code`, `board_repair_id` (`uuid | null`), `board_repair_code`, `issue_date` (`date`), `valid_until` (`date`), `services_subtotal_cents`, `products_subtotal_cents`, `items_discount_cents`, `general_discount_cents`, `freight_cents`, `total_cents`, `payment_terms`, `execution_timeframe`, `warranty_terms`, `notes`, `internal_notes`, `rejection_reason`, `approved_at`, `approved_channel`, `converted_sale_id`, `converted_sale_number`, `converted_service_order_id`, `converted_service_order_number`, `created_by_name`, `created_at`, `updated_at`.
3. **`quote_items` (`QuoteItem`)**:
   - `id`, `quote_id`, `catalog_item_id` (`uuid | null`), `is_custom` (`boolean`), `kind` (`'servico' | 'peca' | 'aparelho'`), `code`, `name`, `unit`, `quantity` (`numeric`), `unit_price_cents` (`integer`), `discount_mode` (`'valor' | 'percentual'`), `discount_input` (`numeric`), `discount_cents` (`integer`), `total_cents` (`integer`), `position` (`integer`).
4. **`quote_events` (`QuoteEvent`)**:
   - `id`, `quote_id`, `event_type` (`'criado' | 'editado' | 'enviado_whatsapp' | 'link_publico_aberto' | 'aprovado_link' | 'aprovado_manual' | 'recusado' | 'convertido_venda' | 'convertido_os' | 'duplicado' | 'cancelado'`), `description`, `actor_name`, `created_at`.
5. **`quote_texts` (`QuoteTextTemplate`)**:
   - `id`, `title`, `payment_terms`, `execution_timeframe`, `warranty_terms`, `notes`, `is_default` (`boolean`), `active` (`boolean`), `updated_at`.
6. **`sales` (`Sale`)**:
   - `id`, `number` (`VND-AAAA-NNNN`), `status` (`'aberta' | 'parcial' | 'paga' | 'cancelada'`), `origin` (`'balcao' | 'orcamento' | 'os' | 'pmoc' | 'placas'`), `customer_id`, `customer_name`, `customer_document`, `customer_phone`, `quote_id`, `quote_number`, `service_order_id`, `service_order_number`, `pmoc_contract_id`, `pmoc_contract_code`, `board_repair_id`, `board_repair_code`, `sold_at`, `services_subtotal_cents`, `products_subtotal_cents`, `discount_cents`, `surcharge_cents`, `total_cents`, `paid_cents`, `change_cents`, `card_fee_cents`, `net_cents`, `notes`, `cancel_reason`, `cancelled_at`, `seller_name`, `created_at`, `updated_at`.
7. **`sale_items` (`SaleItem`)**:
   - `id`, `sale_id`, `catalog_item_id`, `is_custom`, `kind`, `code`, `name`, `unit`, `quantity`, `unit_price_cents`, `discount_cents`, `total_cents`, `position`.
8. **`sale_payments` (`SalePayment`)**:
   - `id`, `sale_id`, `method` (`'pix' | 'dinheiro' | 'cartao_debito' | 'cartao_credito' | 'transferencia' | 'boleto' | 'outro'`), `amount_cents`, `tendered_cents`, `change_cents`, `installments`, `account_id`, `account_name`, `card_machine_id`, `card_machine_name`, `fee_percent`, `fee_cents`, `net_cents`, `paid_at`, `notes`.
9. **`sale_documents` (`SaleDocument`)**:
   - `id`, `sale_id`, `doc_type` (`'nfse' | 'nfce'`), `status` (`'nao_emitida' | 'pendente' | 'emitida' | 'cancelada'`), `authority_label`, `amount_cents`, `document_number`, `verification_code`, `issued_at`, `pdf_url`, `xml_url`, `notes`.

### 3.3. As 26 funções de `src/components/vendas/fonteDeDados.ts`
- **Catálogo (6)**: `listarItensCatalogo`, `buscarItensParaBusca`, `salvarItemCatalogo`, `alternarAtivoItemCatalogo`, `revisarTipoItemCatalogo`, `contarItensPendentesRevisao`.
- **Textos padrão de orçamento (3)**: `listarTextosOrcamento`, `salvarTextoOrcamento`, `excluirTextoOrcamento`.
- **Orçamentos (10)**: `listarOrcamentos`, `obterOrcamentoPorId`, `obterOrcamentoPublicoPorToken`, `salvarOrcamento`, `duplicarOrcamento`, `registrarEnvioOrcamentoWhatsApp`, `registrarRespostaOrcamento`, `aprovarOrcamentoPublicoPorToken`, `cancelarOrcamento`, `gerarOsDeOrcamento`.
- **Vendas e PDV (7)**: `listarVendas`, `obterVendaPorId`, `criarVenda`, `converterOrcamentoEmVenda`, `receberSaldoVenda`, `cancelarVenda`, `atualizarDocumentoFiscalVenda`.

---

## 4. Regras de negócio implementadas no front (uma a uma)

1. **Dinheiro 100% em centavos inteiros (`src/utils/dinheiro.ts`)**:
   - Todos os campos `*_cents` são inteiros (`Math.round`). Somas e subtrações usam `somarCentavos`/`subtrairCentavos`.
   - `calcularLinhaItemCentavos(quantidade, precoUnitarioCentavos, modoDesconto, entradaDesconto)` calcula `brutoCentavos = Math.round(qtd * unit)`, aplica desconto em centavos ou percentual `Math.round((bruto * pct) / 100)`, limita o desconto ao valor bruto e devolve `totalCentavos = bruto - desconto`.
2. **Recálculo completo de totais (`recalcularTotaisOrcamentoOuVenda` em `src/components/vendas/regrasVendas.ts`)**:
   - Separa automaticamente o subtotal líquido das linhas de `kind === 'servico'` (`subtotalServicosCentavos`) e o subtotal líquido de `peca` + `aparelho` (`subtotalProdutosCentavos`).
   - Limita o desconto geral ao subtotal após descontos de linha e soma o frete/acréscimo (`totalCentavos = subtotalAposLinhas - descontoGeralEfetivo + frete`).
3. **Validade padrão e situação derivada do orçamento (`situacaoOrcamento`)**:
   - Todo orçamento novo nasce com `valid_until = dataMaisDiasISO(15)` (+15 dias).
   - Se `status` no banco for `'rascunho'` ou `'enviado'` e `valid_until < hojeISO()` (sem aprovação nem conversão), `situacaoOrcamento(orcamento, hoje)` deriva automaticamente `'vencido'` no front sem precisar de job no banco.
4. **Situação derivada da venda (`situacaoVenda`)**:
   - Se `status === 'cancelada'`, retorna `'cancelada'`.
   - Se `paid_cents >= total_cents && total_cents > 0`, retorna `'paga'`.
   - Se `paid_cents > 0 && paid_cents < total_cents`, retorna `'parcial'`.
   - Caso contrário, retorna `'aberta'`.
5. **Limite de desconto e preço mínimo por nível financeiro (`LIMITE_DESCONTO_SEM_SENHA_PERCENT = 10`)**:
   - No nível `caixa`, se o desconto total (descontos de linha + desconto geral) ultrapassar **10,0%** do valor bruto dos itens, o formulário exibe alerta âmbar e bloqueia o botão de salvar/concluir.
   - No PDV (`NovaVendaModal`), o nível `caixa` também é bloqueado se tentar reduzir o preço unitário de um item do catálogo abaixo de `sale_price_cents` (orientando usar o campo de desconto até 10%).
   - No nível `completo`, qualquer percentual de desconto ou ajuste de preço unitário é permitido.
6. **Cálculo de troco em dinheiro (`calcularTrocoCentavos`)**:
   - Para pagamentos com `method === 'dinheiro'`, o operador informa o valor entregue pelo cliente (`tendered_cents`), e o sistema exibe o troco (`Math.max(0, valorEntregue - valorCobrado)`) ou alerta vermelho caso o valor entregue seja menor que o valor da parcela em dinheiro.
7. **Taxa estimada da maquininha e valor líquido (`calcularTaxaMaquininhaCentavos`)**:
   - Para `cartao_debito` e `cartao_credito`, localiza a regra da maquininha selecionada (`CardMachine.rules`) pela modalidade e número de parcelas (`installments`), calcula `taxaCentavos = Math.round((valor * fee_percent) / 100)` e `liquidoCentavos = valor - taxaCentavos`.
   - Essas informações de taxa e líquido estimado só aparecem na interface para quem tem nível `completo`.
8. **Estoque meramente informativo nesta rodada**:
   - Nos cards do catálogo e nas linhas do orçamento/PDV, itens com `controls_stock === true` mostram o saldo atual e um selo âmbar informativo quando a quantidade pedida supera `stock_quantity` ou quando `stock_quantity <= min_stock`, mas **nunca bloqueiam** o orçamento nem a venda.
9. **Separação fiscal automática (`gerarRascunhosFiscaisVenda`)**:
   - Ao criar uma venda ou converter um orçamento, o sistema gera automaticamente:
     - Um registro `SaleDocument` do tipo `'nfse'` (**NFS-e — Prefeitura de Niterói**) se `services_subtotal_cents > 0`;
     - Um registro `SaleDocument` do tipo `'nfce'` (**NFC-e / NF-e — SEFAZ-RJ**) se `products_subtotal_cents > 0`.
   - Assim, vendas mistas (ex.: aparelho Split + instalação) já nascem com os dois cartões fiscais independentes prontos para controle manual agora e futura integração via Focus NFe / eNotas.

---

## 5. Premissas e decisões tomadas

1. **impressão A4 via `createPortal(..., document.body)`**:
   - Como `src/index.css` oculta `body > #root` em `@media print`, tanto `OrcamentoDocumentoModal`, quanto `OrcamentoPublico` e `ReciboVendaModal` renderizam a folha A4 em um portal filho direto de `document.body`, com `@page { size: A4 portrait; margin: 12mm 14mm 14mm 14mm; }`, garantindo impressão e salvamento em PDF idênticos ao padrão de Placas e PMOC.
2. **Seletor `"Ver como: completo / caixa / nenhum"` sincronizado**:
   - Implementado com `useSyncExternalStore` em `src/components/financeiro/fonteDeDados.ts` e exibido em `NavegacaoVendas.tsx` enquanto `FONTE_DADOS_DEMO === true`, permitindo testar instantaneamente todas as travas de permissão sem trocar de usuário no Supabase.
3. **Mutações demo persistidas em memória durante a navegação**:
   - Todas as criações, edições, aprovações, conversões em venda, recebimentos de saldo e atualizações de nota fiscal atualizam os arrays em memória de `src/components/vendas/fonteDeDados.ts`, permitindo testar o fluxo ponta a ponta (Catálogo → Orçamento → Link Público → Conversão em Venda → Receber Saldo → Notas Fiscais).

---

## 6. Pendências e limitações (`TODO(Claude)`)

1. **Banco de dados e RLS (`supabase/migrations/*`)**:
   - Criar a coluna `profiles.financial_access` e as tabelas `financial_accounts`, `card_machines`, `catalog_items`, `quotes`, `quote_items`, `quote_events`, `quote_texts`, `sales`, `sale_items`, `sale_payments` e `sale_documents`.
2. **Serviços reais (`src/services/vendas.ts` e `src/services/financeiro.ts`)**:
   - Substituir o corpo das funções marcadas com `TODO(Claude)` em `src/components/vendas/fonteDeDados.ts` e `src/components/financeiro/fonteDeDados.ts` pelas chamadas ao Supabase e virar `FONTE_DADOS_DEMO = false`.
3. **Ativação no menu lateral (`src/components/Sidebar.tsx`)**:
   - Virar `MOSTRAR_MENU_VENDAS = true` quando o banco estiver ligado.
4. **Ajuda contextual F1 (`src/ajuda/`)**:
   - Registrar `/catalogo`, `/orcamentos`, `/orcamentos/textos` e `/vendas` em `telaDaRota` com os textos do Claude baseados na Seção 9 abaixo.
5. **Integração automática com Focus NFe / eNotas (futura)**:
   - Os cartões de NFS-e (Niterói) e NFC-e (RJ) já gravam status, número, código de verificação/chave e observações manualmente; a emissão via API fiscal entrará em fase posterior.

---

## 7. Saída exata de `typecheck`, `lint` e `build`

```text
> brv-control@0.1.0 typecheck
> tsc -p tsconfig.json


> brv-control@0.1.0 lint
> oxlint

Found 0 warnings and 0 errors.
Finished in 293ms on 289 files with 116 rules using 28 threads.

> brv-control@0.1.0 build
> tsc -p tsconfig.json && vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 2284 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.83 kB │ gzip:   0.40 kB
dist/assets/index-BW6H8fLY.css    116.97 kB │ gzip:  18.52 kB
dist/assets/index-D59Dn3a3.js   2,359.88 kB │ gzip: 564.67 kB
✓ built in 12.12s
```

---

## 8. Como testar

### 8.1. Testando os 3 níveis financeiros (`Ver como: completo / caixa / nenhum`)
No topo de `/catalogo`, `/orcamentos` e `/vendas`, a barra `NavegacaoVendas` traz o seletor **`Ver como`**:
- **`Completo (Braulio/Renato)`**:
  - Vê custo, margem (`%`) e edita itens no `/catalogo`, além do banner âmbar **Revisar tipos (Field Control)**.
  - Gerencia **Textos padrão** em `/orcamentos` (ou `/orcamentos/textos`).
  - Pode aplicar desconto acima de 10% em orçamentos e vendas e alterar preço unitário livremente no PDV.
  - Vê a coluna e o cartão de **Líquido estimado (após taxas)** e o resumo de taxa da maquininha em `/vendas`.
- **`Caixa (Atendimento)`**:
  - No `/catalogo`, as colunas **Custo** e **Margem** e os botões **Novo item**, **Editar**, **Desativar** e **Revisar tipos** desaparecem.
  - Em `/orcamentos` e no PDV (`/vendas` → **Nova venda (PDV)**), tentar aplicar mais de **10%** de desconto exibe o alerta âmbar de bloqueio, e tentar baixar o preço unitário de um item do catálogo abaixo do preço de tabela no PDV também bloqueia a conclusão.
  - Em `/vendas`, o cartão e a coluna de **Líquido estimado (após taxas)** ficam ocultos.
- **`Sem acesso`**:
  - Exibe o estado de bloqueio (**Acesso restrito ao Catálogo / Orçamentos / Vendas**) com link **Voltar ao Dashboard**.

### 8.2. Rotas internas para testar
1. **`/catalogo`**:
   - Filtrar pelas abas **Todos**, **Serviços**, **Peças e insumos**, **Aparelhos** e pelo filtro **Estoque baixo**.
   - Clicar em **Revisar tipos** na faixa âmbar para reclassificar os itens importados do Field Control (`needs_kind_review = true`).
   - Clicar em **Novo item** e testar o cálculo bidirecional entre **Custo (R$)**, **Margem (%)** e **Preço de venda (R$)**.
2. **`/orcamentos`** (e **`/orcamentos/textos`**):
   - Filtrar por situação (**Todos**, **Rascunhos**, **Enviados**, **Aprovados**, **Vencidos**, **Recusados**, **Convertidos**, **Cancelados**), origem e período.
   - Abrir um orçamento ou clicar em **Novo orçamento**: adicionar itens do catálogo ou **+ Item avulso**, alternar desconto da linha entre **R$** e **%**, selecionar um modelo em **Carregar texto padrão...**, ver a prévia da mensagem de WhatsApp e a **Linha do tempo do orçamento**.
   - Clicar em **Folha A4 / PDF** para abrir a proposta comercial A4 e testar **Imprimir / Salvar PDF**.
   - Em um orçamento aprovado (ex.: `ORC-2026-0005`), clicar em **Converter em venda** ou **Gerar OS**.
3. **`/vendas`**:
   - Clicar em **Nova venda (PDV)** (ou abrir `/vendas?nova=1`): buscar itens com `F2`, testar os botões de 1 clique (**Tudo no PIX**, **Tudo no Dinheiro**, **Tudo no Débito**, **Tudo no Crédito**), pagamento misto (**+ Adicionar forma de pagamento**) e a calculadora de troco em dinheiro.
   - Em uma venda com saldo pendente (`VND-2026-0005` — **Pago parcial** ou `VND-2026-0006` — **Em aberto**), clicar em **Receber** / **Receber saldo** para registrar uma nova parcela e ver a venda passar a **Paga**.
   - Abrir os detalhes de uma venda mista (ex.: `VND-2026-0002` — aparelho + instalação) e clicar em **Notas / Cupom** ou editar os cartões de **NFS-e — Prefeitura de Niterói** e **NFC-e / NF-e — SEFAZ-RJ**, além de abrir o **Recibo A4**.

### 8.3. Página pública do orçamento (`/orcamento/:token`)
- **`/orcamento/demo-orc-1`** (`ORC-2026-0001`, status **Enviado**, dentro da validade): exibe a barra superior com o botão verde **Aprovar orçamento** (abre confirmação com nome/cargo opcional e aprova em 1 clique) e o botão **Imprimir / Salvar PDF**.
- **`/orcamento/demo-orc-5`** (`ORC-2026-0005`, status **Aprovado**): exibe o selo verde **Orçamento aprovado** e permite imprimir/salvar PDF.
- **`/orcamento/demo-orc-8`** (`ORC-2026-0008`, status **Vencido**): exibe o aviso âmbar **Este orçamento venceu em ... Solicite a atualização de valores pelo WhatsApp da BRV** e bloqueia a aprovação.

---

## 9. Nomes exatos de botões, abas, campos e selos para a ajuda F1 (`src/ajuda/`)

### 9.1. Barra superior (`NavegacaoVendas`)
- Links de navegação: `Orçamentos`, `Vendas (PDV)`, `Catálogo`.
- Seletor de demonstração: `Ver como`, opções `Completo (Braulio/Renato)`, `Caixa (Atendimento)`, `Sem acesso`.

### 9.2. Tela `/catalogo` (`src/pages/Catalogo.tsx` e `src/components/vendas/CatalogoModais.tsx`)
- **Título**: `Catálogo de Serviços, Peças e Aparelhos`
- **Botões do cabeçalho**: `Atualizar`, `Novo item`, `Revisar tipos` (na faixa âmbar de itens vindos do Field Control).
- **Cartões de resumo**: `Itens ativos`, `Serviços`, `Peças e insumos`, `Aparelhos`, `Estoque baixo`.
- **Abas de tipo**: `Todos`, `Serviços`, `Peças e insumos`, `Aparelhos`.
- **Campos de busca e filtro**: `Buscar por nome, código (SRV-001, PEC-001...) ou categoria...`, `Todos os estoques` / `Com controle de estoque` / `Estoque baixo (≤ mínimo)`, `Somente ativos` / `Inativos` / `Todos (ativos + inativos)`.
- **Selos de tipo (`ROTULO_TIPO_ITEM`)**: `Serviço`, `Peça / Insumo`, `Aparelho`.
- **Selos de status e estoque**: `Ativo`, `Inativo`, `Revisar tipo`, `Sem controle`.
- **Ações da linha**: `Editar`, `Desativar`, `Ativar`.
- **Campos do modal `Novo item do catálogo` / `Editar item`**: `Tipo de item` (`Serviço`, `Peça / Insumo`, `Aparelho`), `Código`, `Categoria`, `Unidade`, `Item ativo para novos orçamentos e vendas`, `Nome / descrição comercial`, `Custo (R$)`, `Margem (%)`, `Preço de venda (R$)`, `Controlar quantidade em estoque`, `Estoque atual`, `Estoque mínimo (alerta)`, `Dados fiscais opcionais (NCM / Código de serviço municipal)`, `NCM (8 dígitos, peças/aparelhos)`, `Código de serviço (NFS-e Niterói)`, `Observações internas`, botões `Cancelar` e `Salvar alterações` / `Cadastrar item`.

### 9.3. Tela `/orcamentos` (`src/pages/Orcamentos.tsx`, `OrcamentoEditor.tsx`, `OrcamentoModais.tsx`, `FolhaOrcamentoVenda.tsx`)
- **Título**: `Orçamentos`
- **Botões do cabeçalho**: `Atualizar`, `Textos padrão`, `Novo orçamento`.
- **Cartões de resumo**: `Em aberto (Enviados)`, `Aprovados (aguardando)`, `Convertidos em venda`, `Vencidos / Recusados`, `Taxa de aprovação`.
- **Abas de situação**: `Todos`, `Rascunhos`, `Enviados`, `Aprovados`, `Vencidos`, `Recusados`, `Convertidos`, `Cancelados`.
- **Selos de situação (`ROTULO_SITUACAO_ORCAMENTO`)**: `Rascunho`, `Enviado`, `Aprovado`, `Vencido`, `Recusado`, `Convertido`, `Cancelado`.
- **Selos de origem (`ROTULO_ORIGEM_ORCAMENTO`)**: `Avulso`, `Ordem de Serviço`, `Contrato PMOC`, `Reparo de Placa`.
- **Ações da lista**: `Converter em venda`, `Folha A4`, `Abrir`.
- **Campos e botões do `OrcamentoEditor`**:
  - Cabeçalho: `Voltar para lista`, `Folha A4 / PDF`, `Duplicar`, `Converter em venda`, `Gerar OS`, `Salvar rascunho`, `Salvar alterações`.
  - Bloco `1. Cliente e origem`: `Selecionar cliente cadastrado`, `Origem do orçamento` (`Avulso / Balcão`, `Ordem de Serviço (OS)`, `Contrato PMOC`, `Reparo de Placa`), `Nome / Razão social *`, `CPF / CNPJ`, `Telefone / WhatsApp`, `E-mail`, `Endereço de atendimento / entrega`, `Nº da OS vinculada`, `Código do contrato PMOC`, `Código do reparo de placa`, `Data de emissão`, `Válido até (+15 dias padrão)`.
  - Bloco `2. Itens do orçamento (Serviços, Peças e Aparelhos)`: `Buscar item no catálogo por nome ou código`, botão `+ Item avulso`, colunas `Item`, `Tipo`, `Qtd.`, `Unitário (R$)`, `Desconto` (alternador `R$` / `%`), `Total`, campos `Desconto geral (R$)` e `Frete / deslocamento (R$)`.
  - Bloco `3. Condições comerciais e observações`: seletor `Carregar texto padrão...`, `Condições de pagamento`, `Prazo de execução / entrega`, `Garantia`, `Observações da proposta (visíveis ao cliente)`, `Anotações internas (só equipe BRV)`.
  - Coluna lateral: `Envio e link público para o cliente`, botões `Copiar mensagem + link`, `Abrir no WhatsApp`, `Abrir página pública`, `Marcar como enviado`; bloco `Resposta do cliente`, botão `Aprovar ou recusar manualmente`; bloco `Linha do tempo do orçamento`; botão `Cancelar orçamento`.

### 9.4. Página pública `/orcamento/:token` (`src/pages/OrcamentoPublico.tsx`)
- **Botões da barra superior**: `Aprovar orçamento`, `Imprimir / Salvar PDF`, `Falar no WhatsApp`.
- **Formulário de confirmação de aprovação**: `Seu nome e cargo (opcional, para registro na aprovação)`, botões `Cancelar` e `Confirmar aprovação`.

### 9.5. Tela `/vendas` (`src/pages/Vendas.tsx`, `NovaVendaModal.tsx`, `VendaDetalhes.tsx`, `NotasFiscaisVenda.tsx`)
- **Título**: `Vendas e Caixa (PDV)`
- **Botões do cabeçalho**: `Atualizar`, `Nova venda (PDV)`.
- **Cartões de resumo**: `Faturamento (vendas ativas)`, `Recebido em caixa`, `Saldo a receber`, `Líquido estimado (após taxas)`.
- **Abas de situação**: `Todas`, `Pagas`, `Pago parcial`, `Em aberto`, `Canceladas`.
- **Selos de situação (`ROTULO_SITUACAO_VENDA`)**: `Em aberto`, `Pago parcial`, `Paga`, `Cancelada`.
- **Selos de origem (`ROTULO_ORIGEM_VENDA`)**: `Balcão / PDV`, `Orçamento`, `Ordem de Serviço`, `Contrato PMOC`, `Reparo de Placa`.
- **Selos de pagamento (`ROTULO_METODO_PAGAMENTO`)**: `PIX`, `Dinheiro`, `Cartão de débito`, `Cartão de crédito`, `Transferência / TED`, `Boleto`, `Outro`.
- **Selos fiscais (`ROTULO_STATUS_DOC_FISCAL`)**: `Não emitida`, `Emissão pendente`, `Emitida`, `Cancelada`.
- **Ações da linha**: `Receber`, `Recibo`, `Detalhes`.
- **Modal `Nova venda (Caixa / PDV)`**:
  - Coluna esquerda (`1. Carrinho de itens`): `Buscar no catálogo (F2) por nome ou código...`, botão `+ Item avulso`, botão `Editar cliente`, controles `-` / `+` de quantidade, campo `Desc. (R$)`, `Observações da venda (opcional)`.
  - Coluna direita (`2. Desconto e Pagamento`): `Desconto geral na venda (R$)`, atalhos de 1 clique (`Tudo no PIX`, `Tudo no Dinheiro`, `Tudo no Débito`, `Tudo no Crédito`), botão `+ Adicionar forma de pagamento`, campos por parcela (`Forma de pagamento`, `Valor (R$)`, `Conta de destino`, `Valor entregue pelo cliente (R$)` com box `Troco a devolver`, `Maquininha`, `Parcelas`), botões `Cancelar` e `Concluir venda`.
- **Modal `VendaDetalhes`**: botões `Recibo A4`, `Notas / Cupom`, `Receber saldo`, `Cancelar venda`, e cartões fiscais **NFS-e — Prefeitura de Niterói** e **NFC-e / NF-e — SEFAZ-RJ** com botões `Marcar pendente`, `Registrar emissão` e `Editar dados`.

---

## 10. Textos copiados literalmente para revisão do Braulio

### 10.1. Os 4 modelos padrão de observações de orçamento (`TEXTOS_ORCAMENTO_DEMO` em `src/components/vendas/dadosDemo.ts`)

1. **Instalação padrão Split (Residencial / Comercial)** (`is_default: true`):
   - **Condições de pagamento**: `50% de sinal na aprovação via PIX ou transferência e 50% na conclusão do serviço, ou em até 6x no cartão de crédito (consultar taxa da maquininha).`
   - **Prazo de execução / entrega**: `Agendamento em até 3 dias úteis após a aprovação. Tempo estimado de execução no local: 1 dia útil.`
   - **Garantia**: `90 dias de garantia técnica BRV sobre a mão de obra de instalação. A garantia do aparelho segue o prazo oficial do fabricante quando instalado por equipe credenciada.`
   - **Observações**: `O orçamento contempla até 3 metros de linha frigorígena (cobre + isolamento elastomérico) por equipamento. Serviços de alvenaria fina, pintura, gesso, ponto elétrico dedicado no quadro ou andaime externo não estão inclusos, salvo se discriminados nos itens acima.`

2. **Manutenção corretiva e recarga de fluido**:
   - **Condições de pagamento**: `À vista na conclusão do serviço (PIX, dinheiro ou cartão de débito) ou em até 3x no cartão de crédito.`
   - **Prazo de execução / entrega**: `Execução em até 48 horas úteis após aprovação e disponibilidade das peças.`
   - **Garantia**: `90 dias de garantia sobre as peças substituídas e o serviço executado descritos neste orçamento.`
   - **Observações**: `Em caso de recarga de fluido refrigerante, o serviço inclui teste de estanqueidade com nitrogênio e vácuo monitorado por vacuômetro digital. Caso seja identificado novo ponto oculto de vazamento na serpentina durante a pressurização, o cliente será comunicado antes de qualquer custo adicional.`

3. **Venda de equipamento + instalação completa**:
   - **Condições de pagamento**: `Equipamento à vista via PIX/TED na confirmação do pedido (para reserva de estoque) e mão de obra na entrega/instalação, ou total parcelado em até 10x no cartão.`
   - **Prazo de execução / entrega**: `Entrega do equipamento em até 2 dias úteis em Niterói/São Gonçalo e instalação no dia útil seguinte.`
   - **Garantia**: `12 meses de garantia no equipamento conforme certificado do fabricante + 90 dias de garantia integral BRV na instalação.`
   - **Observações**: `Serão emitidos dois documentos fiscais distintos na conclusão da venda: NFC-e/NF-e (SEFAZ-RJ) referente ao equipamento e materiais, e NFS-e (Prefeitura de Niterói) referente à mão de obra de instalação.`

4. **Proposta de contrato PMOC mensal**:
   - **Condições de pagamento**: `Mensalidade fixa via boleto ou PIX com vencimento todo dia 10 do mês subsequente ao atendimento.`
   - **Prazo de execução / entrega**: `Início imediato após assinatura do contrato, com cronograma mensal de visitas preventivas e emissão do plano PMOC + TRT.`
   - **Garantia**: `Atendimento emergencial prioritário em até 24h úteis para equipamentos cobertos pelo plano PMOC.`
   - **Observações**: `Peças de reposição corretiva (compressores, placas eletrônicas, motores ventiladores e recargas de gás) serão orçadas à parte com desconto especial de cliente contratual.`

### 10.2. Termos impressos no rodapé da Folha A4 de Orçamento (`src/components/vendas/FolhaOrcamentoVenda.tsx`)
- **Validade da proposta**: `Esta proposta comercial é válida até a data indicada no cabeçalho ({valid_until}). Após o vencimento, valores e disponibilidade de estoque de peças e aparelhos estão sujeitos a confirmação.`
- **Nota fiscal no rodapé da proposta**: `Em caso de aprovação, os serviços serão faturados via NFS-e (Prefeitura de Niterói) e as peças/equipamentos via NFC-e / NF-e (SEFAZ-RJ), quando aplicável.`
- **Assinaturas da versão impressa**: `BRV Ar Condicionado — Responsável Comercial` e `De acordo do Cliente ({customer_name})`.

### 10.3. Nota informativa impressa no Recibo de Venda A4 (`src/components/vendas/NotasFiscaisVenda.tsx`)
- **Rodapé do recibo**: `Recibo comercial emitido pelo sistema BRV Control. Quando aplicável, a NFS-e de serviços (Prefeitura de Niterói) e a NFC-e / NF-e de produtos (SEFAZ-RJ) são emitidas separadamente conforme legislação vigente.`
