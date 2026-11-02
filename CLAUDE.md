# BRV Control

Sistema de gestão de serviços de campo (FSM) da BRV Niterói: clientes, equipamentos
instalados (ar-condicionado, elétrica), ordens de serviço, linha do tempo dos técnicos
e fotos de campo. Substitui o Field Control (campos `field_control_id` servem à migração).

O usuário fala português; código, comentários e mensagens de commit também em português.

## Stack
- Vite 8 + React 19 + TypeScript 7 + Tailwind 4 + react-router-dom 7
- Supabase: Postgres, Auth e Realtime (`src/services/supabase.ts`)
- Fotos ficam na HostGator, não no Supabase Storage: `hostgator-api/upload.php` valida o
  token de sessão do Supabase, grava o arquivo e devolve a URL; o app registra os
  metadados em `public.attachments` (`src/services/anexos.ts`)
- Deploy: push na `main` → GitHub Actions (`.github/workflows/deploy.yml`) compila e envia por FTPS para
  https://control.brvniteroi.com.br. O upload vai junto em `/api/` (fotos em `/api/uploads/AAAA/MM/`); o `config.php`
  é gerado no deploy a partir dos secrets (`scripts/gerar-config-upload.mjs`)
- Comandos: `npm run dev`, `npm run build`, `npm run typecheck`, `npm run lint` (oxlint)

## Banco de dados
- Schema completo em `supabase/migrations/20261029000000_schema_inicial.sql` (já aplicado no
  projeto `kxznmsadntuihzlizlyp`). Mudanças novas = nova migration, nunca editar a inicial.
- O usuário aplica as migrations colando o SQL no SQL Editor do Supabase (não usa a CLI). Todas as que estão em
  `supabase/migrations/` até 2026-11-01 já foram aplicadas; ao criar uma nova, avisar que precisa ser colada lá.
- Perfis em `public.profiles.role`: `admin` (tudo, inclusive excluir), `escritorio`
  (cadastros, OS, linha do tempo), `tecnico` (só as próprias atividades). Usuário novo
  nasce com `active = FALSE`.
- RLS ativo em todas as tabelas; `anon` não tem acesso a nada. Técnico só altera execução
  da atividade (trigger `tasks_protege_agenda`).
- Realtime em `service_orders`, `tasks`, `attachments`; consumir via
  `src/hooks/useRealtimeTable.ts` (com RLS, o `old` de UPDATE/DELETE traz só o id).

## Ambiente
- `.env` não vai para o git. Copiar de `.env.example`. `VITE_SUPABASE_URL` é só a raiz
  (`https://<ref>.supabase.co`, sem `/rest/v1/`). Usar a chave publishable/anon, nunca a
  service_role.
- `hostgator-api/config.php` (no servidor) usa os mesmos URL e chave do `.env`.

## Estado atual (2026-10-29)
Feito:
- Estrutura do app, layout, menu e rotas. Única página ainda placeholder (`EmConstrucao`): Estoque.
  Menu com grupos recolhíveis (`Sidebar.tsx`): Serviços (linha do tempo, calendário, OS) e Cadastros (clientes, equipamentos,
  tipos de serviço `pages/TiposServico.tsx`, etiquetas `pages/Etiquetas.tsx`, modelos de formulários).
- Projeto Supabase criado, schema aplicado e RLS conferido (anon recebe 401).
- Login (`AuthContext`, `Login.tsx`) e rotas protegidas (`ProtectedRoute`, bloqueia `active = FALSE`).
- Clientes (`pages/Clientes.tsx`, `components/clientes/ClienteDetalhes.tsx`, `services/clientes.ts`):
  lista paginada no servidor (50 por página), salvar via RPC `salvar_cliente` (cliente + endereço +
  contatos em uma transação), contato principal controlado por trigger (que também copia
  telefone/e-mail para `customers`), CPF/CNPJ (inclusive alfanumérico) validado em `utils/documento.ts`.
  Busca de cliente ignora acento: coluna gerada `customers.busca` (nome, fantasia, e-mail via `public.sem_acento`) +
  `semAcento()` no termo; migration `20261101130000_busca_sem_acento.sql` (aplicada).
  Vários endereços por cliente (`EnderecosAdicionais.tsx`; um é o principal, os demais aparecem na escolha do
  endereço ao criar a OS via `service_orders.address_id`). Migrations de clientes:
  `20261029120000_clientes_salvar.sql`, `20261029130000_enderecos_cliente.sql`.
