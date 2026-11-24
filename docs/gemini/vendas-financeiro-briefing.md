# Tarefa para o Gemini: Catálogo, Orçamentos, Vendas e Financeiro (telas) no BRV Control

Leia antes: `GEMINI.md`, `CLAUDE.md`, `docs/financeiro.md` (plano, decisões e a seção "Notas fiscais": **fonte da verdade**) e `docs/gemini/placas-briefing.md`
(é o mesmo método: serviam de modelo `components/placas/` e `components/pmoc/`). Siga o `GEMINI.md`: português em tudo, **sem mexer em** `supabase/`, `src/services/`,
`src/contexts/`, `ProtectedRoute`, `components/campo/`, `pages/campo/`, `public/sw.js`, `android/`, `scripts/`; `npm run typecheck`, `npm run lint` e `npm run build`
sem erro nem aviso; **sem commit nem push** (o Claude revisa e commita).

**Como funciona (igual ao PMOC e às Placas):** o banco destes módulos **ainda não existe**. Você constrói todas as telas contra uma **camada de dados de demonstração**
em um arquivo por módulo (`src/components/vendas/fonteDeDados.ts` e `src/components/financeiro/fonteDeDados.ts`, cada um com `FONTE_DADOS_DEMO = true`, dados em memória
clonados de um `dadosDemo.ts`). Depois o Claude cria migrations e `services/`, troca o corpo dessas funções e liga ao Supabase **sem mexer nas telas**. Por isso o contrato da
seção 8 precisa ser exato. **Nenhum dado real**, nenhuma chave, nada do SICNET no código.

**Faça em duas rodadas e pare ao fim de cada uma** (entregue o resumo da seção 11 de cada rodada, o Claude audita antes da seguinte):
- **Rodada 1 (prioridade): Catálogo, Orçamentos e Vendas** (seções 3 a 5). É o que o escritório usa todo dia.
- **Rodada 2: Financeiro** (seção 6), mais o modal reaproveitável de recebimento (seção 6.6).

## 1. O negócio e o que o sistema antigo (SicWeb) faz hoje

O SicWeb, na prática, é **balcão (PDV) + orçamentos + caixa + emissão fiscal**. O BRV Control vai substituir isso, ligado às OS (serviços em campo) e ao cadastro de clientes que já existe.

**Orçamentos no SicWeb (medidos em 2026-11-24):** 1.702 desde 2023 (293 em 2023, 393 em 2024, 496 em 2025, 520 em 2026; ticket médio ~R$ 1.550). A tela antiga tem: cliente, contato,
data, vendedor, **lista de produtos** (quantidade, código, produto, valor unitário, total), **observações** e total, e os botões Incluir, Apagar, Pesquisar, Imprimir, **E-mail** e **Vender**
(converte o orçamento em venda). **Não tem status** (aprovado/recusado), não guarda se virou venda e não tem validade: no Control teremos tudo isso (seção 3).

**O orçamento mistura produto e serviço.** Exemplo real: tubo de cobre 1/2", esponjoso, fita PVC, kit de parafusos, disjuntor, cabo PP... **e** "M.O Instal Ar Cond split 12.000 btus"
(mão de obra, R$ 590,00). A mão de obra mais usada: instalação de split de 12.000, 9.000, 18.000, 24.000, 30.000 btus (nomes "M.O Instal Ar Cond split N btus"), também "Desinstalação".
**Observações padrão** repetidas em quase todo orçamento (ofereça-as como textos prontos, seção 3.4):
- "Orçamento feito de acordo com informações passadas pelo cliente, qualquer alteração o orçamento será refeito."
- "Elétrica e dreno por conta do cliente."
- "A empresa não realiza fechamento de paredes ou tetos (gesso ou forro PVC), nem retirada ou colocação de janelas, grades, telas ou vidros, ficando estes serviços por conta do cliente."
- "O fio para a elétrica e a mão de obra serão acrescentados no orçamento depois do serviço, pois não sabemos a metragem."

