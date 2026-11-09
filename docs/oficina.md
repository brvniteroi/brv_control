# Módulo Oficina: trazer o BRV Equipamentos para o BRV Control

Situação (2026-11-08): **migration aplicada; telas do Gemini prontas e auditadas pelo Claude; ajuda F1 feita.** Falta: instalar o
agente da Elgin no servidor da loja, republicar `gerenciar-usuario`, criar o login do Gustavo, testar com a equipe, importador do
Equipamentos e "Recolher equipamento" no app de campo (fase 3). Placas ficam para depois.
Baseado no repositório `D:\BRV_Equipamentos` (commit `84cfe00`, de 2026-11-03). O banco real do Equipamentos foi conferido em
2026-11-05 com as consultas do Anexo; vale ele, não os arquivos `.sql` do repositório, que estão defasados.

Objetivo: um sistema só, com o caminho completo **OS de campo → equipamento na oficina → devolução**, sem digitar número de OS de
um sistema no outro, com um único login e cadastro de clientes, sem perder dados e com a impressora Elgin funcionando de qualquer lugar.

## Decisões (2026-11-08)

| # | Decisão | Resposta |
|---|---|---|
| 1 | Retirada | Pelo app de campo ("Recolher equipamento"), já ligada à OS |
| 2 | Placas | **Fica para depois.** Primeiro só equipamentos. A tabela já nasce com `kind` para receber placas sem refazer nada |
| 3 | OS de devolução | Botão "Criar OS de devolução" já preenchido e ligado |
| 4 | Gustavo | **Só Oficina.** Papel de login novo `oficina`. Hoje é ajudante de refrigeração e vai virar mecânico, a princípio só dentro da empresa |
| 5 | Ordem | APK pronto (2026-11-08); a Oficina vem antes do financeiro |
| 6 | Vídeos | Só fotos (confirmar com a oficina se sente falta) |
| 7 | Etapas | As do Equipamentos, mais "Em trânsito" e "Aguardando cliente". Recusado tem duas saídas: devolver ou **descarte autorizado pelo cliente** |
| 8 | Orçamento | **Continua no SicWeb** até o financeiro vir em definitivo. O Control guarda só a referência (nº do orçamento no SicWeb, valor total, data do envio) |
| 9 | Servidor da loja (192.168.1.9) | Fica ligado direto: recebe o agente de impressão |

Outras mudanças desde o estudo de 2026-11-05:
- **Cargos**: `employees.role` vem da categoria do cargo (`public.cargos`). Criar a categoria `oficina` ("Atende na oficina") no CHECK de
  `cargos.categoria` e de `employees.role`. Assim quem é da oficina não aparece na linha do tempo nem nos relatórios de técnicos de campo.
  Enquanto for ajudante, o Gustavo pode ficar com um cargo "Ajudante de Oficina" nessa categoria; ao virar mecânico, "Mecânico de Bancada".
- **Adriana** é `admin` (Diretora Administrativa).
- **Comercialização**: o usuário quer vender o sistema. A Oficina deve nascer compatível com o futuro plano de multiempresa (ainda não
  escrito): sem nada fixo da BRV no código além do que já é configuração (ex.: cabeçalho da etiqueta vindo de um lugar só).
- Segurança do Equipamentos segue pendente (lembrete no CLAUDE.md). Recomendação: fechar antes da importação.

## Caminho do equipamento

| Etapa (`status`) | Quem | O que acontece |
|---|---|---|
| `em_transito` *(nova)* | Mecânico, pelo app | Na atividade da OS, "Recolher equipamento": o que levou (evaporadora, condensadora, completo, ACJ...), aparelho do cliente (`equipments`, opcional), defeito, fotos. Cliente, OS e técnico vêm sozinhos |
| `entrada` | Gustavo | "Receber": confere o que chegou; a **etiqueta sai sozinha na Elgin**. Balcão (sem OS) começa aqui |
| `diagnostico` | Gustavo | Laudo, peças necessárias, fotos |
| `aguardando_orcamento` | Atendimento | Monta o orçamento **no SicWeb** |
| `aguardando_cliente` *(nova)* | Atendimento | Registra nº do orçamento no SicWeb, valor e envio (texto pronto para o WhatsApp). Espera a resposta |
| `aguardando_peca` | Atendimento | Aprovado, falta peça |
| `em_reparo` | Gustavo | Aprovado com peça: conserta, fotos |
| `pronto` | Gustavo / Atendimento | Pronto para voltar ao cliente: consertado **ou recusado para devolver sem conserto** |
| `entregue` (final) | Atendimento | "Criar OS de devolução" (cliente, endereço e título preenchidos, ligada). Concluir essa OS marca como entregue |
| `descarte` (final) | Atendimento | Só com a **autorização de descarte** registrada (abaixo) |
| `cancelado` (final) | Escritório | Entrada feita por engano |

