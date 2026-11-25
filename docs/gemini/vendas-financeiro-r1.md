# Resumo de Auditoria — Rodada 1: Catálogo, Orçamentos e Vendas

Data: 2026-11-24 (atualizado após a correção visual de `docs/gemini/vendas-visual-correcao.md`)
Escopo executado: **Rodada 1** de `docs/gemini/vendas-financeiro-briefing.md` (Catálogo `/catalogo`, Orçamentos `/orcamentos`, `/orcamentos/textos` e `/orcamento/:token`, Vendas `/vendas`, utilitário de dinheiro em centavos inteiros e base de permissão financeira para a Rodada 2).

---

## 1. Arquivos criados e alterados

### Criados (21 arquivos)
1. `src/utils/dinheiro.ts` — Aritmética e formatação de dinheiro em centavos inteiros (`Centavos = number`), sem ponto flutuante em somas/subtrações, com casos de teste comentados no rodapé.
2. `src/types/financeiro.ts` — Tipos base do financeiro compartilhados com Vendas e prontos para a Rodada 2 (`FinancialAccessLevel`, `FinancialPaymentMethod`, `FinancialAccount`, `CardMachineInstallmentRate`, `CardMachine`, `FinancialCategory`, `Supplier`).
3. `src/types/vendas.ts` — Tipos espelhando as futuras tabelas do Supabase com propriedades em inglês e comentários em português (`CatalogItem`, `SaveCatalogItemInput`, `CatalogListFilter`, `CatalogListResult`, `Quote`, `QuoteItem`, `QuoteEvent`, `QuoteStandardText`, `PublicQuoteView`, `Sale`, `SaleItem`, `SalePayment`, `SaleDocument`, `SaleEvent`, `CreateSaleInput`, `SaleListFilter`, `SaleListResult`).
4. `src/components/financeiro/fonteDeDados.ts` — Função `nivelFinanceiro(profile)` com `TODO(Claude)` para ler `profiles.financial_access`, estado reativo de demonstração (`useNivelFinanceiro`) e listagem demo de contas (`listarContas`) e maquininhas (`listarMaquininhas`).
5. `src/components/vendas/cores.ts` — Selos e rótulos alinhados ao formato de `STATUS_OS` (`src/utils/ordens.ts`) para tipos de item (`produto`, `servico`), situações de orçamento, situações de venda, situação de nota fiscal, formas de pagamento e origens.
6. `src/components/vendas/regrasVendas.ts` — Regras puras do front: `situacaoOrcamento`, `diasOrcamentoVencido`, `situacaoVenda`, `itemTemDadoFiscalCompleto`, `pareceItemDeServico`, `sugerirModeloNotaProdutos`, `calcularTaxaMaquininha`, `recalcularTotaisOrcamentoOuVenda`, `LIMITE_DESCONTO_SEM_SENHA_PERCENT = 10`, `OBSERVACOES_PADRAO_ORCAMENTO_INICIAIS`, `textoWhatsAppOrcamento`, `prepararJanelaWhatsApp` e `abrirLinkNaJanelaWhatsApp`.
7. `src/components/vendas/dadosDemo.ts` — Massa sintética com **40 itens de catálogo** (25 produtos ativos, 12 serviços ativos sendo 3 pendentes de revisão em "Revisar tipos" e 3 inativos), **4 textos padrão de observações** (copiados da seção 1 do briefing), **15 orçamentos** (`ORC-01689` a `ORC-01703`, tokens `demo-orc-1` a `demo-orc-15`) cobrindo todas as situações e **12 vendas** (`VND-01181` a `VND-01192`).
8. `src/components/vendas/fonteDeDados.ts` — Camada assíncrona com `export const FONTE_DADOS_DEMO = true` e **36 funções exportadas** operando sobre cópias em memória de `dadosDemo.ts`.
9. `src/components/vendas/ModalDialogoVendas.tsx` — Modal pequeno no padrão de `NovaAtividadeModal.tsx` baseado em `<dialog>` nativo (`showModal()`, `overscroll-behavior: contain`, fechamento por clique no backdrop e `Escape`, sem `backdrop-blur` nem `shadow-2xl`).
10. `src/components/vendas/NavegacaoVendas.tsx` — Controle `<select>` pequeno e discreto `"Ver como: completo / caixa / nenhum"` exibido no canto do cabeçalho apenas enquanto `FONTE_DADOS_DEMO` for `true`.
11. `src/components/vendas/CatalogoModais.tsx` — `CatalogoFormModal` (criar/editar/duplicar produto ou serviço com dados fiscais NCM, CFOP, CSOSN, origem, código de serviço LC 116/NBS e ISS recolhidos) e `RevisarTiposCatalogoModal` (conversão em lote de itens de mão de obra da importação do SicWeb para `servico`).
12. `src/pages/Catalogo.tsx` — Tela `/catalogo` no padrão visual de `Clientes.tsx` e `OrdensServico.tsx`.
13. `src/components/vendas/FolhaOrcamentoVenda.tsx` — Folha A4 retrato do orçamento (`FolhaOrcamentoVenda`) no molde de `FolhaOrcamentoPlaca.tsx` usando `EMPRESA_BRV`, com tabelas separadas de Produtos e Serviços, e `OrcamentoDocumentoModal` montado via `createPortal(..., document.body)`.
14. `src/pages/OrcamentoPublico.tsx` — Página pública `/orcamento/:token` (fora do `Layout`, montada via `createPortal(..., document.body)`) no molde de `OrcamentoPlacaPublico.tsx`.
15. `src/components/vendas/OrcamentoModais.tsx` — `ModalTextosPadraoOrcamento`, `ModalRegistrarRespostaOrcamento` e `ModalItemAvulso`.
16. `src/components/vendas/OrcamentoEditor.tsx` — Painel completo de orçamento (`fixed inset-0 z-50 overflow-y-auto bg-slate-50`) no padrão de `OrdemDetalhes.tsx`, com reordenação drag-and-drop por tabela (Produtos / Serviços), envio por WhatsApp, link público e histórico.
17. `src/pages/Orcamentos.tsx` — Tela `/orcamentos` (e `/orcamentos/textos`) no padrão visual de `Clientes.tsx` e `OrdensServico.tsx`, com total do filtro no rodapé da tabela.
18. `src/components/vendas/NotasFiscaisVenda.tsx` — Cartões de documentos fiscais da venda (`Produtos: NFC-e / NF-e` e `Serviços: NFS-e`), modal **"Preparar NFS-e para o portal"** (`nfse.gov.br/EmissorNacional`) com cópia campo a campo e registro manual do número, e `ReciboVendaModal` A4 via `createPortal`.
19. `src/components/vendas/VendaDetalhes.tsx` — Painel de detalhes da venda (`fixed inset-0 z-50 overflow-y-auto bg-slate-50`) no molde de `OrdemDetalhes.tsx`, com `ReceberSaldoVendaModal` e cancelamento com motivo obrigatório (bloqueado enquanto houver nota fiscal emitida não cancelada).
20. `src/components/vendas/NovaVendaModal.tsx` — Painel de **Nova venda** (`fixed inset-0 z-50 overflow-y-auto bg-slate-50`) no padrão de `OrdemDetalhes.tsx`, com busca por código/nome/código de barras, grade de itens frequentes, cliente ("Consumidor final" por padrão), CPF/CNPJ na nota, trava de 10% de desconto no nível `caixa`, pagamento misto, troco e comprovante pós-venda com emissão de notas.
21. `src/pages/Vendas.tsx` — Tela `/vendas` no padrão visual de `Clientes.tsx` e `OrdensServico.tsx`, com totais do filtro (`Total`, `Recebido`, `A receber`) no rodapé da tabela.

