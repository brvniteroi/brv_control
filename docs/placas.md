# Migração do módulo Placas (Reparo de placas) para o BRV Control

Plano de 2026-11-09. **Nada implementado.** Segue o que já foi feito com os equipamentos (ver `docs/oficina.md`): mesma tabela de
itens da Oficina, importador repetível, virada com o Equipamentos em só leitura. Referência do sistema antigo: `D:\BRV_Equipamentos`
(telas em `frontend/src/pages/Reparos/`, schema em `schema_reparos.sql`).

## O que existe hoje (laboratório de eletrônica)
| Parte | Como funciona hoje |
|---|---|
| **Kanban** | Entrada / Triagem → Diagnóstico / Orçamento → Aguardando Peça → Em Reparo → **Teste em Simulador** → Pronto para Entrega. Finais: Entregue / Faturado e Sem Conserto / Devolvido. Filtros: Parceiros (instaladores), Cliente final, Garantias. Aviso sonoro e arquivar |
| **OS de placa** | `reparos_os`: número próprio `OS-DDMMAA-NNN` (sequência do dia, calculada contando registros no navegador), **número da OS do Control opcional** (`os_field_control`: só vale quando a placa veio de uma retirada da equipe de campo; o botão "buscar" puxa os dados dela), cliente (nome/telefone/tipo/cidade como texto), técnico de retirada e de bancada (texto), tipo de equipamento, marca/modelo, **código da placa**, **código de erro**, periféricos/acessórios, defeito, diagnóstico, **componentes trocados**, **valor do orçamento**, sem defeito, garantia (`eh_garantia` + `os_origem_id`), reembolso (valor, data, motivo) |
| **Impressos** | Comprovante de entrada, etiqueta térmica (Elgin, `print_reparos.php`), orçamento da placa, **termo de garantia de 90 dias** (WhatsApp/impressão) |
| **Fotos** | Bucket `midias`, pasta `reparos/<id>/`, mais anotações de foto no histórico. **Galeria pública pelo id** da OS (`GaleriaPublicaOS`) |
| **Dashboard** | Faturamento do mês e do ano, reembolsos, valor e quantidade na bancada, "encalhadas", marcas e defeitos mais comuns |
| **IA e apoio** | Ditado por voz e leitura de foto na nova OS (`interpretar-voz`), assistente técnico, busca de código de erro (`consultar-erro`), fichas técnicas (131), manuais (18 PDFs), extração de ficha (`extrair-ficha`) |
| **Clientes** | `reparos_clientes` (49): instaladores parceiros e cliente final, separados do `clientes` dos equipamentos e do Control |
| **Histórico** | `reparos_historico` (584 linhas): quem fez o quê, com texto livre |

Volume: **78 OS de placa**, 584 históricos, 49 clientes (levantado em 2026-11-05). É pouco: a migração é simples, o trabalho está nas telas e nos impressos.

## Como encaixa no Control

### 1. Mesma tabela da Oficina, `kind = 'placa'`
`workshop_orders` já tem `kind` ('equipamento' | 'placa'), garantia (`is_warranty`, `warranty_origin_id`), valor (`quote_amount`), técnico de retirada/bancada,
OS de origem, fotos (`attachments.workshop_order_id`), histórico imutável, etiqueta e Elgin. Reaproveitar: o Kanban, o histórico, as fotos, a
etiqueta, a ajuda, as regras de papel (`oficina` = Gustavo).

**Colunas que faltam** (migration nova, 1:1 em `workshop_board_details` para não poluir o item de equipamento):
`board_code` (código da placa), `error_code`, `replaced_components`, `peripherals`, `no_defect` (sem defeito), `customer_kind` ('instalador' | 'final'),
`refunded`, `refund_amount`, `refunded_at`, `refund_reason`, `archived`. `quote_amount` guarda o valor do orçamento da placa.

