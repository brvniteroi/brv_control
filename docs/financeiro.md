# Módulo financeiro: plano e decisões

Situação: **planejado, ainda não iniciado** (adiado pelo usuário em 2026-11-04). Nada deste documento existe no código nem no banco.
Ao retomar: ler este arquivo, conferir se algo mudou com o usuário e começar pela Etapa A.

Objetivo: substituir o SicWeb no financeiro, amarrado ao **recebimento dos serviços do dia a dia** (OS) e às **vendas da loja**.
Faz parte da "Plataforma completa / sair do SicWeb" (CLAUDE.md, Pendente item 3).

## Quem é quem (define as permissões)

- **Braulio** (sócio): técnico, equipe de campo, compras, estoque, reparo de placas; responsável técnico. Login `admin`.
- **Adriana** (sócia): diretora financeira e administrativa, ponte com contabilidade e jurídico; às vezes atende. Login `escritorio`.
- **Jéssica** (funcionária): atendimento, agendamento e **recebimento**. Ainda sem login no BRV Control.
- **Pedro** (filho dos sócios, à tarde): atendimento, separação de materiais, estoque; às vezes agenda e faz orçamentos. Ainda sem login.
- **Técnicos**: recebem do cliente em **dinheiro ou cartão (maquininha)** no local do serviço.

## Decisões tomadas

### Permissões: nível de acesso no perfil, não papel novo
O prompt original pedia um papel `financeiro`. **Não usar**: cada usuário tem um papel só, a Adriana precisa continuar com OS e agenda,
e um papel novo quebraria telas e regras que liberam só `admin`/`escritorio` (ProtectedRoute, páginas, RLS via `eh_escritorio()`, a lista
`PAPEIS` da Edge Function `gerenciar-usuario`). Em vez disso, campo no perfil `financial_access` (ou `acesso_financeiro`), escolhido pelo admin
na aba Usuários:

| Nível | Quem | Pode |
|---|---|---|
| **completo** | Adriana, Braulio (admin sempre tem) | Tudo: receber, pagar, saldos, transferências, estornos, cancelamentos, relatórios, cadastros (contas, categorias, fornecedores, maquininhas) |
| **caixa** | Jéssica, Pedro | Registrar recebimento (OS e venda de balcão), conferir recebimentos dos técnicos, ver o recebido no dia. **Não** vê contas a pagar, saldos de banco nem relatórios; **não** estorna |
| **nenhum** | técnicos e demais | Nada do financeiro |

`tecnico`, `cliente` e `anon` nunca têm acesso, qualquer que seja o campo. Todo lançamento grava automaticamente quem lançou e quando.

### Como o dinheiro entra
- **Técnico (dinheiro ou cartão)**: o técnico **não** tem acesso ao financeiro. Na conclusão da atividade, o app pergunta "Recebeu do cliente?"
  (valor, forma: dinheiro / débito / crédito com parcelas). Isso vira um **recebimento a conferir** ligado à OS (técnico, hora, GPS da
  conclusão), não um lançamento. Na volta, Jéssica ou Adriana conferem e confirmam: dinheiro entra no Caixa BRV quando é entregue na loja;
  cartão entra na conta da maquininha quando o comprovante bate. Painel para a Adriana: "dinheiro com técnicos ainda não entregue".
- **PIX**: o escritório envia a chave; quando o cliente paga, quem tem nível caixa registra o recebimento na OS escolhendo o banco.
- **Boleto**: raro. Título com vencimento e baixa manual. Emissão de boleto pelo sistema fica para a fase do PIX/boleto automático.
- **Venda de balcão (loja)**: sem esperar o catálogo de produtos, recebimento sem OS, cliente opcional ("Consumidor final"), categoria
  "Venda loja". Quando o catálogo existir, a venda com itens vira outra origem do título.
- **Recebimento à vista em um passo**: uma RPC cria título + parcela + baixa juntos (a maioria dos serviços e vendas é à vista).
  O caminho completo (parcelas e vencimentos) fica para o que é a prazo.

