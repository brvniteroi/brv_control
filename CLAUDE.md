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
- `vite.config.ts`: `optimizeDeps.entries = ['index.html']` e o vigia ignora `scripts/**/dados`, `amostra`, `android*`. Sem isso o
  `npm run dev` trava em "scanning dependencies" (o Vite varre o backup do Field, ~68 mil arquivos, e o build do Android)
- Integração com o BRV Equipamentos (outro sistema): Edge Function `supabase/functions/consultar-os` devolve os dados de uma OS
  pelo número (cliente, telefone, endereço, relatos, técnico). Só o servidor do Equipamentos chama (`control-proxy.php`), com o
  segredo `EQUIPAMENTOS_SEGREDO` no cabeçalho `x-segredo`; publicada com Verify JWT desligado

## Banco de dados
- Schema completo em `supabase/migrations/20261029000000_schema_inicial.sql` (já aplicado no
  projeto `kxznmsadntuihzlizlyp`). Mudanças novas = nova migration, nunca editar a inicial.
- O usuário aplica as migrations colando o SQL no SQL Editor do Supabase (não usa a CLI). Todas as que estão em
  `supabase/migrations/` até 2026-11-01 já foram aplicadas; ao criar uma nova, avisar que precisa ser colada lá.
- Perfis em `public.profiles.role`: `admin` (tudo, inclusive excluir), `escritorio`
  (cadastros, OS, linha do tempo), `tecnico` (só as próprias atividades). Usuário novo
  nasce com `active = FALSE`.
- RLS ativo em todas as tabelas; `anon` não tem acesso a nada, exceto as funções `avaliacao_ver`/`avaliacao_enviar`
  (página pública `/avaliar/<token>`, só enxergam a OS do token). Técnico só altera execução
  da atividade (trigger `tasks_protege_agenda`).
- Realtime em `service_orders`, `tasks`, `attachments`; consumir via
  `src/hooks/useRealtimeTable.ts` (com RLS, o `old` de UPDATE/DELETE traz só o id).

## Ambiente
- `.env` não vai para o git. Copiar de `.env.example`. `VITE_SUPABASE_URL` é só a raiz
  (`https://<ref>.supabase.co`, sem `/rest/v1/`). Usar a chave publishable/anon, nunca a
  service_role.
- `hostgator-api/config.php` (no servidor) usa os mesmos URL e chave do `.env`.

## Supabase: plano e uso (conferido em 2026-11-03)
- Plano **gratuito**. A organização tem 2 projetos (`brv-control` e `BRV Equipamentos`) que dividem os limites e ocupam as 2
  vagas de projeto ativo do gratuito. Uso: em Dashboard > organização > Usage (ou na tela Projects, "Free plan usage").
- Uso em 2026-11-03: banco 154 / 500 MB (31%, já com todo o histórico do Field), egress 0,18 / 5 GB, usuários ativos 11 / 50.000,
  arquivos 0,12 / 1 GB. O banco cresce poucos MB por mês (~200 OS/mês; fotos ficam na HostGator): espaço não é problema por anos.
- Projeto gratuito é pausado após 1 semana sem uso (não ocorre com uso diário).
- **Backup é o único motivo para contratar o Pro**: o gratuito não tem backup automático confiável. Pro ≈ US$ 25/mês por organização
  com crédito para 1 projeto; com 2 projetos ≈ US$ 35/mês (conferir na tela de upgrade). Traz backup diário (7 dias), 8 GB de banco,
  250 GB de egress e sem pausa. Recomendação: Pro. Alternativa sem custo: backup próprio diário (pg_dump dos dois projetos para o
  Google Drive/HD externo), que depende do computador ligado. **Decisão pendente do usuário.**

