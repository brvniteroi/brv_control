# Resumo para auditoria — Visual da Ajuda (F1) e do Manual

Documento de entrega referente a `docs/gemini/ajuda.md`.

---

## 1. Arquivos alterados

Foram alterados **exclusivamente** os 3 arquivos liberados no briefing (mais a criação deste resumo):

- `src/ajuda/AjudaPainel.tsx` — Painel lateral contextual acionado por `F1`, botão **Ajuda** do cabeçalho e menu.
- `src/ajuda/TextoAjuda.tsx` — Renderizador visual do texto estruturado dos tópicos (passos, listas, etiquetas de botão/atalho, dicas e avisos).
- `src/pages/Ajuda.tsx` — Página `/ajuda` do Manual completo (visual em tela com índice lateral fixo + versão dedicada para impressão/PDF).
- `docs/gemini/ajuda-resultado.md` — Este resumo de auditoria.

Nenhum outro arquivo foi modificado (`src/ajuda/topicos.ts`, `src/ajuda/contextoAjuda.ts`, `src/ajuda/buscaAjuda.ts`, `src/components/Layout.tsx`, `src/index.css`, `src/services/*` e `supabase/*` permanecem intactos). Nenhuma biblioteca nova foi adicionada.

---

## 2. O que mudou e decisões tomadas

### 2.1. Painel lateral (`src/ajuda/AjudaPainel.tsx`)
- **Cabeçalho acolhedor**: faixa superior no gradiente institucional (`from-brv-navy to-brv-navy-light`), ícone de ajuda, selo `F1` e indicação clara da tela atual (`NOME_TELA[tela]`).
- **Destaque para `"Nesta tela"`**: exibida no topo dentro de um cartão azul claro com ícone, nome da tela atual, contador de tópicos e botões destacados em fundo branco.
- **Demais seções recolhíveis (fechadas por padrão)**: agrupadas em `"Outros assuntos"` com `<h3><button type="button" aria-expanded={...}>` (preservando a hierarquia semântica de títulos e mantendo quais seções estavam abertas caso o operador entre num tópico e clique em **Voltar**).
- **Ícones por seção (`lucide-react`)**:
  - `Primeiros passos` → `Compass`
  - `Clientes` → `Users`
  - `Ordens de serviço` → `ClipboardList`
  - `Agenda dos técnicos` → `CalendarRange`
  - `Avaliação do cliente` → `Star`
  - `Cadastros` → `FolderOpen`
  - `Relatórios` → `FileBarChart`
  - `Equipe e acessos` → `UserCog`
  - `Dúvidas comuns` → `LifeBuoy`
- **Busca aprimorada**: envolvida em `<search>` semântico com `aria-label`, botão rápido para limpar o termo, exibição da seção e selo `"Nesta tela"` nos resultados e estado vazio amigável.
- **Transições suaves (CSS puro / Tailwind 4)**:
  - Abertura do painel e do fundo escuro com `@starting-style` (`starting:translate-x-full`, `starting:opacity-0`) animando apenas `translate` e `opacity`.
  - Fechamento suave com atributo `data-closing` aguardando `element.getAnimations()` (com timeout de segurança de `280ms`) antes de chamar `onFechar()`.
  - Entrada em tópico (`starting:translate-x-3 starting:opacity-0` com `key={aberto.id}`, que também garante rolagem no topo ao navegar por `"Veja também"`) e retorno para a lista (`starting:-translate-x-3 starting:opacity-0`).
  - Respeito integral a `prefers-reduced-motion: reduce` (`motion-reduce:*`).
- **Celular e áreas de toque**: painel em tela cheia no celular (`inset-0 h-dvh w-full`, passando a `sm:max-w-md` em telas maiores) e botões com altura mínima de toque confortável (`min-h-11`).
- **Regras técnicas preservadas**: assinatura de props e `export default` inalterados; captura do `Escape` em fase de captura (`window.addEventListener('keydown', aoTecla, true)` com `e.preventDefault()` e `e.stopImmediatePropagation()`); camadas `z-[90]` e `z-[91]`; `print:hidden` no fundo e no painel.