### Alterados (2 arquivos)
1. `src/App.tsx` — Adicionada a rota pública `/orcamento/:token` (`OrcamentoPublico`) e as rotas internas protegidas `/orcamentos`, `/orcamentos/textos`, `/vendas` e `/catalogo`.
2. `src/components/Sidebar.tsx` — Adicionado o grupo recolhível **Vendas** (`Orçamentos`, `Vendas`, `Catálogo`, todos `apenasEscritorio: true`) logo após `Serviços`, oculto pela constante `MOSTRAR_MENU_VENDAS = false`.

---

## 2. Telas e rotas (e quem abre cada uma)

| Rota | Componente | Quem pode acessar | Observação |
|---|---|---|---|
| `/catalogo` | `src/pages/Catalogo.tsx` | `admin`, `escritorio` | Nível `caixa` não vê a coluna nem o campo de custo (`cost_price_cents`). |
| `/orcamentos` | `src/pages/Orcamentos.tsx` | `admin`, `escritorio` | Aceita `?orcamento=<id>` e `?novo=1`. |
| `/orcamentos/textos` | `src/pages/Orcamentos.tsx` | `admin`, `escritorio` | Abre `/orcamentos` já com o modal **Textos padrão** aberto. |
| `/orcamento/:token` | `src/pages/OrcamentoPublico.tsx` | Público (sem login, fora do `Layout`) | Usa `PublicQuoteView` (sem custo, margem nem observação interna). Só permite aprovar quando `status === 'enviado'` e `!is_expired`. |
| `/vendas` | `src/pages/Vendas.tsx` | `admin`, `escritorio` | Aceita `?venda=<id>`, `?orcamento=<id>` (pré-preenche a Nova venda com os itens do orçamento) e `?nova=1`. |

### Notas para o Claude (`ProtectedRoute.tsx` e `src/ajuda/`)
1. **`src/components/ProtectedRoute.tsx`** (não alterado pelo Gemini):
   - Hoje `ProtectedRoute.tsx` já redireciona `tecnico` para `/campo`, `oficina` para `/oficina`, `cliente` para `/portal` e bloqueia `impressora`. Além disso, `Catalogo.tsx`, `Orcamentos.tsx` e `Vendas.tsx` verificam `ehEscritorioOuAdminVendas(profile?.role)`.
2. **`src/ajuda/` (`telaDaRota`)** (não alterado pelo Gemini):
   - `TODO(Claude)`: registrar `/catalogo`, `/orcamentos`, `/orcamentos/textos` e `/vendas` em `telaDaRota` (`src/ajuda/`) usando os rótulos exatos da **Seção 9**.

---

## 3. Contrato de dados e tipos que o Claude precisa implementar

### 3.1. Perfil e nível financeiro (`src/types/financeiro.ts` e `src/components/financeiro/fonteDeDados.ts`)
- Coluna em `profiles`: `financial_access text not null default 'nenhum' check (financial_access in ('nenhum', 'caixa', 'completo'))`.
- Regra de `nivelFinanceiro(profile)`:
  - `admin` → sempre `'completo'` (Adriana e Braulio).
  - `escritorio` → lê `profile.financial_access` (`'completo'`, `'caixa'` ou `'nenhum'`; fallback `'caixa'` na demonstração para Jéssica e Pedro).
  - Demais papéis (`tecnico`, `oficina`, `cliente`, `impressora`) → `'nenhum'`.
