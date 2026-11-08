-- Pedido de avaliação por e-mail: se o contato principal não tem e-mail (customers.email vazio ou inválido),
-- usa o de outro contato do cliente (o principal primeiro, depois o mais antigo). Acontece, por exemplo, com clientes
-- importados do Field que tinham o e-mail num contato à parte.
-- Só troca a escolha do endereço em avaliacao_email_processar; regras e envio iguais aos de 20261107100000.

CREATE OR REPLACE FUNCTION public.avaliacao_email_processar(p_os UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  c_email_valido CONSTANT TEXT := '^[^@\s]+@[^@\s]+\.[^@\s]+$';
  v_cfg public.avaliacao_config;
  v_os public.service_orders;
  v_email TEXT;
  v_nome TEXT;
  v_anterior BIGINT;
  v_token TEXT;
  v_pedido UUID;
  v_t public.tasks;
  v_tecnico TEXT;
  v_servico TEXT;
BEGIN
  SELECT * INTO v_cfg FROM public.avaliacao_config WHERE id = 1;
  IF NOT FOUND OR NOT v_cfg.ativo THEN RETURN; END IF;

  SELECT * INTO v_os FROM public.service_orders WHERE id = p_os;
  IF NOT FOUND OR v_os.status <> 'concluida' THEN RETURN; END IF;

  -- Já pedido por e-mail para esta OS (reaberta e concluída de novo): silêncio
  IF EXISTS (SELECT 1 FROM public.rating_requests
              WHERE service_order_id = p_os AND channel = 'email' AND status IN ('pendente', 'enviado')) THEN
    RETURN;
  END IF;

  SELECT nullif(trim(email), ''), name INTO v_email, v_nome FROM public.customers WHERE id = v_os.customer_id;

  -- Sem e-mail no principal: o de outro contato do cliente
  IF v_email IS NULL OR v_email !~* c_email_valido THEN
    SELECT trim(email) INTO v_email
      FROM public.customer_contacts
     WHERE customer_id = v_os.customer_id AND trim(email) ~* c_email_valido
     ORDER BY is_primary DESC, created_at, id
     LIMIT 1;
  END IF;

  IF EXISTS (SELECT 1 FROM public.ratings WHERE service_order_id = p_os) THEN
    INSERT INTO public.rating_requests (service_order_id, customer_id, channel, status, detail)
    VALUES (p_os, v_os.customer_id, 'email', 'pulado', 'OS já avaliada');
    RETURN;
  END IF;

  IF v_os.completed_at IS NOT NULL AND v_os.completed_at < NOW() - INTERVAL '24 hours' THEN
    INSERT INTO public.rating_requests (service_order_id, customer_id, channel, status, detail)
    VALUES (p_os, v_os.customer_id, 'email', 'pulado', 'OS concluída há mais de 24 h');
    RETURN;
  END IF;

  IF v_email IS NULL OR v_email !~* c_email_valido THEN
    INSERT INTO public.rating_requests (service_order_id, customer_id, channel, status, detail)
    VALUES (p_os, v_os.customer_id, 'email', 'pulado', 'Cliente sem e-mail válido');
    RETURN;
  END IF;

  SELECT so.number INTO v_anterior
    FROM public.rating_requests r JOIN public.service_orders so ON so.id = r.service_order_id
   WHERE r.customer_id = v_os.customer_id
     AND r.status IN ('pendente', 'enviado')
     AND r.created_at > NOW() - INTERVAL '72 hours'
   ORDER BY r.created_at DESC
   LIMIT 1;
  IF FOUND THEN
    INSERT INTO public.rating_requests (service_order_id, customer_id, channel, status, detail, email)
    VALUES (p_os, v_os.customer_id, 'email', 'pulado', 'Cliente recebeu pedido há menos de 72 h (OS ' || v_anterior || ')', v_email);
    RETURN;
  END IF;

  -- Link (mesmo token do botão do WhatsApp)
  v_token := v_os.rating_token;
  IF v_token IS NULL THEN
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    UPDATE public.service_orders SET rating_token = v_token WHERE id = p_os;
  END IF;

  v_t := public.avaliacao_ultima_atividade(p_os);
  SELECT split_part(trim(name), ' ', 1) INTO v_tecnico FROM public.employees WHERE id = v_t.employee_id;
  SELECT name INTO v_servico FROM public.service_types WHERE id = v_os.service_type_id;

  INSERT INTO public.rating_requests (service_order_id, customer_id, channel, status, email, detail)
  VALUES (p_os, v_os.customer_id, 'email', 'pendente', v_email,
          CASE WHEN v_cfg.somente_para IS NOT NULL THEN 'Modo teste: enviado para ' || v_cfg.somente_para END)
  RETURNING id INTO v_pedido;

  PERFORM net.http_post(
    url := v_cfg.envio_url,
    body := jsonb_build_object(
      'pedido_id', v_pedido,
      'para', coalesce(v_cfg.somente_para, v_email),
      'nome', split_part(trim(coalesce(v_nome, '')), ' ', 1),
      'numero', v_os.number,
      'servico', v_servico,
      'tecnico', v_tecnico,
      'data', to_char(coalesce(v_os.completed_at, NOW()) AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'),
      'link', rtrim(v_cfg.app_url, '/') || '/avaliar/' || v_token || '?origem=email'
    ),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-segredo', v_cfg.segredo),
    timeout_milliseconds := 15000
  );
EXCEPTION WHEN OTHERS THEN
  -- Pedido de avaliação é extra: nunca impede concluir a OS
  RAISE WARNING 'avaliacao_email_processar: %', SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.avaliacao_email_processar(UUID) FROM PUBLIC, anon, authenticated;
