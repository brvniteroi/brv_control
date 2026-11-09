# Tarefa para o Gemini: módulo Oficina (equipamentos recolhidos para conserto)

Leia antes: `GEMINI.md`, `CLAUDE.md` e `docs/oficina.md` (plano completo e decisões do Braulio). Siga as regras do `GEMINI.md`
(português em tudo, **sem mexer em `services/`, `hooks/useOficina.ts`, `utils/oficina.ts`, `utils/etiquetaOficina.ts`,
`types/oficina.ts`, `migrations/`, `functions/`, `ProtectedRoute`**, `typecheck` + `lint` + `build` sem erro nem aviso, **sem push**).

Diferente do PMOC, aqui o banco **já existe** (migration `20261108130000_oficina_base.sql`) e as funções de dados estão prontas em
`src/services/oficina.ts`. Você liga as telas direto nelas, sem dados de demonstração. Se faltar alguma função, **não crie consulta
ao Supabase**: anote no resumo (seção 9) e use um `TODO(Claude)`.

Entrega obrigatória no fim: `docs/gemini/oficina.md` (seção 9), que o Claude audita antes do deploy.

## 1. O negócio

A BRV conserta ar-condicionado. Às vezes o mecânico (com o ajudante) precisa **trazer para a loja** parte do aparelho do cliente:
a evaporadora, a condensadora, as duas, ou o aparelho inteiro (ex.: ar de janela, ACJ). Na loja:

1. O **Gustavo** (técnico de bancada; login com papel `oficina`) recebe, confere, analisa e registra o que precisa ser feito.
2. O **atendimento** (Jéssica, Pedro, Adriana, Braulio; papéis `escritorio`/`admin`) monta o orçamento **no SicWeb** (outro
   sistema; aqui só se registra o nº e o valor), envia ao cliente e registra a resposta: aprovado, recusado (devolver sem conserto)
   ou recusado com **descarte autorizado**.
3. Aprovado e com a peça, o Gustavo conserta e deixa **pronto**.
4. O atendimento cria a **OS de devolução** (a equipe volta e instala, ou o cliente busca). Quando essa OS é concluída, o item vira
   "Entregue" sozinho.

Cada item é identificado pelo **número da OS do Control** onde foi recolhido: "OS 17300". Se saíram duas peças na mesma OS:
"OS 17300 · item 1" e "OS 17300 · item 2" (use `numeroItem()` de `utils/oficina.ts`, nunca monte esse texto na mão).

Hoje isso roda num sistema separado, o BRV Equipamentos (tema escuro, em `D:\BRV_Equipamentos`): pode olhar para entender, mas
**o visual é o do BRV Control** (tema claro, cores `brv-navy`, cartões brancos com borda `slate-200`, como Ordens de Serviço e
Linha do Tempo). Não copie código de lá.

## 2. Etapas (Kanban)

Colunas, na ordem (`COLUNAS_KANBAN` em `utils/oficina.ts`, com rótulo e "quem"):
Em trânsito → Entrada → Diagnóstico → Aguardando orçamento → Aguardando cliente → Aguardando peça → Em reparo → Pronto.
Finais (fora do Kanban, na lista "Finalizados"): Entregue, Descartado, Cancelado.

**Quem pode mover o quê** está no banco (ele recusa o que não pode, com mensagem em português pronta para mostrar). Na tela, use
`podeMover(item, etapa, papel)` para aceitar ou recusar o arraste e mostrar botões, e `motivoBloqueio(item, etapa)` para explicar por
que não pode (ex.: "Falta registrar a aprovação do cliente."). `acoesEscritorio(item)` diz quais botões do atendimento aparecem.

- Papel `oficina` (Gustavo): só os passos da bancada (receber, diagnóstico, mandar para orçamento, aguardando peça ⇄ em reparo,
  pronto). Não vê nem edita orçamento, resposta do cliente, descarte, devolução e cancelamento (mostre só leitura).
- `escritorio`/`admin`: tudo. Admin também reabre item finalizado (`reabrirItem`).
- Garantia (`is_warranty`): não passa por orçamento; mostre um selo "Garantia" bem visível.

## 3. Telas

### 3.1 Página `/oficina` (substitui a provisória `src/pages/Oficina.tsx`)
- Cabeçalho: título "Oficina", busca (OS, cliente, tipo, marca), botão **"Nova entrada"**, indicador da **impressora** (seção 5).
- Abas: **Em andamento** (Kanban) e **Finalizados** (lista paginada, 50 por página, com filtro Entregue/Descartado/Cancelado e busca;
  `listarItensFinalizados`, `ITENS_POR_PAGINA`).
- Kanban: `useItensOficina()` (Realtime: outra pessoa move um cartão e ele anda sozinho). Arraste com `@hello-pangea/dnd` (já
  instalado; a Linha do Tempo usa). Atualização otimista com `setItens` e desfazer se `mudarEtapa` falhar (mostre a mensagem).
  Arrastar para "Entrada" a partir de "Em trânsito" = `receberItem` e oferecer imprimir a etiqueta na hora.
