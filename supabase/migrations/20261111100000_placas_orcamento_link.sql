-- =====================================================================
-- Placas: orçamento enviado por LINK no WhatsApp, com aprovação pelo cliente (2026-11-11).
--
-- O link do WhatsApp (wa.me) só leva texto: em vez de anexar o PDF, a mensagem leva o link
-- /orcamento-placa/<quote_token>. O cliente vê o orçamento (mesma folha do PDF), salva em PDF e
-- aprova num botão, sem login.
--
-- quote_token é diferente do public_token (link de acompanhamento): o acompanhamento vai no
-- comprovante de entrada (pode passar por portador) e não mostra valores; o do orçamento só vai na
-- mensagem do orçamento.
--
-- Colar no SQL Editor do projeto BRV Control.
-- =====================================================================
BEGIN;

-- 1. Token do orçamento (criado no primeiro envio por link)
ALTER TABLE public.board_orders ADD COLUMN IF NOT EXISTS quote_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS board_orders_quote_token_key ON public.board_orders (quote_token) WHERE quote_token IS NOT NULL;

-- 2. Canal "link" (o próprio cliente aprovou na página do orçamento)
ALTER TABLE public.board_orders DROP CONSTRAINT IF EXISTS board_orders_quote_response_channel_check;
ALTER TABLE public.board_orders ADD CONSTRAINT board_orders_quote_response_channel_check
  CHECK (quote_response_channel IN ('whatsapp', 'telefone', 'presencial', 'email', 'link'));

