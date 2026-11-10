-- =====================================================================
-- Verificação do banco das placas (migration 20261110100000_placas_base.sql).
-- Colar no SQL Editor DEPOIS de aplicar a migration. Roda tudo numa transação e termina com ROLLBACK:
-- não deixa nenhum dado. Cada passo mostra "OK ..." (aba Messages/Notices); se algo estiver errado,
-- para com "FALHOU: ...".
--
-- Usa os logins reais pelo e-mail (só para o banco enxergar o papel): Braulio (admin com a marca do
-- financeiro), Adriana (admin sem a marca) e o Pedro (escritório). Se algum e-mail mudou, ajuste abaixo.
-- =====================================================================
BEGIN;

-- Ajudantes (somem no ROLLBACK)
CREATE FUNCTION public.zz_como(p_email TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM public.profiles WHERE email = p_email;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Perfil % não existe', p_email; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_id, 'role', 'authenticated')::text, TRUE);
  PERFORM set_config('request.jwt.claim.sub', v_id::text, TRUE);
  PERFORM set_config('role', 'authenticated', TRUE);
END $$;

-- Passa se o comando der erro OU não afetar nenhuma linha (RLS barra UPDATE/DELETE sem erro)
CREATE FUNCTION public.zz_deve_barrar(p_sql TEXT, p_msg TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE n BIGINT;
BEGIN
  BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS n = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'OK   barrou: % -> %', p_msg, SQLERRM;
    RETURN;
  END;
  IF n = 0 THEN
    RAISE NOTICE 'OK   barrou: % -> nenhuma linha afetada', p_msg;
    RETURN;
  END IF;
  RAISE EXCEPTION 'FALHOU: "%" deveria ter sido barrado', p_msg;
END $$;

CREATE TABLE public.zz_ctx (chave TEXT PRIMARY KEY, valor TEXT);
GRANT ALL ON public.zz_ctx TO authenticated, anon;

-- 1. Braulio cria cliente e placa de balcão; número e histórico automáticos
SELECT public.zz_como('brvniteroi@gmail.com');
DO $$
DECLARE v_cli UUID; v_placa UUID; v_num TEXT;
BEGIN
  INSERT INTO public.board_clients (name, phone, kind, city) VALUES ('ZZ Parceiro Teste', '21999990000', 'instalador', 'Niterói') RETURNING id INTO v_cli;
  INSERT INTO public.board_orders (board_client_id, customer_kind, brand_model, board_code, reported_defect)
  VALUES (v_cli, 'instalador', 'Midea Teste 12000', 'CE-TESTE-1', 'Não liga') RETURNING id, board_number INTO v_placa, v_num;
  IF v_num !~ '^OS-[0-9]{6}-[0-9]{3}$' THEN RAISE EXCEPTION 'FALHOU: número fora do formato: %', v_num; END IF;
  IF (SELECT count(*) FROM public.board_events WHERE board_order_id = v_placa AND event_type = 'entrada') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: faltou o evento de entrada';
  END IF;
  INSERT INTO public.zz_ctx VALUES ('placa', v_placa::text), ('cli', v_cli::text), ('num', v_num);
  RAISE NOTICE 'OK   placa criada com número % e histórico de entrada', v_num;
END $$;

-- 2. Segunda placa no mesmo dia = sequência seguinte
DO $$
DECLARE v_num TEXT; v_ant TEXT := (SELECT valor FROM public.zz_ctx WHERE chave = 'num');
BEGIN
  INSERT INTO public.board_orders (board_client_id, customer_kind, brand_model, board_code, reported_defect)
  VALUES ((SELECT valor::uuid FROM public.zz_ctx WHERE chave = 'cli'), 'instalador', 'LG Teste', 'LG-2', 'Erro CH05') RETURNING board_number INTO v_num;
  IF right(v_num, 3)::int <> right(v_ant, 3)::int + 1 THEN RAISE EXCEPTION 'FALHOU: sequência % depois de %', v_num, v_ant; END IF;
  RAISE NOTICE 'OK   sequência do dia: % depois de %', v_num, v_ant;
END $$;

-- 3. Regras de etapa e orçamento
SELECT public.zz_deve_barrar(
  format('UPDATE public.board_orders SET status = %L WHERE id = %L', 'em_reparo', (SELECT valor FROM public.zz_ctx WHERE chave = 'placa')::uuid),
  'ir para Em Reparo sem orçamento aprovado');
SELECT public.zz_deve_barrar(
  format('UPDATE public.board_orders SET quote_status = %L WHERE id = %L', 'enviado', (SELECT valor FROM public.zz_ctx WHERE chave = 'placa')::uuid),
  'enviar orçamento sem valor e parecer');
SELECT public.zz_deve_barrar(
  format('UPDATE public.board_orders SET board_number = %L WHERE id = %L', 'OS-000000-000', (SELECT valor FROM public.zz_ctx WHERE chave = 'placa')::uuid),
  'mudar o número da placa');

DO $$
DECLARE v_id UUID := (SELECT valor::uuid FROM public.zz_ctx WHERE chave = 'placa');
BEGIN
  UPDATE public.board_orders SET quote_amount = 350, quote_technical_opinion = 'Trocar IPM' WHERE id = v_id;
  UPDATE public.board_orders SET quote_status = 'enviado' WHERE id = v_id;
  PERFORM public.zz_deve_barrar(format('UPDATE public.board_orders SET quote_status = %L WHERE id = %L', 'aprovado', v_id),
                                'aprovar sem informar o canal da resposta');
  UPDATE public.board_orders SET quote_status = 'aprovado', quote_response_channel = 'whatsapp' WHERE id = v_id;
  IF (SELECT quote_responded_by FROM public.board_orders WHERE id = v_id) IS NULL THEN RAISE EXCEPTION 'FALHOU: faltou quem respondeu'; END IF;
  UPDATE public.board_orders SET status = 'aguardando_peca' WHERE id = v_id;
  UPDATE public.board_orders SET status = 'em_reparo' WHERE id = v_id;
  UPDATE public.board_orders SET status = 'teste' WHERE id = v_id;
  PERFORM public.zz_deve_barrar(format('UPDATE public.board_orders SET status = %L WHERE id = %L', 'entregue', v_id), 'entregar sem passar por Pronto');
  UPDATE public.board_orders SET status = 'pronto' WHERE id = v_id;
  PERFORM public.zz_deve_barrar(format('UPDATE public.board_orders SET status = %L WHERE id = %L', 'sem_conserto', v_id), 'sem conserto sem motivo');
  UPDATE public.board_orders SET status = 'entregue' WHERE id = v_id;
  IF (SELECT finished_at FROM public.board_orders WHERE id = v_id) IS NULL THEN RAISE EXCEPTION 'FALHOU: faltou a data de saída'; END IF;
  RAISE NOTICE 'OK   fluxo completo: orçamento, aprovação, etapas até Entregue, com data de saída';
END $$;

-- 4. Financeiro: Braulio grava; Adriana (admin sem a marca) não vê nem grava; a marca não é auto-concedida
DO $$
DECLARE v_id UUID := (SELECT valor::uuid FROM public.zz_ctx WHERE chave = 'placa');
BEGIN
  INSERT INTO public.board_finance (board_order_id, charged_amount) VALUES (v_id, 350);
  UPDATE public.board_finance SET refunded = TRUE, refund_amount = 350, refunded_at = CURRENT_DATE, refund_reason = 'Teste' WHERE board_order_id = v_id;
  IF NOT public.tem_financeiro_placas() THEN RAISE EXCEPTION 'FALHOU: Braulio devia ter acesso ao financeiro'; END IF;
  IF (SELECT count(*) FROM public.board_events WHERE board_order_id = v_id AND visibility = 'financeiro') < 2 THEN
    RAISE EXCEPTION 'FALHOU: faltaram eventos financeiros no histórico';
  END IF;
  RAISE NOTICE 'OK   Braulio grava e vê o financeiro (valor cobrado e reembolso, com histórico)';
END $$;
RESET ROLE;

SELECT public.zz_como('brvloja@brvniteroi.com.br');
DO $$
DECLARE v_id UUID := (SELECT valor::uuid FROM public.zz_ctx WHERE chave = 'placa');
BEGIN
  IF public.tem_financeiro_placas() THEN RAISE EXCEPTION 'FALHOU: Adriana não devia ter o financeiro das placas'; END IF;
  IF (SELECT count(*) FROM public.board_finance) <> 0 THEN RAISE EXCEPTION 'FALHOU: Adriana enxergou linhas do financeiro'; END IF;
  IF (SELECT count(*) FROM public.board_events WHERE board_order_id = v_id AND visibility = 'financeiro') <> 0 THEN
    RAISE EXCEPTION 'FALHOU: Adriana enxergou eventos financeiros';
  END IF;
  IF (SELECT count(*) FROM public.board_orders WHERE id = v_id) <> 1 THEN RAISE EXCEPTION 'FALHOU: Adriana devia ver a placa'; END IF;
  RAISE NOTICE 'OK   Adriana vê a placa e o orçamento, mas não o financeiro';
END $$;
SELECT public.zz_deve_barrar(
  format('INSERT INTO public.board_finance (board_order_id, charged_amount) VALUES (%L, 1)', (SELECT valor FROM public.zz_ctx WHERE chave = 'placa')::uuid),
  'Adriana gravar no financeiro');
SELECT public.zz_deve_barrar(
  format('UPDATE public.profiles SET board_finance_access = TRUE WHERE email = %L', 'brvloja@brvniteroi.com.br'),
  'Adriana dar a si mesma o acesso ao financeiro');

-- 5. Placa finalizada: ninguém edita; só o administrador reabre; escritório não reabre nem exclui
SELECT public.zz_deve_barrar(
  format('UPDATE public.board_orders SET technical_diagnosis = %L WHERE id = %L', 'mudei', (SELECT valor FROM public.zz_ctx WHERE chave = 'placa')::uuid),
  'editar placa finalizada');
RESET ROLE;

SELECT public.zz_como('pedro.lv@brvniteroi.com.br');
SELECT public.zz_deve_barrar(
  format('UPDATE public.board_orders SET status = %L WHERE id = %L', 'pronto', (SELECT valor FROM public.zz_ctx WHERE chave = 'placa')::uuid),
  'escritório reabrir placa finalizada');
SELECT public.zz_deve_barrar(
  format('DELETE FROM public.board_orders WHERE id = %L', (SELECT valor FROM public.zz_ctx WHERE chave = 'placa')::uuid),
  'escritório excluir placa (só admin)');
RESET ROLE;

SELECT public.zz_como('brvniteroi@gmail.com');
DO $$
DECLARE v_id UUID := (SELECT valor::uuid FROM public.zz_ctx WHERE chave = 'placa');
BEGIN
  UPDATE public.board_orders SET status = 'pronto' WHERE id = v_id;
  IF (SELECT finished_at FROM public.board_orders WHERE id = v_id) IS NOT NULL THEN RAISE EXCEPTION 'FALHOU: reabrir devia limpar a saída'; END IF;
  RAISE NOTICE 'OK   administrador reabriu a placa (saída limpa)';
END $$;

-- 6. Histórico: só nota pela tela, nunca alterar nem apagar
DO $$
DECLARE v_id UUID := (SELECT valor::uuid FROM public.zz_ctx WHERE chave = 'placa');
BEGIN
  INSERT INTO public.board_events (board_order_id, event_type, note) VALUES (v_id, 'nota', 'Teste de nota');
  PERFORM public.zz_deve_barrar(format('INSERT INTO public.board_events (board_order_id, event_type, note) VALUES (%L, %L, %L)', v_id, 'edicao_campo', 'x'), 'escrever evento que não é nota');
  PERFORM public.zz_deve_barrar(format('UPDATE public.board_events SET note = %L WHERE board_order_id = %L', 'x', v_id), 'alterar o histórico');
  PERFORM public.zz_deve_barrar(format('DELETE FROM public.board_events WHERE board_order_id = %L', v_id), 'apagar o histórico');
  RAISE NOTICE 'OK   histórico: nota entra; alterar e apagar são barrados';
END $$;
RESET ROLE;

-- 7. Quem não é escritório (oficina, técnico) não enxerga placas nem clientes de placas
DO $$
DECLARE v_emails TEXT[]; v_email TEXT;
BEGIN
  SELECT coalesce(array_agg(email), ARRAY[]::TEXT[]) INTO v_emails
    FROM (SELECT email FROM public.profiles WHERE role IN ('oficina', 'tecnico') AND active ORDER BY role LIMIT 2) t;
  FOREACH v_email IN ARRAY v_emails LOOP
    PERFORM public.zz_como(v_email);
    IF (SELECT count(*) FROM public.board_orders) <> 0 OR (SELECT count(*) FROM public.board_clients) <> 0 THEN
      RAISE EXCEPTION 'FALHOU: % enxergou placas ou clientes de placas', v_email;
    END IF;
    RESET ROLE;
    RAISE NOTICE 'OK   % não enxerga placas nem clientes de placas', v_email;
  END LOOP;
END $$;
RESET ROLE;

-- 8. Página pública: sem login, só com o token; token errado não devolve nada; anon não lê as tabelas
DO $$
DECLARE v_tok TEXT; r JSONB;
BEGIN
  SELECT public_token INTO v_tok FROM public.board_orders WHERE id = (SELECT valor::uuid FROM public.zz_ctx WHERE chave = 'placa');
  PERFORM set_config('role', 'anon', TRUE);
  r := public.placa_acompanhamento(v_tok);
  IF r IS NULL OR r ->> 'board_number' IS NULL THEN RAISE EXCEPTION 'FALHOU: a página pública devia achar a placa'; END IF;
  IF jsonb_exists(r, 'quote_amount') OR jsonb_exists(r, 'technical_diagnosis') OR jsonb_exists(r, 'refund_amount') THEN
    RAISE EXCEPTION 'FALHOU: a página pública vazou dado interno';
  END IF;
  IF public.placa_acompanhamento(repeat('a', 64)) IS NOT NULL THEN RAISE EXCEPTION 'FALHOU: token errado devolveu algo'; END IF;
  PERFORM public.zz_deve_barrar('SELECT count(*) FROM public.board_orders', 'anon ler a tabela de placas');
  RAISE NOTICE 'OK   página pública: acha pelo token, não vaza dado interno e anon não lê as tabelas';
END $$;
RESET ROLE;

-- Fim: desfaz tudo
ROLLBACK;
SELECT 'Verificação das placas terminou sem erro. Nada foi gravado (ROLLBACK).' AS resultado;
