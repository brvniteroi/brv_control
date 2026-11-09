# Resumo para auditoria — Módulo Oficina (Fase 2: Telas e Componentes)

Documento de entrega referente a `docs/gemini/oficina-briefing.md`.

---

## 1. Arquivos criados e alterados

### Criados em `src/components/oficina/`
- `src/components/oficina/cores.ts` — Cores centralizadas das etapas (`CORES_ETAPA`: finais em cinza, `Pronto` em verde, `Aguardando cliente` em âmbar), cores dos selos de peças (`CORES_PECAS`), dicionário em português `ROTULO_CAMPO_HISTORICO` para o histórico de alterações e `mapaTotaisPorOs()`.
- `src/components/oficina/SituacaoElgin.tsx` — Indicador compacto da impressora (`IndicadorElgin`: bolinha verde `"Elgin pronta"` / cinza `"Servidor da loja sem sinal desde ..."`) e menu discreto `"..."` (`MenuImpressoraCabecalho`, visível apenas para `admin`/`escritorio`) com o cartão `"Impressora de etiquetas"` e o botão **"Imprimir etiqueta de teste"**.
- `src/components/oficina/CartaoItem.tsx` — Cartão do Kanban com `numeroItem`, cliente, `descricaoItem`, `diasNaOficina` (vermelho a partir de 15 dias), técnico de bancada, selos (`Garantia`, situação de peça quando `≠ nao_necessario`, `Recusado` e valor em `Aguardando cliente`) e botão **"Mover para..."** no celular.
- `src/components/oficina/KanbanOficina.tsx` — Visão responsiva em duas apresentações:
  - **Computador (`>= md`)**: 8 colunas (`COLUNAS_KANBAN`) com arraste `@hello-pangea/dnd`, destaque visual de colunas permitidas/bloqueadas durante o arraste (`podeMover` + `motivoBloqueio`), contagem no cabeçalho e texto discreto em colunas vazias.
  - **Celular (`< md`)**: chips horizontais roláveis com contagem por etapa, exibição de uma coluna por vez e modal nativo `<dialog>` acionado pelo botão **"Mover para..."** de cada cartão.
- `src/components/oficina/ListaFinalizadosOficina.tsx` — Aba **Finalizados** paginada no servidor (`ITENS_POR_PAGINA = 50`), filtros por etapa final (`Todos`, `Entregue`, `Descartado`, `Cancelado`), busca sincronizada, estados de carregando, erro com **"Tentar de novo"** e estado vazio, além de cartões no celular e tabela no computador.
- `src/components/oficina/EtiquetaModal.tsx` — Modal da etiqueta Elgin L42PRO com pré-visualização fiel (`<iframe srcDoc={htmlEtiqueta(..., true)} />`) em moldura tracejada simulando o rolo, largura `100 mm` / `80 mm` lembrada em `localStorage` (com `try/catch`), cópias de `1` a `5`, situação da impressora, **"Imprimir na Elgin"** com acompanhamento em tempo real (`Na fila...` → `Imprimindo...` → `Impressa` / `Não imprimiu: <motivo>` + **"Tentar de novo"** / `"O servidor da loja não respondeu"`), contingência **"Imprimir pelo navegador"** chamada de forma síncrona no clique (destacada quando a Elgin está sem sinal) com o aviso `"No Chrome, em Margens escolha Nenhuma"`, e histórico de impressões do item com botão **"Cancelar"** em pedidos pendentes.
- `src/components/oficina/NovaEntradaModal.tsx` — Modal de registro de entrada com os dois caminhos (**"Da OS"** para todos os perfis da oficina e **"Balcão (sem visita)"** exclusivo para `admin`/`escritorio`).
- `src/components/oficina/FotosItem.tsx` — Galeria e envio múltiplo de fotos do item com categoria sugerida conforme a etapa (`antes` na chegada/diagnóstico, `depois` em reparo/pronto), legenda opcional, selo da etapa em que cada foto foi tirada (`ROTULO_ETAPA[foto.workshop_status]`), ampliação pelo `VisualizadorFotos` existente e exclusão para `admin`.
- `src/components/oficina/HistoricoItem.tsx` — Linha do tempo vertical dos eventos (`criado`, `etapa`, `decisao`, `descarte_autorizado` destacado, `alteracao` com tradução dos campos e `<details>` `"Ver antes e depois"`, `nota`) e formulário **"Anotar no histórico"**.
- `src/components/oficina/ModaisAcaoOficina.tsx` — Modais das ações do atendimento (`ModalRegistrarOrcamento`, `ModalRespostaCliente`, `ModalAutorizarDescarte`, `ModalCriarOsDevolucao` e `ModalCancelarItem`).
- `src/components/oficina/ItemOficinaDetalhes.tsx` — Painel completo sobreposto (`createPortal` em `document.body`, suportando `/oficina?item=<id>` do QR da etiqueta e empilhamento limpo sobre `OrdemDetalhes` e `ClienteDetalhes`).
- `src/components/oficina/NaOficinaOS.tsx` — Bloco **"Na oficina"** para `OrdemDetalhes` e tabela **"Oficina"** (`ItensOficinaCliente`) para a aba Atendimento de `ClienteDetalhes`.

