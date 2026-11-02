-- Lista de clientes: data do último atendimento = conclusão da OS concluída mais recente do cliente.
-- security_invoker: vale o RLS de quem consulta (só o escritório enxerga as OS de todos).
-- A tela filtra por customer_id (50 por página); o filtro desce para dentro do GROUP BY e usa
-- o índice service_orders_customer_idx.
CREATE OR REPLACE VIEW public.clientes_ultimo_atendimento
WITH (security_invoker = on) AS
SELECT customer_id, max(completed_at) AS ultimo_atendimento
  FROM public.service_orders
 WHERE status = 'concluida'
 GROUP BY customer_id;

REVOKE ALL ON public.clientes_ultimo_atendimento FROM anon;
GRANT SELECT ON public.clientes_ultimo_atendimento TO authenticated;
