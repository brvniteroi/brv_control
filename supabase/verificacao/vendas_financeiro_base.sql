-- =====================================================================
-- Verificação das vendas e da base financeira (migration 20261125110000_vendas_financeiro_base.sql).
-- Colar no SQL Editor DEPOIS de aplicar a migration e clicar em Run. É UM bloco DO que DÁ ERRO DE PROPÓSITO
-- no fim para desfazer tudo (nada fica no banco):
--   * "TUDO CERTO ..." = passou em todas as verificações (o "erro" é só o desfazer).
--   * "FALHOU ..."     = alguma regra não funcionou (me mande o texto).
-- A numeração das vendas e dos orçamentos volta ao que era.
-- =====================================================================
DO $verificacao$
DECLARE
  v_braulio UUID := (SELECT id FROM public.profiles WHERE email = 'brvniteroi@gmail.com');
  v_tecnico UUID := (SELECT id FROM public.profiles WHERE role = 'tecnico' AND active LIMIT 1);
  v_seq_venda BIGINT; v_seq_venda_chamado BOOLEAN;
  v_seq_orc BIGINT; v_seq_orc_chamado BOOLEAN;
  v_cli UUID; v_cli2 UUID; v_end UUID; v_end2 UUID;
  v_orc UUID; v_v1 UUID; v_v2 UUID; v_v3 UUID;
  v_itaú UUID; v_caixa UUID; v_maq UUID;
  s public.sales%ROWTYPE;
  v_n BIGINT; v_n2 BIGINT; v_ok BOOLEAN; v_dia DATE; v_json JSONB; v_doc UUID;
  v_saldo_antes BIGINT; v_saldo_itau_antes BIGINT;
  v_log TEXT := '';
