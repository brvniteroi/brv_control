# Tarefa para o Gemini: formulários de campo

Leia antes: `GEMINI.md` e `CLAUDE.md`. Siga as regras do `GEMINI.md` (português, sem mexer em services/migrations, typecheck + lint + build).

## Contexto
O escritório monta **modelos** de formulário (orçamento de instalação, carga de gás, e no futuro o checklist de PMOC). O **técnico preenche na rua, no celular**, dentro de uma atividade. O operador da loja lê a resposta para montar o orçamento do cliente. Substitui os formulários do Field Control.

Migration `20261029160000_formularios.sql` (**o Braulio precisa rodar no Supabase antes de testar**) cria as tabelas e já cadastra 3 modelos.

## Dados e regras: já prontos, só use
- `src/types/formularios.ts`: tipos (`Pergunta`, `Respostas`, `ModeloFormulario`, `FormularioRespondido`). Leia os comentários.
- `src/services/formularios.ts`: `listarModelos`, `salvarModelo`, `listarFormulariosDaAtividade`, `listarFormulariosDaOrdem`, `buscarFormulario`, `abrirFormulario`, `salvarRespostas`, `excluirFormulario`, `buscarAnexosPorIds`.
- `src/utils/formularios.ts`: `perguntasVisiveis`, `validarRespostas`, `limparRespostasOcultas`, `novoIdPergunta`, `TIPOS_PERGUNTA`, `respostaVazia`. **A lógica de "pergunta condicional" e de obrigatória está aí: não reimplemente.**
- Fotos e assinatura: `anexarFoto(arquivo, { taskId, category })` em `src/services/anexos.ts` (use `category: 'assinatura'` na assinatura). A resposta guarda o `id` do anexo retornado (foto = lista de ids, assinatura = um id).

## Entrega 1: preenchimento pelo técnico (a mais importante, celular primeiro)
Componente `src/components/formularios/PreencherFormulario.tsx` (+ o que precisar na mesma pasta), recebendo o `FormularioRespondido`.
- Uma pergunta por bloco, campos grandes (dedo, sol na rua). Renderizar por `type`: `text`, `textarea`, `number` (com `unit` ao lado), `single` (botões grandes tipo rádio), `dropdown` (select), `multi` (caixas de marcar), `date`, `photo` (câmera/galeria, várias, miniaturas com remover), `signature` (quadro para assinar com o dedo, gera PNG e envia como `File`; botão "Limpar").
- Mostrar só `perguntasVisiveis(questions, answers)`; ao esconder uma pergunta, as respostas dela são descartadas ao salvar (`limparRespostasOcultas`).
- Botão "Salvar rascunho" (status `pendente`, sem validar) e "Concluir" (valida com `validarRespostas`, mostra o erro em cada pergunta, rola até a primeira; status `preenchido`).
- Formulário já `preenchido`: abrir em leitura, com botão "Editar" (volta a permitir alterar e salvar).
- Avisar se sair com alterações não salvas. Enviar foto mostra progresso; falha mostra "Tentar de novo" sem perder o resto.

## Entrega 2: formulários dentro da atividade
Em `src/components/ordens/AtividadesOS.tsx`, em cada atividade: lista dos formulários dela (nome, selo "Pendente" ou "Preenchido em {data e hora}", abrir) e botão "Adicionar formulário" (escolhe entre `listarModelos(true)`; opcionalmente o equipamento do cliente). Abrir leva ao preenchimento (modal ou tela, como for mais simples no celular). Estados de carregando, erro e vazio ("Nenhum formulário nesta atividade").

## Entrega 3: leitura e impressão (operador da loja)
`VisualizarFormulario.tsx`: só leitura, mostra apenas perguntas visíveis e respondidas ("Sem resposta" em cinza para as vazias), fotos em miniaturas (`buscarAnexosPorIds`) que abrem ampliadas. Botão "Imprimir / PDF" usando `window.print()` com CSS de impressão (`@media print`): cabeçalho com nome do formulário, cliente, OS e data de preenchimento; sem menus e botões. Também deve aparecer na OS (`listarFormulariosDaOrdem`), com o nome do técnico e a data.

## Entrega 4: construtor de modelos (só escritório e admin)
Página `/formularios` (rota em `App.tsx` e item no menu, visível só para escritório/admin; copie como o menu já esconde itens).
- Lista de modelos com busca, selo ativo/inativo, "Novo modelo".
- Editor: nome, descrição, ativo, lista de perguntas com **reordenar (subir/descer)**, duplicar, remover. Cada pergunta: tipo (`TIPOS_PERGUNTA`), título, ajuda, obrigatória, opções (para single/dropdown/multi, adicionar/remover/reordenar), unidade (number) e "Mostrar só se" (escolhe uma pergunta **anterior** de escolha e quais opções). O `id` vem de `novoIdPergunta` na criação e **nunca muda depois**.
- Aviso fixo: "Alterar o modelo não muda formulários já preenchidos."
- Validar antes de salvar: nome, ao menos 1 pergunta, título em todas, ao menos 2 opções nas de escolha, sem opção repetida.

## Regras
- Técnico só vê o que é dele (o banco já filtra). Escritório vê tudo.
- Funciona no celular; o construtor pode priorizar desktop, mas sem quebrar no celular.
- Sem bibliotecas novas (assinatura: canvas simples). Se precisar de dado que não existe em `services`, **descreva ao Braulio**.
- Datas com `utils/ordens.ts`, nunca ISO cru.

## Fora do escopo
Orçamento com valores, contrato e PMOC (virão depois, usando este mesmo motor). Edição de respostas de outro técnico. Realtime.

## Ordem sugerida
Entrega 1, depois 2 e 3, por último 4 (os 3 modelos já estão no banco, então dá para testar sem o construtor).

## Entrega
`npm run typecheck`, `npm run lint` e `npm run build` sem erro nem aviso. Mexa só em `src/components/formularios/`, `src/pages/Formularios.tsx`, `src/components/ordens/AtividadesOS.tsx`, `src/components/ordens/OrdemDetalhes.tsx` (se for exibir na OS), `src/App.tsx` e `src/components/Sidebar.tsx`. Avise o Braulio ao terminar.
