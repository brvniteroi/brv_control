-- =====================================================================
-- Verificação da migration 20261126100000_relatorio_vendas.sql (só lê).
-- É UM bloco DO que DÁ ERRO DE PROPÓSITO no fim: "TUDO CERTO ..." = passou; "FALHOU ..." = me mande o texto.
-- =====================================================================
DO $verificacao$
DECLARE
  v_admin UUID; v_esperado NUMERIC; v_qtd BIGINT; r JSONB; d JSONB; b JSONB; p RECORD; v_barrados INTEGER := 0;
BEGIN
  SELECT round(sum(total), 2), count(*) INTO v_esperado, v_qtd
    FROM public.sicweb_vendas WHERE NOT cancelada AND data < public.virada_sicweb();
  SELECT v_esperado + coalesce(round(sum(total_cents) / 100.0, 2), 0), v_qtd + count(*) INTO v_esperado, v_qtd
    FROM public.sales WHERE status = 'ativa' AND (created_at AT TIME ZONE 'America/Sao_Paulo')::DATE >= public.virada_sicweb();

  SELECT id INTO v_admin FROM public.profiles WHERE active AND role = 'admin' LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, TRUE);
  SET LOCAL ROLE authenticated;
  r := public.relatorio_vendas_mensal();
  IF abs((SELECT sum((m->>'total')::NUMERIC) FROM jsonb_array_elements(r->'meses') m) - v_esperado) > 0.5
     OR (SELECT sum((m->>'vendas')::BIGINT) FROM jsonb_array_elements(r->'meses') m) <> v_qtd THEN
    RAISE EXCEPTION 'FALHOU 1: o mês a mês não fecha com as vendas.';
  END IF;
  d := public.relatorio_vendas_detalhe('2025-01-01', '2025-12-31');
  IF jsonb_array_length(d->'clientes') = 0 OR jsonb_array_length(d->'produtos') = 0 OR jsonb_array_length(d->'servicos') = 0 THEN
    RAISE EXCEPTION 'FALHOU 2: detalhe de 2025 veio incompleto.';
  END IF;
  b := public.sicweb_vendas_buscar('', '2025-01-01', '2025-12-31', 0);
  IF (b->>'quantidade')::BIGINT <> (SELECT count(*) FROM public.sicweb_vendas WHERE data BETWEEN '2025-01-01' AND '2025-12-31')
     OR jsonb_array_length(b->'vendas') <> 50 THEN
    RAISE EXCEPTION 'FALHOU 3: busca por período.';
  END IF;
  IF (public.sicweb_vendas_buscar('split', '2025-01-01', '2025-12-31', 0)->>'quantidade')::BIGINT NOT BETWEEN 1 AND (b->>'quantidade')::BIGINT - 1 THEN
    RAISE EXCEPTION 'FALHOU 4: busca por produto.';
  END IF;
  BEGIN
    PERFORM 1 FROM public.relatorio_vendas_base LIMIT 1;
    RAISE EXCEPTION 'FALHOU 5: a visão interna pode ser lida direto.';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;

  FOR p IN SELECT id, full_name FROM public.profiles WHERE active AND role IN ('escritorio', 'tecnico', 'oficina') LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', p.id, 'role', 'authenticated')::text, TRUE);
    SET LOCAL ROLE authenticated;
    BEGIN
      PERFORM public.relatorio_vendas_mensal();
      RAISE EXCEPTION 'FALHOU 6: % leu o relatório.', p.full_name;
    EXCEPTION WHEN insufficient_privilege THEN v_barrados := v_barrados + 1;
    END;
    BEGIN
      PERFORM public.relatorio_vendas_detalhe('2025-01-01', '2025-12-31');
      RAISE EXCEPTION 'FALHOU 7: % leu o detalhe.', p.full_name;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
      PERFORM public.sicweb_vendas_buscar();
      RAISE EXCEPTION 'FALHOU 8: % leu o histórico.', p.full_name;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    RESET ROLE;
  END LOOP;

  IF has_function_privilege('anon', 'public.relatorio_vendas_mensal()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.sicweb_vendas_buscar(text, date, date, integer)', 'EXECUTE')
     OR has_table_privilege('anon', 'public.relatorio_vendas_base', 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU 9: anon tem acesso.';
  END IF;
  RAISE EXCEPTION 'TUDO CERTO (% vendas somando R$ %; % pessoa(s) sem ser admin barrada(s); o erro é de propósito).', v_qtd, v_esperado, v_barrados;
END $verificacao$;
