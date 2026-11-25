# Resumo da Entrega — Rodada 2: Financeiro (`docs/gemini/vendas-financeiro-r2.md`)

Documentação técnica da implementação da **Rodada 2** (`docs/gemini/vendas-financeiro-briefing.md`, seções 6 a 11) seguindo integralmente o **Padrão visual obrigatório** do `GEMINI.md` (regras 1 a 8) e a seção **6.0** do briefing.

---

## 1. Arquivos criados e alterados

### Arquivos criados
- `src/components/financeiro/cores.ts` — Selos de situação dos recebimentos de campo (`CORES_SITUACAO_RECEBIMENTO`), rótulos de origem de movimentos (`ROTULO_ORIGEM_MOVIMENTO`) e tipos de lançamento de caixa (`ROTULO_TIPO_LANCAMENTO_CAIXA`) no padrão visual de `STATUS_OS` (`src/utils/ordens.ts`).
- `src/components/financeiro/regrasFinanceiro.ts` — Funções puras de cálculo e formatação: datas em dia local (`diaLocalFinanceiro`, `extrairDiaLocal`, `deslocarDiaLocal`, `somarDiasUteisLocal`), cálculo de liquidação de cartão (`calcularLiquidacaoCartao`), saldo e diferença de caixa (`calcularSaldoEsperadoCaixa`, `calcularDiferencaCaixa`) e geração de CSV com BOM UTF-8 (`gerarCsvMovimentos`).
- `src/components/financeiro/dadosDemo.ts` — Massa de dados realista de demonstração em memória: 4 contas (`Caixa BRV (Loja)`, `Itaú`, `Caixa Econômica`, `Nubank`), 2 maquininhas (`Rede`, `InfinitePay`) com taxas de débito, crédito à vista e parcelado de `2x` a `12x`, 11 categorias financeiras (incluindo `'Venda loja'` e `'Serviço'`), 5 fornecedores com CPF/CNPJ sintéticos válidos, 60 movimentos nos últimos 75 dias (incluindo par de transferência entre contas e movimento estornado + lançamento de estorno), 5 recebimentos de técnicos em campo (`field_receipts`), 1 sessão de caixa aberta com 5 lançamentos e 3 fechamentos anteriores (incluindo sobra e falta justificadas).
- `src/components/financeiro/RegistrarRecebimentoModal.tsx` — Modal reaproveitável de registro de recebimento (`venda`, `os` ou `avulso`) com tabela compacta (uma linha por forma de pagamento, campos editáveis na célula), suporte a múltiplas formas de pagamento, cálculo de troco em espécie e liquidação/tarifa de cartão.
- `src/pages/FinanceiroVisaoGeral.tsx` — Tela `/financeiro` (Visão geral do módulo Financeiro, com diferenciação completa entre os níveis `completo`, `caixa` e `nenhum`, cartões no estilo de `CardsResumo.tsx`, gráfico de barras HTML/CSS dos últimos 30 dias no estilo de `GraficoAtividadesMes.tsx` e tabelas de dinheiro com técnicos e vendas a receber).
- `src/pages/FinanceiroCaixa.tsx` — Tela `/financeiro/caixa` (Abertura, reforço, retirada/sangria e fechamento do caixa físico da loja, com totais no rodapé da tabela e histórico de fechamentos anteriores).
- `src/pages/FinanceiroRecebimentos.tsx` — Tela `/financeiro/recebimentos` (Conferência dos valores recebidos pelos técnicos nas OS, resumo de dinheiro em mãos por técnico, visibilidade de pagamento parcial com `"Falta R$ X"`, confirmação em dinheiro/PIX ou cartão com cálculo de liquidação no dia útil seguinte e taxa como tarifa editável na hora, e registro de divergência).
- `src/pages/FinanceiroMovimentos.tsx` — Tela `/financeiro/movimentos` (Extrato imutável de entradas, saídas, transferências e estornos, restrito ao nível `completo`, com filtro de período `FiltroPeriodo.tsx`, seletor de fornecedor navegável por teclado via `useNavegacaoLista.ts`, saldo acumulado na conta, estorno com motivo obrigatório e exportação CSV).
- `src/pages/FinanceiroCadastros.tsx` — Tela `/financeiro/cadastros` (Cadastros de Contas, Maquininhas com tabela compacta linha a linha de taxas `2x` a `12x`, Categorias e Fornecedores com validação de CPF/CNPJ via `src/utils/documento.ts`, restrito ao nível `completo`).