## Estado atual (2026-10-29)
Feito:
- Estrutura do app, layout, menu e rotas. Única página ainda placeholder (`EmConstrucao`): Estoque.
  Menu com grupos recolhíveis (`Sidebar.tsx`): Serviços (linha do tempo, calendário, OS) e Cadastros (clientes, equipamentos,
  tipos de serviço `pages/TiposServico.tsx`, etiquetas `pages/Etiquetas.tsx`, modelos de formulários) e Relatórios (atividades, gráficos, tipos de serviços, Garantia BRV).
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
  desligado). Marcadores são `AdvancedMarkerElement` (o `Marker` foi descontinuado), que exigem Map ID: vem de
  `VITE_GOOGLE_MAPS_MAP_ID` (opcional; sem ele usa `DEMO_MAP_ID`). A chave precisa liberar por referenciador HTTP
  `control.brvniteroi.com.br/*` e `www.control.brvniteroi.com.br/*` (sem o `www.` dá `RefererNotAllowedMapError`).
- Página Mapa (`pages/Mapa.tsx`, `components/mapa/MapaOperacao.tsx`, só escritório): atendimentos do dia no endereço da OS
  (alfinete na cor do status, contorno na cor do técnico, número = ordem do dia) e a última posição de cada técnico.
  O app de campo envia a posição enquanto está aberto (`useRastreioCampo` em `hooks/useCampo.ts`, no máximo 1 por minuto)
  pela RPC `registrar_posicao` para `technician_locations` (só a última, sem histórico; Realtime). Navegador não rastreia com
  a tela apagada: posição com mais de 15 min aparece apagada. Migration `20261102120000_mapa_tecnicos.sql`.
  Online/offline do técnico: o app de campo manda um sinal de vida por minuto (visível e com internet: `usePresencaCampo`, RPC
  `registrar_presenca` → `technician_presence`, migration `20261103140000_presenca_tecnicos.sql`, aplicada). O Mapa mostra
  "Online" (sinal < 3 min) ou "Offline · há X" ao lado do técnico (`usePresencasTecnicos`); a linha do tempo (`GradeTempo.tsx`, só
  hoje) mostra uma bolinha verde/cinza ao lado do nome, com o "há X min" na dica. O app de campo não mostra indicador de online
  (decisão do usuário; só a faixa de "Sem internet"/envios pendentes).
