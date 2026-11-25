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
  `supabase/migrations/` até `20261125170000` (2026-11-25) já foram aplicadas; ao criar uma nova, avisar que precisa ser colada lá.
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

## Computadores do usuário
- **PC da empresa** = `DESKTOP-PKGLS0I`, projeto em `D:\brv-control` (registrado em 2026-11-09). Tem o JDK 21 + Android SDK em
  `C:\Users\brv\android-build` (build local do APK), o `.env` com a `service_role` (scripts de dados) e a cópia de `android-assinatura/`.
  Daqui se acessa o servidor da loja (192.168.1.9: XAMPP do BRV Equipamentos e o agente da Elgin em `C:\brv-agente-impressora\agente-impressora`)
  e existe `D:\BRV_Equipamentos` (código antigo do Equipamentos, só leitura).
- **PC de casa** = `PCBRAULIOCASA` (sem Java). Antes de trabalhar em qualquer um: `git pull`; ao terminar: commit e push, para o outro PC
  continuar de onde parou. `.env` e `android-assinatura/` não vêm no `git pull`.

## Supabase: plano e uso (conferido em 2026-11-03)
- Plano **gratuito**. A organização tem 2 projetos (`brv-control` e `BRV Equipamentos`) que dividem os limites e ocupam as 2
  vagas de projeto ativo do gratuito. Uso: em Dashboard > organização > Usage (ou na tela Projects, "Free plan usage").
- Uso em 2026-11-03: banco 154 / 500 MB (31%, já com todo o histórico do Field), egress 0,18 / 5 GB, usuários ativos 11 / 50.000,
  arquivos 0,12 / 1 GB. O banco cresce poucos MB por mês (~200 OS/mês; fotos ficam na HostGator): espaço não é problema por anos.
- **Medido em 2026-11-24, depois da importação do SicWeb:** as 10 maiores tabelas somam ~167 MB (`attachments` 64 MB, `customers` 19, `tasks` 18,
  `sicweb_venda_itens` 17, `service_orders` 16, `sicweb_vendas` 14, `customer_sicweb_codes` 6,6, `customer_addresses` 6,1, `customer_contacts` 3,5,
  `sicweb_venda_pagamentos` 3); o histórico do SicWeb ocupa ~41 MB. **Banco inteiro: 192 MB de 500 MB (38%)** (`pg_database_size`, 2026-11-24). Vendas e financeiro novos devem crescer
  ~5 a 10 MB por ano (~1.100 vendas/ano + itens, orçamentos, caixa e recebimentos). **Regra:** XML/PDF das notas fiscais **não** vão para o banco (ficam na HostGator
  ou no provedor; o banco guarda número, situação e link), como as fotos.
- Projeto gratuito é pausado após 1 semana sem uso (não ocorre com uso diário).
- **Backup é o único motivo para contratar o Pro**: o gratuito não tem backup automático confiável. Pro ≈ US$ 25/mês por organização
  com crédito para 1 projeto; com 2 projetos ≈ US$ 35/mês (conferir na tela de upgrade). Traz backup diário (7 dias), 8 GB de banco,
  250 GB de egress e sem pausa. **Decisão do usuário (2026-11-11): backup próprio, sem contratar o Pro.** `scripts/backup/backup.mjs` (só o `brv-control`;
  o BRV Equipamentos vai ser desligado) faz `pg_dump -Fc` dos schemas `public` e `auth` (guarda 14 dias) e espelha por FTPS as fotos de `api/uploads/`
  (menos `fc`, que já está em `scripts/field-control/dados`; reconecta sozinho se a HostGator derrubar). Saída em `D:/backups-brv` (`banco/`, `fotos/`, `backup.log`),
  `BACKUP_PASTA_EXTRA` copia os dumps para outra pasta (não usado). **Cópia fora do PC (2026-11-16):** o Google Drive para computador sincroniza a própria `D:/backups-brv` inteira (banco e fotos, ~840 MB; plano do Drive de 5 TB com 290 GB usados em 2026-11-16, sem problema de espaço; aparece em drive.google.com > Computadores, não em Meu Drive); o PC da empresa precisa estar ligado e com o Drive aberto. Tarefa "BRV Control - Backup" no Agendador do
  PC da empresa, segunda a sexta, 9h (o log e o nome dos dumps usam o horário local desde 2026-11-12; antes era UTC, 3 h à frente) (configurado em 2026-11-12; roda ao ligar o PC se ele estava desligado às 9h; só roda com o PC ligado). Em 2026-11-16 a tarefa das 9h morreu 7 s depois de começar (código 3221225786 = encerrada à força, provavelmente a janela do console fechada; ficaram `backup.lock` e `.dump.parcial`, apagados à mão): a ação agora roda oculta (`powershell -WindowStyle Hidden`, como o vigia). Se voltar a faltar o dump do dia, ver o código da tarefa, apagar a trava velha e rodar de novo. **Em 2026-11-17 a tarefa das 9h morreu de novo sem log** (ficou só um `.dump.parcial` vazio, apagado em 2026-11-18; o dump de 18/11 está completo). Desde 2026-11-18 o `backup.mjs` grava `INICIOU (pid, pai)` no log e, se o Windows encerrar o processo, `INTERROMPIDO ... (sinal)` ou `SAIU sem terminar (código)`: se o dump do dia faltar, ler essas linhas em `D:/backups-brv/backup.log` para saber a causa. Precisa no `.env`: `BACKUP_DB_URL_CONTROL` (Session pooler, porta 5432, senha do banco).
  `pg_dump` 17 em `C:/PostgreSQL17/bin`. Restaurar: passo a passo completo e imprimível em `docs/manual-restauracao-backup.pdf` (fonte `.html`; 2026-11-12): primeiro `pg_restore --no-owner --data-only -n auth -t users -t identities`, depois `pg_restore --no-owner -n public`, num projeto Supabase novo (extensões pg_net, pg_trgm, unaccent; refazer Realtime, `push_config.function_url`, Edge Functions e segredos). Desde 2026-11-12 o dump traz as permissões (GRANT/REVOKE; antes usava `--no-privileges` e o dump restaurado deixava o `anon` com acesso: conferir com a consulta do manual). Dumps anteriores a 2026-11-12 não têm permissões. A cópia fora do PC está resolvida pelo Google Drive (ver acima). **Pendente: ensaio de restauração** (precisa de uma vaga de projeto livre; mantido pendente pelo usuário em 2026-11-16).

## Estado atual (2026-10-29)
Feito:
- Estrutura do app, layout, menu e rotas. Única página ainda placeholder (`EmConstrucao`): Estoque.
  Menu (`Sidebar.tsx`, ordem de 2026-11-10: Dashboard, Serviços, Cadastros, Relatórios, Oficina, Placas, Estoque, Ajuda; Equipe fica dentro de Cadastros). Grupos recolhíveis: Serviços (linha do tempo, calendário, OS) e Cadastros (clientes, equipamentos,
  tipos de serviço `pages/TiposServico.tsx`, etiquetas `pages/Etiquetas.tsx`, modelos de formulários) e Relatórios (atividades, gráficos, tipos de serviços, Garantia BRV).
- Projeto Supabase criado, schema aplicado e RLS conferido (anon recebe 401).
- Login (`AuthContext`, `Login.tsx`) e rotas protegidas (`ProtectedRoute`, bloqueia `active = FALSE`).
- Clientes (`pages/Clientes.tsx`, `components/clientes/ClienteDetalhes.tsx`, `services/clientes.ts`):
  lista paginada no servidor (50 por página), salvar via RPC `salvar_cliente` (cliente + endereço +
  contatos em uma transação), contato principal controlado por trigger (que também copia
  telefone/e-mail para `customers`), CPF/CNPJ (inclusive alfanumérico) validado em `utils/documento.ts`.
  Busca de cliente ignora acento: coluna gerada `customers.busca` (nome, fantasia, e-mail via `public.sem_acento`) +
  `semAcento()` no termo; migration `20261101130000_busca_sem_acento.sql` (aplicada).
  A busca também acha pelo **endereço** (2026-11-18): coluna `customers.busca_enderecos` (apelido, rua, número, complemento, bairro, cidade, CEP e referência de todos os endereços, mantida por trigger em `customer_addresses`; cada palavra do termo precisa aparecer, em qualquer ordem); migration `20261118100000_busca_por_endereco.sql` (aplicada em 2026-11-18).
  Lista de clientes: ao passar o mouse na linha aparece o endereço (dica nativa, `title`; `listarClientes` busca os endereços ativos da página, principal primeiro; 2026-11-16).
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
  Admin e escritório excluem formulário de campo adicionado errado (lixeira em `FormulariosAtividade.tsx`, `excluirFormulario`; migration `20261104100000_escritorio_exclui_formulario.sql`, aplicada).
  Link "Abrir cadastro do cliente" ao lado do campo Cliente da OS (só admin/escritório): abre `ClienteDetalhes` por cima da OS; ao salvar, o nome mostrado na OS atualiza.
  O escritório adiciona fotos direto na OS (botão "Adicionar fotos" em `AnexosOS.tsx`, várias de uma vez, via `anexarFoto`; só imagens).
  Admin vê um X vermelho em cada foto da OS (`AnexosOS.tsx`, `excluirAnexo` em `services/anexos.ts`): apaga só o registro em
  `attachments` (a RLS "Só admin exclui" já garante; o arquivo continua na HostGator).
  A situação da OS segue as atividades; cancelar a OS não cancela as atividades (decisão do usuário, 2026-11-03).
  Ordem de execução vale também para o escritório: migration `20261105100000_ordem_execucao_para_todos.sql` (aplicada) refaz `tasks_protege_agenda`: sair de `agendada` (a caminho/em execução/concluída direto) exige a anterior do mesmo técnico no dia concluída ou cancelada; "só hoje" segue só para o técnico; scripts com service_role não são barrados.
  Uma atividade por OS (decisão do usuário, 2026-11-05): outra visita ou segundo técnico = OS nova, sem botão de retorno. Cancelada não conta (dá para reagendar na mesma OS). Trigger `tasks_uma_por_os` (migration `20261105110000_uma_atividade_por_os.sql`, aplicada) só olha quem entra (criar, reativar, mudar de OS), então as OS antigas com várias seguem editáveis; scripts com service_role não são barrados. Na tela: `AtividadesOS.tsx` esconde "Nova atividade" e `NovaAtividadeModal.tsx` só lista OS sem atividade.
  **Visita impedida (2026-11-18, pedido do usuário):** técnico foi ao local e o cliente não estava. Status `impedida` na atividade (`tasks.impediment_reason`, obrigatório; botão "Não consegui atender" no app de campo, `ImpedirAtividadeModal.tsx`, só a caminho/em execução; no escritório, Situação = Impedida em `AtividadesOS.tsx`) e na OS (`atualizar_status_os`: sem atividade a caminho/em execução/agendada e com alguma impedida → OS `impedida`). Fica na linha do tempo/calendário (rosa, motivo na dica) com `finished_at` = hora do registro; conta como resolvida para liberar a próxima do técnico; só o escritório sai de `impedida` (reagendar = Situação Agendada, o motivo é limpo por trigger); não é concluída (relatórios e avaliação ignoram). Migration `20261118110000_atividade_impedida.sql` (aplicada em 2026-11-19).
  Fim nunca antes do início: trigger `tasks_ajusta_fim` (migration `20261104110000_fim_nunca_antes_do_inicio.sql`, aplicada) evita o erro `tasks_execution_valid` ao concluir.
  Linha do tempo acompanha o horário real: o trigger `tasks_segue_horario_real` (migration `20261103160000_horario_real_na_agenda.sql`,
  aplicada) move o início para `started_at` ao iniciar (mesma duração) e o fim para `finished_at` ao concluir; em
  execução, a barra cresce até agora. O escritório arrasta qualquer atividade não cancelada (`podeMover`): na concluída corrige
  início/fim reais, na em execução corrige o início real; a caminho/em execução não trocam de técnico pelo arraste (`podeTrocarTecnico`).