- Funções em `src/components/financeiro/fonteDeDados.ts`:
  - `nivelFinanceiro(profile)` e `useNivelFinanceiro(profile)`
  - `listarContas(): Promise<FinancialAccount[]>`
  - `listarMaquininhas(): Promise<CardMachine[]>`

### 3.2. Tabelas do banco (`src/types/vendas.ts`)
1. **`catalog_items` (`CatalogItem`)**:
   - `id`, `code`, `barcode`, `name`, `kind` (`'produto' | 'servico'`), `unit`, `category`, `sale_price_cents`, `cost_price_cents`, `controls_stock`, `stock_quantity`, `min_stock_quantity`, `active`, `type_reviewed`, `has_usage`, `is_frequent`, `ncm`, `cfop`, `csosn`, `origin` (`0..8`), `taxable_unit`, `service_code`, `iss_rate`, `invoice_description`, `created_at`, `updated_at`.
2. **`quotes` (`Quote`)**:
   - `id`, `number` (`ORC-NNNNN`), `status` (`'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'convertido'`), `customer_id` (`null` = `"Consumidor final"`), `customer_name`, `customer_person_type`, `customer_document`, `address_id`, `address_text`, `contact_name`, `contact_phone`, `seller_id`, `seller_name`, `validity_days` (padrão `10`), `valid_until` (`YYYY-MM-DD`), `products_subtotal_cents`, `services_subtotal_cents`, `general_discount_cents`, `freight_cents`, `total_cents`, `payment_terms_note`, `notes`, `internal_notes`, `public_token`, `sent_at`, `responded_at`, `response_channel`, `responded_by_name`, `response_note`, `converted_sale_id`, `converted_sale_number`, `converted_service_order_id`, `converted_service_order_number`, `created_at`, `updated_at`.
3. **`quote_items` (`QuoteItem`)**:
   - `id`, `quote_id`, `catalog_item_id`, `is_custom`, `kind` (`'produto' | 'servico'`), `code`, `name`, `unit`, `quantity`, `unit_price_cents`, `discount_mode` (`'valor' | 'percentual'`), `discount_input`, `discount_cents`, `total_cents`, `sort_order`.
4. **`quote_events` (`QuoteEvent`)**:
   - `id`, `quote_id`, `event_type` (`'criado' | 'alterado' | 'enviado' | 'reaberto' | 'novo_link' | 'aprovado' | 'recusado' | 'convertido_venda' | 'convertido_os' | 'nota'`), `actor_name`, `note`, `created_at`.
5. **`quote_texts` (`QuoteStandardText`)**:
   - `id`, `title`, `content`, `sort_order`, `active`.
6. **`sales` (`Sale`)**:
   - `id`, `number` (`VND-NNNNN`), `status` (`'ativa' | 'cancelada'`), `origin_type` (`'balcao' | 'orcamento' | 'os'`), `quote_id`, `quote_number`, `service_order_id`, `service_order_number`, `customer_id` (`null` = `"Consumidor final"`), `customer_name`, `customer_person_type`, `customer_document`, `invoice_document`, `address_id`, `address_text`, `seller_id`, `seller_name`, `products_subtotal_cents`, `services_subtotal_cents`, `general_discount_cents`, `total_cents`, `paid_cents`, `change_cents`, `notes`, `cancel_reason`, `cancelled_at`, `cancelled_by_name`, `created_at`, `updated_at`.
7. **`sale_items` (`SaleItem`)**:
   - `id`, `sale_id`, `catalog_item_id`, `is_custom`, `kind`, `code`, `name`, `unit`, `quantity`, `unit_price_cents`, `discount_mode`, `discount_input`, `discount_cents`, `total_cents`, `sort_order`.
8. **`sale_payments` (`SalePayment`)**:
   - `id`, `sale_id`, `method` (`'dinheiro' | 'pix' | 'debito' | 'credito' | 'boleto' | 'transferencia' | 'cheque'`), `amount_cents`, `tendered_cents`, `change_cents`, `account_id`, `account_name`, `card_machine_id`, `card_machine_name`, `installments`, `estimated_fee_percent`, `estimated_fee_cents`, `paid_at`, `created_by_name`, `notes`.
9. **`sale_documents` (`SaleDocument`)**:
   - `id`, `sale_id`, `group` (`'produtos' | 'servicos'`), `model` (`'nfce' | 'nfe' | 'nfse'`), `status` (`'nao_emitida' | 'emitindo' | 'emitida' | 'cancelada' | 'erro'`), `amount_cents`, `number`, `series`, `access_key`, `xml_url`, `pdf_url`, `error_message`, `cancel_reason`, `issued_at`, `cancelled_at`.

