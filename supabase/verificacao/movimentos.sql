-- =====================================================================
-- Verificação do extrato (migration 20261125140000_movimentos.sql).
-- Colar no SQL Editor DEPOIS de aplicar a migration e clicar em Run. É UM bloco DO que DÁ ERRO DE PROPÓSITO
-- no fim para desfazer tudo (nada fica no banco):
--   * "TUDO CERTO ..." = passou em todas as verificações (o "erro" é só o desfazer).
--   * "FALHOU ..."     = alguma regra não funcionou (me mande o texto).
-- Pode rodar com o caixa aberto ou fechado. A numeração das vendas volta ao que era.
-- =====================================================================
DO $verificacao$
DECLARE
  v_braulio UUID := (SELECT id FROM public.profiles WHERE email = 'brvniteroi@gmail.com');
  v_caixa_login UUID := (SELECT id FROM public.profiles WHERE role = 'escritorio' AND active AND financial_access = 'caixa' LIMIT 1);
  v_seq BIGINT; v_seq_chamado BOOLEAN;
  v_cx UUID; v_banco UUID; v_receita UUID; v_despesa UUID;
  v_s_cx BIGINT; v_s_banco BIGINT;
  v_json JSONB; v_av UUID; v_saida UUID; v_venda UUID; v_mov UUID; v_n BIGINT; v_ok BOOLEAN;
