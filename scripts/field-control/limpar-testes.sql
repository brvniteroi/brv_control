-- Apaga TODOS os dados operacionais antes de importar a base do Field Control (colar no SQL Editor do Supabase):
-- os testes feitos no BRV Control e a amostra antiga do Field (3 clientes e 34 OS), que a importação traz de novo completa.
-- Não mexe em usuários, colaboradores, tipos de OS, etiquetas (catálogo), modelos de formulário nem posição dos técnicos.
-- Os arquivos das fotos de teste continuam na HostGator (api/uploads/AAAA/MM/); podem ser apagados à mão.

-- 1) Conferir antes o que será apagado
SELECT
  (SELECT count(*) FROM public.customers) AS clientes,
  (SELECT count(*) FROM public.customer_addresses) AS enderecos,
  (SELECT count(*) FROM public.customer_contacts) AS contatos,
  (SELECT count(*) FROM public.service_orders) AS os,
  (SELECT count(*) FROM public.tasks) AS atividades,
  (SELECT count(*) FROM public.attachments) AS fotos,
  (SELECT count(*) FROM public.form_responses) AS formularios,
  (SELECT count(*) FROM public.equipments) AS equipamentos,
  (SELECT count(*) FROM public.customer_users) AS logins_portal;

-- 2) Apagar (selecione a partir daqui e rode). Atividades, fotos, formulários e etiquetas das OS
--    vão junto (ON DELETE CASCADE); endereços, contatos e logins do portal vão com o cliente.
BEGIN;
DELETE FROM public.service_orders;
DELETE FROM public.equipments;
DELETE FROM public.customers;
COMMIT;

-- 3) Conferir: tudo deve dar zero
SELECT
  (SELECT count(*) FROM public.customers) AS clientes,
  (SELECT count(*) FROM public.service_orders) AS os,
  (SELECT count(*) FROM public.tasks) AS atividades,
  (SELECT count(*) FROM public.attachments) AS fotos;