- Equipe (`pages/Equipe.tsx`, `components/equipe/`, `services/equipe.ts`): aba Colaboradores (técnicos etc., cor, login ligado)
  e aba Usuários (só admin: criar com senha temporária, papel, bloquear, redefinir senha). Criar usuário e redefinir senha
  rodam na Edge Function `supabase/functions/gerenciar-usuario` (usa a chave de admin do Supabase, só no servidor);
  já publicada e testada (2026-11-01). Migration `20261029150000_equipe.sql` impede ficar sem admin.
  Funcionários e cargos (2026-11-08; migration `20261108110000_funcionarios_cargos.sql`, aplicada em
  2026-11-08): a aba virou "Funcionários" (`ColaboradoresTab.tsx`). Cargos em `public.cargos` (`pages/Cargos.tsx`, menu Cadastros > Cargos,
  `services/cargos.ts`): nome livre + categoria (`tecnico` = "Atende em campo", `auxiliar`, `supervisor`, `administrativo`). O funcionário
  tem `employees.cargo_id` e o trigger `employees_role_do_cargo` copia a categoria para `employees.role`, que continua sendo o que o sistema
  usa (linha do tempo, agenda, relatórios: `role = 'tecnico'`); mudar a categoria de um cargo muda os funcionários dele
  (`cargos_propaga_categoria`). Cargos iniciais: Mecânico de Refrigeração, Auxiliar, Supervisor, Administrativo (os atuais foram ligados pela
  função antiga). Dados pessoais em `public.funcionario_dados` (1:1, RLS **só admin**, LGPD): CPF (único, validado), RG/órgão, nascimento,
  CTPS (nº/série/UF; a digital é o CPF), PIS/NIS, admissão, registro profissional (CFT, para o PMOC) e endereço com CEP (`utils/cep.ts`).
  **Comercialização (pedido do usuário, 2026-11-08)**: o usuário quer vender o sistema; multiempresa (cada empresa só vê os próprios dados,
  `empresa_id` em todas as tabelas) tem rascunho de plano em `docs/multiempresa.md` (2026-11-17). **Decisão do usuário:** o BRV Control fica só para a BRV (Oficina e Placas não viram módulos dele); vende-se um **produto novo "Bancada Pro" (nome decidido em 2026-11-17), só de Placas, para oficinas de reparo de placa como a BRV**, multiempresa desde a primeira tabela (repositório novo, portando o que já funciona). FSM e PMOC como produto vendável ficam para depois. 7 perguntas em aberto no plano. Nada construído.
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

**LEMBRETE (2026-11-17, PC DA EMPRESA): concluir o PMOC fases 2 e 3** (lembrar o usuário logo no início da conversa). Em 2026-11-17 o Gemini entregou as telas
(`docs/gemini/pmoc-fase2.md`; Claude auditou, commit `cfcbe79`) e o Claude escreveu o backend: migration `20261117100000_pmoc_execucao_qr.sql`
(**aplicada em 2026-11-17; a verificação `supabase/verificacao/pmoc_execucao_qr.sql` passou: TUDO CERTO**),
`services/pmoc.ts` ligado (`fonteDeDados.ts` com `USAR_BANCO_PMOC = true` chama o banco nas 9 funções novas), etiqueta ZPL `utils/etiquetaPmoc.ts`,
QR real (pacote `qrcode`, `QrCodeImagem.tsx`) e ajuda F1 (tópicos `pmoc-do-mes`, `pmoc-checklist-campo`, `pmoc-relatorio-link`). Push feito em 2026-11-17 (deploy no site).
**Testado e aprovado pelo usuário em 2026-11-17:** fase 1 na prática (plano com TRT em PDF, Vigente, documento impresso) e fase 2 (Gerar OS do mês,
checklist no celular, conclusão com o nome de quem acompanhou, relatório por link no WhatsApp). Roteiro que falta: imprimir a etiqueta na Elgin e ler o QR com o
celular (se o QR não ler, ajustar `^BQ` em `etiquetaPmoc.ts`). O plano de teste foi apagado em 2026-11-17 (ver `docs/pmoc.md`): para testar a etiqueta, criar um plano
(se for teste, apagar depois e zerar `pmoc_code_seq`). Modelos de tarefa refeitos em 2026-11-17 (split 17, cassete 19, VRF 21). Laboratório: o usuário mandou e-mail em 2026-11-18 e aguarda resposta. **Lançamento comercial (2026-11-18, seção "Lançamento comercial" do `docs/pmoc.md`):**
3 documentos do Claude (plano comercial com preços/site/Google Ads, carta aos clientes e treinamento dos mecânicos). Falta o usuário: confirmar a tabela de preços
e o custo da hora do mecânico, alinhar a carta (planos "Essencial/Completo" e "app" não batem com o plano), publicar a página `pmoc.html` no site (fora deste
repositório; o Claude monta se tiver acesso aos arquivos), criar a campanha no Google Ads e dar o treinamento. Ao concluir, apagar este lembrete.

**LEMBRETE (2026-11-19): desligar o BRV Equipamentos** (lembrar o usuário logo no início da conversa no PC da empresa; o usuário deixou para outro dia; decisão do usuário; substitui o antigo lembrete de segurança do Equipamentos, de 2026-11-05, que perdeu
o sentido). Conferido em 2026-11-19: **nada do Control depende do projeto `tnsmwpewdkdigwjyaufr`** (nenhum anexo, foto de placa, manual ou ficha aponta para ele; só os
scripts de importação em `scripts/equipamentos/`). Lá restam 12 tabelas (81 OS de placas, 62 equipamentos, 620 históricos, 276 movimentações, 139 mídias, 131 fichas...)
e o bucket `midias` com 77 arquivos (220 MB). Roteiro, no PC da empresa: (1) `git pull` e **arquivo final**: `node scripts/equipamentos/arquivo-final.mjs` (`--simular`
antes; baixa todas as tabelas em JSON e todos os arquivos para `D:/backups-brv/equipamentos-final-AAAA-MM-DD`, que o Google Drive sincroniza; precisa de
`EQUIP_SERVICE_ROLE_KEY` no `.env`; simulação rodada no PC de casa em 2026-11-19 sem falhas); conferir o `LEIA-ME.json` (contagens e falhas); (2) **pausar** o projeto no
painel do Supabase (reversível; libera a vaga do gratuito); (3) **apagar** depois de algumas semanas sem falta; (4) desligar o site do Equipamentos no XAMPP da loja
(**não** desligar o servidor: o agente da Elgin roda nele) e, opcional, apagar a Edge Function `consultar-os` e o segredo `EQUIPAMENTOS_SEGREDO` do Control; (5) com a vaga
livre, fazer o **ensaio de restauração do backup** (pendente). Ao apagar o projeto: tirar `EQUIP_SERVICE_ROLE_KEY` do `.env`, atualizar a seção "Supabase: plano e uso"
(1 projeto) e apagar este lembrete.

**LEMBRETE (2026-11-25, PC DA EMPRESA): continuar Vendas e Financeiro** (lembrar o usuário logo no início da conversa). Parte 1 (catálogo e orçamentos) está no banco e verificada.
Passo 1 **feito em 2026-11-25** (829 itens: 759 produtos, 70 serviços, 763 custos; `scripts/sicweb/importar-produtos.mjs`, repetível, `--atualizar-precos` na virada; Fabricante e Observações na tela; campo fiscal em branco continua em branco; perguntas para o contador em `docs/perguntas-contador.md`, **aguardando respostas**). Falta, nesta ordem: ~~(1) importar o catálogo do SicWeb~~ (como foi feito: (`TABEST1`, 829 itens): conferir antes as colunas reais pelo `sqlcmd` no SQL Server Express deste PC (`.SQLEXPRESS`, banco `SICNET`), escrever `scripts/sicweb/importar-produtos.mjs` no molde de `importar-vendas.mjs` (simula por padrão, `--gravar`; chave `catalog_items.legacy_code` = `controle`; código, código de barras/GTIN, nome, unidade, preço de venda, custo em `catalog_item_costs`, fabricante, observações, data do último reajuste em `price_updated_at`, ativo; tipo serviço para "M.O ..."; **estoque não vem do SicWeb**, tem muito saldo negativo: começa zerado) e mostrar Fabricante/Observações na tela do catálogo); (2) **parte 2 feita em 2026-11-25** (migration `20261125110000_vendas_financeiro_base.sql` **aplicada e verificada**; falta o teste na prática pelo usuário: venda de balcão em `/vendas` e taxas das maquininhas em `/financeiro/cadastros`. Inclui vendas, contas, maquininhas com taxa zero, categorias, fornecedores, movimentos imutáveis, `unir_clientes` com orçamentos e vendas; verificação `supabase/verificacao/vendas_financeiro_base.sql`, que **já passou** num ensaio com desfazimento no banco real) e **só então fazer commit e push** (o código já chama as funções novas: `USAR_BANCO_VENDAS` e `USAR_BANCO_CADASTROS`). Sem emissão fiscal: a tela só registra o número da nota (`EMISSAO_FISCAL_DISPONIVEL`). A venda guarda o frete do orçamento; desconto geral repartido entre as duas notas. Ajuda F1 das vendas e dos cadastros feita; (3) **parte 3**: telas do Financeiro (caixa, recebimentos, extrato, cadastros) e o nível financeiro na aba Usuários; (4) ajuda F1 de Vendas e Financeiro e só então ligar `MOSTRAR_MENU_VENDAS`/`MOSTRAR_MENU_FINANCEIRO`. Contrato das telas: `types/vendas.ts`, `types/financeiro.ts` e os `fonteDeDados.ts`; auditorias em `docs/gemini/vendas-financeiro-r1-auditoria.md` e `-r2-auditoria.md`; mapa SICNET -> Control em `docs/financeiro.md`. Ao concluir, apagar este lembrete.

