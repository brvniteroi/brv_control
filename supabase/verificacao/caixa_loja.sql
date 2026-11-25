-- =====================================================================
-- Verificação do caixa da loja (migration 20261125130000_caixa_loja.sql).
-- Colar no SQL Editor DEPOIS de aplicar a migration e clicar em Run. É UM bloco DO que DÁ ERRO DE PROPÓSITO
-- no fim para desfazer tudo (nada fica no banco):
--   * "TUDO CERTO ..." = passou em todas as verificações (o "erro" é só o desfazer).
--   * "FALHOU ..."     = alguma regra não funcionou (me mande o texto).
-- Precisa estar com o caixa FECHADO. A numeração das vendas volta ao que era.
-- =====================================================================
DO $verificacao$
DECLARE
  v_braulio UUID := (SELECT id FROM public.profiles WHERE email = 'brvniteroi@gmail.com');
  v_tecnico UUID := (SELECT id FROM public.profiles WHERE role = 'tecnico' AND active LIMIT 1);
  v_seq BIGINT; v_seq_chamado BOOLEAN;
  v_conta UUID; v_venda UUID; v_antiga UUID;
  v_json JSONB; v_sessao UUID; v_saldo BIGINT; v_n BIGINT; v_ok BOOLEAN;
  v_primeira BOOLEAN;