**Notas fiscais (decidido em 2026-11-24, ver `docs/financeiro.md`):** uma venda costuma gerar **duas notas**: os **produtos** vão em **NFC-e** (consumidor final no balcão) ou **NF-e** (CNPJ,
entrega ou pedido do cliente) e os **serviços** em **NFS-e nacional**. O provedor de emissão ainda **não foi escolhido**: nas telas, a emissão é só **status e botões que chamam funções
`TODO(Claude)`** (seção 4.4). Cada item do catálogo é **Produto** ou **Serviço**; a venda separa os itens sozinha.

**Cliente avulso:** o SicWeb tem o "Cliente Balcão" para venda sem cadastro. No Control ele **não aparece como cliente**: venda ou orçamento sem cliente = **"Consumidor final"** (cliente opcional).

**Formas de pagamento:** dinheiro, PIX, débito, crédito (com parcelas), boleto, transferência, cheque. Uma venda pode ter **mais de uma forma** (ex.: metade PIX, metade cartão).
Maquininhas: **Rede** e **InfinitePay**. Contas: **Caixa BRV** (dinheiro), **Itaú**, **Caixa Econômica**, **Nubank** (cadastro editável, não fixe na tela).

**Quem usa (define o que cada papel vê, seção 7):** Braulio (admin), Adriana (escritório, financeiro), Jéssica (atendimento e recebimento) e Pedro (atendimento, orçamentos e estoque), estes dois
ainda sem login. **Técnicos nunca veem nada disto.**

## 2. Menu e rotas (em `components/Sidebar.tsx`, única alteração permitida lá)
Como o PMOC e as Placas: **grupos novos, escondidos por constante** (`MOSTRAR_MENU_VENDAS = false` e `MOSTRAR_MENU_FINANCEIRO = false`, com comentário dizendo que as rotas continuam abrindo
por URL para testar e que o Claude liga quando o banco estiver pronto). Ordem do menu: Dashboard, Serviços, **Vendas**, Cadastros, Relatórios, Oficina, Placas, **Financeiro**, Estoque, Ajuda.

| Grupo | Item | Rota | Quem vê |
|---|---|---|---|
| Vendas | Orçamentos | `/orcamentos` | admin, escritório |
| Vendas | Vendas | `/vendas` | admin, escritório |
| Vendas | Catálogo | `/catalogo` | admin, escritório |
| Financeiro | Visão geral | `/financeiro` | só nível financeiro `completo` ou `caixa` (seção 7) |
| Financeiro | Caixa | `/financeiro/caixa` | `completo` e `caixa` |
| Financeiro | Recebimentos | `/financeiro/recebimentos` | `completo` e `caixa` |
| Financeiro | Movimentos | `/financeiro/movimentos` | só `completo` |
| Financeiro | Cadastros | `/financeiro/cadastros` | só `completo` |
| (público) | Orçamento para o cliente | `/orcamento/:token` | sem login, fora do `Layout` |

Navegação de abas comum no topo de cada grupo (`NavegacaoVendas`, `NavegacaoFinanceiro`, como `NavegacaoPlacas`). Cada rota nova entra em `telaDaRota` (`src/ajuda`) **só com um `TODO(Claude)`**:
a ajuda é do Claude (seção 10). Rotas protegidas: copie como `/placas` é tratada no `ProtectedRoute` (o Claude ajusta o arquivo; avise no resumo quais prefixos precisa liberar).

## 3. Rodada 1A: Orçamentos (`/orcamentos`)

### 3.1 Lista
Cabeçalho: título, busca (número, cliente, contato, produto), **"Novo orçamento"**. Chips com contagem por **situação**: **Todos · Rascunho · Enviado · Aprovado · Recusado · Convertido · Vencido**
(`situacaoOrcamento` em `regrasVendas.ts`: Vencido = enviado e passou da validade; Convertido = virou venda ou OS). Filtros: período, vendedor, só com serviço / só com produto.
Tabela (cartões no celular): número, data, cliente (ou "Consumidor final"), contato, total, situação (selo colorido, `cores.ts`), vendedor, ícones de produto/serviço. Paginada no servidor (50 por página).
Total do filtro no rodapé. Estados: carregando, erro com "Tentar de novo", vazio.