**OFICINA E IMPRESSORA: implantação concluída em 2026-11-11** (não é mais lembrete; fica como registro e referência do agente da Elgin):
(1) **FEITO em 2026-11-09**: agente da Elgin instalado no servidor da loja (login `impressora@brvniteroi.com.br`, pasta em
`C:\brv-agente-impressora\agente-impressora`), imprime sem etiqueta em branco (ajustes do rolo no `LEIA-ME.md` do agente). Tarefa "BRV Control - Impressora" no Agendador
de Tarefas do servidor **confirmada pelo usuário em 2026-11-11** (o agente sobe sozinho quando o servidor reinicia);
(2) **FEITO**: Gustavo já usa o sistema (2026-11-09);
(3) **FEITO**: equipe avisada (equipamento só no Control; técnicos usam "Recolher equipamento"; o Equipamentos fica só para placas);
(4) **DECIDIDO: não** mostrar a faixa "só consulta" no BRV Equipamentos (o banco já está travado por `somente-leitura-equipamentos.sql`, aplicado em 2026-11-09);
(5) pendências de `docs/oficina.md` **todas decididas em 2026-11-09**: OS de balcão NÃO conclui sozinha, F1 liberado para o Gustavo (`Layout.tsx`),
tipo da OS de devolução continua sendo escolhido pelo escritório na hora. Cópia de `android-assinatura/` para o PC da empresa: feita em 2026-11-09.
~~Confirmar a tarefa "BRV Control - Impressora" no Agendador~~ (feito em 2026-11-11). **Agente 1.1.0 (2026-11-10):** informa no sinal de vida (`print_agents.info`) versão, margem, passo, PID e data do arquivo; a margem encostada e a etiqueta em branco voltaram em 2026-11-10 porque o servidor tinha um `agente.mjs` antigo; trocado e reiniciado, imprime normal (servidor com `MARGEM_ESQUERDA_MM=4`). Ao mudar `agente.mjs`, copiar para `C:\brv-agente-impressora\agente-impressora`, reiniciar a tarefa e conferir a versão no banco. **Etiqueta em branco depois da impressa (2026-11-10, resolvido):** a tarefa do Windows ainda rodava o processo antigo (1.0.0) na memória; reiniciada com o arquivo novo, e a calibração da Elgin refeita e gravada (`~JC` + `^JUS`, mandados pela fila). Se voltar: `npm run calibrar` (agora também grava com `^JUS`) ou pedir ao Claude para mandar `~JC` e `^XA^JUS^XZ` pela fila.
**Etiquetas em branco, causa real (2026-11-10 à tarde, o Claude do servidor diagnosticou; resumo no `LEIA-ME.md` do agente):** o sensor de espaço da Elgin estava sobre a faixa lateral de 3 mm (só papel de fundo), não embaixo da etiqueta; o Braulio o centralizou e deu 5 de 5 testes perfeitos. Causa secundária: o agente 1.1.0 mandava `^LL424` (altura + espaço); `^LL` é só a altura. **Agente 1.2.0** (feito no servidor e trazido para o repositório): `^LL400` por `ALTURA_ETIQUETA_MM` (50; `PASSO_ETIQUETA_MM` não é mais usado), `^MNY` só se o ZPL não tiver `^MN`, comandos `--status` (lê `~HS`/`^HH`, não imprime; 4º número da 1ª linha do `~HS` ≈ 400-406 = bom, 1259 = calibração perdida), `--calibrar` (`~JC` direto pela rede, não grava) e `--gravar-config`; sinal de vida com `altura_etiqueta_mm`/`ll_pontos`. Impressora gravada: GAP/NOTCH, TRANSMISSIVE, largura 800, comprimento 405. **Ao trocar o rolo, conferir que o sensor fica no centro, embaixo da etiqueta.** Conferido pelo usuário em 2026-11-11: `agente.mjs` do servidor igual ao do repositório (1.2.0)
e tarefa reiniciada, teste de aceite ok (6 etiquetas, 0 em branco) e o tipo de impressão (fita/THERMAL-TRANSFER).

**PLACAS: módulo concluído em 2026-11-11** (não é mais lembrete; fica como registro do que foi feito e das decisões). **Todas as migrations até `20261110150000` foram aplicadas
(usuário confirmou em 2026-11-10).** **Feito em 2026-11-10 (commitado):** migration
`20261110100000_placas_base.sql` (tabelas próprias `board_clients`, `board_orders`, `board_finance`, `board_photos`, `board_events`, `board_number_seq`; número `OS-DDMMAA-NNN`
com trava; regras de etapa, financeiro só com `tem_financeiro_placas()`, histórico imutável, RLS só admin/escritório, função pública `placa_acompanhamento(token)`),
`src/services/placas.ts`, `fonteDeDados.ts` ligada ao banco (`USAR_BANCO_PLACAS = true`; fichas e manuais também no banco, ver P7a), verificação
`supabase/verificacao/placas_base.sql` (ROLLBACK) **passou**, menu liberado (`MOSTRAR_MENU_PLACAS = true`), ajuda F1 feita (seção "Placas" em `src/ajuda/topicos.ts`;
manter atualizada). Quadro das placas (migration `20261110120000_placas_junta_etapas.sql`): Entrada → Diagnóstico → **Em Reparo / Aguardando Peça** (juntas) → Pronto;
a etapa Teste em Simulador saiu. **Conferido pelo usuário em 2026-11-10:** telas em `/placas` testadas com dados reais; etiqueta de placa configurada e imprimindo na Elgin; Edge Function
`apoio-tecnico` publicada e funcionando. **Falta:** (b) ~~tirar o resto do "modo oficina"~~ (feito em 2026-11-11: aviso "Modo consulta (oficina)", checagem na demonstração e comentários; o papel `oficina` não usa Placas);
(c) ~~PDF do orçamento~~ **resolvido por link em 2026-11-11** (o `wa.me` só leva texto): migration `20261111100000_placas_orcamento_link.sql`
(aplicada em 2026-11-11; `board_orders.quote_token`, separado do `public_token` do acompanhamento; canal `link`; `board_enviar_orcamento_link` marca enviado e devolve o token;
públicas `placa_orcamento_ver`/`placa_orcamento_aprovar`, só aprovam orçamento `enviado` dentro da validade, contada do envio; o nome digitado vai para o histórico via `board.ator_nome`
em `board_ator()`). Página pública `/orcamento-placa/:token` (`pages/OrcamentoPlacaPublico.tsx`: mesma folha `components/placas/FolhaOrcamentoPlaca.tsx`, "Salvar em PDF / Imprimir",
nome + "Li e concordo" + **Aprovar orçamento**; recusa e dúvidas pelo botão do WhatsApp). Botão "Enviar pelo WhatsApp (link para aprovar)" no detalhe e na folha
(`enviarOrcamentoPorLink`; a aba do WhatsApp abre já no clique, `prepararJanelaWhatsApp`, para o navegador não bloquear). Ajuda F1 `placas-orcamento` atualizada. O quadro das Placas atualiza por Realtime
(2026-11-11, migration `20261111120000_placas_realtime.sql`, aplicada em 2026-11-11): placa com orçamento aprovado em Entrada/Diagnóstico ganha borda verde e o selo "Aprovado, iniciar reparo" (`CartaoPlaca.tsx`); sem aviso por sino/e-mail. **Garantia (decidido em 2026-11-11):** termo **só impresso na retirada** (saiu o "Enviar pelo WhatsApp"
do termo); retorno em garantia **só com a placa original entregue e garantia vigente** (vencida = placa normal com orçamento; sem garantia "avulsa"), também para placa de campo
(lista as placas do cliente da OS, `placasDoClienteControl`); garantia definida na entrada não muda depois; o retorno, ao ser entregue, ganha **novos 90 dias** da nova saída (termo
cita a placa original). Banco: migration `20261111110000_placas_garantia_vigente.sql` (aplicada em 2026-11-11; refaz `board_orders_preenche` e cria `board_orders_garantia_fixa`).
Cláusulas de perda da garantia **unificadas** no orçamento e no termo (`PERDA_GARANTIA_PLACA` em `textosJuridicosPlacas.ts`: selo, raio, sobretensão, água/líquidos,
maresia/umidade, insetos, terceiros). QR no comprovante **descartado pelo usuário** (2026-11-11; o comprovante leva só o link); (f) ~~virada~~ **feita em 2026-11-10 à noite** (o usuário já não
lançava no Equipamentos): backup das tabelas antigas em `scripts/equipamentos/dados/backup-placas-equipamentos-2026-11-10.json` (gitignored; 81 OS, 49 clientes, 620
históricos), importação final (79 de 81 regravadas; OS-221026-001 e OS-031126-001 já mexidas no Control, mantidas; fotos já estavam) e `scripts/equipamentos/somente-leitura-placas.sql` **aplicado no projeto BRV Equipamentos** (2026-11-10; trava placas, clientes,
histórico, fichas e manuais; o sistema antigo está todo só leitura). O Equipamentos e o XAMPP da loja podem ser desligados quando o usuário quiser (as etiquetas já saem pelo agente do Control). Histórico do que foi feito:
(6) P2: importador `scripts/equipamentos/importar-placas.mjs` **rodado de verdade em 2026-11-10** (ensaio; repetível, não sobrescreve placa mexida no Control): 81 placas (63 entregues, 10 prontas, 6 em entrada, 2 aguardando peça), 61 clientes de placas, 589 eventos de histórico, 63 registros financeiros (faturamento 18.170,00; 2 reembolsos; 6 entregues sem valor ficam com faturamento zero por decisão do usuário), 35 fotos copiadas para a HostGator (`api/uploads/placas/`). Técnico de bancada de todas as placas = Braulio Rodrigues Valente (decisão do usuário); registro profissional dele gravado em `funcionario_dados` ("CRT 96236361720", 2026-11-10). **A importação final fica para a virada** (rodar de novo antes de o Equipamentos sair do ar, depois de congelar lançamentos nele); (7) P4: **etiqueta na Elgin feita em 2026-11-10** (`utils/etiquetaPlaca.ts`, `pedirEtiquetaPlacaNaFila` em `services/placas.ts`, mesma fila e agente da Oficina; migration `20261110110000_fila_impressao_placas.sql`, aplicada; testada na Elgin); faltam PDF real (orçamento e termo, hoje cai em Imprimir/Salvar PDF + WhatsApp) e QR no comprovante
e P7 (apoio técnico). **P7a feito em 2026-11-10 (commitado):** migration `20261110130000_placas_apoio_tecnico.sql` (`board_tech_sheets`, `board_manuals`; ler/cadastrar admin e escritório, editar ficha e excluir só admin; aplicada), services/telas de fichas e manuais ligados ao banco, importador `scripts/equipamentos/importar-apoio-tecnico.mjs` (131 fichas + 18 textos de códigos de erro; os "18 manuais" do Equipamentos são TEXTOS, não PDFs; `--simular` antes; repetível, não sobrescreve). **P7b feito em 2026-11-10 (publicado e testado):** migration `20261110140000_placas_ia_uso.sql` (limite de 40 consultas/hora por pessoa, `board_ai_usage`; aplicada), Edge Function única `supabase/functions/apoio-tecnico` (Gemini; ações `erro` = código de erro, lê primeiro `board_manuals` e só pesquisa em site oficial se não houver texto, e `ficha` = lê PDF/TXT e preenche a ficha; **publicar com Verify JWT ligado**, secret `GEMINI_API_KEY` já criado). **Oficina sem orçamento (2026-11-10, pedido do usuário):** a fase de orçamento/resposta do cliente dos equipamentos está desligada para não travar a OS: migration `20261110150000_oficina_sem_orcamento.sql` (aplicada; função `oficina_exige_orcamento()` = FALSE, a oficina vai do diagnóstico direto ao reparo e "pronto" não pede resposta) e `EXIGE_ORCAMENTO_OFICINA = false` em `src/utils/oficina.ts` (esconde o card de orçamento; sobra a autorização de descarte). Religar = os dois juntos. **2026-11-11:** a coluna "Aguardando orçamento" ficou sempre visível e a bancada (Gustavo) pode ir da Entrada direto para ela e voltar (migration `20261111130000_oficina_entrada_para_orcamento.sql`, aplicada em 2026-11-11); continua sem exigir aprovação do cliente. **Orçamento de placa (2026-11-10):** até R$ 250,00 não exige sinal (PIX na retirada; `LIMITE_SEM_SINAL_PLACA`/`exigeSinalPlaca` em `regrasPlacas.ts`), acima mantém sinal de 50% e a política de execução; a seção "Escopo dos serviços inclusos" foi removida. Técnico de bancada das placas = só Braulio Valente (`ehTecnicoBancadaPlacas`). **O Assistente técnico de bancada foi excluído (decisão do usuário, 2026-11-10)**: tela, menu, botão na placa e ajuda removidos. Ao concluir, apagar este lembrete.

