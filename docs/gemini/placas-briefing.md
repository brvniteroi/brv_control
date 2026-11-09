# Tarefa para o Gemini: módulo Reparo de Placas (laboratório de eletrônica) no BRV Control

Leia antes: `GEMINI.md`, `CLAUDE.md`, `docs/placas.md` (plano e decisões do Braulio, **fonte da verdade**) e `docs/gemini/oficina.md` (o que você já fez na Oficina:
vários componentes servem de modelo). Siga o `GEMINI.md`: português em tudo, **sem mexer em** `supabase/`, `src/services/`, `src/contexts/`, `ProtectedRoute`,
`hooks/useOficina.ts`, `utils/oficina.ts`, `utils/etiquetaOficina.ts`, `types/oficina.ts`, `components/campo/`, `pages/campo/`, `public/sw.js`, `android/`, `scripts/`;
`npm run typecheck`, `npm run lint` e `npm run build` sem erro nem aviso; **sem commit nem push**.

**Como é parecido com o PMOC:** o banco das placas **ainda não existe**. Você constrói todas as telas contra uma **camada de dados de demonstração** em um arquivo só
(`src/components/placas/fonteDeDados.ts`, com `FONTE_DADOS_DEMO = true`, dados em memória). Depois o Claude cria migration e `services/placas.ts`, troca o corpo dessas funções
e liga ao Supabase **sem mexer nas telas**. Por isso o contrato da seção 9 precisa ser exato. As telas serão **testadas e simuladas antes de qualquer migração de dados**.

**Entrega obrigatória no fim:** `docs/gemini/placas.md` (seção 10), que o Claude audita.

## 1. O negócio

O laboratório da BRV conserta **placas eletrônicas** de ar-condicionado (placas de split inverter etc.). Quem traz: na maioria **instaladores parceiros** (que levam placas de clientes
deles), às vezes cliente final, às vezes a **equipe de campo da BRV** retira a placa numa visita (aí existe uma OS no BRV Control). Fluxo:

1. **Entrada / Triagem:** o balcão recebe, cadastra (cliente, equipamento, código da placa, defeito), imprime o **comprovante de entrada** (com o **link de acompanhamento**) e a etiqueta.
2. **Diagnóstico / Orçamento:** o técnico de bancada (Gustavo, papel `oficina`) analisa e registra diagnóstico e código de erro. O escritório faz o **orçamento aqui no Control** e envia **em PDF pelo WhatsApp**; registra a resposta (aprovado/recusado).
3. **Aguardando Peça → Em Reparo → Teste em Simulador → Pronto para Entrega.**
4. **Entregue / Faturado** (garantia de **90 dias** a contar da saída; **termo de garantia**) ou **Sem Conserto / Devolvido** (cliente recusou ou não tem conserto).
5. **Garantia:** placa que volta dentro do prazo entra como retorno em garantia, ligada à placa original, sem orçamento novo.

**Decisões do Braulio (2026-11-09) que mandam no desenho:**
- **Número próprio da placa**, com data: `OS-DDMMAA-NNN` (ex.: `OS-091126-001`). **Só tem OS do BRV Control quando a placa foi retirada pela equipe de campo**; placa de balcão/portador
  não tem OS do Control. Nunca monte esse texto na mão fora de `regrasPlacas.ts`.
- **Cadastro de clientes de placas é paralelo** ao de clientes do Control (instaladores parceiros). Nada de misturar com `SeletorCliente` nem com `services/clientes.ts`.
  Cada placa tem **ou** um cliente de placas **ou** (quando veio de campo) um cliente do Control, nunca os dois.
- **Orçamento da placa é feito no Control** (diferente dos equipamentos, que usam o SicWeb), **PDF enviado pelo WhatsApp**.
- **O parceiro acompanha a placa por um link** (sem login) que vai no comprovante de entrada.
- **Financeiro das placas é próprio**, separado do Financeiro futuro do Control; **aproveite o dashboard financeiro que existe hoje** no sistema antigo.

