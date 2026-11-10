-- =====================================================================
-- Oficina: desliga por enquanto a fase de orçamento/aprovação do cliente (pedido do Braulio, 2026-11-10),
-- para não travar o andamento da OS. Com a função oficina_exige_orcamento() devolvendo FALSE:
--   - o item vai do diagnóstico direto para "em reparo"/"aguardando peça" sem aprovação registrada, e a
--     oficina também pode fazer esse passo;
--   - "pronto" não exige mais a resposta do cliente.
-- Para religar: CREATE OR REPLACE FUNCTION public.oficina_exige_orcamento() ... SELECT TRUE (e EXIGE_ORCAMENTO_OFICINA = true
-- em src/utils/oficina.ts). O resto da função workshop_orders_regras é igual ao da migration 20261109100000.
--
-- Colar no SQL Editor do Supabase.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.oficina_exige_orcamento()
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$ SELECT FALSE $$;
REVOKE EXECUTE ON FUNCTION public.oficina_exige_orcamento() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oficina_exige_orcamento() TO authenticated;

CREATE OR REPLACE FUNCTION public.workshop_orders_regras()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_escritorio BOOLEAN := public.eh_escritorio();
  v_admin BOOLEAN := public.eh_admin();
  v_finais CONSTANT TEXT[] := ARRAY['entregue', 'descarte', 'cancelado'];
  v_cliente UUID;
