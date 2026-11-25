# Auditoria do Claude: rodada 1 (Catálogo, Orçamentos e Vendas)

Data: 2026-11-24. Entrega do Gemini: `docs/gemini/vendas-financeiro-r1.md` + 21 arquivos novos e 2 alterados.

## Resultado: aprovada

- **Escopo respeitado:** só arquivos novos em `components/vendas/`, `components/financeiro/`, `pages/` (Catalogo, Orcamentos, Vendas, OrcamentoPublico),
  `types/vendas.ts`, `types/financeiro.ts` e `utils/dinheiro.ts`; dos existentes, só `App.tsx` (rotas) e `Sidebar.tsx` (grupo Vendas escondido por
  `MOSTRAR_MENU_VENDAS = false`). Nada em `supabase/`, `services/`, `contexts/`, campo, `sw.js` ou `android/`.
- **typecheck, lint e build** limpos (rodados pelo Claude).
- **Conforme o briefing** (conferido no código): "Consumidor final" quando não há cliente (venda a receber exige cliente); validade padrão de 10 dias;
  dados da empresa de `EMPRESA_BRV`; rótulos fiscais certos (NFS-e no Portal Nacional, NFC-e/NF-e para produtos; `SaleDocumentModel` = `nfce | nfe | nfse`,
  `group` produtos/serviços); catálogo com NCM, CFOP, CSOSN, código de serviço e alíquota de ISS; listas paginadas; página pública sem custo, margem
  nem observação interna (`PublicQuoteView`); dinheiro em centavos inteiros (`utils/dinheiro.ts`).

## Atenção: o resumo `vendas-financeiro-r1.md` não bate com o código final

Partes do resumo descrevem uma versão anterior: fala em "26 funções" (o `fonteDeDados.ts` exporta 36), `doc_type 'nfse' | 'nfce'` sem `nfe` e sem `group`,
validade de 15 dias, "NFS-e Prefeitura de Niterói", "BRV Ar Condicionado" e "Braulio/Renato" no seletor de nível. **Nada disso está no código.**
Para as migrations e os services, **a fonte da verdade é o código**: `src/types/vendas.ts`, `src/types/financeiro.ts` e as assinaturas de
`src/components/vendas/fonteDeDados.ts` (e `components/financeiro/fonteDeDados.ts` para `nivelFinanceiro`). As seções 9 e 10 do resumo (nomes de botões e
textos) servem para a ajuda F1, conferindo cada nome na tela antes.

## Para a ligação ao banco (próximo passo do Claude)

- Os textos padrão do demo (`dadosDemo.ts`: "até 3 metros de linha", garantias, prazos) são **inventados**: na migration, semear com as observações reais do
  briefing (seção 1) e deixar o resto para o Braulio cadastrar.
- `profiles.financial_access` (`nenhum | caixa | completo`; admin = completo) entra junto, como já previsto em `docs/financeiro.md`.
- Funções públicas do orçamento no molde de `placa_orcamento_ver`/`placa_orcamento_aprovar` (token próprio, só aprova `enviado` dentro da validade).
- Ajuda F1 do módulo (regra fixa) antes de ligar o menu.

## Correção visual (2026-11-24, depois da reclamação "cara de IA")

Pedida em `docs/gemini/vendas-visual-correcao.md` e conferida pelo Claude: cabeçalhos iguais ao de Clientes, barra `NavegacaoVendas` reduzida a um `<select>`
"Ver como" que só aparece com `FONTE_DADOS_DEMO = true`, sem caixas de aviso, cartões de resumo nem pílulas com contador, filtros em barra única,
sem `shadow-lg`/`backdrop-blur`, animação só no `Loader2`; os textos pequenos que restaram são rótulos e códigos. ~840 linhas a menos. Typecheck, lint e build limpos.

**Teclado na busca do catálogo (Claude, pedido do Braulio):** `components/vendas/useNavegacaoLista.ts`, usado no editor de orçamento e na Nova venda:
↓/↑ percorrem as sugestões (o item marcado fica azul e rola para ficar visível), Enter adiciona o marcado, Esc fecha (antes só o Enter, sempre no primeiro).

**Para a ligação ao banco:** `OrcamentoEditor.tsx` importa `CLIENTES_DEMO_VENDAS` direto do `dadosDemo.ts` (dado de demonstração dentro do componente,
contra a regra do briefing): trocar pelo cliente real ao ligar o banco.