**LEMBRETE (2026-11-10, NOITE): repetir o teste do APK com tela apagada** (lembrar o usuário logo no início da conversa). **Teste marcado para domingo 2026-11-15 não foi registrado como feito; segue pendente (usuário confirmou em 2026-11-16), nova data a combinar** (em 2026-11-12 o usuário conferiu no A20 do Alberto: bateria "Sem restrições" e atividade em segundo plano já estavam certas; faltava conferir "Apps em suspensão", localização "o tempo todo" e a notificação fixa com a tela apagada). Em 2026-11-09 o APK
já estava instalado nos técnicos Alberto, Emerson e Marcus (têm token em `push_fcm_tokens`; o Bruno Brum, conta técnica do usuário, ainda só
no navegador). **Resultado do teste de 2026-11-10 de manhã (A20 do Alberto):** a **notificação push chegou** com o app fechado e a tela apagada
(atividade passada para ele às 07:59, o celular apitou); **falhou o "Online" e o GPS**: o sinal de vida parou às 07:38:30, no minuto em que a tela
apagou (celular parado), e a posição não atualizou mais; nem o push o fez voltar. Suspeita: a bateria do Android congela o serviço com o celular parado.
Antes de repetir, no celular: Aplicativos > BRV Control > Bateria "Sem restrições"; Cuidados do dispositivo > Bateria > Limites de uso em segundo plano
(tirar o app de "Apps em suspensão" e "suspensão profunda"); Localização "Permitir o tempo todo"; conferir que a notificação fixa "Compartilhando sua
posição..." aparece e **segue visível com a tela apagada**. Se mesmo assim cair, o problema é do app (o serviço em primeiro plano não segura o celular
acordado): corrigir o código (`useRastreioCampo`, plugin de GPS, talvez WakeLock/`ACCESS_BACKGROUND_LOCATION`) e gerar APK novo. Roteiro: técnico parado (Alberto), Mapa "Online" com o app aberto, apagar a tela ~10 min sem mexer,
conferir no Mapa que segue "Online" (sinal < 3 min) e que a posição atualizou (parado: a cada 5 min), e criar uma atividade de hoje para ele com o
app fechado (deve chegar notificação). O Claude pode acompanhar pelo banco (`technician_presence`, `technician_locations`, só leitura) enquanto o
usuário testa. Se cair para "Offline": bateria "Sem restrições" + tirar de "Otimizar uso da bateria"/"Apps em suspensão" (Samsung) ou "Início
automático" (Xiaomi). Ao dar certo, apagar este lembrete e o de baixo.

**LEMBRETE (2026-11-08): concluir a implantação do APK** (detalhes técnicos na seção "APK do app de campo", abaixo). Falta:
(1) ~~copiar `android-assinatura/` do PC de casa para o PC da empresa, pen drive e Google Drive~~ (feito, usuário confirmou em 2026-11-09); (2) repetir no A20 do Alberto o teste **parado com tela apagada ~10 min** (Mapa deve seguir
"Online" e a posição atualizar a cada 5 min); (3) instalar nos outros técnicos (passo a passo na seção). A `notificar-tecnico` sem a duplicada
(commit `3c8ba40`) foi republicada em 2026-11-08. Ao concluir, apagar este lembrete.
Até lá o pessoal usa pelo navegador. Ao concluir, apagar este lembrete.

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
   número atual do escritório). O app Android (APK) está pronto e testado (2026-11-08); falta instalar nos técnicos, ver o lembrete e "APK do app de campo" abaixo. Detalhes na memória do projeto.
3. Plataforma completa para substituir o SicWeb, em fases: catálogo de produtos/serviços (importar do CSV do SicWeb,
   com limpeza) → orçamentos com aprovação do cliente → vendas e financeiro (PIX/boleto) → NF-e/NFS-e via API → estoque.
   Empresa no Simples Nacional (CSOSN 102). Análise do CSV e decisões na memória do projeto.
   **Módulo Oficina** (trazer o BRV Equipamentos para o Control): plano do módulo Equipamentos aprovado em 2026-11-08 (placas depois;
   orçamento continua no SicWeb; Gustavo com papel `oficina`; Elgin por fila de impressão + agente no servidor da loja; descarte só com
   autorização do cliente registrada na OS; item usa o número da OS do Control). **Fase 1 e telas feitas em 2026-11-08**: migration
   `20261108130000_oficina_base.sql` (aplicada em 2026-11-08), `services/oficina.ts`, `utils/etiquetaOficina.ts`, telas do Gemini em
   `components/oficina/` (auditadas; resumo em `docs/gemini/oficina.md`), ajuda F1 (telas `oficina` e `item-oficina`), agente da Elgin em
   `scripts/agente-impressora/` (ainda não instalado no servidor). Importador do Equipamentos: `scripts/equipamentos/importar-oficina.mjs`
   (migration `20261109100000_oficina_ajustes_importacao.sql` aplicada; `EQUIP_SERVICE_ROLE_KEY` no `.env`; uso em `docs/oficina.md`).
   **Virada da oficina feita em 2026-11-09**: importação final (62 itens, 276 eventos, 139 fotos/vídeos); equipamentos agora só no
   Control, com "Recolher equipamento" no app de campo (`components/campo/RecolherEquipamento.tsx`). O Equipamentos segue só para placas.
   O importador não sobrescreve item já alterado no Control. Migration `20261109110000_oficina_corrige_historico.sql` (aplicada em
   2026-11-09) corrigiu o erro "Só é possível escrever notas no histórico" em toda ação com login; retirada pelo app testada (OS 17332).
   Em 2026-11-10: fase de orçamento desligada (ver o lembrete das Placas); quadro junta Entrada/Diagnóstico e Aguardando peça/Reparo e esconde colunas de orçamento
   vazias (`KanbanOficina.tsx`, `utils/oficina.ts`); `scripts/equipamentos/recuperar-fotos-oficina.mjs` recupera as fotos falsas (545 bytes) a partir da pasta
   `uploads` do sistema antigo. Fases 2 e 3, pendências e o uso em paralelo
   com o Equipamentos em `docs/oficina.md`. Ler antes de continuar.
   **Migração das Placas** (reparo de placas do Equipamentos para o Control): plano em `docs/placas.md` (2026-11-09); **módulo concluído e virada feita (2026-11-10 e 11)**; detalhes e decisões no bloco "PLACAS: módulo concluído", acima. Decidido: número próprio `OS-DDMMAA-NNN` (OS do Control só
   quando a equipe de campo retira a placa), cadastro de clientes de placas paralelo (`board_clients`), orçamento feito no Control com PDF pelo WhatsApp, parceiro acompanha por
   link público (`/placa/<token>`) enviado no comprovante de entrada, financeiro das placas próprio e **só para o Braulio** (marca `profiles.board_finance_access`, migration `20261109120000_acesso_financeiro_placas.sql`, aplicada; helper `utils/acessoPlacas.ts`), aproveitando o dashboard do sistema antigo, **migração dos dados só no fim, com telas
   prontas, testadas e simulações**. Telas: briefing para o Gemini em `docs/gemini/placas-briefing.md` (dados de demonstração em `src/components/placas/fonteDeDados.ts`; resumo em
   `docs/gemini/placas.md`, que o Claude **audita** antes de criar migration/services/importador). O apoio técnico (fichas técnicas, manuais e códigos de erro com IA; o assistente foi excluído em 2026-11-10) migra junto, dentro do **menu "Placas"** (rotas `/placas...`). **A `oficina` (Gustavo) não acessa as Placas**: o técnico de placas é o Braulio (admin); só admin e escritório. Nenhuma decisão em aberto no plano.
   **Telas do Gemini prontas e auditadas em 2026-11-09** (rotas `/placas...` e `/placa/:token`, dados de demonstração; resumo `docs/gemini/placas.md`, auditoria `docs/gemini/placas-auditoria.md`). Menu "Placas" **liberado em 2026-11-10** (`MOSTRAR_MENU_PLACAS = true` em `Sidebar.tsx`) depois que o banco passou na verificação. **Decididos em 2026-11-09** (ver `docs/placas.md`, itens 6 a 9): bloqueio de etapa sem orçamento aprovado mantido; sem conserto não gera reembolso (reembolso = caixa + valor devolvido, só no financeiro); dias contados desde a entrada sem zerar (`diasDesdeEntrada`, base do futuro relatório de tempo médio de reparo). **Telas testadas e aprovadas pelo usuário em 2026-11-09.**
   **Módulo financeiro**: planejado e adiado (2026-11-04); em 2026-11-24 o uso real do SicWeb foi medido e há uma ordem proposta de implantação e de virada (venda e caixa antes de títulos; fiscal decide a data) no fim de `docs/financeiro.md`, a confirmar com o usuário. Plano, decisões (nível de acesso no perfil em vez de papel novo, recebimento
   do técnico "a conferir", maquininhas Rede/InfinitePay, contas) e pendências em `docs/financeiro.md`. Ler antes de começar.

**Data de saída das placas (corrigido em 2026-11-16, commit `4679ed2`):** a entrega mandava só `AAAA-MM-DD` e o banco lia meia-noite UTC (21h do dia
anterior): a saída ficava um dia antes e, com entrada no mesmo dia, o banco recusava ("A saída não pode ser antes da entrada"). Agora `instanteDaSaida`
em `services/placas.ts` manda hoje sem data (o banco usa `NOW()`) e dia passado como 23:59 local; o calendário da entrega vai da entrada até hoje.
As 14 placas entregues pelo Control de 10/11 a 16/11 foram corrigidas no banco em 2026-11-16 (SQL em `supabase/verificacao/corrige_saida_placas_um_dia_antes.sql`).
**Cuidado geral:** nunca gravar data sem hora (`AAAA-MM-DD`) em coluna `TIMESTAMPTZ`.

**Placa sem defeito (2026-11-12, pedido do usuário):** botão "Placa sem defeito" no detalhe da placa (`PlacaDetalhes.tsx`, só escritório/admin, em Entrada/Diagnóstico): pede o valor da avaliação em bancada
(garantia não cobra), manda a placa direto para **Pronto** sem orçamento nem aprovação e abre o WhatsApp (`textoWhatsAppSemDefeitoPlaca` em `regrasPlacas.ts`: não apresentou defeito + valor + pronta para retirada).
O valor fica em `board_orders.quote_amount` (a saída já sugere esse valor) e a marca em `board_orders.no_defect_found` (migration `20261112100000_placas_sem_defeito.sql`, aplicada em 2026-11-12; refaz
`board_orders_regras`: a marca só vale com a mudança para Pronto, dispensa o orçamento só para Pronto/Entregue, e voltar para Entrada/Diagnóstico a limpa). Verificação com ROLLBACK em `supabase/verificacao/placas_sem_defeito.sql`
(rodada pelo usuário em 2026-11-12: TUDO CERTO, 10 verificações). Cartão com selo "Sem defeito" (`CartaoPlaca.tsx`); a seção Orçamento some nessa placa. Serviço `marcarSemDefeito` em `services/placas.ts`. Ajuda F1 atualizada (`placas-como-funciona`).

**Códigos de erro para técnico e oficina (2026-11-13, pedido do usuário):** a consulta (`pages/PlacasErros.tsx`, prop `simples`: sem menu de Placas e sem botões de exemplo) também está em `/campo/erros` (botão "Erros" no cabeçalho do app de campo, `CampoLayout.tsx`; só com internet) e em `/codigos-de-erro` (item só do papel `oficina`, `soBancada` em `Sidebar.tsx`). Edge Function `apoio-tecnico`: `tecnico` e `oficina` só fazem a ação `erro`, com limite de **6 consultas/hora por pessoa** (admin/escritório seguem com 40 e as duas ações); função republicada no Supabase (usuário confirmou em 2026-11-16; Verify JWT ligado). Sem migration; sem APK novo (o app abre o site).

