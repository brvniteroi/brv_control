-- =====================================================================
-- Verificação do catálogo e dos orçamentos (migration 20261125100000_catalogo_orcamentos.sql).
-- Colar no SQL Editor DEPOIS de aplicar a migration e clicar em Run. É UM bloco DO que DÁ ERRO DE PROPÓSITO
-- no fim para desfazer tudo (nada fica no banco):
--   * "TUDO CERTO ..." = passou em todas as verificações (o "erro" é só o desfazer).
--   * "FALHOU ..."     = alguma regra não funcionou (me mande o texto).
-- A numeração (ORC-, e o número da OS gerada no teste) volta ao que era, se ninguém criou nada no meio.
-- =====================================================================
DO $verificacao$
DECLARE
  v_braulio UUID := (SELECT id FROM public.profiles WHERE email = 'brvniteroi@gmail.com');
  v_tecnico UUID := (SELECT id FROM public.profiles WHERE role = 'tecnico' AND active LIMIT 1);
  v_cliente UUID := (SELECT c.id FROM public.customers c
                      WHERE c.active AND EXISTS (SELECT 1 FROM public.customer_addresses a WHERE a.customer_id = c.id AND a.active)
                      LIMIT 1);
  v_seq_orc_valor BIGINT; v_seq_orc_chamado BOOLEAN;
  v_seq_os TEXT := pg_get_serial_sequence('public.service_orders', 'number');
  v_prod UUID; v_serv UUID; v_orc UUID; v_orc2 UUID; v_orc3 UUID;
  v_q public.quotes%ROWTYPE;
  v_json JSONB; v_token TEXT; v_token_velho TEXT;
  v_os JSONB; v_os_num BIGINT;
  v_txt TEXT; v_n BIGINT; v_ok BOOLEAN;
  v_log TEXT := '';
