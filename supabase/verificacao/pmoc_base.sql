-- =====================================================================
-- Verificação do PMOC, fase 1 (migration 20261116100000_pmoc_base.sql).
-- Colar no SQL Editor DEPOIS de aplicar a migration e clicar em Run. Mesmo esquema das verificações das placas:
-- é UM bloco DO que DÁ ERRO DE PROPÓSITO no fim para desfazer tudo (nada fica no banco: cliente, aparelhos e
-- planos de teste somem, e a numeração PMOC-AAAA-NNNN volta como estava).
--   * "TUDO CERTO ..." = passou em todas as verificações (o "erro" é só o desfazer).
--   * "FALHOU ..."     = alguma regra não funcionou (me mande o texto).
-- =====================================================================
DO $verificacao$
DECLARE
  v_braulio UUID := (SELECT id FROM public.profiles WHERE email = 'brvniteroi@gmail.com');
  v_tecnico UUID := (SELECT id FROM public.profiles WHERE role = 'tecnico' AND active LIMIT 1);
  v_cli UUID; v_end UUID; v_aparelho UUID;
  v_plano UUID; v_plano2 UUID;
  v_amb1 UUID := gen_random_uuid(); v_amb2 UUID := gen_random_uuid();
  v_eq1 UUID := gen_random_uuid(); v_eq2 UUID := gen_random_uuid();
  v_code TEXT; v_n BIGINT; v_txt TEXT; v_ok BOOLEAN;
  v_geral JSONB; v_ambs JSONB; v_eqs JSONB;
  v_log TEXT := '';