### 3.3. As 36 funções exportadas por `src/components/vendas/fonteDeDados.ts`
- **Catálogo (8)**:
  1. `listarCatalogo(filtro?: CatalogListFilter): Promise<CatalogListResult>`
  2. `buscarItemCatalogo(id: string): Promise<CatalogItem | null>`
  3. `buscarItensParaBusca(texto: string): Promise<CatalogItem[]>`
  4. `listarItensFrequentes(): Promise<CatalogItem[]>`
  5. `salvarItemCatalogo(dados: SaveCatalogItemInput): Promise<CatalogItem>`
  6. `inativarItemCatalogo(id: string): Promise<CatalogItem>`
  7. `listarSugestoesDeServico(): Promise<CatalogItem[]>`
  8. `marcarComoServico(ids: string[]): Promise<number>`
- **Orçamentos e textos padrão (17)**:
  9. `listarOrcamentos(filtro?: QuoteListFilter): Promise<QuoteListResult>`
  10. `buscarOrcamento(id: string): Promise<Quote | null>`
  11. `salvarOrcamento(dados: SaveQuoteInput, atorNome?: string): Promise<Quote>`
  12. `duplicarOrcamento(id: string, atorNome?: string): Promise<Quote>`
  13. `excluirOrcamento(id: string): Promise<void>`
  14. `reabrirOrcamento(id: string, atorNome?: string): Promise<Quote>`
  15. `registrarEnvioOrcamento(id: string, atorNome?: string): Promise<Quote>`
  16. `registrarRespostaOrcamento(id: string, dados): Promise<Quote>`
  17. `gerarNovoLinkOrcamento(id: string, atorNome?: string): Promise<Quote>`
  18. `historicoDoOrcamento(id: string): Promise<QuoteEvent[]>`
  19. `anotarNoHistoricoOrcamento(id: string, nota: string, atorNome?: string): Promise<QuoteEvent>`
  20. `listarTextosPadraoOrcamento(): Promise<QuoteStandardText[]>`
  21. `salvarTextoPadraoOrcamento(dados): Promise<QuoteStandardText>`
  22. `excluirTextoPadraoOrcamento(id: string): Promise<void>`
  23. `buscarOrcamentoPublico(token: string): Promise<PublicQuoteView | null>`
  24. `aprovarOrcamentoPublico(token: string, nome: string): Promise<PublicQuoteView>`
  25. `gerarOsDoOrcamento(id: string, atorNome?: string): Promise<{ quote: Quote; service_order_id: string; service_order_number: number; descricaoServicos: string }>`
- **Vendas e notas fiscais (9)**:
  26. `listarVendas(filtro?: SaleListFilter): Promise<SaleListResult>`
  27. `buscarVenda(id: string): Promise<Sale | null>`
  28. `concluirVenda(dados: CreateSaleInput, atorNome?: string): Promise<Sale>`
  29. `receberSaldoVenda(id: string, pagamentos, atorNome?: string): Promise<Sale>`
  30. `cancelarVenda(id: string, motivo: string, atorNome?: string): Promise<Sale>`
  31. `listarNotasDaVenda(vendaId: string): Promise<SaleDocument[]>`
  32. `emitirNotaVenda(vendaId: string, grupo: SaleDocumentGroup, tipo?: SaleDocumentModel, atorNome?: string): Promise<Sale>`
  33. `cancelarNotaVenda(notaId: string, motivo: string, atorNome?: string): Promise<Sale>`
  34. `registrarNotaManual(vendaId: string, modelo: SaleDocumentModel, numero: string, atorNome?: string): Promise<Sale>`
- **Vendedores e clientes (2)**:
  35. `listarVendedores(): Promise<SellerOption[]>`
  36. `buscarClientesParaVenda(texto: string): Promise<Customer[]>`

---

## 4. Regras de negócio implementadas no front (uma a uma)

1. **Dinheiro 100% em centavos inteiros (`src/utils/dinheiro.ts`)**:
   - Todos os campos `*_cents` são inteiros (`Math.round`). Somas e subtrações usam `somarCentavos`/`subtrairCentavos`.
   - `calcularLinhaItemCentavos(quantidade, precoUnitarioCentavos, modoDesconto, entradaDesconto)` calcula `brutoCentavos = Math.round(qtd * unit)`, aplica desconto em centavos ou percentual `Math.round((bruto * pct) / 100)`, limita o desconto ao valor bruto e devolve `totalCentavos = bruto - desconto`.
2. **Recálculo de subtotais e total (`recalcularTotaisOrcamentoOuVenda` em `src/components/vendas/regrasVendas.ts`)**:
   - Separa o subtotal líquido das linhas de `kind === 'produto'` (`produtosSubtotalCentavos`) e `kind === 'servico'` (`servicosSubtotalCentavos`).
   - Limita o desconto geral à soma líquida das linhas e soma o frete (`totalCentavos = somaLiquidaLinhas - descontoGeralEfetivo + freteEfetivo`).
3. **Validade padrão de 10 dias e situação derivada do orçamento (`situacaoOrcamento`)**:
   - Todo orçamento novo nasce com `validity_days = 10` e `valid_until = somarDiasIso(hoje, 10)`.
   - Se `status === 'convertido'` ou houver `converted_sale_id` / `converted_service_order_id`, `situacaoOrcamento` retorna `'convertido'`.
   - Se `status === 'enviado'` e `valid_until < hojeIso`, `situacaoOrcamento` deriva `'vencido'` automaticamente no front.
   - Ao converter em venda ou gerar OS de um orçamento vencido, o sistema pede confirmação avisando há quantos dias está vencido (`diasOrcamentoVencido`).
