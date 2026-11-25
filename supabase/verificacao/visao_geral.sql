-- =====================================================================
-- Verificação da visão geral (migration 20261125150000_visao_geral.sql).
-- Colar no SQL Editor DEPOIS de aplicar a migration e clicar em Run. É UM bloco DO que DÁ ERRO DE PROPÓSITO
-- no fim para desfazer tudo (nada fica no banco):
--   * "TUDO CERTO ..." = passou em todas as verificações (o "erro" é só o desfazer).
--   * "FALHOU ..."     = alguma regra não funcionou (me mande o texto).
-- A numeração das vendas volta ao que era.
-- =====================================================================
DO $verificacao$
DECLARE
  v_braulio UUID := (SELECT id FROM public.profiles WHERE email = 'brvniteroi@gmail.com');
  v_caixa_login UUID := (SELECT id FROM public.profiles WHERE role = 'escritorio' AND active AND financial_access = 'caixa' LIMIT 1);
  v_tecnico UUID := (SELECT id FROM public.profiles WHERE role = 'tecnico' AND active LIMIT 1);
  v_seq BIGINT; v_seq_chamado BOOLEAN;
  v_banco UUID; v_receita UUID; v_maq UUID; v_cli UUID;
  a JSONB; d JSONB; v_cartao UUID; v_av UUID; v_ok BOOLEAN;
