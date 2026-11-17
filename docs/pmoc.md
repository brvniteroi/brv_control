# Implantação do módulo PMOC no BRV Control

Plano escrito em 2026-11-16. Base: telas do Gemini (auditadas em 2026-11-04, ainda com dados de demonstração), briefing
`docs/gemini/pmoc-briefing.md`, contrato de dados `docs/gemini/pmoc.md`, modelos `PMOC BRV Control.docx` e `PMOC Field Control.docx`
(raiz do repositório) e uma pesquisa de como os sistemas vendidos no Brasil fazem o PMOC (seção "O que o mercado faz").

**Nada do banco foi feito ainda.** Este documento fecha as decisões antes da primeira migration. As decisões que dependem do usuário
estão na seção "Decisões que preciso do usuário", cada uma com a recomendação.

## O que é o PMOC para a BRV

Plano anual de manutenção dos aparelhos de climatização de um local (Lei 13.589/2018, Portaria MS 3.523/1998, Resolução RE 09/ANVISA).
A BRV vende como contrato recorrente: o plano vale 12 meses e, todo mês, um técnico visita o cliente e executa o checklist de cada aparelho
conforme o cronograma (tarefas mensais, trimestrais, semestrais). O responsável técnico é técnico industrial com registro no **CFT** e o
termo de responsabilidade é o **TRT** (não CREA/ART).

## O que já existe

- **Telas** (rotas `/pmoc`, `/pmoc/novo`, `/pmoc/:id`, `/pmoc/modelo`; item do menu oculto em `Sidebar.tsx`): lista de planos com situação
  (rascunho, vigente, vence em N dias, vencido, encerrado), editor com abas Geral, Ambientes, Equipamentos, Cronograma e Execução (grade
  equipamento x mês), documento PMOC imprimível (`DocumentoPmoc.tsx`), relatório mensal imprimível (`RelatorioExecucaoPmoc.tsx`) e modelo
  de tarefas por tipo de aparelho (`PmocModelo.tsx`). Regras de tela em `src/components/pmoc/regrasPmoc.ts`; dados de demonstração em
  `src/components/pmoc/fonteDeDados.ts` e `dadosDemo.ts` (somem ao recarregar a página).
- **No banco, reaproveitável:**
  - `equipments` (cadastro de aparelhos do cliente, com endereço) já tem a coluna `qr_code TEXT UNIQUE` reservada para etiqueta patrimonial/PMOC.
  - `form_responses` (motor de formulários) já tem `equipment_id`; `attachments` aceita foto ligada a `equipment_id`.
  - `service_order_equipments` liga OS a equipamentos.
  - `funcionario_dados` (desde 2026-11-08) tem CPF e registro profissional do técnico (RLS **só admin**).
- **Peças prontas de outros módulos:** etiqueta com QR na Elgin pela fila de impressão (`utils/etiquetaOficina.ts`, `utils/etiquetaPlaca.ts`);
  páginas públicas por link com token (`/placa/<token>`, `/orcamento-placa/<token>`, `/avaliar/<token>`); envio por WhatsApp com a aba aberta
  no clique (`prepararJanelaWhatsApp`); e-mail pela HostGator (`enviar-avaliacao.php`); fila do app de campo sem internet (`services/filaCampo.ts`).

## O que o mercado faz (pesquisa de 2026-11-16)

Não há dado público de participação de mercado. Os nomes que mais aparecem: **Auvo** (PMOC é módulo pago à parte), **Field Control**
(PMOC gratuito, exige o módulo de Equipamentos), **Produttivo** (planos de atividades recorrentes) e os específicos **Meu Pmoc** (plano grátis,
cobra por equipamento), **Saalao**, **LEAD-MMS**, **Matum**. Preços quase sempre sob consulta.

