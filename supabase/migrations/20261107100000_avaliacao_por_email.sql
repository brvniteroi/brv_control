-- Pedido de avaliação automático por e-mail ao concluir a OS (como o Field Control fazia).
--
-- Caminho: OS passa para "concluida" -> trigger service_orders_pede_avaliacao -> avaliacao_email_processar confere as
-- regras, grava o pedido em rating_requests e chama por pg_net o PHP da HostGator (control.brvniteroi.com.br/api/
-- enviar-avaliacao.php), que manda o e-mail pela conta avaliacao@brvniteroi.com.br e devolve o resultado pela função
-- avaliacao_email_resultado (protegida pelo segredo de avaliacao_config).
--
-- Regras (nesta ordem; o motivo de cada pulo fica gravado):
--   - só com login (scripts com service_role, como importações, não disparam);
--   - OS já avaliada ou que já teve pedido por e-mail: não envia;
--   - OS concluída há mais de 24 h (fechada depois pelo escritório): não envia;
--   - cliente sem e-mail válido: não envia;
--   - cliente que recebeu qualquer pedido (e-mail ou WhatsApp) nas últimas 72 h, mesmo de outra OS: não envia.
-- O pedido manual pelo WhatsApp (botão na OS) também é registrado aqui, para valer na regra das 72 h.
--
-- Nasce DESLIGADO (avaliacao_config.ativo = false). Para testar sem atingir clientes, ligar com
-- somente_para = '<seu e-mail>': todo e-mail vai para esse endereço. Depois, apagar somente_para.