**Backup sob demanda e painel do backup (2026-11-13, pedido do usuário):** no Dashboard, só para o **admin**, o cartão `CartaoBackup.tsx` mostra o último backup concluído (agendado ou pedido pelo botão; vermelho se o último falhou ou passou de 4 dias), se o PC da empresa está online e o botão **Fazer backup agora**. O pedido vai para `backup_runs` pela RPC `backup_solicitar` (só admin, só com o PC online, um por vez); o vigia `scripts/backup/agente-backup.mjs` (tarefa do Agendador "BRV Control - Agente de Backup", registrada por `scripts/backup/instalar-agente-backup.ps1`, roda o tempo todo, usa a service_role do `.env`) manda o sinal de vida para `backup_agent`, pega o pedido, roda o `backup.mjs` e grava o resultado; o backup agendado das 9h também se registra no fim (`reportar` no `backup.mjs`). O `backup.mjs` ganhou trava (`backup.lock`, código de saída 2 se já há outro) e grava o dump em `.dump.parcial` (se falhar, o dump bom do mesmo dia não é apagado). Migration `20261113100000_backup_sob_demanda.sql` (aplicada em 2026-11-13; vigia instalado e testado de ponta a ponta no PC da empresa: pedido -> em andamento -> concluído em ~30 s) + verificação `supabase/verificacao/backup_sob_demanda.sql` (testadas com ROLLBACK em 2026-11-13). Log do vigia: `D:ackups-brvagente-backup.log`. O arquivo do backup continua só no PC da empresa. Ajuda F1 (Dashboard) atualizada.

Dashboard (2026-11-12): o cartão "Em andamento" e a legenda da composição mostram quantas das OS em andamento são de balcão (tipo "Oficina (balcão)",
`balcaoEmAndamento` em `services/dashboard.ts`; OS de balcão nasce `em_andamento` e fica assim enquanto o item está na oficina).
No Kanban da Oficina, o cartão de balcão (item sem `pickup_employee_id`) tem fundo azul claro (`CartaoItem.tsx`). Os 2 itens antigos `BALCAO-53` e `BALCAO-61`
ganharam as OS 17381 e 17382 em 2026-11-12 (OS criada direto no banco, `legacy_reference` mantida).

**Comprovante de entrada da Oficina (2026-11-19, pedido do usuário: "semelhante ao das placas, com envio pelo WhatsApp"):** botão **Comprovante** no item
(`ItemOficinaDetalhes.tsx`, só admin/escritório; item cancelado não tem) abre `components/oficina/ComprovanteEntradaOficina.tsx` (A4: cliente, telefone,
equipamento, acessórios, defeito, conferência da entrada, link, cláusulas `CLAUSULAS_COMPROVANTE_OFICINA` em `utils/oficina.ts` adaptadas das placas, assinaturas),
com **Imprimir**, **Copiar link** e **Enviar o link pelo WhatsApp** (`textoWhatsAppEntradaOficina`; telefone pela RPC `oficina_contato_cliente`, só escritório:
o papel `oficina` continua sem ver telefone). Página pública `/acompanhar-oficina/:token` (`pages/AcompanhamentoOficina.tsx`, função anon `oficina_acompanhamento`):
etapa atual, linha do tempo simplificada (`PASSOS_ACOMPANHAMENTO_OFICINA`) e garantia de 90 dias depois de entregue; sem diagnóstico, valores, observações,
fotos nem contato. Token em `workshop_orders.public_token` (não muda pelo app). WhatsApp da loja no comprovante: `WHATSAPP_OFICINA` = (21) 99972-7798 (o geral do site;
o de `EMPRESA_BRV` é o das placas). Migration `20261119100000_oficina_comprovante.sql` (aplicada em 2026-11-19; refaz a visão `oficina_itens`). Ajuda F1: `oficina-comprovante`. **Testado e aprovado pelo usuário em 2026-11-19** (comprovante, impressão, WhatsApp e página pública). A confirmar com o usuário: texto das cláusulas, o WhatsApp (21) 99972-7798 e se o comprovante deve abrir sozinho depois da entrada de balcão.

Etiquetas de OS (`tags` + `service_order_tags`, `services/etiquetas.ts`, `components/etiquetas/`): ex. "Aguardando pagamento",
"Pago". Só na OS (não no cliente) e só o escritório vê; aparecem na lista/detalhe da OS (com filtro), na linha do tempo e no
calendário (atualizam por Realtime). Excluir do catálogo: só admin.

App do técnico (`/campo`, `components/campo/`, `pages/campo/`, `services/campo.ts`): agenda só do dia, detalhes (só Google Maps; sem
telefone/contatos do cliente), a caminho / iniciar (GPS) / observações durante a execução (salvas em `technician_notes`, viram o relato) / concluir (relato e GPS; assinatura removida em 2026-11-01), fotos e formulários.
Foto que não sobe (HostGator fora do ar) não trava a fila: a conclusão e as demais ações seguem. Sair/iniciar só na
primeira atividade do dia ou na seguinte a uma concluída (`bloqueioDeInicio` em `services/campo.ts`). Testado no celular com login de técnico (2026-11-02). O banco também garante (migration `20261101150000_protecao_campo.sql`, aplicada): técnico não lê `customers` nem `customer_contacts` (nome vem de `campo_clientes()`), e o trigger
`tasks_protege_agenda` barra sair de `agendada` fora de hoje ou com a anterior não concluída. Técnico logado é mandado para `/campo`.
Avisos de agenda alterada (escritório criou, mudou horário, passou para outro técnico/dia, cancelou ou excluiu atividade de HOJE; exclusão
desde a migration `20261108100000_aviso_atividade_excluida.sql`, aplicada em 2026-11-08: o banco manda os dados da OS junto, porque a função não
acha mais a atividade; testado no A20):
com o app aberto, `services/avisosCampo.ts` compara com a última agenda vista, toca bipe/vibra e destaca o cartão ("Nova");
com o app fechado, notificação push: trigger `tasks_notifica_tecnico` → pg_net → Edge Function `notificar-tecnico`
(publicada com Verify JWT desligado; confere o segredo de `push_config`) → Web Push (`push_subscriptions`, `services/push.ts`,
evento `push` no `public/sw.js`). Chaves VAPID geradas por `scripts/configurar-push.mjs` (direto no banco). Migration
`20261103110000_notificacoes_push.sql`. Mudança feita pelo próprio técnico ou sem login (scripts) não avisa. Xiaomi: liberar
o Chrome em bateria "Sem restrições" e "Início automático". No APK o envio é pelo Firebase (ver "APK do app de campo"); técnico com token do APK
não recebe mais pelo Web Push do Chrome (a inscrição antiga do navegador ficava duplicando).
Sem sinal: ações e fotos vão para a fila no IndexedDB (`services/filaCampo.ts`) e sobem quando a rede volta; a agenda usa cache
local. Formulários só online. Instalável (`public/manifest.webmanifest`, `public/sw.js`, registrado só no build).

APK do app de campo (Android, Capacitor 8; `android/`, `capacitor.config.ts`, `src/services/nativo.ts`): casco fino que abre
https://control.brvniteroi.com.br/campo (`server.url`), então ajuste de tela chega pelo deploy normal, sem APK novo; `android-web/` guarda só a tela
"Sem conexão" (`errorPath`). Visual do app não mudou (só ícone e splash com o logo, gerados por `@capacitor/assets` a partir de `assets/`).
Só gerar APK novo quando mexer no nativo (plugins, GPS, push, ícone). No navegador/PWA nada mudou.
- **GPS** (`ehApp`): plugin `@capacitor-community/background-geolocation` (serviço em primeiro plano; `useRastreioCampo` em `hooks/useCampo.ts`).
  Exige a notificação fixa "Compartilhando sua posição com o escritório..." (regra do Android 8+, não dá para esconder; também é a transparência
  que a LGPD pede). O técnico pode deixá-la "Silenciosa", mas não desligar a categoria. `distanceFilter: 0` (o plugin lê a cada 1 s com o GPS já
  ligado; com filtro, parado não chegava leitura) e o JS envia no máx. 1/min andando (≥ 30 m) e a cada 5 min parado. Com a tela apagada o WebView
  congela os relógios, então cada leitura do GPS também renova a presença ("Online" no Mapa).
- **Push**: Firebase projeto `brv-control` (plano Spark grátis, FCM V1 ativada, app `br.com.brvniteroi.control`; conta da BRV no console.firebase.google.com).
  `services/push.ts` registra o token em `push_fcm_tokens` (migration `20261103150000_push_fcm.sql`, aplicada) pela RPC `registrar_push_fcm`; no
  Android < 13 a permissão já vem liberada e o registro roda sozinho ao abrir o app (sem botão); erro aparece na faixa azul do app. A Edge Function
  `notificar-tecnico` envia por FCM (segredo `FIREBASE_SERVICE_ACCOUNT` no Supabase = JSON da conta de serviço) e, se o técnico tem token do APK,
  não envia pelo Web Push. **Nunca dar `await`/`return` de um plugin do Capacitor em função async**: o proxy responde a `then` e trava para sempre
  sem erro (foi o que impediu o push até 2026-11-08); usar `registerPlugin` direto, como em `services/push.ts` e `services/nativo.ts`.
