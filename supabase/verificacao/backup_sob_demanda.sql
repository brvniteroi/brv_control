-- =====================================================================
-- Verificação do backup sob demanda (migration 20261113100000_backup_sob_demanda.sql).
-- Colar no SQL Editor DEPOIS de aplicar a migration e clicar em Run. Mesmo esquema das outras verificações:
-- é UM bloco DO que DÁ ERRO DE PROPÓSITO no fim para desfazer tudo (nada fica no banco).
--   * "TUDO CERTO ..." = passou em todas as verificações (o "erro" é só o desfazer).
--   * "FALHOU ..."     = alguma regra não funcionou (me mande o texto).
-- =====================================================================
DO $verificacao$
DECLARE
  v_admin UUID := (SELECT id FROM public.profiles WHERE email = 'brvniteroi@gmail.com');
  v_escr UUID := (SELECT id FROM public.profiles WHERE role = 'escritorio' AND active LIMIT 1);
  v_ok BOOLEAN;
  v_n BIGINT;
  v_id UUID;
  v_log TEXT := '';
BEGIN
  IF v_admin IS NULL OR v_escr IS NULL THEN
    RAISE EXCEPTION 'Perfil de administrador ou de escritório não encontrado: ajuste o e-mail no começo do script.';
  END IF;

  -- Sinal de vida do vigia (feito antes de trocar de papel, como o vigia faz com a chave de serviço)
  DELETE FROM public.backup_agent;
  DELETE FROM public.backup_runs;

  -- 1. Escritório não pede backup
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_escr, 'role', 'authenticated')::text, TRUE);
  PERFORM set_config('request.jwt.claim.sub', v_escr::text, TRUE);
  SET LOCAL ROLE authenticated;
  v_ok := FALSE;
  BEGIN
    PERFORM public.backup_solicitar();
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: o escritório conseguiu pedir backup'; END IF;
  v_log := v_log || E'\nOK  escritório não pede backup';
  RESET ROLE;

  -- 2. Administrador sem o PC online (sem sinal de vida): barrado
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, TRUE);
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, TRUE);
  SET LOCAL ROLE authenticated;
  v_ok := FALSE;
  BEGIN
    PERFORM public.backup_solicitar();
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: pediu backup com o PC da empresa offline'; END IF;
  v_log := v_log || E'\nOK  com o PC offline o pedido é barrado';
  RESET ROLE;

  -- 3. Com o PC online, o administrador pede
  INSERT INTO public.backup_agent (id, last_seen, info) VALUES (1, NOW(), '{"teste": true}');
  SET LOCAL ROLE authenticated;
  v_id := public.backup_solicitar();
  IF v_id IS NULL THEN RAISE EXCEPTION 'FALHOU: administrador com o PC online não conseguiu pedir'; END IF;
  v_log := v_log || E'\nOK  administrador com o PC online pede o backup';

  -- 4. Segundo pedido enquanto há um pendente: barrado
  v_ok := FALSE;
  BEGIN
    PERFORM public.backup_solicitar();
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: deixou pedir um segundo backup com um pendente'; END IF;
  v_log := v_log || E'\nOK  segundo pedido com um pendente é barrado';

  -- 5. Administrador lê; não escreve direto
  SELECT count(*) INTO v_n FROM public.backup_runs;
  IF v_n <> 1 THEN RAISE EXCEPTION 'FALHOU: administrador devia ver 1 backup, viu %', v_n; END IF;
  v_ok := FALSE;
  BEGIN
    UPDATE public.backup_runs SET status = 'ok' WHERE id = v_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_ok := (v_n = 0);
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: o navegador conseguiu alterar o resultado do backup'; END IF;
  v_log := v_log || E'\nOK  administrador lê, mas não altera o resultado';
  RESET ROLE;

  -- 6. Escritório não enxerga nada da tabela
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_escr, 'role', 'authenticated')::text, TRUE);
  PERFORM set_config('request.jwt.claim.sub', v_escr::text, TRUE);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM public.backup_runs;
  IF v_n <> 0 THEN RAISE EXCEPTION 'FALHOU: o escritório viu % backup(s)', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.backup_agent;
  IF v_n <> 0 THEN RAISE EXCEPTION 'FALHOU: o escritório viu o sinal de vida do vigia'; END IF;
  v_log := v_log || E'\nOK  escritório não enxerga backups nem o vigia';
  RESET ROLE;

  -- 7. Visitante sem login (anon) não tem acesso
  SET LOCAL ROLE anon;
  v_ok := FALSE;
  BEGIN
    PERFORM count(*) FROM public.backup_runs;
  EXCEPTION WHEN OTHERS THEN v_ok := TRUE;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU: visitante sem login conseguiu ler os backups'; END IF;
  v_log := v_log || E'\nOK  visitante sem login não lê os backups';
  RESET ROLE;

  RAISE EXCEPTION 'TUDO CERTO (o erro é só para desfazer o teste):%', v_log;
END
$verificacao$;