### Contas e maquininhas
- Contas iniciais: **Caixa BRV** (dinheiro), **Itaú**, **Caixa Econômica**, **Nubank**. Outras podem ser criadas pela tela.
- Maquininhas: **Rede** ("laranjinha", do Itaú) e **InfinitePay**. Crédito cai no **dia seguinte** (antecipação), no **Itaú**.
  **Conferir com o usuário**: a InfinitePay costuma depositar na conta da própria InfinitePay; se for o caso, ela vira uma quinta conta.
- Cadastro de maquininhas com a conta de liquidação e as taxas (débito, crédito à vista, crédito parcelado). Ao confirmar um recebimento
  em cartão: lança o **valor bruto** na conta da maquininha com data no **dia útil seguinte** e a **taxa como tarifa** (calculada pelo
  percentual, ajustável na hora). Assim o saldo do Itaú bate com o extrato.

### Modelo e regras (do prompt original, mantidos)
- Dinheiro em `numeric(14,2)`, nunca `float`. Datas de competência, vencimento e pagamento separadas (tipo `date`).
- Soma das parcelas = total do título (diferença de centavos na última parcela).
- Lançamentos (movimentos) **não se editam nem se apagam** (trigger); correção só por estorno, e não se estorna duas vezes.
- Saldo da conta e valor pago calculados a partir dos movimentos, nunca gravados.
- **Situação do título calculada** (ajuste nosso ao prompt): grava só ativo/cancelado; "em aberto", "parcial", "pago" e "vencido" saem de
  uma view a partir das parcelas e movimentos.
- Baixa parcial, juros, multa, desconto e tarifa; impede baixa acima do saldo em aberto.
- Transferência = dois movimentos ligados, fora de receita e despesa.
- Título com movimento não se exclui: cancela, e o cancelamento é bloqueado enquanto houver baixa não estornada.
- **Forma de pagamento em cada movimento** (ajuste nosso): dinheiro, PIX, débito, crédito, boleto, transferência, cheque.
- **Origens com chave estrangeira de verdade** (ajuste nosso): `financial_title_origins` com colunas próprias (`service_order_id`, depois
  `sale_id`) e CHECK de exatamente uma preenchida, em vez de "tipo + id" em texto. Um título pode cobrir várias OS e uma OS pode ter vários títulos.
- Auditoria em `financial_audit_log` por trigger (usuário, data/hora, tabela, registro, ação, antes e depois), sem edição por usuário.
- RLS em todas as tabelas novas; funções `security definer` com `search_path` fixo e conferência do nível de acesso dentro da função.

Tabelas previstas: `financial_accounts`, `card_machines` (maquininhas), `financial_categories`, `suppliers`, `financial_titles`,
`financial_title_origins`, `financial_installments`, `financial_movements`, `field_receipts` (recebimentos a conferir) e `financial_audit_log`.

## Etapas

**Etapa A (base, sem mexer em OS, linha do tempo, app de campo nem portal):**
- Migration única (colar no SQL Editor): nível de acesso no perfil, tabelas acima, triggers de imutabilidade/estorno/excesso de baixa,
  views de situação e saldo, RPCs transacionais (criar título com parcelas, baixar, estornar, transferir, cancelar, recebimento à vista,
  confirmar recebimento a conferir) e contas iniciais.
- Script SQL de verificação em transação com `ROLLBACK` (acesso por nível/papel, parcelas, baixa parcial, excesso de baixa, estorno duplicado,
  imutabilidade, transferência, cartão com tarifa).
- `src/types/financeiro.ts`, `src/services/financeiro.ts`, escolha do nível na aba Usuários, item do menu **oculto**.
- `docs/gemini/financeiro-briefing.md` (telas, campos, filtros, estados, ações) com dados de demonstração no modelo do PMOC (`dadosDemo`).
- Tudo numa branch `financeiro`, **sem push na `main`**; rodar typecheck, lint e build; revisar a RLS; aguardar revisão do usuário.
- A migration vai para o banco de produção quando colada: só acrescenta e nada aparece no menu, então é segura.

**Etapa B (depois da A aprovada e testada):**
- Botão "Registrar recebimento" na OS (nível caixa ou completo).
- Passo "Recebeu do cliente?" na conclusão do app do técnico.
- Painel de recebimentos a conferir e "dinheiro com técnicos".
- Etiqueta "Pago" automática quando a OS fica totalmente recebida.