### Arquivos alterados
- `src/types/financeiro.ts` — Expandido com todos os tipos da Rodada 2 (`FinancialAccount`, `SaveFinancialAccountInput`, `CardMachine`, `SaveCardMachineInput`, `FinancialCategory`, `SaveFinancialCategoryInput`, `Supplier`, `SaveSupplierInput`, `FinancialMovement`, `FinancialMovementFilter`, `FinancialMovementListResult`, `CreateManualMovementInput`, `CreateTransferInput`, `FieldReceipt`, `ConfirmFieldReceiptInput`, `TechnicianCashHolding`, `CashSession`, `CashSessionEntry`, `CreateCashEntryInput`, `CloseCashSessionInput`, `FinancialOverviewSummary`, `OrigemRecebimentoModal`, `LinhaRecebimentoInput`, `RegistrarRecebimentoInput`).
- `src/components/financeiro/fonteDeDados.ts` — Implementadas todas as funções assíncronas de contrato da seção 8 do briefing operando sobre cópias clonadas em memória (`FONTE_DADOS_FINANCEIRO_DEMO = true`).
- `src/components/vendas/VendaDetalhes.tsx` — Substituído o modal interno de recebimento pelo componente compartilhado `RegistrarRecebimentoModal` (seção 6.6).
- `src/components/Sidebar.tsx` — Adicionado o grupo **Financeiro** logo depois de **Placas** e antes de **Estoque**, protegido pela constante `const MOSTRAR_MENU_FINANCEIRO = false` e pelas regras de visibilidade por nível (`completo` vs `caixa`).
- `src/App.tsx` — Registradas as rotas privadas `/financeiro`, `/financeiro/caixa`, `/financeiro/recebimentos`, `/financeiro/movimentos` e `/financeiro/cadastros` dentro de `<Route element={<Layout />}>`.

---

## 2. Rotas adicionadas em `src/App.tsx` e onde cada uma está montada

Todas as rotas da Rodada 2 são privadas e estão montadas dentro de `<Route element={<ProtectedRoute />}>` → `<Route element={<Layout />}>`:

| Rota | Componente | Níveis com acesso |
|---|---|---|
| `/financeiro` | `src/pages/FinanceiroVisaoGeral.tsx` | `completo` e `caixa` (com visão reduzida) |
| `/financeiro/caixa` | `src/pages/FinanceiroCaixa.tsx` | `completo` e `caixa` |
| `/financeiro/recebimentos` | `src/pages/FinanceiroRecebimentos.tsx` | `completo` e `caixa` |
| `/financeiro/movimentos` | `src/pages/FinanceiroMovimentos.tsx` | Somente `completo` |
| `/financeiro/cadastros` | `src/pages/FinanceiroCadastros.tsx` | Somente `completo` |

> **Nota sobre navegação:** Conforme a regra 6 do `GEMINI.md` e a seção 6.0 do briefing, **não existe barra de abas no topo das páginas do Financeiro**. A navegação entre as telas é feita pelo menu lateral (`Sidebar.tsx`). No cabeçalho de cada página há apenas o seletor discreto `"Ver como: completo / caixa / nenhum"` (`src/components/vendas/NavegacaoVendas.tsx`), exibido somente enquanto `FONTE_DADOS_DEMO === true`.

---

## 3. Tipos TypeScript criados em `src/types/financeiro.ts`

