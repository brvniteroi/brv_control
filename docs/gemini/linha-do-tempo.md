# Tarefa para o Gemini: Linha do tempo (tela mais usada pelo escritório)

Leia antes: `GEMINI.md` e `CLAUDE.md`. Siga as regras do `GEMINI.md` (português, sem mexer em services/migrations, typecheck + lint + build).

## Objetivo
Substituir o placeholder `src/pages/LinhaDoTempo.tsx`. É a tela em que o escritório distribui o dia: **uma linha por técnico, horas na horizontal, uma barra por atividade**, que se arrasta para trocar horário ou técnico. Substitui a "Linha do tempo" do Field Control (referência: print em `docs/gemini/referencia-linha-do-tempo.png`). A equipe já está acostumada com ela: **mantenha o jeito de usar**, melhorando o visual.

É tela **de computador** (escritório). No celular, mostrar uma lista por técnico, sem arrastar.

## Dados e ações: já prontos, só use
`src/hooks/useLinhaDoTempo.ts`: `useLinhaDoTempo(dia)` com `dia` no formato `YYYY-MM-DD`. Devolve:
- `tecnicos`: `{ id, name, timeline_color }[]`, uma linha da grade para cada um.
- `atividades`: atividades do dia (`Task` + `ordem`): `id`, `title`, `status`, `employee_id`, `scheduled_start`, `scheduled_end` e `ordem` (`number`, `customer.name`, `service_type`, `local`, `priority`; pode ser `null` por instantes).
- `aAgendar`: atividades **sem horário** (fila "A agendar"), mesmo formato.
- `conflitos`: `Set` de ids que se sobrepõem a outra do mesmo técnico.
- `carregando`, `erro` (com "Tentar de novo" = `recarregar`), `erroAcao` (falha de mover; a grade já voltou sozinha ao estado anterior, só mostre a mensagem) e `limparErroAcao`.
- `agendar(id, { employee_id, scheduled_start, scheduled_end })`: põe/move a atividade (vinda da grade ou da fila). Atualiza a tela na hora; se o banco recusar, desfaz e lança `Error` em português.
- `desagendar(id)`: devolve a atividade para a fila.

`src/utils/linhaDoTempo.ts`: `dataLocal`, `somarDias`, `minutosDoDia(iso, dia)`, `isoDoDia(dia, minutos)`, `arredondarMinutos` (encaixe de 15 min, `PASSO_MINUTOS`), `formatarHora(minutos)`, `podeMover(atividade)`.

Tudo atualiza sozinho em tempo real (outra pessoa mexe, a grade muda). Não precisa de "atualizar periodicamente". Rótulos e cores de status: `infoStatusAtividade` em `utils/ordens.ts`. Abrir a OS ao clicar: `OrdemDetalhes` (ver uso em `pages/OrdensServico.tsx`).
Se faltar dado, **descreva ao Braulio**, não crie consulta.

## Entregas (uma por vez, nesta ordem)

### Entrega 1: a grade (só leitura)
- **Cabeçalho:** título "Linha do tempo", seletor de data com botões `‹` `›` e **"Hoje"**, botão "Atualizar" (`recarregar`), zoom (largura por hora: 3 níveis), filtro por técnico (mostrar só alguns) e interruptor "Mostrar canceladas" (desligado por padrão).
- **Grade:** coluna fixa à esquerda com os técnicos (círculo com a inicial na `timeline_color`, nome, e um resumo pequeno: "3 atividades · 5 h"). Régua de horas em cima, **de 07h às 19h por padrão**, rolagem horizontal se precisar, **cabeçalho da régua e coluna de técnicos fixos** na rolagem. Atividade fora desse intervalo estende a régua para caber.
- **Linha do "agora"** (vertical pontilhada verde) quando o dia é hoje, e rolar para perto dela ao abrir.
- **Barra da atividade:** posição e largura pelo horário. Cor por status (`status-agendada` azul, `status-execucao` laranja, `status-concluida` verde etc.; ver `index.css`). Texto: cliente em destaque e, abaixo, nº da OS, tipo e bairro (some o que não couber; tooltip com tudo ao passar o mouse). Atividade em `conflitos`: borda vermelha e ícone de alerta. Cancelada: riscada e esmaecida. Prioridade urgente: marca discreta.
- Clicar numa barra abre a OS (`OrdemDetalhes`).
- Estados: carregando (esqueleto), erro com "Tentar de novo", vazio ("Nenhuma atividade neste dia"). Se não houver técnico, avisar para cadastrar em Equipe.
- Atividades de um dia que passam da meia-noite: cortar no limite do dia.