### 2.2. Texto dos tópicos (`src/ajuda/TextoAjuda.tsx`)
- **Passos numerados legíveis**: cada passo ganhou cartão leve com bom espaçamento vertical e selo circular azul de alto contraste para leitura guiada na tela, ficando limpo e sem fundo pesado na impressão (`print:*`).
- **Numeração contínua preservada**: `separar()` agora lê o número original da linha (`^(\d+)\.\s+(.*)$`) e passa `start` ao `<ol>`. Isso corrige visualmente tópicos que intercalam uma lista `- ...` no meio dos passos (como o tópico `agendar`, onde os passos `3.`, `4.` e `5.` aparecem logo após os subitens do passo `2.` e antes voltavam a exibir `1`, `2`, `3`).
- **Negrito como etiqueta de botão**: trechos `**...**` recebem fundo leve e borda sutil com `box-decoration-clone` (permitindo quebra de linha limpa em telas estreitas quando o destaque é uma frase mais longa, e adaptando contraste dentro de passos, dicas e alertas). As teclas `F1`, `Esc` e `F5` são renderizadas com `<kbd>`.
- **Caixas de `"Dica"` e `"Atenção"`**: refinadas com borda lateral destacada (`border-l-4`), ícone em destaque, prefixo textual explícito (`Dica:` / `Atenção:`) e estilo sóbrio com `print:break-inside-avoid` na impressão.

### 2.3. Manual completo (`src/pages/Ajuda.tsx`)
- **Na tela**:
  - Cabeçalho em estilo de central de ajuda com contagem total de tópicos e botão `"Imprimir / salvar PDF"`.
  - Em telas menores que `xl`: índice recolhível no topo para não empurrar o conteúdo no celular/tablet.
  - Em telas largas (`xl:`): layout em duas colunas com **índice lateral fixo** (`sticky top-0`) que acompanha e destaca automaticamente o tópico visível via `IntersectionObserver`, além de links `"Veja também"` no rodapé dos cartões que possuem tópicos relacionados.
- **Na impressão / PDF (nota importante para auditoria)**:
  - O arquivo global `src/index.css` define `@media print { body > #root { display: none !important; } }` (usado pelos portais de impressão de formulários e PMOC). Sem portal no `document.body` (ou sem alterar `src/index.css`, que estava fora dos arquivos permitidos), clicar em `"Imprimir / salvar PDF"` em `/ajuda` imprimiria página em branco.
  - Solução adotada dentro de `src/pages/Ajuda.tsx`: o contêiner de tela recebe `print:hidden` e uma árvore exclusiva de impressão é montada em `document.body` via `createPortal` (`hidden print:block`), **sem repetir os atributos `id` dos tópicos** para que a navegação por âncora (`/ajuda#<id>` via `document.getElementById`) continue apontando sempre para os elementos visíveis na tela.
  - **Capa exclusiva na impressão**: logotipo `/logobrvcontrol.png`, título `"Manual do BRV Control"`, subtítulo e data de emissão formatada com `formatarData` (`src/utils/ordens.ts`), ocupando a primeira folha (`break-after-page`).
  - **Paginação limpa**: índice com seções numeradas e títulos dos tópicos em duas colunas, seguido por cada seção iniciando em nova página (`break-before-page`), tópicos com `break-inside-avoid`, sem sombras e sem botões (`@page { size: A4 portrait; margin: 16mm 16mm 18mm 16mm; }`).

---

## 3. Observações sobre `src/ajuda/topicos.ts` (não alterado)

- Nenhum erro de regra de negócio ou texto confuso foi identificado na leitura dos tópicos; o conteúdo está consistente com `CLAUDE.md`.
- Único detalhe menor de interação para ciência: no tópico `usar-ajuda` consta `"**Esc** fecha a ajuda"`; quando um tópico específico está aberto no painel lateral, o primeiro `Esc` volta para a lista de tópicos e o segundo `Esc` fecha o painel (comportamento intencional já existente em `AjudaPainel.tsx`).

---

## 4. Verificação

Executados `npm run typecheck`, `npm run lint` e `npm run build`, todos concluídos sem erros e sem avisos (`0 warnings and 0 errors`).