-- Pedidos de avaliação (e-mail automático e WhatsApp manual)
CREATE TABLE IF NOT EXISTS public.rating_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES public.service_orders (id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  -- pendente: entregue ao PHP, aguardando confirmação; pulado: regra impediu o envio
  status TEXT NOT NULL CHECK (status IN ('pendente', 'enviado', 'falhou', 'pulado')),
  detail TEXT,
  email TEXT,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rating_requests_os_idx ON public.rating_requests (service_order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rating_requests_cliente_idx ON public.rating_requests (customer_id, created_at DESC);

ALTER TABLE public.rating_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rating_requests FROM anon;
DROP POLICY IF EXISTS "Escritório lê pedidos de avaliação" ON public.rating_requests;
CREATE POLICY "Escritório lê pedidos de avaliação" ON public.rating_requests FOR SELECT TO authenticated
  USING ((SELECT public.eh_escritorio()));
-- Gravação só pelas funções abaixo

-- Por onde o cliente avaliou (link do e-mail ou do WhatsApp; vazio = link copiado ou histórico)
ALTER TABLE public.ratings ADD COLUMN IF NOT EXISTS origem TEXT CHECK (origem IN ('email', 'whatsapp'));

-- Configuração privada (ninguém do app lê)
CREATE TABLE IF NOT EXISTS public.avaliacao_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ativo BOOLEAN NOT NULL DEFAULT FALSE,
  -- Modo teste: todo e-mail vai para este endereço em vez do cliente
  somente_para TEXT,
  envio_url TEXT NOT NULL,
  app_url TEXT NOT NULL,
  segredo TEXT NOT NULL
);
ALTER TABLE public.avaliacao_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.avaliacao_config FROM anon, authenticated;
INSERT INTO public.avaliacao_config (envio_url, app_url, segredo)
VALUES (
  'https://control.brvniteroi.com.br/api/enviar-avaliacao.php',
  'https://control.brvniteroi.com.br',
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
)
ON CONFLICT (id) DO NOTHING;

-- Confere as regras e pede o envio
CREATE OR REPLACE FUNCTION public.avaliacao_email_processar(p_os UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
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

  IF v_email IS NULL OR v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
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

CREATE OR REPLACE FUNCTION public.service_orders_pede_avaliacao()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Sem login (importação, scripts) não pede avaliação
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  PERFORM public.avaliacao_email_processar(NEW.id);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.service_orders_pede_avaliacao() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS service_orders_pede_avaliacao ON public.service_orders;
CREATE TRIGGER service_orders_pede_avaliacao
  AFTER UPDATE OF status ON public.service_orders
  FOR EACH ROW
  WHEN (NEW.status = 'concluida' AND OLD.status IS DISTINCT FROM 'concluida')
  EXECUTE FUNCTION public.service_orders_pede_avaliacao();

-- Resposta do PHP: enviado ou falhou (só com o segredo; chamada sem login)
CREATE OR REPLACE FUNCTION public.avaliacao_email_resultado(p_pedido UUID, p_segredo TEXT, p_ok BOOLEAN, p_detalhe TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_segredo TEXT;
BEGIN
  SELECT segredo INTO v_segredo FROM public.avaliacao_config WHERE id = 1;
  IF v_segredo IS NULL OR p_segredo IS NULL OR p_segredo <> v_segredo THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  UPDATE public.rating_requests
     SET status = CASE WHEN p_ok THEN 'enviado' ELSE 'falhou' END,
         detail = CASE WHEN p_ok THEN detail ELSE left(coalesce(p_detalhe, 'Falha no envio'), 300) END,
         updated_at = NOW()
   WHERE id = p_pedido AND status = 'pendente';
END;
$$;
REVOKE ALL ON FUNCTION public.avaliacao_email_resultado(UUID, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.avaliacao_email_resultado(UUID, TEXT, BOOLEAN, TEXT) TO anon, authenticated;

-- Pedido manual pelo WhatsApp (botão na OS): só registra, para a regra das 72 h e para a tela
CREATE OR REPLACE FUNCTION public.registrar_pedido_avaliacao_whatsapp(p_os UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_cliente UUID;
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  SELECT customer_id INTO v_cliente FROM public.service_orders WHERE id = p_os;
  IF NOT FOUND THEN RAISE EXCEPTION 'OS não encontrada.'; END IF;
  INSERT INTO public.rating_requests (service_order_id, customer_id, channel, status)
  VALUES (p_os, v_cliente, 'whatsapp', 'enviado');
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_pedido_avaliacao_whatsapp(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pedido_avaliacao_whatsapp(UUID) TO authenticated;

-- Página pública: grava também por onde o cliente veio (?origem=email|whatsapp)
DROP FUNCTION IF EXISTS public.avaliacao_enviar(TEXT, INTEGER, TEXT);
CREATE OR REPLACE FUNCTION public.avaliacao_enviar(p_token TEXT, p_estrelas INTEGER, p_comentario TEXT, p_origem TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_os public.service_orders;
  v_t public.tasks;
  v_comentario TEXT := nullif(trim(coalesce(p_comentario, '')), '');
  v_origem TEXT := CASE WHEN p_origem IN ('email', 'whatsapp') THEN p_origem END;
BEGIN
  IF p_token IS NULL OR length(p_token) <> 64 THEN RAISE EXCEPTION 'Link de avaliação inválido.'; END IF;
  SELECT * INTO v_os FROM public.service_orders WHERE rating_token = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link de avaliação inválido.'; END IF;
  IF p_estrelas IS NULL OR p_estrelas NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Escolha de 1 a 5 estrelas.'; END IF;
  IF char_length(v_comentario) > 1000 THEN RAISE EXCEPTION 'O comentário está muito longo (máximo de 1000 caracteres).'; END IF;
  IF EXISTS (SELECT 1 FROM public.ratings WHERE service_order_id = v_os.id AND field_control_id IS NULL) THEN
    RAISE EXCEPTION 'Este atendimento já foi avaliado. Obrigado!';
  END IF;
  v_t := public.avaliacao_ultima_atividade(v_os.id);
  INSERT INTO public.ratings (service_order_id, task_id, employee_id, customer_id, stars, comment, origem)
  VALUES (v_os.id, v_t.id, v_t.employee_id, v_os.customer_id, p_estrelas, v_comentario, v_origem);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.avaliacao_enviar(TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.avaliacao_enviar(TEXT, INTEGER, TEXT, TEXT) TO anon, authenticated;