BEGIN
  SELECT last_value, is_called INTO v_seq, v_seq_chamado FROM public.sale_number_seq;
  SELECT id INTO v_cli FROM public.customers WHERE active LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_braulio, 'role', 'authenticated')::text, TRUE);
  PERFORM set_config('request.jwt.claim.sub', v_braulio::text, TRUE);
  SET LOCAL ROLE authenticated;

  SELECT id INTO v_banco FROM public.financial_accounts WHERE active AND kind = 'banco' ORDER BY sort_order LIMIT 1;
  SELECT id INTO v_receita FROM public.financial_categories WHERE active AND kind = 'receita' LIMIT 1;
  SELECT id INTO v_maq FROM public.card_machines WHERE active LIMIT 1;
  UPDATE public.card_machines SET debit_fee_percent = 2 WHERE id = v_maq;
  a := public.financeiro_resumo();
  IF jsonb_array_length(a->'daily_received_30d') <> 30 THEN RAISE EXCEPTION 'FALHOU 1: gráfico sem 30 dias.'; END IF;
  IF jsonb_array_length(a->'accounts') < 1 THEN RAISE EXCEPTION 'FALHOU 1b: sem contas.'; END IF;

  -- 2. Cartão de hoje conta como recebido hoje, mesmo caindo depois; e aparece em "a cair" com a tarifa
  v_cartao := public.venda_concluir(jsonb_build_object(
    'items', jsonb_build_array(jsonb_build_object('is_custom', true, 'kind', 'produto', 'name', 'ZZ cartão', 'quantity', 1, 'unit_price_cents', 10000)),
    'payments', jsonb_build_array(jsonb_build_object('method', 'debito', 'amount_cents', 10000, 'card_machine_id', v_maq))));
  d := public.financeiro_resumo();
  IF (d->>'received_today_cents')::bigint - (a->>'received_today_cents')::bigint <> 10000
     OR (d->>'received_month_cents')::bigint - (a->>'received_month_cents')::bigint <> 10000
     OR (d->'daily_received_30d'->29->>'amount_cents')::bigint - (a->'daily_received_30d'->29->>'amount_cents')::bigint <> 10000 THEN
    RAISE EXCEPTION 'FALHOU 2: cartão de hoje não contou como recebido.';
  END IF;
  IF (SELECT coalesce(sum((x->>'pending_net_cents')::bigint), 0) FROM jsonb_array_elements(d->'pending_machines') x)
     - (SELECT coalesce(sum((x->>'pending_net_cents')::bigint), 0) FROM jsonb_array_elements(a->'pending_machines') x) <> 9800 THEN
    RAISE EXCEPTION 'FALHOU 2b: cartão a cair errado %', d->'pending_machines';
  END IF;
  IF d->>'total_accounts_balance_cents' <> a->>'total_accounts_balance_cents' THEN
    RAISE EXCEPTION 'FALHOU 2c: cartão ainda não caído entrou no saldo.';
  END IF;

  -- 3. Cancelada some do recebido e do a cair
  PERFORM public.venda_cancelar(v_cartao, 'teste');
  d := public.financeiro_resumo();
  IF d->>'received_today_cents' <> a->>'received_today_cents' OR d->'pending_machines' <> a->'pending_machines' THEN
    RAISE EXCEPTION 'FALHOU 3: venda cancelada continuou no resumo.';
  END IF;

  -- 4. Receita avulsa conta; estornada e transferência não
  v_av := (public.financeiro_lancar_avulso(jsonb_build_object('direction', 'entrada', 'account_id', v_banco, 'category_id', v_receita,
             'method', 'pix', 'amount_cents', 5000, 'description', 'ZZ avulso'))->>'id')::uuid;
  d := public.financeiro_resumo();
  IF (d->>'received_today_cents')::bigint - (a->>'received_today_cents')::bigint <> 5000 THEN RAISE EXCEPTION 'FALHOU 4: avulso não contou.'; END IF;
  PERFORM public.financeiro_estornar(v_av, 'teste');
  PERFORM public.financeiro_transferir(jsonb_build_object('from_account_id', v_banco, 'amount_cents', 100,
            'to_account_id', (SELECT id FROM public.financial_accounts WHERE active AND kind = 'banco' AND id <> v_banco LIMIT 1)));
  d := public.financeiro_resumo();
  IF d->>'received_today_cents' <> a->>'received_today_cents' THEN RAISE EXCEPTION 'FALHOU 4b: estorno ou transferência contou como recebido.'; END IF;

  -- 5. Venda a receber aparece
  PERFORM public.venda_concluir(jsonb_build_object('customer_id', v_cli,
    'items', jsonb_build_array(jsonb_build_object('is_custom', true, 'kind', 'servico', 'name', 'ZZ a receber', 'quantity', 1, 'unit_price_cents', 7000))));
  d := public.financeiro_resumo();
  IF (d->>'open_sales_count')::int - (a->>'open_sales_count')::int <> 1
     OR (d->>'open_sales_total_cents')::bigint - (a->>'open_sales_total_cents')::bigint <> 7000
     OR jsonb_array_length(d->'open_sales_oldest') < 1 THEN
    RAISE EXCEPTION 'FALHOU 5: venda a receber.';
  END IF;

  -- 6. Nível caixa: sem saldos, período, gráfico nem cartão a cair
  IF v_caixa_login IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_caixa_login, 'role', 'authenticated')::text, TRUE);
    PERFORM set_config('request.jwt.claim.sub', v_caixa_login::text, TRUE);
    d := public.financeiro_resumo();
    IF d->'accounts' <> '[]'::jsonb OR (d->>'total_accounts_balance_cents')::bigint <> 0 OR (d->>'received_month_cents')::bigint <> 0
       OR d->'pending_machines' <> '[]'::jsonb OR d->'daily_received_30d' <> '[]'::jsonb THEN
      RAISE EXCEPTION 'FALHOU 6: nível caixa recebeu dado do completo.';
    END IF;
  END IF;
  IF v_tecnico IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_tecnico, 'role', 'authenticated')::text, TRUE);
    PERFORM set_config('request.jwt.claim.sub', v_tecnico::text, TRUE);
    v_ok := FALSE;
    BEGIN PERFORM public.financeiro_resumo(); EXCEPTION WHEN insufficient_privilege THEN v_ok := TRUE; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU 6b: técnico viu o resumo.'; END IF;
  END IF;

  RESET ROLE;
  IF has_function_privilege('anon', 'public.financeiro_resumo(date, date)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.financeiro_recebidos(date, date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU 7: permissão sobrando.';
  END IF;

  PERFORM setval('public.sale_number_seq', v_seq, v_seq_chamado);
  RAISE EXCEPTION 'TUDO CERTO (o erro é de propósito: desfaz os testes).';
END $verificacao$;