### 3.2 Editor (painel por cima da lista, também `/orcamentos?orcamento=<id>` e `?novo=1`)
Seções, na ordem:
- **Topo:** número (`ORC-NNNNN`), situação, botões do estado: Salvar, **Duplicar**, **Imprimir / PDF**, **Enviar pelo WhatsApp (link para aprovar)**, **Registrar resposta**, **Converter em venda**, **Gerar OS**, Excluir (só rascunho).
- **Cliente:** reaproveite o `SeletorCliente` que já existe (busca cliente do Control; veja como `NovaAtividadeModal.tsx` usa) com opção "Consumidor final (sem cadastro)"; endereço (cliente com mais de um
  endereço escolhe, como na nova atividade); **contato** (nome livre: é o campo "Contato" da tela antiga); telefone (pré-preenchido do cliente, editável só nesta cópia); vendedor (`listarVendedores`).
- **Itens:** duas tabelas no mesmo bloco, **Produtos** e **Serviços**, cada uma com subtotal, e o **total geral**. Adicionar por **busca no catálogo** (código, nome, sem acento; Enter adiciona) ou
  **"Item avulso"** (nome, tipo, valor, sem cadastro; marcado como avulso). Colunas: qtd (decimal), item, valor unitário (editável), desconto (valor ou %), total da linha, remover; reordenar por arraste.
  O **tipo** (produto/serviço) vem do item do catálogo e define em qual tabela cai; no item avulso é escolhido. Mostre aviso discreto "Itens de serviço vão em NFS-e e produtos em NFC-e/NF-e".
- **Condições:** validade em dias (padrão **10**), desconto geral, frete/outras despesas (opcional), **forma de pagamento prevista** (texto livre curto: "PIX ou cartão em até 6x"; não é lançamento financeiro).
- **Observações:** textarea com chips **"Inserir texto padrão"** (as 4 observações da seção 1, vindas de `listarTextosPadraoOrcamento()`, que o escritório edita em `/orcamentos/textos` (modal simples: lista, novo, editar, excluir)).
  Segundo campo, **"Observação interna"** (não aparece no documento nem no link do cliente).
- **Aprovação do cliente:** link público (`/orcamento/<token>`), **Copiar link**, **Enviar pelo WhatsApp**, **Gerar novo link** (revoga o anterior; confirmar), situação com data/hora e quem registrou
  (resposta do cliente pelo link: nome digitado e "Li e concordo"; ou registrada à mão: canal `whatsapp|telefone|presencial|email`).
- **Vínculos:** "Venda nº X" e/ou "OS nº Y" quando convertido (links que abrem o item). Orçamento convertido fica **só leitura** (duplicar continua permitido).
- **Histórico:** linha do tempo (criou, alterou itens, enviou, respondeu, converteu) e "Anotar no histórico", como `HistoricoPlaca`.

### 3.3 Regras
- Total = soma de (qtd x valor unitário − desconto da linha) − desconto geral + frete. Arredondar por linha em centavos (`Math.round`); nunca `float` solto: use funções de `utils/dinheiro.ts` **que você cria**
  (`somarCentavos`, `formatarReais`, parse de "1.234,56"), com testes simples comentados no arquivo.
- Estados e quem muda: rascunho → enviado (ao enviar o link) → aprovado/recusado (resposta) → convertido (venda ou OS). Enviado **depois de aprovado não muda mais valores** (só duplicar). Volta de enviado para rascunho
  só pelo botão "Reabrir para editar" (revoga o link, anota no histórico).
- **Converter em venda:** abre a tela de venda (4.2) já preenchida com cliente e itens (os mesmos preços); ao concluir a venda, o orçamento vira "Convertido". **Gerar OS:** só quando há item de serviço: chama
  `gerarOsDoOrcamento(id)` (demo: devolve número fictício; `TODO(Claude)`: o Claude liga à criação de OS e atividade que já existem) e leva os **itens de serviço** (descrição) para a "solicitação do cliente".
- Vencido não bloqueia conversão, mas pede confirmação ("Orçamento vencido há N dias, os preços podem ter mudado").