**Referência do sistema antigo (somente leitura, no PC da empresa):** `D:\BRV_Equipamentos\frontend\src\pages\Reparos\` (`KanbanReparos`, `NovaOSPlacaModal`, `DetalhesOSPlacaModal`,
`ModalOrcamentoPlaca`, `ModalComprovanteEntrada`, `ModalTermoGarantia`, `ModalEtiquetaTermica`, `DashboardReparos`, `ClientesReparos`) e `pages/Public/GaleriaPublicaOS.jsx`.
Use para **entender regras, campos e textos dos documentos**. **O visual é o do BRV Control** (tema claro, `brv-navy`, cartões brancos com borda `slate-200`), nunca o tema escuro de lá,
e **não copie código** (ele tem fotos em `localStorage`, regras só no navegador etc.). Textos jurídicos e de garantia dos impressos: copie **literalmente** e liste-os no resumo para o
Braulio revisar. **O apoio técnico (fichas técnicas de splits, manuais, códigos de erro e assistente com IA) migra junto com as placas e também é seu (seções 3.11 a 3.14)**; no sistema antigo
ele vive em `pages/ConsultaEquipamentos.jsx`, `pages/ConsultaErros.jsx`, `pages/CadastrarEquipamentoIA.jsx` e `pages/Reparos/AssistenteTecnicoIA.jsx`. Você faz **só as telas**: as chamadas à IA
(Gemini) são Edge Functions que o Claude cria, então na demo elas devolvem respostas fixas pela fonte de dados. Não implemente o ditado por voz nem a leitura de foto por IA da nova placa.

## 2. Etapas e regras

`ETAPAS_PLACA` em `regrasPlacas.ts` (rótulo, cor, quem mexe):
Entrada / Triagem (`entrada`) → Diagnóstico / Orçamento (`diagnostico`) → Aguardando Peça (`aguardando_peca`) → Em Reparo (`em_reparo`) → Teste em Simulador (`teste`) → Pronto para Entrega (`pronto`).
Finais, fora do Kanban: Entregue / Faturado (`entregue`) e Sem Conserto / Devolvido (`sem_conserto`).
O orçamento é um **estado dentro da etapa** (`quote_status`): `nao_feito` | `enviado` | `aprovado` | `recusado`, mostrado como selo; não é coluna.

- Mover pode ser por arraste (`@hello-pangea/dnd`, como a Linha do Tempo e a Oficina) e pelos botões ← → do cartão. No celular, uma coluna por vez com seletor de etapa (como na Oficina).
- **Papel `oficina` (Gustavo):** vê o Kanban e os detalhes da bancada; edita equipamento, diagnóstico, código de erro, componentes trocados, técnico de bancada, fotos e move etapas até **Pronto**.
  **Não vê** valor de orçamento, orçamento, reembolso nem financeiro, e não finaliza (Entregue/Sem conserto), não cancela, não reabre. Mostre isso com campos ocultos, não com botões bloqueados.
- **Escritório/admin:** tudo; admin também reabre uma placa finalizada. Função `podeMoverPlaca(placa, etapa, papel)` em `regrasPlacas.ts` (o banco vai repetir a regra), com `motivoBloqueio`.
- **Aviso de parada:** placa há **4 dias ou mais** na mesma etapa (sem ser Pronto) = "Encalhada" (selo vermelho); `diasNaEtapa`.
- **Pronto → Entregue / Faturado** pede data de saída (padrão hoje). **Sem conserto** pede motivo.
- Garantia: `is_warranty` + `warranty_origin_id` (placa original, escolher entre as entregues do mesmo cliente). Garantia **não gera orçamento**; mostre selo "Garantia" em destaque.
- Reembolso: `refunded`, `refund_amount`, `refunded_at`, `refund_reason` (**só quem tem o acesso ao financeiro das placas**, seção 5).

## 3. Telas e rotas (todas dentro do `Layout`, exceto a pública)

**Decidido em 2026-11-09: as placas têm um menu próprio, "Placas", no menu lateral, e tudo o que é de placas, inclusive o apoio técnico, fica dentro dele.** O menu "Oficina" continua só
com os equipamentos e **não muda**. Em `components/Sidebar.tsx` (única alteração permitida lá, como você fez com o PMOC) crie o **grupo recolhível "Placas"** (ícone de placa/circuito do
`lucide-react`) com estes itens, na ordem:

| Item do menu | Rota | Quem vê |
|---|---|---|
| Reparos (Kanban) | `/placas` | admin, escritório, oficina |
| Clientes de placas | `/placas/clientes` | admin, escritório, oficina (oficina só leitura) |
| Financeiro | `/placas/financeiro` | **só quem tem o acesso ao financeiro das placas (hoje só o Braulio)**, seção 5 |
| Fichas técnicas | `/placas/fichas` | admin, escritório, oficina |
| Códigos de erro | `/placas/erros` | admin, escritório, oficina |
| Assistente técnico | `/placas/assistente` | admin, escritório, oficina |
| Manuais | `/placas/manuais` | admin, escritório, oficina |

O papel `oficina` (Gustavo) hoje só vê o menu da Oficina (`oficina: true` por item, em `Sidebar.tsx`): marque os itens acima com a mesma lógica; ele passa a ver **Oficina e Placas** (o
`ProtectedRoute` já foi ajustado pelo Claude para liberar as rotas que começam com `/placas`). Dentro das telas, uma navegação de abas comum (`NavegacaoPlacas`) repete esses itens no topo para
quem está no computador. **Não mexa em `pages/Oficina.tsx`.** A página pública de acompanhamento continua `/placa/:token` (singular, fora do `Layout`).

### 3.1 `/placas` — Kanban de placas
Cabeçalho: título, busca (número, cliente, marca/modelo, código da placa), botão **"Nova placa"**, indicador da impressora (reaproveite o da Oficina). Filtros em chips com contagem:
**Todas · Parceiros · Cliente final · Garantias · Encalhadas**. Abas **Em andamento** (Kanban) e **Finalizadas** (lista paginada com filtro Entregue/Sem conserto, busca e ano).
Cartão: número (grande), cliente com selo Parceiro/Final, equipamento (marca/modelo), código da placa, dias na etapa (vermelho a partir de 4), técnico de bancada, selos Garantia / Reembolsada /
Encalhada / estado do orçamento, valor do orçamento (**só escritório/admin**). Realtime fica para o Claude (na demo, estado local). Estados: carregando, erro com "Tentar de novo", vazio.

### 3.2 Nova placa (modal, a partir do Kanban)
Dois caminhos:
1. **Balcão / portador (padrão):** escolher cliente de placas (busca em `board_clients`; "Novo cliente" rápido no próprio modal com nome, telefone, tipo, cidade).
2. **Retirada pela equipe de campo:** digitar o número da OS do Control → `buscarOsControl` mostra cliente, endereço, técnico e relato; o cliente passa a ser o do Control (sem cadastro paralelo)
   e o item guarda a OS. Se a OS já tem placa na oficina, avise.
Campos: tipo de cliente (instalador/final), cidade, técnico de retirada e de bancada (`listarTecnicos`, nomes), tipo do equipamento (padrão "Split Inverter", sugestões + livre),
marca/modelo, **código da placa**, periféricos/acessórios, defeito reclamado, código de erro (opcional), "Sem defeito aparente" (checkbox), "Retorno em garantia" (checkbox + escolher a placa de origem),
fotos de entrada (várias, com pré-visualização). Validar em português. Ao salvar: abrir o **comprovante de entrada** (3.5) com os botões de imprimir/enviar e a **etiqueta** (3.7).

### 3.3 Detalhe da placa (painel por cima do Kanban; também `/placas?placa=<id>`)
Seções, na ordem:
- **Topo:** número, etapa (com cor), cliente (selo Parceiro/Final; se vier do campo, "OS do Control N" com texto simples), botões de etapa permitidos, **Etiqueta**, **Comprovante**.
- **Equipamento e placa:** tipo, marca/modelo, código da placa, periféricos, defeito reclamado, "Sem defeito aparente", técnicos de retirada e de bancada.
- **Bancada:** código de erro, diagnóstico técnico, componentes trocados (só `oficina` e escritório editam).
- **Orçamento** (só escritório/admin): valor, validade em dias (padrão 10), CPF/CNPJ do cliente (`utils/documento.ts`), endereço do cliente, parecer técnico. Botões: **"Ver/Imprimir orçamento"** (3.4),
  **"Enviar PDF pelo WhatsApp"**, **"Registrar resposta"** (modal: Aprovado/Recusado, canal `whatsapp|telefone|presencial|email`, observação). Mostre quem registrou e quando.
- **Garantia:** selo, placa de origem (link que abre o detalhe dela), e, na placa entregue, validade (**saída + 90 dias**) com botão **"Termo de garantia"** (3.6).
- **Financeiro** (**só com o acesso ao financeiro das placas**, seção 5; para os demais a seção nem aparece): valor cobrado, **reembolso** (checkbox "Reembolsada", valor, data, motivo).
- **Acompanhamento do cliente:** o link público (`/placa/<token>`), botões **Copiar link**, **Enviar pelo WhatsApp** e **Gerar novo link** (revoga o anterior; confirmar).
- **Fotos:** categorias Antes/Depois/Outros, envio de várias, ampliar com o `VisualizadorFotos` de `components/ordens/`, legenda, etapa em que foi tirada. Na demo, guarde só a pré-visualização local.
- **Histórico:** linha do tempo vertical (quem, quando, o quê; mudança de etapa de→para, alteração de campo com antes/depois, orçamento, resposta, reembolso) e "Anotar no histórico".
- **Rodapé:** Entregue / Faturado (data de saída), Sem Conserto / Devolvido (motivo), **Arquivar**, "Cancelar entrada" (motivo), **Reabrir** (só admin, placa finalizada).
- Placa finalizada: tudo só leitura, faixa no topo com o desfecho e a data.

### 3.4 Orçamento da placa (documento A4 + PDF + WhatsApp) — só escritório/admin
Documento A4 retrato na linha do `DocumentoPmoc.tsx` (portal em `document.body`, porque o `index.css` esconde o `#root` ao imprimir): cabeçalho BRV (use `EMPRESA_BRV` de
`components/pmoc/empresa.ts`, sem copiar), número da placa, data, cliente (nome, CPF/CNPJ, endereço, telefone), equipamento e placa, defeito e **parecer técnico**, serviço/valor total, **validade da proposta**
e condições. Conteúdo e textos: veja `ModalOrcamentoPlaca.jsx`. Botões: **"Imprimir / Salvar PDF"** (`window.print()`) e **"Enviar PDF pelo WhatsApp"**.
O WhatsApp não anexa arquivo por link: monte `gerarPdfOrcamento(placaId): Promise<Blob>` como **função da fonte de dados com `TODO(Claude)`** (devolve um Blob de demonstração) e use
`navigator.share({ files })` quando existir (celular) ou, no computador, baixe o PDF e abra o `wa.me` com a mensagem. **Não adicione biblioteca de PDF**: se achar que precisa de uma, diga qual e por quê no resumo.
Ao enviar, o estado vira `enviado` (`registrarEnvioOrcamento`).