Fluxo comum a todos: cliente e contrato (vigência, responsável, ART/TRT) → ambientes e equipamentos → tarefas com periodicidade e cronograma
automático → **OS preventivas geradas na data** com painel do que está em dia e vencido → **checklist no celular** (itens obrigatórios, medições,
fotos, GPS, início e fim, assinatura; vários funcionam sem internet) → **relatório em PDF por e-mail ou WhatsApp** → histórico por equipamento
→ renovação.

Diferenciais mais citados: **QR Code colado em cada aparelho** que abre uma **página pública, sem login**, onde o cliente e o **fiscal da vigilância
sanitária** veem o histórico; **QR no laudo** para conferir que não foi alterado; aviso de vencimento do contrato. O QR não é exigência legal
(não achei norma que o peça); é argumento de venda, útil também se o sistema for vendido (pedido do usuário de 2026-11-08).

**Incluído neste plano por decisão do usuário (2026-11-16):** QR Code por equipamento com página pública e OS do mês gerada pelo sistema.

## Como encaixa no Control (proposta)

### 1. Equipamento do PMOC = equipamento do cadastro do cliente

O plano não cria um cadastro paralelo de aparelhos: `pmoc_plan_equipments` liga o plano a `equipments` e guarda o que é do plano (ambiente,
identificador `AR-<SIGLA>-0001`, nome no documento, tarefas). Assim o QR, as fotos, as OS e o histórico ficam no aparelho e continuam valendo
na renovação (plano novo do ano seguinte reaproveita os mesmos aparelhos). Aparelho que sai do local: desativa no plano, não apaga.

### 2. Tabelas (do contrato do Gemini, com ajustes)

`pmoc_plans` (código `PMOC-AAAA-NNNN` por sequência com trava, cliente, endereço, vigência, situação, responsável técnico, TRT, anexo do TRT),
`pmoc_environments` (nome, sigla, ocupantes fixos e flutuantes, área), `pmoc_plan_equipments` (ver item 1), `pmoc_equipment_tasks` (descrição,
periodicidade, mês de início, exige medição, ativa), `pmoc_executions` (plano, equipamento, mês de referência, situação, resultado de cada tarefa,
medições, técnico, atividade/OS de origem), `pmoc_task_templates` + `pmoc_task_template_items` (modelo por tipo de aparelho, com as 22 tarefas
da BRV já cadastradas). RLS: admin e escritório leem e gravam; técnico só lê e preenche as execuções das próprias atividades; excluir plano só admin.
Histórico de alterações do plano no mesmo padrão de `board_events`.

### 3. Responsável técnico (CPF e registro)

O documento precisa de nome, CPF e registro do responsável, que estão em `funcionario_dados` (só admin). Proposta: quando o plano passa a
**vigente**, o banco copia nome, CPF e registro para o plano (cópia congelada, como o documento assinado), por uma função que só devolve esses
três campos do funcionário escolhido. O escritório escolhe o responsável e imprime o documento sem enxergar os outros dados pessoais.

### 4. TRT em PDF

`hostgator-api/upload.php` hoje só aceita imagem. Liberar `application/pdf` (até 10 MB) só para admin e escritório e só para o anexo do plano
(pasta `uploads/pmoc/`). Mesmo caminho servirá para laudos de qualidade do ar, se o cliente tiver (item 10).

### 5. OS do mês (gerada pelo sistema)

Regra atual do Control: toda atividade nasce **agendada com técnico, data e hora**, e uma atividade por OS. Por isso o sistema não consegue
agendar a visita sozinho (não sabe o técnico nem o horário). Proposta:
- Painel **"PMOC do mês"** (na tela do PMOC e um cartão no Dashboard): planos vigentes com visita prevista no mês e a situação de cada um
  (sem OS, OS agendada, executada, atrasada).
- Botão **"Gerar OS do mês"** por plano (e "Gerar todas"): cria a OS do tipo "PMOC" do mês, já com os equipamentos e a lista de tarefas do mês,
  e abre a escolha de técnico, data e hora (o mesmo `NovaAtividadeModal`). Uma OS por plano por mês (função `gerar_os_mes_pmoc`, que não
  duplica). Cliente grande que precisa de dois técnicos: segunda OS ligada ao mesmo plano e mês (segue a regra "segundo técnico = OS nova").