4. **Situação derivada da venda (`situacaoVenda`)**:
   - `'cancelada'` se `status === 'cancelada'`; `'paga'` se `paid_cents >= total_cents && total_cents > 0`; `'parcial'` se `paid_cents > 0 && paid_cents < total_cents`; `'aberta'` se `paid_cents === 0`.
5. **Consumidor final vs venda a receber**:
   - Quando não há cliente selecionado (`customer_id === null`), o orçamento ou venda à vista usa `"Consumidor final"` (permitindo informar CPF/CNPJ avulso para sair na nota fiscal).
   - Se `totalPago < totalCentavos` (venda aberta ou parcial a receber), o sistema exige escolher um cliente cadastrado.
6. **Limite de desconto por nível financeiro (`LIMITE_DESCONTO_SEM_SENHA_PERCENT = 10`)**:
   - Na Nova Venda, quando `nivel !== 'completo'` (`caixa`), descontos totais (linhas + geral) acima de **10%** sobre o valor bruto exibem aviso e bloqueiam a conclusão da venda.
7. **Troco em dinheiro e taxa estimada da maquininha (`calcularTaxaMaquininha`)**:
   - Em pagamentos em `dinheiro`, calcula `troco = Math.max(0, entregue - valor)` sem somar o troco em `paid_cents`.
   - Em `debito` e `credito`, estima a taxa conforme `CardMachine` (`debit_fee_percent`, `credit_sight_fee_percent` ou `credit_installment_rates`), visível para o nível `completo`.
8. **Estoque informativo e revisão de tipos do SicWeb (`pareceItemDeServico`)**:
   - Quando a quantidade de um produto com `controls_stock` ultrapassa `stock_quantity`, exibe selo âmbar `"Estoque insuficiente (saldo: X)"` sem bloquear o orçamento ou a venda.
   - `pareceItemDeServico` identifica itens do SicWeb cujo nome começa com `"M.O"` ou contém `"mão de obra"`, `"instalação"`, `"desinstalação"`, `"manutenção"` ou `"visita"` para conversão em lote na ferramenta **Revisar tipos**.
9. **Separação fiscal automática e sugestão de modelo (`sugerirModeloNotaProdutos`)**:
   - Toda venda com `products_subtotal_cents > 0` cria um documento no grupo `'produtos'` (sugerindo `'nfe'` para CNPJ/PJ e `'nfce'` para CPF/Consumidor final, alternável antes da emissão).
   - Toda venda com `servicos_subtotal_cents > 0` cria um documento independente no grupo `'servicos'` com modelo `'nfse'` (com modal **"Preparar para o portal"** para copiar os dados para o Emissor Nacional `nfse.gov.br` e registrar o número emitido).
   - Uma venda com nota fiscal `'emitida'` só pode ser cancelada depois que a nota fiscal for cancelada.

---

## 5. Premissas e decisões tomadas

1. **Impressão A4 via `createPortal(..., document.body)`**:
   - Como `src/index.css` oculta `body > #root` em `@media print`, `OrcamentoDocumentoModal`, `OrcamentoPublico` e `ReciboVendaModal` são montados via `createPortal` direto em `document.body` com `@page { size: A4 portrait; margin: 12mm 14mm 14mm 14mm; }`.
2. **Dados da empresa unificados em `EMPRESA_BRV`**:
   - Os documentos A4 e links de WhatsApp usam `EMPRESA_BRV` de `src/components/pmoc/empresa.ts` (`BRV Manutenção e Instalação de Ar Condicionado LTDA`, `BRV Niterói`).
3. **Janela do WhatsApp aberta sincronamente no clique**:
   - `prepararJanelaWhatsApp()` abre `about:blank` antes do `await salvarOrcamento()` / `registrarEnvioOrcamento()` para evitar bloqueio de pop-up no navegador do celular.

---

## 6. Pendências e limitações (`TODO(Claude)`)

1. **Migration e RLS (`supabase/migrations/*`)**:
   - Criar `profiles.financial_access` e as tabelas `financial_accounts`, `card_machines`, `catalog_items`, `quotes`, `quote_items`, `quote_events`, `quote_texts`, `sales`, `sale_items`, `sale_payments` e `sale_documents`, além das RPCs públicas `orcamento_publico_ver` e `orcamento_publico_aprovar`.
2. **Serviços reais (`src/services/vendas.ts` e `src/services/financeiro.ts`)**:
   - Ligar as 36 funções de `src/components/vendas/fonteDeDados.ts` e as funções de `src/components/financeiro/fonteDeDados.ts` ao Supabase e virar `FONTE_DADOS_DEMO = false`.
3. **Menu lateral e ajuda F1**:
   - Virar `MOSTRAR_MENU_VENDAS = true` em `src/components/Sidebar.tsx` e cadastrar os textos de ajuda F1 em `src/ajuda/`.

---

## 7. Saída exata de `typecheck`, `lint` e `build`

```text
> brv-control@0.1.0 typecheck
> tsc -p tsconfig.json


> brv-control@0.1.0 lint
> oxlint

Found 0 warnings and 0 errors.
Finished in 278ms on 289 files with 116 rules using 28 threads.

> brv-control@0.1.0 build
> tsc -p tsconfig.json && vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 2284 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.83 kB │ gzip:   0.40 kB
dist/assets/index-B08sEPQu.css    115.27 kB │ gzip:  18.32 kB
dist/assets/index-DC-libJF.js   2,333.98 kB │ gzip: 558.20 kB
✓ built in 12.42s
```

---

## 8. Como testar