### 2. Etapas: mapa de/para
| Placas hoje | Control |
|---|---|
| Entrada / Triagem | `entrada` |
| Diagnóstico / Orçamento | `diagnostico` (e `aguardando_orcamento` / `aguardando_cliente` quando o orçamento sai) |
| Aguardando Peça | `aguardando_peca` |
| Em Reparo | `em_reparo` |
| **Teste em Simulador** | **etapa nova `teste`** (só placas; entra no CHECK e na ordem do Kanban) |
| Pronto para Entrega | `pronto` |
| Entregue / Faturado | `entregue` |
| Sem Conserto / Devolvido | `entregue` com `no_repair = true` (devolvida sem conserto); não é descarte nem cancelamento |

### 3. Clientes
**Decidido em 2026-11-09 (pedido do usuário): cadastro paralelo, sem misturar com os clientes do Control**, porque a grande maioria são **instaladores parceiros**.
- **Cadastro próprio:** tabela nova `board_clients` (migração 1:1 de `reparos_clientes`, os 49: nome, telefone, tipo instalador/final, cidade). Tela própria dentro
  da Oficina (aba/menu "Clientes de placas"), só escritório, admin e oficina. Não aparece em Clientes, na busca de OS nem na linha do tempo do Control.
  **Sem casamento por nome e sem lista de revisão**: entra como está.
- **Quem é o cliente do item:** o item de placa tem **ou** `board_client_id` (parceiro, balcão/portador) **ou** `customer_id` (cliente do Control, quando a placa foi
  retirada pela equipe de campo e já tem OS). Nunca os dois. Hoje `customer_id` é obrigatório e copiado da OS; a migration o torna opcional só para `kind = 'placa'`
  e cria uma regra no banco: placa precisa de exatamente um dos dois, equipamento continua com `customer_id` obrigatório.
- **Mescla só no caso de campo:** ao recolher uma placa em atividade, ela segue o cliente da OS do Control (`customer_id`). Se esse cliente for um parceiro que também existe em
  `board_clients`, não há ligação automática; o escritório pode vincular à mão, se quiser o histórico junto (campo opcional `board_client_id` em `customers`, a decidir depois).
- **Tipo instalador/final:** fica no cadastro do parceiro (`board_clients.kind`) e, para o cliente do Control, no item (`customer_kind`), porque a mesma pessoa pode ser os dois.
- **Efeitos:** a avaliação por e-mail, o portal do cliente e o aviso "Cliente sem e-mail" só olham `customers`; placa de parceiro não dispara nada disso (era o desejado).
  Relatórios de placas somam os dois tipos de cliente.

### 4. Número da OS
**Decidido em 2026-11-09 (pedido do usuário): a placa tem numeração própria**, na mesma lógica de hoje (`OS-DDMMAA-NNN`), e **só ganha OS do Control quando
foi retirada pela equipe de campo**. Placa que o instalador traz ao balcão ou manda por portador não cria OS no Control.
- **Número próprio** (formato **`OS-DDMMAA-NNN` com a data, confirmado em 2026-11-09**, ex.: `OS-091126-001`): gerado pelo banco (função com trava, sem contar registros no navegador). As 78 OS antigas
  mantêm o número que já têm (viram o número oficial, não só referência), então a sequência continua sem quebrar etiquetas e papéis em circulação.
  Coluna `board_number` (única) em `workshop_board_details`. A tela mostra esse número no lugar de "OS 17300 · item 2".
- **Com OS do Control (retirada pela equipe):** o botão "Recolher equipamento" do app de campo ganha o tipo "placa"; a placa nasce ligada à atividade e à OS
  (`service_order_id`, `task_id`) e já recebe seu número próprio. O número da OS do Control aparece ao lado (e no bloco "Na oficina" da OS).
- **Sem OS do Control (balcão/portador):** `service_order_id` fica vazio. Hoje o banco exige OS ou `legacy_id` (`workshop_orders_tem_os`); a migration relaxa
  essa regra só para `kind = 'placa'`. Equipamentos continuam sempre com OS. Dá para **ligar a uma OS depois**, se o escritório quiser (escolher a OS no item).
- **Devolução:** a OS de devolução do Control só faz sentido se a equipe entrega. Placa retirada pelo cliente ou instalador: "Entregue" direto, como o botão
  "Cliente buscou na loja" dos equipamentos.

