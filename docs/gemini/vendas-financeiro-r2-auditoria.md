# Auditoria do Claude: rodada 2 (Financeiro)

Data: 2026-11-24. Entrega do Gemini: `docs/gemini/vendas-financeiro-r2.md` + 10 arquivos novos e 6 alterados.

## Resultado: aprovada

- **Escopo respeitado:** telas novas em `pages/Financeiro*.tsx` (Visão geral, Caixa, Recebimentos, Movimentos, Cadastros), `components/financeiro/`
  (`RegistrarRecebimentoModal`, `cores`, `dadosDemo`, `regrasFinanceiro`, `fonteDeDados`), `types/financeiro.ts`, `utils/dinheiro.ts`; dos existentes, só
  `App.tsx` (rotas), `Sidebar.tsx` (grupo Financeiro escondido por `MOSTRAR_MENU_FINANCEIRO = false`) e `vendas/VendaDetalhes.tsx` (o recebimento da venda passou a
  usar o `RegistrarRecebimentoModal`, como pedia a seção 6.6). Nada em `supabase/`, `services/`, `contexts/`, `src/ajuda/`, campo, `sw.js` ou `android/`.
- **typecheck, lint e build** limpos (rodados pelo Claude).
- **Padrão visual (seção 6.0 e `GEMINI.md`) cumprido**, conferido no código: cabeçalho igual ao de Clientes em todas as telas; **sem barra de abas** (navegação
  pelo menu); "Ver como" reaproveitando `NavegacaoVendas`; cartões só na Visão geral, no estilo de `CardsResumo`; sem `shadow-lg/xl`, `backdrop-blur`, gradiente
  nem animação além do `Loader2`; `FiltroPeriodo` em Movimentos e na Visão geral; `useNavegacaoLista` no fornecedor do lançamento avulso; "Falta R$ X" nos
  recebimentos parciais e nas vendas a receber; datas pelo dia local (nenhum `toISOString`).
- **Regras conferidas:** movimento sem editar/excluir (só estorno, sem estorno duplo; estorno de transferência leva a outra ponta); transferência = dois
  movimentos ligados; cartão = bruto na conta da maquininha no dia útil seguinte + taxa como tarifa ajustável; um caixa aberto por vez; fechamento com
  diferença exige justificativa; nível `caixa` não vê saldos, Movimentos nem Cadastros.

## Ajustes do Claude na auditoria

- Menu: grupo **Financeiro logo abaixo de Vendas** (o briefing antigo pedia depois de Placas) e o item das Placas renomeado para **"Financeiro das placas"**
  (ajuda F1 `placas-financeiro` atualizada), para não haver dois itens "Financeiro".

## Para a ligação ao banco

- Tabelas que o Gemini supôs (seção 8 do resumo): `profiles.financial_access`, `financial_accounts`, `card_machines` (taxas parceladas como lista
  `installments/fee_percent`), `financial_categories`, `suppliers`, `financial_movements` (imutável; `reversed_by_movement_id`, `transfer_pair_id`),
  `field_receipts`, `cash_sessions`, `cash_session_entries`. Conferir contra o modelo de `docs/financeiro.md` ("Modelo e regras"): lá o saldo e o valor pago
  são **calculados a partir dos movimentos, nunca gravados** (o tipo tem `current_balance_cents`: vira campo calculado na view, não coluna).
- `FieldReceipt.method` não tem `pix` no app de campo ainda (a Etapa B decide); o demo aceita.
- `registrarRecebimento` do demo chama `receberSaldoVenda` de Vendas: no banco, uma RPC só (recebimento + baixa da venda na mesma transação).
- Ajuda F1 do Financeiro (regra fixa) antes de ligar o menu: as seções 7 e 9 do resumo têm os nomes de botões.