- Alternativa (decisão 2): gerar as OS do mês sozinho no dia 1, ainda sem atividade, e o escritório só agenda.

### 6. Checklist no celular

Checklist **próprio do PMOC** na atividade (não o motor de formulários genérico), porque as tarefas mudam por mês e por aparelho e as medições
precisam ficar estruturadas por equipamento para o relatório e o histórico. Na atividade de PMOC, o técnico vê a lista de aparelhos; em cada um,
marca cada tarefa do mês como feita / não feita / não se aplica, preenche as medições pedidas (corrente, temperaturas de insuflamento, retorno e
ambiente) e tira fotos (ligadas ao aparelho). A atividade só conclui com todos os aparelhos preenchidos ou justificados ("não atendido": aparelho
desligado, sem acesso etc.). Grava em `pmoc_executions`. Fase 2 começa só online; sem internet entra depois, pela fila do app (fase 4).

### 7. QR Code por equipamento e página pública

- Cada aparelho do plano ganha um token em `equipments.qr_code` (aleatório, não adivinhável; trocar o token invalida a etiqueta antiga).
- **Etiqueta na Elgin** pela fila de impressão que já existe: logo/nome BRV, identificador (`AR-SR-0001`), ambiente, "Manutenção PMOC" e o QR.
- **Página pública** `/equipamento/<token>` (sem login, celular), por uma função do banco que só enxerga aquele aparelho: nome fantasia do cliente,
  local e ambiente, identificador, tipo e BTU; plano vigente (código, vigência, responsável técnico com registro e TRT); **últimas manutenções**
  (data, tarefas feitas, situação) e o link do último relatório mensal. Nunca mostra valores, telefone, endereço completo nem dados pessoais.
- Técnico: o QR também abre o aparelho no app de campo quando lido com o técnico logado (fase 4).
- O documento PMOC e o relatório mensal levam um QR para a página do plano (conferência de autenticidade).

### 8. Relatório mensal para o cliente

Ao concluir a atividade do mês, o relatório fica disponível por **link público** (token por plano e mês, como o orçamento das placas), com
"Salvar em PDF / Imprimir". O escritório envia pelo botão **"Enviar relatório pelo WhatsApp"** (e, se o cliente tiver e-mail, opção de e-mail,
fase 4). Portal do Cliente: o relatório aparece lá também quando o portal for usado.

### 9. Documento PMOC

Continua sendo o documento A4 da tela (imprimir / salvar em PDF), com o TRT no anexo e o QR de conferência. Sem gerador de PDF no servidor.

### 10. Pontos legais a confirmar (não bloqueiam o começo)

- Conferir o conteúdo mínimo do plano com o Anexo I da Portaria 3.523/1998 antes de liberar para clientes (o modelo da BRV veio do Field Control).
- A RE 09/ANVISA trata da qualidade do ar interior; análises de laboratório, quando o cliente fizer, entram como anexo do plano (o sistema não as
  produz). Confirmar com o usuário se a BRV contrata ou indica laboratório.

## Fases

| Fase | O que entra | Pronto quando |
|---|---|---|
| **1. Banco e telas ligadas** | migration `pmoc_base` (tabelas, RLS, código sequencial, modelo das 22 tarefas, histórico), cópia do responsável técnico, PDF no `upload.php`, `services/pmoc.ts`, `fonteDeDados.ts` ligada ao banco, verificação com ROLLBACK, menu liberado, **ajuda F1** | plano real cadastrado, documento impresso com TRT, sem dados de demonstração |
| **2. Execução mensal** | painel "PMOC do mês", `gerar_os_mes_pmoc`, tipo de OS "PMOC", checklist no app de campo (telas pelo Gemini, com briefing), grade de execução real, relatório mensal por link + WhatsApp, cartão no Dashboard, **ajuda F1** | um mês completo executado num cliente real e o relatório enviado |
| **3. QR e página pública** | token por aparelho, etiqueta na Elgin, página `/equipamento/<token>` (tela pelo Gemini), QR no documento e no relatório, **ajuda F1** | etiqueta colada num aparelho real e a página aberta pelo celular do cliente |
| **4. Melhorias** | checklist sem internet (fila do app), QR lido pelo app do técnico, e-mail do relatório, aviso de plano vencendo (60 dias) para renovação, renovar plano copiando o anterior, relatório no Portal do Cliente | conforme a necessidade |