### Resposta do cliente ao orçamento
Registrada com: decisão (`aprovado`, `recusado_devolver`, `recusado_descarte`), **canal** (WhatsApp, telefone, presencial, e-mail),
data, observação e **quem registrou** (vem do login). Comprovante opcional (print da conversa) como anexo da oficina.
- Aprovado → `aguardando_peca` ou `em_reparo`.
- Recusado, devolver → `pronto` (aparece "Sem conserto: recusado pelo cliente").
- **Recusado, descarte autorizado** → `descarte`. O banco **exige** canal e observação. Fica registrado em três lugares: na ficha da
  oficina, no histórico (`workshop_order_events`) e **na OS de origem**, como comentário automático em `service_order_comments`
  ("Cliente autorizou o descarte da condensadora (oficina nº X) em dd/mm, por WhatsApp. Registrado por Fulano. Obs.: ..."). O bloco
  "Na oficina" da OS também mostra "Descartado com autorização do cliente".

### Na OS de campo
Bloco "Na oficina: <etapa>" com link; o cadastro do cliente lista os serviços de oficina. A OS de devolução combina com a regra de
uma atividade por OS (retirada e devolução são duas OS).

## Impressora Elgin L42PRO: fila de impressão

**Hoje**: o navegador grava o ZPL na HostGator (`zpl_bridge.php`, chave fixa `BRV9100`, CORS aberto) e abre uma aba para
`http://192.168.1.9:8080/brv_print/print.php` (XAMPP), que baixa o ZPL e envia à Elgin (fila do Windows em RAW, ou TCP direto).
Só funciona no Wi-Fi da loja, depende de pop-up, a ponte fica aberta e falha sem registro.

**No Control**:
```
Qualquer tela (PC, celular, app de campo, até no 4G)
  → grava o pedido em print_jobs (ZPL, cópias, quem pediu, de qual registro)
  → agente no servidor da loja recebe na hora (Realtime; confere a fila a cada 30 s por segurança)
  → envia à Elgin (fila do Windows RAW 'ELGIN L42PRO FULL'; se falhar, TCP direto, como o print.php)
  → marca impressa / falhou com o motivo → a tela mostra o resultado
```
- Agente: script Node (`scripts/agente-impressora/`), tarefa do Windows ao ligar o servidor; instalar o Node uma vez. Entra com um
  login próprio (papel `impressora`, só lê e atualiza `print_jobs` e o próprio sinal de vida). Sem chave fixa, sem CORS aberto.
- Sinal de vida (`print_agents`): a tela mostra "Elgin pronta" ou "Servidor da loja desligado"; nesse caso, botão de contingência
  "Imprimir pelo navegador / PDF" (o HTML de 100x50 mm que já existe hoje, com o aviso de margem "Nenhuma" no Chrome).
- Histórico: quem imprimiu, quando, quantas cópias; reimprimir pelo histórico.
- Um modelo só: pré-visualização e ZPL saem da mesma função TypeScript. Etiqueta 100x50 mm (80x50 opcional), como a atual, com
  **QR code** que abre o equipamento no Control (pede login). Texto sem acento no ZPL (como `zplText` do bridge).
- Depois: recibo de entrega e termo de garantia 80 mm pela mesma fila.

## Para não perder dados
- Tudo grava direto no banco pelos `services/`; nada de cópia em `localStorage` nem gravação por só abrir tela.
- Histórico por trigger (quem, quando, de qual etapa para qual; autor pelo `auth.uid()`); ninguém altera nem apaga o histórico.
- Nada se exclui no dia a dia: cancela ou descarta. Excluir só admin.
- O banco valida as transições (não pula etapa, descarte exige autorização, entregue exige OS de devolução concluída ou baixa manual
  do escritório) e a numeração vem de sequência.