### Alterados
- `src/pages/Oficina.tsx` — Substituída a página provisória da fase 1 pela página completa `/oficina`.
- `src/components/ordens/OrdemDetalhes.tsx` — Incluído `<NaOficinaOS>` quando `!nova` e o operador é `admin` ou `escritorio`.
- `src/components/clientes/ClienteDetalhes.tsx` — Incluído `<ItensOficinaCliente>` na aba **Atendimento**.

> Nenhum arquivo restrito (`supabase/*`, `src/services/*`, `src/hooks/useOficina.ts`, `src/utils/oficina.ts`, `src/utils/etiquetaOficina.ts`, `src/types/*`, `src/contexts/*`, `ProtectedRoute`, `src/ajuda/*`) foi modificado e nenhum pacote npm foi adicionado.

---

## 2. Funções de `src/services/*` usadas em cada tela/componente

| Arquivo | Funções de `src/services/oficina.ts` | Outras funções de `src/services/*` / `hooks/*` |
| --- | --- | --- |
| `src/pages/Oficina.tsx` | `mudarEtapa`, `receberItem` | `useItensOficina`, `useSituacaoImpressora` (`hooks/useOficina.ts`) |
| `SituacaoElgin.tsx` | `pedirEtiquetaTeste`, `acompanharPedido` | — |
| `ListaFinalizadosOficina.tsx` | `listarItensFinalizados`, `ITENS_POR_PAGINA` | — |
| `EtiquetaModal.tsx` | `pedirEtiqueta`, `acompanharPedido`, `pedidosDoItem`, `cancelarPedido` | `useSituacaoImpressora` (`hooks/useOficina.ts`) |
| `NovaEntradaModal.tsx` | `buscarOsPorNumero`, `listarTecnicosOficina`, `criarItemNaOS`, `entradaBalcao` | `listarEnderecosDoCliente` (`services/ordens.ts`, apenas quando `ehEscritorio`), `listarClientes` via `SeletorCliente` |
| `ItemOficinaDetalhes.tsx` | `buscarItem`, `historicoDoItem`, `fotosDoItem`, `itensDaOS`, `listarTecnicosOficina`, `atualizarItem`, `mudarEtapa`, `receberItem`, `marcarEntregue`, `reabrirItem` | `buscarClientePorId` (`services/clientes.ts`, apenas quando `ehEscritorio` ao clicar em **Avisar pelo WhatsApp**) |
| `ModaisAcaoOficina.tsx` | `registrarOrcamento`, `registrarResposta`, `autorizarDescarte`, `anexarFotoItem`, `criarOsDevolucao`, `itensDaOS`, `cancelarItem` | `listarTipos` (`services/ordens.ts`, para listar os tipos de serviço ativos na OS de devolução) |
| `FotosItem.tsx` | `anexarFotoItem` | `excluirAnexo` (`services/anexos.ts`, apenas `admin`) |
| `HistoricoItem.tsx` | `anotarNoHistorico` | — |
| `NaOficinaOS.tsx` | `itensDaOS`, `itensDoCliente` | — |