BEGIN
  SELECT last_value, is_called INTO v_seq, v_seq_chamado FROM public.sale_number_seq;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_braulio, 'role', 'authenticated')::text, TRUE);
  PERFORM set_config('request.jwt.claim.sub', v_braulio::text, TRUE);
  SET LOCAL ROLE authenticated;

  SELECT id INTO v_cx FROM public.financial_accounts WHERE active AND kind = 'caixa' ORDER BY sort_order LIMIT 1;
  SELECT id INTO v_banco FROM public.financial_accounts WHERE active AND kind = 'banco' ORDER BY sort_order LIMIT 1;
  SELECT id INTO v_receita FROM public.financial_categories WHERE active AND kind = 'receita' LIMIT 1;
  SELECT id INTO v_despesa FROM public.financial_categories WHERE active AND kind = 'despesa' LIMIT 1;
  v_s_cx := (public.movimentos_listar(jsonb_build_object('conta_id', v_cx))->>'saldo_atual_conta_cents')::bigint;
  v_s_banco := (public.movimentos_listar(jsonb_build_object('conta_id', v_banco))->>'saldo_atual_conta_cents')::bigint;

  -- 1. Avulso de receita no banco
  v_json := public.financeiro_lancar_avulso(jsonb_build_object('direction', 'entrada', 'account_id', v_banco, 'category_id', v_receita,
    'method', 'pix', 'amount_cents', 100000, 'description', 'ZZ receita teste'));
  v_av := (v_json->>'id')::uuid;
  IF NOT (v_json->>'reversible')::boolean THEN RAISE EXCEPTION 'FALHOU 1: avulso deveria poder estornar.'; END IF;

  -- 2. Recusas: categoria trocada, dinheiro no banco, pix no caixa, data futura, caixa com data de ontem, saída maior que o caixa
  FOR v_json IN SELECT * FROM jsonb_array_elements(jsonb_build_array(
      jsonb_build_object('direction', 'saida', 'account_id', v_banco, 'category_id', v_receita, 'method', 'pix'),
      jsonb_build_object('direction', 'saida', 'account_id', v_banco, 'category_id', v_despesa, 'method', 'dinheiro'),
      jsonb_build_object('direction', 'entrada', 'account_id', v_cx, 'category_id', v_receita, 'method', 'pix'),
      jsonb_build_object('direction', 'saida', 'account_id', v_banco, 'category_id', v_despesa, 'method', 'pix', 'occurred_date', public.hoje_local() + 1),
      jsonb_build_object('direction', 'entrada', 'account_id', v_cx, 'category_id', v_receita, 'method', 'dinheiro', 'occurred_date', public.hoje_local() - 1),
      jsonb_build_object('direction', 'saida', 'account_id', v_cx, 'category_id', v_despesa, 'method', 'dinheiro', 'amount_cents', 999999999)))
  LOOP
    v_ok := FALSE;
    BEGIN
      PERFORM public.financeiro_lancar_avulso(jsonb_build_object('amount_cents', 100, 'description', 'ZZ recusa') || v_json);
    EXCEPTION WHEN check_violation THEN v_ok := TRUE;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU 2: aceitou %', v_json; END IF;
  END LOOP;

  -- 3. Transferência banco -> caixa e extrato com saldo linha a linha
  v_json := public.financeiro_transferir(jsonb_build_object('from_account_id', v_banco, 'to_account_id', v_cx, 'amount_cents', 30000));
  v_saida := (v_json->'saida'->>'id')::uuid;
  v_json := public.movimentos_listar(jsonb_build_object('conta_id', v_banco));
  IF (v_json->>'saldo_atual_conta_cents')::bigint <> v_s_banco + 70000 THEN RAISE EXCEPTION 'FALHOU 3: saldo do banco %', v_json->>'saldo_atual_conta_cents'; END IF;
  IF (v_json->'itens'->0->>'running_balance_cents') IS NULL THEN RAISE EXCEPTION 'FALHOU 3b: sem saldo linha a linha.'; END IF;
  IF (public.movimentos_listar(jsonb_build_object('conta_id', v_cx))->>'saldo_atual_conta_cents')::bigint <> v_s_cx + 30000 THEN
    RAISE EXCEPTION 'FALHOU 3c: caixa não recebeu.';
  END IF;
  v_ok := FALSE;
  BEGIN PERFORM public.financeiro_transferir(jsonb_build_object('from_account_id', v_cx, 'to_account_id', v_cx, 'amount_cents', 1));
  EXCEPTION WHEN check_violation THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU 3d: transferiu para a mesma conta.'; END IF;

  -- 4. Estorno da transferência desfaz as duas pontas, uma única vez
  PERFORM public.financeiro_estornar(v_saida, 'teste');
  IF (public.movimentos_listar(jsonb_build_object('conta_id', v_cx))->>'saldo_atual_conta_cents')::bigint <> v_s_cx
     OR (public.movimentos_listar(jsonb_build_object('conta_id', v_banco))->>'saldo_atual_conta_cents')::bigint <> v_s_banco + 100000 THEN
    RAISE EXCEPTION 'FALHOU 4: estorno da transferência incompleto.';
  END IF;
  v_ok := FALSE;
  BEGIN PERFORM public.financeiro_estornar(v_saida, 'de novo'); EXCEPTION WHEN check_violation THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU 4b: estornou duas vezes.'; END IF;

  -- 5. Estorno do avulso; o estorno não se estorna
  v_json := public.financeiro_estornar(v_av, 'teste');
  v_ok := FALSE;
  BEGIN PERFORM public.financeiro_estornar((v_json->>'id')::uuid, 'x'); EXCEPTION WHEN check_violation THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU 5: estornou o estorno.'; END IF;

  -- 6. Movimento de venda não se estorna pelo extrato
  v_venda := public.venda_concluir(jsonb_build_object(
    'items', jsonb_build_array(jsonb_build_object('is_custom', true, 'kind', 'produto', 'name', 'ZZ Item extrato', 'quantity', 1, 'unit_price_cents', 800)),
    'payments', jsonb_build_array(jsonb_build_object('method', 'pix', 'amount_cents', 800, 'account_id', v_banco))));
  SELECT id INTO v_mov FROM public.financial_movements WHERE sale_id = v_venda LIMIT 1;
  v_ok := FALSE;
  BEGIN PERFORM public.financeiro_estornar(v_mov, 'x'); EXCEPTION WHEN check_violation THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU 6: estornou movimento de venda.'; END IF;
  v_json := public.movimentos_listar(jsonb_build_object('busca', 'zz receita'));
  IF (v_json->>'total')::int < 2 OR (v_json->>'saldo_liquido_cents')::bigint <> 0 THEN RAISE EXCEPTION 'FALHOU 6b: busca %', v_json->>'total'; END IF;
  v_json := public.movimentos_listar(jsonb_build_object('direcao', 'estornos', 'origem', 'transferencia', 'data_inicio', public.hoje_local()));
  IF (v_json->>'total')::int < 4 THEN RAISE EXCEPTION 'FALHOU 6c: filtro de estornos %', v_json->>'total'; END IF;

  -- 7. Quem é "caixa" não vê o extrato nem lança
  IF v_caixa_login IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_caixa_login, 'role', 'authenticated')::text, TRUE);
    PERFORM set_config('request.jwt.claim.sub', v_caixa_login::text, TRUE);
    v_ok := FALSE;
    BEGIN PERFORM public.movimentos_listar('{}'::jsonb); EXCEPTION WHEN insufficient_privilege THEN v_ok := TRUE; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU 7: nível caixa viu o extrato.'; END IF;
    v_ok := FALSE;
    BEGIN PERFORM public.financeiro_transferir(jsonb_build_object('from_account_id', v_banco, 'to_account_id', v_cx, 'amount_cents', 1));
    EXCEPTION WHEN insufficient_privilege THEN v_ok := TRUE; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU 7b: nível caixa transferiu.'; END IF;
    SELECT count(*) INTO v_n FROM public.financial_movements;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHOU 7c: nível caixa leu a tabela.'; END IF;
  END IF;

  RESET ROLE;
  IF has_function_privilege('anon', 'public.movimentos_listar(jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.financeiro_estornar(uuid, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.movimento_json(uuid, bigint)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.financeiro_conferir_conta(uuid, date, bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU 8: permissão sobrando.';
  END IF;

  PERFORM setval('public.sale_number_seq', v_seq, v_seq_chamado);
  RAISE EXCEPTION 'TUDO CERTO (o erro é de propósito: desfaz os testes).';
END $verificacao$;
