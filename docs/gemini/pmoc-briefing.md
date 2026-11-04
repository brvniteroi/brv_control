# Tarefa para o Gemini: módulo PMOC (Plano de Manutenção, Operação e Controle)

Leia antes: `GEMINI.md` e `CLAUDE.md`. Siga as regras do `GEMINI.md` (português em tudo, sem mexer em `services/` nem
`migrations/`, `typecheck` + `lint` + `build` sem erro nem aviso, **sem push**).

Neste trabalho você entrega **telas e documentos impressos**. A parte de banco de dados e consultas é do Claude e vem
depois; por isso você trabalha contra uma camada de dados de demonstração (seção "Como ligar os dados"). Leia a seção
"Resumo para auditoria" no fim: ela é uma entrega obrigatória.

## 1. Contexto de negócio

A BRV Niterói Elétrica e Refrigeração faz manutenção de ar-condicionado. Clientes comerciais precisam, por lei, de um **PMOC**
(Lei Federal 13.589/2018, Portaria MS 3.523/1998, Resolução RE 09/ANVISA): um plano anual de manutenção dos aparelhos de
climatização de um local, com cronograma de tarefas e responsável técnico. A BRV vende o PMOC como contrato recorrente: o plano
vale 12 meses, e todo mês os técnicos visitam o cliente e executam o checklist de cada aparelho.

O responsável técnico é um **técnico industrial registrado no CFT** (Conselho Federal dos Técnicos Industriais), não um
engenheiro. Por isso o registro é "CFT" e o termo de responsabilidade é o **TRT**, não "CREA/ART" como no modelo do Field Control.
Deixe o tipo do registro selecionável (CFT ou CREA) e o rótulo do número ("TRT" ou "ART") acompanhar a escolha.

O sistema atual (Field Control) tem um PMOC de exemplo, e a BRV adaptou esse modelo. **Os dois estão na raiz do repositório e você
deve abri-los e seguir a estrutura**: `PMOC Field Control.docx` (original) e `PMOC BRV Control.docx` (versão da BRV, é o layout
a reproduzir). Os dados dentro deles são só exemplo (inclusive o "CREA 123456789" e "ART-1234", que são falsos): **nunca
copie esses números para o código**.

## 2. Estrutura do documento PMOC (o que o plano precisa produzir)

Reproduza fielmente estas partes, nesta ordem, no documento imprimível:

- **Capa**: logo (`/logobrvcontrol.png`), "PLANO DE MANUTENÇÃO, OPERAÇÃO E CONTROLE (PMOC)", subtítulo "PMOC Oficial - BRV Niterói
  Elétrica e Refrigeração Ltda", frase legal ("Documento emitido e mantido pela BRV Niterói Elétrica e Refrigeração Ltda através do
  sistema BRV Control, em cumprimento à Lei Federal nº 13.589/2018, Portaria MS nº 3.523/1998 e Resolução RE nº 09/ANVISA."),
  início e fim do período, "Elaborado por", responsável técnico com registro (CFT/CREA) e TRT/ART.
- **1. Identificação do endereço do PMOC**: nome/razão social do cliente, CPF/CNPJ, endereço completo, complemento, e-mail, telefone.
- **2. Identificação do responsável técnico**: razão social e CNPJ da BRV, e-mail, telefone, endereço, nome do responsável, CPF,
  registro (CFT/CREA), TRT/ART, e linha de **assinatura do técnico responsável**.
- **3. Identificação dos ambientes climatizados**: tabela com nome do ambiente, número de ocupantes (fixos/flutuantes) e área
  climatizada em m². (No modelo as colunas estão trocadas, com "60 | 250"; faça certo: ocupantes fixos, ocupantes flutuantes, área.)
- **4. Identificação dos equipamentos**: tabela com ambiente, tipo (ex.: Split Hi Wall), nome, carga térmica (BTUs), identificador
  (ex.: `AR-SR-0001`) e foto.
- **5. Cronograma de atividades**: um bloco por equipamento, com letra (A, B, C...), nome, identificador e BTUs no título; abaixo, a
  tabela numerada de tarefas com **periodicidade** (Mensal, Trimestral, Semestral) e **inicia em** (mês, ex.: "Maio").
- **6. Recomendações**: tabela fixa "Descrição da situação / Recomendação" (4 linhas, texto exato no `PMOC BRV Control.docx`).
- **Anexo**: "Anexo - TRT (ou ART)": área para o PDF/imagem do termo de responsabilidade técnica.
- **Rodapé** de todas as páginas: "Criado em {data} pela plataforma BRV Control".

