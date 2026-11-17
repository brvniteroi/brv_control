-- =====================================================================
-- Verificação do PMOC, fases 2 e 3 (migration 20261117100000_pmoc_execucao_qr.sql).
-- Colar no SQL Editor DEPOIS de aplicar a migration e clicar em Run. Mesmo esquema da verificação da fase 1:
-- é UM bloco DO que DÁ ERRO DE PROPÓSITO no fim para desfazer tudo (cliente, plano, OS, atividade e etiquetas de teste somem).
--   * "TUDO CERTO ..." = passou em todas as verificações (o "erro" é só o desfazer).
--   * "FALHOU ..."     = alguma regra não funcionou (me mande o texto).
-- =====================================================================
DO $verificacao$
DECLARE
  v_braulio UUID := (SELECT id FROM public.profiles WHERE email = 'brvniteroi@gmail.com');
  v_perfil_tec UUID := (SELECT p.id FROM public.profiles p JOIN public.employees e ON e.profile_id = p.id
                         WHERE p.role = 'tecnico' AND p.active AND e.active LIMIT 1);
  v_emp_tec UUID;
  v_emp_outro UUID;
  v_cli UUID; v_end UUID; v_aparelho UUID;
  v_plano UUID;
  v_amb1 UUID := gen_random_uuid();
  v_eq1 UUID := gen_random_uuid(); v_eq2 UUID := gen_random_uuid();
  v_mes TEXT := to_char(date_trunc('month', CURRENT_DATE), 'YYYY-MM');
  v_geral JSONB; v_ambs JSONB; v_eqs JSONB;
  v_r JSONB; v_r2 JSONB; v_os UUID; v_task UUID; v_n BIGINT; v_ok BOOLEAN; v_tok TEXT; v_tok_eq TEXT;
  v_chk JSONB; v_resultados JSONB;
  v_log TEXT := '';
