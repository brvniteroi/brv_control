-- Apaga os dados de TESTE antes de importar a base do Field Control (colar no SQL Editor do Supabase).
-- Teste = tudo que NÃO veio do Field (field_control_id vazio). Não mexe em usuários, colaboradores,
-- tipos de OS, etiquetas nem modelos de formulário.
-- Os arquivos das fotos de teste continuam na HostGator (api/uploads/AAAA/MM/); podem ser apagados à mão.

-- 1) Conferir antes o que será apagado
SELECT
  (SELECT count(*) FROM public.service_orders WHERE field_control_id IS NULL) AS os_teste,
  (SELECT count(*) FROM public.tasks t JOIN public.service_orders o ON o.id = t.service_order_id
     WHERE o.field_control_id IS NULL) AS atividades_teste,
  (SELECT count(*) FROM public.attachments a JOIN public.service_orders o ON o.id = a.service_order_id
     WHERE o.field_control_id IS NULL) AS fotos_teste,
  (SELECT count(*) FROM public.customers WHERE field_control_id IS NULL) AS clientes_teste,
  (SELECT count(*) FROM public.equipments e JOIN public.customers c ON c.id = e.customer_id
     WHERE c.field_control_id IS NULL) AS equipamentos_teste,
  (SELECT count(*) FROM public.customer_users cu JOIN public.customers c ON c.id = cu.customer_id
     WHERE c.field_control_id IS NULL) AS logins_portal_teste;

-- 2) Apagar (selecione a partir daqui e rode). Atividades, fotos, formulários e etiquetas das OS
--    vão junto (ON DELETE CASCADE); endereços, contatos e logins do portal vão com o cliente.
BEGIN;
DELETE FROM public.service_orders WHERE field_control_id IS NULL;
DELETE FROM public.equipments
 WHERE customer_id IN (SELECT id FROM public.customers WHERE field_control_id IS NULL);
DELETE FROM public.customers WHERE field_control_id IS NULL;
COMMIT;
