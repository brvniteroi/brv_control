-- =====================================================================
-- Verificação da migration 20261125120000_vendedores_modelos.sql.
-- Colar no SQL Editor. O bloco termina com um ERRO DE PROPÓSITO para desfazer tudo o que testou:
-- o resultado bom é a mensagem "TUDO CERTO".
-- =====================================================================
DO $$
DECLARE
  v_admin UUID;
  v_escr UUID;
  v_nivel TEXT;
  v_n INTEGER;
  v_ok BOOLEAN;
  v_lista JSONB;
  v_modelo UUID;
  v_item UUID;
BEGIN
  SELECT id INTO v_admin FROM public.profiles WHERE role = 'admin' AND active ORDER BY created_at LIMIT 1;
  SELECT id INTO v_escr FROM public.profiles WHERE role = 'escritorio' AND active AND sales_access ORDER BY full_name LIMIT 1;
  IF v_admin IS NULL OR v_escr IS NULL THEN
    RAISE EXCEPTION 'FALHOU 0: preciso de um admin e de um vendedor de escritório.';
  END IF;

  -- 1. Vendedores iniciais ligados a funcionário
  SELECT count(*) INTO v_n FROM public.profiles p
   WHERE p.sales_access AND p.role = 'escritorio'
     AND NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.profile_id = p.id AND e.active);
  IF v_n > 0 THEN RAISE EXCEPTION 'FALHOU 1: vendedor sem funcionário ligado.'; END IF;

  -- 2. Nenhuma função de orçamento/venda ficou aberta a todo o escritório
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname ~ '^(orcamento|orcamentos|venda|vendas|modelo)_' AND p.prosrc LIKE '%eh_escritorio%';
  IF v_n > 0 THEN RAISE EXCEPTION 'FALHOU 2: % função(ões) ainda usam eh_escritorio.', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename ~ '^(catalog|quote|sale)'
     AND (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%eh_escritorio%';
  IF v_n > 0 THEN RAISE EXCEPTION 'FALHOU 2b: % política(s) ainda usam eh_escritorio.', v_n; END IF;

  -- 3. Modelo inicial
  SELECT count(*) INTO v_n FROM public.quote_template_items i JOIN public.quote_templates t ON t.id = i.template_id
   WHERE t.name = 'Instalação split 9.000';
  IF v_n <> 10 THEN RAISE EXCEPTION 'FALHOU 3: o modelo 9.000 tem % itens (esperado 10).', v_n; END IF;

  -- Daqui em diante, como o admin
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, TRUE);
  IF NOT public.pode_vender() THEN RAISE EXCEPTION 'FALHOU 4: admin deveria poder vender.'; END IF;

  -- 5. Tirar o vendedor: perde acesso e volta a "nenhum"
  PERFORM public.vendedor_salvar(v_escr, FALSE);
  SELECT financial_access INTO v_nivel FROM public.profiles WHERE id = v_escr;
  IF v_nivel <> 'nenhum' THEN RAISE EXCEPTION 'FALHOU 5: nível deveria voltar a nenhum.'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_escr, 'role', 'authenticated')::text, TRUE);
  IF public.pode_vender() THEN RAISE EXCEPTION 'FALHOU 6: não vendedor não pode vender.'; END IF;
  v_ok := FALSE;
  BEGIN
    PERFORM public.orcamentos_listar('{}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU 6b: não vendedor listou orçamentos.'; END IF;
  v_ok := FALSE;
  BEGIN
    PERFORM public.vendedor_salvar(v_escr, TRUE, 'completo');
  EXCEPTION WHEN insufficient_privilege THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU 7: quem não é admin se tornou vendedor.'; END IF;

  -- 7b. RLS de verdade: como "authenticated", o não vendedor não enxerga o catálogo nem os modelos
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM public.catalog_items;
  IF v_n <> 0 THEN RAISE EXCEPTION 'FALHOU 7b: não vendedor leu % itens do catálogo.', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.quote_templates;
  IF v_n <> 0 THEN RAISE EXCEPTION 'FALHOU 7c: não vendedor leu os modelos.'; END IF;
  RESET ROLE;

  -- 8. Devolver como caixa: volta a vender e aparece na lista
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, TRUE);
  PERFORM public.vendedor_salvar(v_escr, TRUE, 'caixa');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_escr, 'role', 'authenticated')::text, TRUE);
  IF NOT public.pode_vender() OR public.nivel_financeiro() <> 'caixa' THEN RAISE EXCEPTION 'FALHOU 8: vendedor caixa.'; END IF;
  v_lista := public.vendas_vendedores();
  IF jsonb_array_length(v_lista) < 1 THEN RAISE EXCEPTION 'FALHOU 8b: lista de vendedores vazia.'; END IF;
  PERFORM public.orcamentos_listar('{}'::jsonb);

  -- 9. Salvar modelo; nome repetido só com replace
  SELECT id INTO v_item FROM public.catalog_items WHERE active LIMIT 1;
  v_modelo := public.modelo_salvar(jsonb_build_object('name', 'Teste de verificação',
    'items', jsonb_build_array(jsonb_build_object('catalog_item_id', v_item, 'quantity', NULL))));
  v_ok := FALSE;
  BEGIN
    PERFORM public.modelo_salvar(jsonb_build_object('name', 'teste de verificação',
      'items', jsonb_build_array(jsonb_build_object('catalog_item_id', v_item))));
  EXCEPTION WHEN unique_violation THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU 9: nome repetido gravou sem replace.'; END IF;
  IF public.modelo_salvar(jsonb_build_object('name', 'Teste de verificação', 'replace', TRUE,
       'items', jsonb_build_array(jsonb_build_object('catalog_item_id', v_item, 'quantity', 2)))) <> v_modelo THEN
    RAISE EXCEPTION 'FALHOU 9b: replace criou outro modelo.';
  END IF;

  -- 10. Visitante (anon) não chega perto
  IF has_function_privilege('anon', 'public.vendas_vendedores()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.modelo_salvar(jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.vendedor_salvar(uuid, boolean, text, text)', 'EXECUTE')
     OR has_table_privilege('anon', 'public.quote_templates', 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU 10: anon com permissão.';
  END IF;

  RAISE EXCEPTION 'TUDO CERTO (o erro é de propósito: desfaz os testes).';
END $$;
