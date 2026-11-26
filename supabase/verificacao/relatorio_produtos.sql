-- =====================================================================
-- Verificação da migration 20261126110000_relatorio_produtos.sql (só lê).
-- É UM bloco DO que DÁ ERRO DE PROPÓSITO no fim: "TUDO CERTO ..." = passou; "FALHOU ..." = me mande o texto.
-- =====================================================================
DO $verificacao$
DECLARE
  v_admin UUID; r JSONB; v_esperado NUMERIC; v_veio NUMERIC; p RECORD; v_barrados INTEGER := 0; v_produtos INTEGER;
BEGIN
  -- Soma esperada dos produtos de 2025 (período só do SicWeb)
  SELECT round(sum(i.total), 2) INTO v_esperado
    FROM public.sicweb_venda_itens i
    JOIN public.sicweb_vendas v ON v.controle = i.venda_controle AND NOT v.cancelada AND v.data BETWEEN '2025-01-01' AND '2025-12-31'
    JOIN public.catalog_items c ON c.legacy_code = i.produto_codigo::TEXT AND c.kind = 'produto';

  SELECT id INTO v_admin FROM public.profiles WHERE active AND role = 'admin' LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, TRUE);
  SET LOCAL ROLE authenticated;
  r := public.relatorio_produtos_vendidos('2025-01-01', '2025-12-31');
  SELECT sum((x->>'total')::NUMERIC), count(*) INTO v_veio, v_produtos FROM jsonb_array_elements(r->'produtos') x;
  IF v_veio IS NULL OR abs(v_veio - v_esperado) > 0.5 THEN RAISE EXCEPTION 'FALHOU 1: soma dos produtos (% x %).', v_veio, v_esperado; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'produtos') x WHERE (x->>'quantidade_anterior')::NUMERIC > 0) THEN
    RAISE EXCEPTION 'FALHOU 2: sem quantidade do ano anterior.';
  END IF;
  RESET ROLE;

  FOR p IN SELECT id, full_name FROM public.profiles WHERE active AND role IN ('escritorio', 'tecnico', 'oficina') LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', p.id, 'role', 'authenticated')::text, TRUE);
    SET LOCAL ROLE authenticated;
    BEGIN
      PERFORM public.relatorio_produtos_vendidos('2025-01-01', '2025-12-31');
      RAISE EXCEPTION 'FALHOU 3: % leu o relatório.', p.full_name;
    EXCEPTION WHEN insufficient_privilege THEN v_barrados := v_barrados + 1;
    END;
    RESET ROLE;
  END LOOP;

  IF has_function_privilege('anon', 'public.relatorio_produtos_vendidos(date, date)', 'EXECUTE') THEN RAISE EXCEPTION 'FALHOU 4: anon.'; END IF;
  RAISE EXCEPTION 'TUDO CERTO (% produtos em 2025 somando R$ %; % pessoa(s) sem ser admin barrada(s); o erro é de propósito).', v_produtos, v_veio, v_barrados;
END $verificacao$;
