-- =====================================================================
-- Verificação da migration 20261127100000_virada_10_01_2027.sql (só lê).
-- É UM bloco DO que DÁ ERRO DE PROPÓSITO no fim: "TUDO CERTO ..." = passou; "FALHOU ..." = me mande o texto.
-- =====================================================================
DO $verificacao$
DECLARE
  v_sicweb BIGINT; v_base BIGINT; v_ultimo DATE;
BEGIN
  IF public.virada_sicweb() <> DATE '2027-01-10' THEN
    RAISE EXCEPTION 'FALHOU 1: a data da virada é %.', public.virada_sicweb();
  END IF;

  -- Todas as vendas válidas do SicWeb anteriores à virada precisam aparecer no relatório
  SELECT count(*), max(data) INTO v_sicweb, v_ultimo
    FROM public.sicweb_vendas WHERE NOT cancelada AND data < DATE '2027-01-10';
  SELECT count(*) INTO v_base FROM public.relatorio_vendas_base WHERE origem = 'sicweb';
  IF v_base <> v_sicweb THEN
    RAISE EXCEPTION 'FALHOU 2: o relatório tem % vendas do SicWeb e deveria ter %.', v_base, v_sicweb;
  END IF;

  -- Vendas feitas no Control antes da virada (testes) ficam de fora
  IF EXISTS (SELECT 1 FROM public.relatorio_vendas_base WHERE origem = 'control' AND data < DATE '2027-01-10') THEN
    RAISE EXCEPTION 'FALHOU 3: venda do Control anterior à virada entrou no relatório.';
  END IF;

  IF has_function_privilege('anon', 'public.virada_sicweb()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU 4: anon tem acesso.';
  END IF;
  RAISE EXCEPTION 'TUDO CERTO (virada em 10/01/2027; % vendas do SicWeb no relatório, a última em %; o erro é de propósito).', v_base, v_ultimo;
END $verificacao$;