### 3.5 Comprovante de entrada (A4 + WhatsApp)
Documento na linha do orçamento: cabeçalho BRV, número da placa, data/hora, cliente, equipamento e placa, defeito, periféricos, técnico que recebeu, **QR code e link de acompanhamento**
(`/placa/<token>`), termos (prazo de diagnóstico e **bem abandonado após 90 dias**, textos literais de `ModalComprovanteEntrada.jsx`) e duas linhas de assinatura (cliente e BRV).
Botões: **Imprimir**, **Enviar o link pelo WhatsApp** (texto: "Recebemos sua placa, OS ..., acompanhe aqui: <link>"). QR: veja se o projeto já tem biblioteca de QR (a etiqueta da Oficina usa o ZPL, sem biblioteca):
**se não tiver, não adicione**; deixe um quadrado marcado "QR" e anote no resumo.

### 3.6 Termo de garantia de reparo (90 dias, A4 + WhatsApp)
Conforme `ModalTermoGarantia.jsx`: selo "GARANTIA: 90 DIAS", dados da placa e do cliente, **validade = saída + 90 dias**, valor do serviço, componentes substituídos, cláusulas (literais, Art. 26 do CDC;
perda da garantia por raio, sobretensão, insetos, maresia, terceiros) e o aviso de apresentar o número da OS. Só existe para placa **Entregue / Faturado**. Botões: **Imprimir** e **Enviar pelo WhatsApp** (texto).