- **Build**: GitHub Actions manual `.github/workflows/android.yml` (Actions > "APK do app de campo (Android)" > Run workflow; ~2 min) compila,
  assina e publica por FTPS (`scripts/publicar-apk.mjs`) em https://control.brvniteroi.com.br/app/brv-control.apk. Versão = número da execução
  (`versionCode`/`1.0.N`); instalar a nova por cima da antiga. Secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`
  (`brv-control`), `ANDROID_KEY_PASSWORD` (= a do keystore, PKCS12), `GOOGLE_SERVICES_JSON_BASE64` e os FTP_* do deploy (cadastrados em 2026-11-08).
  O workflow faz `chmod +x gradlew` (commit no Windows perde o bit de execução: erro 126). Build local só no PC da empresa (JDK 21 + Android SDK
  em `C:\Users\brv\android-build`); o PC de casa `PCBRAULIOCASA` não tem Java. Custo do APK: zero (Firebase, Actions e distribuição pelo link
  são grátis; Play Store só se quiser, US$ 25 uma vez).
- **Chave de assinatura** em `android-assinatura/` (gitignored, **não vem no `git pull`**): `brv-control.jks` (gerada em 2026-11-08 no PC de casa com
  openssl, PKCS12, RSA 4096, validade até 2056; substitui a do primeiro build, que nunca foi instalada), os `.base64.txt` dos secrets,
  `google-services.json`, `firebase-conta-servico.json` e `LEIA-ME.txt` com senha e valores. **Guardar cópia fora do computador**: sem ela não
  dá para atualizar o app instalado (teria que desinstalar em cada celular). Tratar como senha (a conta de serviço manda push em nome do app).
- **Instalar num celular**: antes, desinstalar o PWA (atalho do sistema pelo Chrome), se houver, porque Chrome e APK contam como 2 aparelhos. Chrome > control.brvniteroi.com.br/app/brv-control.apk > baixar mesmo assim > permitir instalar desta fonte (e
  "Instalar mesmo assim" no Play Protect); se houver versão assinada com outra chave, desinstalar antes. Abrir, logar com o técnico, localização
  "Permitir o tempo todo". Bateria: Samsung = Aplicativos > BRV Control > Bateria "Sem restrições" + desmarcar em "Otimizar uso da bateria" +
  tirar de "Apps em suspensão"; Xiaomi = bateria "Sem restrições" + "Início automático". Conferir no Mapa ("Online") e com uma atividade de hoje
  criada com o app fechado (deve chegar notificação). Testado no Samsung A20 (Android 11) do Alberto em 2026-11-08: GPS com tela apagada, Online,
  nova atividade e exclusão com app fechado.
- **Um aparelho por técnico** (2026-11-08, migration `20261108120000_um_aparelho_por_tecnico.sql`, aplicada): cada aparelho tem
  um id em localStorage (`services/aparelho.ts`); no login (`AuthContext.signIn`) o técnico assume o aparelho (RPC `assumir_aparelho`) e as
  sessões dos outros são revogadas (`signOut({ scope: 'others' })`); o `CampoLayout` confere a cada minuto (`aparelho_liberado`) e, se outro
  aparelho assumiu, sai só deste (`scope: 'local'`, tira o token de push) com aviso na tela de login. Sem aparelho registrado, o primeiro que
  conferir fica. Trocas em `tecnico_aparelho_trocas`; o Mapa avisa "Login usado em N aparelhos nas últimas 24 h". Chrome e APK no mesmo
  celular contam como 2. Escritório/admin não têm a regra. Motivo: o link do APK é público e login compartilhado fazia o técnico "estar em 2 lugares".
- Login (`pages/Login.tsx`) com `name`/`autocomplete="username"` para o gerenciador de senhas oferecer salvar; o app não consegue forçar, depende
  do serviço de preenchimento automático do celular (Google ou Samsung Pass). A sessão fica salva: o técnico só digita a senha de novo se sair.

**Módulo PMOC: plano de implantação em `docs/pmoc.md` (2026-11-16; ler antes de continuar)**: 4 fases (banco e telas ligadas → execução mensal com OS do mês e checklist no app → QR por aparelho com página pública → melhorias), pesquisa do mercado e **decisões do usuário tomadas em 2026-11-16** (aparelho = cadastro do cliente, botão "Gerar OS do mês", checklist próprio, só o nome de quem acompanhou sem assinatura, relatório por link, nenhum cliente com PMOC ainda, responsável técnico sempre o Braulio, mesma etiqueta da Oficina). Incluídos por pedido do usuário: QR Code por equipamento com página pública e OS do mês gerada pelo sistema. **A RE 09/ANVISA foi revogada (RDC 886/2024)**: frase legal da capa já trocada (`pmoc/empresa.ts`, NBR 17037). **Prioridade pedida pelo usuário: indicar laboratório de qualidade do ar perto de Niterói** (levantamento inicial no item 11 do plano; falta conferir acreditação).
**PMOC fase 1 escrita em 2026-11-16** (detalhes em "Estado da fase 1" do `docs/pmoc.md`): migration `20261116100000_pmoc_base.sql` (aplicada em 2026-11-16) + verificação `supabase/verificacao/pmoc_base.sql` (passou em 2026-11-16; falta o teste na prática com TRT em PDF), `services/pmoc.ts`, `fonteDeDados.ts` com `USAR_BANCO_PMOC = true`, gravação do plano inteiro em `pmoc_salvar_plano`, PDF no `upload.php` (só admin/escritório), menu Serviços > PMOC liberado e ajuda F1 (seção PMOC). "Gerar OS do mês" ficou para a fase 2.
**PMOC fases 2 e 3 (2026-11-17, migration `20261117100000_pmoc_execucao_qr.sql`, aplicada e verificada em 2026-11-17):** `pmoc_gerar_os_mes` (só escritório; plano vigente; cria OS do tipo "PMOC" `agendada` + uma atividade com técnico, início e duração escolhidos + `service_order_equipments` + uma linha `pmoc_executions` pendente por aparelho com tarefa no mês; uma OS por plano e mês, OS cancelada não conta; o tipo "PMOC" é criado pela migration, renomear quebra), checklist do técnico só por funções (`pmoc_checklist_atividade`, `pmoc_salvar_execucao`, `pmoc_concluir_checklist`; técnico só mexe na atividade dele; fotos `pmoc_executions.photo_urls` só https; o nome de quem acompanhou é obrigatório) e trigger `tasks_exige_checklist_pmoc` (técnico não conclui atividade de PMOC com checklist pendente; escritório pode). Token do aparelho em `equipments.public_token` (32 hex; o `qr_code` digitado à mão NÃO é usado); `pmoc_report_links` (token por plano e mês); públicas (anon) `pmoc_relatorio_publico` e `pmoc_equipamento_publico` (sem CPF/CNPJ, telefone, endereço nem observações; aparelho sem PMOC não tem página). O resumo do mês (`resumoDoMes`) é calculado no app. Etiqueta: `print_jobs.kind = 'etiqueta_pmoc'` (100 x 50 mm, mesmo rolo da Oficina; o QR sai pela impressora com `^BQ`); relatório e prévia usam o pacote `qrcode`. Checklist só online (sem fila offline; fase 4).
Módulo PMOC (histórico: telas do Gemini prontas e auditadas em 2026-11-04; ligadas ao banco na fase 1 em 2026-11-16): briefing para o Gemini em `docs/gemini/pmoc-briefing.md` (telas e documentos impressos, com camada de dados de demonstração
`src/components/pmoc/fonteDeDados.ts`). Ele deve gravar o resumo em `docs/gemini/pmoc.md`, que o Claude **audita** antes de criar migration, services e a ligação
com o banco (o registro do responsável é CFT/TRT, não CREA/ART). A execução mensal no celular será feita pelo motor de formulários.

Avaliações do cliente (`ratings`, migration `20261102160000_avaliacoes.sql`, `services/avaliacoes.ts`, `components/avaliacoes/`):
uma por OS. Com a OS concluída, o escritório clica "Enviar avaliação pelo WhatsApp" na OS (gera o token em
`service_orders.rating_token`, abre o wa.me com o celular do cliente); o cliente avalia em `/avaliar/<token>` (`pages/Avaliar.tsx`,
sem login). Não há botão no app do técnico (decisão do usuário). Histórico do Field (uma por atividade) importado por
`scripts/field-control/importar-avaliacoes.mjs`. Aparecem na OS, na aba Atendimento do cliente e com a média por técnico em Equipe.
Pedido automático por e-mail ao concluir (o Field fazia por e-mail, não WhatsApp; ver memória): migration `20261107100000_avaliacao_por_email.sql`
(aplicada em 2026-11-07; secret `AVALIACAO_SEGREDO` criado). E-mail usado: o do contato principal (`customers.email`); sem ele, o de outro
contato do cliente (migration `20261107110000_avaliacao_email_outros_contatos.sql`, aplicada). Teste aprovado e envio liberado para os clientes em 2026-11-07 (`somente_para = NULL`; desligar tudo: `ativo = false`).
O Dashboard (`AtividadesHoje.tsx`) mostra nas atividades concluídas de hoje as estrelas, por onde o cliente respondeu e o comentário, ou
"Avaliação pedida..., aguardando"; a página se atualiza sozinha a cada 2 min e ao voltar para a aba.
A OS mostra um aviso grande "Cliente sem e-mail cadastrado" (só admin/escritório; `clienteTemEmail` em `services/clientes.ts`, mesmo critério
do envio) com botão "Cadastrar e-mail" que abre o cadastro por cima; ao fechar, confere de novo. Em 2026-11-07, 64,7% dos clientes atendidos
nos últimos 12 meses não tinham e-mail (53,6% do cadastro todo). Contatos do cliente têm botão
Editar (lápis em `ClienteDetalhes.tsx`, `atualizarContato`); basta telefone ou e-mail. Trigger `service_orders_pede_avaliacao` → `avaliacao_email_processar` (regras: só com login; OS já avaliada ou já pedida
por e-mail não; concluída há mais de 24 h não; cliente sem e-mail não; cliente com pedido por e-mail ou WhatsApp nas últimas 72 h, mesmo de outra OS, não)
→ pg_net → `hostgator-api/enviar-avaliacao.php` (publicado em `/api/`, `mail()` da HostGator, remetente `avaliacao@brvniteroi.com.br`, resposta
`brv@brvniteroi.com.br`) → `avaliacao_email_resultado`. Tudo fica em `rating_requests` (enviado/falhou/pulado com motivo; o botão do WhatsApp registra
pedido também). Liga/desliga e modo teste em `avaliacao_config` (`ativo`, `somente_para` manda tudo para um endereço só); o segredo de lá vai no secret
`AVALIACAO_SEGREDO` do GitHub (`scripts/gerar-config-upload.mjs` põe no `config.php`). Na OS (`AvaliacaoOS.tsx`): situação do e-mail, WhatsApp e
"Copiar link" bloqueados por 72 h depois do e-mail (`ESPERA_EMAIL_HORAS`), depois "Pedir de novo pelo WhatsApp"; a avaliação mostra se o cliente
respondeu pelo e-mail ou pelo WhatsApp (`ratings.origem`, vem de `?origem=` no link). DNS: SPF, DKIM e DMARC (`p=none`, criado em 2026-11-07) ok.

Relatórios (menu só para admin/escritório; `services/relatorios.ts`, `utils/relatorios.ts`, `components/relatorios/`): `/relatorios/atividades` (`pages/RelatorioAtividades.tsx`, por técnico no mês: realizadas, dias trabalhados, média por dia, média e quantidade de avaliações) e `/relatorios/graficos` (`pages/RelatorioGraficos.tsx`, colunas dos últimos 12 meses, com tabela; gráfico em HTML/CSS, sem biblioteca) e `/relatorios/tipos-de-servico` (`pages/RelatorioTiposServico.tsx`, por tipo no mês: realizadas, % do total, média e quantidade de avaliações; o tipo vem da OS) e `/relatorios/garantia-brv` (`pages/RelatorioGarantia.tsx`, ranking de técnicos por mês ou ano; reconhece o tipo pelo nome "Garantia BRV" em `ehGarantiaBrv`: renomear o tipo quebra o relatório; "Garantia TCL" fica de fora). Atividade realizada = `concluida`, datada por `finished_at` (na importada sem término, `scheduled_start`); concluída sem nenhuma das duas não entra. Dia trabalhado = dia com ao menos uma concluída. Avaliação conta no mês do `created_at`. Sem migration: lê `tasks` e `ratings` em páginas de 1000 linhas.

Ajuda do operador (só admin/escritório; 2026-11-07): **F1** (ou botão "Ajuda" do cabeçalho, ou menu "Ajuda (F1)") abre painel lateral com os
tópicos da tela atual e busca sem acento; manual completo e imprimível em `/ajuda`. Conteúdo em `src/ajuda/topicos.ts` (escrito pelo Claude):
**ao mudar uma tela, nome de botão ou regra, atualizar o tópico no mesmo commit.**
**REGRA FIXA (pedido do usuário, 2026-11-07): todo módulo ou tela nova do escritório (PMOC, Estoque, Oficina, Financeiro, orçamentos...) só
está pronto com a ajuda feita**: tópicos em `topicos.ts` (nova `TelaAjuda`, `NOME_TELA`, seção em `SECOES` se for módulo novo), rota em
`telaDaRota` e `useTelaAjuda` nos painéis que abrem por cima. Lembrar o usuário disso ao planejar o módulo e conferir antes do commit final. A tela vem da rota (`telaDaRota`) ou de quem está aberto
por cima (`useTelaAjuda('os' | 'cliente' | 'nova-atividade')` em `src/ajuda/contextoAjuda.ts`). Visual com o Gemini: briefing `docs/gemini/ajuda.md`
(ele só mexe em `AjudaPainel.tsx`, `TextoAjuda.tsx`, `pages/Ajuda.tsx`; visual feito e auditado em 2026-11-07, resumo em `docs/gemini/ajuda-resultado.md`).
A impressão do manual é uma cópia montada por portal em `document.body`, porque o `index.css` esconde o `#root` ao imprimir.