### 3.4 Documento A4 e WhatsApp
Documento A4 retrato na linha de `components/placas/FolhaOrcamentoPlaca.tsx` e do `DocumentoPmoc.tsx` (portal em `document.body`, porque o `index.css` esconde o `#root` ao imprimir): cabeçalho BRV
(`EMPRESA_BRV` de `components/pmoc/empresa.ts`), número, data, validade, cliente (nome, CPF/CNPJ, endereço, telefone, contato), **tabela de Produtos e tabela de Serviços** (cada uma com subtotal), total, condições,
observações e uma linha de aceite. Botões **"Imprimir / Salvar PDF"** (`window.print()`) e **"Enviar pelo WhatsApp (link para aprovar)"**: o `wa.me` só leva texto, então o PDF **não** é anexo (decisão das Placas):
o texto leva o link (`textoWhatsAppOrcamento` em `regrasVendas.ts`: "Olá, <nome>! Segue seu orçamento nº ..., válido até ...: <link>"); abra a aba do WhatsApp **já no clique** e preencha depois
(`prepararJanelaWhatsApp`, veja `services/placas.ts`). Telefone do cliente do Control via `formatarTelefone`; sem telefone, peça um.

### 3.5 Página pública `/orcamento/:token` (fora do `Layout`)
Mesma folha do documento (somente leitura), "Salvar em PDF / Imprimir", nome do cliente + caixa **"Li e concordo"** + **"Aprovar orçamento"**; **"Tenho dúvidas / Recusar"** abre o WhatsApp da BRV com texto pronto.
Só aprova se enviado e dentro da validade; mostra "Orçamento aprovado em ..." depois; token inválido ou revogado = "Link inválido". **Sem** observação interna, margem, nem dados que o cliente não deve ver. Dados vêm de
`buscarOrcamentoPublico(token)` e `aprovarOrcamentoPublico(token, nome)` (demo: tokens fixos `demo-orc-1`...).

## 4. Rodada 1B: Catálogo e Vendas

### 4.1 `/catalogo` — Catálogo de produtos e serviços
Lista (busca sem acento por código, nome, código de barras; chips **Todos · Produtos · Serviços · Inativos**; filtro de categoria; paginada, o SicWeb tem ~830 itens, 790 ativos, 259 com estoque).
Colunas: código, nome, tipo (selo Produto/Serviço), unidade, preço, estoque (só produto que controla), ativo. **Formulário (modal):** código (único), código de barras (opcional), nome, **tipo (Produto/Serviço)**, unidade (UN, M, KG,
CX, H...), categoria, **preço de venda**, **custo** (**só quem tem nível `completo`**, esconda para os outros), controla estoque (checkbox; estoque atual e mínimo), ativo, e a seção **Dados fiscais**:
- Produto: **NCM**, **CFOP** (padrão 5.102), **CSOSN** (padrão 102), origem da mercadoria (0 a 8, padrão 0), unidade tributável.
- Serviço: **código de serviço nacional (NBS/LC 116)**, **alíquota de ISS (%)**, descrição para a nota.
Campos fiscais ficam **recolhidos** ("Dados fiscais") com aviso "Confirme com o contador"; nenhum é obrigatório para salvar, mas o item **sem dado fiscal completo** ganha o selo "Fiscal incompleto" (lista e busca).
Ações: Novo, Editar, **Duplicar**, Inativar (nunca exclui item que já foi vendido; mostre o motivo). **Ferramenta "Revisar tipos"** (modal): lista os itens ainda não conferidos cujo nome começa com "M.O", ou contém
"mão de obra", "instalação", "desinstalação", "manutenção" ou "visita", **pré-marcados como Serviço**, com "Aplicar nos selecionados" (`marcarComoServico(ids)`); é a conferência da importação do SicWeb.
Importação em si (`TABEST1`) é do Claude: aqui só a tela.

### 4.2 `/vendas` — Vendas
**Lista:** busca (número, cliente, nota, item), filtros (período, forma de pagamento, situação, com/sem nota, origem: balcão, orçamento, OS), chips **Todas · Hoje · A receber · Canceladas**; colunas: número (`VND-NNNNN`),
data/hora, cliente (ou "Consumidor final"), total, forma(s) de pagamento, **situação** (Aberta, Paga, Parcial, Cancelada), **notas** (selo por nota: "Produtos: NFC-e emitida", "Serviços: NFS-e pendente"), origem. Total do filtro no
rodapé. Aviso no topo: "Vendas anteriores a 24/11/2026 ficam no cadastro de cada cliente, aba Vendas (histórico do SicWeb)": **não** misture o histórico antigo nesta lista.