- Ordens de Serviço (`pages/OrdensServico.tsx`, `components/ordens/`, `services/ordens.ts`): lista paginada com busca e
  filtros, criar/editar OS, atividades (técnico, data, status) e galeria de fotos. O status da OS segue as atividades (trigger
  `tasks_atualiza_status_os`, migration `20261102130000_status_os_automatico.sql`: alguma a caminho/em execução → em_andamento,
  senão alguma agendada → agendada, senão concluida; não mexe em OS cancelada, sem atividade ou com todas canceladas) e só pode ser `agendada`, `em_andamento`, `concluida` ou `cancelada` (migration
  `20261101110000_status_os.sql`, aplicada: converte aberta→agendada e pausada→em_andamento; chamado do portal nasce agendada). Depois de importar OS, rodar o `setval` da numeração (já vai no fim do `os.sql` gerado).
  Nova atividade (linha do tempo/calendário, `NovaAtividadeModal.tsx`): cliente com mais de um endereço ativo escolhe o
  endereço da OS nova; duração prevista é obrigatória e livre, guardada em `tasks.estimated_minutes`. O modal também tem "Solicitação do cliente" e
  "Observações internas" (campos da OS): na OS nova vão junto; em OS existente vêm preenchidos e, se mudarem, `atualizarTextosOrdem`
  grava só esses dois campos. Migration
  `20261101100000_duracao_atividade.sql` (aplicada).
  Atividade não tem `pendente` nem `pausada` e não existe mais fila "A agendar": toda atividade nasce `agendada` com técnico,
  data e hora (só concluída/cancelada importada pode ficar sem). Migration `20261101120000_status_atividade.sql` (aplicada;
  apagou as atividades pendentes/pausadas e as em aberto sem técnico ou horário). Atividade iniciada por engano volta para
  `agendada` pelo Editar da OS (`AtividadesOS.tsx` zera início e término reais ao sair de outro status para `agendada`).
  Atividade agendada tem o botão "Confirmar pelo WhatsApp" (abre o wa.me no celular do cliente com "Bom dia/Boa tarde/Boa noite,
  <cliente>, estou entrando em contato para confirmar seu agendamento do dia <data>, para o serviço <título>").
  Link "Histórico de atendimentos" no cabeçalho da OS (`HistoricoAtendimentosOS.tsx`): painel por cima da OS com as OS do cliente
  (`AtendimentosCliente` com relato do técnico; a OS de origem fica marcada); abrir outra OS dali também é por cima, e "Voltar"/Esc
  volta para a OS de origem sem perder o que não foi salvo. Na aba Atendimento do cliente (`AtendimentosCliente`, `AvaliacoesCliente`,
  ambos com `onAbrirOrdem` obrigatório) a OS também abre por cima do cadastro; fechar volta para o cliente e recarrega as listas.
  Só o Dashboard ainda usa `/ordens-de-servico?os=<id>`.
  Admin e escritório excluem formulário de campo adicionado errado (lixeira em `FormulariosAtividade.tsx`, `excluirFormulario`; migration `20261104100000_escritorio_exclui_formulario.sql`, **a colar no SQL Editor**).
  Link "Abrir cadastro do cliente" ao lado do campo Cliente da OS (só admin/escritório): abre `ClienteDetalhes` por cima da OS; ao salvar, o nome mostrado na OS atualiza.
  O escritório adiciona fotos direto na OS (botão "Adicionar fotos" em `AnexosOS.tsx`, várias de uma vez, via `anexarFoto`; só imagens).
  Admin vê um X vermelho em cada foto da OS (`AnexosOS.tsx`, `excluirAnexo` em `services/anexos.ts`): apaga só o registro em
  `attachments` (a RLS "Só admin exclui" já garante; o arquivo continua na HostGator).
  A situação da OS segue as atividades; cancelar a OS não cancela as atividades (decisão do usuário, 2026-11-03).
  Ordem de execução vale também para o escritório: migration `20261105100000_ordem_execucao_para_todos.sql` (**a colar no SQL Editor**) refaz `tasks_protege_agenda`: sair de `agendada` (a caminho/em execução/concluída direto) exige a anterior do mesmo técnico no dia concluída ou cancelada; "só hoje" segue só para o técnico; scripts com service_role não são barrados.
  Uma atividade por OS (decisão do usuário, 2026-11-05): outra visita ou segundo técnico = OS nova, sem botão de retorno. Cancelada não conta (dá para reagendar na mesma OS). Trigger `tasks_uma_por_os` (migration `20261105110000_uma_atividade_por_os.sql`, aplicada) só olha quem entra (criar, reativar, mudar de OS), então as OS antigas com várias seguem editáveis; scripts com service_role não são barrados. Na tela: `AtividadesOS.tsx` esconde "Nova atividade" e `NovaAtividadeModal.tsx` só lista OS sem atividade.
  Fim nunca antes do início: trigger `tasks_ajusta_fim` (migration `20261104110000_fim_nunca_antes_do_inicio.sql`, **a colar no SQL Editor**) evita o erro `tasks_execution_valid` ao concluir.
  Linha do tempo acompanha o horário real: o trigger `tasks_segue_horario_real` (migration `20261103160000_horario_real_na_agenda.sql`,
  aplicada) move o início para `started_at` ao iniciar (mesma duração) e o fim para `finished_at` ao concluir; em
  execução, a barra cresce até agora. O escritório arrasta qualquer atividade não cancelada (`podeMover`): na concluída corrige
  início/fim reais, na em execução corrige o início real; a caminho/em execução não trocam de técnico pelo arraste (`podeTrocarTecnico`).
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

**LEMBRETE (2026-11-05): retomar a segurança do BRV Equipamentos** (estado em `docs/oficina.md`, seção Segurança). Falta o usuário: OS de teste com foto em outro navegador (confirma o commit `119d428`), 6 testes com usuário não admin (Kanban, etapa e foto, etiqueta, galeria em aba anônima, Fichas Técnicas, Códigos de erro), conferir Logs > API, confirmar os 6 usuários e os 2 admins, revogar a chave do Field. Depois: remover `frontend/.env_old`, fazer o banco respeitar `ativo` e voltar às 7 decisões do plano. `docs/oficina.md` e este arquivo têm alterações sem commit. Ao concluir, apagar este lembrete.

**LEMBRETE (2026-11-04): retomar o APK do app de campo.** Hoje (2026-11-03) o código foi enviado e o release assinado compila local, mas falta
o usuário fazer: (1) projeto Firebase + `google-services.json` + JSON da conta de serviço; (2) os 5 secrets do workflow `android.yml` (valores em
`android-assinatura/`); (3) guardar cópia de `android-assinatura/` fora do PC; (4) colar a migration `20261103150000_push_fcm.sql`;
(5) republicar a Edge Function `notificar-tecnico` + segredo `FIREBASE_SERVICE_ACCOUNT`. Depois: rodar o workflow, instalar no celular de um técnico e testar GPS
com tela apagada, push com app fechado e o "Online" no Mapa. Até lá o pessoal usa pelo navegador. NÃO distribuir o APK sem o Firebase configurado (o
botão de ativar notificações pode travar o app). Ao concluir, apagar este lembrete.

Pendente, nesta ordem:
1. Importar a base do Field Control antes de 2026-11-18 (vencimento da assinatura). Backup completo baixado em
   `scripts/field-control/dados/` (gitignored) por `baixar-tudo.mjs` e `baixar-fotos.mjs`: 17.256 OS, 17.292 atividades,
   4.636 clientes, 68.540 fotos (14 GB; 54 não existem mais no S3 do Field). Importação: `enviar-fotos.mjs` (FTPS para
   `api/uploads/fc/`), `limpar-testes.sql` (colar no SQL Editor) e `importar.mjs` (grava direto com a service_role, que fica
   só no `.env` local; `--simular` só confere). Migration `20261102100000_importacao_field.sql` (aplicada).
   **Importação feita em 2026-11-02** (banco limpo antes; OS em aberto no Field com data < 2026-10-01 entram canceladas,
   "reported" entra concluída com o relato). Próxima OS nova: 17265. **Virada feita em 2026-11-02**: o Field não é mais usado
   (última mudança nele em 2026-10-30, antes das listas baixadas), então não há atualização final de OS/atividades.
   Não rodar o importador de novo sobre OS já em uso (ele sobrescreve o que o escritório mudou). Comentários e
   assinaturas do Field: `importar-extras.mjs` (baixa as 304 assinaturas para `dados/assinaturas/`, envia por FTPS e
   registra como anexo `assinatura`; comentários vão para `service_order_comments`, migration
   `20261103100000_comentarios_os.sql`). Comentários aparecem na OS (`ComentariosOS.tsx`, só o escritório; também para novos).
   Endereços do Field: o importador lê o endereço de cada localização (`/customers/<id>/locations`), que às vezes difere do resumo no
   cadastro do cliente; o número costuma vir vazio com "casa N" no complemento. `importar-complemento.mjs` preenche complemento vazio a
   partir do Field (nunca sobrescreve). `ajustar-numero-endereco.mjs` (2026-11-03) guarda o endereço como veio em
   `customer_address_field_original` (migration `20261103120000_endereco_original_field.sql`, só o escritório lê; mostrado em
   `EnderecosOriginaisField.tsx` no cadastro do cliente, "Endereço antigo no Field") e passa "casa N"/só número do complemento para o
   Número (40 casos; os outros ~380 endereços sem número ficam como estão). As observações do cliente no Field (1.381 clientes)
   também ficam guardadas por `guardar-observacoes-field.mjs` em `customer_field_original` (migration `20261103130000_cliente_original_field.sql`,
   só o escritório lê) e aparecem no mesmo bloco; `customers.notes` continua sendo o campo editável.
2. Depois de 18/11: avaliação automática pela WhatsApp Cloud API da Meta (ao concluir a OS; tentar coexistência no
   número atual do escritório). O app Android (APK) está em andamento, ver "APK do app de campo" abaixo. Detalhes na memória do projeto.
3. Plataforma completa para substituir o SicWeb, em fases: catálogo de produtos/serviços (importar do CSV do SicWeb,
   com limpeza) → orçamentos com aprovação do cliente → vendas e financeiro (PIX/boleto) → NF-e/NFS-e via API → estoque.
   Empresa no Simples Nacional (CSOSN 102). Análise do CSV e decisões na memória do projeto.
   **Módulo Oficina** (trazer o BRV Equipamentos para o Control): em estudo desde 2026-11-05, plano, riscos e decisões pendentes em `docs/oficina.md`. Ler antes de começar; nada implementado.
   **Módulo financeiro**: planejado e adiado (2026-11-04). Plano, decisões (nível de acesso no perfil em vez de papel novo, recebimento
   do técnico "a conferir", maquininhas Rede/InfinitePay, contas) e pendências em `docs/financeiro.md`. Ler antes de começar.

Etiquetas de OS (`tags` + `service_order_tags`, `services/etiquetas.ts`, `components/etiquetas/`): ex. "Aguardando pagamento",
"Pago". Só na OS (não no cliente) e só o escritório vê; aparecem na lista/detalhe da OS (com filtro), na linha do tempo e no
calendário (atualizam por Realtime). Excluir do catálogo: só admin.

App do técnico (`/campo`, `components/campo/`, `pages/campo/`, `services/campo.ts`): agenda só do dia, detalhes (só Google Maps; sem
telefone/contatos do cliente), a caminho / iniciar (GPS) / observações durante a execução (salvas em `technician_notes`, viram o relato) / concluir (relato e GPS; assinatura removida em 2026-11-01), fotos e formulários.
Foto que não sobe (HostGator fora do ar) não trava a fila: a conclusão e as demais ações seguem. Sair/iniciar só na
primeira atividade do dia ou na seguinte a uma concluída (`bloqueioDeInicio` em `services/campo.ts`). Testado no celular com login de técnico (2026-11-02). O banco também garante (migration `20261101150000_protecao_campo.sql`, aplicada): técnico não lê `customers` nem `customer_contacts` (nome vem de `campo_clientes()`), e o trigger
`tasks_protege_agenda` barra sair de `agendada` fora de hoje ou com a anterior não concluída. Técnico logado é mandado para `/campo`.
Avisos de agenda alterada (escritório criou, mudou horário, passou para outro técnico/dia ou cancelou atividade de HOJE):
com o app aberto, `services/avisosCampo.ts` compara com a última agenda vista, toca bipe/vibra e destaca o cartão ("Nova");
com o app fechado, notificação push: trigger `tasks_notifica_tecnico` → pg_net → Edge Function `notificar-tecnico`
(publicada com Verify JWT desligado; confere o segredo de `push_config`) → Web Push (`push_subscriptions`, `services/push.ts`,
evento `push` no `public/sw.js`). Chaves VAPID geradas por `scripts/configurar-push.mjs` (direto no banco). Migration
`20261103110000_notificacoes_push.sql`. Mudança feita pelo próprio técnico ou sem login (scripts) não avisa. Xiaomi: liberar
o Chrome em bateria "Sem restrições" e "Início automático".
Sem sinal: ações e fotos vão para a fila no IndexedDB (`services/filaCampo.ts`) e sobem quando a rede volta; a agenda usa cache
local. Formulários só online. Instalável (`public/manifest.webmanifest`, `public/sw.js`, registrado só no build).

APK do app de campo (Android, Capacitor 8; `android/`, `capacitor.config.ts`, `src/services/nativo.ts`): casco fino que abre
https://control.brvniteroi.com.br/campo (`server.url`), então ajuste de tela chega pelo deploy normal, sem APK novo; `android-web/` guarda só a tela
"Sem conexão" (`errorPath`). Visual do app não mudou (só ícone e splash com o logo, gerados por `@capacitor/assets` a partir de `assets/`).
Só gerar APK novo quando mexer no nativo (plugins, GPS, push, ícone). No APK (`ehApp`): GPS em segundo plano pelo plugin
`@capacitor-community/background-geolocation` (serviço em primeiro plano, notificação fixa; `useRastreioCampo` em `hooks/useCampo.ts`) e push nativo
pelo Firebase (`services/push.ts`; o Web Push não funciona no WebView): token em `push_fcm_tokens` (migration `20261103150000_push_fcm.sql`, **a colar no
SQL Editor**) e a Edge Function `notificar-tecnico` envia também por FCM (segredo `FIREBASE_SERVICE_ACCOUNT`; **republicar a função**). No navegador/PWA nada mudou.
Build e publicação: GitHub Actions manual `.github/workflows/android.yml` compila o APK assinado e `scripts/publicar-apk.mjs` envia por FTPS para
https://control.brvniteroi.com.br/app/brv-control.apk (link para o pessoal baixar; Android pede liberar "fontes desconhecidas"). Secrets do workflow:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `GOOGLE_SERVICES_JSON_BASE64` (Firebase) e os FTP_* do deploy.
A chave de assinatura fica em `android-assinatura/` (gitignored): **guardar cópia fora do computador**; sem ela não dá para atualizar o app já instalado
(teria que desinstalar em cada celular). `applicationId`: `br.com.brvniteroi.control`. Build local: JDK 21 + Android SDK (instalados em `C:Usersrvandroid-build`).

Módulo PMOC (em andamento; telas do Gemini prontas e auditadas em 2026-11-04, ainda com dados de demonstração; item do menu oculto em `Sidebar.tsx` até ligar ao banco, rotas `/pmoc` acessíveis por URL; falta migration `pmoc_*`, `services/pmoc.ts`, PDF no `upload.php`, CPF/registro em `employees`): briefing para o Gemini em `docs/gemini/pmoc-briefing.md` (telas e documentos impressos, com camada de dados de demonstração
`src/components/pmoc/fonteDeDados.ts`). Ele deve gravar o resumo em `docs/gemini/pmoc.md`, que o Claude **audita** antes de criar migration, services e a ligação
com o banco (o registro do responsável é CFT/TRT, não CREA/ART). A execução mensal no celular será feita pelo motor de formulários.

Avaliações do cliente (`ratings`, migration `20261102160000_avaliacoes.sql`, `services/avaliacoes.ts`, `components/avaliacoes/`):
uma por OS. Com a OS concluída, o escritório clica "Enviar avaliação pelo WhatsApp" na OS (gera o token em
`service_orders.rating_token`, abre o wa.me com o celular do cliente); o cliente avalia em `/avaliar/<token>` (`pages/Avaliar.tsx`,
sem login). Não há botão no app do técnico (decisão do usuário). Histórico do Field (uma por atividade) importado por
`scripts/field-control/importar-avaliacoes.mjs`. Aparecem na OS, na aba Atendimento do cliente e com a média por técnico em Equipe.

Relatórios (menu só para admin/escritório; `services/relatorios.ts`, `utils/relatorios.ts`, `components/relatorios/`): `/relatorios/atividades` (`pages/RelatorioAtividades.tsx`, por técnico no mês: realizadas, dias trabalhados, média por dia, média e quantidade de avaliações) e `/relatorios/graficos` (`pages/RelatorioGraficos.tsx`, colunas dos últimos 12 meses, com tabela; gráfico em HTML/CSS, sem biblioteca) e `/relatorios/tipos-de-servico` (`pages/RelatorioTiposServico.tsx`, por tipo no mês: realizadas, % do total, média e quantidade de avaliações; o tipo vem da OS) e `/relatorios/garantia-brv` (`pages/RelatorioGarantia.tsx`, ranking de técnicos por mês ou ano; reconhece o tipo pelo nome "Garantia BRV" em `ehGarantiaBrv`: renomear o tipo quebra o relatório; "Garantia TCL" fica de fora). Atividade realizada = `concluida`, datada por `finished_at` (na importada sem término, `scheduled_start`); concluída sem nenhuma das duas não entra. Dia trabalhado = dia com ao menos uma concluída. Avaliação conta no mês do `created_at`. Sem migration: lê `tasks` e `ratings` em páginas de 1000 linhas.

Usuários: admin criado; Adriana Lobo (operadora, papel `escritorio`, colaboradora "Supervisor") criada em 2026-11-01.
