-- =====================================================================
-- Verificação: orçamento que virou OS também vira venda (migration 20261125190000_venda_de_orcamento_com_os.sql).
-- Colar no SQL Editor DEPOIS de aplicar a migration e clicar em Run. É UM bloco DO que DÁ ERRO DE PROPÓSITO
-- no fim para desfazer tudo:
--   * "TUDO CERTO ..." = passou (o "erro" é só o desfazer).
--   * "FALHOU ..."     = me mande o texto.
-- A numeração (ORC-, VND- e OS) volta ao que era, se ninguém criou nada no meio.
-- =====================================================================
DO $verificacao$
DECLARE
  v_braulio UUID := (SELECT id FROM public.profiles WHERE email = 'brvniteroi@gmail.com');
  v_cliente UUID := (SELECT c.id FROM public.customers c
                      WHERE c.active AND EXISTS (SELECT 1 FROM public.customer_addresses a WHERE a.customer_id = c.id AND a.active)
                      LIMIT 1);
  v_seq_os TEXT := pg_get_serial_sequence('public.service_orders', 'number');
  v_os_ini BIGINT := (SELECT last_value FROM pg_sequences WHERE schemaname || '.' || sequencename = pg_get_serial_sequence('public.service_orders', 'number'));
  v_orc_valor BIGINT; v_orc_chamado BOOLEAN;
  v_vnd_valor BIGINT; v_vnd_chamado BOOLEAN;
  v_itens JSONB;
  v_orc UUID; v_orc2 UUID; v_os JSONB; v_os_id UUID; v_venda UUID; v_venda2 UUID;
  v_q public.quotes%ROWTYPE;
  v_ok BOOLEAN;
  v_log TEXT := '';