---

## 3. O que ficou como `TODO(Claude)` (nenhum bloqueio pendente)

Não foi necessário deixar nenhum `TODO(Claude)` no código, pois todas as operações tinham funções prontas nos serviços existentes. Pontos relevantes para conferência na auditoria:

1. **Listagem de tipos de serviço no modal "Criar OS de devolução"**: o briefing mencionava `services/tiposServico.ts`, porém esse arquivo exporta apenas `contarUsoTipos`, `salvarTipoServico` e `excluirTipoServico`. A função que lista os tipos de serviço (`ServiceType[]`) já pronta no projeto é `listarTipos()` em `src/services/ordens.ts` (a mesma usada em `OrdemDetalhes.tsx`). Usamos `listarTipos()` filtrando `t.active`.
2. **Telefone do cliente para "Avisar pelo WhatsApp"**: usamos `buscarClientePorId(item.customer_id)` de `src/services/clientes.ts` (chamada restrita a `admin`/`escritorio`), priorizando: contato principal marcado como WhatsApp → qualquer contato WhatsApp → contato principal com telefone → qualquer contato com telefone → `cliente.phone`. A aba é aberta de forma síncrona no clique (`window.open('', '_blank')`) antes do `await`, evitando bloqueio de pop-up no celular (mesmo padrão de `AtividadesOS.tsx`).
3. **Ajuda contextual (`F1`)**: conforme instruído na seção 6 (`src/ajuda/`, não mexer), não chamamos `useTelaAjuda(...)` em `Oficina.tsx` nem em `ItemOficinaDetalhes.tsx` porque o tipo `TelaAjuda` em `src/ajuda/topicos.ts` / `src/ajuda/contextoAjuda.ts` ainda não possui `'oficina'`. Assim que o Claude criar os tópicos da Oficina, basta registrar a rota `/oficina` em `contextoAjuda.ts` e adicionar `useTelaAjuda(...)` no painel sobreposto `ItemOficinaDetalhes.tsx`.

---

## 4. Nomes exatos de botões, abas e campos (para os textos da Ajuda F1)

### 4.1 Página `/oficina`
- **Título**: `Oficina`
- **Indicador de impressora**: `Elgin pronta` / `Servidor da loja sem sinal desde ...` / `Servidor da loja sem sinal (agente não instalado)`
- **Botões do cabeçalho**:
  - **Nova entrada**
  - Botão `...` (`aria-label="Impressora de etiquetas"`, só `admin`/`escritorio`) → abre o cartão **Impressora de etiquetas** com o botão **Imprimir etiqueta de teste**
- **Abas**:
  - **Em andamento** (Kanban)
  - **Finalizados** (com filtros **Todos**, **Entregue**, **Descartado**, **Cancelado** e paginação **Anterior** / **Próxima**)
- **Campo de busca**: `Buscar por OS, cliente, tipo ou marca...` (botão `Limpar busca`)
- **No celular (`< md`)**:
  - Seletor horizontal de etapas: **Em trânsito**, **Entrada**, **Diagnóstico**, **Aguardando orçamento**, **Aguardando cliente**, **Aguardando peça**, **Em reparo**, **Pronto**
  - Botão em cada cartão: **Mover para...**

### 4.2 Modal `Nova entrada na oficina`
- **Abas de origem** (visíveis para `admin`/`escritorio`; `oficina` vê direto **Da OS**):
  - **Da OS**
  - **Balcão (sem visita)**
- **Campos de "Da OS"**:
  - `Número da OS *` + botão **Buscar OS**
  - `Técnico que recolheu`
  - Checkbox `Já chegou na loja` (marcado por padrão)
- **Campos de "Balcão (sem visita)"**:
  - `Cliente *` (`SeletorCliente`)
  - `Endereço do cliente`
- **Campos de "Dados do equipamento"**:
  - Checkbox `Retorno em garantia`
  - `Tipo de equipamento *`
  - `O que veio *`
  - `Marca`
  - `Modelo`
  - `Nº de série`
  - `BTUs`
  - `Tensão`
  - `Acessórios`
  - `Defeito relatado`
  - `Relato do técnico de campo` (no caminho **Da OS**)
  - `Conferência na chegada`