BEGIN
  IF v_braulio IS NULL THEN
    RAISE EXCEPTION 'Perfil do Braulio não encontrado: ajuste o e-mail no começo do script.';
  END IF;
  v_emp_tec := (SELECT id FROM public.employees WHERE profile_id = v_perfil_tec);
  v_emp_outro := (SELECT id FROM public.employees WHERE active AND id IS DISTINCT FROM v_emp_tec LIMIT 1);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_braulio, 'role', 'authenticated')::text, TRUE);
  PERFORM set_config('request.jwt.claim.sub', v_braulio::text, TRUE);
  SET LOCAL ROLE authenticated;

  -- Plano vigente de teste, começando neste mês (mês 1 = tarefas mensais, trimestrais, semestrais e anuais do modelo)
  INSERT INTO public.customers (person_type, name) VALUES ('PJ', 'ZZ Teste PMOC Fase 2') RETURNING id INTO v_cli;
  INSERT INTO public.customer_addresses (customer_id, street, number, city, state, is_primary)
    VALUES (v_cli, 'Rua Teste PMOC', '2', 'Niterói', 'RJ', TRUE) RETURNING id INTO v_end;
  INSERT INTO public.equipments (customer_id, address_id, category, brand, capacity_btu)
    VALUES (v_cli, v_end, 'Cassete', 'Marca X', 36000) RETURNING id INTO v_aparelho;

  v_geral := jsonb_build_object('customer_id', v_cli, 'customer_name', 'ZZ Teste PMOC Fase 2',
    'customer_document', '11.222.333/0001-81', 'address_id', v_end,
    'address_snapshot', jsonb_build_object('street', 'Rua Teste PMOC', 'city', 'Niterói', 'state', 'RJ'),
    'start_date', date_trunc('month', CURRENT_DATE)::DATE, 'end_date', (date_trunc('month', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day')::DATE,
    'status', 'vigente', 'registration_type', 'CFT', 'responsible_name', 'Técnico Teste',
    'responsible_cpf', '529.982.247-25', 'registration_number', 'CFT 000', 'responsibility_term_number', 'TRT-TESTE',
    'notes', 'observação interna que não pode vazar');
  v_ambs := jsonb_build_array(
    jsonb_build_object('id', v_amb1, 'name', 'Sala de Reunião', 'code', 'SR', 'fixed_occupants', 8, 'floating_occupants', 2, 'area_m2', 30.5));
  v_eqs := jsonb_build_array(
    jsonb_build_object('id', v_eq1, 'equipment_id', NULL, 'environment_id', v_amb1, 'equipment_type', 'Split Hi-Wall',
      'name', 'Split da reunião', 'brand', 'Marca Y', 'capacity_btu', 12000, 'identifier', 'AR-SR-0001', 'active', TRUE),
    jsonb_build_object('id', v_eq2, 'equipment_id', v_aparelho, 'environment_id', v_amb1, 'equipment_type', 'Cassete',
      'name', 'Cassete da reunião', 'capacity_btu', 36000, 'identifier', 'AR-SR-0002', 'active', TRUE));
  v_plano := public.pmoc_salvar_plano(v_geral, v_ambs, v_eqs, '[]'::JSONB);

  -- 1. Token do aparelho: 32 caracteres, único
  SELECT count(*) INTO v_n FROM public.equipments e JOIN public.pmoc_plan_equipments pe ON pe.equipment_id = e.id
   WHERE pe.plan_id = v_plano AND length(e.public_token) = 32;
  IF v_n <> 2 THEN RAISE EXCEPTION 'FALHOU: os 2 aparelhos do plano deveriam ter token de 32 caracteres (achei %)', v_n; END IF;
  v_log := v_log || E'\nOK  cada aparelho tem o token do QR Code';

  -- 2. Gerar a OS do mês
  v_r := public.pmoc_gerar_os_mes(v_plano, v_mes, coalesce(v_emp_tec, (SELECT id FROM public.employees WHERE active LIMIT 1)),
                                  NOW() + INTERVAL '1 hour', 60);
  v_os := (v_r ->> 'service_order_id')::UUID;
  v_task := (v_r ->> 'task_id')::UUID;
  IF (v_r ->> 'already_existed')::BOOLEAN THEN RAISE EXCEPTION 'FALHOU: a primeira geração disse que já existia'; END IF;
  IF (SELECT status FROM public.service_orders WHERE id = v_os) <> 'agendada' THEN RAISE EXCEPTION 'FALHOU: a OS do mês não nasceu agendada'; END IF;
  IF (SELECT count(*) FROM public.tasks WHERE service_order_id = v_os AND status = 'agendada') <> 1 THEN RAISE EXCEPTION 'FALHOU: a OS do mês deveria ter 1 atividade agendada'; END IF;
  IF (SELECT count(*) FROM public.pmoc_executions WHERE plan_id = v_plano AND reference_month = v_mes AND task_id = v_task) <> 2 THEN
    RAISE EXCEPTION 'FALHOU: esperava 2 aparelhos pendentes na visita';
  END IF;
  IF (SELECT count(*) FROM public.service_order_equipments WHERE service_order_id = v_os) <> 2 THEN RAISE EXCEPTION 'FALHOU: os aparelhos não foram ligados à OS'; END IF;
  v_log := v_log || E'\nOK  OS do mês gerada (agendada, 1 atividade, 2 aparelhos pendentes)';

  -- 3. Não duplica
  v_r2 := public.pmoc_gerar_os_mes(v_plano, v_mes, (SELECT employee_id FROM public.tasks WHERE id = v_task), NOW() + INTERVAL '2 hours', 60);
  IF NOT (v_r2 ->> 'already_existed')::BOOLEAN OR (v_r2 ->> 'service_order_id')::UUID <> v_os THEN
    RAISE EXCEPTION 'FALHOU: gerou outra OS no mesmo mês';
  END IF;
  v_log := v_log || E'\nOK  segunda geração no mesmo mês devolve a mesma OS';

  -- 4. Mês fora da vigência, plano em rascunho e técnico inexistente: barrados
  v_ok := FALSE;
  BEGIN PERFORM public.pmoc_gerar_os_mes(v_plano, to_char(CURRENT_DATE + INTERVAL '2 years', 'YYYY-MM'),
            (SELECT employee_id FROM public.tasks WHERE id = v_task), NOW(), 60);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: gerou OS fora da vigência do plano'; END IF;
  v_ok := FALSE;
  BEGIN PERFORM public.pmoc_gerar_os_mes(v_plano, v_mes, gen_random_uuid(), NOW(), 60);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: aceitou técnico inexistente'; END IF;
  v_log := v_log || E'\nOK  barrou mês fora da vigência e técnico inexistente';

  -- 5. Checklist: o técnico dono da atividade (ou o Braulio, se não há técnico ativo com login)
  IF v_perfil_tec IS NOT NULL THEN
    RESET ROLE;
    UPDATE public.tasks SET employee_id = v_emp_tec WHERE id = v_task;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_perfil_tec, 'role', 'authenticated')::text, TRUE);
    PERFORM set_config('request.jwt.claim.sub', v_perfil_tec::text, TRUE);
    SET LOCAL ROLE authenticated;
  END IF;

  v_chk := public.pmoc_checklist_atividade(v_task);
  IF NOT (v_chk ->> 'is_pmoc')::BOOLEAN OR jsonb_array_length(v_chk -> 'equipments') <> 2 THEN
    RAISE EXCEPTION 'FALHOU: checklist deveria ser de PMOC com 2 aparelhos: %', v_chk;
  END IF;
  IF jsonb_array_length(v_chk -> 'equipments' -> 0 -> 'scheduled_tasks') = 0 THEN RAISE EXCEPTION 'FALHOU: o aparelho veio sem tarefas do mês'; END IF;
  v_log := v_log || E'\nOK  checklist devolve os 2 aparelhos com as tarefas do mês';

  -- 6. Salvar aparelho: não atendido exige motivo; concluído exige resultado de todas as tarefas
  v_ok := FALSE;
  BEGIN PERFORM public.pmoc_salvar_execucao(v_task, v_eq1, jsonb_build_object('status', 'nao_atendido'));
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: aceitou "não atendido" sem motivo'; END IF;
  v_ok := FALSE;
  BEGIN PERFORM public.pmoc_salvar_execucao(v_task, v_eq1, jsonb_build_object('status', 'concluida', 'task_results', '[]'::JSONB));
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: aceitou "concluída" sem resultado das tarefas'; END IF;
  v_ok := FALSE;
  BEGIN PERFORM public.pmoc_salvar_execucao(v_task, v_eq1, jsonb_build_object('status', 'nao_atendido', 'unattended_reason', 'Aparelho desligado',
            'photo_urls', jsonb_build_array('http://inseguro.exemplo/foto.jpg')));
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: aceitou foto que não é https'; END IF;
  v_log := v_log || E'\nOK  barrou não atendido sem motivo, concluída sem tarefas e foto sem https';

  PERFORM public.pmoc_salvar_execucao(v_task, v_eq1, jsonb_build_object('status', 'nao_atendido', 'unattended_reason', 'Aparelho desligado'));

  -- Concluir com aparelho pendente: barrado
  v_ok := FALSE;
  BEGIN PERFORM public.pmoc_concluir_checklist(v_task, 'Maria da Recepção');
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: concluiu o checklist com aparelho pendente'; END IF;

  -- Segundo aparelho: resultado "feito" em todas as tarefas do mês + medições
  v_chk := public.pmoc_checklist_atividade(v_task);
  SELECT jsonb_agg(jsonb_build_object('equipment_task_id', t ->> 'id', 'description', t ->> 'description',
                                       'periodicity', t ->> 'periodicity', 'result', 'feito', 'notes', NULL))
    INTO v_resultados
    FROM jsonb_array_elements((SELECT e -> 'scheduled_tasks' FROM jsonb_array_elements(v_chk -> 'equipments') e
                                WHERE e ->> 'plan_equipment_id' = v_eq2::TEXT)) t;
  PERFORM public.pmoc_salvar_execucao(v_task, v_eq2, jsonb_build_object('status', 'concluida', 'task_results', v_resultados,
    'measurements', jsonb_build_object('current_a', 7.5, 'temp_supply_c', 12, 'temp_return_c', 24, 'temp_ambient_c', 25),
    'photo_urls', jsonb_build_array('https://control.brvniteroi.com.br/api/uploads/teste.jpg')));
  v_log := v_log || E'\nOK  salvou um aparelho não atendido (com motivo) e outro concluído (com medições e foto)';

  -- Concluir sem o nome: barrado; com o nome: grava e cria o link do relatório
  v_ok := FALSE;
  BEGIN PERFORM public.pmoc_concluir_checklist(v_task, '   ');
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: concluiu sem o nome de quem acompanhou'; END IF;
  PERFORM public.pmoc_concluir_checklist(v_task, 'Maria da Recepção');
  IF (SELECT count(*) FROM public.pmoc_executions WHERE task_id = v_task AND accompanied_by = 'Maria da Recepção') <> 2 THEN
    RAISE EXCEPTION 'FALHOU: o nome de quem acompanhou não foi gravado nos 2 aparelhos';
  END IF;
  v_log := v_log || E'\nOK  conclusão exige todos os aparelhos e o nome de quem acompanhou';

  -- 7. Outro técnico não mexe na atividade
  IF v_perfil_tec IS NOT NULL AND v_emp_outro IS NOT NULL THEN
    RESET ROLE;
    UPDATE public.tasks SET employee_id = v_emp_outro WHERE id = v_task;
    SET LOCAL ROLE authenticated;
    v_ok := FALSE;
    BEGIN PERFORM public.pmoc_checklist_atividade(v_task);
    EXCEPTION WHEN insufficient_privilege THEN v_ok := TRUE; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: técnico leu o checklist de atividade de outro técnico'; END IF;
    v_ok := FALSE;
    BEGIN PERFORM public.pmoc_salvar_execucao(v_task, v_eq1, jsonb_build_object('status', 'nao_atendido', 'unattended_reason', 'x'));
    EXCEPTION WHEN insufficient_privilege THEN v_ok := TRUE; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: técnico gravou checklist de atividade de outro técnico'; END IF;
    v_ok := FALSE;
    BEGIN PERFORM public.pmoc_gerar_os_mes(v_plano, v_mes, v_emp_outro, NOW(), 30);
    EXCEPTION WHEN insufficient_privilege THEN v_ok := TRUE; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: técnico conseguiu gerar OS do mês'; END IF;
    v_log := v_log || E'\nOK  técnico só mexe na própria atividade e não gera OS do mês';
    -- volta para o Braulio
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_braulio, 'role', 'authenticated')::text, TRUE);
    PERFORM set_config('request.jwt.claim.sub', v_braulio::text, TRUE);
    SET LOCAL ROLE authenticated;
  ELSE
    v_log := v_log || E'\nINFO sem técnico com login e outro funcionário para testar o bloqueio entre técnicos';
  END IF;

  -- 8. Link do relatório (escritório)
  v_tok := public.pmoc_link_relatorio(v_plano, v_mes);
  IF v_tok IS NULL OR length(v_tok) <> 32 THEN RAISE EXCEPTION 'FALHOU: link do relatório inválido'; END IF;
  IF public.pmoc_link_relatorio(v_plano, v_mes) <> v_tok THEN RAISE EXCEPTION 'FALHOU: o link do mês mudou na segunda chamada'; END IF;
  v_log := v_log || E'\nOK  link do relatório criado e estável';

  -- 9. Etiqueta na fila da Elgin
  INSERT INTO public.print_jobs (kind, payload, copies) VALUES ('etiqueta_pmoc', '^XA^FDteste^FS^XZ', 1);
  v_log := v_log || E'\nOK  fila de impressão aceita etiqueta_pmoc';

  -- 10. Páginas públicas (sem login)
  SELECT e.public_token INTO v_tok_eq FROM public.equipments e WHERE e.id = v_aparelho;
  RESET ROLE;
  SET LOCAL ROLE anon;
  v_r := public.pmoc_relatorio_publico(v_tok);
  IF v_r IS NULL THEN RAISE EXCEPTION 'FALHOU: relatório público não abriu com o token'; END IF;
  IF (v_r -> 'plan') ? 'responsible_cpf' OR (v_r -> 'plan') ? 'customer_document' OR (v_r -> 'plan') ? 'notes' THEN
    RAISE EXCEPTION 'FALHOU: o relatório público vazou CPF, CNPJ ou observação interna';
  END IF;
  IF jsonb_array_length(v_r -> 'executions') <> 2 THEN RAISE EXCEPTION 'FALHOU: relatório público deveria trazer 2 execuções'; END IF;
  IF public.pmoc_relatorio_publico('token-que-nao-existe') IS NOT NULL THEN RAISE EXCEPTION 'FALHOU: token falso abriu relatório'; END IF;

  v_r := public.pmoc_equipamento_publico(v_tok_eq);
  IF v_r IS NULL OR NOT (v_r ->> 'has_active_plan')::BOOLEAN THEN RAISE EXCEPTION 'FALHOU: ficha do aparelho não abriu ou sem plano vigente: %', v_r; END IF;
  IF v_r::TEXT ~* '(11\.222\.333|529\.982|Rua Teste PMOC|observação interna)' THEN RAISE EXCEPTION 'FALHOU: ficha pública vazou dado pessoal ou endereço'; END IF;
  IF jsonb_array_length(v_r -> 'recent_maintenances') <> 1 OR (v_r -> 'recent_maintenances' -> 0 ->> 'report_token') IS NULL THEN
    RAISE EXCEPTION 'FALHOU: histórico do aparelho deveria ter 1 manutenção com link do relatório: %', v_r -> 'recent_maintenances';
  END IF;
  IF public.pmoc_equipamento_publico('token-que-nao-existe') IS NOT NULL THEN RAISE EXCEPTION 'FALHOU: token falso abriu a ficha'; END IF;
  v_log := v_log || E'\nOK  páginas públicas abrem só com o token, sem CPF/CNPJ/endereço/observação';

  -- 11. Sem login não gera OS, não lê links e não usa o checklist
  v_ok := FALSE;
  BEGIN PERFORM public.pmoc_gerar_os_mes(v_plano, v_mes, v_emp_outro, NOW(), 30);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: anon conseguiu chamar pmoc_gerar_os_mes'; END IF;
  v_ok := FALSE;
  BEGIN PERFORM public.pmoc_checklist_atividade(v_task);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: anon conseguiu chamar pmoc_checklist_atividade'; END IF;
  v_ok := FALSE;
  BEGIN PERFORM count(*) FROM public.pmoc_report_links;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: anon leu a tabela de links'; END IF;
  v_log := v_log || E'\nOK  sem login não gera OS, não vê checklist nem a tabela de links';
  RESET ROLE;

  RAISE EXCEPTION 'TUDO CERTO (o erro é só para desfazer o teste):%', v_log;
END
$verificacao$;
