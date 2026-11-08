# Módulo Oficina: plano para trazer o BRV Equipamentos para o BRV Control

Situação: **em estudo, nada implementado** (2026-11-05). Nada deste documento existe no código nem no banco do Control.
Baseado no repositório `D:\BRV_Equipamentos` (commit `84cfe00`, de 2026-11-03), incluindo o `CLAUDE.md` dele, que já traz um plano de unificação.
O banco real foi conferido em 2026-11-05 com as consultas do Anexo; vale ele, não os arquivos `.sql` do repositório, que estão defasados.

## Atualizações de 2026-11-08 (ler antes do resto)
- **APK pronto e testado** (Samsung A20 do Alberto): decisão 5 resolvida quanto ao APK. A retirada pela fase 3 não exige APK novo (o app abre o site).
- **Cargos**: `employees.role` agora vem da categoria do cargo (`public.cargos`, ver CLAUDE.md, "Funcionários e cargos"). Em vez de criar
  `role = 'bancada'` à mão, criar a **categoria** `oficina` (ou `bancada`) no CHECK de `cargos.categoria` e `employees.role`, e o cargo
  "Técnico de Bancada" para o Gustavo.
- **Adriana** é `admin` (Diretora Administrativa), não `escritorio` + financeiro como na tabela "Quem acessa o quê".
- **Comercialização**: o usuário quer vender o sistema. A frase "`empresa_id` não vem para o Control" precisa ser revista junto com o
  plano de multiempresa (ainda não escrito); a Oficina deveria nascer compatível com ele.
- **Um aparelho por técnico** e funcionários com dados pessoais (só admin) já existem; o papel `oficina` deve seguir as mesmas regras.
- Segurança do Equipamentos segue pendente (lembrete no CLAUDE.md). Recomendação: fechar antes da fase 1.
- Decisões 1, 2, 3, 4, 6 e 7 seguem abertas.

Objetivo: um sistema só, com o caminho completo **OS de campo → equipamento ou placa na oficina → devolução e cobrança**, sem digitar número de OS de um sistema no outro e com um único login e cadastro de clientes.

## O que existe hoje no BRV Equipamentos

| Parte | Como funciona |
|---|---|
| **Equipamentos recolhidos** | Kanban: Entrada → Diagnóstico → Aguardando orçamento → Aprovado → Aguardando peça → Em reparo → Pronto. Finais: Entregue, Recusado, Descarte. Peças, valores, técnico de retirada e de bancada, fotos e vídeos, histórico, etiqueta e recibo com garantia |
| **Reparo de placas** | Kanban próprio: Entrada/Triagem → Diagnóstico/Orçamento → Aguardando peça → Em reparo → Teste em simulador → Pronto → Entregue/Faturado, ou Sem conserto. Código da placa e do erro, componentes trocados, orçamento, garantia ligada à OS de origem, reembolso, dashboard de faturamento, ditado por voz, comprovante, termo de garantia, galeria pública de fotos |
| **Clientes** | `clientes` (equipamentos) e `reparos_clientes` (instaladores e clientes finais), separados entre si e do Control. A ligação é só pelo nome |
| **Apoio técnico** | Fichas técnicas (`fichas_tecnicas_split`), extração de ficha de PDF, busca de códigos de erro em manuais e assistente técnico, com Gemini |
| **Impressão** | Etiqueta ZPL na Elgin L42PRO, passando por `zpl_bridge.php` e pelo XAMPP do servidor da loja |
| **Ligação com o Control** | Só leitura: o operador digita o número da OS e `control-proxy.php` chama `consultar-os`. Nada volta para o Control |

Volume real (2026-11-05): 61 equipamentos, 129 mídias, 266 movimentações, 12 clientes, 78 OS de placa, 584 históricos de placa, 49 clientes de placa, 131 fichas, 18 manuais, 6 usuários e 1 empresa. As tabelas têm menos de 1 MB no total, então espaço no banco não é problema. No Storage: 63 arquivos, 186 MB (2 vídeos somam 52,9 MB).
A empresa é única: `empresa_id` não vem para o Control. Só 12 clientes para 61 equipamentos: a maioria das OS guarda o cliente apenas como texto, o que aumenta a revisão manual.

## Recomendação

**Um banco só e um app só, com o menu "Oficina" dentro do BRV Control, migrando por partes.** O Equipamentos segue em produção até cada parte ser validada.

