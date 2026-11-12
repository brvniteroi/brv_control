-- =====================================================================
-- Verificação de "Placa sem defeito" (migration 20261112100000_placas_sem_defeito.sql).
-- Colar no SQL Editor DEPOIS de aplicar a migration e clicar em Run. Mesmo esquema da verificação das placas:
-- é UM bloco DO que DÁ ERRO DE PROPÓSITO no fim para desfazer tudo (nada fica no banco).
--   * "TUDO CERTO ..." = passou em todas as verificações (o "erro" é só o desfazer).
--   * "FALHOU ..."     = alguma regra não funcionou (me mande o texto).
-- =====================================================================
DO $verificacao$
DECLARE
  v_braulio UUID := (SELECT id FROM public.profiles WHERE email = 'brvniteroi@gmail.com');
  v_cli UUID;
  v_a UUID; v_b UUID; v_c UUID; v_d UUID;
  v_st TEXT; v_flag BOOLEAN; v_qs TEXT;
  v_ok BOOLEAN;
  v_n BIGINT;
  v_log TEXT := '';
BEGIN
  IF v_braulio IS NULL THEN
    RAISE EXCEPTION 'Perfil do Braulio não encontrado: ajuste o e-mail no começo do script.';
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_braulio, 'role', 'authenticated')::text, TRUE);
  PERFORM set_config('request.jwt.claim.sub', v_braulio::text, TRUE);
  SET LOCAL ROLE authenticated;

  INSERT INTO public.board_clients (name, phone, kind, city) VALUES ('ZZ Teste Sem Defeito', '21999990000', 'instalador', 'Niterói') RETURNING id INTO v_cli;
  INSERT INTO public.board_orders (board_client_id, customer_kind, brand_model, board_code, reported_defect)
    VALUES (v_cli, 'instalador', 'Teste A', 'SD-A', 'Não liga') RETURNING id INTO v_a;
  INSERT INTO public.board_orders (board_client_id, customer_kind, brand_model, board_code, reported_defect)
    VALUES (v_cli, 'instalador', 'Teste B', 'SD-B', 'Não liga') RETURNING id INTO v_b;
  INSERT INTO public.board_orders (board_client_id, customer_kind, brand_model, board_code, reported_defect)
    VALUES (v_cli, 'instalador', 'Teste C', 'SD-C', 'Não liga') RETURNING id INTO v_c;
  INSERT INTO public.board_orders (board_client_id, customer_kind, brand_model, board_code, reported_defect)
    VALUES (v_cli, 'instalador', 'Teste D', 'SD-D', 'Não liga') RETURNING id INTO v_d;

  -- 1. Sem a marca, Entrada -> Pronto continua barrada (sem orçamento aprovado)
  v_ok := FALSE;
  BEGIN
    UPDATE public.board_orders SET status = 'pronto' WHERE id = v_a;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_ok := (v_n = 0);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: foi para Pronto sem a marca "sem defeito" e sem orçamento aprovado'; END IF;
  v_log := v_log || E'\nOK  sem a marca, Pronto segue exigindo orçamento aprovado';

  -- 2. Marca sem o valor da avaliação: barrado
  v_ok := FALSE;
  BEGIN
    UPDATE public.board_orders SET no_defect_found = TRUE, status = 'pronto' WHERE id = v_a;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_ok := (v_n = 0);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: marcou sem defeito sem informar o valor da avaliação'; END IF;
  v_log := v_log || E'\nOK  barrou "sem defeito" sem o valor da avaliação';

  -- 3. Marca com valor e Pronto: libera sem orçamento
  UPDATE public.board_orders SET no_defect_found = TRUE, status = 'pronto', quote_amount = 80 WHERE id = v_a;
  SELECT status, no_defect_found, quote_status INTO v_st, v_flag, v_qs FROM public.board_orders WHERE id = v_a;
  IF v_st <> 'pronto' OR NOT v_flag OR v_qs <> 'nao_feito' THEN
    RAISE EXCEPTION 'FALHOU: esperava pronto/marcada/orçamento não feito; veio % / % / %', v_st, v_flag, v_qs;
  END IF;
  v_log := v_log || E'\nOK  liberou em Pronto sem orçamento (valor 80), orçamento segue "não feito"';

  -- 4. Placa marcada pode ser entregue sem orçamento
  UPDATE public.board_orders SET status = 'entregue' WHERE id = v_a;
  SELECT status INTO v_st FROM public.board_orders WHERE id = v_a;
  IF v_st <> 'entregue' THEN RAISE EXCEPTION 'FALHOU: placa sem defeito não pôde ser entregue (status %)', v_st; END IF;
  v_log := v_log || E'\nOK  placa sem defeito foi entregue sem aprovação de orçamento';

  -- 5. Marca sem ir para Pronto (ficando na Entrada): barrado
  v_ok := FALSE;
  BEGIN
    UPDATE public.board_orders SET no_defect_found = TRUE, quote_amount = 80 WHERE id = v_b;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_ok := (v_n = 0);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: marcou sem defeito sem mandar para Pronto'; END IF;
  v_log := v_log || E'\nOK  barrou a marca sem mudar para Pronto';

  -- 6. Marca indo para Em Reparo: barrado (a marca só dispensa Pronto/Entregue)
  v_ok := FALSE;
  BEGIN
    UPDATE public.board_orders SET no_defect_found = TRUE, quote_amount = 80, status = 'em_reparo' WHERE id = v_b;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_ok := (v_n = 0);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: a marca "sem defeito" liberou Em Reparo sem aprovação'; END IF;
  v_log := v_log || E'\nOK  a marca não libera Em Reparo sem aprovação';

  -- 7. Placa marcada em Pronto tentando ir para Em Reparo: barrado
  UPDATE public.board_orders SET no_defect_found = TRUE, status = 'pronto', quote_amount = 80 WHERE id = v_c;
  v_ok := FALSE;
  BEGIN
    UPDATE public.board_orders SET status = 'em_reparo' WHERE id = v_c;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_ok := (v_n = 0);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: placa sem defeito foi de Pronto para Em Reparo sem aprovação'; END IF;
  v_log := v_log || E'\nOK  placa sem defeito em Pronto não vai para Em Reparo sem aprovação';

  -- 8. Voltar para Diagnóstico limpa a marca
  UPDATE public.board_orders SET status = 'diagnostico' WHERE id = v_c;
  SELECT no_defect_found INTO v_flag FROM public.board_orders WHERE id = v_c;
  IF v_flag THEN RAISE EXCEPTION 'FALHOU: voltou para Diagnóstico e a marca "sem defeito" continuou'; END IF;
  v_log := v_log || E'\nOK  voltar para o Diagnóstico limpa a marca';

  -- 9. Marca depois de já ter saído da Entrada/Diagnóstico (Aguardando peça) não existe; testa Pronto -> marca
  --    (placa D em Entrada, vai a Diagnóstico e marca: deve poder)
  UPDATE public.board_orders SET status = 'diagnostico' WHERE id = v_d;
  UPDATE public.board_orders SET no_defect_found = TRUE, status = 'pronto', quote_amount = 120 WHERE id = v_d;
  SELECT status, no_defect_found INTO v_st, v_flag FROM public.board_orders WHERE id = v_d;
  IF v_st <> 'pronto' OR NOT v_flag THEN RAISE EXCEPTION 'FALHOU: a partir do Diagnóstico não liberou em Pronto'; END IF;
  v_log := v_log || E'\nOK  a partir do Diagnóstico também libera em Pronto';

  -- 10. Histórico registrou a mudança de etapa
  IF (SELECT count(*) FROM public.board_events WHERE board_order_id = v_d AND event_type = 'mudanca_etapa' AND to_stage = 'pronto') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: faltou o evento de mudança de etapa para Pronto no histórico';
  END IF;
  v_log := v_log || E'\nOK  histórico registrou a mudança para Pronto';

  RAISE EXCEPTION 'TUDO CERTO (o erro é só para desfazer o teste):%', v_log;
END
$verificacao$;