1. **Seletor `"Ver como: completo / caixa / nenhum"`**:
   - No canto direito do cabeçalho de `/catalogo`, `/orcamentos` e `/vendas`, troque entre `completo` (vê custo no catálogo, aplica desconto > 10%, vê taxa da maquininha e pode cancelar venda/nota) e `caixa` (não vê custo, desconto limitado a 10%, não vê taxa da maquininha).
2. **Catálogo (`/catalogo`)**:
   - Filtrar por busca, categoria e controle segmentado (`Todos`, `Produtos`, `Serviços`, `Inativos`).
   - Clicar em **Revisar tipos (3)** para converter os 3 itens de mão de obra herdados como produto para `Serviço`.
   - Clicar em **Novo item** ou numa linha da tabela para editar e conferir a seção recolhida **Dados fiscais**.
3. **Orçamentos (`/orcamentos` e `/orcamentos/textos`)**:
   - Filtrar por busca, situação, vendedor, composição e período; conferir a contagem e o `Total` do filtro no rodapé da tabela.
   - Abrir um orçamento ou clicar em **Novo orçamento**: reordenar itens por drag-and-drop nas tabelas de **Produtos** e **Serviços**, inserir chips de **Textos padrão**, testar **Imprimir / PDF**, **Enviar pelo WhatsApp**, **Converter em venda** e **Gerar OS**.
4. **Página pública (`/orcamento/:token`)**:
   - `/orcamento/demo-orc-1` (`ORC-01701`, enviado e dentro da validade): preencher `Seu nome`, marcar `Li e concordo` e clicar em **Aprovar orçamento**, ou clicar em **Salvar em PDF / Imprimir**.
   - `/orcamento/demo-orc-2` (`ORC-01700`, já aprovado): exibe a confirmação de aprovação.
   - `/orcamento/demo-orc-3` (`ORC-01696`, vencido): exibe o alerta de validade expirada e o botão **Dúvidas? Falar com a BRV no WhatsApp**.
5. **Vendas (`/vendas`)**:
   - Filtrar pelo controle segmentado (`Todas`, `Hoje`, `A receber`, `Canceladas`), situação, forma de pagamento, origem, nota fiscal e período; conferir `Total`, `Recebido` e `A receber` no rodapé da tabela.
   - Clicar em **Nova venda**: adicionar itens pela busca ou pela grade de itens frequentes, testar pagamento rápido (`PIX`, `Crédito`, `Débito`, `Dinheiro`, `A receber`), concluir a venda e testar a emissão de **NFC-e / NF-e** e **NFS-e** (incluindo **Preparar para o portal**).
   - Abrir uma venda com saldo pendente (`VND-01189` ou `VND-01188`) e clicar em **Receber saldo**.

---

## 9. Nomes exatos de botões, abas, campos e selos para a ajuda F1 (`src/ajuda/`)

### 9.1. Tela `/catalogo` (`src/pages/Catalogo.tsx` e `src/components/vendas/CatalogoModais.tsx`)
- **Título**: `Catálogo`
- **Botões do cabeçalho**: `Ver como:` (`completo`, `caixa`, `nenhum`), `Revisar tipos (N)`, `Novo item`.
- **Barra de filtros**: campo `Buscar por código, nome ou código de barras...`, seletor `Todas as categorias`, controle segmentado `Todos` | `Produtos` | `Serviços` | `Inativos`.
- **Colunas da tabela**: `Código`, `Item`, `Tipo`, `Unid.`, `Preço`, `Custo` (só `completo`), `Estoque`, `Status`, `Ação`.
- **Selos**: `Produto`, `Serviço`, `Fiscal incompleto`, `Ativo`, `Inativo`.
- **Ações da linha**: `Editar`, `Duplicar`, `Inativar` / `Reativar`.
- **Modal `Novo item` / `Editar item` / `Duplicar item`**: `Tipo *` (`Produto`, `Serviço`), `Código *`, `Código de barras`, `Unidade *`, `Nome *`, `Categoria`, `Preço de venda (R$) *`, `Custo (R$)`, `Controla estoque`, `Estoque atual`, `Estoque mínimo`, `Item frequente`, `Ativo`, seção `Dados fiscais` (`Completo` / `Incompleto`) com `NCM (8 dígitos)`, `CFOP`, `CSOSN`, `Origem da mercadoria`, `Unidade tributável` (para produto) ou `Código de serviço (LC 116 / NBS)`, `Alíquota de ISS (%)`, `Descrição para a NFS-e` (para serviço), botões `Cancelar` e `Salvar`.
- **Modal `Revisar tipos`**: botões `Fechar` e `Converter em Serviço`.

