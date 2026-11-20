-- =====================================================================
-- Oficina: comprovante de entrada com link de acompanhamento (2026-11-19, pedido do usuário: "semelhante ao das placas,
-- com envio pelo WhatsApp").
--   * workshop_orders.public_token: código secreto do link /acompanhar-oficina/<token> (64 hex; não muda pelo app).
--   * oficina_itens: refeita só para trazer o public_token (o w.* da visão é fixado na criação).
--   * oficina_contato_cliente(item): telefone do cliente para o WhatsApp, só admin/escritório (o papel 'oficina' continua sem
--     ver telefone, como na visão).
--   * oficina_acompanhamento(token): página pública, sem login; só o que o cliente pode ver (sem diagnóstico, valores,
--     observações internas, fotos nem dados de contato).
-- Colar no SQL Editor do Supabase (tudo numa transação: se der erro, nada é aplicado).
-- =====================================================================
BEGIN;

-- 1. Token do link (a coluna nova já nasce preenchida em todos os itens; DEFAULT volátil é calculado linha a linha)
ALTER TABLE public.workshop_orders
  ADD COLUMN IF NOT EXISTS public_token TEXT NOT NULL
  DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));
CREATE UNIQUE INDEX IF NOT EXISTS workshop_orders_public_token_key ON public.workshop_orders (public_token);

CREATE OR REPLACE FUNCTION public.workshop_orders_token_fixo()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.public_token IS DISTINCT FROM OLD.public_token AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'O link de acompanhamento do item não muda.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.workshop_orders_token_fixo() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS workshop_orders_token_fixo ON public.workshop_orders;
CREATE TRIGGER workshop_orders_token_fixo BEFORE UPDATE OF public_token ON public.workshop_orders
  FOR EACH ROW EXECUTE FUNCTION public.workshop_orders_token_fixo();

-- 2. Visão das telas: mesma definição da migration 20261108130000, agora com o public_token (vem no w.*)
DROP VIEW IF EXISTS public.oficina_itens;
CREATE VIEW public.oficina_itens AS
SELECT w.*,
       so.number AS os_number,
       coalesce(c.trade_name, c.name) AS customer_name,
       ep.name AS pickup_employee_name,
       eb.name AS bench_employee_name,
       rso.number AS return_os_number,
       rso.status AS return_os_status,
       wo.item_number AS warranty_origin_item,
       wso.number AS warranty_origin_os_number
  FROM public.workshop_orders w
  LEFT JOIN public.service_orders so ON so.id = w.service_order_id
  LEFT JOIN public.customers c ON c.id = w.customer_id
  LEFT JOIN public.employees ep ON ep.id = w.pickup_employee_id
  LEFT JOIN public.employees eb ON eb.id = w.bench_employee_id
  LEFT JOIN public.service_orders rso ON rso.id = w.return_service_order_id
  LEFT JOIN public.workshop_orders wo ON wo.id = w.warranty_origin_id
  LEFT JOIN public.service_orders wso ON wso.id = wo.service_order_id
 WHERE public.eh_equipe_oficina();
REVOKE ALL ON public.oficina_itens FROM anon, PUBLIC;
GRANT SELECT ON public.oficina_itens TO authenticated;

-- 3. Telefone do cliente para o comprovante e o WhatsApp (só admin e escritório)
CREATE OR REPLACE FUNCTION public.oficina_contato_cliente(p_item UUID)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_fone TEXT;
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(
           NULLIF(btrim(c.phone), ''),
           (SELECT cc.phone FROM public.customer_contacts cc
             WHERE cc.customer_id = c.id AND char_length(btrim(coalesce(cc.phone, ''))) > 0
             ORDER BY cc.is_primary DESC, cc.created_at
             LIMIT 1))
    INTO v_fone
    FROM public.workshop_orders w
    JOIN public.customers c ON c.id = w.customer_id
   WHERE w.id = p_item;
  RETURN v_fone;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.oficina_contato_cliente(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oficina_contato_cliente(UUID) TO authenticated;

-- 4. Página pública de acompanhamento (/acompanhar-oficina/<token>): sem login, só dados seguros
CREATE OR REPLACE FUNCTION public.oficina_acompanhamento(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  w public.workshop_orders%ROWTYPE;
  v_os INTEGER;
  v_itens INTEGER;
  v_etapas JSONB;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 THEN
    RETURN NULL;
  END IF;
  SELECT * INTO w FROM public.workshop_orders WHERE public_token = p_token AND status <> 'cancelado';
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT number INTO v_os FROM public.service_orders WHERE id = w.service_order_id;
  SELECT count(*) INTO v_itens FROM public.workshop_orders
   WHERE service_order_id = w.service_order_id AND status <> 'cancelado';

  -- Quando passou por cada etapa (a primeira vez)
  SELECT coalesce(jsonb_object_agg(to_status, quando), '{}'::jsonb) INTO v_etapas
  FROM (
    SELECT to_status, min(created_at) AS quando
    FROM public.workshop_order_events
    WHERE workshop_order_id = w.id AND event IN ('criado', 'etapa') AND to_status IS NOT NULL
    GROUP BY to_status
  ) t;

  RETURN jsonb_build_object(
    'os_number', v_os,
    'item_number', w.item_number,
    'items_in_os', v_itens,
    'legacy_reference', w.legacy_reference,
    'equipment_type', w.equipment_type,
    'units_collected', w.units_collected,
    'brand', w.brand,
    'model', w.model,
    'status', w.status,
    'is_warranty', w.is_warranty,
    'created_at', w.created_at,
    'received_at', w.received_at,
    'ready_at', w.ready_at,
    'finished_at', w.finished_at,
    'reached', v_etapas
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.oficina_acompanhamento(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.oficina_acompanhamento(TEXT) TO anon, authenticated;

COMMIT;