```ts
export type FinancialAccessLevel = 'completo' | 'caixa' | 'nenhum';

export type FinancialPaymentMethod =
  | 'dinheiro'
  | 'pix'
  | 'debito'
  | 'credito'
  | 'boleto'
  | 'transferencia'
  | 'cheque';

export interface FinancialAccount {
  id: string;
  name: string;
  kind: 'caixa' | 'banco';
  initial_balance_cents: number;
  current_balance_cents: number;
  active: boolean;
}

export interface SaveFinancialAccountInput {
  id?: string;
  name: string;
  kind: 'caixa' | 'banco';
  initial_balance_cents: number;
  active: boolean;
}

export interface CardMachineInstallmentRate {
  installments: number;
  fee_percent: number;
}

export interface CardMachine {
  id: string;
  name: string;
  settlement_account_id: string;
  settlement_account_name: string;
  settlement_business_days: number;
  debit_fee_percent: number;
  credit_sight_fee_percent: number;
  credit_installment_rates: CardMachineInstallmentRate[];
  active: boolean;
}

export interface SaveCardMachineInput {
  id?: string;
  name: string;
  settlement_account_id: string;
  settlement_business_days: number;
  debit_fee_percent: number;
  credit_sight_fee_percent: number;
  credit_installment_rates: CardMachineInstallmentRate[];
  active: boolean;
}

export interface FinancialCategory {
  id: string;
  name: string;
  kind: 'receita' | 'despesa';
  active: boolean;
}

export interface SaveFinancialCategoryInput {
  id?: string;
  name: string;
  kind: 'receita' | 'despesa';
  active: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  person_type: PersonType;
  document: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
}

export interface SaveSupplierInput {
  id?: string;
  name: string;
  person_type: PersonType;
  document: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
}

export type FinancialMovementDirection = 'entrada' | 'saida';

export type FinancialOriginType =
  | 'venda'
  | 'os'
  | 'avulso'
  | 'transferencia'
  | 'caixa'
  | 'tarifa_cartao';

export interface FinancialMovement {
  id: string;
  occurred_date: string;
  created_at: string;
  direction: FinancialMovementDirection;
  amount_cents: number;
  account_id: string;
  account_name: string;
  category_id: string | null;
  category_name: string | null;
  method: FinancialPaymentMethod;
  origin_type: FinancialOriginType;
  origin_id: string | null;
  origin_label: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  customer_name: string | null;
  description: string;
  created_by_name: string;
  is_reversal: boolean;
  reverses_movement_id: string | null;
  reverses_description: string | null;
  reversed_by_movement_id: string | null;
  reversal_reason: string | null;
  transfer_pair_id: string | null;
  running_balance_cents?: number | null;
}

export interface FinancialMovementFilter {
  pagina?: number;
  busca?: string;
  contaId?: string;
  formaPagamento?: 'todas' | FinancialPaymentMethod;
  categoriaId?: string;
  origem?: 'todas' | 'venda' | 'os' | 'avulso' | 'transferencia';
  direcao?: 'todas' | 'entrada' | 'saida' | 'estornos';
  dataInicio?: string;
  dataFim?: string;
}

export interface FinancialMovementListResult {
  itens: FinancialMovement[];
  total: number;
  soma_entradas_cents: number;
  soma_saidas_cents: number;
  saldo_liquido_cents: number;
  saldo_atual_conta_cents: number | null;
}

export interface CreateManualMovementInput {
  direction: FinancialMovementDirection;
  occurred_date: string;
  account_id: string;
  category_id: string;
  method: FinancialPaymentMethod;
  amount_cents: number;
  description: string;
  supplier_id?: string | null;
}

export interface CreateTransferInput {
  occurred_date: string;
  from_account_id: string;
  to_account_id: string;
  amount_cents: number;
  description?: string;
}

export type FieldReceiptStatus = 'a_conferir' | 'confirmado' | 'divergente';

export interface FieldReceipt {
  id: string;
  service_order_id: string;
  service_order_number: number;
  customer_name: string;
  technician_id: string;
  technician_name: string;
  received_at: string;
  amount_cents: number;
  order_total_cents: number;
  method: 'dinheiro' | 'debito' | 'credito' | 'pix';
  installments: number;
  card_machine_id: string | null;
  card_machine_name: string | null;
  status: FieldReceiptStatus;
  notes: string | null;
  divergence_reason: string | null;
  confirmed_at: string | null;
  confirmed_by_name: string | null;
  settled_account_id: string | null;
  settled_account_name: string | null;
  settled_date: string | null;
  fee_cents: number | null;
}

export interface ConfirmFieldReceiptInput {
  account_id?: string;
  card_machine_id?: string;
  installments?: number;
  settlement_date?: string;
  fee_cents?: number;
  notes?: string;
}

export interface TechnicianCashHolding {
  technician_id: string;
  technician_name: string;
  receipts_count: number;
  total_cash_cents: number;
  oldest_received_at: string;
}

export type CashEntryKind = 'venda_dinheiro' | 'recebimento_os' | 'reforco' | 'sangria';

export interface CashSessionEntry {
  id: string;
  session_id: string;
  kind: CashEntryKind;
  direction: 'entrada' | 'saida';
  amount_cents: number;
  description: string;
  origin_label: string | null;
  created_by_name: string;
  created_at: string;
}

export interface CashSession {
  id: string;
  status: 'aberto' | 'fechado';
  opened_date: string;
  opened_at: string;
  opened_by_name: string;
  opening_balance_cents: number;
  entries_in_cents: number;
  entries_out_cents: number;
  expected_balance_cents: number;
  counted_balance_cents: number | null;
  difference_cents: number | null;
  difference_reason: string | null;
  closed_at: string | null;
  closed_by_name: string | null;
  entries: CashSessionEntry[];
}

export interface CreateCashEntryInput {
  kind: 'reforco' | 'sangria';
  amount_cents: number;
  description: string;
}

export interface CloseCashSessionInput {
  counted_balance_cents: number;
  difference_reason?: string;
}

export interface FinancialOverviewSummary {
  accounts: FinancialAccount[];
  total_accounts_balance_cents: number;
  pending_machines: PendingCardMachineBalance[];
  received_today_cents: number;
  received_today_by_method: Record<FinancialPaymentMethod, number>;
  received_month_cents: number;
  received_month_by_method: Record<FinancialPaymentMethod, number>;
  technician_cash_total_cents: number;
  technician_cash_list: TechnicianCashHolding[];
  pending_receipts_count: number;
  open_sales_total_cents: number;
  open_sales_count: number;
  open_sales_oldest: OpenSaleReceivableSummary[];
  daily_received_30d: DailyReceivedPoint[];
}

export interface OrigemRecebimentoModal {
  tipo: 'venda' | 'os' | 'avulso';
  id?: string;
  numero?: string;
  clienteNome: string;
  valorSugerido: number;
}

export interface LinhaRecebimentoInput {
  method: FinancialPaymentMethod;
  amount_cents: number;
  tendered_cents?: number | null;
  account_id?: string | null;
  card_machine_id?: string | null;
  installments?: number;
}

export interface RegistrarRecebimentoInput {
  origem: OrigemRecebimentoModal;
  occurred_date: string;
  category_id?: string | null;
  notes?: string | null;
  pagamentos: LinhaRecebimentoInput[];
}
```