**Depois (fases seguintes):** abertura e fechamento do caixa físico da loja, PIX/boleto automático com baixa por webhook, conciliação OFX,
catálogo e vendas com itens, NF-e/NFS-e, estoque. Fora do escopo das etapas A e B: importação do SicWeb e dados financeiros reais.

## Pendências para retomar
- Confirmar onde cai o dinheiro da **InfinitePay** (Itaú ou conta InfinitePay).
- Taxas atuais de cada maquininha (débito, crédito à vista, crédito parcelado).
- Quantas maquininhas existem e com quem ficam (uma por técnico? uma na loja?).
- Criar os logins da Jéssica e do Pedro (Equipe > Usuários, papel Escritório) antes de usar o nível caixa.
- Ajustes propostos considerados aprovados (forma de pagamento, recebimento à vista, venda de balcão, situação calculada, origens com FK);
  o usuário não se opôs, mas confirmar ao retomar.

## Uso real do SicWeb (medido no backup SICNET de 2026-11-24) e plano de virada

Medido no banco restaurado, últimos 12 meses (25/11/2025 a 24/11/2026). Serve para decidir **o que o Control precisa ter antes da virada**.

| O que o SicWeb faz | Volume | Peso para a virada |
|---|---|---|
| Vendas (balcão e serviços) | 1.190 vendas, R$ 793 mil (~100 por mês) | **Alto**: precisa de venda com itens, cliente e forma de pagamento |
| Forma de pagamento das vendas | PIX 687 (R$ 406 mil), crédito 374 (R$ 311 mil), dinheiro 89 (R$ 62 mil), débito 25, cobrança bancária 7, a prazo 4 | PIX e crédito são quase tudo; **a prazo e boleto quase não existem** |
| Orçamentos | 616 | **Alto**: usado todo dia; hoje o plano diz que "orçamento continua no SicWeb" |
| Caixa (livro) | 789 lançamentos | Médio |
| Cartão integrado (NSU/TID/paymentid) | 365 | Médio: há integração com adquirente/gateway; **descobrir qual** |
| NFC-e (cupom fiscal de consumidor) | 104 em 2026 (38 em 2025; 546 em 2018) | **Alto e arriscado**: emissão fiscal exige provedor/certificado |
| NF-e | 2 em 2026 (113 desde o início) | Baixo volume, mas obrigatório quando acontece |
| Contas a receber | 14 lançadas em 12 meses; R$ 1,03 mi em aberto é lixo sem baixa | **Quase não se usa**; ficou para depois (decisão do usuário, 2026-11-24) |
| Contas a pagar | 267 no total; abertos são de 2015-16 | **Não se usa** |
| Compras (entrada de mercadoria) | 20 em 12 meses | Baixo |
| Produtos | 829 (790 ativos, 259 com estoque) | Catálogo precisa existir; estoque é leve |
| Cheques, recibos | poucos / último recibo em 02/2026 | Baixo |

**Leitura:** o SicWeb na prática é um **PDV de balcão + orçamentos + caixa + emissão fiscal**. Contas a pagar/receber (o miolo da Etapa A deste plano:
títulos, parcelas, baixas) quase não são usadas. Por isso a ordem proposta abaixo começa por caixa e venda, não por títulos.

