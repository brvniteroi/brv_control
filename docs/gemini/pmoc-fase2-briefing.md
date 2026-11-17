# Tarefa para o Gemini: PMOC, fases 2 e 3 (telas)

Leia antes: `GEMINI.md`, `CLAUDE.md` e **`docs/pmoc.md`** (plano do módulo, com as decisões do usuário). Siga as regras do `GEMINI.md`
(português em tudo, sem mexer em `supabase/` nem `src/services/`, `typecheck` + `lint` + `build` sem erro nem aviso, **sem commit e sem push**).

## 0. Situação atual (não refaça)

A fase 1 está pronta e no ar: as telas do PMOC que você fez (lista `/pmoc`, editor `/pmoc/:id`, documento, relatório mensal, modelo de tarefas)
**já estão ligadas ao banco** pelo Claude. A camada de dados das telas continua sendo `src/components/pmoc/fonteDeDados.ts`, agora com
`USAR_BANCO_PMOC = true`: cada função repassa para `src/services/pmoc.ts` (banco) ou, com `false`, para os dados de demonstração.

Neste trabalho você entrega as **telas novas** das fases 2 e 3. O banco e as funções do servidor são do Claude e vêm depois, como na fase 1:
você trabalha contra **funções novas de demonstração** (seção 4) e grava o resumo para auditoria (seção 8).

Decisões do usuário que valem aqui (detalhes em `docs/pmoc.md`):
- O aparelho do plano é o do cadastro do cliente (`equipments`).
- **OS do mês por botão**: o escritório escolhe técnico, data e hora na hora de gerar. O sistema **não** cria OS sozinho.
- **Checklist próprio do PMOC** no app do técnico, por aparelho (não o motor de formulários).
- **Sem assinatura**: ao concluir a visita, o técnico informa só o **nome de quem acompanhou a visita** (obrigatório).
- **Relatório mensal por link** (página pública, sem login), enviado pelo escritório pelo WhatsApp.
- **QR Code por aparelho** com página pública do histórico (fase 3).
- Uma atividade por OS e toda atividade nasce **agendada, com técnico, data e hora** (regra geral do sistema).

## 1. Contexto do fluxo mensal

Todo mês, para cada plano **vigente**: o escritório gera a OS de PMOC do mês (com técnico, data e hora) → o técnico abre a atividade no
celular e preenche, aparelho por aparelho, as tarefas previstas para aquele mês (as tarefas e a periodicidade vêm do cronograma do plano),
as medições pedidas e as fotos → conclui a visita informando quem acompanhou → o escritório envia o link do relatório do mês ao cliente.
A grade da aba **Execução** do editor mostra, por aparelho e mês: Prevista, Concluída, Atrasada, Não se aplica.

## 2. Telas a entregar

### Entrega 1: "Gerar OS do mês" (escritório)
- **Modal `GerarOsMesPmocModal.tsx`** (em `src/components/pmoc/`), aberto pelo botão **"Gerar OS do mês"** da aba Execução (troque o
  comportamento atual) e pelo painel da Entrega 2. Mostra: plano (código e cliente), **mês de referência** (padrão: o mês atual, se estiver
  na vigência), a lista dos aparelhos que têm tarefa naquele mês (letra, nome, identificador, ambiente, quantas tarefas) e os campos
  **técnico** (só técnicos ativos: `listarTecnicos` de `src/services/ordens.ts`), **data**, **hora** e **duração prevista** (obrigatória;
  sugira 30 min por aparelho, editável). Botão **"Gerar OS e agendar"** (com "Gerando..." e bloqueio de clique duplo).
- Se o mês já tiver OS, o modal mostra **"OS #N já gerada para este mês"** com técnico/data e o link **"Abrir OS"** (não deixa gerar outra).
- Mês sem nenhuma tarefa prevista: mensagem clara e botão desabilitado.