BEGIN
  IF EXISTS (SELECT 1 FROM public.cash_sessions WHERE status = 'aberto') THEN
    RAISE EXCEPTION 'FALHOU 0: feche o caixa antes de rodar a verificação.';
  END IF;
  SELECT last_value, is_called INTO v_seq, v_seq_chamado FROM public.sale_number_seq;
  SELECT id INTO v_conta FROM public.financial_accounts WHERE active AND kind = 'caixa' ORDER BY sort_order, name LIMIT 1;
  v_primeira := NOT EXISTS (SELECT 1 FROM public.cash_sessions);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_braulio, 'role', 'authenticated')::text, TRUE);
  PERFORM set_config('request.jwt.claim.sub', v_braulio::text, TRUE);
  SET LOCAL ROLE authenticated;

  -- 1. Abertura: diferença sem motivo só passa na primeira vez
  v_saldo := (public.caixa_situacao()->>'esperado_abertura_cents')::bigint;
  IF NOT v_primeira THEN
    v_ok := FALSE;
    BEGIN PERFORM public.caixa_abrir(v_saldo + 20000); EXCEPTION WHEN check_violation THEN v_ok := TRUE; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU 1: abriu com diferença sem motivo.'; END IF;
  END IF;
  v_json := public.caixa_abrir(v_saldo + 20000, 'teste');
  v_sessao := (v_json->>'id')::uuid;
  IF (v_json->>'opening_balance_cents')::bigint <> v_saldo + 20000 OR jsonb_array_length(v_json->'entries') <> 0 THEN
    RAISE EXCEPTION 'FALHOU 1b: abertura errada %', v_json;
  END IF;
  SELECT (x->>'current_balance_cents')::bigint INTO v_n FROM jsonb_array_elements(public.financeiro_contas()) x WHERE x->>'id' = v_conta::text;
  IF v_n <> v_saldo + 20000 THEN RAISE EXCEPTION 'FALHOU 1c: saldo da conta (%) diferente da gaveta (%).', v_n, v_saldo + 20000; END IF;

  -- 2. Não abre dois
  v_ok := FALSE;
  BEGIN PERFORM public.caixa_abrir(0, 'outro'); EXCEPTION WHEN check_violation THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU 2: abriu o segundo caixa.'; END IF;

  -- 3. Venda em dinheiro com troco entra sozinha no caixa (só o valor da venda)
  v_venda := public.venda_concluir(jsonb_build_object(
    'items', jsonb_build_array(jsonb_build_object('is_custom', true, 'kind', 'produto', 'name', 'ZZ Item caixa', 'quantity', 1, 'unit_price_cents', 4500)),
    'payments', jsonb_build_array(jsonb_build_object('method', 'dinheiro', 'amount_cents', 4500, 'tendered_cents', 5000))));
  v_json := public.caixa_situacao()->'sessao';
  IF (v_json->>'entries_in_cents')::bigint <> 4500 OR v_json->'entries'->0->>'kind' <> 'venda_dinheiro' THEN
    RAISE EXCEPTION 'FALHOU 3: venda em dinheiro não entrou no caixa %', v_json;
  END IF;

  -- 4. PIX não entra
  PERFORM public.venda_concluir(jsonb_build_object(
    'items', jsonb_build_array(jsonb_build_object('is_custom', true, 'kind', 'produto', 'name', 'ZZ Item pix', 'quantity', 1, 'unit_price_cents', 700)),
    'payments', jsonb_build_array(jsonb_build_object('method', 'pix', 'amount_cents', 700,
      'account_id', (SELECT x->>'id' FROM jsonb_array_elements(public.financeiro_contas()) x WHERE x->>'kind' = 'banco' LIMIT 1)))));
  IF (public.caixa_situacao()->'sessao'->>'entries_in_cents')::bigint <> 4500 THEN RAISE EXCEPTION 'FALHOU 4: PIX entrou no caixa.'; END IF;

  -- 5. Reforço, retirada e retirada maior que a gaveta
  PERFORM public.caixa_lancar('reforco', 1000, 'troco');
  PERFORM public.caixa_lancar('sangria', 3000, 'depósito');
  v_ok := FALSE;
  BEGIN PERFORM public.caixa_lancar('sangria', 999999999, 'demais'); EXCEPTION WHEN check_violation THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU 5: retirou mais do que havia.'; END IF;
  v_ok := FALSE;
  BEGIN PERFORM public.caixa_lancar('reforco', 100, '  '); EXCEPTION WHEN check_violation THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU 5b: lançou sem motivo.'; END IF;

  -- 6. Cancelar a venda tira o dinheiro do caixa como estorno
  PERFORM public.venda_cancelar(v_venda, 'teste de caixa');
  v_json := public.caixa_situacao()->'sessao';
  IF (v_json->>'expected_balance_cents')::bigint <> v_saldo + 20000 + 4500 + 1000 - 3000 - 4500 THEN
    RAISE EXCEPTION 'FALHOU 6: saldo esperado errado %', v_json->>'expected_balance_cents';
  END IF;
  SELECT count(*) INTO v_n FROM jsonb_array_elements(v_json->'entries') x WHERE x->>'kind' = 'estorno';
  IF v_n <> 1 THEN RAISE EXCEPTION 'FALHOU 6b: estorno não apareceu.'; END IF;

  -- 7. Recebimento com data de ontem não entra no caixa aberto hoje
  v_antiga := public.venda_concluir(jsonb_build_object('customer_id', (SELECT id FROM public.customers WHERE active LIMIT 1),
    'items', jsonb_build_array(jsonb_build_object('is_custom', true, 'kind', 'produto', 'name', 'ZZ Item ontem', 'quantity', 1, 'unit_price_cents', 900))));
  PERFORM public.venda_receber(v_antiga, jsonb_build_array(jsonb_build_object('method', 'dinheiro', 'amount_cents', 900)), public.hoje_local() - 1);
  IF (public.caixa_situacao()->'sessao'->>'entries_in_cents')::bigint <> 5500 THEN
    RAISE EXCEPTION 'FALHOU 7: recebimento de ontem entrou no caixa.';
  END IF;

  -- 8. Fechamento com falta exige justificativa; o saldo da conta passa a ser o contado
  v_n := (public.caixa_situacao()->'sessao'->>'expected_balance_cents')::bigint;
  v_ok := FALSE;
  BEGIN PERFORM public.caixa_fechar(v_sessao, v_n - 150); EXCEPTION WHEN check_violation THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU 8: fechou com diferença sem justificativa.'; END IF;
  v_json := public.caixa_fechar(v_sessao, v_n - 150, 'falta de teste');
  IF v_json->>'status' <> 'fechado' OR (v_json->>'difference_cents')::bigint <> -150
     OR (v_json->>'expected_balance_cents')::bigint <> v_n THEN
    RAISE EXCEPTION 'FALHOU 8b: fechamento errado %', v_json;
  END IF;
  -- (o recebimento de ontem está no saldo da conta, mas não na gaveta contada)
  IF (public.caixa_situacao()->>'esperado_abertura_cents')::bigint <> v_n - 150 + 900 THEN
    RAISE EXCEPTION 'FALHOU 8c: esperado na próxima abertura %', public.caixa_situacao()->>'esperado_abertura_cents';
  END IF;
  IF jsonb_array_length(public.caixa_fechamentos()) < 1 THEN RAISE EXCEPTION 'FALHOU 8d: sem histórico.'; END IF;
  v_ok := FALSE;
  BEGIN PERFORM public.caixa_fechar(v_sessao, v_n); EXCEPTION WHEN check_violation THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU 8e: fechou duas vezes.'; END IF;
  v_ok := FALSE;
  BEGIN PERFORM public.caixa_lancar('reforco', 100, 'fechado'); EXCEPTION WHEN check_violation THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU 8f: lançou com o caixa fechado.'; END IF;

  -- 9. Ninguém escreve direto na tabela, e técnico não entra
  v_ok := FALSE;
  BEGIN
    UPDATE public.cash_sessions SET counted_balance_cents = 0 WHERE id = v_sessao;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_ok := v_n = 0;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU 9: alterou o caixa direto.'; END IF;
  IF v_tecnico IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_tecnico, 'role', 'authenticated')::text, TRUE);
    PERFORM set_config('request.jwt.claim.sub', v_tecnico::text, TRUE);
    v_ok := FALSE;
    BEGIN PERFORM public.caixa_situacao(); EXCEPTION WHEN insufficient_privilege THEN v_ok := TRUE; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU 9b: técnico viu o caixa.'; END IF;
    SELECT count(*) INTO v_n FROM public.cash_sessions;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHOU 9c: técnico leu a tabela do caixa.'; END IF;
  END IF;

  RESET ROLE;
  IF has_function_privilege('anon', 'public.caixa_situacao()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.caixa_abrir(bigint, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.caixa_movimento(uuid, text, bigint, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.caixa_sessao_json(uuid, boolean)', 'EXECUTE')
     OR has_table_privilege('anon', 'public.cash_sessions', 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU 10: permissão sobrando.';
  END IF;

  PERFORM setval('public.sale_number_seq', v_seq, v_seq_chamado);
  RAISE EXCEPTION 'TUDO CERTO (o erro é de propósito: desfaz os testes).';
END $verificacao$;
