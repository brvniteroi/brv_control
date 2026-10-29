-- =====================================================================
-- Clientes: salvar cliente + endereço + contatos numa única transação
-- e manter o contato principal consistente.
-- Rodar no SQL Editor (ou `supabase db push`). Não altera dados existentes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Contato principal
--    - só pode haver um por cliente: marcar um novo rebaixa o anterior;
--    - o primeiro contato do cliente nasce principal;
--    - ao apagar o principal, o contato mais antigo assume;
--    - telefone/e-mail do principal são copiados para customers.phone/email
--      (é o que a lista de clientes exibe).
-- ---------------------------------------------------------------------
CREATE FUNCTION public.contato_principal_antes()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NOT NEW.is_primary AND TG_OP = 'INSERT' THEN
    NEW.is_primary := NOT EXISTS (
      SELECT 1 FROM public.customer_contacts WHERE customer_id = NEW.customer_id AND is_primary
    );
  END IF;

  IF NEW.is_primary THEN
    UPDATE public.customer_contacts
       SET is_primary = FALSE
     WHERE customer_id = NEW.customer_id AND is_primary AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER customer_contacts_principal_antes
  BEFORE INSERT OR UPDATE OF is_primary ON public.customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.contato_principal_antes();

CREATE FUNCTION public.contato_principal_depois()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_cliente UUID := COALESCE(NEW.customer_id, OLD.customer_id);
  v_principal public.customer_contacts;
BEGIN
  -- Alterações feitas pelos próprios triggers (rebaixar o antigo principal,
  -- promover outro) são tratadas pela execução externa
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_principal
    FROM public.customer_contacts WHERE customer_id = v_cliente AND is_primary;

  IF NOT FOUND THEN
    UPDATE public.customer_contacts SET is_primary = TRUE
     WHERE id = (SELECT id FROM public.customer_contacts
                  WHERE customer_id = v_cliente ORDER BY created_at, id LIMIT 1);
    SELECT * INTO v_principal
      FROM public.customer_contacts WHERE customer_id = v_cliente AND is_primary;
  END IF;

  -- Sem nenhum contato: mantém o telefone/e-mail que o cliente já tinha
  IF FOUND THEN
    UPDATE public.customers
       SET phone = v_principal.phone, email = v_principal.email
     WHERE id = v_cliente
       AND (phone IS DISTINCT FROM v_principal.phone OR email IS DISTINCT FROM v_principal.email);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER customer_contacts_principal_depois
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.contato_principal_depois();