### Entrega 2: painel "PMOC do mês" (escritório)
- Na página `/pmoc` (`src/pages/Pmoc.tsx`), uma **segunda aba ou seção "PMOC do mês"** ao lado da lista de planos, com seletor de mês
  (padrão: mês atual). Lista os planos **vigentes** que têm visita prevista no mês, com a situação: **Sem OS** (âmbar, botão "Gerar OS do mês"
  que abre o modal da Entrega 1), **OS agendada** (azul, mostra OS, técnico e data), **Executada** (verde, botão "Relatório do mês"),
  **Atrasada** (vermelho: mês passado sem execução). Resumo no topo: quantos sem OS, agendados, executados e atrasados no mês.
- **Cartão no Dashboard** (`src/components/dashboard/`, só admin/escritório): "PMOC do mês" com os mesmos 4 números e clique que leva ao painel.
  Se não houver nenhum plano vigente, o cartão não aparece.

### Entrega 3: checklist do PMOC no app do técnico (`/campo`)
O app de campo é usado no celular (tela pequena, luvas, sol): botões grandes, pouco texto, nada de tabela.
- Em `src/pages/campo/CampoAtividade.tsx`, **quando a OS da atividade for de PMOC** (a fonte de dados diz; ver seção 4), mostrar a seção
  **"Checklist PMOC"** acima de Fotos e Formulários: progresso ("3 de 5 aparelhos"), e a lista dos aparelhos do mês (letra, nome,
  identificador, ambiente) com o estado de cada um: **Pendente**, **Feito**, **Não atendido**.
- Tocar num aparelho abre a tela/painel do aparelho (componente novo em `src/components/campo/pmoc/`):
  - as **tarefas previstas no mês** (só as do mês; descrição e periodicidade), cada uma com 3 botões grandes **Feito / Não feito / Não se aplica**
    e, se **Não feito**, observação obrigatória;
  - as **medições** pedidas pelas tarefas do mês (corrente em A; temperaturas de insuflamento, retorno e ambiente em °C), teclado numérico,
    vírgula ou ponto, faixa plausível (ex.: 0 a 100 A; -10 a 60 °C) com aviso, obrigatórias quando a tarefa pede;
  - **observações do aparelho** (texto livre) e **fotos do aparelho** (reutilize `src/components/comum/BotoesFoto.tsx`: câmera e galeria);
  - botão **"Aparelho não atendido"** com motivo obrigatório (ex.: desligado, sem acesso, cliente pediu para não mexer);
  - **"Salvar aparelho"** (grava e volta para a lista).
- **Concluir a atividade** (`ConcluirAtividadeModal.tsx`): numa atividade de PMOC, só libera quando **todos os aparelhos** estiverem Feito ou
  Não atendido, e pede o campo obrigatório **"Nome de quem acompanhou a visita"** (decisão do usuário: sem assinatura). O relato do técnico
  continua como hoje.
- **Sem internet**: nesta fase o checklist do PMOC precisa de conexão. Sem internet, mostre o aviso "O checklist do PMOC precisa de internet"
  e desabilite os botões de salvar (o resto do app continua funcionando como hoje).
- Não altere o comportamento das atividades que **não** são de PMOC.

### Entrega 4: relatório mensal por link (público) e envio pelo WhatsApp
- **Página pública** `/relatorio-pmoc/:token` (`src/pages/RelatorioPmocPublico.tsx`, **sem login**, focada em celular, como
  `src/pages/AcompanhamentoPlaca.tsx` e `src/pages/OrcamentoPlacaPublico.tsx`): mostra o relatório do mês reaproveitando o conteúdo de
  `RelatorioExecucaoPmoc.tsx` (separe o "corpo" do relatório num componente que as duas telas usem), com o botão **"Salvar em PDF / Imprimir"**.
  Token inválido: mensagem amigável. Nunca mostrar valores nem dados internos.
