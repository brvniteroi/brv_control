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
  Admin e escritório excluem formulário de campo adicionado errado (lixeira em `FormulariosAtividade.tsx`, `excluirFormulario`; migration `20261104100000_escritorio_exclui_formulario.sql`, aplicada).
  Link "Abrir cadastro do cliente" ao lado do campo Cliente da OS (só admin/escritório): abre `ClienteDetalhes` por cima da OS; ao salvar, o nome mostrado na OS atualiza.
  O escritório adiciona fotos direto na OS (botão "Adicionar fotos" em `AnexosOS.tsx`, várias de uma vez, via `anexarFoto`; só imagens).
  Admin vê um X vermelho em cada foto da OS (`AnexosOS.tsx`, `excluirAnexo` em `services/anexos.ts`): apaga só o registro em
  `attachments` (a RLS "Só admin exclui" já garante; o arquivo continua na HostGator).
  A situação da OS segue as atividades; cancelar a OS não cancela as atividades (decisão do usuário, 2026-11-03).
  Ordem de execução vale também para o escritório: migration `20261105100000_ordem_execucao_para_todos.sql` (aplicada) refaz `tasks_protege_agenda`: sair de `agendada` (a caminho/em execução/concluída direto) exige a anterior do mesmo técnico no dia concluída ou cancelada; "só hoje" segue só para o técnico; scripts com service_role não são barrados.
  Uma atividade por OS (decisão do usuário, 2026-11-05): outra visita ou segundo técnico = OS nova, sem botão de retorno. Cancelada não conta (dá para reagendar na mesma OS). Trigger `tasks_uma_por_os` (migration `20261105110000_uma_atividade_por_os.sql`, aplicada) só olha quem entra (criar, reativar, mudar de OS), então as OS antigas com várias seguem editáveis; scripts com service_role não são barrados. Na tela: `AtividadesOS.tsx` esconde "Nova atividade" e `NovaAtividadeModal.tsx` só lista OS sem atividade.
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
  `empresa_id` em todas as tabelas) fica para um plano separado, ainda não escrito.
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

**LEMBRETE (2026-11-05): retomar a segurança do BRV Equipamentos** (estado em `docs/oficina.md`, seção Segurança). Falta o usuário: OS de teste com foto em outro navegador (confirma o commit `119d428`), 6 testes com usuário não admin (Kanban, etapa e foto, etiqueta, galeria em aba anônima, Fichas Técnicas, Códigos de erro), conferir Logs > API, confirmar os 6 usuários e os 2 admins, revogar a chave do Field. Depois: remover `frontend/.env_old`, fazer o banco respeitar `ativo` e voltar às 7 decisões do plano. Ao concluir, apagar este lembrete.

**LEMBRETE (2026-11-09): continuar a Oficina no PC da empresa** (lembrar o usuário logo no início da conversa). Antes: `git pull` no
`D:\BRV_Control` (o BRV Equipamentos não precisa: o repositório dele não mudou, só os dados do banco). Roteiro:
(1) **FEITO em 2026-11-09**: agente da Elgin instalado no servidor da loja (login `impressora@brvniteroi.com.br`, pasta em
`C:\brv-agente-impressora\agente-impressora`), imprime sem etiqueta em branco (ajustes do rolo no `LEIA-ME.md` do agente). Falta só conferir
se o `instalar-tarefa.cmd` (como administrador) já foi rodado: sem ele o agente não sobe sozinho quando o servidor reinicia;
(2) **FEITO**: Gustavo já usa o sistema (2026-11-09);
(3) **FEITO**: equipe avisada (equipamento só no Control; técnicos usam "Recolher equipamento"; o Equipamentos fica só para placas);
(4) **DECIDIDO: não** mostrar a faixa "só consulta" no BRV Equipamentos (o banco já está travado por `somente-leitura-equipamentos.sql`, aplicado em 2026-11-09);
(5) pendências de `docs/oficina.md` **todas decididas em 2026-11-09**: OS de balcão NÃO conclui sozinha, F1 liberado para o Gustavo (`Layout.tsx`),
tipo da OS de devolução continua sendo escolhido pelo escritório na hora. Cópia de `android-assinatura/` para o PC da empresa: feita em 2026-11-09.
**Só falta confirmar** que a tarefa "BRV Control - Impressora" existe no Agendador de Tarefas do servidor (`instalar-tarefa.cmd` como administrador).
Para rodar o importador no PC da empresa seria preciso `EQUIP_SERVICE_ROLE_KEY` no `.env` de lá (não deve ser mais necessário).
Ao concluir, apagar este lembrete.

**LEMBRETE (2026-11-10, amanhã): fazer o teste do APK com tela apagada** (lembrar o usuário logo no início da conversa). Em 2026-11-09 o APK
já estava instalado nos técnicos Alberto, Emerson e Marcus (têm token em `push_fcm_tokens`; o Bruno Brum, conta técnica do usuário, ainda só
no navegador), mas o teste não foi conclusivo. Roteiro: técnico parado (Alberto), Mapa "Online" com o app aberto, apagar a tela ~10 min sem mexer,
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
   2026-11-09) corrigiu o erro "Só é possível escrever notas no histórico" em toda ação com login; retirada pelo app testada (OS 17332). Fases 2 e 3, pendências e o uso em paralelo
   com o Equipamentos em `docs/oficina.md`. Ler antes de continuar.
   **Migração das Placas** (reparo de placas do Equipamentos para o Control): plano em `docs/placas.md` (2026-11-09), nada implementado. Decidido: número próprio `OS-DDMMAA-NNN` (OS do Control só
   quando a equipe de campo retira a placa), cadastro de clientes de placas paralelo (`board_clients`), orçamento feito no Control com PDF pelo WhatsApp, parceiro acompanha por
   link público (`/placa/<token>`) enviado no comprovante de entrada, financeiro das placas próprio (aproveita o dashboard do sistema antigo), **migração dos dados só no fim, com telas
   prontas, testadas e simulações**. Telas: briefing para o Gemini em `docs/gemini/placas-briefing.md` (dados de demonstração em `src/components/placas/fonteDeDados.ts`; resumo em
   `docs/gemini/placas.md`, que o Claude **audita** antes de criar migration/services/importador). O apoio técnico (fichas técnicas, manuais, códigos de erro e assistente com IA) migra junto, dentro do **menu "Placas"** (rotas `/placas...`; `ProtectedRoute` já libera para o papel oficina). Nenhuma decisão em aberto.
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

Módulo PMOC (em andamento; telas do Gemini prontas e auditadas em 2026-11-04, ainda com dados de demonstração; item do menu oculto em `Sidebar.tsx` até ligar ao banco, rotas `/pmoc` acessíveis por URL; falta migration `pmoc_*`, `services/pmoc.ts`, PDF no `upload.php`, CPF/registro em `employees`): briefing para o Gemini em `docs/gemini/pmoc-briefing.md` (telas e documentos impressos, com camada de dados de demonstração
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

Usuários: admin criado; Adriana Lobo (Diretora Administrativa, papel `admin`: acesso a tudo, inclusive dados pessoais dos funcionários; criada em 2026-11-01, cargo corrigido em 2026-11-08).