**"Nova venda" (tela cheia no celular e no computador, pensada para o balcão):**
- Esquerda: busca de item (por código, nome ou **código de barras**: campo sempre focado, Enter adiciona; leitor de código de barras age como teclado), grade de itens frequentes (do catálogo, `listarItensFrequentes()`),
  carrinho com quantidade, valor (editável com permissão de desconto), desconto por linha e geral, remover. Produtos e serviços aparecem juntos no carrinho, com selo do tipo.
- Direita: **cliente** (opcional; busca com `SeletorCliente`, "Consumidor final" por padrão; botão "CPF/CNPJ na nota" quando for consumidor final), **resumo** (subtotal produtos, subtotal serviços, desconto, total) e **pagamento**.
- **Pagamento:** adicionar uma ou mais linhas (forma, valor, conta/maquininha de destino, parcelas para crédito, com a taxa estimada vinda da maquininha); restante a receber em tempo real; **troco** para dinheiro;
  "Pagar o total em ..." atalho por forma. Venda pode ficar **Aberta (a receber)** quando nada foi pago (ex.: serviço que o técnico recebe depois), mas **cliente é obrigatório** nesse caso.
- **Concluir venda** (`concluirVenda`) → tela de **comprovante da venda** com os cartões das notas (4.4), Imprimir recibo (A4 simples, `ReciboVenda`), "Nova venda".
- Vem preenchida quando se abre por **Converter em venda** (3.3) ou por `?orcamento=<id>`.

**Detalhe da venda (painel):** cabeçalho com número, cliente, vendedor, origem (links para orçamento/OS), itens (produtos e serviços), pagamentos (cada um com forma, conta, data, quem lançou), **notas fiscais** (4.4),
histórico, **Receber saldo** (abre o modal da seção 6.6), **Cancelar venda** (motivo obrigatório; só `completo`; estorna os pagamentos, o Claude faz o estorno de verdade; venda com nota emitida só cancela depois de cancelar a nota,
avise isso na tela). Venda cancelada: faixa no topo, tudo só leitura.

### 4.3 Regras da venda
- Mesma aritmética em centavos de 3.3. Pagamentos somam ≤ total (excesso só em dinheiro vira troco). `situacaoVenda(venda)` calculada: Cancelada, Paga (soma = total), Parcial, Aberta.
- Desconto acima de um limite (constante `LIMITE_DESCONTO_SEM_SENHA_PERCENT = 10`, comentada) exige nível `completo`; abaixo disso qualquer um do escritório. O banco repetirá.
- **Estoque:** só **mostra** o saldo no catálogo e avisa "Estoque insuficiente" se o item controla estoque e a quantidade passa do saldo (aviso, não bloqueia). Baixa de estoque e o módulo Estoque são **depois**.

### 4.4 Notas fiscais da venda (status e botões, sem emissão real)
No detalhe da venda e no comprovante, **dois cartões**: **"Produtos"** (NFC-e ou NF-e) e **"Serviços"** (NFS-e). Cada cartão só aparece se a venda tem itens do tipo. Conteúdo: valor da nota, **tipo de nota** (para produtos, escolher
NFC-e ou NF-e: sugestão **NF-e se cliente com CNPJ**, senão NFC-e; escolha manual permitida), situação (`nao_emitida`, `emitindo`, `emitida`, `cancelada`, `erro`), número/série/chave (copiável), links **PDF** e **XML**, mensagem de erro em
português quando falhou e botões **Emitir nota**, **Tentar de novo**, **Cancelar nota** (motivo; só `completo`). Tudo chama `emitirNotaVenda(vendaId, grupo, tipo)`, `cancelarNotaVenda(notaId, motivo)` e `listarNotasDaVenda(vendaId)`,
**que na demo só simulam** (espera de 1 s, número fictício, uma venda de exemplo com `erro`). Marque cada uma com `TODO(Claude): provedor ainda não escolhido (docs/financeiro.md, "Notas fiscais")`.
Faixa de aviso fixa nessa área enquanto `FONTE_DADOS_DEMO`: "Emissão fiscal de demonstração: nenhuma nota é emitida de verdade". Botão extra **"Preparar NFS-e para o portal"** (serviços): abre um painel com tomador, descrição e valor
prontos para **copiar** (um botão "Copiar" por campo), é o caminho atual enquanto não há provedor (a loja digita no `nfse.gov.br`), com campo **"Número da nota emitida"** para registrar `registrarNotaManual(vendaId, 'nfse', numero)`.