- Fotos na HostGator via `upload.php`, registradas em `attachments`; no app de campo, fila offline (`filaCampo.ts`).
- Importação com `--simular` e `legacy_id` (repetível); o Kanban antigo fica só leitura depois da virada.
- **Backup**: o plano gratuito do Supabase não tem backup confiável. Decidir o Pro (ou o backup próprio diário) **antes da virada**
  da oficina. Unir os projetos libera uma vaga: o Pro fica ≈ US$ 25/mês.

## Banco (migrations novas, prefixo `workshop_`)
`equipments` no Control já é o aparelho instalado no cliente; por isso o prefixo.

- **`workshop_orders`**: `number` (sequência), `kind` (`equipamento`; `placa` depois), `status`, `service_order_id` (origem; nulo no
  balcão), `return_service_order_id`, `customer_id`, `address_id`, `equipment_id` (opcional), tipo, marca, modelo, tensão, unidades
  recolhidas, defeito relatado, relato do técnico, diagnóstico, peças necessárias e situação das peças, `pickup_employee_id`,
  `bench_employee_id`, referência do orçamento (`quote_reference` = nº no SicWeb, `quote_amount`, `quote_sent_at`), resposta do cliente
  (`decision`, `decision_channel`, `decision_note`, `decision_at`, `decision_by`), garantia (`is_warranty`, `warranty_origin_id`), datas
  de cada marco (recebido, pronto, entregue, descartado), `legacy_table`/`legacy_id`, `created_by`.
- **`workshop_order_events`**: histórico de auditoria.
- **`attachments.workshop_order_id`**: fotos e comprovantes.
- **`print_jobs`** e **`print_agents`**: fila e sinal de vida da impressora.
- **Papéis**: `profiles.role` ganha `oficina` (Gustavo) e `impressora` (agente); `cargos.categoria`/`employees.role` ganham `oficina`.
- **Realtime**: `workshop_orders` e `print_jobs`, via `useRealtimeTable`.

### Quem acessa o quê
| Pessoa | Equipamentos hoje | Control |
|---|---|---|
| Braulio, Adriana | `admin`, `diretoria` | `admin` |
| Jéssica, Pedro | `atendimento`, `suporte_oficina` | `escritorio` (ainda sem login no Control) |
| Gustavo | `tecnico_bancada` | **`oficina`**: só o menu Oficina, sem telefone nem cadastro de clientes (mesmo cuidado do app de campo) |
| Mecânicos | não usam | `tecnico`: só "Recolher equipamento" no app |

## Telas
Menu **Oficina**: Equipamentos (Kanban, só os em aberto; finalizados em lista paginada à parte), Nova entrada (balcão), detalhes
(abre por cima, como a OS), etiqueta. Bloco na OS e na aba Atendimento do cliente. Visual no padrão do Control (tema claro).
**Ajuda F1 obrigatória** (regra fixa): `TelaAjuda` nova, tópicos em `src/ajuda/topicos.ts`, seção em `SECOES`, rota em `telaDaRota`,
`useTelaAjuda` no painel de detalhes.

## Fases do módulo Equipamentos
| Fase | O que entra | Resultado |
|---|---|---|
| **1. Base** | Migration (tabelas, etapas, histórico, RLS, fila de impressão), papéis `oficina`/`impressora`, categoria de cargo, **agente da Elgin instalado e testado** no servidor | Etiqueta de teste saindo da Elgin pela fila |
| **2. Oficina** | Kanban, entrada de balcão, detalhes, resposta do cliente e descarte, etiqueta, bloco na OS, OS de devolução, ajuda F1. Importação dos 61 equipamentos e 129 mídias; Kanban antigo só leitura | Equipe usa só o Control para equipamentos |
| **3. Campo** | "Recolher equipamento" no app (sem APK novo); atualizar ou aposentar `consultar-os` | Caminho completo sem redigitar |
| Depois | Placas, fichas técnicas, códigos de erro e assistente; desligar o Equipamentos | Um sistema só |

