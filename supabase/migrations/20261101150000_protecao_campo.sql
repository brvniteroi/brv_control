-- =====================================================================
-- Proteção do app de campo no banco (antes era só na tela):
-- 1. Técnico não lê telefone/e-mail/documento do cliente. Perde a leitura de
--    customer_contacts e de customers (RLS não esconde colunas e customers
--    também guarda telefone, e-mail e CPF/CNPJ). O nome vem por campo_clientes().
-- 2. Técnico só sai para / inicia atividade de hoje, e só a primeira do dia
--    ou a que vem logo depois de uma concluída (mesma ordem do app:
--    scheduled_start, depois id; canceladas não contam).
-- =====================================================================

DROP POLICY IF EXISTS "Técnico lê contatos dos próprios clientes" ON public.customer_contacts;
DROP POLICY IF EXISTS "Técnico lê clientes das próprias OS" ON public.customers;

-- Só id e nome dos clientes das OS do técnico logado (vazio para quem não é técnico)
CREATE OR REPLACE FUNCTION public.campo_clientes(p_ids UUID[])
RETURNS TABLE (id UUID, name TEXT, trade_name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT c.id, c.name, c.trade_name
  FROM public.customers c
  WHERE c.id = ANY (p_ids)
    AND c.id IN (SELECT public.meus_clientes());
$$;
REVOKE EXECUTE ON FUNCTION public.campo_clientes(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.campo_clientes(UUID[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.tasks_protege_agenda()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_anterior RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.eh_escritorio() THEN
    IF NEW.service_order_id IS DISTINCT FROM OLD.service_order_id
       OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.scheduled_start IS DISTINCT FROM OLD.scheduled_start
       OR NEW.scheduled_end IS DISTINCT FROM OLD.scheduled_end
       OR NEW.estimated_minutes IS DISTINCT FROM OLD.estimated_minutes
       OR (NEW.status = 'cancelada' AND OLD.status <> 'cancelada') THEN
      RAISE EXCEPTION 'Somente o escritório pode reagendar, reatribuir ou cancelar atividades'
        USING ERRCODE = '42501';
    END IF;

    -- Saindo de "agendada" (a caminho, iniciar ou concluir direto)
    IF OLD.status = 'agendada' AND NEW.status <> 'agendada' THEN
      IF OLD.scheduled_start IS NULL
         OR (OLD.scheduled_start AT TIME ZONE 'America/Sao_Paulo')::date
            <> (NOW() AT TIME ZONE 'America/Sao_Paulo')::date THEN
        RAISE EXCEPTION 'Só dá para iniciar atividades de hoje' USING ERRCODE = '42501';
      END IF;

      SELECT t.status, so.number INTO v_anterior
      FROM public.tasks t
      LEFT JOIN public.service_orders so ON so.id = t.service_order_id
      WHERE t.employee_id = OLD.employee_id
        AND t.id <> OLD.id
        AND t.status <> 'cancelada'
        AND (t.scheduled_start AT TIME ZONE 'America/Sao_Paulo')::date
            = (OLD.scheduled_start AT TIME ZONE 'America/Sao_Paulo')::date
        AND (t.scheduled_start, t.id) < (OLD.scheduled_start, OLD.id)
      ORDER BY t.scheduled_start DESC, t.id DESC
      LIMIT 1;

      IF FOUND AND v_anterior.status <> 'concluida' THEN
        RAISE EXCEPTION 'Conclua antes a OS %', v_anterior.number USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