### 5. Garantia de 90 dias e reembolso
- Garantia: `is_warranty` e `warranty_origin_id` já existem. O termo (90 dias a contar da saída = `finished_at`, texto do Art. 26 do CDC) vira impresso do Control, com envio pelo WhatsApp.

### 5.1 Orçamento (decidido em 2026-11-09)
**O orçamento da placa é feito no Control** (diferente dos equipamentos, que ficam no SicWeb): valor, validade em dias (padrão 10), CPF/CNPJ e endereço do cliente,
parecer técnico, documento imprimível e **envio em PDF pelo WhatsApp** (abre o `wa.me` com a mensagem; o PDF sai do impresso do Control, gerado no navegador).
O valor vai para `quote_amount` e alimenta o financeiro das placas. A resposta do cliente (aprovado/recusado, canal) usa o mesmo registro dos equipamentos.

### 5.2 Financeiro das placas (decidido em 2026-11-09)
**O financeiro do reparo de placas é próprio e distinto do módulo Financeiro futuro do Control** (`docs/financeiro.md`). Aproveita-se o **dashboard financeiro que existe hoje
no reparo de placas** (faturamento do mês e do ano, reembolsos, valor e quantidade na bancada, encalhadas, marcas e defeitos mais comuns, tabela mensal com a lista de placas de cada mês).
Reembolso (valor, data, motivo) fica em `workshop_board_details` e entra nesse dashboard. Nada disso se mistura com o caixa do futuro Financeiro; se um dia for preciso unir, é uma ligação
nova, não uma reescrita.

### 6. Acompanhamento pelo parceiro e fotos (decidido em 2026-11-09)
**O parceiro acompanha a placa em suas etapas por um link enviado no comprovante de entrada** (impresso e WhatsApp), sem login: página pública `/placa/<token>` (token aleatório
por placa, nunca o id, como `rating_token`), servida por função segura que devolve só o que o cliente pode ver: número, equipamento, etapa atual e linha das etapas, datas, fotos da placa
e situação do orçamento (aguardando, aprovado, recusado). **Não mostra** valores internos, diagnóstico técnico detalhado nem reembolso (a definir com o Gemini/usuário se mostra o valor do orçamento aprovado).
Fotos: mesmo caminho dos equipamentos: baixar de `midias/reparos/<id>/` e enviar à HostGator (`api/uploads/`), registrando em `attachments`. A galeria atual (link pelo id da OS)
é aposentada na virada.

### 7. Impressos
- Etiqueta da placa: novo layout ZPL (`^FDBRV NITEROI - PLACAS`) no gerador `utils/etiquetaOficina.ts`, pelo agente da Elgin que já roda (as correções de margem 3 mm e passo 53 mm valem para todos).
  Isso aposenta `print_reparos.php` e o XAMPP do servidor da loja.
- Comprovante de entrada, orçamento da placa e termo de garantia: HTML imprimível como os documentos do Control (padrão `createPortal` em `document.body`).
- Dashboard: viram relatórios do Control (menu Relatórios), lendo `workshop_orders`. Dependem do valor do orçamento estar preenchido.

### 8. Apoio técnico (IA, fichas, manuais, códigos de erro)
Não faz parte da placa em si, mas o Equipamentos só pode ser desligado depois deles. **Fase separada**, depois das placas: fichas técnicas (131), manuais (18 PDFs, bucket do
Supabase antigo → HostGator), `consultar-erro`, `extrair-ficha`, `interpretar-voz`, assistente. As Edge Functions usam `GEMINI_API_KEY` no servidor; seriam republicadas no projeto do Control.
Enquanto não migrarem, o Equipamentos continua ligado só para consulta técnica.

## Fases
**Ordem decidida em 2026-11-09: a migração dos dados vem por último.** Primeiro as telas ficam prontas e testadas com dados de demonstração (como no PMOC: camada
`fonteDeDados.ts` trocável), depois o Claude cria banco e services e liga as telas, e só então o importador roda em **simulações** (`--simular`, várias vezes) antes da virada. Visual com o Gemini:
briefing em `docs/gemini/placas-briefing.md`.