### Fase 1: o que foi feito (2026-11-08)
- Migration `20261108130000_oficina_base.sql` (**colar no SQL Editor**): papéis `oficina`/`impressora`, categoria de cargo `oficina`
  (cargos "Ajudante de Oficina" e "Mecânico de Oficina"), `workshop_orders`, `workshop_order_events`, visão `oficina_itens`, fotos em
  `attachments.workshop_order_id`, regras de etapa (`workshop_orders_regras`), histórico automático e comentário de descarte na OS
  (`workshop_orders_historico`), funções `oficina_entrada_balcao`, `oficina_recolher`, `oficina_buscar_os`,
  `oficina_criar_os_devolucao`, baixa automática ao concluir a OS de devolução (`service_orders_entrega_oficina`), fila
  `print_jobs`, `print_agents` e funções do agente (`impressora_pegar`, `impressora_concluir`, `impressora_sinal`).
- **Numeração**: sem sequência própria. O item usa o número da OS do Control ("OS 17300", ou "OS 17300 · item 2" se a mesma OS
  tiver mais de um). Entrada de balcão cria a OS junto (tipo "Oficina (balcão)", situação em andamento).
- App: `types/oficina.ts`, `services/oficina.ts`, `utils/oficina.ts` (rótulos e espelho das regras), `utils/etiquetaOficina.ts` (ZPL
  100x50/80x50 com QR + HTML de contingência), `hooks/useOficina.ts` (Kanban por Realtime, situação da impressora), página provisória
  `/oficina` com o teste da Elgin, menu "Oficina", papel `oficina` vai direto para `/oficina`, papel `impressora` não usa telas.
- Agente: `scripts/agente-impressora/` (Node 22; passo a passo em `LEIA-ME.md`).
- `gerenciar-usuario` aceita o papel `oficina`: **republicar** a Edge Function antes de criar o login do Gustavo.
- Visual das telas: briefing `docs/gemini/oficina-briefing.md`; o Gemini grava o resumo em `docs/gemini/oficina.md` e o Claude audita.

### Pendências para a fase 2
- **OS de balcão** fica "em andamento" (não tem atividade, então o status automático não mexe). Decidir: concluir sozinha quando todos
  os itens finalizarem? (Cuidado: concluir dispara o pedido de avaliação por e-mail; no descarte não faz sentido.)
- Tipo de serviço padrão da OS de devolução (hoje o escritório escolhe na hora).
- ~~Ajuda F1 da Oficina~~ feita em 2026-11-08 (tópicos `oficina-*` em `src/ajuda/topicos.ts`). O F1 só abre para admin/escritório; o
  Gustavo (papel oficina) não tem a ajuda. Decidir se libera para ele.
- Importador do BRV Equipamentos (abaixo).

### Usar o Control e o Equipamentos ao mesmo tempo (período de teste)
Pergunta do usuário (2026-11-08): dá para migrar já e seguir com o Equipamentos até testar tudo? **Sim**, assim:
- **O Equipamentos continua sendo o oficial** até a virada. A equipe lança tudo lá, como hoje.
- O importador copia o Equipamentos para o Control e **pode rodar quantas vezes quiser** (casa por `legacy_id`; cada rodada atualiza
  os itens importados). Assim o Control fica com os dados reais para testar telas, etiqueta e Kanban.
- **Não editar no Control os itens importados** durante o teste: a próxima importação sobrescreve. Para testar o fluxo inteiro,
  criar entradas novas no Control e cancelá-las no fim ("teste").
- Mesma numeração: o Equipamentos já guarda o número da OS do Control (`os_field_control`); o importador liga o item à mesma OS.
  Entradas `BALCAO-n` antigas entram sem OS, com a referência antiga (`legacy_reference`).
- **Virada** (quando o usuário aprovar): última importação, o Equipamentos fica só leitura para equipamentos (placas seguem lá) e a
  equipe passa a lançar só no Control. O XAMPP (`print.php`) e o `zpl_bridge.php` continuam funcionando para as placas.
- A impressão pela fila não interfere no Equipamentos: são caminhos separados até a Elgin.