Motivos:
- É o que dá ligação real entre OS, equipamento e cliente. Sincronizar dois bancos manteria dois logins, dois cadastros e dois pontos de falha.
- O Equipamentos ainda é pequeno, então migrar agora é bem mais barato do que depois.
- As bases técnicas já são as mesmas (React 19, Vite 8, Tailwind 4, Supabase, HostGator).
- Libera uma das 2 vagas de projeto do plano gratuito. Se decidir pelo Pro, o custo estimado cai de ≈ US$ 35 para ≈ US$ 25/mês (conferir na tela de upgrade).

**As telas serão reescritas, não copiadas.** O Equipamentos é JavaScript com tema escuro e consultas direto nos componentes; o Control é TypeScript com `services/`, tema claro e regras no banco. Aproveita-se a lógica e o ZPL, mas não o código das telas.

## Como encaixa no BRV Control

### Banco (só migrations novas, tabelas em inglês)
Atenção ao nome: `equipments` no Control já significa **aparelho instalado no cliente**. Por isso, o módulo usa o prefixo `workshop_`.

- **`workshop_orders`: uma tabela para equipamento e placa**, com `kind` (`equipamento` | `placa`). Os dois fluxos compartilham a maioria dos campos, fotos, histórico e etiquetas, e assim evitamos duplicar telas. Cada tipo tem suas colunas no Kanban.
  - Numeração por sequência do banco. Hoje vem de uma contagem de registros, que pode repetir número ao excluir ou salvar ao mesmo tempo.
  - `service_order_id` (OS de origem; vazio em entrada de balcão) e `return_service_order_id` (OS da devolução). Substituem os textos `os_field_control` e `os_devolucao`.
  - `customer_id`, `equipment_id` (opcional, liga ao aparelho do cliente) e `parent_order_id` (placa que saiu de um equipamento na oficina).
  - `pickup_employee_id` e `bench_employee_id`. Os nomes antigos em texto ficam guardados como histórico.
  - `warranty_origin_id` (garantia aponta para o serviço original), reembolso e valores de peças e serviço.
  - `legacy_table` e `legacy_id`, para a importação poder ser repetida sem duplicar.
- **`workshop_order_events`**: histórico de auditoria; o autor vem do login, nunca do navegador.
- **`attachments`**: nova coluna `workshop_order_id`, reaproveitando o que já existe.
- **`customers`**: passa a indicar **instalador** ou cliente final.
- **Fichas e manuais**: `fichas_tecnicas_split` e `documentos_fabricantes` vêm praticamente como estão, assim como as Edge Functions do Gemini.
- **Realtime**: `workshop_orders`, consumida por `useRealtimeTable`.

### Quem acessa o quê

| Pessoa | Hoje no Equipamentos | No Control |
|---|---|---|
| Braulio | `admin` | `admin` |
| Adriana | `diretoria` | `escritorio` + `financial_access` completo |
| Jéssica | `atendimento` | `escritorio` + `financial_access` caixa (ainda sem login no Control) |
| Pedro | `suporte_oficina` | `escritorio` + `financial_access` caixa (ainda sem login no Control) |
| Gustavo | `tecnico_bancada` | **papel novo `oficina`** |
| Técnicos de campo | não usam | `tecnico`: só registram a retirada pelo app |

- O dashboard financeiro de placas passa a usar o `financial_access` de `docs/financeiro.md`. Esse campo precisa ser antecipado.
- O papel `oficina` não conflita com a ressalva do financeiro, porque o Gustavo não acumula outra função no sistema. Ele vê só a Oficina; telefone de cliente segue mascarado, e `customers` não fica aberta a ele (mesmo cuidado do app de campo).
- Em `employees`, criar `role = 'bancada'`. Se ele for `tecnico`, aparece na linha do tempo e nos relatórios de técnicos de campo.

### Telas e caminho do serviço

Menu **Oficina**: Equipamentos (Kanban), Placas (Kanban), Finalizados, Fichas técnicas e Códigos de erro. Dashboard financeiro de placas em Relatórios.

1. **Retirada:** no app de campo, o técnico toca em "Recolher equipamento" e registra unidade, defeito e fotos. Isso cria a entrada na Oficina ligada à OS, sem redigitar nada.
2. **Na OS:** um bloco mostra "Na oficina: Em reparo" com link. O cadastro do cliente passa a listar também os serviços de oficina.
3. **Oficina:** diagnóstico, aprovação pelo WhatsApp, peças, reparo, etiqueta. Balcão e instaladores entram direto, sem OS.
4. **Devolução:** quando fica pronto, o escritório cria a OS de devolução já preenchida e ligada. Combina com a regra de **uma atividade por OS**: retirada e devolução são duas OS, como o Equipamentos já registra hoje.
5. **Cobrança:** valores ficam registrados na OS da oficina e se ligam ao financeiro quando ele existir.