- Mapa Google no cadastro do cliente (`MapaEnderecos.tsx`, `services/googleMaps.ts`): as coordenadas são
  geocodificadas ao salvar cada endereço. Precisa de `VITE_GOOGLE_MAPS_API_KEY` (opcional; sem ela o mapa fica
  desligado). A página Mapa (técnicos + atividades do dia) vem depois de OS e do app de campo.
- Ordens de Serviço (`pages/OrdensServico.tsx`, `components/ordens/`, `services/ordens.ts`): lista paginada com busca e
  filtros, criar/editar OS, atividades (técnico, data, status) e galeria de fotos. O status da OS ainda é manual (não deriva
  das atividades) e só pode ser `agendada`, `em_andamento`, `concluida` ou `cancelada` (migration
  `20261101110000_status_os.sql`, aplicada: converte aberta→agendada e pausada→em_andamento; chamado do portal nasce agendada). Depois de importar OS, rodar o `setval` da numeração (já vai no fim do `os.sql` gerado).
  Nova atividade (linha do tempo/calendário, `NovaAtividadeModal.tsx`): cliente com mais de um endereço ativo escolhe o
  endereço da OS nova; duração prevista é obrigatória e livre, guardada em `tasks.estimated_minutes`. Migration
  `20261101100000_duracao_atividade.sql` (aplicada).
  Atividade não tem `pendente` nem `pausada` e não existe mais fila "A agendar": toda atividade nasce `agendada` com técnico,
  data e hora (só concluída/cancelada importada pode ficar sem). Migration `20261101120000_status_atividade.sql` (aplicada;
  apagou as atividades pendentes/pausadas e as em aberto sem técnico ou horário).
- Equipe (`pages/Equipe.tsx`, `components/equipe/`, `services/equipe.ts`): aba Colaboradores (técnicos etc., cor, login ligado)
  e aba Usuários (só admin: criar com senha temporária, papel, bloquear, redefinir senha). Criar usuário e redefinir senha
  rodam na Edge Function `supabase/functions/gerenciar-usuario` (usa a chave de admin do Supabase, só no servidor);
  já publicada e testada (2026-11-01). Migration `20261029150000_equipe.sql` impede ficar sem admin.
- Qualquer usuário troca a própria senha pelo botão "Senha" do cabeçalho (`AlterarSenhaModal.tsx`, confere a senha atual).
  Telefones usam máscara (`utils/telefone.ts`).
- Tipos de OS editáveis (`service_types`; `service_orders.service_type_id` substitui o antigo `type` fixo). Migration
  `20261029140000_tipos_os_e_importacao.sql` também prepara importação: `field_control_id` em tasks e
  attachments, anexos com `storage = 'fieldcontrol'` (link do S3 do Field Control, sem tamanho).
- Formulários de campo (orçamento, carga de gás; PMOC depois): migration `20261029160000_formularios.sql` (já cadastra 3 modelos do Field Control), `services/formularios.ts`, `utils/formularios.ts`, `types/formularios.ts`. Telas com o Gemini: briefing em `docs/gemini/formularios.md`. O técnico preenche no celular; a resposta guarda cópia das perguntas.
- Portal do Cliente (`/portal`, login em `/portal/login`; `pages/portal/`, `components/portal/`, `services/portal.ts`): perfil `cliente`
  ligado a um cliente em `customer_users`. Sem política RLS nas tabelas operacionais: tudo por funções `portal_*` (security definer)
  que filtram pelo cliente do login; só laudos preenchidos e fotos de OS concluídas têm política de leitura. Chamado = OS `agendada`
  (`portal_abrir_chamado`). Laudo "PDF" = `VisualizarFormulario` + imprimir/salvar como PDF. Migration `20261030100000_portal_cliente.sql`.
  Liberar um cliente: criar o usuário no Auth e `SELECT public.liberar_portal_cliente('email', '<id do cliente>');`.