### Importador (escrito em 2026-11-09): `scripts/equipamentos/importar-oficina.mjs`
- Antes: aplicar a migration `20261109100000_oficina_ajustes_importacao.sql` (sem ela, os itens importados com aprovação não podem
  ser editados depois) e pôr `EQUIP_SERVICE_ROLE_KEY` no `.env` (Supabase do Equipamentos > Project Settings > API Keys > service_role).
- `node --env-file=.env scripts/equipamentos/importar-oficina.mjs --simular` → só confere e gera o relatório em
  `scripts/equipamentos/dados/` (gitignored). Sem `--simular` grava; `--sem-fotos` pula as mídias.
- O que faz: OS numérica → item ligado à OS do Control (cliente da OS); sem OS → cliente por documento, telefone ou nome exato (se não
  achar, fica de fora e vai para a lista de revisão). Etapas antigas convertidas; aprovado/recusado viram resposta do cliente "canal não
  registrado"; descarte antigo fica com nota "autorização não registrada no sistema antigo". Valores de peças/serviço, gás, técnicos em
  texto e OS de devolução não numérica vão para a "Conferência na chegada", marcados "[Importado do BRV Equipamentos]". Histórico vira
  eventos (autor "Nome (BRV Equipamentos)"), refeitos a cada rodada. Fotos/vídeos (registrados em `midias` e os arquivos soltos no
  Storage) são baixados, enviados por FTPS para `api/uploads/oficina/<id antigo>/` e registrados em `attachments` (não repete).
- Pode rodar várias vezes: atualiza os itens importados e não duplica.

### Importação
Mesmo método do Field: script com `--simular`, service_role só no `.env` local, repetível por `legacy_id`, backup antes.
- **Clientes:** casar por CPF/CNPJ, depois telefone, depois nome sem acento. Duvidosos viram **lista para revisão manual**. Só 12
  clientes para 61 equipamentos: a maioria guarda o cliente só como texto.
- **OS:** `os_field_control` numérico → `service_orders.number`. `BALCAO-` fica sem OS, guardado como referência.
- **Status:** o banco antigo aceita dois formatos (`Em Reparo` e `em_conserto`); converter para a lista nova.
- **Arquivos:** copiar do bucket `midias` para a HostGator e registrar em `attachments` (reduzir fotos acima de 5 MB). Há caminhos
  relativos (`uploads/...`, do sistema antigo em `oficina.brvniteroi.com.br`) e URLs do Storage. Fotos sem registro: localizar pela pasta.
- **Links antigos:** QR das etiquetas já coladas e galerias enviadas por WhatsApp exigem redirecionamento do domínio antigo.

## O que não trazer junto
- Número por contagem de registros; `codigo_interno` gerado no navegador.
- Fotos em `localStorage` e `localStorage.clear()` em erro; sincronização que grava ao abrir a tela; cliente casado pelo nome.
- Regras só no navegador; admin por nome (`nome LIKE '%braulio%'`); Kanban carregando a tabela inteira.
- `zpl_bridge.php` com chave fixa `BRV9100` e `Access-Control-Allow-Origin: *`; aba de pop-up para a ponte.
- Galeria pública pelo id: usar token, como `rating_token`.
- Arquivos soltos, como `ModalOrcamentoPlaca - Cópia.jsx`.

## O que existe hoje no BRV Equipamentos (referência)
| Parte | Como funciona |
|---|---|
| **Equipamentos recolhidos** | Kanban: Entrada → Diagnóstico → Aguardando orçamento → Aprovado → Aguardando peça → Em reparo → Pronto. Finais: Entregue, Recusado, Descarte. Peças, valores, técnico de retirada e de bancada, fotos e vídeos, histórico, etiqueta e recibo com garantia |
| **Reparo de placas** | Kanban próprio, orçamento, comprovante, garantia, reembolso, dashboard, galeria pública, ditado por voz |
| **Clientes** | `clientes` e `reparos_clientes`, separados entre si e do Control; ligação só pelo nome |
| **Apoio técnico** | Fichas técnicas, extração de ficha de PDF, códigos de erro, assistente técnico (Gemini) |
| **Impressão** | Etiqueta ZPL na Elgin L42PRO por `zpl_bridge.php` + `servidor_xampp/brv_print/print.php` no servidor da loja |
| **Ligação com o Control** | Só leitura: o operador digita o número da OS e `control-proxy.php` chama `consultar-os` |