-- 3. Autor do histórico: sem login, a função pública informa o nome (ex.: "Fulano (cliente, pelo link)")
CREATE OR REPLACE FUNCTION public.board_ator()
RETURNS TABLE (id UUID, nome TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT auth.uid(),
         coalesce(
           (SELECT full_name FROM public.profiles WHERE profiles.id = auth.uid()),
           nullif(current_setting('board.ator_nome', TRUE), ''),
           'Sistema'
         );
$$;
REVOKE EXECUTE ON FUNCTION public.board_ator() FROM PUBLIC, anon, authenticated;

-- 4. Escritório: marca o orçamento como enviado e devolve o token do link (cria na primeira vez)
CREATE OR REPLACE FUNCTION public.board_enviar_orcamento_link(p_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  b public.board_orders%ROWTYPE;
  v_token TEXT;
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO b FROM public.board_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Placa não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF b.is_warranty THEN
    RAISE EXCEPTION 'Retorno em garantia não tem orçamento.' USING ERRCODE = '23514';
  END IF;
  IF b.cancelled_entry OR b.status IN ('entregue', 'sem_conserto') THEN
    RAISE EXCEPTION 'Placa cancelada ou finalizada: o orçamento não pode ser enviado.' USING ERRCODE = '23514';
  END IF;

  v_token := coalesce(b.quote_token, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));

  -- Resposta já registrada (aprovado/recusado) não volta para "enviado": só reenvia o link
  IF b.quote_status IN ('nao_feito', 'enviado') THEN
    UPDATE public.board_orders
       SET quote_token = v_token, quote_status = 'enviado', quote_sent_at = NOW()
     WHERE id = p_id;   -- board_orders_regras confere valor e parecer
  ELSIF b.quote_token IS NULL THEN
    UPDATE public.board_orders SET quote_token = v_token WHERE id = p_id;
  END IF;
  RETURN v_token;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.board_enviar_orcamento_link(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.board_enviar_orcamento_link(UUID) TO authenticated;

-- 5. Página pública do orçamento (/orcamento-placa/<token>): sem login, só esta placa
CREATE OR REPLACE FUNCTION public.placa_orcamento_ver(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  b public.board_orders%ROWTYPE;
  v_nome TEXT;
  v_telefone TEXT;
  v_documento TEXT;
  v_endereco TEXT;
  v_validade TIMESTAMPTZ;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 THEN
    RETURN NULL;
  END IF;
  SELECT * INTO b FROM public.board_orders WHERE quote_token = p_token AND NOT cancelled_entry AND NOT is_warranty;
  IF NOT FOUND OR b.quote_status = 'nao_feito' THEN
    RETURN NULL;
  END IF;

  IF b.board_client_id IS NOT NULL THEN
    SELECT name, phone, document, address INTO v_nome, v_telefone, v_documento, v_endereco
      FROM public.board_clients WHERE id = b.board_client_id;
  ELSE
    SELECT coalesce(trade_name, name), phone, document, NULL INTO v_nome, v_telefone, v_documento, v_endereco
      FROM public.customers WHERE id = b.customer_id;
  END IF;

  v_validade := b.quote_sent_at + make_interval(days => b.quote_validity_days);

  RETURN jsonb_build_object(
    'board_number', b.board_number,
    'status', b.status,
    'customer_name', coalesce(v_nome, '—'),
    'customer_phone', v_telefone,
    'customer_kind', b.customer_kind,
    'customer_document', coalesce(b.customer_document, v_documento),
    'customer_person_type', b.customer_person_type,
    'customer_address', coalesce(b.customer_address, v_endereco),
    'equipment_type', b.equipment_type,
    'brand_model', b.brand_model,
    'board_code', b.board_code,
    'peripherals', b.peripherals,
    'reported_defect', b.reported_defect,
    'error_code', b.error_code,
    'quote_technical_opinion', b.quote_technical_opinion,
    'quote_amount', b.quote_amount,
    'quote_validity_days', b.quote_validity_days,
    'quote_status', b.quote_status,
    'quote_sent_at', b.quote_sent_at,
    'quote_valid_until', v_validade,
    'quote_expired', b.quote_status = 'enviado' AND v_validade < NOW(),
    'quote_responded_at', b.quote_responded_at,
    'quote_response_channel', b.quote_response_channel,
    'quote_response_notes', b.quote_response_notes
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.placa_orcamento_ver(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.placa_orcamento_ver(TEXT) TO anon, authenticated;

-- 6. O cliente aprova pelo link (só orçamento enviado, dentro da validade)
CREATE OR REPLACE FUNCTION public.placa_orcamento_aprovar(p_token TEXT, p_nome TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  b public.board_orders%ROWTYPE;
  v_nome TEXT := left(btrim(coalesce(p_nome, '')), 120);
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 THEN
    RAISE EXCEPTION 'Link inválido.' USING ERRCODE = 'P0002';
  END IF;
  IF char_length(v_nome) < 3 THEN
    RAISE EXCEPTION 'Informe o seu nome para aprovar.' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO b FROM public.board_orders WHERE quote_token = p_token AND NOT cancelled_entry AND NOT is_warranty FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF b.quote_status = 'aprovado' THEN
    RETURN public.placa_orcamento_ver(p_token);   -- clique repetido: já está aprovado
  END IF;
  IF b.quote_status <> 'enviado' OR b.status IN ('entregue', 'sem_conserto') THEN
    RAISE EXCEPTION 'Este orçamento não está mais aberto para aprovação. Fale com a BRV pelo WhatsApp.' USING ERRCODE = '23514';
  END IF;
  IF b.quote_sent_at + make_interval(days => b.quote_validity_days) < NOW() THEN
    RAISE EXCEPTION 'A validade deste orçamento terminou. Fale com a BRV pelo WhatsApp para atualizar a proposta.' USING ERRCODE = '23514';
  END IF;
  IF coalesce(b.quote_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Orçamento sem valor. Fale com a BRV pelo WhatsApp.' USING ERRCODE = '23514';
  END IF;

  -- Sem login o gatilho de regras não preenche data/autor: preenchidos aqui. O histórico registra o nome informado.
  PERFORM set_config('board.ator_nome', v_nome || ' (cliente, pelo link)', TRUE);
  UPDATE public.board_orders
     SET quote_status = 'aprovado',
         quote_response_channel = 'link',
         quote_response_notes = 'Aprovado pelo cliente no link do orçamento por ' || v_nome,
         quote_responded_at = NOW(),
         quote_responded_by = NULL
   WHERE id = b.id;

  RETURN public.placa_orcamento_ver(p_token);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.placa_orcamento_aprovar(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.placa_orcamento_aprovar(TEXT, TEXT) TO anon, authenticated;

COMMIT;