## 5. Dados do módulo de vendas que as telas assumem (para o Claude criar as tabelas)
Nomes em inglês no padrão do banco, comentário em português em `src/types/vendas.ts`: `catalog_items` (kind `produto|servico`, campos fiscais), `quotes` (+ `quote_items`, `quote_events`, `quote_texts`, `public_token`, `status`,
`valid_until`, `customer_id` NULL = consumidor final, `address_id`, `contact_name`), `sales` (+ `sale_items`, `sale_payments`, `quote_id`, `service_order_id`, `status`), `sale_documents` (as notas: `group` `produtos|servicos`,
`model` `nfce|nfe|nfse`, status, número, chave, urls). **Não use os nomes `sicweb_*`**: aquelas tabelas são o histórico importado, só admin lê, e continuam como estão.

## 6. Rodada 2: Financeiro (`/financeiro...`)
Siga o modelo de dados do plano: `docs/financeiro.md` ("Modelo e regras" e "Contas e maquininhas"). Dinheiro em centavos/`utils/dinheiro.ts`. **Movimentos não se editam nem se apagam: só estorno** (a tela não tem editar/excluir movimento).

### 6.1 `/financeiro` — Visão geral
Cartões: **saldo por conta** (Caixa BRV, Itaú, Caixa Econômica, Nubank, e as maquininhas pendentes), **recebido hoje / no mês** (por forma de pagamento), **dinheiro com técnicos ainda não entregue** (link para 6.3),
**vendas a receber** (em aberto, com os mais antigos). Gráfico simples em HTML/CSS (sem biblioteca) do recebido nos últimos 30 dias. Quem é nível `caixa` vê só **recebido hoje** e o painel de recebimentos (sem saldos de banco, sem mês, sem gráfico).

### 6.2 `/financeiro/caixa` — Caixa físico da loja (dinheiro)
**Abrir caixa** (valor inicial contado), lançamentos do dia (entradas de venda em dinheiro, retiradas/sangria com motivo, reforço), **Fechar caixa** (valor contado x esperado, diferença com justificativa obrigatória
se ≠ 0, quem fechou). Histórico de fechamentos. Um caixa aberto por vez.

### 6.3 `/financeiro/recebimentos` — Recebimentos a conferir (dos técnicos)
Fila do que o técnico informou ter recebido no local (no futuro vem do app de campo; **na demo** são registros fictícios): OS, cliente, técnico, hora, valor, forma. Ações: **Confirmar** (dinheiro: "entregue na loja", escolhe a conta;
cartão: escolhe a maquininha, o sistema calcula **valor bruto na conta da maquininha no dia útil seguinte** e a **taxa como tarifa**, ajustável na hora), **Recusar/divergência** (motivo). Painel "dinheiro com técnicos ainda não entregue" por técnico.

### 6.4 `/financeiro/movimentos` — Extrato (só `completo`)
Filtro por conta, período, forma, categoria, origem (venda, OS, avulso), texto. Tabela (cartões no celular) com data, descrição, categoria, forma, conta, valor (entrada verde, saída vermelha, estorno cinza com "estorna X"), saldo na
conta quando filtrado por uma. Ações: **Lançamento avulso** (despesa ou receita: data, conta, categoria, valor, descrição, fornecedor), **Transferir entre contas** (dois movimentos ligados), **Estornar** (motivo; não se estorna duas vezes; mostre
"já estornado"). Exportar a lista filtrada em **CSV** (geração no navegador, sem biblioteca).

### 6.5 `/financeiro/cadastros` — (só `completo`)
Abas: **Contas** (nome, tipo caixa/banco, saldo inicial, ativa), **Maquininhas** (nome, conta onde cai, prazo de crédito em dias úteis, taxas: débito, crédito à vista, crédito parcelado com tabela por número de parcelas, ativa),
**Categorias** (receita/despesa, com "Venda loja" e "Serviço" iniciais), **Fornecedores** (nome, CPF/CNPJ com `utils/documento.ts`, telefone, e-mail).

