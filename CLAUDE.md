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
- Comandos: `npm run dev`, `npm run build`, `npm run typecheck`, `npm run lint` (oxlint)

## Banco de dados
- Schema completo em `supabase/migrations/20261029000000_schema_inicial.sql` (já aplicado no
  projeto `kxznmsadntuihzlizlyp`). Mudanças novas = nova migration, nunca editar a inicial.
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
- Estrutura do app, layout, menu e rotas. Todas as páginas em `src/pages/` ainda são
  placeholders (`EmConstrucao`).
- Projeto Supabase criado, schema aplicado e RLS conferido (anon recebe 401).
- Repositório: https://github.com/brvniteroi/brv_control (privado).

Pendente, nesta ordem:
1. Painel Supabase: desligar "Allow new users to sign up" (Authentication > Sign In /
   Providers) e configurar Site URL / Redirect URLs (`http://localhost:5173/**`).
2. Criar o usuário admin em Authentication > Users e promovê-lo:
   `UPDATE public.profiles SET active = TRUE, role = 'admin', full_name = '...' WHERE email = '...';`
3. Tela de login + proteção das rotas (nenhum código chama `supabase.auth` ainda; sem isso
   o RLS devolve tudo vazio). Bloquear quem tem `profiles.active = FALSE`.
4. Depois: telas de Clientes, OS e Linha do Tempo (drag and drop com `@hello-pangea/dnd`).