## Fases

| Fase | O que entra | Resultado | Porte |
|---|---|---|---|
| **0. Preparação** | Segurança abaixo, consultas do Anexo, decisões pendentes | Dados reais conhecidos | Pequeno |
| **1. Base** | Migrations, papel `oficina`, `financial_access`, logins, instalador em `customers` | Estrutura pronta, nada visível | Médio |
| **2. Equipamentos** | Kanban, entrada, detalhes, fotos, etiqueta, recibo. Importação + conferência | Equipe usa só o Control para equipamentos | Grande |
| **3. Campo** | Retirada pelo app, bloco na OS, OS de devolução. Atualiza o `consultar-os` | É o ganho principal: o caminho completo | Médio |
| **4. Placas** | Kanban, orçamento, comprovante, garantia, reembolso, dashboard, galeria, voz | Laboratório só no Control | Grande |
| **5. Apoio técnico** | Fichas, manuais, erros, assistente | Nada mais depende do sistema antigo | Médio |
| **6. Desligamento** | Backup final, redirecionar `oficina.brvniteroi.com.br`, aposentar proxy, pausar o projeto antigo | Um sistema só | Pequeno |

Cada módulo muda de sistema de uma vez: o histórico é importado e o Kanban antigo vira somente leitura. Assim, os dois nunca recebem lançamentos do mesmo módulo ao mesmo tempo.
O APK, se publicado até a fase 3, não precisa de versão nova para a retirada, porque o app abre o site. Só exigiria APK novo se a câmera ou outro recurso nativo mudar.

### Importação
Mesmo método do Field: script com `--simular`, que grava com a service_role do `.env` local e pode ser repetido (`legacy_id`). Sempre com backup antes e nunca sobre dados já em uso no módulo novo.

- **Clientes:** casar por CPF/CNPJ, depois telefone, depois nome sem acento. Casos duvidosos viram **lista para revisão manual**, nunca união automática, porque o nome hoje é o único elo.
- **OS:** `os_field_control` numérico → `service_orders.number`. Códigos `BALCAO-` ficam sem OS, guardados como referência.
- **Status:** o banco aceita valores antigos em dois formatos (`Em Reparo` e `em_conserto`); converter para uma lista única.
- **Fotos das placas:** estão em três lugares (coluna `fotos`, JSON no histórico e pasta do Storage). Juntar sem duplicar.
- **Arquivos:** copiar do bucket `midias` para a HostGator e registrar em `attachments`. O `upload.php` hoje só aceita imagens de até 5 MB, e o Equipamentos aceita vídeos de até 50 MB; ver decisão 6. A média das JPEG é de 2,3 MB, mas algumas podem passar do limite: reduzir na importação.
- **Mídias em dois lugares:** há registros com caminho relativo (`uploads/...`, do sistema antigo em `oficina.brvniteroi.com.br`) e com URL do Storage. Os arquivos antigos só saem de lá depois de copiados.
- **Fotos sem registro:** arquivos no Storage sem linha em `midias` (ver defeito 5 abaixo) precisam ser localizados pela pasta do equipamento e registrados.
- **Links antigos:** QR das etiquetas já coladas nas máquinas, galerias enviadas por WhatsApp. Exigem redirecionamento do domínio antigo (conferir formato do QR na fase 2).

## O que não trazer junto

- Número de OS por contagem de registros (usar sequência do banco).
- Fotos guardadas em `localStorage` como cópia de segurança, e `localStorage.clear()` em qualquer erro do Kanban.
- Sincronização que grava no banco só por abrir uma OS, e cliente casado pelo nome.
- Regras só no navegador: o que importa fica em RLS e triggers, como no Control.
- Admin por nome (`nome LIKE '%braulio%'`).
- Kanban carregando toda a tabela, inclusive finalizados.
- Chave fixa no código para impressão (`BRV9100`) e `Access-Control-Allow-Origin: *` no bridge.
- Galeria pública pelo id da OS: usar token, como `rating_token` nas avaliações.
- Arquivos soltos, como `ModalOrcamentoPlaca - Cópia.jsx`.

