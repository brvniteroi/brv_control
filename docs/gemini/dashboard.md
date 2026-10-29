# Tarefa para o Gemini: tela de Dashboard

Leia antes: `GEMINI.md` e `CLAUDE.md`. Siga as regras do `GEMINI.md` (português, sem mexer em services/migrations, typecheck + lint + build).

## Objetivo
Trocar o placeholder `src/pages/Dashboard.tsx` (hoje só `EmConstrucao`) por um painel de visão geral do dia: números das OS, atividades de hoje e OS que precisam de atenção. É a primeira tela depois do login, então deve ser rápida de ler no celular.

## Padrão a copiar
Estados de carregando/erro/vazio e estilo de cartões: `src/pages/Clientes.tsx`, `src/pages/Equipamentos.tsx`. Componentes novos em `src/components/dashboard/`. Rótulos e cores prontos em `src/utils/ordens.ts`: `infoStatusOS`, `infoStatusAtividade`, `PRIORIDADES`, `formatarData`, `formatarDataHora`. Reutilize, não recrie.

## Dados: use somente `src/services/dashboard.ts` (já pronto)
`carregarDashboard()` devolve:
- `resumo.porStatus`: contagem de OS por status (`aberta`, `agendada`, `em_andamento`, `pausada`, `concluida`, `cancelada`).
- `resumo.atrasadas`: OS abertas com prazo vencido.
- `resumo.urgentes`: OS abertas com prioridade alta ou urgente.
- `resumo.concluidas30dias`: OS concluídas nos últimos 30 dias.
- `atividadesHoje`: lista ordenada por horário, com `title`, `status`, `scheduled_start/end`, `employee` (técnico) e `service_order` (`number`, `customer.name`). Pode vir vazia.
- `precisamAtencao`: até 10 OS (`number`, `status`, `priority`, `due_date`, `customer`).

Se faltar algum dado, **descreva ao Braulio**, não crie consulta.

## Layout sugerido
1. **Cabeçalho**: "Olá, {primeiro nome}" (via `useAuth`) e a data de hoje por extenso. Botão "Atualizar".
2. **Cartões de números** (grade 2 colunas no celular, 4 no desktop): OS em aberto (soma de aberta + agendada + em andamento + pausada), Em andamento, Atrasadas (destaque vermelho se > 0), Urgentes (destaque âmbar se > 0). Cada cartão clica para `/ordens-de-servico`. Uma linha menor: "{n} concluídas nos últimos 30 dias".
3. **Atividades de hoje**: lista por horário (hora início–fim, título, técnico, cliente, selo de status da atividade). Linha clicável leva à OS. Agrupar por técnico é opcional; se fizer, manter simples. Vazio: "Nenhuma atividade agendada para hoje".
4. **Precisam de atenção**: lista das OS de `precisamAtencao` com nº, cliente, selo de prioridade e prazo (em vermelho se vencido). Vazio: "Tudo em dia".

## Regras
- Carregando (esqueleto ou spinner), erro com "Tentar de novo" e vazios como acima.
- Os números mostram o que o usuário pode ver (o banco já filtra por permissão; técnico só enxerga o que é dele). Não escreva texto que suponha ver tudo.
- Sem bibliotecas de gráfico. Se quiser uma barra de proporção por status, faça com divs e Tailwind.
- Datas e horas com `utils/ordens.ts` ou `toLocaleTimeString('pt-BR')`. Nunca mostrar data ISO crua.
- Atualização automática não é necessária; basta o botão "Atualizar" e recarregar ao abrir.

## Fora do escopo
Mapa, gráficos históricos, filtros por período, Realtime. Ficam para depois.

## Entrega
`npm run typecheck`, `npm run lint` e `npm run build` sem erro nem aviso. Mexa só em `src/pages/Dashboard.tsx` e `src/components/dashboard/`. Avise o Braulio ao terminar.