| Fase | Entrega | Observação |
|---|---|---|
| **P0 Telas (Gemini)** | Todas as telas de placas com dados de demonstração, resumo em `docs/gemini/placas.md`; auditoria do Claude | Antes de qualquer migration |
| **P1 Banco** (depois do P0) | Migration (`teste`, `workshop_board_details` com `board_number`, `board_clients`, `service_order_id` e `customer_id` opcionais só para placas (exatamente um cliente por item), função do número, RLS: só `oficina`, escritório e admin), regras de etapa para placas, `kind` no Kanban | Colar no SQL Editor |
| **P2 Importador** | `scripts/equipamentos/importar-placas.mjs`, repetível e sem sobrescrever o que já mudou no Control; `--simular`; fotos por FTPS; clientes 1:1 para `board_clients` (sem revisão) | Precisa da chave de serviço do Equipamentos no `.env` |
| **P3 Telas** | Aba **Placas** na Oficina (Kanban com Teste), nova entrada, detalhes com os campos da placa, orçamento, garantia, comprovante, galeria por token, ajuda F1. Visual com o Gemini (briefing em `docs/gemini/placas.md`), auditoria do Claude | Regra fixa: sem ajuda F1 não está pronto |
| **P4 Etiqueta e impressos** | Layout da placa na Elgin, termo de garantia, comprovante | Testar na loja |
| **P5 Virada** | Importação final, Equipamentos em só leitura também para placas (políticas RESTRICTIVE, como em `somente-leitura-equipamentos.sql`), equipe lança só no Control | Backup do Equipamentos antes |
| **P6 Relatórios** | Faturamento, reembolsos, bancada, encalhadas, marcas e defeitos | Pode vir logo depois da virada |
| **P7 Apoio técnico** | Fichas, manuais, códigos de erro, IA; depois desligar o Equipamentos e o XAMPP | Fecha a unificação |

## Riscos
- **Orçamento de placa no Control e de equipamento no SicWeb:** são dois comportamentos na mesma Oficina. A tela precisa deixar claro qual vale (por `kind`): placa tem "Fazer orçamento" (valor, validade, PDF), equipamento tem "Registrar orçamento" (nº do SicWeb).
- **Link público do parceiro:** quem tem o link vê a placa. Token longo e aleatório, sem dados financeiros; poder revogar (gerar outro) no item.
- **Dois cadastros de cliente:** o mesmo parceiro pode existir em `board_clients` e em `customers` (se um dia pedir um serviço de campo). Aceito de propósito; não há mescla automática.
  Relatórios e buscas por cliente precisam olhar os dois lados.
- **Etapa nova `teste`:** muda o CHECK de `status` e o Kanban. Itens de equipamento nunca usam; o banco deve barrar.
- **Dois sistemas no meio do caminho:** como nos equipamentos, definir um dia de virada para ninguém lançar nos dois.

## Decisões que preciso do usuário
Decididas em 2026-11-09:
1. ~~Orçamento da placa~~ **feito no Control, com envio em PDF pelo WhatsApp** (5.1).
2. ~~Parceiros~~ **acompanham a placa em suas etapas por link enviado no comprovante de entrada** (6).
3. ~~Reembolso/financeiro~~ **financeiro das placas distinto do futuro Financeiro; aproveita o dashboard de hoje** (5.2).
5. ~~Quando~~ **a migração dos dados fica para o fim, com as telas prontas e testadas e simulações** (ordem das fases).
Também decididos: número da OS com data (`OS-DDMMAA-NNN`), cadastro de clientes de placas paralelo (3) e design com o Gemini (briefing `docs/gemini/placas-briefing.md`).

**Ainda aberta:** 4. **Apoio técnico (fichas, manuais, IA):** migra logo depois das placas (P7) ou o Equipamentos fica ligado só para isso por mais tempo?

## Ajuda F1 (regra fixa)
Telas e botões novos exigem tópicos em `src/ajuda/topicos.ts` no mesmo commit (`oficina-placas`, `oficina-teste-simulador`, `oficina-garantia-placa`...).