Dados da BRV (constantes do documento): BRV Niterói Elétrica e Refrigeração Ltda, CNPJ 07.320.361/0001-64, e-mail
brvniteroi@gmail.com, telefone (21) 97018-8046, Estrada Francisco da Cruz Nunes 10112, Niterói - RJ, CEP 24340-000.
Coloque tudo num único arquivo `src/components/pmoc/empresa.ts` (o Claude depois move para o banco). Nome, CPF e registro do
responsável técnico **não** são constantes: vêm do plano.

### Modelo padrão de tarefas (equipamento tipo split)

22 tarefas, na ordem do modelo da BRV. Mensais (1 a 18), trimestrais (19 e 20), semestrais (21 e 22); "inicia em" = mês de início
do plano.

1. Verificar estado de fiação, terminais e contatos elétricos (Mensal)
2. Medir e registrar corrente elétrica ventilador/compressor (Mensal) **[medição: A]**
3. Medir e registrar temperatura ar insuflamento, retorno e ambiente (Mensal) **[medição: 3 valores em °C]**
4. Efetuar reaperto dos terminais, parafusos e molas (Mensal)
5. Limpar bandeja condensação e dreno e sua operação (Mensal)
6. Verificar a vedação dos painéis de fechamento do gabinete (Mensal)
7. Verificar a tensão das correias, para evitar o escorregamento nas polias (Mensal)
8. Lavar as serpentinas e bandejas com remoção do bio-filme (lodo) sem o uso de produto desengraxante e corrosivo (Mensal)
9. Limpar o gabinete do condicionador e ventiladores (carcaça e rotor) (Mensal)
10. Verificar o funcionamento da resistência de aquecimento do cárter (Mensal)
11. Verificar filtro e secador (Mensal)
12. Verificar carga de gás refrigerante e vazamentos (Mensal)
13. Verificar nível de óleo do compressor (Mensal)
14. Verificar a operação da válvula de expansão (Mensal)
15. Verificar e calibrar os dispositivos de segurança (pressostatos de alta/baixa e óleo) (Mensal)
16. Verificar resistência de isolamento dos motores e compressores (Mensal)
17. Verificar e calibrar os dispositivos de segurança, relés térmicos e fusíveis (Mensal)
18. Verificar a calibragem e regulagem do termostato de controle de temperatura do ambiente (Mensal)
19. Eliminar danos e sujeiras e corrosão no gabinete, na moldura da serpentina e na bandeja (Trimestral)
20. Verificar e eliminar sujeiras, danos e corrosão (Trimestral)
21. Limpeza de condensador (Semestral)
22. Verificar protetor térmico compressor (Semestral)

Várias tarefas não se aplicam a um split pequeno (correias, resistência do cárter, nível de óleo, pressostatos). Por isso o
cronograma é **editável por plano e por equipamento**: o escritório pode desativar uma tarefa, trocar a periodicidade (Mensal,
Bimestral, Trimestral, Semestral, Anual) e o mês de início. O modelo padrão também deve ser editável (tela "Modelo de tarefas").

## 3. Telas a entregar (escritório e admin; celular só precisa não quebrar)

Rotas novas em `src/App.tsx` e item "PMOC" no menu `src/components/Sidebar.tsx`, grupo **Serviços**, visível só para
escritório/admin (copie como o menu já esconde itens, como em `/formularios`).

### Entrega 1: lista de planos, `/pmoc` (`src/pages/Pmoc.tsx`)
Tabela/cartões com: cliente, endereço, vigência (início a fim), nº de equipamentos, **próxima visita** (mês), **situação** em selo
colorido: Rascunho (cinza), Vigente (verde), Vence em até 60 dias (âmbar, mostra "vence em N dias"), Vencido (vermelho),
Encerrado (cinza escuro). Busca por cliente, filtro por situação, botão "Novo plano". Estados carregando, erro com "Tentar de novo"
e vazio. Resumo no topo: quantos vigentes, quantos vencendo, quantas visitas atrasadas.

### Entrega 2: editor do plano, `/pmoc/:id` e `/pmoc/novo` (`src/components/pmoc/`)
Cabeçalho com cliente, situação, botão Salvar e "Documento (imprimir/PDF)". Abas:
- **Geral**: cliente (reutilize `SeletorCliente` de `src/components/ordens/`), endereço (os endereços do cliente, como na OS),
  início e fim da vigência (fim sugerido = início + 12 meses menos 1 dia, editável), responsável técnico (lista de técnicos/colaboradores
  ativos), tipo de registro (CFT/CREA), número do registro, número do TRT/ART, observações. Situação do plano.
- **Ambientes**: tabela editável (adicionar/remover/duplicar linha): nome, **sigla** (2 a 3 letras maiúsculas, usada no
  identificador; sugerir automaticamente pelas iniciais do nome e avisar se repetir), ocupantes fixos, ocupantes flutuantes, área em m².
  Totais no rodapé. Validar nome e sigla únicos no plano.