### 3.7 Etiqueta da placa (modal)
Mesmo padrão do `EtiquetaModal` da Oficina: pré-visualização HTML 100×50 mm (cabeçalho "BRV NITERÓI - PLACAS", número, cliente, equipamento, marca/modelo, código da placa, defeito, data de entrada),
cópias de 1 a 5, indicador da Elgin, **"Imprimir na Elgin"** (`pedirEtiquetaPlaca`, **stub na fonte de dados**) e **"Imprimir pelo navegador"** (contingência, direto no clique, aviso de margens "Nenhuma").
O ZPL é do Claude; você só faz o modal e a pré-visualização.

### 3.8 `/placa/:token` — acompanhamento do parceiro (página pública, sem login, **celular primeiro**)
Fica **fora do `Layout`**, como `pages/Avaliar.tsx` (veja como `App.tsx` registra `/avaliar/:token`; acrescente a rota `placa/:token` do mesmo jeito). Sem menu, com o logo da BRV.
Mostra: número da placa, equipamento e código da placa, **etapa atual em destaque** e a **linha de etapas** (feitas/atual/próximas, com datas), fotos (grade com ampliar), estado do orçamento
(aguardando / enviado / aprovado / recusado, **sem o valor**; deixe `MOSTRAR_VALOR_ORCAMENTO = false` num lugar só), selo de garantia com validade quando entregue, e botão
**"Falar com a BRV no WhatsApp"** (telefone de `EMPRESA_BRV`). **Nunca** mostre diagnóstico técnico detalhado, reembolso, valores internos nem dados de outros clientes. Estados: carregando,
**"Link inválido ou expirado"**, erro com "Tentar de novo". Dados só por `buscarAcompanhamentoPublico(token)`.