- **Celular**: o Gustavo pode usar o celular na bancada. No celular, em vez de colunas lado a lado, mostre uma coluna por vez com
  seletor de etapa (chips roláveis com a contagem) e um botão "Mover para..." no cartão (sem arraste).
- **Cartão**: número (grande, `numeroItem`), cliente, `descricaoItem(item)`, há quantos dias está na loja (`diasNaOficina`, em
  vermelho a partir de 15 dias), técnico de bancada, selos: Garantia, situação da peça (`ROTULO_PECAS`, só se ≠ "Sem peça"),
  "Recusado" (se `decision = 'recusado'`), valor do orçamento (`valorEmReais`) em "Aguardando cliente". Clique abre o detalhe.
- Contagem por coluna no cabeçalho dela; coluna vazia com texto discreto.
- O papel `oficina` só vê esta página (o menu dele só tem "Oficina"; o roteamento já faz isso).

### 3.2 Detalhe do item (painel por cima, como a OS: `OrdemDetalhes`)
Abrir por cima da página (e por link `/oficina?item=<id>`: o QR da etiqueta abre assim; leia o parâmetro e abra o painel).
`buscarItem(id)`. Seções:
- **Topo**: número, etapa atual (com cor), cliente, botões de etapa permitidos (`podeMover`), botão **"Etiqueta"**.
- **Equipamento**: tipo (`TIPOS_EQUIPAMENTO` como sugestão, campo livre), o que veio (`ROTULO_UNIDADE`), marca, modelo, nº de série,
  BTUs, tensão (`TENSOES`), acessórios, defeito relatado, relato do técnico de campo, conferência na chegada. Editar e salvar com
  `atualizarItem` (só os campos alterados).
- **Bancada**: diagnóstico, peças necessárias, situação das peças, serviço executado, técnico de bancada (`listarTecnicosOficina`).
- **Orçamento e cliente** (só escritório edita; oficina vê): "Registrar orçamento" (nº no SicWeb + valor → `registrarOrcamento`),
  "Avisar pelo WhatsApp" (`textoOrcamentoWhatsApp(item)` + abrir `wa.me`; o telefone **não** vem na visão: use o cadastro do cliente
  pelas funções de `services/clientes.ts`; se não achar a função certa, `TODO(Claude)`), "Registrar resposta do cliente" (modal:
  Aprovado / Recusado, **canal** obrigatório `ROTULO_CANAL`, observação, e no aprovado "falta peça?" → `registrarResposta`),
  **"Cliente autorizou o descarte"** (modal com canal e descrição obrigatórios: quem autorizou e como; texto de aviso "Fica
  registrado na OS de origem e não pode ser desfeito"; opção de anexar o print da conversa como foto categoria `documento`
  → `autorizarDescarte` + `anexarFotoItem`). Mostre quem registrou e quando (`decision_at`, `discard_authorized_at`).
- **Devolução** (escritório, item pronto): "Criar OS de devolução" (modal: escolher o tipo de serviço com `services/tiposServico.ts`,
  marcar outros itens prontos da mesma OS para irem juntos, descrição opcional → `criarOsDevolucao`). Depois mostre "OS de devolução
  N" com link que abre a OS por cima, e a frase "Agende a visita pela Linha do Tempo". "Cliente buscou na loja" → `marcarEntregue`.
- **Fotos**: `fotosDoItem`, enviar várias de uma vez (`anexarFotoItem`, categoria `antes` na chegada/diagnóstico e `depois` no
  pronto), legenda opcional, ampliar com o `VisualizadorFotos` que já existe em `components/ordens/`. Mostre a etapa em que cada foto
  foi tirada (`workshop_status`, rótulo `ROTULO_ETAPA`).
- **Histórico**: `historicoDoItem` em linha do tempo vertical (quem, quando, o quê). Tipos: `criado`, `etapa` (de → para), `decisao`,
  `descarte_autorizado` (destacado), `alteracao` (`changes` = `{ campo: [antes, depois] }`: mostre "Diagnóstico alterado" e, ao
  expandir, antes/depois; traduza os nomes dos campos para português), `nota`. Campo "Anotar no histórico" (`anotarNoHistorico`).
- **Rodapé**: "Cancelar entrada" (escritório; motivo obrigatório → `cancelarItem`), "Reabrir" (só admin, item finalizado).
- Item finalizado: tudo só leitura, faixa no topo dizendo Entregue/Descartado/Cancelado, data e (descarte) a autorização.

### 3.3 Nova entrada (modal)
Dois caminhos:
1. **Da OS** (padrão): digitar o número da OS → `buscarOsPorNumero` mostra cliente, bairro/cidade, técnico e relato da última
   atividade, e quantos itens dessa OS já estão na oficina (avise se já houver). Preencher o equipamento (`NovoItemOficina`), marcar
   "Já chegou na loja" (padrão sim) → `criarItemNaOS(osId, dados, chegou)`. Pré-preencha `field_report` com o relato do técnico e
   `pickup_employee_id` com o técnico da atividade.
2. **Balcão** (só escritório; cliente trouxe sem visita): escolher o cliente (`SeletorCliente` de `components/ordens/`) e o endereço,
   preencher o equipamento → `entradaBalcao` (o banco cria a OS junto).