BEGIN
  -- Cliente sempre o da OS; número do item dentro da OS
  IF TG_OP = 'INSERT' THEN
    IF NEW.service_order_id IS NOT NULL THEN
      -- trava a OS para dois itens simultâneos não pegarem o mesmo número
      SELECT customer_id INTO v_cliente FROM public.service_orders WHERE id = NEW.service_order_id FOR UPDATE;
      IF v_cliente IS NULL THEN
        RAISE EXCEPTION 'OS não encontrada.' USING ERRCODE = '23503';
      END IF;
      NEW.customer_id := v_cliente;
      NEW.item_number := coalesce(
        (SELECT max(item_number) FROM public.workshop_orders WHERE service_order_id = NEW.service_order_id), 0) + 1;
    END IF;
  END IF;

  -- Sem login (importação/scripts) ou baixa automática pela OS de devolução: vale o que foi informado
  IF auth.uid() IS NULL OR current_setting('app.oficina_sistema', TRUE) = 'on' THEN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'entregue' THEN
      NEW.finished_at := NOW();
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('em_transito', 'entrada') THEN
      RAISE EXCEPTION 'Item novo entra em trânsito ou na entrada da oficina.' USING ERRCODE = '23514';
    END IF;
    IF NEW.service_order_id IS NULL THEN
      RAISE EXCEPTION 'Item da oficina precisa de uma OS.' USING ERRCODE = '23514';
    END IF;
    NEW.created_by := auth.uid();
    NEW.created_at := NOW();
    NEW.legacy_table := NULL;
    NEW.legacy_id := NULL;
    NEW.legacy_reference := NULL;
    NEW.decision := NULL;
    NEW.discard_channel := NULL;
    NEW.discard_note := NULL;
    NEW.return_service_order_id := NULL;
    NEW.received_at := NULL;
    NEW.ready_at := NULL;
    NEW.finished_at := NULL;
    IF NEW.status = 'entrada' THEN
      NEW.received_at := NOW();
      NEW.received_by := auth.uid();
    END IF;
  ELSE
    -- O que nunca muda depois de criado
    IF NEW.kind IS DISTINCT FROM OLD.kind
       OR NEW.service_order_id IS DISTINCT FROM OLD.service_order_id
       OR NEW.item_number IS DISTINCT FROM OLD.item_number
       OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.legacy_table IS DISTINCT FROM OLD.legacy_table
       OR NEW.legacy_id IS DISTINCT FROM OLD.legacy_id
       OR NEW.legacy_reference IS DISTINCT FROM OLD.legacy_reference THEN
      RAISE EXCEPTION 'A OS, o cliente e a origem do item não podem ser alterados.' USING ERRCODE = '42501';
    END IF;

    -- Oficina: parte técnica; orçamento, resposta do cliente, descarte e devolução são do escritório
    IF NOT v_escritorio THEN
      IF NEW.task_id IS DISTINCT FROM OLD.task_id
         OR NEW.pickup_employee_id IS DISTINCT FROM OLD.pickup_employee_id
         OR NEW.is_warranty IS DISTINCT FROM OLD.is_warranty
         OR NEW.warranty_origin_id IS DISTINCT FROM OLD.warranty_origin_id
         OR NEW.quote_reference IS DISTINCT FROM OLD.quote_reference
         OR NEW.quote_amount IS DISTINCT FROM OLD.quote_amount
         OR NEW.quote_sent_at IS DISTINCT FROM OLD.quote_sent_at
         OR NEW.decision IS DISTINCT FROM OLD.decision
         OR NEW.decision_channel IS DISTINCT FROM OLD.decision_channel
         OR NEW.decision_note IS DISTINCT FROM OLD.decision_note
         OR NEW.discard_channel IS DISTINCT FROM OLD.discard_channel
         OR NEW.discard_note IS DISTINCT FROM OLD.discard_note
         OR NEW.return_service_order_id IS DISTINCT FROM OLD.return_service_order_id
         OR NEW.cancel_reason IS DISTINCT FROM OLD.cancel_reason THEN
        RAISE EXCEPTION 'Orçamento, resposta do cliente, descarte e devolução são registrados pelo escritório.'
          USING ERRCODE = '42501';
      END IF;
      IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
           (OLD.status, NEW.status) IN (
             ('em_transito', 'entrada'),
             ('entrada', 'diagnostico'),
             ('diagnostico', 'entrada'),
             ('diagnostico', 'aguardando_orcamento'),
             ('aguardando_orcamento', 'diagnostico'),
             ('aguardando_peca', 'em_reparo'),
             ('em_reparo', 'aguardando_peca'),
             ('em_reparo', 'pronto'),
             ('pronto', 'em_reparo')
           )
           -- Orçamento desligado: a oficina segue do diagnóstico direto para o conserto
           OR (NOT public.oficina_exige_orcamento()
               AND OLD.status IN ('diagnostico', 'aguardando_orcamento', 'aguardando_cliente')
               AND NEW.status IN ('aguardando_peca', 'em_reparo'))
           OR (OLD.is_warranty AND OLD.status = 'diagnostico' AND NEW.status IN ('aguardando_peca', 'em_reparo'))
         ) THEN
        RAISE EXCEPTION 'A oficina não pode mudar esta etapa. Peça ao escritório.' USING ERRCODE = '42501';
      END IF;
    END IF;

    -- Marcos que o navegador não escolhe
    NEW.received_at := OLD.received_at;
    NEW.received_by := OLD.received_by;
    NEW.ready_at := OLD.ready_at;
    NEW.finished_at := OLD.finished_at;
    NEW.decision_at := OLD.decision_at;
    NEW.decision_by := OLD.decision_by;
    NEW.discard_authorized_at := OLD.discard_authorized_at;
    NEW.discard_authorized_by := OLD.discard_authorized_by;

    -- Item finalizado só volta pelas mãos do admin
    IF OLD.status = ANY (v_finais) AND NEW.status IS DISTINCT FROM OLD.status AND NOT v_admin THEN
      RAISE EXCEPTION 'Item finalizado. Só o administrador pode reabrir.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Resposta do cliente: canal obrigatório quando alguém registra ou muda a resposta; data e autor do login
  IF NEW.decision IS NULL THEN
    NEW.decision_channel := NULL;
    NEW.decision_note := NULL;
    NEW.decision_at := NULL;
    NEW.decision_by := NULL;
  ELSIF TG_OP = 'INSERT' OR NEW.decision IS DISTINCT FROM OLD.decision
        OR NEW.decision_channel IS DISTINCT FROM OLD.decision_channel THEN
    IF NEW.decision_channel IS NULL THEN
      RAISE EXCEPTION 'Informe por onde o cliente respondeu (WhatsApp, telefone, presencial ou e-mail).'
        USING ERRCODE = '23514';
    END IF;
    NEW.decision_at := NOW();
    NEW.decision_by := auth.uid();
  END IF;

  -- Autorização de descarte: canal e descrição obrigatórios ao registrar; só some se alguém tirar o canal
  IF NEW.discard_channel IS NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.discard_channel IS NOT NULL THEN
      NEW.discard_note := NULL;
      NEW.discard_authorized_at := NULL;
      NEW.discard_authorized_by := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
      -- item importado (descarte sem canal): a nota antiga não muda
      NEW.discard_note := OLD.discard_note;
    END IF;
  ELSE
    IF coalesce(char_length(btrim(NEW.discard_note)), 0) = 0 THEN
      RAISE EXCEPTION 'Descreva a autorização de descarte (quem autorizou e como).' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'INSERT' OR NEW.discard_channel IS DISTINCT FROM OLD.discard_channel
       OR NEW.discard_note IS DISTINCT FROM OLD.discard_note THEN
      NEW.discard_authorized_at := NOW();
      NEW.discard_authorized_by := auth.uid();
    END IF;
  END IF;

  -- Etapas: condições de quem entra
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF public.oficina_exige_orcamento() AND NEW.status IN ('aguardando_peca', 'em_reparo')
       AND NOT (NEW.decision = 'aprovado' OR NEW.is_warranty) THEN
      RAISE EXCEPTION 'Registre a aprovação do cliente antes de seguir para o conserto.' USING ERRCODE = '23514';
    END IF;
    IF public.oficina_exige_orcamento() AND NEW.status = 'pronto' AND NOT (NEW.decision IS NOT NULL OR NEW.is_warranty) THEN
      RAISE EXCEPTION 'Registre a resposta do cliente ao orçamento antes de marcar como pronto.' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'entregue' AND OLD.status <> 'pronto' THEN
      RAISE EXCEPTION 'Só um item pronto pode ser entregue.' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'descarte' AND NEW.discard_channel IS NULL THEN
      RAISE EXCEPTION 'Descarte só com a autorização do cliente registrada.' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'cancelado' AND coalesce(char_length(btrim(NEW.cancel_reason)), 0) = 0 THEN
      RAISE EXCEPTION 'Informe o motivo do cancelamento.' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'aguardando_cliente' AND NEW.quote_sent_at IS NULL THEN
      NEW.quote_sent_at := NOW();
    END IF;

    IF NEW.status = 'entrada' AND NEW.received_at IS NULL THEN
      NEW.received_at := NOW();
      NEW.received_by := auth.uid();
    END IF;
    IF NEW.status = 'pronto' THEN
      NEW.ready_at := NOW();
    END IF;
    IF NEW.status = ANY (v_finais) THEN
      NEW.finished_at := NOW();
    ELSE
      NEW.finished_at := NULL;
    END IF;
    IF NEW.status IN ('diagnostico', 'em_reparo') AND NEW.bench_employee_id IS NULL THEN
      NEW.bench_employee_id := public.meu_funcionario_id();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.workshop_orders_regras() FROM PUBLIC, anon, authenticated;