---

## 4. Assinaturas das funções de `src/components/financeiro/fonteDeDados.ts`

```ts
export const FONTE_DADOS_FINANCEIRO_DEMO = true;

// Permissão e simulação de nível ("Ver como: completo / caixa / nenhum")
export function nivelFinanceiro(profile: Pick<Profile, 'role'> | null | undefined): FinancialAccessLevel;
export function useNivelFinanceiro(profile: Pick<Profile, 'role'> | null | undefined): {
  nivel: FinancialAccessLevel;
  sobrescrito: FinancialAccessLevel | null;
  definirSobrescrito: (n: FinancialAccessLevel | null) => void;
};
export function definirNivelFinanceiroDemo(nivel: FinancialAccessLevel | null): void;

// Visão geral (/financeiro)
export async function resumoFinanceiro(periodo?: {
  dataInicio?: string;
  dataFim?: string;
}): Promise<FinancialOverviewSummary>;

// Cadastros (/financeiro/cadastros)
export async function listarContas(): Promise<FinancialAccount[]>;
export async function salvarConta(dados: SaveFinancialAccountInput): Promise<FinancialAccount>;
export async function listarMaquininhas(): Promise<CardMachine[]>;
export async function salvarMaquininha(dados: SaveCardMachineInput): Promise<CardMachine>;
export async function listarCategorias(): Promise<FinancialCategory[]>;
export async function salvarCategoria(dados: SaveFinancialCategoryInput): Promise<FinancialCategory>;
export async function listarFornecedores(): Promise<Supplier[]>;
export async function salvarFornecedor(dados: SaveSupplierInput): Promise<Supplier>;

// Movimentos / extrato (/financeiro/movimentos)
export async function listarMovimentos(filtro?: FinancialMovementFilter): Promise<FinancialMovementListResult>;
export async function lancarMovimentoAvulso(dados: CreateManualMovementInput, atorNome?: string): Promise<FinancialMovement>;
export async function transferir(dados: CreateTransferInput, atorNome?: string): Promise<{ saida: FinancialMovement; entrada: FinancialMovement }>;
export async function estornarMovimento(id: string, motivo: string, atorNome?: string): Promise<FinancialMovement>;
export async function exportarMovimentosCsv(filtro?: FinancialMovementFilter): Promise<string>;

// Modal reaproveitável de recebimento (RegistrarRecebimentoModal)
export async function registrarRecebimento(dados: RegistrarRecebimentoInput, atorNome?: string): Promise<{ movimentos: FinancialMovement[] }>;

// Recebimentos a conferir dos técnicos (/financeiro/recebimentos)
export async function listarRecebimentosAConferir(): Promise<FieldReceipt[]>;
export async function dinheiroComTecnicos(): Promise<TechnicianCashHolding[]>;
export async function confirmarRecebimento(id: string, dados: ConfirmFieldReceiptInput, atorNome?: string): Promise<FieldReceipt>;
export async function recusarRecebimento(id: string, motivo: string, atorNome?: string): Promise<FieldReceipt>;

// Caixa físico da loja (/financeiro/caixa)
export async function situacaoCaixa(): Promise<CashSession | null>;
export async function abrirCaixa(valorInicialCentavos: number, atorNome?: string): Promise<CashSession>;
export async function registrarMovimentoCaixa(dados: CreateCashEntryInput, atorNome?: string): Promise<CashSession>;
export async function fecharCaixa(dados: CloseCashSessionInput, atorNome?: string): Promise<CashSession>;
export async function listarFechamentos(): Promise<CashSession[]>;
```

