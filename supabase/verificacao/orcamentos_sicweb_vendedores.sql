-- =====================================================================
-- Verificação da migration 20261125170000_orcamentos_sicweb_vendedores.sql (só lê).
-- É UM bloco DO que DÁ ERRO DE PROPÓSITO no fim: "TUDO CERTO ..." = passou; "FALHOU ..." = me mande o texto.
-- =====================================================================
DO $verificacao$
DECLARE
  v_total BIGINT; v_itens BIGINT; v_n BIGINT; r RECORD; v_vendedores INTEGER := 0;
BEGIN
  SELECT count(*) INTO v_total FROM public.sicweb_orcamentos;
  SELECT count(*) INTO v_itens FROM public.sicweb_orcamento_itens;
  IF v_total = 0 THEN RAISE EXCEPTION 'FALHOU 0: não há orçamentos importados.'; END IF;

  FOR r IN SELECT id, full_name, role, sales_access FROM public.profiles WHERE active AND role IN ('admin', 'escritorio', 'tecnico') LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', r.id, 'role', 'authenticated')::text, TRUE);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_n FROM public.sicweb_orcamentos;
    IF r.role = 'admin' OR (r.role = 'escritorio' AND r.sales_access) THEN
      IF v_n <> v_total OR (SELECT count(*) FROM public.sicweb_orcamento_itens) <> v_itens THEN
        RAISE EXCEPTION 'FALHOU 1: % deveria ler os orçamentos.', r.full_name;
      END IF;
      IF r.role = 'escritorio' THEN
        v_vendedores := v_vendedores + 1;
        SELECT count(*) INTO v_n FROM public.sicweb_vendas;
        IF v_n <> 0 THEN RAISE EXCEPTION 'FALHOU 2: % leu o histórico de vendas.', r.full_name; END IF;
      END IF;
    ELSIF v_n <> 0 THEN
      RAISE EXCEPTION 'FALHOU 3: % não é vendedor e leu os orçamentos.', r.full_name;
    END IF;
    RESET ROLE;
  END LOOP;

  IF v_vendedores = 0 THEN RAISE EXCEPTION 'FALHOU 4: nenhum vendedor de escritório para conferir.'; END IF;
  IF has_table_privilege('anon', 'public.sicweb_orcamentos', 'SELECT') THEN RAISE EXCEPTION 'FALHOU 5: anon.'; END IF;
  RAISE EXCEPTION 'TUDO CERTO (% vendedor(es) de escritório leem os orçamentos; o erro é de propósito).', v_vendedores;
END $verificacao$;