### 3.9 `/placas/clientes` — Clientes de placas
Lista com busca (nome/telefone, sem acento: use `semAcento` de `utils`), filtro **Todos · Parceiros · Cliente final**, contagem de placas por cliente e data da última. Criar/editar em modal
(nome, telefone com `formatarTelefone`, tipo, cidade, observação). Detalhe: histórico de placas do cliente (número, equipamento, etapa, valor se escritório, data), com link que abre a placa.
Não pode excluir cliente que tem placas (explique). Só escritório/admin e oficina (oficina vê, não edita).

### 3.10 `/placas/financeiro` — Financeiro das placas (**só com o acesso ao financeiro das placas, hoje só o Braulio**)
Reproduza, no visual do Control, o `DashboardReparos.jsx` do sistema antigo (**leia-o e preserve as regras de cálculo**; documente-as no resumo, o Claude confere uma a uma):
cartões **Faturamento do mês**, **Ticket médio do mês**, **Valor na bancada (em aberto)**, **Placas encalhadas** (paradas ≥ 4 dias) e **Total do ano**; seletor de ano; **faturamento por mês**
(colunas em HTML/CSS no padrão de `pages/RelatorioGraficos.tsx`, **sem biblioteca**, com tabela); clicar num mês abre a lista das placas e dos reembolsos daquele mês; **reembolsos** (total do ano e quantidade);
rankings de **marcas** e **defeitos** mais comuns. Todos os cálculos em funções puras de `regrasPlacas.ts`, alimentadas por `listarPlacasParaFinanceiro(ano)`.

### 3.11 `/placas/fichas` — Fichas técnicas (splits)
Consulta de fichas por **fabricante, linha, modelo (evaporadora/condensadora) e capacidade** (busca única sem acento + filtros por fabricante e por BTUs), lista de cartões (fabricante, linha,
evaporadora/condensadora, BTUs, tensão) e **detalhe em painel** com as ficha agrupada em seções: **Identificação**, **Linha frigorífica** (gás, cobre líquido e sucção, distância mínima/padrão/máxima,
desnível, carga extra e de fábrica, regra de bitola), **Elétrica** (tensão, potência nominal e máxima, correntes de refrigeração/aquecimento/máxima, cabos, proteção) e **Notas** (observação, lacunas,
fonte, link do arquivo original). Veja os campos em `D:\BRV_Equipamentos\schema_fichas.sql` e a tela em `pages/ConsultaEquipamentos.jsx`. Campos vazios aparecem como "—", nunca em branco.
**Editar e excluir ficha: só admin** (modal com todos os campos, validação em português). Botão **"Cadastrar ficha com IA"** (admin e escritório) leva a 3.12. Tipos em `types/placas.ts`
(`PlacaFichaTecnica`, nomes dos campos no padrão do schema). Imprimir a ficha (A4 simples, portal em `document.body`).