Depois de salvar: abrir o detalhe do item e oferecer **imprimir a etiqueta**.
Garantia: checkbox "Retorno em garantia" (`is_warranty`).

### 3.4 Bloco "Na oficina" na OS e no cliente
- Em `OrdemDetalhes` (só admin/escritório): se `itensDaOS(osId)` trouxer algo, um bloco "Na oficina" com cada item (número, descrição,
  etapa com cor, link que abre o detalhe por cima). Se a OS é a de devolução de algum item, "Devolução de: OS X · item Y".
- Na aba Atendimento do cliente (`ClienteDetalhes`): lista "Oficina" com `itensDoCliente`.

## 4. Mensagens e erros
O banco devolve mensagens prontas ("Registre a aprovação do cliente antes de seguir para o conserto.", "Descarte só com a autorização
do cliente registrada." etc.): mostre `erro.message` como veio. Nada de "Erro 42501" ou inglês na tela.

## 5. Etiqueta (Elgin L42PRO) — função muito importante para a equipe

A impressão é por **fila**: a tela grava o pedido e o agente no servidor da loja imprime (de qualquer lugar, até do celular no 4G).
Tudo pronto em `services/oficina.ts` e `utils/etiquetaOficina.ts`; você faz o modal "Etiqueta":
- **Pré-visualização** fiel: `<iframe srcDoc={htmlEtiqueta(dadosEtiqueta(item, totalNaOs), largura, true)} />` em escala, com borda
  tracejada simulando o rolo. Opções: largura 100 ou 80 mm (padrão 100; lembrar a escolha em `localStorage` com try/catch) e cópias
  (1 a 5).
- **Situação da impressora**: `useSituacaoImpressora()` → bolinha verde "Elgin pronta" / cinza "Servidor da loja sem sinal desde ...".
  Mostre o mesmo indicador pequeno no cabeçalho da página.
- **"Imprimir na Elgin"** (botão principal): `pedirEtiqueta(item, { copias, largura, totalNaOs })` e depois
  `acompanharPedido(id, aoMudar)`: mostre "Na fila..." → "Imprimindo..." → "Impressa" (verde) ou "Não imprimiu: <motivo>"
  (vermelho, com "Tentar de novo"). Se voltar `pendente` depois de 1 min: "O servidor da loja não respondeu".
  Botão desabilitado enquanto envia (evita etiqueta dupla).
- **"Imprimir pelo navegador"** (contingência, secundário; destaque quando a Elgin estiver sem sinal): `imprimirPeloNavegador(dados,
  largura)` **direto no clique** (sem `await` antes, senão o celular bloqueia). Aviso: "No Chrome, em Margens escolha Nenhuma".
- Histórico de impressões do item (`pedidosDoItem`): data, quem, situação. "Cancelar" num pedido ainda na fila (`cancelarPedido`).
- Ao **receber** um item (Em trânsito → Entrada) e ao **criar** uma entrada, abra este modal já pronto para imprimir.
- Mantenha o cartão "Impressora de etiquetas" com o botão **"Imprimir etiqueta de teste"** (`pedirEtiquetaTeste`) em algum lugar
  discreto da página (ex.: menu "..." do cabeçalho), só para admin/escritório.

## 6. Ajuda (F1)
Regra fixa do projeto: a tela só fica pronta com a ajuda. **Os textos da ajuda são do Claude** (`src/ajuda/`, não mexa). Para isso,
liste no resumo (seção 9) o nome exato de cada botão, aba e campo que você criou.

## 7. Visual
- Cores das etapas: escolha uma por etapa e centralize num só lugar do seu componente (ex.: `CORES_ETAPA` num arquivo
  `components/oficina/cores.ts`); finais em cinza; "Pronto" em verde; "Aguardando cliente" em âmbar.
- Componentes em `src/components/oficina/` (ex.: `KanbanOficina.tsx`, `CartaoItem.tsx`, `ItemOficinaDetalhes.tsx`,
  `NovaEntradaModal.tsx`, `EtiquetaModal.tsx`, `HistoricoItem.tsx`, `FotosItem.tsx`, `NaOficinaOS.tsx`).
- Telas leves: o Kanban terá dezenas de cartões, não centenas.
- Acessível: botões com texto ou `aria-label`, foco visível, contraste. Funciona no celular (Gustavo na bancada).

## 8. Fora do escopo agora
- Placas eletrônicas (outro Kanban, depois).
- Botão "Recolher equipamento" no app de campo (`/campo`): o Claude faz na fase 3 (a função `recolherNoCampo` já existe).
- Importação dos dados do BRV Equipamentos (Claude).

## 9. Resumo para auditoria (entrega obrigatória)
Grave `docs/gemini/oficina.md` com: arquivos criados/alterados; funções de `services/oficina.ts` usadas em cada tela; o que ficou
como `TODO(Claude)` e por quê; nomes exatos de botões, abas e campos (para a ajuda F1); o que testou no celular; e qualquer regra
de negócio que você **supôs** (o Claude confere uma a uma).