### 6.6 Modal reaproveitável `RegistrarRecebimentoModal` (`components/financeiro/`)
Props: `origem` (`{ tipo: 'venda' | 'os' | 'avulso', id?, clienteNome, valorSugerido }`), `onClose`, `onRegistrado`. Mostra valor, formas (várias linhas como o pagamento da venda), conta ou maquininha, parcelas, data, observação, e um resumo.
Chama `registrarRecebimento(dados)`. **Não coloque este modal na OS**: a OS, o app do técnico e o Dashboard são do Claude (Etapa B do plano). Você só o usa na venda (4.2) e documenta as props no resumo.

## 7. Papéis e níveis de acesso (esconder, não só bloquear)
O **nível financeiro** é um campo do perfil (`completo`, `caixa`, `nenhum`; plano em `docs/financeiro.md`). Ele **ainda não existe no banco** e ainda não está em `src/types/fsm.ts`: crie **uma função só**,
`nivelFinanceiro(profile)`, em `components/financeiro/fonteDeDados.ts`, com `TODO(Claude)` explicando que o Claude troca por `utils/acessoFinanceiro.ts` lendo o campo real; na demo: `admin` = `completo`, `escritorio` = `caixa`,
os demais `nenhum`, e **um seletor "Ver como: completo / caixa / nenhum" na faixa de demonstração** para você testar os três (só enquanto `FONTE_DADOS_DEMO`).

| Quem | Catálogo / Orçamentos / Vendas | Financeiro |
|---|---|---|
| `admin`, `escritorio` | tudo (custo e cancelamento de venda só `completo`) | conforme o nível |
| `oficina`, `tecnico`, `cliente` | **nada** (menu some, rota mostra "Acesso restrito") | nada |
| nível `caixa` | vende, recebe, confere recebimentos, vê o recebido do dia | **sem** saldos, movimentos, cadastros, relatórios; **sem** estorno nem cancelamento |
Use `useAuth()` (`profile.role`). O banco repetirá todas as regras.

## 8. Contrato de dados
Tipos em `src/types/vendas.ts` e `src/types/financeiro.ts` (inglês no padrão do banco, comentário em português). Todas as funções são assíncronas, demo em memória.

**`components/vendas/fonteDeDados.ts`**
| Função | Faz |
|---|---|
| `listarCatalogo(filtro)` / `buscarItemCatalogo(id)` / `buscarItensParaBusca(texto)` / `listarItensFrequentes()` | catálogo paginado; busca rápida sem acento por código, nome ou código de barras |
| `salvarItemCatalogo(dados)` / `inativarItemCatalogo(id)` / `marcarComoServico(ids)` / `listarSugestoesDeServico()` | cadastro e revisão de tipos |
| `listarOrcamentos(filtro)` / `buscarOrcamento(id)` / `salvarOrcamento(dados)` / `duplicarOrcamento(id)` / `excluirOrcamento(id)` | orçamentos (paginados no servidor); o total é recalculado no servidor |
| `reabrirOrcamento(id)` / `registrarEnvioOrcamento(id)` / `registrarRespostaOrcamento(id, dados)` / `gerarNovoLinkOrcamento(id)` | ciclo de aprovação |
| `historicoDoOrcamento(id)` / `anotarNoHistoricoOrcamento(id, nota)` | linha do tempo |
| `listarTextosPadraoOrcamento()` / `salvarTextoPadraoOrcamento(dados)` / `excluirTextoPadraoOrcamento(id)` | observações prontas |
| `buscarOrcamentoPublico(token)` / `aprovarOrcamentoPublico(token, nome)` | página pública (dados seguros, sem observação interna) |
| `gerarOsDoOrcamento(id)` | **TODO(Claude)**: cria OS + atividade; demo devolve número fictício |
| `listarVendas(filtro)` / `buscarVenda(id)` / `concluirVenda(dados)` / `cancelarVenda(id, motivo)` | vendas |
| `receberSaldoVenda(id, pagamentos)` | pagamentos posteriores |
| `listarNotasDaVenda(id)` / `emitirNotaVenda(id, grupo, tipo)` / `cancelarNotaVenda(notaId, motivo)` / `registrarNotaManual(id, modelo, numero)` | notas fiscais (**TODO(Claude)**: provedor) |
| `listarVendedores()` | vendedores (funcionários ativos com atendimento) |
| `buscarClientesParaVenda(texto)` | reaproveite o que `SeletorCliente` já usa; **não** crie busca nova de clientes |