**Clientes do SicWeb (2026-11-24, base do futuro financeiro):** exportação em `scripts/sicweb/dados/clientes.csv` (9.351 cadastros; também `produtos.csv`; a pasta é gitignored, tem dados pessoais) e script `scripts/sicweb/importar-clientes.mjs` (`node --env-file=.env scripts/sicweb/importar-clientes.mjs` SIMULA e escreve relatórios em `dados/saida/`; `--gravar` grava; `--so-existentes` só liga códigos sem criar cliente). Cada cliente do SicWeb ganha o código em `customer_sicweb_codes` (um cliente do Control pode ter vários códigos; é a ponte para títulos, vendas e notas do SicWeb; migration `20261124100000_clientes_sicweb.sql`, aplicada em 2026-11-24). Regras: nada do que já existe é sobrescrito (só preenche vazio); duplicados do próprio SicWeb (mesmo documento, ou mesmo nome + telefone) viram um cliente; **decisão do usuário (2026-11-24): cadastrar como está no SICNET e acertar depois**, então a dúvida (mesmo nome com telefone diferente etc.) entra como cliente novo e fica listada em `revisar.csv` com os candidatos do Control para unir depois; a fonte padrão é o banco SICNET restaurado (`--csv` usa o CSV, que perde 12 cadastros com linha quebrada); só colunas de cadastro são lidas (a TABCLI tem número de cartão, código de segurança e senha: nunca importar); observação do cliente vai para `customers.notes` nos novos. Simulação de 2026-11-24 (pelo banco): 9.363 lidos, 9.284 clientes após juntar duplicados, 3.043 já existem no Control, 6.241 novos (303 deles com dúvida). Telefones saem no formato `(21) 99999-9999`, CEP só dígitos, nome em MAIÚSCULAS vira "Nome Próprio". **Gravado em 2026-11-24:** 9.363 códigos ligados a 9.222 clientes (o Control foi de 4.686 para 10.919 clientes; cliente novo do SicWeb entra com `field_control_id` nulo e código em `customer_sicweb_codes`). 12 cadastros têm código com lixo no próprio SICNET (ex.: `ri o and`, `0ilson`) e ficam com esse código como veio; há também códigos curtos (`2737`): o código é sempre gravado como está no TABCLI, sem completar com zeros. Pendente de acerto (decisão do usuário: "acertar depois"): unir cadastros duplicados (ver `revisar.csv`), ~340 clientes sem endereço e ~590 sem contato.

**Backup do SicWeb restaurado no PC da empresa (2026-11-24):** `scripts/sicweb/dados/Backup_SICNET_20261124.bak` (194 MB, SQL Server 2019, banco `SICNET`; gitignored) foi restaurado no **SQL Server 2022 Express** instalado neste PC (instância `.\SQLEXPRESS`, login do Windows, arquivos em `C:\Program Files\Microsoft SQL Server\MSSQL16.SQLEXPRESS\MSSQL\DATA`; `sqlcmd` em `C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn`, usar `-C`). Instalação só em português (a mídia em inglês falha no Windows pt-BR) e foi preciso remover o ODBC Driver 17 quebrado antes. Mapa das tabelas: `TABCLI` clientes (`codigo` = código do CSV, `controle` = chave interna usada nos `lkcliente`), `TABEST1` produtos, `TABEST3A` documentos de venda/compra (`venda=1`, `cancelada` NULL = ativa; ~21,7 mil vendas de 2008 a 2026, ~6,6 mil clientes), `TABEST3B` itens (67.636), `TABEST3R` pagamentos por forma (`TABEST7`), `TABEST4`/`TABEST5` orçamentos, `TABCR1` contas a receber em aberto (2.280, saldo ~R$ 1.035.506) e `TABCR2` quitadas (111), `TABCX1` caixa (15.895), `TABCP*` contas a pagar, `TABNFCE` NFC-e (2.228), `TABCAR1` cartão, `TABCHQ*` cheques, `TABRECIB` recibos, `TABATND*` atendimentos. **Unir cadastros duplicados de um mesmo cliente (2026-11-24):** feito à mão em SQL, em transação, para "Primeira Igreja Batista de São Gonçalo" (CNPJ e 46 vendas do cadastro do SicWeb foram para o cadastro do Field, que tinha as OS) e "Teresa Maria Miranda Silva" (3 cadastros viraram 1, com os endereços Casa, Consultório e Icaraí; cada venda aponta para o endereço do cadastro de onde veio). `sicweb_vendas.address_id` (migration `20261124120000_vendas_endereco.sql`, aplicada; FK composta endereço+cliente) liga a venda ao endereço e a aba Vendas mostra a coluna Endereço quando o cliente tem mais de um. Cuidado ao unir: a FK composta de `service_orders` (endereço, cliente) impede mudar o `customer_id` de um endereço que tem OS; o jeito é criar o endereço novo sob o cliente principal, religar OS e vendas num UPDATE só e apagar o antigo; conferir antes que nada (OS, vendas, PMOC, equipamentos, oficina, placas) aponta para o que vai sair. **Comando para unir (2026-11-24):** função `unir_clientes` (migration `20261124130000_unir_clientes.sql`, aplicada; `20261124140000_unir_clientes_enderecos.sql` melhora o reconhecimento de endereço repetido — número em comum + rua parecida ou CEP igual, apartamentos diferentes continuam separados — e completa CEP/complemento do endereço reaproveitado, aplicada; só `service_role` executa; faz tudo numa transação, reaproveita endereço igual do principal, copia os outros, move OS, equipamentos, PMOC, oficina, placas, avaliações, portal, códigos e vendas já apontando para o endereço certo, soma contatos sem repetir, preenche documento/e-mail/observações que faltavam, confere que nada aponta mais para o duplicado e apaga; a simulação roda tudo e desfaz) e `scripts/sicweb/unir-clientes.mjs` (`--buscar "texto"` acha nome/id; `--principal X --unir Y [--unir Z] [--rotulo "trecho=Rótulo"] [--nome "Nome"]` simula; com `--gravar` une de verdade; nome ambíguo lista os candidatos e para). **Em lote:** `--lote-seguro` (simula os 186 grupos seguros do banco em 2026-11-24 e grava `dados/saida/lote-seguro.csv` para conferir; com `--gravar` une; `--limite N` para experimentar; cada grupo é uma transação; grupo seguro = nomes iguais, só UM cadastro com OS/equipamento/PMOC/oficina/placa (ativo, vira o principal), os outros só com código do SicWeb, sem cadastro vazio e no máximo um CPF/CNPJ; principal TODO EM MAIÚSCULAS ganha o nome do duplicado que não é). **Rodado em 2026-11-24:** 186 grupos unidos (5 de teste + 181), 443 vendas e 190 códigos movidos, 54 endereços copiados ("Do cadastro: <nome>", renomear na tela se quiser) e 113+ reaproveitados; o Control foi de 10.919 para 10.730 clientes, as 21.733 vendas (R$ 9.081.230,63) e os 9.363 códigos continuam todos ligados, sem CPF/CNPJ duplicado nem venda sem cliente. Restam 165 grupos de nome igual (414 cadastros) para decidir um a um. Sobram para decidir um a um: grupos com mais de um cadastro com OS (79), sem nenhuma OS (57) e com CPF/CNPJ diferente (2). O principal deve ser o que tem as OS. Testado com ROLLBACK no par Blue Wave (44 OS + 15 vendas). Existem muitos pares óbvios (mesmo nome, um do Field e outro do SicWeb). Faltam ~300 casos em `revisar.csv`; a lista de 155 sem contato/venda/OS também está pendente de conferência do usuário.