Fora do PMOC: cobrança do contrato (fica com o módulo financeiro, `docs/financeiro.md`) e multiempresa (os dados da BRV no documento continuam em
`src/components/pmoc/empresa.ts` até existir o cadastro da empresa).

Divisão de trabalho de sempre: telas novas (checklist do app, painel do mês, página pública, etiqueta) com briefing para o Gemini; banco, services,
regras, impressão na Elgin e auditoria com o Claude.

## Riscos

- **Etiqueta no tempo:** a etiqueta da Elgin é de papel com fita. Em condensadora externa (sol e chuva) pode apagar. Testar; se apagar, usar
  etiqueta de poliéster (mesma impressora, outro rolo) só para o PMOC.
- **Checklist sem internet:** casa de máquinas e subsolo costumam ficar sem sinal. Na fase 2 o técnico preenche online; se for problema na
  prática, antecipar a fase 4.
- **Responsável técnico:** o documento só vale com CPF, registro e TRT reais. Plano vigente sem esses dados é barrado pelo banco.
- **Página pública:** o token precisa ser impossível de adivinhar e a página não pode mostrar nada além do aparelho e do plano.

## Decisões que preciso do usuário

1. **Equipamentos:** o aparelho do PMOC é o do cadastro do cliente (item 1)? *Recomendo sim.*
2. **OS do mês:** botão "Gerar OS do mês" com o escritório escolhendo técnico, data e hora na hora (item 5), ou o sistema cria as OS sozinho no dia 1
   e o escritório só agenda? *Recomendo o botão* (respeita a regra de toda atividade nascer agendada; com um painel mostrando o que falta).
3. **Checklist:** próprio do PMOC, por aparelho (item 6), ou o motor de formulários? *Recomendo o próprio.*
4. **Assinatura do cliente:** os sistemas do mercado pegam assinatura na tela; o Control tirou a assinatura do app em 2026-11-01. Para o PMOC:
   sem assinatura, só **nome de quem acompanhou a visita**, ou voltar com assinatura só no PMOC? *Recomendo só o nome* (mais rápido para o técnico;
   o registro do sistema com horário e GPS já comprova a visita).
5. **Relatório mensal:** por link pelo WhatsApp (item 8)? E o cliente recebe todo mês ou só quando pede? *Recomendo link todo mês, enviado pelo escritório.*
6. **Clientes atuais com PMOC:** quantos são hoje e com quais aparelhos? Entram cadastrados à mão (não há importação do Field para PMOC).
7. **Responsável técnico:** é sempre o Braulio (registro "CRT 96236361720" já gravado), ou pode ser outro técnico registrado?
8. **Laboratório de qualidade do ar (item 10):** a BRV contrata, indica ou não trata disso?
9. **Etiqueta:** confirmar o tamanho (mesmo rolo de 50 mm da Oficina) e se vale testar etiqueta de poliéster para as condensadoras externas.

## Ajuda F1 (regra fixa)

O módulo só fica pronto com a ajuda feita (`src/ajuda/topicos.ts`): seção "PMOC" com as telas lista, editor, modelo de tarefas, painel do mês e
execução; a rota em `telaDaRota`; e `useTelaAjuda` nos painéis que abrem por cima. Conferir em cada fase antes do commit final.