### 9.2. Tela `/orcamentos` (`src/pages/Orcamentos.tsx`, `OrcamentoEditor.tsx`, `OrcamentoModais.tsx`, `FolhaOrcamentoVenda.tsx`)
- **Título**: `Orçamentos`
- **Botões do cabeçalho**: `Ver como:`, `Textos padrão`, `Novo orçamento`.
- **Barra de filtros**: campo `Buscar por número, cliente, contato ou item...`, seletores `Todas as situações` (`Rascunho`, `Enviado`, `Aprovado`, `Recusado`, `Convertido`, `Vencido`), `Todos os vendedores`, `Produtos e serviços` (`Com serviço`, `Com produto`), campos de data inicial e final.
- **Colunas da tabela**: `Nº`, `Cliente`, `Contato`, `Situação`, `Vendedor`, `Emissão`, `Validade`, `Total`.
- **Painel `OrcamentoEditor`**:
  - Barra fixa superior: `Salvar`, `Reabrir para editar`, `Duplicar`, `Imprimir / PDF`, `Enviar pelo WhatsApp`, `Registrar resposta`, `Converter em venda`, `Gerar OS`, `Excluir`.
  - Seção `Cliente`: caixa `Consumidor final`, `Cliente *`, `Endereço`, `Contato`, `Telefone / WhatsApp`, `Vendedor(a)`.
  - Seção `Itens`: botão `Item avulso`, campo `Buscar produto ou serviço por código ou nome...`, tabelas `Produtos` e `Serviços` (campos `Qtd.`, `Valor unit. (R$)`, `Desconto` com botão `Usar %` / `Usar R$`, `Total`), campos `Validade (dias)`, `Desconto geral (R$)`, `Frete (R$)`, `Condição de pagamento`.
  - Seção `Observações`: link `Textos padrão`, botões `+ <título do texto>`, `Observações`, `Observações internas (só o escritório)`.
  - Seção `Link do cliente`: botões `Copiar link`, `Abrir link`, `Novo link`.
  - Seção `Histórico`: campo `Adicionar anotação...`, botão `Anotar`.
- **Modal `Textos padrão`**: campos `Título *`, `Texto *`, botões `Adicionar` / `Salvar`, `Cancelar`, `Editar`, `Excluir`.
- **Modal `Registrar resposta`**: `Resposta *` (`Aprovado`, `Recusado`), `Canal *` (`WhatsApp`, `Telefone`, `Presencialmente`, `E-mail`), `Observação`, botões `Cancelar` e `Salvar`.
- **Modal `Item avulso`**: `Tipo *` (`Produto`, `Serviço`), `Descrição *`, `Qtd. *`, `Unid.`, `Unitário (R$) *`, botões `Cancelar` e `Adicionar`.

### 9.3. Página pública `/orcamento/:token` (`src/pages/OrcamentoPublico.tsx`)
- **Botões e campos**: `Salvar em PDF / Imprimir`, campo `Seu nome`, caixa `Li e concordo com o valor (...), as condições de pagamento e as condições gerais deste orçamento.`, botão `Aprovar orçamento`, botão `Dúvidas? Falar com a BRV no WhatsApp`.

### 9.4. Tela `/vendas` (`src/pages/Vendas.tsx`, `NovaVendaModal.tsx`, `VendaDetalhes.tsx`, `NotasFiscaisVenda.tsx`)
- **Título**: `Vendas`
- **Botões do cabeçalho**: `Ver como:`, `Nova venda`.
- **Barra de filtros**: campo `Buscar por número, cliente, nota ou item...`, controle segmentado `Todas` | `Hoje` | `A receber` | `Canceladas`, seletores `Todas as situações` (`Paga`, `Parcial`, `Aberta`, `Cancelada`), `Todas as formas`, `Todas as origens` (`Balcão`, `Orçamento`, `Ordem de Serviço`), `Todas as notas` (`Nota emitida`, `Nota pendente`, `Erro na nota`), datas inicial e final.
- **Colunas da tabela**: `Nº`, `Cliente`, `Origem`, `Pagamento`, `Situação`, `Notas fiscais`, `Data`, `Total`.
- **Painel `Nova venda` (`NovaVendaModal`)**:
  - Barra fixa superior: botão `Concluir venda`.
  - Coluna esquerda: seção `Adicionar item` (botão `Item avulso`, campo `Código de barras, código ou nome do item...`, grade de itens frequentes) e seção `Itens` (botão `Limpar`, linhas com `Qtd.`, `Unitário (R$)`, `Desconto` `%`/`R$`, `Total`).
  - Coluna direita: seção `Cliente` (link `CPF/CNPJ na nota`, seletor `Cliente (vazio = Consumidor final)`, seletor `Vendedor(a)`) e seção `Pagamento` (botão `Adicionar forma`, campo `Desconto geral (R$)`, atalhos `PIX`, `Crédito`, `Débito`, `Dinheiro`, `A receber`, linhas com `Forma`, `Valor (R$)`, `Recebido (R$)` / `Troco`, `Maquininha`, `Parcelas`, `Conta de destino`, botão `Concluir venda`).
  - Comprovante pós-venda: botões `Recibo`, `Abrir venda`, `Nova venda` e seção `Notas fiscais`.
- **Painel `VendaDetalhes`**:
  - Barra fixa superior: botões `Recibo`, `Receber saldo`, `Cancelar venda`.
  - Seções: `Itens`, `Pagamentos`, `Notas fiscais`, `Histórico`.
  - Cartões de `NotasFiscaisVenda`: `Produtos (NFC-e / NF-e)` com seletor `NFC-e` | `NF-e`, `Serviços (NFS-e)`, botões `Emitir nota`, `Tentar de novo`, `Preparar para o portal`, `Cancelar nota`, `Copiar`, `PDF`, `XML`.
  - Modal `Preparar NFS-e para o portal`: campos copiáveis (`Tomador`, `CPF / CNPJ`, `Endereço`, `Discriminação dos Serviços`, `Valor Total`), campo `Número da NFS-e emitida *` e botão `Registrar NFS-e`.

---

## 10. Textos copiados literalmente para revisão do Braulio

