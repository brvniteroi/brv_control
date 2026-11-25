-- =====================================================================
-- Verificação dos orçamentos antigos (migration 20261125160000_orcamentos_sicweb.sql).
-- Colar no SQL Editor DEPOIS de aplicar a migration. É UM bloco DO que DÁ ERRO DE PROPÓSITO no fim para desfazer tudo:
--   * "TUDO CERTO ..." = passou.   * "FALHOU ..." = me mande o texto.
-- =====================================================================
DO $verificacao$
DECLARE
  v_admin UUID := (SELECT id FROM public.profiles WHERE role = 'admin' AND active ORDER BY created_at LIMIT 1);
  v_escr UUID := (SELECT id FROM public.profiles WHERE role = 'escritorio' AND active LIMIT 1);
  v_cli UUID; v_dup UUID; v_n BIGINT; v_ok BOOLEAN;
BEGIN
  INSERT INTO public.customers (person_type, name) VALUES ('PF', 'ZZ Orçamento Antigo') RETURNING id INTO v_cli;
  INSERT INTO public.customers (person_type, name) VALUES ('PF', 'ZZ Orçamento Antigo Duplicado') RETURNING id INTO v_dup;
  INSERT INTO public.sicweb_orcamentos (controle, customer_id, ligado_por, cliente_nome, data, total)
  VALUES (-1, v_dup, 'nome', 'ZZ João Orçamento', public.hoje_local(), 10);
  INSERT INTO public.sicweb_orcamento_itens (controle, orcamento_controle, produto_nome, quantidade, total) VALUES (-1, -1, 'ZZ item', 1, 10);

  -- 1. Busca sem acento, por nome e número
  SELECT count(*) INTO v_n FROM public.sicweb_orcamentos WHERE controle = -1 AND busca LIKE '%zz joao orcamento%' AND busca LIKE '-1%';
  IF v_n <> 1 THEN RAISE EXCEPTION 'FALHOU 1: busca.'; END IF;

  -- 2. unir_clientes leva o orçamento antigo
  PERFORM public.unir_clientes(v_cli, ARRAY[v_dup], FALSE);
  SELECT count(*) INTO v_n FROM public.sicweb_orcamentos WHERE controle = -1 AND customer_id = v_cli;
  IF v_n <> 1 THEN RAISE EXCEPTION 'FALHOU 2: união não levou o orçamento.'; END IF;

  -- 3. Só o admin lê; ninguém escreve
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, TRUE);
  SELECT count(*) INTO v_n FROM public.sicweb_orcamentos WHERE controle = -1;
  IF v_n <> 1 THEN RAISE EXCEPTION 'FALHOU 3: admin não leu.'; END IF;
  v_ok := FALSE;
  BEGIN UPDATE public.sicweb_orcamentos SET total = 0 WHERE controle = -1; EXCEPTION WHEN insufficient_privilege THEN v_ok := TRUE; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FALHOU 3b: admin alterou.'; END IF;
  IF v_escr IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_escr, 'role', 'authenticated')::text, TRUE);
    SELECT (SELECT count(*) FROM public.sicweb_orcamentos) + (SELECT count(*) FROM public.sicweb_orcamento_itens) INTO v_n;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALHOU 4: quem não é admin leu.'; END IF;
  END IF;
  RESET ROLE;
  IF has_table_privilege('anon', 'public.sicweb_orcamentos', 'SELECT') THEN RAISE EXCEPTION 'FALHOU 5: anon.'; END IF;

  RAISE EXCEPTION 'TUDO CERTO (o erro é de propósito: desfaz os testes).';
END $verificacao$;