- **Equipamentos**: tabela com ambiente (select dos ambientes do plano), tipo, nome, BTUs, identificador, foto. Botão "Adicionar
  equipamento do cliente" (escolhe entre os equipamentos já cadastrados do cliente, que têm categoria, marca, modelo, capacidade BTU
  e local) e "Cadastrar novo" (leva ao cadastro de equipamentos). **Identificador automático**: `AR-<SIGLA>-<0001>`, sequência por sigla
  dentro do plano (`AR-SR-0001`, `AR-SR-0002`, `AR-CZ-0001`), editável, único no plano. Foto: miniatura que amplia; trocar/remover.
  Equipamento sem ambiente aparece com alerta "Escolha o ambiente".
- **Cronograma**: um bloco recolhível por equipamento (título "A · Split da Sala de Reunião · AR-SR-0001 · 12.000 BTUs") com a
  tabela de tarefas (número, descrição, periodicidade, mês de início, ativa). Ações: "Aplicar modelo padrão", "Copiar cronograma
  para os outros equipamentos do mesmo tipo", reordenar tarefas, adicionar tarefa avulsa, desativar tarefa (fica riscada, não
  entra no documento). Ao lado, uma **visão anual**: grade com os 12 meses (a partir do mês de início do plano) mostrando quantas
  tarefas caem em cada mês para cada equipamento.
- **Execução**: grade equipamentos x 12 meses. Cada célula mostra o estado da visita do mês: Prevista (azul), Concluída (verde),
  Atrasada (vermelho), Não se aplica (cinza). Clicar abre um painel com a OS ligada (número, técnico, data), as tarefas do mês e o
  link "Ver relatório". Botão "Gerar OS do mês" (só chama a função da camada de dados e mostra o resultado).
- **Documento**: pré-visualização do PMOC (Entrega 3) dentro da aba, com os botões "Imprimir / PDF".

### Entrega 3: documento PMOC imprimível (`DocumentoPmoc.tsx`)
Segue a seção 2. Usa `window.print()` com `@media print` / variantes `print:` do Tailwind: A4 retrato, margens de ~15 mm, sem menus
e botões, cabeçalho de tabela repetido ao quebrar página, **cada bloco de equipamento do cronograma sem quebrar no meio quando
couber**, rodapé "Criado em {data} pela plataforma BRV Control" em todas as páginas, numeração de página se possível.
A foto do equipamento vai na tabela do item 4. O anexo do TRT/ART mostra a miniatura/PDF enviado ou o aviso "TRT/ART não anexado".

### Entrega 4: relatório mensal de execução imprimível (`RelatorioExecucaoPmoc.tsx`)
Documento de um mês de um plano (é o que o cliente recebe depois da visita): cabeçalho com cliente, endereço, plano, mês de
referência, técnico que executou e data; para cada equipamento atendido, a lista das tarefas do mês com o resultado
(Feito / Não feito / Não se aplica), as **medições** (corrente em A; temperaturas de insuflamento, retorno e ambiente em °C),
observações do técnico, fotos (miniaturas) e, no fim, "Responsável técnico" com nome, registro e linha de assinatura. Também em A4
com `window.print()`. Equipamentos do plano que não foram atendidos naquele mês aparecem em uma seção "Não atendidos" com o motivo.

### Entrega 5: modelo de tarefas (`/pmoc/modelo`)
Tela para editar o modelo padrão por **tipo de equipamento** (split hi-wall, cassete, piso-teto, VRF...): lista das tarefas com
periodicidade, mês de início relativo (mês 1 = mês de início do plano), se exige medição e quais. Reordenar, adicionar, remover.
Aviso fixo: "Alterar o modelo não muda planos já criados."

## 4. Como ligar os dados (importante)

Você não pode tocar em `src/services/`. Faça assim:

1. Crie `src/types/pmoc.ts` com os tipos do módulo (plano, ambiente, equipamento do plano, tarefa, execução mensal, medições,
   modelo de tarefas). Pense nos campos descritos acima; o Claude vai criar as tabelas a partir deles, então **nomeie os campos em
   inglês no padrão do banco** (`customer_id`, `start_date`, `end_date`, `capacity_btu`, `created_at`...) e comente cada um.
2. Crie `src/components/pmoc/fonteDeDados.ts`: **o único arquivo que as telas usam para ler e gravar**. Exporte funções assíncronas
   com assinaturas claras (`listarPlanos`, `buscarPlano`, `salvarPlano`, `listarAmbientes`/`salvarAmbientes`, `listarEquipamentosDoPlano`,
   `buscarCronograma`/`salvarCronograma`, `listarExecucoes`, `gerarOsDoMes`, `buscarRelatorioMensal`, `listarModelosDeTarefa`,
   `salvarModeloDeTarefa`, e o que mais precisar). Hoje elas leem e gravam **dados de demonstração em memória** definidos em
   `src/components/pmoc/dadosDemo.ts` (2 clientes fictícios, 3 ambientes, 5 equipamentos, cronograma completo, execuções em estados
   variados: concluída, atrasada, prevista). Quando o Claude trocar o corpo dessas funções pelo Supabase, as telas não devem mudar.