- **Botões do rodapé**: **Cancelar**, **Salvar entrada**

### 4.3 Painel de detalhe do item (`ItemOficinaDetalhes`)
- **Topo**:
  - Link `Abrir OS <nº>` (só `admin`/`escritorio`)
  - Botão **Etiqueta**
  - Botão `Fechar` (`X`)
  - Faixa `Mover etapa:` com chips das etapas permitidas (quando está em trânsito, o botão para `Entrada` chama-se **Receber na loja (Entrada)**)
- **Seção `Equipamento`** (botão **Salvar equipamento**):
  - `Tipo de equipamento *`, `O que veio *`, `Marca`, `Modelo`, `Nº de série`, `BTUs`, `Tensão`, `Acessórios`, `Defeito relatado`, `Relato do técnico de campo`, `Conferência na chegada`, `Técnico que recolheu`, checkbox `Retorno em garantia`
- **Seção `Bancada`** (botão **Salvar bancada**):
  - `Técnico de bancada`, `Situação das peças`, `Diagnóstico`, `Peças necessárias`, `Serviço executado`
- **Seção `Orçamento e cliente`**:
  - Botões (só `admin`/`escritorio`):
    - **Registrar orçamento** → modal com `Nº do orçamento no SicWeb`, `Valor do orçamento (R$)`, checkbox `Já enviado ao cliente (passar para "Aguardando cliente")` e botão **Salvar orçamento**
    - **Avisar pelo WhatsApp**
    - **Registrar resposta do cliente** → modal com botões **Aprovado** / **Recusado**, `Canal da resposta *`, checkbox `Falta peça?` (quando aprovado), `Observação (opcional)` e botão **Salvar resposta**
    - **Cliente autorizou o descarte** → modal com aviso `"Fica registrado na OS de origem e não pode ser desfeito."`, `Canal da autorização *`, `Quem autorizou e como *`, `Anexar print da conversa (opcional)` e botão **Confirmar descarte**
- **Seção `Devolução`**:
  - Link **OS de devolução \<nº\>** + texto `"Agende a visita pela Linha do Tempo."`
  - Botões (só `admin`/`escritorio`):
    - **Criar OS de devolução** → modal com `Tipo de serviço *`, checkboxes `Outros itens prontos desta OS (levar juntos)`, `Descrição da OS (opcional)` e botão **Criar OS de devolução**
    - **Cliente buscou na loja**
- **Seção `Fotos`**:
  - Botão **Adicionar fotos**, campos `Categoria das próximas fotos` e `Legenda (opcional, aplicada ao lote enviado)`
- **Seção `Histórico`**:
  - Link expansível `Ver antes e depois` nos eventos de alteração
  - Campo `Anotar no histórico` + botão **Salvar anotação**
- **Rodapé**:
  - **Cancelar entrada** (só `admin`/`escritorio` → modal com `Motivo do cancelamento *`, botões **Voltar** e **Confirmar cancelamento**)
  - **Reabrir** (só `admin`, quando o item está finalizado)

### 4.4 Modal `Etiqueta`
- **Opções**:
  - `Largura da etiqueta`: botões **100 mm (padrão)** e **80 mm**
  - `Cópias (1 a 5)`: botões `-` (`Diminuir cópias`) e `+` (`Aumentar cópias`)
- **Botões principais**:
  - **Imprimir na Elgin** (e botão **Tentar de novo** caso falhe ou expire)
  - **Imprimir pelo navegador** (abaixo, aviso `"No Chrome, em Margens escolha Nenhuma."`)
- **Histórico de impressões deste item**: botão **Cancelar** em pedidos `Na fila`

### 4.5 Integração na OS e no Cliente
- Em `OrdemDetalhes`: bloco **Na oficina (\<qtd\>)** com link do item (ou `Devolução de: OS X · item Y`) e botão **Ver na oficina**.
- Em `ClienteDetalhes` (aba **Atendimento**): bloco **Oficina (\<qtd\>)** com colunas `Item`, `Equipamento`, `Etapa`, `Bancada` e `Entrada`.

---