---

## 5. Regras de negócio implementadas no front-end

1. **Movimentos imutáveis e correção exclusivamente por estorno (`/financeiro/movimentos`)**:
   - Nenhuma linha do extrato possui botão de editar ou excluir.
   - `estornarMovimento(id, motivo)` exige motivo obrigatório, cria um movimento inverso (`direction` oposta, `is_reversal: true`, `reverses_movement_id: id`), marca o movimento original com `reversed_by_movement_id` (bloqueando segundo estorno) e, caso o movimento pertença a uma transferência (`transfer_pair_id`), estorna automaticamente a ponta par ligada na outra conta.
2. **Transferência entre contas (`transferir`)**:
   - Gera dois movimentos atômicos compartilhando o mesmo `transfer_pair_id`: saída na conta de origem e entrada na conta de destino, atualizando o saldo das duas contas sem inflar os totais de receitas de vendas/serviços.
3. **Liquidação de cartão no dia útil seguinte e taxa como tarifa (`calcularLiquidacaoCartao`)**:
   - Em `RegistrarRecebimentoModal` e na confirmação de recebimentos de técnicos (`confirmarRecebimento`), pagamentos em cartão de débito ou crédito calculam automaticamente a data do crédito na conta de liquidação da maquininha pulando sábado e domingo (`somarDiasUteisLocal(dataBase, settlement_business_days)`), lançam o **valor bruto** como entrada na conta da maquininha e lançam a **taxa como tarifa** (`origin_type: 'tarifa_cartao'`, editável na hora na confirmação de recebimento de técnico) como saída na mesma conta e data.