### 3.12 Cadastrar ficha com IA (modal ou `/placas/fichas/nova`)
Arrastar ou escolher um **PDF ou TXT** de manual → estado "A IA está lendo o manual..." → formulário **pré-preenchido** com os campos extraídos, que o usuário **revisa e corrige** antes de salvar
(campos duvidosos marcados com "conferir" e as `lacunas` visíveis) → salvar. Referência: `pages/CadastrarEquipamentoIA.jsx`. Na demo, `extrairFichaDoManual(arquivo)` devolve uma ficha fixa depois de 2 s.
Erros em português ("Não foi possível ler este arquivo."), arquivo grande, formato errado.

### 3.13 `/placas/erros` — Códigos de erro e `/placas/assistente` — Assistente técnico
- **Códigos de erro:** campos **marca**, **modelo** (opcional) e **código ou sintoma** (ex.: "Erro E1 Midea Inverter ou CH05 LG"); resultado em cartão: significado, causas prováveis (em lista),
  o que verificar (passo a passo), componentes envolvidos, **aviso de segurança** quando houver e a **fonte** (manual do fabricante ou "pesquisa da IA", sempre identificada). Estado "A IA está pesquisando...",
  erro com "Tentar de novo" e histórico das últimas consultas (local, só na sessão). Referência: `pages/ConsultaErros.jsx`.
- **Assistente técnico (para a bancada):** campos **marca**, **código de erro**, **modelo da placa** e **sintoma observado** (texto livre); resposta estruturada: hipóteses ordenadas por probabilidade,
  testes de bancada sugeridos, componentes a medir, observações. Botão **"Usar na placa"**, que (quando aberto a partir do detalhe de uma placa) leva o resultado para o campo de diagnóstico. Referência:
  `pages/Reparos/AssistenteTecnicoIA.jsx`. Respostas de IA sempre com o rótulo **"Sugestão da IA: confirme na bancada"**.
- Na demo, `consultarCodigoErro(dados)` e `assistenteTecnico(dados)` devolvem textos fixos coerentes (3 ou 4 exemplos), com atraso simulado de 1,5 s.

### 3.14 `/placas/manuais` — Manuais de fabricantes
Lista dos manuais usados pela IA e pelas fichas: fabricante, título/modelo, tipo (PDF/TXT), tamanho, data, se tem **texto extraído** (usado nas consultas de erro). Busca e filtro por fabricante. **Enviar manual**
(PDF/TXT, fabricante, título; admin e escritório) e **excluir** (só admin). Abrir o arquivo em outra aba. A extração do texto é do Claude: na demo, mostre "texto extraído" fixo. Estados de lista completos.
Referência: `pages/Reparos` (consulta de erros) e `supabase/functions/upload-manual` do sistema antigo (só para entender; o manual vira registro + arquivo).

## 4. Visual e acessibilidade
- Componentes em `src/components/placas/` (ex.: `KanbanPlacas`, `CartaoPlaca`, `PlacaDetalhes`, `NovaPlacaModal`, `OrcamentoPlacaDocumento`, `ComprovanteEntradaDocumento`, `TermoGarantiaDocumento`,
  `EtiquetaPlacaModal`, `HistoricoPlaca`, `FotosPlaca`, `ClientesPlacas`, `FinanceiroPlacas`, `NavegacaoPlacas`, `FaixaDadosDemo`-reaproveitada do PMOC) e páginas em `src/pages/` (`PlacasKanban.tsx`,
  `PlacasClientes.tsx`, `PlacasFinanceiro.tsx`, `AcompanhamentoPlaca.tsx`). Cores das etapas num só lugar (`components/placas/cores.ts`).