## Segurança do sistema atual (independe da unificação)

Conferido no banco real em 2026-11-05. Situação: o usuário rodou a 1ª correção (itens 1 a 3 e a exclusão do item 4) no mesmo dia. A conferência confirmou que `anon` tinha privilégio em todas as tabelas, então os itens 1 e 2 eram exposição real até essa correção. Ela também mostrou `documentos_fabricantes` e `fichas_tecnicas_split` com RLS desligado; a 2ª correção ligou o RLS nas duas, e a conferência final mostrou RLS em todas as 12 tabelas, com regras sem login só em `clientes` (exige `auth.uid()`) e na leitura de `documentos_fabricantes`. Falta o usuário confirmar os testes de uso. O item 5 foi corrigido no commit `119d428` do Equipamentos (falta confirmar com uma OS de teste) e as 6 fotos que tinham ficado sem registro foram recuperadas em `midias` no mesmo dia. A checagem de `ativo` e os itens 6 e 7 seguem abertos. Os itens abaixo descrevem o estado encontrado.

1. **Fotos abertas (confirmado na política).** `storage.objects` permite envio, alteração e exclusão no bucket `midias` para `public`, sem login. A chave pública necessária está no site.
2. **Equipamentos, histórico e mídias abertos (política confirmada).** `Acesso Publico Temporario` dá acesso total a `public` nessas tabelas, com nome, telefone e endereço de clientes. Falta confirmar se o `anon` também tem privilégio na tabela (`supabase_auth.sql` mandava revogar).
3. **Autopromoção a admin (confirmado na política).** `Acesso perfis autenticados` deixa qualquer usuário logado alterar qualquer perfil, inclusive o próprio nível.
4. **Qualquer logado exclui OS de placa (confirmado na política).** `Permitir delecao...` anula a regra "só admin". Nenhuma política checa `ativo`: bloquear um usuário não impede o acesso direto ao banco.
5. **Defeito: fotos da entrada não registradas (confirmado no código e nas colunas; efeito não testado).** `NovaOS.jsx` envia `observacao` para `midias`, coluna que não existe. O arquivo sobe, o registro falha sem aviso, e a foto só aparece no navegador que a enviou (cópia em `localStorage`).
6. **Chave do Field no Git.** `frontend/.env_old` está versionado com `FC_API_KEY`. O repositório não é público, mas a chave está no histórico. Revogar no Field se possível e remover o arquivo.
7. **Admin pelo nome.** `is_admin()` aceita qualquer perfil com "braulio" no nome. O risco cai quando o item 3 for corrigido.

Ao corrigir o item 2, a consulta de reserva do `zpl_bridge.php` em `equipamentos` deixa de funcionar, porque usa a chave pública. O botão de impressão não depende dela, pois grava a etiqueta antes (cópia válida por 4 horas). A de `reparos_os` já não funciona hoje.

## Decisões pendentes (do usuário)

1. **Retirada pelo celular:** o técnico registra pelo app de campo, como proposto, ou continua registrando só na chegada à loja? *Recomendo pelo app.*
2. **Placa e equipamento:** uma placa recebida de fora e uma que saiu de uma máquina da oficina seguem o mesmo fluxo? *Recomendo que sim, e uma tabela só.*
3. **OS de devolução:** quando ficar pronto, o sistema cria a OS já preenchida ao clicar, ou o escritório abre manualmente? *Recomendo um botão só para este caso.*
4. **Gustavo:** só usa a Oficina, ou também vai a campo? Se for a campo, muda a proposta do papel `oficina`.
5. **Ordem frente ao resto:** fica antes ou depois do financeiro, do APK e da avaliação pelo WhatsApp? *Recomendo terminar o APK, porque já está quase pronto, e fazer as fases 0 a 3 antes do financeiro: elas geram os valores que o financeiro receberá.*
6. **Vídeos:** ampliar o `upload.php` para aceitar vídeo (confirmar espaço na HostGator) ou deixar de aceitar vídeos novos? Só há 2 vídeos no Storage em toda a história do sistema. *Recomendo limitar a fotos, se a oficina não sentir falta.*
7. **Problemas atuais:** o que mais incomoda hoje na oficina? É o que deve entrar como melhoria, em vez de só copiar.

## Anexo: consultas no Supabase do BRV Equipamentos

Colar no SQL Editor do projeto **`tnsmwpewdkdigwjyaufr`** e guardar os resultados. Todas só leem dados e não mostram informações de clientes.

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