4. **Caixa físico da loja (`/financeiro/caixa`)**:
   - Permite apenas um caixa aberto por vez (`situacaoCaixa`).
   - Calcula em tempo real: $\text{Saldo esperado} = \text{Saldo inicial} + \text{Entradas em espécie} - \text{Saídas (sangrias)}$.
   - Recebimentos em dinheiro destinados ao `Caixa BRV (Loja)` (vindos de vendas, avulsos ou confirmação de dinheiro entregue por técnico) entram automaticamente nos lançamentos da sessão aberta do caixa.
   - No fechamento (`fecharCaixa`), se `counted_balance_cents !== expected_balance_cents`, o sistema calcula a diferença (sobra ou falta) e bloqueia o encerramento enquanto `difference_reason` não for preenchido.
5. **Visibilidade de pagamentos parciais (seção 6.0 item 6)**:
   - Em `/financeiro/recebimentos`, quando `rec.amount_cents < rec.order_total_cents`, a coluna de valor exibe o valor recebido pelo técnico e abaixo, em âmbar (`text-[11px] font-semibold text-amber-700`), `"Falta R$ X (OS R$ Y)"`.
   - Em `/financeiro`, a tabela `"Vendas a receber"` exibe quanto já foi pago (e a forma) e abaixo `"Falta R$ X"` em âmbar, com botão `"Receber"` que abre o `RegistrarRecebimentoModal`.
6. **Datas locais e dinheiro em centavos inteiros**:
   - Todas as datas financeiras usam `diaLocalFinanceiro()` (`getFullYear`, `getMonth() + 1`, `getDate()`), nunca `toISOString().slice(0, 10)`.
   - Todos os valores monetários trafegam em centavos inteiros (`*_cents`) com os helpers de `src/utils/dinheiro.ts`.

---

## 6. Como `nivelFinanceiro` foi implementado e o que cada tela esconde ou bloqueia

A função `nivelFinanceiro(profile)` e o hook reativo `useNivelFinanceiro(profile)` estão em `src/components/financeiro/fonteDeDados.ts`:
- Se `!profile` ou `profile.role` for `'tecnico'`, `'cliente'` ou `'oficina'`, retorna sempre `'nenhum'`.
- Enquanto `FONTE_DADOS_FINANCEIRO_DEMO === true`, respeita o valor escolhido no seletor discreto `"Ver como: completo / caixa / nenhum"` (`NavegacaoVendas.tsx`), compartilhado entre as telas de Vendas e Financeiro via `useSyncExternalStore`.
- Por padrão (sem sobrescrita): `admin` → `'completo'`; `escritorio` → `'caixa'`.