- No relatório (as duas versões), acrescente: **"Visita acompanhada por: {nome}"**, a **galeria de fotos** de cada aparelho e um **QR Code
  de conferência** que aponta para o próprio link (use uma biblioteca só se já existir no projeto; se não existir, deixe um espaço reservado
  "QR de conferência" e descreva no resumo o que faltou).
- Na aba **Execução** e no painel do mês: botão **"Enviar relatório pelo WhatsApp"** para mês executado: pede o link à fonte de dados, abre o
  WhatsApp (`wa.me`) com o texto pronto ("Olá, {cliente}! Segue o relatório da manutenção do PMOC de {mês/ano}: {link}") para o telefone do
  cliente do plano. Use `prepararJanelaWhatsApp` de `src/components/placas/regrasPlacas.ts` (abre a aba já no clique, para o navegador não
  bloquear) e o texto numa função em `regrasPmoc.ts`. Também **"Copiar link"**.

### Entrega 5 (fase 3): QR Code do aparelho
- **Página pública** `/equipamento/:token` (`src/pages/EquipamentoPublico.tsx`, sem login, celular), aberta pelo QR colado no aparelho:
  logo da BRV, **nome fantasia do cliente** (nunca CPF/CNPJ, telefone ou endereço completo), ambiente, identificador (`AR-SR-0001`), tipo e BTUs;
  **plano vigente** (código, vigência, responsável técnico com registro e o número do TRT); **últimas manutenções** (até 12: mês, data, situação,
  quantas tarefas feitas) com link para o relatório de cada mês; selo **"Plano vigente"** ou **"Sem plano vigente"**. Token inválido: mensagem amigável.
- Na aba **Equipamentos** do editor: botão **"Imprimir etiquetas"** (todas ou as marcadas) que só chama a função da fonte de dados e mostra o
  resultado ("3 etiquetas enviadas para a impressora"), e uma **pré-visualização** da etiqueta em tela (50 x 30 mm: logo/nome BRV, identificador
  grande, ambiente, "Manutenção PMOC" e o QR). A etiqueta física (ZPL para a Elgin) é do Claude; você faz só a pré-visualização.

## 3. Rotas

Em `src/App.tsx`: `/relatorio-pmoc/:token` e `/equipamento/:token` **fora** das rotas protegidas (como `/placa/:token` e `/avaliar/:token`).
Nada novo no menu (o painel do mês fica dentro de `/pmoc`).

## 4. Como ligar os dados (importante)

Você não pode tocar em `src/services/`. Faça como na fase 1:

1. Acrescente os tipos novos em `src/types/pmoc.ts` (campos em inglês, padrão do banco, comentados). Por exemplo: o resumo do mês por plano
   (situação, OS, técnico, data), o pedido de geração da OS (`technician_id`, `scheduled_start`, `estimated_minutes`), a execução de um aparelho
   na visita (resultados por tarefa, medições, observações, fotos, motivo de não atendido), `accompanied_by`, o relatório público e o aparelho público.
2. Funções novas em `src/components/pmoc/fonteDeDados.ts`, **cada uma com a versão de demonstração** (em memória, dados em `dadosDemo.ts`) e o
   desvio `if (USAR_BANCO_PMOC) ...` **deixado para o Claude**: enquanto o banco não tiver a função, a versão "banco" deve lançar
   `new Error('Disponível na próxima atualização do sistema.')`. Nomes sugeridos:
   `resumoDoMes(mes)`, `gerarOsDoMes(planId, mes, agendamento)` (troque a assinatura atual), `buscarChecklistDaAtividade(taskId)` (devolve se a
   atividade é de PMOC e os aparelhos/tarefas do mês), `salvarExecucaoAparelho(...)`, `concluirChecklist(taskId, acompanhadoPor)`,
   `gerarLinkRelatorio(planId, mes)`, `buscarRelatorioPublico(token)`, `buscarEquipamentoPublico(token)`, `imprimirEtiquetas(planId, idsAparelhos)`.