-- ---------------------------------------------------------------------
-- 2. salvar_cliente
--    p_id NULL = criar. p_contatos só é usado na criação (depois disso os
--    contatos são adicionados/removidos um a um).
--    p_endereco NULL = não mexe no endereço principal. Latitude/longitude
--    só são alteradas se vierem na chave do JSON.
--    Roda como o usuário (SECURITY INVOKER): o RLS continua valendo.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.salvar_cliente(
  p_id UUID,
  p_cliente JSONB,
  p_endereco JSONB DEFAULT NULL,
  p_contatos JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  v_id UUID := p_id;
  v_nome TEXT := NULLIF(TRIM(p_cliente->>'name'), '');
  v_doc TEXT := NULLIF(regexp_replace(upper(COALESCE(p_cliente->>'document', '')), '[^0-9A-Z]', '', 'g'), '');
  v_tipo TEXT := COALESCE(p_cliente->>'person_type', 'PJ');
  v_end_id UUID;
  v_rua TEXT;
  v_constraint TEXT;
  c JSONB;
BEGIN
  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'O campo Nome é obrigatório.';
  END IF;

  BEGIN
    IF p_id IS NULL THEN
      INSERT INTO public.customers (person_type, name, trade_name, document, state_registration, notes, active)
      VALUES (
        v_tipo, v_nome,
        NULLIF(TRIM(p_cliente->>'trade_name'), ''),
        v_doc,
        NULLIF(TRIM(p_cliente->>'state_registration'), ''),
        NULLIF(TRIM(p_cliente->>'notes'), ''),
        COALESCE((p_cliente->>'active')::BOOLEAN, TRUE)
      )
      RETURNING id INTO v_id;
    ELSE
      UPDATE public.customers SET
        person_type = v_tipo,
        name = v_nome,
        trade_name = NULLIF(TRIM(p_cliente->>'trade_name'), ''),
        document = v_doc,
        state_registration = NULLIF(TRIM(p_cliente->>'state_registration'), ''),
        notes = NULLIF(TRIM(p_cliente->>'notes'), ''),
        active = COALESCE((p_cliente->>'active')::BOOLEAN, active)
      WHERE id = p_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Cliente não encontrado (ou sem permissão para alterá-lo).';
      END IF;
    END IF;
  EXCEPTION
    WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint = 'customers_document_key' THEN
        RAISE EXCEPTION 'Já existe um cliente cadastrado com este CPF/CNPJ.';
      END IF;
      RAISE;
    WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint = 'customers_document_format' THEN
        RAISE EXCEPTION 'CPF/CNPJ em formato inválido para o tipo de pessoa (%).', v_tipo;
      END IF;
      RAISE;
  END;

  -- Endereço principal
  v_rua := NULLIF(TRIM(p_endereco->>'street'), '');
  IF v_rua IS NOT NULL THEN
    SELECT id INTO v_end_id
      FROM public.customer_addresses WHERE customer_id = v_id AND is_primary;

    IF v_end_id IS NULL THEN
      INSERT INTO public.customer_addresses (
        customer_id, label, zip_code, street, number, complement, district,
        city, state, reference, latitude, longitude, is_primary
      ) VALUES (
        v_id,
        COALESCE(NULLIF(TRIM(p_endereco->>'label'), ''), 'Principal'),
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
        TRUE
      );
    ELSE
      UPDATE public.customer_addresses SET
        zip_code = NULLIF(regexp_replace(COALESCE(p_endereco->>'zip_code', ''), '\D', '', 'g'), ''),
        street = v_rua,
        number = NULLIF(TRIM(p_endereco->>'number'), ''),
        complement = NULLIF(TRIM(p_endereco->>'complement'), ''),
        district = NULLIF(TRIM(p_endereco->>'district'), ''),
        city = COALESCE(NULLIF(TRIM(p_endereco->>'city'), ''), 'Niterói'),
        state = upper(left(COALESCE(NULLIF(TRIM(p_endereco->>'state'), ''), 'RJ'), 2)),
        reference = NULLIF(TRIM(p_endereco->>'reference'), ''),
        latitude = CASE WHEN p_endereco ? 'latitude' THEN (p_endereco->>'latitude')::NUMERIC ELSE latitude END,
        longitude = CASE WHEN p_endereco ? 'longitude' THEN (p_endereco->>'longitude')::NUMERIC ELSE longitude END
      WHERE id = v_end_id;
    END IF;
  END IF;

  -- Contatos (só na criação)
  IF p_id IS NULL AND p_contatos IS NOT NULL THEN
    FOR c IN SELECT * FROM jsonb_array_elements(p_contatos) LOOP
      INSERT INTO public.customer_contacts (customer_id, name, role, phone, is_whatsapp, email, is_primary)
      VALUES (
        v_id,
        COALESCE(NULLIF(TRIM(c->>'name'), ''), v_nome),
        NULLIF(TRIM(c->>'role'), ''),
        NULLIF(TRIM(c->>'phone'), ''),
        COALESCE((c->>'is_whatsapp')::BOOLEAN, TRUE),
        NULLIF(TRIM(c->>'email'), ''),
        COALESCE((c->>'is_primary')::BOOLEAN, FALSE)
      );
    END LOOP;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.salvar_cliente(UUID, JSONB, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_cliente(UUID, JSONB, JSONB, JSONB) TO authenticated;