3. Para o que já existe no sistema (clientes, endereços, técnicos, equipamentos de um cliente), **use os services reais** que já
   existem (`src/services/clientes.ts`, `ordens.ts`, `equipamentos.ts`, `equipe.ts`). O que não existir, entre na `fonteDeDados`.
4. Nunca deixe dado de demonstração no meio dos componentes: ele só pode estar em `dadosDemo.ts`. Marque no topo da tela, em faixa
   discreta visível só enquanto a fonte for de demonstração, "Dados de demonstração".

## 5. Regras de interface

- Siga o padrão visual existente (`Clientes.tsx` para lista, `OrdemDetalhes.tsx` para formulário/abas, `GradeTempo.tsx` para grades).
  Tailwind 4 e lucide-react; **nenhuma biblioteca nova** (se achar que precisa de uma, descreva no resumo e não instale).
- Datas com `src/utils/ordens.ts`, telefone com `formatarTelefone`, CPF/CNPJ com `utils/documento.ts`, BTUs com separador de
  milhar (`12.000 BTUs`), área com vírgula (`15,5 m²`).
- Validação antes de salvar, com mensagem em português e sem termo técnico. Todo botão que grava mostra "Salvando..." e bloqueia
  clique duplo. Aviso ao sair com alterações não salvas.
- Acessibilidade básica: rótulos nos campos, foco visível, contraste suficiente nos selos de situação.
- Toda tabela larga rola na horizontal no celular em vez de quebrar o layout.

## 6. O que NÃO fazer

- Não altere `supabase/`, `src/services/`, `src/contexts/`, `src/components/campo/`, `src/pages/campo/`, `public/sw.js`, `android/`.
- Não crie rota ou tela no app do técnico (`/campo`): a execução do checklist no celular o Claude faz depois, pelo motor de
  formulários que já existe.
- Não implemente QR code, envio por WhatsApp/e-mail, portal do cliente nem cobrança. São fases futuras.
- Não invente dados reais: nada de nome de cliente, CPF, CNPJ ou registro profissional verdadeiro no código (só os dados da BRV
  em `empresa.ts`).

## 7. Ordem sugerida

Tipos e `fonteDeDados` + dados de demonstração, depois Entrega 1, 2 (Geral, Ambientes, Equipamentos, Cronograma, Execução), 3, 4 e
por último 5. Entregue por partes se for grande, mas cada parte deve fechar com typecheck, lint e build limpos.

## 8. Resumo para auditoria (entrega obrigatória): grave em `docs/gemini/pmoc.md`

Quando terminar, **escreva o arquivo `docs/gemini/pmoc.md`** (o Claude vai auditar o código contra ele). Seja exato e honesto:
só registre o que de fato foi feito e verificado, e diga claramente o que ficou incompleto. Use estas seções, nesta ordem:

1. **Arquivos criados e alterados**: lista com o caminho de cada arquivo e uma linha dizendo o que ele faz. Separe "criados" de
   "alterados" (e, nos alterados, diga o que mudou, principalmente em `App.tsx` e `Sidebar.tsx`).
2. **Telas e rotas**: cada rota, quem pode abrir, e quais entregas (1 a 5) ela cobre.
3. **Contrato de dados que o Claude precisa implementar**: tabela com cada função de `fonteDeDados.ts` (nome, parâmetros, retorno) e,
   para cada tipo de `src/types/pmoc.ts`, os campos e o que eles guardam. Marque o que depende de tabela/coluna nova no banco, o que
   depende de coluna nova em tabela existente (ex.: nome e ambiente em `equipments`) e o que precisa de regra no servidor (geração do
   identificador `AR-SIGLA-0001`, geração das OS do mês, cálculo de situação e de visita atrasada).
4. **Regras de negócio implementadas no front** (validações, cálculo de vigência, sugestão de sigla, situação "vence em N dias",
   etc.) com o arquivo onde cada uma está, para o Claude decidir o que sobe para o banco.
5. **Premissas e decisões** que você tomou onde o briefing era ambíguo.
6. **Pendências e limitações**: o que não foi feito, o que foi feito só pela metade, comportamentos que você não conseguiu
   testar (impressão em A4, celular, etc.).
7. **Verificação**: cole a saída final de `npm run typecheck`, `npm run lint` e `npm run build`.
8. **Como testar**: passo a passo para abrir cada tela e o documento impresso com os dados de demonstração.

Avise o Braulio ao terminar. Não faça commit nem push.
