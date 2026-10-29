-- =====================================================================
-- Clientes com vários endereços de atendimento (matriz, filiais, obras).
-- A tabela customer_addresses e a FK composta das OS/equipamentos já
-- suportam isso; aqui ficam as regras do endereço principal, em transação.
-- Rodar no SQL Editor (ou `supabase db push`). Não altera dados existentes.
-- =====================================================================

-- Cria ou atualiza um endereço do cliente.
--   p_id NULL = criar. p_principal TRUE rebaixa o principal atual.
--   O primeiro endereço do cliente é sempre o principal, e o principal
--   atual não deixa de ser principal por aqui (promova outro endereço).
--   Latitude/longitude só mudam se vierem na chave do JSON.
CREATE FUNCTION public.salvar_endereco_cliente(
  p_id UUID,
  p_customer_id UUID,
  p_endereco JSONB,
  p_principal BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_id UUID := p_id;
  v_rua TEXT := NULLIF(TRIM(p_endereco->>'street'), '');
  v_era_principal BOOLEAN := FALSE;
  v_principal BOOLEAN;
BEGIN
  IF v_rua IS NULL THEN
    RAISE EXCEPTION 'O logradouro é obrigatório.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id) THEN
    RAISE EXCEPTION 'Cliente não encontrado (ou sem permissão).';
  END IF;

  IF p_id IS NOT NULL THEN
    SELECT is_primary INTO v_era_principal
      FROM public.customer_addresses WHERE id = p_id AND customer_id = p_customer_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Endereço não encontrado para este cliente.';
    END IF;
  END IF;

  v_principal := p_principal
    OR v_era_principal
    OR NOT EXISTS (
      SELECT 1 FROM public.customer_addresses
       WHERE customer_id = p_customer_id AND is_primary AND id IS DISTINCT FROM p_id
    );

  IF v_principal THEN
    UPDATE public.customer_addresses
       SET is_primary = FALSE
     WHERE customer_id = p_customer_id AND is_primary AND id IS DISTINCT FROM p_id;
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.customer_addresses (
      customer_id, label, zip_code, street, number, complement, district,
      city, state, reference, latitude, longitude, is_primary
    ) VALUES (
      p_customer_id,
      NULLIF(TRIM(p_endereco->>'label'), ''),
      NULLIF(regexp_replace(COALESCE(p_endereco->>'zip_code', ''), '\D', '', 'g'), ''),
      v_rua,
      NULLIF(TRIM(p_endereco->>'number'), ''),
      NULLIF(TRIM(p_endereco->>'complement'), ''),
      NULLIF(TRIM(p_endereco->>'district'), ''),
      COALESCE(NULLIF(TRIM(p_endereco->>'city'), ''), 'Niterói'),
      upper(left(COALESCE(NULLIF(TRIM(p_endereco->>'state'), ''), 'RJ'), 2)),
      NULLIF(TRIM(p_endereco->>'reference'), ''),
      (p_endereco->>'latitude')::NUMERIC,
      (p_endereco->>'longitude')::NUMERIC,
      v_principal
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.customer_addresses SET
      label = NULLIF(TRIM(p_endereco->>'label'), ''),
      zip_code = NULLIF(regexp_replace(COALESCE(p_endereco->>'zip_code', ''), '\D', '', 'g'), ''),
      street = v_rua,
      number = NULLIF(TRIM(p_endereco->>'number'), ''),
      complement = NULLIF(TRIM(p_endereco->>'complement'), ''),
      district = NULLIF(TRIM(p_endereco->>'district'), ''),
      city = COALESCE(NULLIF(TRIM(p_endereco->>'city'), ''), 'Niterói'),
      state = upper(left(COALESCE(NULLIF(TRIM(p_endereco->>'state'), ''), 'RJ'), 2)),
      reference = NULLIF(TRIM(p_endereco->>'reference'), ''),
      latitude = CASE WHEN p_endereco ? 'latitude' THEN (p_endereco->>'latitude')::NUMERIC ELSE latitude END,
      longitude = CASE WHEN p_endereco ? 'longitude' THEN (p_endereco->>'longitude')::NUMERIC ELSE longitude END,
      is_primary = v_principal,
      active = CASE WHEN v_principal THEN TRUE ELSE active END
    WHERE id = p_id;
  END IF;

  RETURN v_id;
END;
$$;

-- Promove um endereço existente a principal (o principal atual passa a ser comum).
CREATE FUNCTION public.definir_endereco_principal(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_cliente UUID;
BEGIN
  SELECT customer_id INTO v_cliente FROM public.customer_addresses WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Endereço não encontrado (ou sem permissão).';
  END IF;

  UPDATE public.customer_addresses SET is_primary = FALSE
   WHERE customer_id = v_cliente AND is_primary AND id <> p_id;
  UPDATE public.customer_addresses SET is_primary = TRUE, active = TRUE WHERE id = p_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.salvar_endereco_cliente(UUID, UUID, JSONB, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_endereco_cliente(UUID, UUID, JSONB, BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.definir_endereco_principal(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_endereco_principal(UUID) TO authenticated;