- Faixa discreta "Dados de demonstração" no topo enquanto `FONTE_DADOS_DEMO` for `true` (a do PMOC já existe), oculta na impressão.
- Funciona no celular (Gustavo na bancada, parceiro olhando o link), botões com texto ou `aria-label`, foco visível, contraste.
- Valores com `valorEmReais`/formatadores existentes; datas com `utils/ordens.ts`; telefone com `formatarTelefone`; CPF/CNPJ com `utils/documento.ts`.

## 5. Papéis (esconder, não só bloquear)
| Papel | Vê |
|---|---|
| `admin`, `escritorio` | tudo **menos o financeiro das placas**: valores e orçamento, clientes de placas, fichas, erros, assistente e manuais |
| `admin`/`escritorio` **com o acesso ao financeiro das placas** (hoje só o Braulio) | o acima **mais** o menu/tela Financeiro, o dashboard, o valor cobrado e o reembolso |
| `oficina` (Gustavo) | Kanban e detalhes da bancada, fotos, histórico, clientes de placas (só leitura), **sem valores, orçamento, reembolso e financeiro** |
| público (`/placa/:token`) | só a página de acompanhamento |
Use `useAuth()` (`profile.role`) como as telas existentes. **Para o financeiro use SEMPRE `podeVerFinanceiroPlacas(profile)` de `src/utils/acessoPlacas.ts`** (já existe, é do Claude; lê a marca
`board_finance_access` do perfil, que **não é papel**: um admin comum sem a marca não vê). Quem não tem a marca: o item "Financeiro" some do menu, `/placas/financeiro` mostra "Acesso restrito" (como o PMOC para técnico),
os campos de reembolso e valor cobrado ficam ocultos, e o **valor do orçamento continua visível** para admin e escritório (o escritório faz o orçamento). Na demo, para ver o financeiro você precisa estar logado
como o Braulio (marca já dada pela migration `20261109120000_acesso_financeiro_placas.sql`). O banco repetirá as regras.

## 6. Dados de demonstração (`dadosDemo.ts`)
Fictícios e sem dado real: **3 parceiros instaladores, 1 cliente final e 1 cliente do Control** (para a retirada de campo), telefones `(21) 9XXXX-0000`, CPF/CNPJ sintéticos válidos.
**Apoio técnico:** cerca de **8 fichas técnicas** de fabricantes e linhas variados (fictícias, mas com campos realistas e alguns vazios/lacunas), **5 manuais** (PDF e TXT, um sem texto
extraído), 3 respostas fixas de código de erro e 2 do assistente.
Cerca de **14 placas** espalhadas por todas as etapas, **2 garantias** (uma ligada à original), **1 sem conserto**, **1 reembolsada**, **3 encalhadas**, estados de orçamento variados, com
histórico e fotos (SVG embutido). Para o financeiro: entregues em **vários meses do ano** (com valores, uma com reembolso) e algumas na bancada em aberto. Números no formato `OS-DDMMAA-NNN`.

## 7. O que NÃO fazer
Ditado por voz, leitura de foto por IA na nova placa, chamar o Gemini/IA de verdade (são Edge Functions do Claude; na demo as respostas são fixas), ZPL, gravar no banco, migration, importador, texto da ajuda F1, botão "Recolher placa" no app de campo,
alterar clientes do Control, mexer em `components/oficina/` além do necessário para reaproveitar (prefira importar, não editar).

## 8. Ajuda (F1)
Regra fixa: tela só fica pronta com a ajuda, mas **os textos são do Claude** (`src/ajuda/`, não mexa). Liste no resumo o **nome exato** de cada botão, aba, campo e selo que você criou.

## 9. Contrato de dados (`src/components/placas/fonteDeDados.ts`, todas assíncronas, demo em memória)
Tipos em `src/types/placas.ts` (nomes de campo em inglês, no padrão do banco, com comentário em português). Funções, com o comportamento esperado no banco:

| Função | Faz |
|---|---|
| `listarPlacas(filtro)` | placas em andamento ou finalizadas (paginar finalizadas, 50), com cliente resolvido (`board_client` ou cliente do Control), `days_in_stage`, `stalled` |
| `buscarPlaca(id)` | placa completa + técnicos + OS do Control (se houver) |
| `criarPlaca(dados)` | cria, gera `board_number` `OS-DDMMAA-NNN` e o `public_token`, grava histórico |
| `atualizarPlaca(id, campos)` | só campos alterados; papel `oficina` não altera valor/orçamento/reembolso |
| `moverPlaca(id, etapa, extra?)` | muda etapa (`extra`: data de saída, motivo de sem conserto); valida com `podeMoverPlaca` |
| `registrarOrcamento(id, dados)` / `registrarEnvioOrcamento(id)` / `registrarRespostaOrcamento(id, dados)` | valor, validade, CPF/CNPJ, endereço, parecer; envio; aprovado/recusado + canal |
| `registrarReembolso(id, dados)` | valor, data, motivo |
| `arquivarPlaca(id)` / `cancelarPlaca(id, motivo)` / `reabrirPlaca(id)` | conforme seção 2 |
| `gerarNovoLinkAcompanhamento(id)` | novo `public_token`, revoga o anterior |
| `anotarNoHistorico(id, nota)` / `historicoDaPlaca(id)` | linha do tempo |
| `fotosDaPlaca(id)` / `anexarFotoPlaca(arquivo, id, categoria, legenda?)` / `excluirFotoPlaca(fotoId)` | fotos (demo: URL local) |
| `listarClientesPlacas(filtro)` / `salvarClientePlaca(dados)` / `excluirClientePlaca(id)` | cadastro paralelo; excluir barra se tiver placas |
| `placasDoCliente(clienteId)` | histórico no cadastro |
| `buscarOsControl(numero)` | OS do Control para a retirada de campo (cliente, endereço, técnico, relato) |
| `listarTecnicos()` | nomes para retirada e bancada |
| `listarPlacasParaFinanceiro(ano)` | entregues/reembolsos do ano e em aberto, para o dashboard |
| `listarFichas(filtro)` / `buscarFicha(id)` | fichas técnicas (busca sem acento, fabricante, BTUs) |
| `salvarFicha(dados)` / `excluirFicha(id)` | só admin (o banco repete a regra) |
| `extrairFichaDoManual(arquivo)` | **IA (Edge Function do Claude)**: devolve a ficha pré-preenchida com `lacunas`; demo fixa |
| `consultarCodigoErro({ marca, modelo?, consulta })` | **IA**: significado, causas, verificações, componentes, aviso de segurança, fonte; demo fixa |
| `assistenteTecnico({ marca, codigoErro, modeloPlaca, sintoma })` | **IA**: hipóteses, testes, componentes a medir; demo fixa |
| `listarManuais(filtro)` / `enviarManual(arquivo, dados)` / `excluirManual(id)` | manuais de fabricantes (arquivo na HostGator, texto extraído no servidor) |
| `buscarAcompanhamentoPublico(token)` | dados **seguros** da página pública (3.8) |
| `gerarPdfOrcamento(id)` / `gerarPdfTermo(id)` | `Blob` (demo); **TODO(Claude)** |
| `pedirEtiquetaPlaca(id, copias)` / `situacaoImpressora()` | **stubs** (o Claude liga à fila da Elgin) |

## 10. Resumo para auditoria (entrega obrigatória): `docs/gemini/placas.md`
Siga as seções do PMOC (`docs/gemini/pmoc.md`): **1.** arquivos criados e alterados; **2.** telas e rotas (quem abre); **3.** contrato de dados que o Claude precisa implementar (funções acima e
tipos, com colunas e tabelas que você supôs); **4.** regras de negócio implementadas no front, uma a uma (inclusive as **fórmulas do financeiro**, o 4 dias de encalhada e os 90 dias de garantia);
**5.** premissas e decisões suas; **6.** pendências e limitações (o que não testou, o que ficou `TODO(Claude)`: PDF, QR, ZPL, WhatsApp com anexo); **7.** saída exata de `typecheck`, `lint` e `build`;
**8.** como testar (login de admin, escritório e oficina; os 3 papéis na tela; as rotas; a página pública com um token da demo); **9.** nomes exatos de botões, abas, campos e selos para a ajuda F1;
**10.** a lista dos **textos jurídicos copiados literalmente** (comprovante, termo de garantia, orçamento) para o Braulio revisar. Seja exato e honesto sobre o que fez, o que ficou incompleto e o que não testou.