BEGIN
  IF v_braulio IS NULL THEN RAISE EXCEPTION 'Perfil do Braulio não encontrado.'; END IF;
  IF v_cliente IS NULL THEN RAISE EXCEPTION 'Nenhum cliente ativo com endereço para o teste.'; END IF;
  SELECT last_value, is_called INTO v_orc_valor, v_orc_chamado FROM public.quote_number_seq;
  SELECT last_value, is_called INTO v_vnd_valor, v_vnd_chamado FROM public.sale_number_seq;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_braulio, 'role', 'authenticated')::text, TRUE);
  PERFORM set_config('request.jwt.claim.sub', v_braulio::text, TRUE);
  SET LOCAL ROLE authenticated;

  v_itens := jsonb_build_array(
    jsonb_build_object('kind', 'produto', 'is_custom', TRUE, 'code', 'AVULSO', 'name', 'ZZ Tubo teste', 'unit', 'M',
                       'quantity', 3, 'unit_price_cents', 2827),
    jsonb_build_object('kind', 'servico', 'is_custom', TRUE, 'code', 'AVULSO', 'name', 'ZZ M.O Instal Ar Cond split 18.000 btus',
                       'unit', 'SRV', 'quantity', 1, 'unit_price_cents', 83776));

  -- 1. Orçamento -> OS -> venda (o caso do Braulio)
  v_orc := public.orcamento_salvar(jsonb_build_object('customer_id', v_cliente, 'validity_days', 10, 'items', v_itens));
  v_os := public.orcamento_gerar_os(v_orc);
  v_os_id := (v_os->>'service_order_id')::uuid;
  v_venda := public.venda_concluir(jsonb_build_object('quote_id', v_orc, 'customer_id', v_cliente,
               'general_discount_cents', 0, 'items', v_itens, 'payments', '[]'::jsonb));
  SELECT * INTO v_q FROM public.quotes WHERE id = v_orc;
  IF v_q.converted_sale_id IS DISTINCT FROM v_venda OR v_q.converted_service_order_id IS DISTINCT FROM v_os_id THEN
    RAISE EXCEPTION 'FALHOU: o orçamento não ficou ligado à OS e à venda';
  END IF;
  IF (SELECT service_order_id FROM public.sales WHERE id = v_venda) IS DISTINCT FROM v_os_id THEN
    RAISE EXCEPTION 'FALHOU: a venda não ficou ligada à OS do orçamento';
  END IF;
  v_log := v_log || E'\nOK  orçamento que virou OS virou venda, ligada à OS';

  -- 2. Não vende duas vezes
  v_ok := FALSE;
  BEGIN
    PERFORM public.venda_concluir(jsonb_build_object('quote_id', v_orc, 'customer_id', v_cliente,
              'general_discount_cents', 0, 'items', v_itens, 'payments', '[]'::jsonb));
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: vendeu o mesmo orçamento duas vezes'; END IF;
  v_log := v_log || E'\nOK  o mesmo orçamento não vira duas vendas';

  -- 3. Cancelar a venda libera o orçamento (continua convertido por causa da OS) e ele vende de novo
  PERFORM public.venda_cancelar(v_venda, 'Teste da verificação');
  SELECT * INTO v_q FROM public.quotes WHERE id = v_orc;
  IF v_q.converted_sale_id IS NOT NULL OR v_q.status <> 'convertido' THEN
    RAISE EXCEPTION 'FALHOU: cancelar a venda não liberou o orçamento (situação %)', v_q.status;
  END IF;
  v_venda2 := public.venda_concluir(jsonb_build_object('quote_id', v_orc, 'customer_id', v_cliente,
                'general_discount_cents', 0, 'items', v_itens, 'payments', '[]'::jsonb));
  IF (SELECT converted_sale_id FROM public.quotes WHERE id = v_orc) IS DISTINCT FROM v_venda2 THEN
    RAISE EXCEPTION 'FALHOU: depois de cancelar, a venda nova não ficou no orçamento';
  END IF;
  v_log := v_log || E'\nOK  cancelar a venda libera o orçamento para vender de novo';

  -- 4. Orçamento -> venda (cliente paga antes) -> OS: a venda passa a apontar para a OS
  v_orc2 := public.orcamento_salvar(jsonb_build_object('customer_id', v_cliente, 'validity_days', 10, 'items', v_itens));
  v_venda := public.venda_concluir(jsonb_build_object('quote_id', v_orc2, 'customer_id', v_cliente,
               'general_discount_cents', 0, 'items', v_itens, 'payments', '[]'::jsonb));
  v_os := public.orcamento_gerar_os(v_orc2);
  IF (SELECT service_order_id FROM public.sales WHERE id = v_venda) IS DISTINCT FROM (v_os->>'service_order_id')::uuid THEN
    RAISE EXCEPTION 'FALHOU: a venda feita antes não foi ligada à OS gerada depois';
  END IF;
  v_ok := FALSE;
  BEGIN
    PERFORM public.orcamento_gerar_os(v_orc2);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: gerou duas OS do mesmo orçamento'; END IF;
  v_log := v_log || E'\nOK  orçamento que virou venda gera a OS uma vez só, e a venda aponta para ela';

  -- Numeração de volta ao que era (sequência não se desfaz com o ROLLBACK)
  RESET ROLE;
  IF (SELECT max(number) FROM public.service_orders) = (SELECT last_value FROM pg_sequences WHERE schemaname || '.' || sequencename = v_seq_os) THEN
    PERFORM setval(v_seq_os, v_os_ini, TRUE);
  END IF;
  IF (SELECT max(substr(number, 5)::bigint) FROM public.quotes WHERE number ~ '^ORC-[0-9]+$') = (SELECT last_value FROM public.quote_number_seq) THEN
    PERFORM setval('public.quote_number_seq', v_orc_valor, v_orc_chamado);
  END IF;
  IF (SELECT max(substr(number, 5)::bigint) FROM public.sales WHERE number ~ '^VND-[0-9]+$') = (SELECT last_value FROM public.sale_number_seq) THEN
    PERFORM setval('public.sale_number_seq', v_vnd_valor, v_vnd_chamado);
  END IF;

  RAISE EXCEPTION 'TUDO CERTO (tudo foi desfeito, nada ficou no banco):%', v_log;
END
$verificacao$;