BEGIN
  SELECT last_value, is_called INTO v_seq_venda, v_seq_venda_chamado FROM public.sale_number_seq;
  SELECT last_value, is_called INTO v_seq_orc, v_seq_orc_chamado FROM public.quote_number_seq;

  -- Dados de teste (criados como dono do banco)
  INSERT INTO public.customers (person_type, name) VALUES ('PF', 'ZZ Cliente Teste Vendas') RETURNING id INTO v_cli;
  INSERT INTO public.customers (person_type, name) VALUES ('PF', 'ZZ Cliente Teste Vendas Duplicado') RETURNING id INTO v_cli2;
  INSERT INTO public.customer_addresses (customer_id, label, street, number, city, state, is_primary)
    VALUES (v_cli, 'Principal', 'Rua ZZ Um', '1', 'Niterói', 'RJ', TRUE) RETURNING id INTO v_end;
  INSERT INTO public.customer_addresses (customer_id, label, street, number, city, state, is_primary)
    VALUES (v_cli2, 'Principal', 'Avenida ZZ Dois', '999', 'Niterói', 'RJ', TRUE) RETURNING id INTO v_end2;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_braulio, 'role', 'authenticated')::text, TRUE);
  PERFORM set_config('request.jwt.claim.sub', v_braulio::text, TRUE);
  SET LOCAL ROLE authenticated;

  -- 1. Cadastros iniciais e taxa da maquininha
  SELECT id INTO v_caixa FROM public.financial_accounts WHERE name = 'Caixa BRV';
  SELECT id INTO v_itaú FROM public.financial_accounts WHERE name = 'Itaú';
  SELECT id INTO v_maq FROM public.card_machines WHERE name = 'Rede';
  IF v_caixa IS NULL OR v_itaú IS NULL OR v_maq IS NULL THEN RAISE EXCEPTION 'FALHOU: cadastros iniciais não criados'; END IF;
  UPDATE public.card_machines SET debit_fee_percent = 2, credit_sight_fee_percent = 3,
    credit_installment_rates = '[{"installments":2,"fee_percent":4},{"installments":6,"fee_percent":6}]'::jsonb WHERE id = v_maq;
  SELECT (x->>'current_balance_cents')::bigint INTO v_saldo_antes FROM jsonb_array_elements(public.financeiro_contas()) x WHERE x->>'id' = v_caixa::text;
  SELECT (x->>'current_balance_cents')::bigint INTO v_saldo_itau_antes FROM jsonb_array_elements(public.financeiro_contas()) x WHERE x->>'id' = v_itaú::text;
  v_log := v_log || E'\nOK  contas, maquininhas e categorias iniciais';

  -- 2. Orçamento com produto, serviço, desconto geral e frete vira venda: total igual, notas somam o total
  v_orc := public.orcamento_salvar(jsonb_build_object(
    'customer_id', v_cli, 'validity_days', 10, 'general_discount_cents', 1000, 'freight_cents', 2500,
    'items', jsonb_build_array(
      jsonb_build_object('is_custom', true, 'kind', 'produto', 'name', 'ZZ Tubo', 'quantity', 2, 'unit_price_cents', 5000, 'discount_mode', 'valor', 'discount_input', 0),
      jsonb_build_object('is_custom', true, 'kind', 'servico', 'name', 'ZZ M.O Instalação', 'quantity', 1, 'unit_price_cents', 59000, 'discount_mode', 'valor', 'discount_input', 0))));
  v_v1 := public.venda_concluir(jsonb_build_object(
    'quote_id', v_orc, 'customer_id', v_cli, 'general_discount_cents', 1000, 'freight_cents', 2500,
    'items', jsonb_build_array(
      jsonb_build_object('is_custom', true, 'kind', 'produto', 'name', 'ZZ Tubo', 'quantity', 2, 'unit_price_cents', 5000),
      jsonb_build_object('is_custom', true, 'kind', 'servico', 'name', 'ZZ M.O Instalação', 'quantity', 1, 'unit_price_cents', 59000)),
    'payments', jsonb_build_array(
      jsonb_build_object('method', 'dinheiro', 'amount_cents', 10000, 'tendered_cents', 15000),
      jsonb_build_object('method', 'credito', 'amount_cents', 30000, 'installments', 3, 'card_machine_id', v_maq))));
  SELECT * INTO s FROM public.sales WHERE id = v_v1;
  IF s.total_cents <> (SELECT total_cents FROM public.quotes WHERE id = v_orc) OR s.total_cents <> 70500 THEN
    RAISE EXCEPTION 'FALHOU: total da venda % diferente do orçamento', s.total_cents;
  END IF;
  SELECT sum(amount_cents) INTO v_n FROM public.sale_documents WHERE sale_id = v_v1;
  IF v_n <> s.total_cents OR (SELECT count(*) FROM public.sale_documents WHERE sale_id = v_v1) <> 2 THEN
    RAISE EXCEPTION 'FALHOU: as duas notas somam % e a venda %', v_n, s.total_cents;
  END IF;
  IF s.paid_cents <> 40000 OR s.change_cents <> 5000 OR s.address_id <> v_end OR s.origin_type <> 'orcamento' THEN
    RAISE EXCEPTION 'FALHOU: pago %, troco %, origem %', s.paid_cents, s.change_cents, s.origin_type;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quotes WHERE id = v_orc AND status = 'convertido' AND converted_sale_id = v_v1) THEN
    RAISE EXCEPTION 'FALHOU: o orçamento não ficou convertido';
  END IF;
  v_log := v_log || E'\nOK  orçamento vira venda com o mesmo total (com frete), duas notas somando o total e troco certo';

  -- 3. Cartão: bruto na conta da maquininha no dia útil seguinte + tarifa (3x usa a maior faixa menor ou igual: 6x=6% é a maior)
  v_dia := public.somar_dias_uteis(public.hoje_local(), 1);
  SELECT amount_cents INTO v_n FROM public.financial_movements WHERE sale_id = v_v1 AND origin_type = 'tarifa_cartao' AND occurred_date = v_dia;
  IF v_n IS DISTINCT FROM 1800 THEN RAISE EXCEPTION 'FALHOU: tarifa do cartão veio %', v_n; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.financial_movements WHERE sale_id = v_v1 AND method = 'credito' AND direction = 'entrada'
                  AND amount_cents = 30000 AND account_id = v_itaú AND occurred_date = v_dia) THEN
    RAISE EXCEPTION 'FALHOU: entrada bruta do cartão';
  END IF;
  IF extract(isodow FROM v_dia) > 5 OR public.somar_dias_uteis(DATE '2026-11-27', 1) <> DATE '2026-11-30' THEN
    RAISE EXCEPTION 'FALHOU: dia útil seguinte';
  END IF;
  SELECT (x->>'current_balance_cents')::bigint INTO v_n FROM jsonb_array_elements(public.financeiro_contas()) x WHERE x->>'id' = v_caixa::text;
  SELECT (x->>'current_balance_cents')::bigint INTO v_n2 FROM jsonb_array_elements(public.financeiro_contas()) x WHERE x->>'id' = v_itaú::text;
  IF v_n - v_saldo_antes <> 10000 OR v_n2 <> v_saldo_itau_antes THEN
    RAISE EXCEPTION 'FALHOU: saldo do caixa mudou % e o do banco % (cartão ainda não caiu)', v_n - v_saldo_antes, v_n2 - v_saldo_itau_antes;
  END IF;
  v_log := v_log || E'\nOK  cartão cai no dia útil seguinte com tarifa; saldo só conta o que já caiu';

  -- 4. Movimento não se altera nem se apaga; venda não se grava direto
  v_ok := FALSE;
  BEGIN UPDATE public.financial_movements SET amount_cents = 1 WHERE sale_id = v_v1; GET DIAGNOSTICS v_n = ROW_COUNT; v_ok := v_n = 0;
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: alterou um movimento'; END IF;
  v_ok := FALSE;
  BEGIN DELETE FROM public.financial_movements WHERE sale_id = v_v1; GET DIAGNOSTICS v_n = ROW_COUNT; v_ok := v_n = 0;
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: apagou um movimento'; END IF;
  UPDATE public.sales SET total_cents = 1 WHERE id = v_v1; GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 0 THEN RAISE EXCEPTION 'FALHOU: alterou a venda direto na tabela'; END IF;
  RESET ROLE;
  v_ok := FALSE;
  BEGIN UPDATE public.financial_movements SET amount_cents = 1 WHERE sale_id = v_v1;
  EXCEPTION WHEN check_violation THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: nem o dono do banco deveria alterar um movimento'; END IF;
  SET LOCAL ROLE authenticated;
  v_log := v_log || E'\nOK  movimento é imutável e a venda só muda pelas funções';

  -- 5. Receber o saldo; não passa do saldo; venda a receber exige cliente
  v_ok := FALSE;
  BEGIN PERFORM public.venda_receber(v_v1, jsonb_build_array(jsonb_build_object('method', 'pix', 'amount_cents', 99999, 'account_id', v_itaú)));
  EXCEPTION WHEN check_violation THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: recebeu acima do saldo'; END IF;
  PERFORM public.venda_receber(v_v1, jsonb_build_array(jsonb_build_object('method', 'pix', 'amount_cents', 30500, 'account_id', v_itaú)), public.hoje_local() - 1);
  SELECT * INTO s FROM public.sales WHERE id = v_v1;
  IF s.paid_cents <> 70500 THEN RAISE EXCEPTION 'FALHOU: saldo não quitado'; END IF;
  v_ok := FALSE;
  BEGIN PERFORM public.venda_concluir(jsonb_build_object('items', jsonb_build_array(
    jsonb_build_object('is_custom', true, 'kind', 'produto', 'name', 'ZZ Fita', 'quantity', 1, 'unit_price_cents', 600)), 'payments', '[]'::jsonb));
  EXCEPTION WHEN check_violation THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: consumidor final ficou devendo'; END IF;
  v_ok := FALSE;
  BEGIN PERFORM public.venda_concluir(jsonb_build_object('quote_id', v_orc, 'customer_id', v_cli, 'items', jsonb_build_array(
    jsonb_build_object('is_custom', true, 'kind', 'produto', 'name', 'ZZ Fita', 'quantity', 1, 'unit_price_cents', 600))));
  EXCEPTION WHEN check_violation THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: o mesmo orçamento virou venda duas vezes'; END IF;
  v_log := v_log || E'\nOK  saldo, consumidor final e orçamento convertido uma vez só';

  -- 6. Nota registrada trava o cancelamento; cancelada a nota, a venda cancela e os movimentos são estornados
  PERFORM public.venda_registrar_nota(v_v1, 'nfse', '12345');
  v_ok := FALSE;
  BEGIN PERFORM public.venda_cancelar(v_v1, 'teste');
  EXCEPTION WHEN check_violation THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: cancelou venda com nota emitida'; END IF;
  SELECT id INTO v_doc FROM public.sale_documents WHERE sale_id = v_v1 AND "group" = 'servicos';
  PERFORM public.venda_cancelar_nota(v_doc, 'teste');
  PERFORM public.venda_cancelar(v_v1, 'teste');
  SELECT sum(CASE WHEN direction = 'entrada' THEN amount_cents ELSE -amount_cents END), count(*) INTO v_n, v_n2
    FROM public.financial_movements WHERE sale_id = v_v1;
  IF v_n <> 0 OR v_n2 <> 8 THEN RAISE EXCEPTION 'FALHOU: estorno deixou saldo % em % movimentos', v_n, v_n2; END IF;
  v_json := public.venda_buscar(v_v1);
  IF v_json->>'status' <> 'cancelada' OR jsonb_array_length(v_json->'payments') <> 3 OR jsonb_array_length(v_json->'events') < 4 THEN
    RAISE EXCEPTION 'FALHOU: venda cancelada incompleta';
  END IF;
  v_log := v_log || E'\nOK  nota trava o cancelamento e o estorno zera os movimentos da venda';

  -- 7. Lista e filtro
  v_v2 := public.venda_concluir(jsonb_build_object('customer_id', v_cli2, 'items', jsonb_build_array(
    jsonb_build_object('is_custom', true, 'kind', 'produto', 'name', 'ZZ Disjuntor raro', 'quantity', 1, 'unit_price_cents', 6256))));
  v_json := public.vendas_listar(jsonb_build_object('busca', 'zz disjuntor raro', 'chip', 'a_receber',
    'data_inicio', public.hoje_local(), 'data_fim', public.hoje_local()));
  IF (v_json->>'total')::int <> 1 OR (v_json->>'soma_a_receber_cents')::int <> 6256 THEN
    RAISE EXCEPTION 'FALHOU: lista de vendas %', v_json - 'itens';
  END IF;
  v_log := v_log || E'\nOK  lista com busca, a receber e período';

  -- 8. Escritório sem nível financeiro: vende a receber, mas não recebe, não dá desconto alto, não cancela e não vê saldo
  RESET ROLE;
  UPDATE public.profiles SET role = 'escritorio', financial_access = 'nenhum' WHERE id = v_braulio;
  SET LOCAL ROLE authenticated;
  IF jsonb_array_length(public.financeiro_contas()) <> 0 OR EXISTS (SELECT 1 FROM public.financial_movements)
     OR EXISTS (SELECT 1 FROM public.financial_accounts) THEN
    RAISE EXCEPTION 'FALHOU: nível nenhum viu o financeiro';
  END IF;
  v_ok := FALSE;
  BEGIN PERFORM public.venda_receber(v_v2, jsonb_build_array(jsonb_build_object('method', 'pix', 'amount_cents', 100, 'account_id', v_itaú)));
  EXCEPTION WHEN insufficient_privilege THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: nível nenhum registrou pagamento'; END IF;
  v_ok := FALSE;
  BEGIN PERFORM public.venda_concluir(jsonb_build_object('customer_id', v_cli, 'general_discount_cents', 2000, 'items', jsonb_build_array(
    jsonb_build_object('is_custom', true, 'kind', 'produto', 'name', 'ZZ Item', 'quantity', 1, 'unit_price_cents', 10000))));
  EXCEPTION WHEN insufficient_privilege THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: desconto de 20%% passou sem acesso completo'; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', TRUE);
  PERFORM set_config('request.jwt.claim.sub', '', TRUE);
  UPDATE public.profiles SET financial_access = 'caixa' WHERE id = v_braulio;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_braulio, 'role', 'authenticated')::text, TRUE);
  PERFORM set_config('request.jwt.claim.sub', v_braulio::text, TRUE);
  SET LOCAL ROLE authenticated;
  PERFORM public.venda_receber(v_v2, jsonb_build_array(jsonb_build_object('method', 'dinheiro', 'amount_cents', 100)));
  IF EXISTS (SELECT 1 FROM public.financial_movements)
     OR (SELECT count(*) FROM jsonb_array_elements(public.financeiro_contas()) x WHERE (x->>'current_balance_cents')::bigint <> 0) > 0 THEN
    RAISE EXCEPTION 'FALHOU: nível caixa viu saldo ou extrato';
  END IF;
  v_ok := FALSE;
  BEGIN PERFORM public.venda_cancelar(v_v2, 'teste');
  EXCEPTION WHEN insufficient_privilege THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: nível caixa cancelou venda'; END IF;
  v_log := v_log || E'\nOK  níveis nenhum e caixa respeitados';

  -- 9. Técnico e anônimo não enxergam nada
  IF v_tecnico IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_tecnico, 'role', 'authenticated')::text, TRUE);
    PERFORM set_config('request.jwt.claim.sub', v_tecnico::text, TRUE);
    IF EXISTS (SELECT 1 FROM public.sales) OR EXISTS (SELECT 1 FROM public.sale_payments) THEN
      RAISE EXCEPTION 'FALHOU: técnico viu vendas';
    END IF;
    v_ok := FALSE;
    BEGIN PERFORM public.venda_buscar(v_v2);
    EXCEPTION WHEN insufficient_privilege THEN v_ok := TRUE; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: técnico abriu uma venda'; END IF;
  END IF;
  RESET ROLE;
  SET LOCAL ROLE anon;
  v_ok := FALSE;
  BEGIN PERFORM 1 FROM public.sales LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: anônimo acessou vendas'; END IF;
  v_ok := FALSE;
  BEGIN PERFORM public.financeiro_contas();
  EXCEPTION WHEN insufficient_privilege THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: anônimo chamou as contas'; END IF;
  RESET ROLE;
  v_log := v_log || E'\nOK  técnico e anônimo sem acesso';

  -- 10. Unir clientes leva orçamentos e vendas, com o endereço certo
  PERFORM set_config('request.jwt.claims', '', TRUE);
  PERFORM set_config('request.jwt.claim.sub', '', TRUE);
  PERFORM public.unir_clientes(v_cli, ARRAY[v_cli2], FALSE);
  IF EXISTS (SELECT 1 FROM public.customers WHERE id = v_cli2) THEN RAISE EXCEPTION 'FALHOU: duplicado não foi apagado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sales v JOIN public.customer_addresses a ON a.id = v.address_id
                  WHERE v.id = v_v2 AND v.customer_id = v_cli AND a.customer_id = v_cli AND a.street = 'Avenida ZZ Dois') THEN
    RAISE EXCEPTION 'FALHOU: a venda não acompanhou o cliente com o endereço certo';
  END IF;
  v_log := v_log || E'\nOK  unir clientes leva as vendas com o endereço';

  PERFORM setval('public.sale_number_seq', v_seq_venda, v_seq_venda_chamado);
  PERFORM setval('public.quote_number_seq', v_seq_orc, v_seq_orc_chamado);
  RAISE EXCEPTION 'TUDO CERTO (o erro é de propósito, para desfazer o teste):%', v_log;
END
$verificacao$;