Volume (2026-11-05): 61 equipamentos, 129 mídias, 266 movimentações, 12 clientes, 78 OS de placa, 584 históricos de placa,
49 clientes de placa, 131 fichas, 18 manuais, 6 usuários. Tabelas < 1 MB; Storage 63 arquivos, 186 MB (2 vídeos somam 52,9 MB).

## Segurança do sistema atual (independe da unificação)

Conferido no banco real em 2026-11-05. O usuário rodou a 1ª correção (itens 1 a 3 e a exclusão do item 4) no mesmo dia; `anon` tinha
privilégio em todas as tabelas, então os itens 1 e 2 eram exposição real até ali. A 2ª correção ligou o RLS em `documentos_fabricantes`
e `fichas_tecnicas_split`; a conferência final mostrou RLS nas 12 tabelas. Falta o usuário confirmar os testes de uso. O item 5 foi
corrigido no commit `119d428` do Equipamentos (falta confirmar com uma OS de teste) e as 6 fotos sem registro foram recuperadas. A
checagem de `ativo` e os itens 6 e 7 seguem abertos. Os itens descrevem o estado encontrado.

1. **Fotos abertas.** `storage.objects` permitia envio, alteração e exclusão no bucket `midias` para `public`, sem login.
2. **Equipamentos, histórico e mídias abertos.** `Acesso Publico Temporario` dava acesso total a `public`.
3. **Autopromoção a admin.** `Acesso perfis autenticados` deixava qualquer logado alterar qualquer perfil.
4. **Qualquer logado exclui OS de placa.** Nenhuma política checa `ativo`: bloquear um usuário não impede o acesso direto ao banco.
5. **Fotos da entrada não registradas.** `NovaOS.jsx` enviava `observacao` para `midias`, coluna inexistente.
6. **Chave do Field no Git.** `frontend/.env_old` versionado com `FC_API_KEY`. Revogar no Field e remover o arquivo.
7. **Admin pelo nome.** `is_admin()` aceita qualquer perfil com "braulio" no nome.

Ao corrigir o item 2, a consulta de reserva do `zpl_bridge.php` em `equipamentos` deixa de funcionar (usa a chave pública); o botão de
impressão não depende dela, pois grava a etiqueta antes (cópia por 4 horas).

## Anexo: consultas no Supabase do BRV Equipamentos

Colar no SQL Editor do projeto **`tnsmwpewdkdigwjyaufr`**. Todas só leem dados e não mostram informações de clientes.

```sql
-- 1. Quantidade de registros
SELECT 'equipamentos' AS tabela, count(*) FROM public.equipamentos
UNION ALL SELECT 'midias', count(*) FROM public.midias
UNION ALL SELECT 'historico_movimentacao', count(*) FROM public.historico_movimentacao
UNION ALL SELECT 'clientes', count(*) FROM public.clientes
UNION ALL SELECT 'reparos_os', count(*) FROM public.reparos_os
UNION ALL SELECT 'reparos_clientes', count(*) FROM public.reparos_clientes
UNION ALL SELECT 'reparos_historico', count(*) FROM public.reparos_historico
UNION ALL SELECT 'fichas_tecnicas_split', count(*) FROM public.fichas_tecnicas_split
UNION ALL SELECT 'documentos_fabricantes', count(*) FROM public.documentos_fabricantes
UNION ALL SELECT 'profiles', count(*) FROM public.profiles;

-- 2. Estrutura real das tabelas
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 3. Permissões em vigor (inclui o Storage)
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

-- 4. Fotos e vídeos no Storage, por tipo
SELECT metadata->>'mimetype' AS tipo, count(*) AS arquivos,
       round(sum((metadata->>'size')::bigint) / 1048576.0, 1) AS mb
FROM storage.objects
WHERE bucket_id = 'midias'
GROUP BY 1 ORDER BY 3 DESC;

-- 5. Usuários e níveis (conferir se algum desligado está ativo)
SELECT nome, nivel, ativo FROM public.profiles ORDER BY nome;

-- 6. Tamanho das tabelas
SELECT relname AS tabela, pg_size_pretty(pg_total_relation_size(relid)) AS tamanho
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```
