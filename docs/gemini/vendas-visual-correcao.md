# Tarefa para o Gemini: corrigir o visual das telas de Vendas (rodada 1) para o padrão do BRV Control

Leia antes: `GEMINI.md` (seção **"Padrão visual (obrigatório)"**, nova) e `docs/gemini/vendas-financeiro-r1-auditoria.md`.
Mesmas regras de sempre: português, sem mexer em `supabase/`, `src/services/`, `src/contexts/`, campo, `sw.js`, `android/`; typecheck, lint e build sem erro nem
aviso; **sem commit nem push**.

## Por quê

O Braulio achou as telas da rodada 1 "com cara de IA": não parecem do mesmo sistema que Clientes e Ordens de Serviço. **É só visual: não mude regras,
contrato de dados (`fonteDeDados.ts`, `types/vendas.ts`, `types/financeiro.ts`), nomes de funções nem o comportamento.**

## O que mudar (arquivos da rodada 1: `pages/Catalogo.tsx`, `pages/Orcamentos.tsx`, `pages/Vendas.tsx`, `pages/OrcamentoPublico.tsx` e `components/vendas/*`)

1. **Cabeçalho** de Catálogo, Orçamentos e Vendas exatamente como o de `pages/Clientes.tsx` (título solto `text-2xl` em `slate-900`, uma linha de subtítulo,
   botão principal ao lado). Tirar o cartão em volta do título, o ícone em quadradinho e a cor da marca no título. Títulos: "Catálogo", "Orçamentos", "Vendas".
2. **Tirar `NavegacaoVendas`** como barra no topo das páginas: a navegação é pelo menu lateral. O seletor "Ver como" vira um `<select>` pequeno e discreto
   (canto do cabeçalho), só com `FONTE_DADOS_DEMO = true`.
3. **Tirar as caixas azuis de aviso** (ex.: "Vendas anteriores a 24/11/2026 ficam no cadastro...") e **as fileiras de cartões de resumo**. Onde o briefing
   pede um total (vendas do filtro), uma linha no rodapé da tabela.
4. **Filtros** numa barra única como em Clientes: busca + controle segmentado ou `<select>` para situação/origem/período. Tirar as pílulas com contador.
5. **Editor de orçamento e Nova venda**: estrutura e campos como `components/ordens/OrdemDetalhes.tsx` (mesma classe `INPUT`, mesmos rótulos curtos,
   mesmo cabeçalho fixo com Salvar). **Cortar as frases explicativas** embaixo de campos e seções (hoje são 17 no editor e 28 na Nova venda; em
   `OrdemDetalhes` há 1). Fica só aviso que muda a decisão (desconto acima do permitido, troco faltando, venda a receber sem cliente).
6. **Detalhes da venda, notas e modais**: como `OrdemDetalhes` (painel) e `NovaAtividadeModal` (modal pequeno). Sem animação além do `Loader2` ao carregar,
   sem `backdrop-blur`, sem `shadow-lg`/`xl`, `rounded-2xl` só em cartões de bloco.
7. **Página pública** `/orcamento/:token` e folha A4: no molde de `pages/OrcamentoPlacaPublico.tsx` e `components/placas/FolhaOrcamentoPlaca.tsx`.

## Entrega

Atualize `docs/gemini/vendas-financeiro-r1.md` com uma seção final **"Correção visual (2026-11-24)"**: arquivos alterados e o que saiu de cada tela.
Confira que **todo o resumo descreve o código final** (a auditoria achou trechos desatualizados: 26 funções, `doc_type` sem `nfe`, validade de 15 dias,
"Prefeitura de Niterói", "Renato"): corrija essas partes. Rodada 2 (Financeiro) segue as mesmas regras visuais desde o começo.
