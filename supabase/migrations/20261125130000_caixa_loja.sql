-- =====================================================================
-- Financeiro, parte 3a: caixa físico da loja (2026-11-25).
--
-- Regras:
--   * Um caixa aberto por vez, na conta de dinheiro (Caixa BRV).
--   * O caixa não tem lista própria de lançamentos: são os movimentos financeiros da conta. Todo movimento
--     dela feito com o caixa aberto (venda em dinheiro, estorno, reforço, retirada...) é ligado à sessão
--     por um gatilho. Recebimento com data anterior à abertura não entra na sessão (o dinheiro é de outro dia).
--   * O saldo da conta acompanha a gaveta: se o valor contado na abertura ou no fechamento for diferente do
--     esperado, o motivo é obrigatório e o banco grava um movimento de ajuste (fora da sessão).
--     Na primeira abertura o ajuste é o próprio saldo inicial.
--   * Reforço, retirada e ajuste têm origem "caixa" e não têm categoria: não são receita nem despesa.
--   * Operar o caixa exige nível financeiro "caixa" ou "completo".
--
-- Colar no SQL Editor do projeto BRV Control.
-- =====================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado')),
  opened_date DATE NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_by UUID DEFAULT auth.uid(),
  opened_by_name TEXT NOT NULL,
  opening_balance_cents BIGINT NOT NULL CHECK (opening_balance_cents >= 0),
  expected_balance_cents BIGINT,                 -- gravado no fechamento
  counted_balance_cents BIGINT CHECK (counted_balance_cents >= 0),
  difference_cents BIGINT,
  difference_reason TEXT,
  closed_at TIMESTAMPTZ,
  closed_by UUID,
  closed_by_name TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS cash_sessions_um_aberto ON public.cash_sessions ((TRUE)) WHERE status = 'aberto';
CREATE INDEX IF NOT EXISTS cash_sessions_data_idx ON public.cash_sessions (opened_at DESC);

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cash_sessions FROM anon;
DROP POLICY IF EXISTS "Financeiro lê" ON public.cash_sessions;
CREATE POLICY "Financeiro lê" ON public.cash_sessions FOR SELECT TO authenticated
  USING ((SELECT public.nivel_financeiro()) IN ('caixa', 'completo'));
-- Nenhuma política de escrita: só as funções caixa_*