## 5. Responsividade e cuidados para celular

- **Kanban sem rolagem horizontal dupla no celular (`< md`)**: em telas estreitas, o quadro de 8 colunas dá lugar a uma barra de chips rolável horizontalmente com a contagem de cada etapa e exibição de uma única coluna por vez, com o botão **"Mover para..."** em cada cartão (dispensando arraste por toque, que conflita com a rolagem vertical no celular da bancada).
- **Lista de Finalizados adaptativa**: cartões empilhados em `< md` e tabela completa em `>= md`.
- **Pré-visualização da etiqueta em telas pequenas**: o `<iframe srcDoc>` de `100 × 50 mm` (`378 × 189 px`) aplica `scale-[0.76] sm:scale-100` para caber sem corte em telas de `320px–375px`.
- **Ações críticas sem bloqueio de pop-up no celular**: tanto **Imprimir pelo navegador** (`imprimirPeloNavegador`) quanto **Avisar pelo WhatsApp** abrem a janela diretamente no evento síncrono de `onClick`.
- **Modais `<dialog>` nativos**: todos limitados a `max-h-[92dvh] overflow-y-auto` e largura `w-[calc(100%-1.5rem)]` para nunca estourar a área útil com o teclado virtual aberto.

---

## 6. Regras de negócio assumidas (para conferência do Claude)

1. **Proteção estrita de RLS para o papel `oficina` (Gustavo)**: nenhuma tela chama `buscarClientePorId`, `listarEnderecosDoCliente`, `listarTipos` ou renderiza `OrdemDetalhes` quando o login é `oficina` (apenas `oficina_itens`, `workshop_orders`, `workshop_order_events`, `attachments`, `print_*` e as RPCs `oficina_buscar_os` / `oficina_funcionarios` são acessadas).
2. **Edição de `field_report`, `pickup_employee_id` e `is_warranty` no detalhe**: na criação (`NovaEntradaModal` → `criarItemNaOS`), o papel `oficina` pode preencher esses campos (permitido no `INSERT` pela trigger `workshop_orders_regras`); já na edição (`ItemOficinaDetalhes`), eles ficam editáveis apenas para `admin`/`escritorio` e somente leitura para `oficina`, respeitando `CamposBancada` vs `CamposEscritorio` e a restrição de `UPDATE` da trigger.
3. **Ordem de envio do comprovante no descarte**: no modal **Cliente autorizou o descarte**, se o operador anexar o print da conversa, `anexarFotoItem(..., 'documento', ...)` é executado **antes** de `autorizarDescarte(...)`. Assim, se o upload da imagem falhar, o item não é finalizado como descartado sem o comprovante, e `workshop_status` registra a etapa em que o item estava no momento da autorização.
4. **Autor da decisão e do descarte na tela**: como a visão `oficina_itens` traz os UUIDs `decision_by` e `discard_authorized_by` sem join em `profiles`, o nome exibido em `"Orçamento e cliente"` e na faixa de item descartado é obtido de `actor_name` do último evento correspondente (`decisao` / `descarte_autorizado`) já carregado por `historicoDoItem`, sem consulta extra ao banco.
5. **Pré-seleção na OS de devolução**: ao abrir **Criar OS de devolução**, caso o banco tenha um tipo de serviço cujo nome contenha `devolu`, `entrega` ou `instala`, ele já vem sugerido no `<select>`, e eventuais outros itens `pronto` da mesma OS de origem (ainda sem OS de devolução) já vêm pré-marcados para irem juntos (podendo ser desmarcados pelo atendimento).
6. **Item finalizado 100% somente leitura**: quando `ehFinal(item.status)` é verdadeiro, todos os campos de Equipamento e Bancada, o upload/exclusão de fotos, as ações do atendimento e o formulário de nova anotação no histórico ficam desabilitados/ocultos (restando apenas **Etiqueta** para eventual segunda via de identificação e **Reabrir** exclusivo para `admin`).

---

## 7. Verificação executada

- `npm run typecheck` → **0 erros**
- `npm run lint` → **0 avisos e 0 erros** (`Found 0 warnings and 0 errors`)
- `npm run build` → **concluído com sucesso**