| Tela / Recurso | `completo` (Adriana / Braulio) | `caixa` (Jéssica / Pedro) | `nenhum` (Técnicos / outros) |
|---|---|---|---|
| `/financeiro` (Visão geral) | Vê saldos das contas bancárias, maquininhas a liquidar, recebido hoje, recebido no período, gráfico de 30 dias, dinheiro com técnicos e vendas a receber | Vê **apenas** Recebido hoje (por forma), Dinheiro com técnicos (com link para conferência), atalho do Caixa da loja e Vendas a receber. **Não vê** saldos bancários, maquininhas, total do mês nem gráfico de 30 dias | Bloqueado (`"Acesso restrito"`) |
| `/financeiro/caixa` | Acesso total (abrir, reforço, sangria, fechar e histórico) | Acesso total (abrir, reforço, sangria, fechar e histórico) | Bloqueado (`"Acesso restrito"`) |
| `/financeiro/recebimentos` | Acesso total (conferir, editar tarifa de cartão, confirmar e marcar divergência) | Acesso total (conferir, editar tarifa de cartão, confirmar e marcar divergência) | Bloqueado (`"Acesso restrito"`) |
| `/financeiro/movimentos` | Acesso total (extrato por conta, lançamento avulso, transferência, estorno e CSV) | Bloqueado (`"Acesso restrito"`) e oculto no menu lateral | Bloqueado (`"Acesso restrito"`) |
| `/financeiro/cadastros` | Acesso total (contas, maquininhas, categorias e fornecedores) | Bloqueado (`"Acesso restrito"`) e oculto no menu lateral | Bloqueado (`"Acesso restrito"`) |

---

## 7. Como testar cada fluxo com os dados de demonstração

1. **Alternar perfil (`Ver como`)**:
   - Em qualquer tela (`/financeiro`, `/financeiro/caixa`, `/financeiro/recebimentos`, `/financeiro/movimentos`, `/financeiro/cadastros`), use o seletor discreto `"Ver como: completo / caixa / nenhum"` no topo direito para verificar instantaneamente o que o perfil `caixa` vê em `/financeiro` e o bloqueio de `"Acesso restrito"` em `/financeiro/movimentos` e `/financeiro/cadastros`.
2. **Visão geral e recebimento de venda em aberto (`/financeiro`)**:
   - No perfil `completo`, clique em qualquer cartão de conta (`Caixa BRV (Loja)`, `Itaú`, `Caixa Econômica`, `Nubank`) para abrir `/financeiro/movimentos?conta=<id>` já filtrado por aquela conta com a coluna `"Saldo na conta"`.
   - Na tabela `"Vendas a receber"`, clique em **"Receber"** na venda parcial (`VEN-2026-0002`, que mostra o valor já pago e `"Falta R$ 650,00"`) ou clique em **"Receber avulso"** no cabeçalho para testar o `RegistrarRecebimentoModal` com múltiplas formas de pagamento na tabela compacta.
3. **Caixa da loja (`/financeiro/caixa`)**:
   - O caixa inicia aberto com saldo inicial de `R$ 200,00` e 5 lançamentos do dia.
   - Clique em **"Reforço"** ou **"Retirada (sangria)"** para adicionar um movimento em espécie e ver o rodapé da tabela e o extrato da conta `Caixa BRV (Loja)` atualizarem.
   - Clique em **"Fechar caixa"**: informe um valor diferente do esperado para verificar a exigência obrigatória de justificativa da diferença; depois reabra o caixa com **"Abrir caixa"**.
