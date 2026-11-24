-- Melhora o reconhecimento de endereço repetido em unir_clientes (a função já existia, migration 20261124130000).
-- Antes só comparava o texto inteiro (rua + número + complemento) e deixava passar o mesmo endereço escrito de outro jeito
-- ("R." x "Rua", "Av." x "Avenida", apartamento colado ao número). Agora dois endereços são o mesmo quando:
--   - o texto inteiro é muito parecido (como antes), OU
--   - têm algum número em comum (número da casa, quadra, lote) E o nome da rua é parecido (ou o CEP é igual) E os
--     complementos não se contradizem (apartamentos diferentes = endereços diferentes).
-- Quando reaproveita o endereço do principal, completa o que estava vazio nele (CEP, complemento, bairro, referência, coordenadas).
-- Na dúvida mantém os dois: endereço repetido some pela tela; endereço unido por engano não se desfaz.

CREATE OR REPLACE FUNCTION public._unir_endereco_igual(
  r1 TEXT, n1 TEXT, c1 TEXT, cep1 TEXT,
  r2 TEXT, n2 TEXT, c2 TEXT, cep2 TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, extensions, pg_temp
AS $f$
DECLARE
  t1 TEXT := coalesce(r1, '') || ' ' || coalesce(n1, '') || ' ' || coalesce(c1, '');
  t2 TEXT := coalesce(r2, '') || ' ' || coalesce(n2, '') || ' ' || coalesce(c2, '');
  num1 TEXT[];
  num2 TEXT[];
  comp1 TEXT[];
  comp2 TEXT[];
BEGIN
  -- Apartamento/casa diferente no mesmo prédio = endereço diferente, mesmo com o texto quase igual:
  -- os dois complementos têm número e nenhum número em comum (apto 301 x apto 302).
  SELECT array_agg(DISTINCT m[1]) INTO comp1 FROM regexp_matches(coalesce(c1, ''), '([0-9]+)', 'g') m;
  SELECT array_agg(DISTINCT m[1]) INTO comp2 FROM regexp_matches(coalesce(c2, ''), '([0-9]+)', 'g') m;
  IF comp1 IS NOT NULL AND comp2 IS NOT NULL AND NOT (comp1 && comp2) THEN
    RETURN FALSE;
  END IF;
  IF similarity(public.sem_acento(lower(t1)), public.sem_acento(lower(t2))) >= 0.6 THEN
    RETURN TRUE;
  END IF;
  SELECT array_agg(DISTINCT m[1]) INTO num1 FROM regexp_matches(t1, '([0-9]+)', 'g') m;
  SELECT array_agg(DISTINCT m[1]) INTO num2 FROM regexp_matches(t2, '([0-9]+)', 'g') m;
  IF num1 IS NULL OR num2 IS NULL OR NOT (num1 && num2) THEN
    RETURN FALSE;
  END IF;
  RETURN similarity(public.sem_acento(lower(regexp_replace(coalesce(r1, ''), '[0-9]+', ' ', 'g'))),
                    public.sem_acento(lower(regexp_replace(coalesce(r2, ''), '[0-9]+', ' ', 'g')))) >= 0.3
         OR (coalesce(cep1, '') <> '' AND coalesce(cep1, '') = coalesce(cep2, ''));
END;
$f$;

CREATE OR REPLACE FUNCTION public.unir_clientes(
  p_principal UUID,
  p_duplicados UUID[],
  p_simular BOOLEAN DEFAULT TRUE,
  p_rotulos JSONB DEFAULT '[]'::JSONB,
  p_nome TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_rel JSONB := '{}'::JSONB;
  v_map JSONB := '{}'::JSONB;
  v_end JSONB := '[]'::JSONB;
  v_principal public.customers%ROWTYPE;
  v_dup public.customers%ROWTYPE;
  a public.customer_addresses%ROWTYPE;
  v_igual UUID;
  v_novo UUID;
  v_rotulo TEXT;
  v_tem_principal BOOLEAN;
  v_doc TEXT;
  v_tipo TEXT;
  v_notas TEXT;
  v_nomes TEXT[] := '{}';
  r RECORD;
  v_n INT;
  v_os INT := 0;
  v_equip INT := 0;
  v_vendas INT := 0;
  v_codigos INT := 0;
  v_mov INT := 0;
  v_desc INT := 0;
  v_resto INT;
  v_doc_passou BOOLEAN := FALSE;
  v_texto TEXT;
BEGIN
  IF p_principal IS NULL OR COALESCE(array_length(p_duplicados, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Informe o cadastro principal e pelo menos um duplicado.';
  END IF;
  IF p_principal = ANY (p_duplicados) THEN
    RAISE EXCEPTION 'O principal não pode estar na lista de duplicados.';
  END IF;
  IF (SELECT COUNT(*) FROM public.customers WHERE id = p_principal OR id = ANY (p_duplicados))
     <> 1 + (SELECT COUNT(DISTINCT x) FROM unnest(p_duplicados) x) THEN
    RAISE EXCEPTION 'Algum cadastro informado não existe.';
  END IF;

  BEGIN -- subtransação: no modo simulação tudo que está aqui dentro é desfeito
    SELECT * INTO v_principal FROM public.customers WHERE id = p_principal;
    SELECT array_agg(name ORDER BY created_at) INTO v_nomes FROM public.customers WHERE id = ANY (p_duplicados);

    -- 1) endereços dos duplicados: reaproveita o que o principal já tem ou copia para o principal
    SELECT EXISTS (SELECT 1 FROM public.customer_addresses WHERE customer_id = p_principal AND is_primary AND active) INTO v_tem_principal;
    FOR a IN
      SELECT x.* FROM public.customer_addresses x WHERE x.customer_id = ANY (p_duplicados) ORDER BY x.is_primary DESC, x.created_at
    LOOP
      v_igual := NULL;
      SELECT p.id INTO v_igual
        FROM public.customer_addresses p
       WHERE p.customer_id = p_principal
         AND public._unir_endereco_igual(p.street, p.number, p.complement, p.zip_code, a.street, a.number, a.complement, a.zip_code)
       ORDER BY p.is_primary DESC LIMIT 1;
      IF v_igual IS NOT NULL THEN
        UPDATE public.customer_addresses p SET
            zip_code = coalesce(nullif(p.zip_code, ''), nullif(a.zip_code, '')),
            complement = coalesce(nullif(p.complement, ''), nullif(a.complement, '')),
            district = coalesce(nullif(p.district, ''), nullif(a.district, '')),
            reference = coalesce(nullif(p.reference, ''), nullif(a.reference, '')),
            latitude = coalesce(p.latitude, a.latitude),
            longitude = coalesce(p.longitude, a.longitude)
         WHERE p.id = v_igual;
        v_map := v_map || jsonb_build_object(a.id::TEXT, v_igual::TEXT);
        v_end := v_end || jsonb_build_object('origem', concat_ws(', ', a.street, a.number, a.complement), 'acao', 'já existia no principal');
      ELSE
        v_novo := gen_random_uuid();
        SELECT name INTO v_texto FROM public.customers WHERE id = a.customer_id;
        v_rotulo := CASE WHEN nullif(btrim(coalesce(a.label, '')), '') IS NULL OR a.label = 'Principal'
                         THEN 'Do cadastro: ' || left(v_texto, 40) ELSE a.label END;
        INSERT INTO public.customer_addresses (id, customer_id, label, zip_code, street, number, complement, district, city, state, reference, latitude, longitude, is_primary, active)
          VALUES (v_novo, p_principal, v_rotulo, a.zip_code, a.street, a.number, a.complement, a.district, a.city, a.state, a.reference, a.latitude, a.longitude,
                  (NOT v_tem_principal AND a.is_primary AND a.active), a.active);
        IF NOT v_tem_principal AND a.is_primary AND a.active THEN v_tem_principal := TRUE; END IF;
        v_map := v_map || jsonb_build_object(a.id::TEXT, v_novo::TEXT);
        v_end := v_end || jsonb_build_object('origem', concat_ws(', ', a.street, a.number, a.complement), 'acao', 'copiado para o principal', 'rotulo', v_rotulo);
      END IF;
    END LOOP;

    -- nomes de endereço pedidos ("trecho" do texto do endereço -> rótulo)
    FOR r IN SELECT x ->> 'trecho' AS trecho, x ->> 'rotulo' AS rotulo FROM jsonb_array_elements(p_rotulos) x LOOP
      UPDATE public.customer_addresses
         SET label = r.rotulo
       WHERE customer_id = p_principal
         AND public.sem_acento(lower(concat_ws(' ', street, number, complement, district))) LIKE '%' || public.sem_acento(lower(r.trecho)) || '%';
      GET DIAGNOSTICS v_n = ROW_COUNT;
      IF v_n = 0 THEN RAISE EXCEPTION 'Nenhum endereço do principal contém "%".', r.trecho; END IF;
    END LOOP;

    -- 2) o que aponta para os duplicados passa para o principal, com o endereço trocado pelo novo
    UPDATE public.service_orders o SET customer_id = p_principal,
           address_id = coalesce((v_map ->> o.address_id::TEXT)::UUID, o.address_id)
     WHERE o.customer_id = ANY (p_duplicados);
    GET DIAGNOSTICS v_os = ROW_COUNT;

    UPDATE public.equipments e SET customer_id = p_principal,
           address_id = coalesce((v_map ->> e.address_id::TEXT)::UUID, e.address_id)
     WHERE e.customer_id = ANY (p_duplicados);
    GET DIAGNOSTICS v_equip = ROW_COUNT;

    UPDATE public.pmoc_plans p SET customer_id = p_principal,
           address_id = coalesce((v_map ->> p.address_id::TEXT)::UUID, p.address_id)
     WHERE p.customer_id = ANY (p_duplicados);
    UPDATE public.workshop_orders SET customer_id = p_principal WHERE customer_id = ANY (p_duplicados);
    UPDATE public.board_orders SET customer_id = p_principal WHERE customer_id = ANY (p_duplicados);
    UPDATE public.ratings SET customer_id = p_principal WHERE customer_id = ANY (p_duplicados);
    UPDATE public.rating_requests SET customer_id = p_principal WHERE customer_id = ANY (p_duplicados);
    UPDATE public.customer_users SET customer_id = p_principal WHERE customer_id = ANY (p_duplicados);

    UPDATE public.customer_sicweb_codes SET customer_id = p_principal WHERE customer_id = ANY (p_duplicados);
    GET DIAGNOSTICS v_codigos = ROW_COUNT;

    -- vendas do SicWeb: o endereço é o do cadastro de onde a venda veio (o principal dele, já mapeado)
    UPDATE public.sicweb_vendas v SET customer_id = p_principal,
           address_id = coalesce(
             (v_map ->> v.address_id::TEXT)::UUID,
             (v_map ->> (SELECT x.id::TEXT FROM public.customer_addresses x WHERE x.customer_id = v.customer_id AND x.is_primary AND x.active LIMIT 1))::UUID)
     WHERE v.customer_id = ANY (p_duplicados);
    GET DIAGNOSTICS v_vendas = ROW_COUNT;

    -- 3) contatos: passam os que o principal ainda não tem (mesmo telefone ou e-mail = repetido)
    FOR r IN SELECT * FROM public.customer_contacts WHERE customer_id = ANY (p_duplicados) LOOP
      IF EXISTS (
        SELECT 1 FROM public.customer_contacts k
         WHERE k.customer_id = p_principal
           AND ((nullif(regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'), '') IS NOT NULL
                 AND regexp_replace(coalesce(k.phone, ''), '\D', '', 'g') = regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'))
                OR (nullif(lower(btrim(coalesce(r.email, ''))), '') IS NOT NULL AND lower(btrim(coalesce(k.email, ''))) = lower(btrim(r.email))))
      ) OR (nullif(regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'), '') IS NULL AND nullif(btrim(coalesce(r.email, '')), '') IS NULL) THEN
        v_desc := v_desc + 1;
      ELSE
        UPDATE public.customer_contacts SET customer_id = p_principal, is_primary = FALSE WHERE id = r.id;
        v_mov := v_mov + 1;
      END IF;
    END LOOP;

    -- 4) dados do cadastro principal: preenche o que faltava e soma as observações
    SELECT document, person_type INTO v_doc, v_tipo FROM public.customers
     WHERE id = ANY (p_duplicados) AND document IS NOT NULL ORDER BY created_at LIMIT 1;
    UPDATE public.customers SET document = NULL WHERE id = ANY (p_duplicados) AND document IS NOT NULL; -- libera o CPF/CNPJ (é único)
    IF v_principal.document IS NULL AND v_doc IS NOT NULL THEN
      UPDATE public.customers SET document = v_doc, person_type = v_tipo WHERE id = p_principal;
      v_doc_passou := TRUE;
    END IF;
    SELECT string_agg(btrim(notes), E'\n---\n' ORDER BY created_at) INTO v_notas
      FROM public.customers WHERE id = ANY (p_duplicados) AND nullif(btrim(coalesce(notes, '')), '') IS NOT NULL;
    UPDATE public.customers c SET
        email = coalesce(c.email, (SELECT x.email FROM public.customers x WHERE x.id = ANY (p_duplicados) AND x.email IS NOT NULL ORDER BY x.created_at LIMIT 1)),
        state_registration = coalesce(c.state_registration, (SELECT x.state_registration FROM public.customers x WHERE x.id = ANY (p_duplicados) AND x.state_registration IS NOT NULL ORDER BY x.created_at LIMIT 1)),
        trade_name = coalesce(c.trade_name, (SELECT x.trade_name FROM public.customers x WHERE x.id = ANY (p_duplicados) AND x.trade_name IS NOT NULL ORDER BY x.created_at LIMIT 1)),
        notes = CASE WHEN v_notas IS NULL THEN c.notes
                     WHEN nullif(btrim(coalesce(c.notes, '')), '') IS NULL THEN v_notas
                     ELSE c.notes || E'\n---\nDe cadastro unido:\n' || v_notas END,
        created_at = least(c.created_at, (SELECT min(x.created_at) FROM public.customers x WHERE x.id = ANY (p_duplicados))),
        name = coalesce(nullif(btrim(p_nome), ''), c.name)
     WHERE c.id = p_principal;

    -- 5) trava: nada mais pode apontar para os duplicados (só os que apagam em cascata, já tratados ou sem valor)
    FOR r IN
      SELECT c.conrelid::regclass::TEXT AS tabela, a2.attname AS coluna
        FROM pg_constraint c
        JOIN pg_attribute a2 ON a2.attrelid = c.conrelid AND a2.attnum = c.conkey[1]
       WHERE c.confrelid = 'public.customers'::regclass AND c.contype = 'f' AND array_length(c.conkey, 1) = 1
         AND c.conrelid::regclass::TEXT NOT IN ('customer_addresses', 'customer_contacts', 'customer_field_original')
    LOOP
      EXECUTE format('SELECT COUNT(*) FROM public.%s WHERE %I = ANY ($1)', r.tabela, r.coluna) INTO v_resto USING p_duplicados;
      IF v_resto > 0 THEN
        RAISE EXCEPTION 'Ainda há % linha(s) em % apontando para o cadastro duplicado; nada foi alterado.', v_resto, r.tabela;
      END IF;
    END LOOP;

    DELETE FROM public.customers WHERE id = ANY (p_duplicados); -- leva junto os endereços e contatos que sobraram

    SELECT jsonb_build_object(
             'principal', c.name,
             'documento', c.document,
             'enderecos', (SELECT coalesce(jsonb_agg(jsonb_build_object('rotulo', x.label, 'endereco', concat_ws(', ', x.street, x.number, x.complement), 'principal', x.is_primary) ORDER BY x.is_primary DESC, x.created_at), '[]'::JSONB)
                             FROM public.customer_addresses x WHERE x.customer_id = c.id),
             'os', (SELECT COUNT(*) FROM public.service_orders o WHERE o.customer_id = c.id),
             'vendas', (SELECT COUNT(*) FROM public.sicweb_vendas v WHERE v.customer_id = c.id),
             'codigos_sicweb', (SELECT coalesce(string_agg(codigo, ' ' ORDER BY codigo), '') FROM public.customer_sicweb_codes k WHERE k.customer_id = c.id),
             'contatos', (SELECT COUNT(*) FROM public.customer_contacts k WHERE k.customer_id = c.id))
      INTO v_rel
      FROM public.customers c WHERE c.id = p_principal;
    v_rel := v_rel || jsonb_build_object(
      'unidos', to_jsonb(v_nomes),
      'movido_os', v_os, 'movido_equipamentos', v_equip, 'movido_vendas', v_vendas, 'movido_codigos', v_codigos,
      'contatos_movidos', v_mov, 'contatos_repetidos_descartados', v_desc,
      'documento_veio_do_duplicado', v_doc_passou, 'enderecos_tratados', v_end);

    IF p_simular THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = '__simulacao__';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> '__simulacao__' THEN RAISE; END IF; -- só a "exceção" da simulação é engolida; o resto desfaz e avisa
  END;

  RETURN v_rel || jsonb_build_object('simulacao', p_simular);
END;
$$;

REVOKE ALL ON FUNCTION public._unir_endereco_igual(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._unir_endereco_igual(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.unir_clientes(UUID, UUID[], BOOLEAN, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unir_clientes(UUID, UUID[], BOOLEAN, JSONB, TEXT) TO service_role;