ALTER TABLE public.financial_movements
  ADD COLUMN IF NOT EXISTS cash_session_id UUID REFERENCES public.cash_sessions(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS financial_movements_caixa_idx ON public.financial_movements (cash_session_id)
  WHERE cash_session_id IS NOT NULL;

-- Liga o movimento ao caixa aberto. O FOR SHARE faz o fechamento esperar (e vice-versa).
CREATE OR REPLACE FUNCTION public.movimento_no_caixa()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  NEW.cash_session_id := NULL;
  SELECT c.id INTO NEW.cash_session_id
    FROM public.cash_sessions c
   WHERE c.status = 'aberto' AND c.account_id = NEW.account_id
     AND NEW.occurred_date BETWEEN c.opened_date AND public.hoje_local()
     FOR SHARE;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.movimento_no_caixa() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS financial_movements_no_caixa ON public.financial_movements;
CREATE TRIGGER financial_movements_no_caixa BEFORE INSERT ON public.financial_movements
  FOR EACH ROW EXECUTE FUNCTION public.movimento_no_caixa();

-- ---------------------------------------------------------------------
-- Apoio (uso interno)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.caixa_exige_acesso()
RETURNS VOID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF public.nivel_financeiro() NOT IN ('caixa', 'completo') THEN
    RAISE EXCEPTION 'Seu usuário não tem acesso ao caixa.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.caixa_exige_acesso() FROM PUBLIC, anon, authenticated;

-- Saldo da conta de dinheiro até hoje, pelos movimentos
CREATE OR REPLACE FUNCTION public.caixa_saldo_conta(p_conta UUID)
RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT (a.initial_balance_cents + coalesce((
           SELECT sum(CASE WHEN m.direction = 'entrada' THEN m.amount_cents ELSE -m.amount_cents END)
             FROM public.financial_movements m
            WHERE m.account_id = a.id AND m.occurred_date <= public.hoje_local()), 0))::bigint
    FROM public.financial_accounts a
   WHERE a.id = p_conta;
$$;
REVOKE EXECUTE ON FUNCTION public.caixa_saldo_conta(UUID) FROM PUBLIC, anon, authenticated;

-- Sessão em JSON (tipo CashSession de src/types/financeiro.ts)
CREATE OR REPLACE FUNCTION public.caixa_sessao_json(p_id UUID, p_com_lancamentos BOOLEAN)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH totais AS (
    SELECT coalesce(sum(m.amount_cents) FILTER (WHERE m.direction = 'entrada'), 0)::bigint AS entradas,
           coalesce(sum(m.amount_cents) FILTER (WHERE m.direction = 'saida'), 0)::bigint AS saidas
      FROM public.financial_movements m
     WHERE m.cash_session_id = p_id
  )
  SELECT jsonb_build_object(
           'id', c.id, 'status', c.status, 'opened_date', c.opened_date, 'opened_at', c.opened_at,
           'opened_by_name', c.opened_by_name, 'opening_balance_cents', c.opening_balance_cents,
           'entries_in_cents', t.entradas, 'entries_out_cents', t.saidas,
           'expected_balance_cents', coalesce(c.expected_balance_cents, c.opening_balance_cents + t.entradas - t.saidas),
           'counted_balance_cents', c.counted_balance_cents, 'difference_cents', c.difference_cents,
           'difference_reason', c.difference_reason, 'closed_at', c.closed_at, 'closed_by_name', c.closed_by_name,
           'entries', CASE WHEN NOT p_com_lancamentos THEN '[]'::jsonb ELSE coalesce((
               SELECT jsonb_agg(jsonb_build_object(
                        'id', m.id, 'session_id', m.cash_session_id,
                        'kind', CASE
                                  WHEN m.reverses_movement_id IS NOT NULL THEN 'estorno'
                                  WHEN m.origin_type = 'venda' THEN 'venda_dinheiro'
                                  WHEN m.origin_type = 'os' THEN 'recebimento_os'
                                  WHEN m.origin_type = 'caixa' AND m.direction = 'entrada' THEN 'reforco'
                                  WHEN m.origin_type = 'caixa' THEN 'sangria'
                                  ELSE 'outro'
                                END,
                        'direction', m.direction, 'amount_cents', m.amount_cents, 'description', m.description,
                        'origin_label', coalesce(
                            (SELECT s.number FROM public.sales s WHERE s.id = m.sale_id),
                            (SELECT 'OS ' || o.number FROM public.service_orders o WHERE o.id = m.service_order_id)),
                        'created_by_name', m.created_by_name, 'created_at', m.created_at)
                      ORDER BY m.created_at DESC, m.id)
                 FROM public.financial_movements m
                WHERE m.cash_session_id = c.id), '[]'::jsonb) END)
    FROM public.cash_sessions c CROSS JOIN totais t
   WHERE c.id = p_id;
$$;
REVOKE EXECUTE ON FUNCTION public.caixa_sessao_json(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;

-- Movimento do próprio caixa: reforço, retirada ou ajuste de contagem
CREATE OR REPLACE FUNCTION public.caixa_movimento(p_conta UUID, p_direcao TEXT, p_valor BIGINT, p_texto TEXT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  INSERT INTO public.financial_movements (occurred_date, direction, amount_cents, account_id, method, origin_type,
                                          description, created_by_name, created_at)
  VALUES (public.hoje_local(), p_direcao, p_valor, p_conta, 'dinheiro', 'caixa',
          p_texto, public.vendas_ator_nome(), clock_timestamp());
$$;
REVOKE EXECUTE ON FUNCTION public.caixa_movimento(UUID, TEXT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- Funções da tela
-- ---------------------------------------------------------------------
-- Caixa aberto (ou null) e, com ele fechado, quanto o sistema espera encontrar na gaveta
CREATE OR REPLACE FUNCTION public.caixa_situacao()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_sessao UUID;
  v_conta UUID;
BEGIN
  PERFORM public.caixa_exige_acesso();
  SELECT id INTO v_sessao FROM public.cash_sessions WHERE status = 'aberto';
  SELECT id INTO v_conta FROM public.financial_accounts WHERE active AND kind = 'caixa' ORDER BY sort_order, name LIMIT 1;
  RETURN jsonb_build_object(
    'sessao', CASE WHEN v_sessao IS NULL THEN NULL ELSE public.caixa_sessao_json(v_sessao, TRUE) END,
    'esperado_abertura_cents', CASE WHEN v_sessao IS NULL THEN coalesce(public.caixa_saldo_conta(v_conta), 0) END,
    'primeira_abertura', NOT EXISTS (SELECT 1 FROM public.cash_sessions));
END;
$$;

CREATE OR REPLACE FUNCTION public.caixa_abrir(p_contado BIGINT, p_motivo TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_conta UUID;
  v_esperado BIGINT;
  v_dif BIGINT;
  v_motivo TEXT := nullif(btrim(coalesce(p_motivo, '')), '');
  v_primeira BOOLEAN;
  v_id UUID;
BEGIN
  PERFORM public.caixa_exige_acesso();
  IF p_contado IS NULL OR p_contado < 0 THEN
    RAISE EXCEPTION 'Informe o valor contado na gaveta.' USING ERRCODE = '23514';
  END IF;
  -- A trava na conta segura outra abertura e um movimento simultâneo
  SELECT id INTO v_conta FROM public.financial_accounts
   WHERE active AND kind = 'caixa' ORDER BY sort_order, name LIMIT 1 FOR UPDATE;
  IF v_conta IS NULL THEN
    RAISE EXCEPTION 'Cadastre uma conta do tipo caixa nos cadastros do financeiro.' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.cash_sessions WHERE status = 'aberto') THEN
    RAISE EXCEPTION 'Já existe um caixa aberto. Feche o caixa atual antes de abrir outro.' USING ERRCODE = '23514';
  END IF;

  v_primeira := NOT EXISTS (SELECT 1 FROM public.cash_sessions);
  v_esperado := public.caixa_saldo_conta(v_conta);
  v_dif := p_contado - v_esperado;
  IF v_dif <> 0 THEN
    IF v_motivo IS NULL AND NOT v_primeira THEN
      RAISE EXCEPTION 'O sistema espera % na gaveta e foram contados %. Informe o motivo da diferença.',
        public.formatar_reais(v_esperado), public.formatar_reais(p_contado) USING ERRCODE = '23514';
    END IF;
    -- Antes de criar a sessão: o ajuste não é um lançamento dela
    PERFORM public.caixa_movimento(v_conta, CASE WHEN v_dif > 0 THEN 'entrada' ELSE 'saida' END, abs(v_dif),
      CASE WHEN v_primeira THEN 'Saldo de abertura do caixa' ELSE 'Ajuste na abertura do caixa' END
      || coalesce(': ' || v_motivo, ''));
  END IF;

  INSERT INTO public.cash_sessions (account_id, opened_date, opened_by_name, opening_balance_cents)
  VALUES (v_conta, public.hoje_local(), public.vendas_ator_nome(), p_contado)
  RETURNING id INTO v_id;
  RETURN public.caixa_sessao_json(v_id, TRUE);
END;
$$;

-- Reforço (entra dinheiro) ou retirada/sangria (sai dinheiro)
CREATE OR REPLACE FUNCTION public.caixa_lancar(p_tipo TEXT, p_valor BIGINT, p_motivo TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  c public.cash_sessions%ROWTYPE;
  v_motivo TEXT := btrim(coalesce(p_motivo, ''));
  v_gaveta BIGINT;
BEGIN
  PERFORM public.caixa_exige_acesso();
  IF p_tipo IS NULL OR p_tipo NOT IN ('reforco', 'sangria') THEN
    RAISE EXCEPTION 'Tipo de lançamento inválido.' USING ERRCODE = '23514';
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Informe um valor maior que zero.' USING ERRCODE = '23514';
  END IF;
  IF v_motivo = '' THEN
    RAISE EXCEPTION 'Informe o motivo do lançamento no caixa.' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO c FROM public.cash_sessions WHERE status = 'aberto' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'O caixa está fechado. Abra o caixa antes de lançar.' USING ERRCODE = '23514';
  END IF;
  IF p_tipo = 'sangria' THEN
    v_gaveta := (public.caixa_sessao_json(c.id, FALSE)->>'expected_balance_cents')::bigint;
    IF p_valor > v_gaveta THEN
      RAISE EXCEPTION 'A retirada (%) é maior que o dinheiro na gaveta (%).',
        public.formatar_reais(p_valor), public.formatar_reais(v_gaveta) USING ERRCODE = '23514';
    END IF;
  END IF;
  PERFORM public.caixa_movimento(c.account_id, CASE p_tipo WHEN 'reforco' THEN 'entrada' ELSE 'saida' END, p_valor, v_motivo);
  RETURN public.caixa_sessao_json(c.id, TRUE);
END;
$$;

-- p_sessao: o caixa que está na tela (evita fechar um que outra pessoa abriu depois)
CREATE OR REPLACE FUNCTION public.caixa_fechar(p_sessao UUID, p_contado BIGINT, p_motivo TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  c public.cash_sessions%ROWTYPE;
  v_esperado BIGINT;
  v_dif BIGINT;
  v_motivo TEXT := nullif(btrim(coalesce(p_motivo, '')), '');
BEGIN
  PERFORM public.caixa_exige_acesso();
  IF p_contado IS NULL OR p_contado < 0 THEN
    RAISE EXCEPTION 'Informe o valor contado na gaveta.' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO c FROM public.cash_sessions WHERE id = p_sessao FOR UPDATE;
  IF NOT FOUND OR c.status <> 'aberto' THEN
    RAISE EXCEPTION 'Este caixa já foi fechado. Atualize a tela.' USING ERRCODE = '23514';
  END IF;
  v_esperado := (public.caixa_sessao_json(c.id, FALSE)->>'expected_balance_cents')::bigint;
  v_dif := p_contado - v_esperado;
  IF v_dif <> 0 AND v_motivo IS NULL THEN
    RAISE EXCEPTION 'O saldo esperado é % e foram contados %. Informe a justificativa da diferença.',
      public.formatar_reais(v_esperado), public.formatar_reais(p_contado) USING ERRCODE = '23514';
  END IF;

  UPDATE public.cash_sessions SET status = 'fechado', expected_balance_cents = v_esperado, counted_balance_cents = p_contado,
         difference_cents = v_dif, difference_reason = CASE WHEN v_dif = 0 THEN NULL ELSE v_motivo END,
         closed_at = NOW(), closed_by = auth.uid(), closed_by_name = public.vendas_ator_nome()
   WHERE id = c.id;
  -- Depois de fechar: o ajuste não é um lançamento da sessão
  IF v_dif <> 0 THEN
    PERFORM public.caixa_movimento(c.account_id, CASE WHEN v_dif > 0 THEN 'entrada' ELSE 'saida' END, abs(v_dif),
      'Ajuste no fechamento do caixa: ' || v_motivo);
  END IF;
  RETURN public.caixa_sessao_json(c.id, TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.caixa_fechamentos()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM public.caixa_exige_acesso();
  RETURN coalesce((
    SELECT jsonb_agg(public.caixa_sessao_json(u.id, FALSE) ORDER BY u.opened_at DESC)
      FROM (SELECT id, opened_at FROM public.cash_sessions WHERE status = 'fechado' ORDER BY opened_at DESC LIMIT 60) u
  ), '[]'::jsonb);
END;
$$;

DO $permissoes$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY['caixa_situacao()', 'caixa_abrir(bigint, text)', 'caixa_lancar(text, bigint, text)',
                           'caixa_fechar(uuid, bigint, text)', 'caixa_fechamentos()'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END
$permissoes$;

COMMIT;