### Entrega 2: arrastar e redimensionar
**Não use `@hello-pangea/dnd`**: ele só serve para listas, não para posicionar por horário. Use **eventos de ponteiro** (`onPointerDown/Move/Up` com `setPointerCapture`), sem biblioteca nova.
- **Mover:** arrastar a barra muda o horário (horizontal, encaixe de 15 min com `arredondarMinutos`) e/ou o técnico (vertical, solta na linha do técnico). Duração se mantém.
- **Redimensionar:** alças nas bordas esquerda e direita mudam início/fim (mínimo 15 min).
- **Enquanto arrasta:** sombra da posição de destino e uma etiqueta com o horário ("09:30 – 11:00") e o técnico; destacar a linha do técnico sob o cursor. `Esc` cancela. Passar de 5 px para considerar arrasto (senão é clique e abre a OS).
- **Ao soltar:** chamar `agendar(...)`. Se lançar erro, mostrar a mensagem (aviso no topo, some sozinho) e nada mais: a grade já voltou.
- **Só se move o que `podeMover`** (pendente ou agendada). Em execução, concluída, etc.: sem alças, cursor normal e tooltip "Atividade já iniciada".
- **Conflito não bloqueia**, só avisa: bordas vermelhas aparecem na hora, vindo de `conflitos`.
- Não deixar arrastar para fora de 00:00–24:00 do dia mostrado.

### Entrega 3: fila "A agendar" e nova atividade
- **Painel "A agendar"** (lateral recolhível ou faixa inferior) com as atividades de `aAgendar`: cliente, nº da OS, tipo, local e tempo previsto. Busca por cliente/OS.
- **Arrastar da fila para a grade** agenda: horário = onde soltou (encaixe de 15 min), técnico = linha em que soltou, duração = `ordem.service_type.default_duration_minutes ?? 60`. Mesmo tratamento de erro da Entrega 2.
- **Arrastar uma barra da grade de volta para o painel** chama `desagendar`.
- Botão **"+ Nova atividade"**: escolher uma OS (busca por nº ou cliente via `listarOrdens` de `services/ordens.ts`), título (sugerir o tipo da OS), técnico, data e hora; salvar com `salvarAtividade`. Se não informar técnico/horário, a atividade entra na fila "A agendar".

### Entrega 4: acabamento
- Faixa cinza fina **entre duas atividades do mesmo técnico** (tempo livre/deslocamento), como no Field Control.
- Atalhos: `←`/`→` mudam o dia, `T` volta para hoje.
- Lembrar a escolha de zoom e o painel aberto/fechado (`localStorage`).
- Impressão do dia (`@media print`: grade sem botões), se sobrar tempo.

## Regras
- Só escritório e admin usam esta tela. Redirecionar/avisar técnico (copie como `pages/Formularios.tsx` faz) e esconder o item do menu com `apenasEscritorio` em `Sidebar.tsx`.
- Visual: mesma identidade das outras telas (`GEMINI.md`). Densidade alta: é uma tela de trabalho, não de vitrine. Letras legíveis a 100% de zoom em tela de 1366 px.
- Desempenho: dezenas de barras; evite renderizar tudo de novo a cada pixel do arrasto (guarde a posição do arrasto num estado/ref só do item arrastado).
- Sem bibliotecas novas. Datas sempre via `utils/linhaDoTempo.ts` ou `utils/ordens.ts` (nunca ISO cru na tela).

## Fora do escopo
Mapa e rota do dia (botão de rota do Field Control), visão semanal/mensal (Calendário), criação de OS, status da OS derivado das atividades.

## Entrega
`npm run typecheck`, `npm run lint` e `npm run build` sem erro nem aviso. Mexa só em `src/pages/LinhaDoTempo.tsx`, `src/components/linhaDoTempo/` e `src/components/Sidebar.tsx` (só o `apenasEscritorio`). Avise o Braulio a cada entrega.