3. Para o app de campo, a fonte de dados pode ficar em `src/components/pmoc/fonteDeDados.ts` mesmo (o app importa de lá).
4. Use os services reais que já existem para o que já existe (técnicos, OS, fotos com `anexarFoto` de `src/services/anexos.ts`).
5. Nada de dado de demonstração dentro dos componentes. A faixa "Dados de demonstração" (`FaixaDadosDemo.tsx`) segue a regra de antes.
6. Para testar com os dados de demonstração, você pode pôr `USAR_BANCO_PMOC = false` **enquanto trabalha**, mas **entregue com `true`**.

## 5. Regras de interface

- Padrão visual existente: `Pmoc.tsx`/`EditorPlanoPmoc.tsx` no escritório; `CampoAtividade.tsx` e `ConcluirAtividadeModal.tsx` no celular;
  páginas públicas como `AcompanhamentoPlaca.tsx`. Tailwind 4 e lucide-react; **nenhuma biblioteca nova** (se precisar, descreva no resumo).
- Datas com `src/utils/ordens.ts` (`formatarData` aceita `AAAA-MM-DD`); mês por extenso ("novembro de 2026"); telefone com `formatarTelefone`.
- **Nunca grave data sem hora** em campo de data e hora: monte a data e a hora no horário local (`deCamposDataHora` de `utils/ordens.ts`).
- Todo botão que grava mostra "Salvando..."/"Gerando..." e bloqueia clique duplo. Mensagens de erro em português, sem termo técnico.
- Acessibilidade básica: rótulos nos campos, foco visível, contraste nos selos.

## 6. O que NÃO fazer

- Não altere `supabase/`, `src/services/`, `src/contexts/`, `public/sw.js`, `android/`, `hostgator-api/`.
- No app de campo, mexa só no necessário: `CampoAtividade.tsx`, `ConcluirAtividadeModal.tsx` e componentes novos em `src/components/campo/pmoc/`.
  Não mexa na fila sem internet (`services/filaCampo.ts`), no GPS nem no login.
- Não implemente a etiqueta ZPL, envio por e-mail, Portal do Cliente nem cobrança.
- Não mexa na ajuda F1 (`src/ajuda/`): o Claude escreve os tópicos depois.
- Não invente dados reais (nome de cliente, CPF, CNPJ, registro profissional) no código.

## 7. Ordem sugerida

Tipos e funções de demonstração → Entrega 1 → 2 → 3 → 4 → 5. Cada parte fecha com typecheck, lint e build limpos.

## 8. Resumo para auditoria (entrega obrigatória): grave em `docs/gemini/pmoc-fase2.md`

Mesmo formato da fase 1 (`docs/gemini/pmoc.md`), exato e honesto:
1. Arquivos criados e alterados (o que mudou em cada alterado, principalmente `App.tsx`, `CampoAtividade.tsx`, `ConcluirAtividadeModal.tsx`, `Pmoc.tsx`).
2. Telas e rotas (quem abre cada uma; quais entregas cobre).
3. **Contrato de dados que o Claude precisa implementar**: cada função nova de `fonteDeDados.ts` (nome, parâmetros, retorno) e os tipos novos, com
   o que depende de tabela/coluna nova e de regra no servidor (geração da OS do mês, gravação do checklist, tokens do relatório e do aparelho).
4. Regras de negócio implementadas no front (validações do checklist, faixas das medições, bloqueio da conclusão etc.), com o arquivo de cada uma.
5. Premissas e decisões onde o briefing era ambíguo.
6. Pendências e limitações (o que não foi testado: celular real, impressão, sem internet).
7. Verificação: saída final de `npm run typecheck`, `npm run lint` e `npm run build`.
8. Como testar cada tela com os dados de demonstração.

Avise o Braulio ao terminar. Não faça commit nem push.
