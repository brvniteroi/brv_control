-- =====================================================================
-- Verificação do tipo da OS gerada pelo orçamento (migration 20261125180000_os_do_orcamento_tipo.sql).
-- Colar no SQL Editor DEPOIS de aplicar a migration e clicar em Run. É UM bloco DO que DÁ ERRO DE PROPÓSITO
-- no fim para desfazer tudo:
--   * "TUDO CERTO ..." = passou (o "erro" é só o desfazer).
--   * "FALHOU ..."     = me mande o texto.
-- A numeração (ORC- e OS) volta ao que era, se ninguém criou nada no meio.
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
  v_caso RECORD;
  v_orc UUID; v_os JSONB; v_tipo TEXT;
  v_log TEXT := '';
BEGIN
  IF v_braulio IS NULL THEN RAISE EXCEPTION 'Perfil do Braulio não encontrado.'; END IF;
  IF v_cliente IS NULL THEN RAISE EXCEPTION 'Nenhum cliente ativo com endereço para o teste.'; END IF;
  SELECT last_value, is_called INTO v_orc_valor, v_orc_chamado FROM public.quote_number_seq;

  -- A OS 17565 foi corrigida pela migration
  SELECT t.name INTO v_tipo FROM public.service_orders so JOIN public.service_types t ON t.id = so.service_type_id WHERE so.number = 17565;
  IF v_tipo IS DISTINCT FROM 'Instalação de Split' THEN
    RAISE EXCEPTION 'FALHOU: a OS 17565 ficou com o tipo %', v_tipo;
  END IF;
  v_log := v_log || E'\nOK  OS 17565 agora é "Instalação de Split"';

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_braulio, 'role', 'authenticated')::text, TRUE);
  PERFORM set_config('request.jwt.claim.sub', v_braulio::text, TRUE);
  SET LOCAL ROLE authenticated;

  FOR v_caso IN SELECT * FROM (VALUES
      ('M.O Instal Ar Cond split 18.000 btus', 'Instalação de Split'),
      ('Manutenção preventiva split 12.000 btus', 'Manutenção de Split'),
      ('Instalação de ar de janela 10.000 btus', 'Instalação Ar de Janela')
    ) AS c(servico, esperado)
  LOOP
    -- O tipo esperado precisa existir e estar ativo (senão o caso não vale)
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM public.service_types WHERE name = v_caso.esperado AND active);
    v_orc := public.orcamento_salvar(jsonb_build_object(
      'customer_id', v_cliente, 'validity_days', 10,
      'items', jsonb_build_array(jsonb_build_object('kind', 'servico', 'is_custom', TRUE, 'code', 'AVULSO',
        'name', v_caso.servico, 'unit', 'SRV', 'quantity', 1, 'unit_price_cents', 50000))));
    v_os := public.orcamento_gerar_os(v_orc);
    SELECT t.name INTO v_tipo FROM public.service_orders so JOIN public.service_types t ON t.id = so.service_type_id
     WHERE so.id = (v_os->>'service_order_id')::uuid;
    IF v_tipo IS DISTINCT FROM v_caso.esperado THEN
      RAISE EXCEPTION 'FALHOU: "%" gerou OS do tipo "%" (esperado "%")', v_caso.servico, v_tipo, v_caso.esperado;
    END IF;
    v_log := v_log || format(E'\nOK  "%s" -> %s', v_caso.servico, v_tipo);
  END LOOP;

  -- Numeração de volta ao que era (sequência não se desfaz com o ROLLBACK)
  RESET ROLE;
  IF (SELECT max(number) FROM public.service_orders) = (SELECT last_value FROM pg_sequences WHERE schemaname || '.' || sequencename = v_seq_os) THEN
    PERFORM setval(v_seq_os, v_os_ini, TRUE);
  END IF;
  IF (SELECT max(substr(number, 5)::bigint) FROM public.quotes WHERE number ~ '^ORC-[0-9]+$') = (SELECT last_value FROM public.quote_number_seq) THEN
    PERFORM setval('public.quote_number_seq', v_orc_valor, v_orc_chamado);
  END IF;

  RAISE EXCEPTION 'TUDO CERTO (tudo foi desfeito, nada ficou no banco):%', v_log;
END
$verificacao$;
