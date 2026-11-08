# Tarefa para o Gemini: visual da Ajuda (F1) e do Manual

Leia antes: `GEMINI.md` e `CLAUDE.md`. Siga as regras do `GEMINI.md` (português, sem mexer em services/migrations, typecheck + lint + build).

## O que já existe (feito pelo Claude, funcionando)
A ajuda do operador já funciona. Só o **escritório e o admin** veem (técnico e cliente não).
- **F1** em qualquer tela do escritório abre um painel lateral com os tópicos daquela tela. O botão **Ajuda** no cabeçalho e o item
  **Ajuda (F1)** no menu fazem o mesmo. Esc fecha.
- O painel sabe quando a OS, o cadastro do cliente ou a "Nova atividade" estão abertos por cima de outra página
  (`useTelaAjuda` em `src/ajuda/contextoAjuda.ts`) e mostra a ajuda deles.
- **Manual completo** em `/ajuda` (`src/pages/Ajuda.tsx`): índice e todos os tópicos, com botão Imprimir/salvar PDF.

Arquivos:
| Arquivo | O que é | Pode mexer? |
|---|---|---|
| `src/ajuda/topicos.ts` | O **conteúdo** (textos, telas, sinônimos) | **Não.** O texto é do Claude: ele conhece as regras do sistema. Erro ou texto confuso: anote e avise o Braulio |
| `src/ajuda/contextoAjuda.ts`, `buscaAjuda.ts` | Lógica (qual tela, busca sem acento) | **Não** |
| `src/components/Layout.tsx` | Tecla F1 e abertura do painel | **Não** |
| `src/ajuda/AjudaPainel.tsx` | Painel lateral | **Sim, só o visual** |
| `src/ajuda/TextoAjuda.tsx` | Desenha o texto de um tópico (passos, listas, dica, atenção) | **Sim, só o visual** |
| `src/pages/Ajuda.tsx` | Manual completo | **Sim, só o visual** |

## O que pedimos
Deixar a ajuda com cara de "central de ajuda" bonita e fácil de ler, sem mudar o comportamento.

1. **Painel (`AjudaPainel.tsx`)**
   - Cabeçalho mais acolhedor: título "Ajuda" + nome da tela atual (já vem em `NOME_TELA[tela]`).
   - Lista "Nesta tela" com destaque (é o que o operador mais procura). As demais seções podem ser recolhíveis (fechadas por padrão).
   - Um ícone por seção (lucide-react; ex.: Users para Clientes, ClipboardList para OS, CalendarRange para Agenda, Star para Avaliação).
   - Transição suave ao abrir/fechar o painel e ao entrar/sair de um tópico (Tailwind/CSS, sem biblioteca nova).
   - No celular: painel em tela cheia, botões com área de toque boa.
2. **Texto do tópico (`TextoAjuda.tsx`)**
   - Passos numerados bem legíveis (o operador segue com o dedo na tela). Nome de botão/menu em **negrito** já vem marcado: pode
     estilizar como "etiqueta de botão" (fundo leve, borda), desde que continue legível.
   - Caixas "dica" (azul) e "atenção" (âmbar) já existem: refinar.
3. **Manual (`pages/Ajuda.tsx`)**
   - Capa simples (logo `/logobrvcontrol.png`, "Manual do BRV Control", data de hoje) visível **só na impressão**.
   - Impressão limpa: cada seção começando em página nova, sem sombras, sem botões, índice com os títulos.
   - Na tela: índice fixo na lateral em telas largas (opcional).

## Regras
- **Não mude** a lista de props, os nomes exportados, nem a lógica: o Esc é capturado antes da OS (`addEventListener(..., true)`
  com `stopImmediatePropagation`), não troque por `onKeyDown`.
- Mantenha `z-[90]`/`z-[91]` no painel: ele precisa ficar por cima da OS (`z-50`), da Nova atividade (`z-[60]`) e do visualizador de fotos (`z-[70]`).
- Mantenha os `print:hidden` do painel, do cabeçalho e do menu.
- Os textos dos tópicos não são escritos em JSX: vêm de `topicos.ts`. Não copie textos para dentro dos componentes.
- Sem bibliotecas novas.

## Fora do escopo
Mudar conteúdo, criar tópicos, ajuda no app do técnico (`/campo`) ou no portal do cliente.

## Entrega
`npm run typecheck`, `npm run lint` e `npm run build` sem erro nem aviso. Mexa só nos 3 arquivos marcados "Sim". Grave em
`docs/gemini/ajuda-resultado.md` um resumo do que mudou (arquivos e decisões), para o Claude auditar. Avise o Braulio ao terminar.
