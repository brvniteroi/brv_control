-- =====================================================================
-- Verificação do banco das placas (migration 20261110100000_placas_base.sql).
-- Colar no SQL Editor DEPOIS de aplicar a migration e clicar em Run.
--
-- É UM comando só (um bloco DO), então roda inteiro ou não roda, e no fim ele DÁ ERRO DE PROPÓSITO
-- para desfazer tudo o que o teste gravou (nada fica no banco). Como ler o resultado:
--   * Mensagem de erro começando com "TUDO CERTO"  = passou em todas as verificações (o "erro" é só o desfazer).
--   * Mensagem começando com "FALHOU"               = alguma regra do banco não funcionou (me mande o texto).
--   * Qualquer outro erro                           = problema no teste ou na migration (me mande o texto).
--
-- Usa os logins reais só para o banco enxergar o papel: Braulio (admin com a marca do financeiro),
-- Adriana (admin sem a marca) e Pedro (escritório). Se algum e-mail mudou, ajuste abaixo.
-- =====================================================================
DO $verificacao$
DECLARE
  v_braulio UUID := (SELECT id FROM public.profiles WHERE email = 'brvniteroi@gmail.com');
  v_adriana UUID := (SELECT id FROM public.profiles WHERE email = 'brvloja@brvniteroi.com.br');
  v_pedro UUID := (SELECT id FROM public.profiles WHERE email = 'pedro.lv@brvniteroi.com.br');
  v_gustavo UUID := (SELECT id FROM public.profiles WHERE role = 'oficina' AND active LIMIT 1);
  v_tecnico UUID := (SELECT id FROM public.profiles WHERE role = 'tecnico' AND active LIMIT 1);
  v_cli UUID;
  v_placa UUID;
  v_num TEXT;
  v_num2 TEXT;
  v_tok TEXT;
  v_json JSONB;
  v_n BIGINT;
  v_ok BOOLEAN;
  v_log TEXT := '';