4. **Conferência de recebimentos dos técnicos (`/financeiro/recebimentos`)**:
   - Veja o quadro `"Dinheiro com técnicos ainda não entregue"` (Carlos Eduardo Silva e Marcos Vinícius Souza) e clique em **"Filtrar técnico"**.
   - Na linha da **OS #1045** (pagamento parcial de `R$ 220,00` em uma OS de `R$ 400,00`), observe o aviso `"Falta R$ 180,00 (OS R$ 400,00)"`.
   - Clique em **"Confirmar"** em um recebimento em cartão (**OS #1041** ou **OS #1047**): verifique o cálculo automático da data do crédito no **dia útil seguinte** e a **taxa como tarifa (R$)** editável na hora.
   - Clique em **"Divergência"** em um recebimento pendente para informar o motivo e marcá-lo como `Divergente`.
5. **Extrato, lançamento avulso, transferência, estorno e CSV (`/financeiro/movimentos`)**:
   - Clique em **"Lançamento avulso"**, mantenha `"Despesa (saída)"`, clique no campo `"Fornecedor (opcional)"` e navegue pelos fornecedores usando as **setas do teclado (`↓`/`↑`) e `Enter`** (`useNavegacaoLista.ts`).
   - Clique em **"Transferir"** para transferir um valor do `Caixa BRV (Loja)` para o `Itaú` e veja os dois lançamentos criados.
   - Clique em **"Estornar"** em qualquer movimento ativo (ou em uma das pontas de uma transferência), informe o motivo e verifique que o movimento original fica marcado como `"Já estornado"` (sem permitir segundo estorno) e o lançamento inverso `"Estorno"` aparece no topo.
   - Clique em **"Exportar CSV"** para baixar o arquivo `.csv` dos movimentos filtrados.
6. **Cadastros financeiros (`/financeiro/cadastros`)**:
   - Alterne no controle segmentado entre `Contas | Maquininhas | Categorias | Fornecedores`.
   - Em **Maquininhas**, clique em **"Editar"** na `Rede` ou `InfinitePay` para ver e editar a tabela compacta de taxas parceladas (`2x` a `12x`, uma linha por faixa).
   - Em **Fornecedores**, clique em **"Novo fornecedor"** e teste a máscara e validação de CPF/CNPJ (`documentoValido`).

---

## 8. O que falta para o Claude ligar ao Supabase

1. **Migrations SQL (`supabase/migrations/`)**:
   - Criar a coluna `profiles.financial_access text not null default 'nenhum' check (financial_access in ('nenhum', 'caixa', 'completo'))`.
   - Criar as tabelas `public.financial_accounts`, `public.card_machines`, `public.financial_categories`, `public.suppliers`, `public.financial_movements` (com trigger/RLS proibindo `UPDATE` de valores e `DELETE`, permitindo apenas atualizar `reversed_by_movement_id` e `reversal_reason` via função RPC de estorno), `public.field_receipts`, `public.cash_sessions` e `public.cash_session_entries`.
   - Semear as categorias padrão `'Venda loja'`, `'Serviço'` e `'Tarifa de cartão'` e as contas iniciais.
2. **Serviços do banco (`src/services/financeiro.ts`)**:
   - Implementar as consultas e RPCs equivalentes às funções de `src/components/financeiro/fonteDeDados.ts`, trocando `FONTE_DADOS_FINANCEIRO_DEMO` para `false`.
   - Conectar `nivelFinanceiro(profile)` à coluna `profile.financial_access`.
3. **Ativação no menu lateral (`src/components/Sidebar.tsx`)**:
   - Mudar `const MOSTRAR_MENU_FINANCEIRO = false;` para `true` (junto com `MOSTRAR_MENU_VENDAS = true`).

---

## 9. Confirmação de escopo e arquivos protegidos

Confirmo que **nenhum** arquivo fora do escopo autorizado foi alterado:
- Não foram alterados arquivos em `supabase/migrations/`, `supabase/functions/`, `src/services/`, `src/contexts/`, `src/components/ProtectedRoute.tsx`, `src/ajuda/`, `src/components/campo/`, `src/pages/campo/`, `public/sw.js`, `android/` ou `scripts/`.
- As telas da Rodada 1 (`Catalogo.tsx`, `Orcamentos.tsx`, `Vendas.tsx`, `OrcamentoPublico.tsx`) não foram alteradas, exceto pela integração do `RegistrarRecebimentoModal` em `src/components/vendas/VendaDetalhes.tsx` conforme solicitado na seção 6.6.
- Nenhum `git commit` ou `git push` foi executado.

---

## 10. Saída dos comandos de validação

```text
> brv-control@0.1.0 typecheck
> tsc -p tsconfig.json

> brv-control@0.1.0 lint
> oxlint

Found 0 warnings and 0 errors.
Finished in 312ms on 301 files with 116 rules using 28 threads.

> brv-control@0.1.0 build
> tsc -p tsconfig.json && vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 2296 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.83 kB │ gzip:   0.40 kB
dist/assets/index-bVkr2TOf.css    116.13 kB │ gzip:  18.48 kB
dist/assets/index-er-l-MqD.js   2,492.83 kB │ gzip: 586.25 kB
✓ built in 11.92s
```