BEGIN
  IF v_braulio IS NULL THEN
    RAISE EXCEPTION 'Perfil do Braulio não encontrado: ajuste o e-mail no começo do script.';
  END IF;
  SELECT last_value, is_called INTO v_seq_orc_valor, v_seq_orc_chamado FROM public.quote_number_seq;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_braulio, 'role', 'authenticated')::text, TRUE);
  PERFORM set_config('request.jwt.claim.sub', v_braulio::text, TRUE);
  SET LOCAL ROLE authenticated;

  -- 1. Nível financeiro do admin
  IF public.nivel_financeiro() <> 'completo' THEN
    RAISE EXCEPTION 'FALHOU: admin deveria ter nível financeiro completo, veio %', public.nivel_financeiro();
  END IF;
  v_log := v_log || E'\nOK  admin tem nível financeiro completo';

  -- 2. Catálogo: cadastrar, código repetido (sem diferenciar maiúsculas) barrado, reajuste anotado, custo só no completo
  INSERT INTO public.catalog_items (code, name, kind, unit, sale_price_cents, controls_stock)
    VALUES ('ZZTESTE-TUBO', 'ZZ Tubo de cobre 1/2" teste', 'produto', 'M', 4200, TRUE) RETURNING id INTO v_prod;
  INSERT INTO public.catalog_items (code, name, kind, unit, sale_price_cents)
    VALUES ('ZZTESTE-MO', 'ZZ M.O Instal Ar Cond split 12.000 btus teste', 'servico', 'SRV', 59000) RETURNING id INTO v_serv;
  v_ok := FALSE;
  BEGIN
    INSERT INTO public.catalog_items (code, name, sale_price_cents) VALUES ('zzteste-tubo', 'Duplicado', 100);
  EXCEPTION WHEN unique_violation THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: aceitou código repetido no catálogo'; END IF;
  v_log := v_log || E'\nOK  catálogo barra código repetido';

  UPDATE public.catalog_items SET price_updated_at = NOW() - INTERVAL '10 days' WHERE id = v_prod;
  UPDATE public.catalog_items SET sale_price_cents = 4500 WHERE id = v_prod;
  IF (SELECT price_updated_at < NOW() - INTERVAL '1 day' FROM public.catalog_items WHERE id = v_prod) THEN
    RAISE EXCEPTION 'FALHOU: a data do último reajuste não mudou com o preço';
  END IF;
  UPDATE public.catalog_items SET sale_price_cents = 4200 WHERE id = v_prod;
  v_log := v_log || E'\nOK  reajuste de preço anota a data';

  INSERT INTO public.catalog_item_costs (catalog_item_id, cost_price_cents) VALUES (v_prod, 1500);
  IF NOT EXISTS (SELECT 1 FROM public.catalog_item_costs WHERE catalog_item_id = v_prod) THEN
    RAISE EXCEPTION 'FALHOU: admin não gravou/leu o custo';
  END IF;
  v_log := v_log || E'\nOK  custo gravado e lido pelo nível completo';

  IF NOT public.catalogo_parece_servico('M.O Instal Ar Cond split 12.000 btus')
     OR public.catalogo_parece_servico('Tubo de cobre 1/2"') THEN
    RAISE EXCEPTION 'FALHOU: "Revisar tipos" reconhece serviço errado';
  END IF;
  v_log := v_log || E'\nOK  "Revisar tipos" reconhece mão de obra';

  IF (SELECT count(*) FROM public.quote_texts WHERE active) < 4 THEN
    RAISE EXCEPTION 'FALHOU: as 4 observações padrão não foram cadastradas';
  END IF;
  v_log := v_log || E'\nOK  observações padrão cadastradas';

  -- 3. Orçamento: o banco calcula itens e totais (a tela não manda total)
  v_orc := public.orcamento_salvar(jsonb_build_object(
    'customer_id', v_cliente, 'validity_days', 10, 'general_discount_cents', 1000, 'freight_cents', 500,
    'total_cents', 1, 'notes', 'Elétrica e dreno por conta do cliente.', 'internal_notes', 'SEGREDO-INTERNO',
    'items', jsonb_build_array(
      jsonb_build_object('catalog_item_id', v_prod, 'is_custom', FALSE, 'kind', 'produto', 'code', 'ZZTESTE-TUBO',
                         'name', 'Tubo de cobre', 'unit', 'M', 'quantity', 2, 'unit_price_cents', 4200,
                         'discount_mode', 'valor', 'discount_input', 0),
      jsonb_build_object('catalog_item_id', v_serv, 'is_custom', FALSE, 'kind', 'servico', 'code', 'ZZTESTE-MO',
                         'name', 'M.O Instal Ar Cond split 12.000 btus', 'unit', 'SRV', 'quantity', 1, 'unit_price_cents', 59000,
                         'discount_mode', 'percentual', 'discount_input', 10))));
  SELECT * INTO v_q FROM public.quotes WHERE id = v_orc;
  -- 2 x 42,00 = 84,00; 590,00 - 10% = 531,00; - 10,00 de desconto + 5,00 de frete = 610,00
  IF v_q.products_subtotal_cents <> 8400 OR v_q.services_subtotal_cents <> 53100 OR v_q.total_cents <> 61000 THEN
    RAISE EXCEPTION 'FALHOU: totais errados: produtos %, serviços %, total %',
      v_q.products_subtotal_cents, v_q.services_subtotal_cents, v_q.total_cents;
  END IF;
  IF v_q.number !~ '^ORC-[0-9]{5}$' OR v_q.status <> 'rascunho' OR v_q.valid_until <> public.hoje_local() + 10 THEN
    RAISE EXCEPTION 'FALHOU: número %, situação % ou validade % inesperados', v_q.number, v_q.status, v_q.valid_until;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quote_events WHERE quote_id = v_orc AND event_type = 'criado') THEN
    RAISE EXCEPTION 'FALHOU: histórico sem o evento "criado"';
  END IF;
  v_log := v_log || E'\nOK  orçamento criado com totais calculados no banco (' || v_q.number || ', ' || public.formatar_reais(v_q.total_cents) || ')';

  -- Busca e lista
  v_json := public.orcamentos_listar(jsonb_build_object('busca', 'tubo de cobre', 'situacao', 'rascunho'));
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_json->'itens') e WHERE (e->>'id')::uuid = v_orc) THEN
    RAISE EXCEPTION 'FALHOU: a lista não achou o orçamento pelo nome do item';
  END IF;
  v_log := v_log || E'\nOK  lista acha pelo nome do item e conta por situação';

  -- 4. Enviar: vira "enviado" e não se altera mais
  PERFORM public.orcamento_registrar_envio(v_orc);
  IF (SELECT status FROM public.quotes WHERE id = v_orc) <> 'enviado' THEN
    RAISE EXCEPTION 'FALHOU: não ficou "enviado"';
  END IF;
  v_ok := FALSE;
  BEGIN
    PERFORM public.orcamento_salvar(jsonb_build_object('id', v_orc, 'customer_id', v_cliente, 'validity_days', 10,
      'items', jsonb_build_array(jsonb_build_object('kind', 'produto', 'name', 'X', 'quantity', 1, 'unit_price_cents', 1))));
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: alterou orçamento já enviado'; END IF;
  v_log := v_log || E'\nOK  orçamento enviado não se altera (só reabrindo ou duplicando)';

  -- 5. Página pública: sem login, sem a observação interna; aprovação pelo link
  SELECT public_token INTO v_token FROM public.quotes WHERE id = v_orc;
  SET LOCAL ROLE anon;
  v_ok := FALSE;
  BEGIN
    SELECT count(*) INTO v_n FROM public.quotes;
    v_ok := (v_n = 0);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: anônimo leu a tabela de orçamentos'; END IF;
  v_json := public.orcamento_publico_ver(v_token);
  IF v_json IS NULL OR (v_json->>'total_cents')::bigint <> 61000 OR v_json::text LIKE '%SEGREDO-INTERNO%' THEN
    RAISE EXCEPTION 'FALHOU: página pública errada ou mostrando a observação interna: %', left(v_json::text, 200);
  END IF;
  IF public.orcamento_publico_ver('0123456789abcdef0123456789abcdef') IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: token inventado abriu um orçamento';
  END IF;
  v_json := public.orcamento_publico_aprovar(v_token, 'Fulano de Tal');
  SET LOCAL ROLE authenticated;
  SELECT * INTO v_q FROM public.quotes WHERE id = v_orc;
  IF v_q.status <> 'aprovado' OR v_q.response_channel <> 'link' OR v_q.responded_by_name <> 'Fulano de Tal' THEN
    RAISE EXCEPTION 'FALHOU: aprovação pelo link não gravou (% / % / %)', v_q.status, v_q.response_channel, v_q.responded_by_name;
  END IF;
  v_log := v_log || E'\nOK  página pública sem login, sem observação interna, e aprovação pelo link';

  -- 6. Reabrir troca o link (o antigo para de abrir)
  v_token_velho := v_token;
  PERFORM public.orcamento_reabrir(v_orc);
  SELECT * INTO v_q FROM public.quotes WHERE id = v_orc;
  IF v_q.status <> 'rascunho' OR v_q.public_token = v_token_velho OR v_q.responded_at IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: reabrir não voltou para rascunho com link novo';
  END IF;
  SET LOCAL ROLE anon;
  IF public.orcamento_publico_ver(v_token_velho) IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: o link antigo continuou abrindo depois de reabrir';
  END IF;
  SET LOCAL ROLE authenticated;
  v_log := v_log || E'\nOK  reabrir volta para rascunho e revoga o link antigo';

  -- 7. Duplicar: número novo, rascunho, mesmo total
  v_orc2 := public.orcamento_duplicar(v_orc);
  IF (SELECT total_cents FROM public.quotes WHERE id = v_orc2) <> 61000
     OR (SELECT count(*) FROM public.quote_items WHERE quote_id = v_orc2) <> 2
     OR (SELECT number FROM public.quotes WHERE id = v_orc2) = v_q.number THEN
    RAISE EXCEPTION 'FALHOU: duplicar não copiou itens/total ou repetiu o número';
  END IF;
  v_log := v_log || E'\nOK  duplicar cria outro número com os mesmos itens';

  -- 8. Resposta registrada pelo escritório e exclusão só de rascunho
  PERFORM public.orcamento_registrar_resposta(v_orc2, 'recusado', 'whatsapp', 'Achou caro');
  v_ok := FALSE;
  BEGIN
    PERFORM public.orcamento_excluir(v_orc2);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: excluiu orçamento que não era rascunho'; END IF;
  v_orc3 := public.orcamento_duplicar(v_orc2);
  PERFORM public.orcamento_excluir(v_orc3);
  IF EXISTS (SELECT 1 FROM public.quotes WHERE id = v_orc3) THEN
    RAISE EXCEPTION 'FALHOU: não excluiu o rascunho';
  END IF;
  v_log := v_log || E'\nOK  resposta registrada; só rascunho se exclui';

  -- 9. Gerar OS com os serviços
  IF v_cliente IS NOT NULL THEN
    v_os := public.orcamento_gerar_os(v_orc);
    v_os_num := (v_os->>'service_order_number')::bigint;
    IF NOT EXISTS (SELECT 1 FROM public.service_orders WHERE id = (v_os->>'service_order_id')::uuid AND status = 'agendada')
       OR (SELECT status FROM public.quotes WHERE id = v_orc) <> 'convertido' THEN
      RAISE EXCEPTION 'FALHOU: gerar OS não criou a OS agendada ou não marcou o orçamento como convertido';
    END IF;
    v_ok := FALSE;
    BEGIN
      PERFORM public.orcamento_gerar_os(v_orc);
    EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: gerou a OS duas vezes'; END IF;
    v_log := v_log || E'\nOK  gera a OS dos serviços uma vez só (OS ' || v_os_num || ' de teste, desfeita)';
  ELSE
    v_log := v_log || E'\n--  sem cliente com endereço: teste de gerar OS pulado';
  END IF;

  -- 10. Técnico não mexe em orçamento nem vê o catálogo
  IF v_tecnico IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_tecnico, 'role', 'authenticated')::text, TRUE);
    PERFORM set_config('request.jwt.claim.sub', v_tecnico::text, TRUE);
    v_ok := FALSE;
    BEGIN
      PERFORM public.orcamento_duplicar(v_orc);
    EXCEPTION WHEN insufficient_privilege THEN v_ok := TRUE;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: técnico duplicou um orçamento'; END IF;
    IF EXISTS (SELECT 1 FROM public.catalog_items WHERE id = v_prod) OR EXISTS (SELECT 1 FROM public.quotes WHERE id = v_orc) THEN
      RAISE EXCEPTION 'FALHOU: técnico enxergou catálogo ou orçamento';
    END IF;
    IF public.nivel_financeiro() <> 'nenhum' THEN
      RAISE EXCEPTION 'FALHOU: técnico com nível financeiro %', public.nivel_financeiro();
    END IF;
    v_log := v_log || E'\nOK  técnico não vê catálogo nem orçamentos e não tem nível financeiro';
  ELSE
    v_log := v_log || E'\n--  nenhum técnico ativo: teste de permissão pulado';
  END IF;

  -- Numeração de volta ao que era (sequência não se desfaz com o ROLLBACK)
  RESET ROLE;
  IF v_os_num IS NOT NULL AND (SELECT last_value FROM pg_sequences WHERE schemaname || '.' || sequencename = v_seq_os) = v_os_num THEN
    PERFORM setval(v_seq_os, v_os_num - 1, TRUE);
  END IF;
  IF (SELECT max(substr(number, 5)::bigint) FROM public.quotes WHERE number ~ '^ORC-[0-9]+$')
       = (SELECT last_value FROM public.quote_number_seq) THEN
    PERFORM setval('public.quote_number_seq', v_seq_orc_valor, v_seq_orc_chamado);
  END IF;

  RAISE EXCEPTION 'TUDO CERTO (tudo foi desfeito, nada ficou no banco):%', v_log;
END
$verificacao$;