**`components/financeiro/fonteDeDados.ts`**
| Função | Faz |
|---|---|
| `nivelFinanceiro(profile)` | ver seção 7 |
| `resumoFinanceiro(periodo)` | saldos por conta, recebido hoje/mês por forma, a receber, dinheiro com técnicos |
| `listarContas()` / `salvarConta(d)` / `listarMaquininhas()` / `salvarMaquininha(d)` / `listarCategorias()` / `salvarCategoria(d)` / `listarFornecedores()` / `salvarFornecedor(d)` | cadastros |
| `listarMovimentos(filtro)` / `lancarMovimentoAvulso(d)` / `transferir(d)` / `estornarMovimento(id, motivo)` / `exportarMovimentosCsv(filtro)` | extrato (movimento imutável) |
| `registrarRecebimento(dados)` | recebimento à vista em um passo (título + baixa no banco) |
| `listarRecebimentosAConferir()` / `confirmarRecebimento(id, dados)` / `recusarRecebimento(id, motivo)` / `dinheiroComTecnicos()` | conferência dos técnicos |
| `situacaoCaixa()` / `abrirCaixa(valor)` / `registrarMovimentoCaixa(d)` / `fecharCaixa(d)` / `listarFechamentos()` | caixa da loja |

## 9. Dados de demonstração (`dadosDemo.ts`, um por módulo)
Fictícios, sem dado real: **~40 itens de catálogo** (25 produtos de refrigeração/elétrica com preços realistas, 12 serviços de mão de obra no estilo "M.O Instal Ar Cond split 12.000 btus", alguns sem dado fiscal, 3 inativos),
**~15 orçamentos** em todas as situações (um igual ao exemplo da seção 1, com produtos e M.O.; um vencido; um convertido), **~12 vendas** (balcão, de orçamento, com várias formas de pagamento, uma cancelada, uma aberta a receber,
uma com nota com erro), 4 contas, 2 maquininhas com taxas, ~60 movimentos em vários meses (um estornado), 5 recebimentos a conferir, 1 caixa aberto. Clientes fictícios (3 com nome, 1 consumidor final), telefones `(21) 9XXXX-0000`,
CPF/CNPJ sintéticos válidos. Valores em centavos.

## 10. O que NÃO fazer
Emissão fiscal real, chamar provedor, leitura de arquivo do SicWeb, importar produtos, gravar no banco, migration, e-mail de orçamento (decidimos link por WhatsApp), PIX/boleto automático e webhooks, conciliação OFX, baixa de estoque,
botão "Recebeu do cliente?" no app do técnico, botão de recebimento na OS, ajustes no Dashboard, texto da ajuda F1, mexer em `components/oficina/`, `components/placas/` e `components/pmoc/` além de importar o que já existe
(prefira importar a editar), alterar `services/clientes.ts`. **Ajuda (F1):** regra fixa do projeto (tela só fica pronta com a ajuda), mas os **textos são do Claude** (`src/ajuda/`, não mexa): liste no resumo o **nome exato**
de cada botão, aba, campo e selo que você criou.

## 11. Resumo para auditoria (entrega obrigatória por rodada): `docs/gemini/vendas-financeiro-r1.md` e `docs/gemini/vendas-financeiro-r2.md`
Siga `docs/gemini/placas.md`: **1.** arquivos criados e alterados; **2.** telas e rotas (quem abre); **3.** contrato de dados e tipos que o Claude precisa implementar (funções acima, colunas e tabelas que você supôs);
**4.** regras de negócio implementadas no front, uma a uma (totais em centavos, validade, situações, desconto, troco, taxa da maquininha, dia útil seguinte); **5.** premissas e decisões suas; **6.** pendências e limitações
(o que não testou, o que ficou `TODO(Claude)`); **7.** saída exata de `typecheck`, `lint` e `build`; **8.** como testar (os 3 papéis e os 3 níveis, as rotas, a página pública com token da demo); **9.** nomes exatos de botões, abas,
campos e selos para a ajuda F1; **10.** textos copiados literalmente (observações padrão, termos do documento) para o Braulio revisar. Seja exato e honesto sobre o que fez, o que ficou incompleto e o que não testou.