**Trabalhar com o SicWeb em outro PC (ex.: o de casa):** o que está no git são só as migrations (aplicadas) e os scripts; **não vão no `git pull`**: o `.env` (precisa de `SUPABASE_SERVICE_ROLE_KEY`), a pasta `scripts/sicweb/dados/` (o `Backup_SICNET_20261124.bak` de 194 MB, os dois CSV e os relatórios de `saida/`, com dados pessoais: copiar por pen drive ou Google Drive, nunca pelo git) e o SQL Server Express com o banco restaurado. Os dois importadores já rodaram, então só é preciso o SQL Server se for ler o SICNET de novo (vendas novas, contas a receber, caixa, produtos); para mexer só no que já está no Supabase basta o `.env` e o `psql`. Instalar o Express no outro PC: mídia **em português** (a em inglês falha no Windows pt-BR), remover antes um `Microsoft ODBC Driver 17` quebrado se o setup acusar erro 1706, e restaurar com `RESTORE DATABASE SICNET ... WITH MOVE`.
**Vendas do SicWeb (2026-11-24):** migration `20261124110000_vendas_sicweb.sql` (aplicada em 2026-11-24) cria `sicweb_vendas`, `sicweb_venda_itens` e `sicweb_venda_pagamentos` (histórico de consulta; **só admin lê**, tem valores e lucro; o financeiro novo terá tabelas próprias) e `scripts/sicweb/importar-vendas.mjs` (lê o SICNET pelo `sqlcmd`, SIMULA por padrão, `--gravar` grava com upsert, idempotente; liga ao cliente por `customer_sicweb_codes`, então **rodar antes `importar-clientes.mjs --gravar`**; sem isso entram sem cliente e rodar de novo depois resolve). Valor da venda = soma de `TABEST3B.totvenda` (cobrado); `total` = preço de tabela; `TABEST3A.lktipo` = `TABEST6` (2 à vista, 3 a prazo, 4 cartão, 10 Loja BRV, 5/6/7... acerto, devolução, alteração: ficam guardados no `tipo`). Simulação: 21.733 vendas (8 canceladas, 450 sem cliente), 67.072 itens (R$ 9.081.229,76 cobrado, R$ 8.374.713,87 de tabela), 14.207 pagamentos (R$ 5.748.658,42; vendas antigas não têm pagamento registrado), de 2008-09-10 a 2026-11-24, totais conferidos com o SQL Server. Vendedor: só o código (`vendedor_codigo`, sem nome resolvido). Contas a receber (R$ 1,03 mi em aberto) **ficam para depois**: provavelmente sem baixa no SicWeb (decisão do usuário, 2026-11-24). **Gravado em 2026-11-24** (21.733 vendas, 67.053 itens, 14.207 pagamentos; totais conferidos com o SICNET, diferença de ~R$ 4 só de arredondamento de centavos). A ligação ao cliente usa o código **como está no TABCLI** (sem completar com zeros); as 24 que ficaram sem cliente por causa disso foram resolvidas. **Venda avulsa (decisão do usuário, 2026-11-24):** o SicWeb tem o cadastro "Cliente Balcão" (código 004707, id `b38e330d-4cff-4af7-839e-7a93cf9ed4b2`) para venda de balcão; as 450 vendas que vieram sem cliente também foram ligadas a ele (hoje 5.622 vendas, ~R$ 467,9 mil) e `importar-vendas.mjs` mantém essa regra. Nada de OS, equipamento ou placa nele. Não confundir com "Monique cliente balcão" (cliente real). **Marcado inativo em 2026-11-24** (some dos seletores de OS e atividade, que só listam ativos; aparece em Clientes > Arquivados; as vendas continuam ligadas) com observação explicando; é o "Consumidor final" do financeiro. Não reativar.
**Vendas, orçamentos e financeiro: telas com o Gemini (2026-11-24; continuar de casa).** Briefing pronto em `docs/gemini/vendas-financeiro-briefing.md` (catálogo, orçamentos com aprovação por link pelo WhatsApp, vendas de balcão e de orçamento, financeiro; camada de demonstração e **duas rodadas**: 1 = catálogo/orçamentos/vendas, 2 = financeiro). O Gemini devolve `docs/gemini/vendas-financeiro-r1.md`/`-r2.md` e o Claude audita antes de criar migrations, services e importar o catálogo (`TABEST1`, só no PC da empresa ou pelo `produtos.csv`). **Roteiro passo a passo e decisões na seção "Retomada (2026-11-24)" do fim de `docs/financeiro.md`; ler antes de continuar.** Orçamentos do SicWeb medidos: 1.702 desde 2023, sem status nem validade (`TABEST4`/`TABEST5`); mão de obra vem como produto "M.O Instal Ar Cond split N btus". **Notas fiscais** (seção "Notas fiscais" do `docs/financeiro.md`): a BRV emite NFC-e pelo módulo do SicWeb, NFS-e pelo Emissor Nacional (`nfse.gov.br`) e NF-e; uma venda gera duas notas (produtos em NFC-e/NF-e, serviços em NFS-e nacional); caminho = provedor de API único (Focus NFe como primeira opção; **provedor ainda não escolhido**), certificado digital vence em 01/09/2027 (confirmar que é A1 e achar o `.pfx`); o token do CSC nunca vai para o repositório. **Rodada 1 do Gemini entregue e auditada em 2026-11-24** (`docs/gemini/vendas-financeiro-r1-auditoria.md`): telas `/catalogo`, `/orcamentos`, `/vendas` e a pública `/orcamento/:token`, com dados de demonstração (`components/vendas/fonteDeDados.ts`, `FONTE_DADOS_DEMO = true`; seletor "Ver como" de nível financeiro), menu escondido (`MOSTRAR_MENU_VENDAS = false`; as rotas abrem por URL). **O resumo `-r1.md` não bate com o código final: a fonte da verdade para migrations e services é `types/vendas.ts`, `types/financeiro.ts` e o `fonteDeDados.ts`.** Depois da rodada 1 (2026-11-24, Claude): itens do orçamento e da venda em tabela compacta (`TabelaItensVenda.tsx`, no molde do SicWeb), setas do teclado em toda lista de escolha com busca (`src/hooks/useNavegacaoLista.ts`, tópico F1 `setas-teclado`), filtro de período `components/comum/FiltroPeriodo.tsx` (o atalho "Hoje" de Vendas saiu) e "Falta R$ X" na venda parcial; regras 7 e 8 no `GEMINI.md`. **Rodada 2 (Financeiro: `/financeiro`, `/caixa`, `/recebimentos`, `/movimentos`, `/cadastros`) entregue e auditada em 2026-11-24** (`docs/gemini/vendas-financeiro-r2-auditoria.md`; grupo escondido por `MOSTRAR_MENU_FINANCEIRO = false`, logo abaixo de Vendas; o item das Placas virou "Financeiro das placas"). O que vem do SICNET e onde entra: tabela em `docs/financeiro.md` (catálogo precisa de fabricante, código interno, observações e data do reajuste; sem campo de NSU, decisão do usuário). **Ligação ao banco, parte 1 (catálogo e orçamentos), 2026-11-25:** migration `20261125100000_catalogo_orcamentos.sql` (**aplicada em 2026-11-25; a verificação `supabase/verificacao/catalogo_orcamentos.sql` passou: TUDO CERTO**): `profiles.financial_access` + `nivel_financeiro()` (admin sempre completo), `catalog_items` (com fabricante, observações, `legacy_code` do SicWeb e data do reajuste; busca sem acento), custo à parte em `catalog_item_costs` (só nível completo), `quote_texts` (as 4 observações reais), `quotes`/`quote_items`/`quote_events` (escrita só pelas funções `orcamento_*`, que recalculam totais; numeração ORC-30001 em diante), página pública `orcamento_publico_ver`/`aprovar` e `orcamento_gerar_os` (OS agendada sem atividade, tipo pelo nome dos serviços). `src/services/vendas.ts` + `USAR_BANCO_ORCAMENTOS = true` em `components/vendas/fonteDeDados.ts` (vendas e notas seguem na demonstração até a parte 2). Ajuda F1: seção "Vendas" (telas `catalogo`, `orcamentos`, `orcamento`). **Pendente:** `unir_clientes` ainda não move orçamentos (a FK `quotes.customer_id` é RESTRICT: unir um cliente com orçamento dá erro e nada muda; incluir na parte 2 junto com vendas); campos Fabricante/Observações na tela do catálogo entram com o importador da `TABEST1`. Próximo: parte 2 (vendas + base financeira), parte 3 (telas do Financeiro).
**Vendedores e modelos de orçamento (2026-11-25, pedido do usuário):** migration `20261125120000_vendedores_modelos.sql` (+ verificação
`supabase/verificacao/vendedores_modelos.sql`; ensaio com ROLLBACK no banco real passou). **Só vendedor e admin** entram em Vendas, Orçamentos e Catálogo:
`profiles.sales_access` + `pode_vender()` (a migration troca `eh_escritorio()` por `pode_vender()` no texto das 18 funções `orcamento_*`/`venda_*` e nas
políticas; **se refizer uma dessas funções em migration nova, usar `pode_vender()`**). Tela `/vendas/vendedores` (`pages/Vendedores.tsx`, só admin, botão na tela
de Vendas) marca o vendedor e o nível caixa/completo (`vendedor_salvar`); sem funcionário ligado ao login, cria um "administrativo". "Vendedor(a)" lista só vendedores
(`vendas_vendedores()`). Iniciais: Braulio completo (nome de vendedor só "Braulio": o funcionário inativo "Braulio Rodrigues Valente" é o técnico das placas,
reconhecido pelo nome em `ehTecnicoBancadaPlacas`; não criar outro com "Braulio ... Valente"), Jéssica e Pedro caixa. Na tela: `utils/acessoVendas.ts`,
`RotaRestrita.tsx`. **Modelos** (`quote_templates`/`quote_template_items`, `modelo_salvar`, `services/modelosOrcamento.ts`, `ModelosItens.tsx`,
`linhasModelo.ts`): botões no orçamento e na venda; preço atual do catálogo, quantidade em branco (só a mão de obra preenchida), Enter pula para a próxima em
branco, em branco fica de fora com confirmação; "Salvar como modelo" e "Excluir modelo". Semeado só o "Instalação split 9.000" (orçamento 31974 do SicWeb).
O usuário criou pela tela os de 12.000, 18.000 e 22-24.000 (2026-11-25); botões com nome curto (`Inst 9.000`, renomeados no banco). Ainda não há como renomear pela tela. Ajuda F1: `vendedores` e `orcamento-modelos`.
Telas da Nova venda no mesmo dia: itens em largura total (Cliente e Pagamento abaixo), quantidade é o primeiro campo da inclusão, cinzas com mais contraste.

**Financeiro, parte 3a: caixa da loja (2026-11-25):** migration `20261125130000_caixa_loja.sql` (+ verificação `supabase/verificacao/caixa_loja.sql`;
**aplicada em 2026-11-25 e verificada**). `cash_sessions` (um aberto por vez) **sem lista própria**: o gatilho `movimento_no_caixa` liga à sessão aberta todo
movimento da conta de dinheiro (`financial_movements.cash_session_id`; data anterior à abertura fica de fora). Funções `caixa_situacao/abrir/lancar/fechar/fechamentos`
(nível caixa ou completo). Diferença na abertura ou no fechamento exige motivo e grava **movimento de ajuste** (origem `caixa`, sem categoria; a primeira abertura é o
saldo inicial). **Na visão geral e no extrato, origem `caixa` não é receita nem despesa.** Retirada para depósito não credita o banco (transferência fica na tela de
Movimentos). Tela `/financeiro/caixa` ligada (`USAR_BANCO_CAIXA`). Ajuda F1: `financeiro-caixa`. **Testada pelo usuário no site em 2026-11-25: funcionou.** Há uma venda de teste cancelada (VND-30001).
**Financeiro, parte 3b: movimentos (2026-11-25):** migration `20261125140000_movimentos.sql` (+ verificação `supabase/verificacao/movimentos.sql`; **aplicada em 2026-11-25**). `movimentos_listar`, `financeiro_lancar_avulso`, `financeiro_transferir`, `financeiro_estornar` (só completo). **Estorno pelo extrato só
de avulso e transferência** (venda se desfaz cancelando a venda; caixa, com reforço/retirada). Sem data futura; conta de caixa só com data de hoje, forma dinheiro e sem
saída maior que o saldo. Depósito do caixa no banco = **Transferir** (não retirada). Quem faz o depósito são o Braulio e a Adriana (admins), então o Caixa **não** precisa de botão "Depositar no banco" (decisão do usuário, 2026-11-25). **InfinitePay funciona como banco** (2026-11-25): conta própria "InfinitePay" criada no banco de dados e a maquininha InfinitePay liquida nela (Rede segue no Itaú). **PIX dos clientes entra no Itaú e no Nubank.** O usuário vai informar mais tarde as taxas das duas maquininhas; falta também confirmar o prazo real da InfinitePay. Tela ligada (`USAR_BANCO_MOVIMENTOS`), ajuda F1 `financeiro-movimentos`.
**Financeiro, parte 3c: visão geral (2026-11-25):** migration `20261125150000_visao_geral.sql` (+ verificação `supabase/verificacao/visao_geral.sql`; ensaio com
ROLLBACK passou; **aplicada em 2026-11-25**). **"Recebido" = o que os clientes pagaram no dia** (`sale_payments` de vendas ativas + receita avulsa não estornada), não a data do extrato; cartão
futuro aparece em "a liquidar". Nível caixa só recebe o recebido hoje e as vendas a receber. O botão "Receber avulso" virou "Ir para Vendas". Ajuda F1: `financeiro-visao-geral`. **Movimentos e Visão geral testados pelo usuário no site em 2026-11-25: tudo certo.** Menus ainda escondidos.
**Recebimentos dos técnicos:** `RECEBIMENTOS_DE_CAMPO_DISPONIVEIS = false` esconde os cartões e o item do menu (a tela `/financeiro/recebimentos` ainda é demonstração).
**Orçamentos antigos do SicWeb (2026-11-25):** migration `20261125160000_orcamentos_sicweb.sql` (+ verificação `supabase/verificacao/orcamentos_sicweb.sql`; ensaio com
ROLLBACK passou; também acrescenta `sicweb_orcamentos` ao `unir_clientes`) e `scripts/sicweb/importar-orcamentos.mjs` (a partir de 2025-11-24; simula por padrão).
Simulação: 616 orçamentos, 4.917 itens, R$ 931.977,78; 165 ligados pelo código, **146 pelo nome** (único cliente com o mesmo nome, marcados na tela) e 305 de **balcão**: vão para o "Cliente Balcão" como as
vendas, com o nome digitado preservado (decisão do usuário, 2026-11-25; no SicWeb 8 usavam o 004707 e 297 não tinham cadastro).
Aba **Orçamentos** do cliente e `/orcamentos/sicweb` (botão "Antigos (SicWeb)"). Ajuda F1: `orcamentos-sicweb`. **Importação gravada em 2026-11-25** (616 e 4.917, totais
conferidos). **Quem lê: vendedores e admin** (pedido do usuário, 2026-11-25; `20261125170000_orcamentos_sicweb_vendedores.sql` + verificação de mesmo nome);
o histórico de vendas do SicWeb (tem lucro) continua só admin.
**Data prevista da virada do SicWeb: 05/12/2026** (sábado; senão 07/12), sujeita à resposta do contador (ver `docs/financeiro.md`).
**Falta:** o usuário testar, ligar os menus (`MOSTRAR_MENU_VENDAS`/`MOSTRAR_MENU_FINANCEIRO`) e os recebimentos dos técnicos (com a pergunta no app de campo).

Ditado por voz (2026-11-19, pedido do usuário): `components/comum/DitadoVoz.tsx`, montado em `Layout.tsx` e `CampoLayout.tsx`, põe um microfone no canto de qualquer `<textarea>` em foco (Web Speech API, pt-BR; texto entra no cursor; `data-sem-voz` desliga num campo; some se o navegador não suporta, ex. WebView do APK). Páginas públicas não têm. Ajuda F1: tópico `ditado-voz`.

Usuários: admin criado; Adriana Lobo (Diretora Administrativa, papel `admin`: acesso a tudo, inclusive dados pessoais dos funcionários; criada em 2026-11-01, cargo corrigido em 2026-11-08).