BEGIN
  IF v_braulio IS NULL THEN
    RAISE EXCEPTION 'Perfil do Braulio não encontrado: ajuste o e-mail no começo do script.';
  END IF;

  -- 1. Modelos iniciais
  SELECT count(*) INTO v_n FROM public.pmoc_task_templates
  WHERE equipment_type IN ('Split Hi-Wall', 'Cassete', 'Split Piso-Teto', 'VRF')
    AND (SELECT count(*) FROM public.pmoc_task_template_items i WHERE i.template_id = pmoc_task_templates.id) = 22;
  IF v_n <> 4 THEN RAISE EXCEPTION 'FALHOU: esperava 4 modelos com 22 tarefas cada; achei %', v_n; END IF;
  v_log := v_log || E'\nOK  4 modelos de tarefa com 22 tarefas cada';

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_braulio, 'role', 'authenticated')::text, TRUE);
  PERFORM set_config('request.jwt.claim.sub', v_braulio::text, TRUE);
  SET LOCAL ROLE authenticated;

  v_txt := (SELECT public.pmoc_responsavel_padrao())::TEXT;
  v_log := v_log || E'\nINFO responsável sugerido no plano novo: ' || coalesce((SELECT name FROM public.employees WHERE id::TEXT = v_txt), 'nenhum (precisa de exatamente 1 funcionário ativo com registro profissional)');

  INSERT INTO public.customers (person_type, name) VALUES ('PJ', 'ZZ Teste PMOC') RETURNING id INTO v_cli;
  INSERT INTO public.customer_addresses (customer_id, street, number, city, state, is_primary)
    VALUES (v_cli, 'Rua Teste PMOC', '1', 'Niterói', 'RJ', TRUE) RETURNING id INTO v_end;
  INSERT INTO public.equipments (customer_id, address_id, category, brand, capacity_btu)
    VALUES (v_cli, v_end, 'Cassete', 'Marca X', 36000) RETURNING id INTO v_aparelho;

  v_geral := jsonb_build_object('customer_id', v_cli, 'customer_name', 'ZZ Teste PMOC', 'address_id', v_end,
    'address_snapshot', jsonb_build_object('street', 'Rua Teste PMOC', 'city', 'Niterói', 'state', 'RJ'),
    'start_date', '2026-12-01', 'end_date', '2027-11-30', 'status', 'rascunho', 'registration_type', 'CFT');
  v_ambs := jsonb_build_array(
    jsonb_build_object('id', v_amb1, 'name', 'Sala de Reunião', 'code', 'SR', 'fixed_occupants', 8, 'floating_occupants', 2, 'area_m2', 30.5),
    jsonb_build_object('id', v_amb2, 'name', 'Recepção', 'code', 'RC', 'fixed_occupants', 2, 'floating_occupants', 10, 'area_m2', 20));
  v_eqs := jsonb_build_array(
    jsonb_build_object('id', v_eq1, 'equipment_id', NULL, 'environment_id', v_amb1, 'equipment_type', 'Split Hi-Wall',
      'name', 'Split da reunião', 'brand', 'Marca Y', 'capacity_btu', 12000, 'identifier', 'AR-SR-0001', 'active', TRUE),
    jsonb_build_object('id', v_eq2, 'equipment_id', v_aparelho, 'environment_id', v_amb2, 'equipment_type', 'Cassete',
      'name', 'Cassete da recepção', 'capacity_btu', 36000, 'identifier', 'AR-RC-0001', 'active', TRUE));

  -- 2. Plano novo em rascunho: código, aparelho manual criado no cadastro do cliente, cronograma pelo modelo
  v_plano := public.pmoc_salvar_plano(v_geral, v_ambs, v_eqs, '[]'::JSONB);
  SELECT code INTO v_code FROM public.pmoc_plans WHERE id = v_plano;
  IF v_code !~ '^PMOC-2026-[0-9]{4}$' THEN RAISE EXCEPTION 'FALHOU: código fora do padrão: %', v_code; END IF;
  v_log := v_log || E'\nOK  plano criado com o código ' || v_code;

  SELECT count(*) INTO v_n FROM public.equipments WHERE customer_id = v_cli;
  IF v_n <> 2 THEN RAISE EXCEPTION 'FALHOU: o aparelho manual não foi criado no cadastro do cliente (aparelhos: %)', v_n; END IF;
  v_log := v_log || E'\nOK  aparelho incluído à mão foi criado no cadastro do cliente';

  SELECT count(*) INTO v_n FROM public.pmoc_equipment_tasks WHERE plan_id = v_plano;
  IF v_n <> 44 THEN RAISE EXCEPTION 'FALHOU: esperava 44 tarefas (22 por aparelho), achei %', v_n; END IF;
  v_log := v_log || E'\nOK  cada aparelho recebeu as 22 tarefas do modelo do tipo dele';

  -- 3. Segundo plano no mesmo ano: número seguinte
  v_plano2 := public.pmoc_salvar_plano(v_geral, '[]'::JSONB, '[]'::JSONB, '[]'::JSONB);
  IF (SELECT code FROM public.pmoc_plans WHERE id = v_plano2) <> 'PMOC-2026-' || lpad((substring(v_code FROM 11)::INTEGER + 1)::TEXT, 4, '0') THEN
    RAISE EXCEPTION 'FALHOU: o segundo plano não pegou o número seguinte';
  END IF;
  v_log := v_log || E'\nOK  numeração sequencial por ano';

  -- 4. Vigente sem responsável/TRT: barrado
  v_ok := FALSE;
  BEGIN
    PERFORM public.pmoc_salvar_plano(v_geral || jsonb_build_object('id', v_plano, 'status', 'vigente'), v_ambs, v_eqs,
      (SELECT jsonb_agg(to_jsonb(t)) FROM public.pmoc_equipment_tasks t WHERE plan_id = v_plano));
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: ficou vigente sem responsável técnico e sem TRT'; END IF;
  v_log := v_log || E'\nOK  barrou vigente sem responsável técnico e TRT';

  -- 5. Vigente completo + troca das siglas entre os dois ambientes no mesmo salvamento
  PERFORM public.pmoc_salvar_plano(
    v_geral || jsonb_build_object('id', v_plano, 'status', 'vigente', 'responsible_name', 'Técnico Teste',
      'responsible_cpf', '529.982.247-25', 'registration_number', 'CFT 000', 'responsibility_term_number', 'TRT-TESTE'),
    jsonb_build_array(v_ambs->0 || jsonb_build_object('code', 'RC'), v_ambs->1 || jsonb_build_object('code', 'SR')),
    v_eqs, (SELECT jsonb_agg(to_jsonb(t)) FROM public.pmoc_equipment_tasks t WHERE plan_id = v_plano));
  IF (SELECT status FROM public.pmoc_plans WHERE id = v_plano) <> 'vigente' THEN RAISE EXCEPTION 'FALHOU: plano completo não ficou vigente'; END IF;
  IF (SELECT code FROM public.pmoc_environments WHERE id = v_amb1) <> 'RC' THEN RAISE EXCEPTION 'FALHOU: troca de siglas entre ambientes'; END IF;
  v_log := v_log || E'\nOK  plano completo ficou vigente; trocar siglas entre ambientes funciona';

  -- 6. Histórico do plano
  SELECT count(*) INTO v_n FROM public.pmoc_events WHERE plan_id = v_plano AND event_type IN ('criacao', 'situacao', 'responsavel', 'termo');
  IF v_n < 4 THEN RAISE EXCEPTION 'FALHOU: histórico do plano incompleto (% eventos)', v_n; END IF;
  v_log := v_log || E'\nOK  histórico registrou criação, situação, responsável e termo';

  -- 7. Aparelho com manutenção registrada não sai do plano
  RESET ROLE;
  INSERT INTO public.pmoc_executions (plan_id, plan_equipment_id, reference_month, status) VALUES (v_plano, v_eq2, '2026-12', 'concluida');
  SET LOCAL ROLE authenticated;
  v_ok := FALSE;
  BEGIN
    PERFORM public.pmoc_salvar_plano(v_geral || jsonb_build_object('id', v_plano, 'responsible_name', 'Técnico Teste',
      'responsible_cpf', '529.982.247-25', 'registration_number', 'CFT 000', 'responsibility_term_number', 'TRT-TESTE'),
      v_ambs, jsonb_build_array(v_eqs->0), '[]'::JSONB);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: removeu do plano um aparelho com manutenção registrada'; END IF;
  v_log := v_log || E'\nOK  aparelho com manutenção registrada não pode ser removido';

  -- 8. Aparelho de outro cliente: barrado
  v_ok := FALSE;
  BEGIN
    PERFORM public.pmoc_salvar_plano(v_geral || jsonb_build_object('id', v_plano2), '[]'::JSONB,
      jsonb_build_array(jsonb_build_object('equipment_id', coalesce((SELECT id FROM public.equipments WHERE customer_id <> v_cli LIMIT 1), gen_random_uuid()),
        'equipment_type', 'Split Hi-Wall', 'name', 'Intruso', 'identifier', 'AR-XX-0001', 'capacity_btu', 9000)), '[]'::JSONB);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: aceitou aparelho de outro cliente no plano'; END IF;
  v_log := v_log || E'\nOK  barrou aparelho de outro cliente';

  -- 9. Modelo com tipo repetido: barrado
  v_ok := FALSE;
  BEGIN
    PERFORM public.pmoc_salvar_modelo(jsonb_build_object('equipment_type', 'split hi-wall',
      'tasks', jsonb_build_array(jsonb_build_object('description', 'X', 'periodicity', 'mensal'))));
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: aceitou dois modelos para o mesmo tipo'; END IF;
  v_log := v_log || E'\nOK  barrou modelo repetido para o mesmo tipo';

  -- 10. Escrita direta nas tabelas (sem a função): barrada
  v_ok := FALSE;
  BEGIN
    UPDATE public.pmoc_plans SET status = 'encerrado' WHERE id = v_plano;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_ok := (v_n = 0);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: deu para alterar o plano direto na tabela'; END IF;
  v_log := v_log || E'\nOK  plano só muda pela função de gravar (escrita direta barrada)';

  -- 11. Técnico não lê nem grava PMOC
  IF v_tecnico IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_tecnico, 'role', 'authenticated')::text, TRUE);
    PERFORM set_config('request.jwt.claim.sub', v_tecnico::text, TRUE);
    SELECT count(*) INTO v_n FROM public.pmoc_plans;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHOU: técnico enxergou % plano(s)', v_n; END IF;
    v_ok := FALSE;
    BEGIN
      PERFORM public.pmoc_salvar_plano(v_geral, '[]'::JSONB, '[]'::JSONB, '[]'::JSONB);
    EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: técnico conseguiu gravar plano'; END IF;
    BEGIN
      SELECT count(*) INTO v_n FROM public.pmoc_dados_responsavel((SELECT id FROM public.employees LIMIT 1));
      RAISE EXCEPTION 'FALHOU: técnico leu CPF/registro do responsável';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    v_log := v_log || E'\nOK  técnico não lê planos, não grava e não vê CPF/registro';
  ELSE
    v_log := v_log || E'\nINFO sem técnico ativo para testar o bloqueio do técnico';
  END IF;

  RAISE EXCEPTION 'TUDO CERTO (o erro é só para desfazer o teste):%', v_log;
END
$verificacao$;