### 10.1. As 4 observações padrão de orçamento (`OBSERVACOES_PADRAO_ORCAMENTO_INICIAIS` em `src/components/vendas/regrasVendas.ts`)
1. **Alteração de informações**:
   `Orçamento feito de acordo com informações passadas pelo cliente, qualquer alteração o orçamento será refeito.`
2. **Elétrica e dreno**:
   `Elétrica e dreno por conta do cliente.`
3. **Alvenaria, gesso e janelas**:
   `A empresa não realiza fechamento de paredes ou tetos (gesso ou forro PVC), nem retirada ou colocação de janelas, grades, telas ou vidros, ficando estes serviços por conta do cliente.`
4. **Metragem de fio e mão de obra elétrica**:
   `O fio para a elétrica e a mão de obra serão acrescentados no orçamento depois do serviço, pois não sabemos a metragem.`

### 10.2. Mensagem de WhatsApp do orçamento (`textoWhatsAppOrcamento` em `src/components/vendas/regrasVendas.ts`)
`Olá, {customer_name}! Segue seu orçamento nº {number} ({total}), válido até {valid_until}: {link}`

---

## 11. Correção visual (2026-11-24)

Executado o roteiro `docs/gemini/vendas-visual-correcao.md` seguindo a seção **"Padrão visual (obrigatório)"** de `GEMINI.md` (sem alterar contratos de dados, tipos, nomes de funções nem regras de negócio):

### Arquivos alterados na correção visual (12 arquivos)
1. `src/components/vendas/cores.ts` — Selos de situação e tipo padronizados no formato de `STATUS_OS` (`bg-*-50 text-*-700 border-*-100`), removendo `violet-*` e `indigo-*`.
2. `src/components/vendas/NavegacaoVendas.tsx` — Removida a barra extra de abas no topo das páginas e a faixa âmbar de demonstração; mantido apenas o `<select>` pequeno e discreto `"Ver como: completo / caixa / nenhum"` no cabeçalho enquanto `FONTE_DADOS_DEMO = true`.
3. `src/pages/Catalogo.tsx` — Cabeçalho idêntico ao de `Clientes.tsx` (título curto `"Catálogo"` em `text-2xl font-bold tracking-tight text-slate-900`, sem cartão ao redor, sem ícone em quadradinho, sem cor da marca), barra única de filtros com busca + `<select>` de categoria + controle segmentado (`flex rounded-xl bg-slate-100 p-1`) sem contadores, e tabela com o mesmo `thead` e rodapé de `Clientes.tsx`.
4. `src/pages/Orcamentos.tsx` — Cabeçalho idêntico ao de `Clientes.tsx` (título `"Orçamentos"`), barra única de filtros com busca e `<select>` (removidas as pílulas com contador), e tabela com o `thead` de `Clientes.tsx` e total do filtro no rodapé.
5. `src/pages/Vendas.tsx` — Removida a caixa azul de aviso do SicWeb no topo; cabeçalho idêntico ao de `Clientes.tsx` (título `"Vendas"`), barra única de filtros com busca, controle segmentado (`Todas`, `Hoje`, `A receber`, `Canceladas`) sem contadores e `<select>`, e tabela com o `thead` de `Clientes.tsx` e totais no rodapé.
6. `src/components/vendas/OrcamentoEditor.tsx` — Cabeçalho fixo, cartões de seção e classe `INPUT` iguais aos de `OrdemDetalhes.tsx`; removidas as frases explicativas embaixo de campos e seções, a barra preta `bg-slate-900` do totalizador e os botões roxos/índigo.
7. `src/components/vendas/NovaVendaModal.tsx` — Substituído o topo escuro `bg-brv-navy` pelo cabeçalho branco fixo de `OrdemDetalhes.tsx` com botão `Concluir venda` em `bg-blue-600`; aplicados a classe `INPUT` e rótulos curtos; removidas as frases explicativas sob campos e seções, mantendo apenas avisos que mudam a decisão (desconto acima do limite, estoque insuficiente, venda a receber sem cliente).
8. `src/components/vendas/VendaDetalhes.tsx` — Alinhado ao layout e cabeçalho fixo de `OrdemDetalhes.tsx`, sem cores `indigo-*` ou `brv-navy`.
9. `src/components/vendas/NotasFiscaisVenda.tsx` — Removida a faixa âmbar `"Emissão fiscal de demonstração..."`; seletor `NFC-e` | `NF-e` convertido em controle segmentado `bg-slate-100 p-1`; modal do recibo A4 sem `backdrop-blur` nem `shadow-lg`.
10. `src/components/vendas/ModalDialogoVendas.tsx` — Alinhado ao visual de `NovaAtividadeModal.tsx` (`bg-black/40` sem `backdrop-blur`, `shadow-sm`, cabeçalho limpo sem subtítulo explicativo).
11. `src/components/vendas/CatalogoModais.tsx` — Rótulos curtos com classe `INPUT`; removidos subtítulos explicativos nos rádios de tipo, no campo de custo, no bloco de dados fiscais e na caixa introdutória de `Revisar tipos`.
12. `src/components/vendas/OrcamentoModais.tsx`, `src/components/vendas/FolhaOrcamentoVenda.tsx` e `src/pages/OrcamentoPublico.tsx` — Rótulos curtos nos modais de orçamento e alinhamento da folha A4 e da página pública ao molde de `FolhaOrcamentoPlaca.tsx` e `OrcamentoPlacaPublico.tsx`.