### Ordem proposta (a confirmar com o usuário)
1. **Base financeira enxuta**: nível de acesso (\`completo\`/\`caixa\`/\`nenhum\`), contas (Caixa BRV, Itaú, Caixa Econômica, Nubank), formas de pagamento,
   movimentos imutáveis com estorno, auditoria, RLS. Sem títulos e parcelas por enquanto (entram quando houver conta a prazo de verdade).
2. **Catálogo de produtos e serviços** (importar \`TABEST1\`, 829 itens) e **venda com itens** (balcão e serviço), pagamento PIX/cartão/dinheiro,
   cliente opcional (o "Cliente Balcão" inativo vira o "Consumidor final"). Daqui em diante a venda nasce no Control; o histórico fica em \`sicweb_vendas\`.
3. **Caixa**: abertura e fechamento, conferência do dinheiro com técnicos (Etapa B do plano original: "Recebeu do cliente?" no app de campo).
4. **Orçamentos** com aprovação do cliente (616 por ano): vira venda ou OS.
5. **Fiscal** (NFC-e e NF-e) por provedor de API: **é o que decide a data da virada**. Enquanto não existir, o SicWeb continua só para emitir nota.
6. **Virada**: congelar o SicWeb, gerar um **novo backup**, rodar os importadores de novo (são idempotentes: \`importar-clientes.mjs\`,
   \`importar-vendas.mjs\` com upsert por \`controle\`), trazer o que faltar (produtos e saldo de abertura do caixa), conferir totais contra o SICNET e passar a operar só no Control.
   O SicWeb fica guardado só para consulta.

### O que vem do SICNET e onde entra (conferido em 2026-11-24, antes da rodada 2 do Gemini)
O financeiro novo **não importa** os dados financeiros do SicWeb como dados vivos: contas a receber (R$ 1,03 mi sem baixa) e a pagar (abandonadas desde
2015-16) ficam só no backup; o histórico de vendas já está em `sicweb_vendas` (só admin). Por isso as telas da rodada 2 não dependem do SICNET. O que a
integração precisa, por tabela:
| SICNET | Destino no Control | Situação |
|---|---|---|
| `TABCLI` | `customers` + `customer_sicweb_codes` | importado (2026-11-24) |
| `TABEST3A/3B/3R` (vendas, itens, pagamentos) | `sicweb_vendas*` (histórico, só leitura) | importado; repetir na virada (idempotente) |
| `TABEST1` (829 produtos) | `catalog_items` | **falta**; ver abaixo |
| `TABEST7` (formas) | `FinancialPaymentMethod` | mapa: dinheiro, PIX, débito, crédito, cobrança bancária = `boleto`, cheque; "a prazo" = venda sem pagamento (a receber) |
| `TABCX1` (caixa) | só o **saldo de abertura** de cada conta no dia da virada (um movimento por conta) | na virada |
| `TABCR1/2`, `TABCP*`, `TABCHQ*`, `TABRECIB` | não entram (ficam no backup) | decidido |
| `TABCAR1` (NSU/TID/paymentid do cartão) | não importa; **avaliar** um campo opcional de NSU/autorização no pagamento em cartão para conferir com o extrato da maquininha | a decidir |
| `TABNFCE` | não entra; as notas novas nascem no provedor | decidido |

**Catálogo (`TABEST1`) precisa de campos que a rodada 1 não tem** (a tela de pesquisa do SicWeb mostra e busca por eles): **fabricante**, **código interno**
(a chave `controle`, para o importador ser repetível como o de vendas), **observações** do produto e **data do último reajuste** de preço. Entram na migration do
catálogo, com a coluna Fabricante e a busca por fabricante/observação na tela (Claude, na ligação ao banco). Antes de escrever o importador, conferir as colunas
reais da `TABEST1` no PC da empresa (`sqlcmd`) ou no `produtos.csv`: o estoque do SicWeb tem muito saldo negativo (ex.: -4154), então o saldo **não** é importado
como verdade (começa zerado ou por contagem).

### Decisões que dependem do usuário
- **Fiscal**: qual provedor de emissão (ou manter o SicWeb só para nota por um tempo)? Certificado digital A1 está com quem?
- **Cartão/PIX**: qual integração o SicWeb usa hoje (a tabela de cartão guarda NSU/TID/paymentid)? As maquininhas (Rede, InfinitePay) são as mesmas?
- Os 4 pontos da seção "Pendências para retomar" acima (InfinitePay, taxas, quantas maquininhas, logins da Jéssica e do Pedro).

## Notas fiscais (definido em 2026-11-24, conversa com o usuário)

**Como a BRV emite hoje**
- **NFC-e** (produto, balcão): módulo de emissão do próprio SicWeb, num PC da loja, a partir da venda registrada no SICNET ("última venda" ou "nº de pedido");
  usuário Jéssica. Configurações vistas: certificado digital com **validade até 01/09/2027** (senha só é pedida para A3, o campo está vazio: provavelmente A1 instalado
  no Windows; **confirmar e achar o `.pfx` com senha**), CSC com ID `000003` (o token do CSC **não** é guardado no repositório; vai só no cadastro do provedor),
  CFOP padrão 5.102 (tabela CSOSN→CFOP vazia), "Pedir CPF/CNPJ antes da emissão" ligado, "novos tributos da reforma tributária" desligado. O botão "Arquivos XML" guarda os XMLs.
- **NFS-e** (serviço): pelo **Emissor Nacional** (`nfse.gov.br/EmissorNacional`, Portal Contribuinte), digitada à mão; há rascunhos antigos parados no portal (03/09, 08/09, 27/10).
- **NF-e**: 2 em 2026 (113 desde o início).
- **Uma venda costuma gerar duas notas**: o orçamento mistura produtos (tubo de cobre, esponjoso, disjuntor...) e mão de obra ("M.O Instal Ar Cond split 12.000 btus"),
  que no SicWeb está cadastrada como produto comum.

**Desenho para o Control**
1. Cada item do catálogo é **Produto** ou **Serviço** (marca no cadastro). Dados fiscais: produto = NCM, CFOP, CSOSN (Simples Nacional, 102);
   serviço = código de serviço e alíquota de ISS. Na importação de `TABEST1`, listar os itens que parecem serviço ("M.O", "mão de obra", "instalação") para o usuário marcar.
2. Ao faturar, o Control **separa os itens sozinho**: produtos → **NFC-e** (consumidor final no balcão) ou **NF-e** (CNPJ, entrega ou pedido do cliente; regra padrão
   proposta, com escolha manual na venda); serviços → **NFS-e nacional**.
3. A venda guarda as **duas notas** (tabela própria: tipo, número, chave de acesso, status, XML, PDF), ligadas ao mesmo orçamento/venda; cancelar uma não mexe na outra.
4. Emissão por **provedor de API único** (NFC-e + NF-e + NFS-e nacional), chamado por Edge Function (chave do provedor só no servidor, como `consultar-os`).
   Motivos: volume baixo (~10 notas/mês), mudanças de regra (reforma tributária), nada de assinar XML nem contingência. Alternativa só para NFS-e: API direta do
   Emissor Nacional (gratuita, mas exige certificado A1 com mTLS e montar o XML); descartada porque NFC-e e NF-e ficariam sem solução.
5. **Etapa intermediária opcional**, antes do provedor: botão "Preparar NFS-e" na OS/venda, mostrando tomador, descrição e valor prontos para copiar no portal nacional,
   e registrando o número da nota emitida.
6. Guardar os XMLs antigos (5 anos pela lei): "Arquivos XML" do módulo de NFC-e entram no backup, mesmo depois da virada.

**O que falta (usuário e contador)**
- Achar o **certificado A1 (`.pfx`) e a senha**; renovar como A1 antes de 01/09/2027 se for A3 ou não exportável. Os provedores só aceitam A1.
- Quantas NFC-e, NF-e e NFS-e por mês (somando as do portal nacional).
- Contador: **código de serviço e alíquota de ISS** da instalação/manutenção de ar-condicionado em Niterói, e como tratar o **material cobrado junto com a mão de obra**
  (hoje vai em nota de produto, a mão de obra em NFS-e); regra de NFC-e x NF-e.
- Pesquisar provedores (preço, NFC-e do RJ, NFS-e nacional, aceitam o certificado existente) e escolher.
- Entender por que há rascunhos parados no portal da NFS-e (dado faltando? dúvida de enquadramento?) para o botão "Preparar NFS-e" resolver.
- Lançamento fiscal continua sendo o que decide a data da virada (ordem proposta, item 5).

## Retomada (2026-11-24, fim do dia no PC da empresa; continuar de casa)

**Onde paramos.** Plano de virada e de notas fiscais escritos (seções acima). Orçamentos do SicWeb medidos: 1.702 desde 2023 (293/393/496/520 por ano; ticket médio ~R$ 1.550 em 2026);
tabelas `TABEST4` (cabeçalho: cliente, contato, vendedor, total, `obs`) e `TABEST5` (itens: produto, quantidade, valor unitário, total), **sem status, sem validade e sem ligação com a venda**
(o botão "Vender" só converte). Mão de obra aparece como produto comum com nome "M.O Instal Ar Cond split N btus" (12k: 503 vezes; 9k: 403; 18k: 203; 24k: 80; 30k: 48...), "Desinstalação" e
afins: o prefixo "M.O" é a heurística para marcar Serviço no catálogo. Observações padrão se repetem (ver o briefing). **Nada de código novo ainda**: só documentos.

**Briefing pronto para o Gemini:** `docs/gemini/vendas-financeiro-briefing.md` (Catálogo, Orçamentos, Vendas e Financeiro, com camada de dados de demonstração, em **duas rodadas**:
1 = catálogo, orçamentos e vendas; 2 = financeiro). Ele devolve `docs/gemini/vendas-financeiro-r1.md` e `-r2.md` para o Claude auditar, igual PMOC e Placas.

**Roteiro de continuação (de casa ou da empresa):**
1. `git pull`. Passar o briefing ao Gemini (rodada 1). Ele não faz commit; quando entregar, o Claude audita (`typecheck`, `lint`, `build`, ler o resumo) e commita.
2. Claude, depois da auditoria da rodada 1: migrations novas (**nunca** editar as antigas; avisar que precisam ser coladas no SQL Editor): `catalog_items`, `quotes` (+ itens, eventos, textos padrão,
   `public_token`), `sales` (+ itens, pagamentos), `sale_documents` (notas) e funções públicas `orcamento_ver`/`orcamento_aprovar` (como `placa_orcamento_*`); `services/vendas.ts`; trocar o corpo do
   `components/vendas/fonteDeDados.ts` (`FONTE_DADOS_DEMO = false`); verificação com `ROLLBACK` em `supabase/verificacao/`; ajuda F1 (**regra fixa**: tópicos em `src/ajuda/topicos.ts`); ligar o menu (`MOSTRAR_MENU_VENDAS`).
3. **Importar o catálogo (`TABEST1`, 829 itens)**: precisa do SQL Server com o SICNET restaurado (**só o PC da empresa**) ou do `scripts/sicweb/dados/produtos.csv` (gitignored; copiar por pen drive/Drive).
   Fazer simulação primeiro, como `importar-clientes.mjs`; marcar serviço pelo prefixo "M.O"; deixar o dado fiscal (NCM/CFOP/CSOSN) para o contador revisar.
4. Rodada 2 do Gemini (financeiro) e, depois, a Etapa A do plano (migration financeira, nível de acesso no perfil e aba Usuários) como já descrita acima; Etapa B (recebimento na OS e no app do técnico) só depois.
5. **Fiscal por último** (decide a data da virada). Provedor ainda **não escolhido**: Focus NFe é a primeira opção (teste em homologação com o `.pfx` da BRV). Ver a seção "Notas fiscais".
6. Histórico de orçamentos do SicWeb: **decidido em 2026-11-24: manter só o último ano** (orçamentos com data a partir de 2025-11-24; o resto não é importado). Importar só para consulta (como `sicweb_vendas`, tabelas `sicweb_orcamentos`/`sicweb_orcamento_itens`, só admin lê), numa aba "Orçamentos" do cliente; não misturar com os orçamentos novos. Script no molde de `importar-vendas.mjs` (simula por padrão, `--gravar`, upsert por `controle`; liga ao cliente por `customer_sicweb_codes` via `TABEST4.lkcliente` -> `TABCLI.controle`; sem cliente vai para "Consumidor final"). Se o orçamento antigo ainda for útil depois, a data de corte fica numa constante do script.

**Decisões já tomadas nesta conversa:** venda/orçamento sem cliente = "Consumidor final" (o "Cliente Balcão" fica inativo); orçamento por **link de aprovação pelo WhatsApp** (sem e-mail, sem PDF anexo; mesmo
modelo das Placas); uma venda separa sozinha produtos (NFC-e/NF-e) e serviços (NFS-e nacional); histórico antigo fica em `sicweb_*` e não entra nas listas novas.

**Pendências do usuário:** achar o `.pfx` do certificado A1 e a senha (validade 01/09/2027); quantas notas por mês de cada tipo; perguntas ao contador (código de serviço e ISS da instalação/manutenção
de ar-condicionado em Niterói, material cobrado junto com a mão de obra, regra NFC-e x NF-e); escolher o provedor; as pendências da seção "Pendências para retomar" (InfinitePay, taxas, maquininhas, logins da Jéssica e do Pedro).
Em outro PC (casa): `.env` e `scripts/sicweb/dados/` **não vêm no `git pull`** (ver CLAUDE.md, "Trabalhar com o SicWeb em outro PC").