BEGIN
  IF v_braulio IS NULL OR v_adriana IS NULL OR v_pedro IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado (Braulio, Adriana ou Pedro): ajuste os e-mails no começo do script.';
  END IF;

  -- ===== 1. Braulio cria cliente e placa de balcão =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_braulio, 'role', 'authenticated')::text, TRUE);
  PERFORM set_config('request.jwt.claim.sub', v_braulio::text, TRUE);
  SET LOCAL ROLE authenticated;

  INSERT INTO public.board_clients (name, phone, kind, city) VALUES ('ZZ Parceiro Teste', '21999990000', 'instalador', 'Niterói') RETURNING id INTO v_cli;
  INSERT INTO public.board_orders (board_client_id, customer_kind, brand_model, board_code, reported_defect)
  VALUES (v_cli, 'instalador', 'Midea Teste 12000', 'CE-TESTE-1', 'Não liga') RETURNING id, board_number INTO v_placa, v_num;
  IF v_num !~ '^OS-[0-9]{6}-[0-9]{3}$' THEN RAISE EXCEPTION 'FALHOU: número fora do formato: %', v_num; END IF;
  IF (SELECT count(*) FROM public.board_events WHERE board_order_id = v_placa AND event_type = 'entrada') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: faltou o evento de entrada no histórico';
  END IF;
  v_log := v_log || E'\nOK  placa criada com número ' || v_num || ' e histórico de entrada';

  -- ===== 2. Segunda placa: sequência do dia =====
  INSERT INTO public.board_orders (board_client_id, customer_kind, brand_model, board_code, reported_defect)
  VALUES (v_cli, 'instalador', 'LG Teste', 'LG-2', 'Erro CH05') RETURNING board_number INTO v_num2;
  IF right(v_num2, 3)::int <> right(v_num, 3)::int + 1 THEN RAISE EXCEPTION 'FALHOU: sequência % depois de %', v_num2, v_num; END IF;
  v_log := v_log || E'\nOK  sequência do dia: ' || v_num2 || ' depois de ' || v_num;

  -- ===== 3. Regras de etapa e orçamento =====
  v_ok := FALSE;
  BEGIN
    UPDATE public.board_orders SET status = 'em_reparo' WHERE id = v_placa;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_ok := (v_n = 0);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: foi para Em Reparo sem orçamento aprovado'; END IF;
  v_log := v_log || E'\nOK  barrou Em Reparo sem orçamento aprovado';

  v_ok := FALSE;
  BEGIN
    UPDATE public.board_orders SET quote_status = 'enviado' WHERE id = v_placa;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_ok := (v_n = 0);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: enviou orçamento sem valor e parecer'; END IF;
  v_log := v_log || E'\nOK  barrou envio de orçamento sem valor e parecer';

  v_ok := FALSE;
  BEGIN
    UPDATE public.board_orders SET board_number = 'OS-000000-000' WHERE id = v_placa;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_ok := (v_n = 0);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: mudou o número da placa'; END IF;
  v_log := v_log || E'\nOK  barrou mudança do número da placa';

  UPDATE public.board_orders SET quote_amount = 350, quote_technical_opinion = 'Trocar IPM' WHERE id = v_placa;
  UPDATE public.board_orders SET quote_status = 'enviado' WHERE id = v_placa;

  v_ok := FALSE;
  BEGIN
    UPDATE public.board_orders SET quote_status = 'aprovado' WHERE id = v_placa;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_ok := (v_n = 0);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: aprovou sem informar o canal da resposta'; END IF;
  v_log := v_log || E'\nOK  barrou aprovação sem canal da resposta';

  UPDATE public.board_orders SET quote_status = 'aprovado', quote_response_channel = 'whatsapp' WHERE id = v_placa;
  IF (SELECT quote_responded_by FROM public.board_orders WHERE id = v_placa) IS NULL THEN RAISE EXCEPTION 'FALHOU: faltou quem respondeu'; END IF;
  UPDATE public.board_orders SET status = 'aguardando_peca' WHERE id = v_placa;
  UPDATE public.board_orders SET status = 'em_reparo' WHERE id = v_placa;
  UPDATE public.board_orders SET status = 'teste' WHERE id = v_placa;

  v_ok := FALSE;
  BEGIN
    UPDATE public.board_orders SET status = 'entregue' WHERE id = v_placa;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_ok := (v_n = 0);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: entregou sem passar por Pronto'; END IF;
  v_log := v_log || E'\nOK  barrou Entregue sem passar por Pronto';

  UPDATE public.board_orders SET status = 'pronto' WHERE id = v_placa;

  v_ok := FALSE;
  BEGIN
    UPDATE public.board_orders SET status = 'sem_conserto' WHERE id = v_placa;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_ok := (v_n = 0);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: finalizou sem conserto sem informar o motivo'; END IF;
  v_log := v_log || E'\nOK  barrou Sem Conserto sem motivo';

  UPDATE public.board_orders SET status = 'entregue' WHERE id = v_placa;
  IF (SELECT finished_at FROM public.board_orders WHERE id = v_placa) IS NULL THEN RAISE EXCEPTION 'FALHOU: faltou a data de saída'; END IF;
  v_log := v_log || E'\nOK  fluxo completo: orçamento, aprovação e etapas até Entregue, com data de saída';

  -- ===== 4. Financeiro: Braulio grava e vê =====
  INSERT INTO public.board_finance (board_order_id, charged_amount) VALUES (v_placa, 350);
  UPDATE public.board_finance SET refunded = TRUE, refund_amount = 350, refunded_at = CURRENT_DATE, refund_reason = 'Teste' WHERE board_order_id = v_placa;
  IF NOT public.tem_financeiro_placas() THEN RAISE EXCEPTION 'FALHOU: Braulio devia ter acesso ao financeiro das placas'; END IF;
  IF (SELECT count(*) FROM public.board_events WHERE board_order_id = v_placa AND visibility = 'financeiro') < 2 THEN
    RAISE EXCEPTION 'FALHOU: faltaram eventos financeiros no histórico';
  END IF;
  v_log := v_log || E'\nOK  Braulio grava e vê o financeiro (valor cobrado e reembolso, com histórico)';
  RESET ROLE;

  -- ===== 5. Adriana (admin sem a marca): vê a placa, não vê o financeiro, não se promove =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_adriana, 'role', 'authenticated')::text, TRUE);
  PERFORM set_config('request.jwt.claim.sub', v_adriana::text, TRUE);
  SET LOCAL ROLE authenticated;

  IF public.tem_financeiro_placas() THEN RAISE EXCEPTION 'FALHOU: Adriana não devia ter o financeiro das placas'; END IF;
  IF (SELECT count(*) FROM public.board_finance) <> 0 THEN RAISE EXCEPTION 'FALHOU: Adriana enxergou linhas do financeiro'; END IF;
  IF (SELECT count(*) FROM public.board_events WHERE board_order_id = v_placa AND visibility = 'financeiro') <> 0 THEN
    RAISE EXCEPTION 'FALHOU: Adriana enxergou eventos financeiros';
  END IF;
  IF (SELECT count(*) FROM public.board_orders WHERE id = v_placa) <> 1 THEN RAISE EXCEPTION 'FALHOU: Adriana devia ver a placa'; END IF;
  v_log := v_log || E'\nOK  Adriana vê a placa e o orçamento, mas não o financeiro';

  v_ok := FALSE;
  BEGIN
    INSERT INTO public.board_finance (board_order_id, charged_amount) VALUES (v_placa, 1);
    v_ok := FALSE;
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: Adriana gravou no financeiro'; END IF;
  v_log := v_log || E'\nOK  barrou Adriana gravar no financeiro';

  v_ok := FALSE;
  BEGIN
    UPDATE public.profiles SET board_finance_access = TRUE WHERE id = v_adriana;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_ok := (v_n = 0);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: Adriana deu a si mesma o acesso ao financeiro'; END IF;
  v_log := v_log || E'\nOK  barrou Adriana dar a si mesma o acesso ao financeiro';

  v_ok := FALSE;
  BEGIN
    UPDATE public.board_orders SET technical_diagnosis = 'mudei' WHERE id = v_placa;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_ok := (v_n = 0);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: editou placa finalizada'; END IF;
  v_log := v_log || E'\nOK  barrou edição de placa finalizada';
  RESET ROLE;

  -- ===== 6. Pedro (escritório): não reabre nem exclui =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_pedro, 'role', 'authenticated')::text, TRUE);
  PERFORM set_config('request.jwt.claim.sub', v_pedro::text, TRUE);
  SET LOCAL ROLE authenticated;

  v_ok := FALSE;
  BEGIN
    UPDATE public.board_orders SET status = 'pronto' WHERE id = v_placa;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_ok := (v_n = 0);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: escritório reabriu placa finalizada'; END IF;
  v_log := v_log || E'\nOK  barrou escritório reabrir placa finalizada';

  v_ok := FALSE;
  BEGIN
    DELETE FROM public.board_orders WHERE id = v_placa;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_ok := (v_n = 0);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: escritório excluiu placa'; END IF;
  v_log := v_log || E'\nOK  barrou escritório excluir placa (só admin)';
  RESET ROLE;

  -- ===== 7. Braulio (admin) reabre; histórico só aceita nota =====
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_braulio, 'role', 'authenticated')::text, TRUE);
  PERFORM set_config('request.jwt.claim.sub', v_braulio::text, TRUE);
  SET LOCAL ROLE authenticated;

  UPDATE public.board_orders SET status = 'pronto' WHERE id = v_placa;
  IF (SELECT finished_at FROM public.board_orders WHERE id = v_placa) IS NOT NULL THEN RAISE EXCEPTION 'FALHOU: reabrir devia limpar a data de saída'; END IF;
  v_log := v_log || E'\nOK  administrador reabriu a placa (data de saída limpa)';

  INSERT INTO public.board_events (board_order_id, event_type, note) VALUES (v_placa, 'nota', 'Teste de nota');

  v_ok := FALSE;
  BEGIN
    INSERT INTO public.board_events (board_order_id, event_type, note) VALUES (v_placa, 'edicao_campo', 'x');
    v_ok := FALSE;
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: escreveu no histórico algo que não é nota'; END IF;

  v_ok := FALSE;
  BEGIN
    UPDATE public.board_events SET note = 'x' WHERE board_order_id = v_placa;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_ok := (v_n = 0);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: alterou o histórico'; END IF;

  v_ok := FALSE;
  BEGIN
    DELETE FROM public.board_events WHERE board_order_id = v_placa;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_ok := (v_n = 0);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: apagou o histórico'; END IF;
  v_log := v_log || E'\nOK  histórico: nota entra; outro tipo, alterar e apagar são barrados';
  RESET ROLE;

  -- ===== 8. Oficina e técnico não enxergam nada =====
  IF v_gustavo IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gustavo, 'role', 'authenticated')::text, TRUE);
    PERFORM set_config('request.jwt.claim.sub', v_gustavo::text, TRUE);
    SET LOCAL ROLE authenticated;
    IF (SELECT count(*) FROM public.board_orders) <> 0 OR (SELECT count(*) FROM public.board_clients) <> 0 THEN
      RAISE EXCEPTION 'FALHOU: o papel oficina enxergou placas ou clientes de placas';
    END IF;
    RESET ROLE;
    v_log := v_log || E'\nOK  papel oficina não enxerga placas nem clientes de placas';
  END IF;
  IF v_tecnico IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_tecnico, 'role', 'authenticated')::text, TRUE);
    PERFORM set_config('request.jwt.claim.sub', v_tecnico::text, TRUE);
    SET LOCAL ROLE authenticated;
    IF (SELECT count(*) FROM public.board_orders) <> 0 OR (SELECT count(*) FROM public.board_clients) <> 0 THEN
      RAISE EXCEPTION 'FALHOU: o técnico de campo enxergou placas ou clientes de placas';
    END IF;
    RESET ROLE;
    v_log := v_log || E'\nOK  técnico de campo não enxerga placas nem clientes de placas';
  END IF;

  -- ===== 9. Página pública: só com o token, sem dado interno =====
  SELECT public_token INTO v_tok FROM public.board_orders WHERE id = v_placa;
  SET LOCAL ROLE anon;
  v_json := public.placa_acompanhamento(v_tok);
  IF v_json IS NULL OR v_json ->> 'board_number' IS NULL THEN RAISE EXCEPTION 'FALHOU: a página pública devia achar a placa pelo token'; END IF;
  IF jsonb_exists(v_json, 'quote_amount') OR jsonb_exists(v_json, 'technical_diagnosis') OR jsonb_exists(v_json, 'refund_amount') THEN
    RAISE EXCEPTION 'FALHOU: a página pública vazou dado interno';
  END IF;
  IF public.placa_acompanhamento(repeat('a', 64)) IS NOT NULL THEN RAISE EXCEPTION 'FALHOU: token errado devolveu dados'; END IF;
  v_ok := FALSE;
  BEGIN
    PERFORM count(*) FROM public.board_orders;
    v_ok := FALSE;
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: o acesso sem login leu a tabela de placas'; END IF;
  RESET ROLE;
  v_log := v_log || E'\nOK  página pública: acha pelo token, não vaza dado interno e quem não tem login não lê as tabelas';

  -- Desfaz tudo de propósito (este erro é o ponto final de um teste que passou)
  RAISE EXCEPTION 'TUDO CERTO: todas as verificações passaram. Este erro é proposital: ele desfaz o que o teste gravou, nada ficou no banco.%', v_log;
END
$verificacao$;