- Importação do Field Control: scripts em `scripts/field-control/` (baixar-amostra, gerar-sql-clientes, gerar-sql-os).
  Amostra de 3 clientes já importada (clientes, endereços, contatos). Dados baixados ficam em `amostra/` (gitignored).
- Repositório: https://github.com/brvniteroi/brv_control (privado).
- Divisão de trabalho: o Gemini cuida do visual; o trabalho técnico é feito pelo Claude.
- Migração do Field Control: docs em `API_field_control.docx`. Só depois do sistema pronto
  (ver pontos em aberto na memória do projeto). A chave vai em `FIELD_CONTROL_API_KEY` no `.env`.

Pendente, nesta ordem:
1. Importar a base do Field Control antes de 2026-11-18 (vencimento da assinatura). Backup completo baixado em
   `scripts/field-control/dados/` (gitignored) por `baixar-tudo.mjs` e `baixar-fotos.mjs`: 17.256 OS, 17.292 atividades,
   4.636 clientes, 68.540 fotos (14 GB; 54 não existem mais no S3 do Field). Importação: `enviar-fotos.mjs` (FTPS para
   `api/uploads/fc/`), `limpar-testes.sql` (colar no SQL Editor) e `importar.mjs` (grava direto com a service_role, que fica
   só no `.env` local; `--simular` só confere). Migration `20261102100000_importacao_field.sql` (aplicada).
   Depois, uma atualização final perto do dia 18 (baixar de novo as listas e rodar o importador).
2. Página Mapa. Estoque fica para o futuro (há outro sistema de estoque/vendas).

Etiquetas de OS (`tags` + `service_order_tags`, `services/etiquetas.ts`, `components/etiquetas/`): ex. "Aguardando pagamento",
"Pago". Só na OS (não no cliente) e só o escritório vê; aparecem na lista/detalhe da OS (com filtro), na linha do tempo e no
calendário (atualizam por Realtime). Excluir do catálogo: só admin.

App do técnico (`/campo`, `components/campo/`, `pages/campo/`, `services/campo.ts`): agenda só do dia, detalhes (só Google Maps; sem
telefone/contatos do cliente), a caminho / iniciar (GPS) / observações durante a execução (salvas em `technician_notes`, viram o relato) / concluir (relato e GPS; assinatura removida em 2026-11-01), fotos e formulários.
Foto que não sobe (HostGator fora do ar) não trava a fila: a conclusão e as demais ações seguem. Sair/iniciar só na
primeira atividade do dia ou na seguinte a uma concluída (`bloqueioDeInicio` em `services/campo.ts`). Testado no celular com login de técnico (2026-11-02). O banco também garante (migration `20261101150000_protecao_campo.sql`, aplicada): técnico não lê `customers` nem `customer_contacts` (nome vem de `campo_clientes()`), e o trigger
`tasks_protege_agenda` barra sair de `agendada` fora de hoje ou com a anterior não concluída. Técnico logado é mandado para `/campo`.
Sem sinal: ações e fotos vão para a fila no IndexedDB (`services/filaCampo.ts`) e sobem quando a rede volta; a agenda usa cache
local. Formulários só online. Instalável (`public/manifest.webmanifest`, `public/sw.js`, registrado só no build).

Usuários: admin criado; Adriana Lobo (operadora, papel `escritorio`, colaboradora "Supervisor") criada em 2026-11-01.
