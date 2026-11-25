-- =====================================================================
-- Financeiro, parte 3b: extrato, lançamento avulso, transferência e estorno (2026-11-25).
--
-- Regras:
--   * Só o acesso financeiro completo.
--   * Estorno pelo extrato vale só para lançamento avulso e transferência (a transferência volta inteira).
--     Movimento de venda e tarifa de cartão se desfaz cancelando a venda (senão a venda continuaria paga);
--     movimento do caixa (reforço, retirada, ajuste) se corrige no próprio Caixa.
--   * Avulso e transferência não têm data futura.
--   * Conta de dinheiro: só com a data de hoje (um gasto de ontem já virou diferença no fechamento) e a saída
--     não pode passar do saldo. Dinheiro é forma só da conta de caixa, e a conta de caixa só aceita dinheiro.
--   * Entrada usa categoria de receita; saída, de despesa. Transferência não tem categoria.
--
-- Colar no SQL Editor do projeto BRV Control.
-- =====================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.financeiro_exige_completo()
RETURNS VOID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF public.nivel_financeiro() <> 'completo' THEN
    RAISE EXCEPTION 'Só o acesso financeiro completo usa o extrato.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.financeiro_exige_completo() FROM PUBLIC, anon, authenticated;

-- Movimento em JSON (tipo FinancialMovement de src/types/financeiro.ts)
CREATE OR REPLACE FUNCTION public.movimento_json(p_id UUID, p_saldo BIGINT DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT jsonb_build_object(
           'id', m.id, 'occurred_date', m.occurred_date, 'created_at', m.created_at, 'direction', m.direction,
           'amount_cents', m.amount_cents, 'account_id', m.account_id, 'account_name', a.name,
           'category_id', m.category_id, 'category_name', c.name, 'method', m.method, 'origin_type', m.origin_type,
           'origin_id', coalesce(m.sale_id, m.service_order_id),
           'origin_label', coalesce(
               (SELECT s.number FROM public.sales s WHERE s.id = m.sale_id),
               (SELECT 'OS ' || o.number FROM public.service_orders o WHERE o.id = m.service_order_id)),
           'supplier_id', m.supplier_id, 'supplier_name', f.name, 'customer_name', m.customer_name,
           'description', m.description, 'created_by_name', m.created_by_name,
           'is_reversal', m.reverses_movement_id IS NOT NULL,
           'reverses_movement_id', m.reverses_movement_id,
           'reverses_description', (SELECT o.description FROM public.financial_movements o WHERE o.id = m.reverses_movement_id),
           'reversed_by_movement_id', e.id,
           'reversal_reason', coalesce(m.reversal_reason, e.reversal_reason),
           'transfer_pair_id', m.transfer_pair_id,
           'reversible', m.reverses_movement_id IS NULL AND e.id IS NULL AND m.origin_type IN ('avulso', 'transferencia'),
           'running_balance_cents', p_saldo)
    FROM public.financial_movements m
    JOIN public.financial_accounts a ON a.id = m.account_id
    LEFT JOIN public.financial_categories c ON c.id = m.category_id
    LEFT JOIN public.suppliers f ON f.id = m.supplier_id
    LEFT JOIN public.financial_movements e ON e.reverses_movement_id = m.id
   WHERE m.id = p_id;
$$;
REVOKE EXECUTE ON FUNCTION public.movimento_json(UUID, BIGINT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.movimentos_listar(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_termo TEXT := public.sem_acento(btrim(coalesce(p->>'busca', '')));
  v_conta UUID := nullif(p->>'conta_id', '')::uuid;
  v_forma TEXT := coalesce(nullif(p->>'forma', ''), 'todas');
  v_categoria UUID := nullif(p->>'categoria_id', '')::uuid;
  v_origem TEXT := coalesce(nullif(p->>'origem', ''), 'todas');
  v_direcao TEXT := coalesce(nullif(p->>'direcao', ''), 'todas');
  v_ini DATE := nullif(p->>'data_inicio', '')::date;
  v_fim DATE := nullif(p->>'data_fim', '')::date;
  v_pagina INTEGER := greatest(coalesce((p->>'pagina')::int, 0), 0);
  v_por INTEGER := least(greatest(coalesce((p->>'por_pagina')::int, 50), 1), 200);
  v_res JSONB;
BEGIN
  PERFORM public.financeiro_exige_completo();

  WITH saldos AS (
    -- Saldo da conta depois de cada movimento, em ordem de data
    SELECT m.id, (a.initial_balance_cents + sum(CASE WHEN m.direction = 'entrada' THEN m.amount_cents ELSE -m.amount_cents END)
                    OVER (ORDER BY m.occurred_date, m.created_at, m.id))::bigint AS saldo
      FROM public.financial_movements m
      JOIN public.financial_accounts a ON a.id = m.account_id
     WHERE m.account_id = v_conta
  ),
  filtrados AS (
    SELECT m.id, m.occurred_date, m.created_at, m.direction, m.amount_cents
      FROM public.financial_movements m
      JOIN public.financial_accounts a ON a.id = m.account_id
      LEFT JOIN public.financial_categories c ON c.id = m.category_id
      LEFT JOIN public.suppliers f ON f.id = m.supplier_id
      LEFT JOIN public.sales s ON s.id = m.sale_id
     WHERE (v_conta IS NULL OR m.account_id = v_conta)
       AND (v_forma = 'todas' OR m.method = v_forma)
       AND (v_categoria IS NULL OR m.category_id = v_categoria)
       AND (v_origem = 'todas' OR m.origin_type = v_origem)
       AND (v_direcao <> 'entrada' OR m.direction = 'entrada')
       AND (v_direcao <> 'saida' OR m.direction = 'saida')
       AND (v_direcao <> 'estornos' OR m.reverses_movement_id IS NOT NULL
            OR EXISTS (SELECT 1 FROM public.financial_movements e WHERE e.reverses_movement_id = m.id))
       AND (v_ini IS NULL OR m.occurred_date >= v_ini)
       AND (v_fim IS NULL OR m.occurred_date <= v_fim)
       AND (v_termo = '' OR public.sem_acento(concat_ws(' ', m.description, c.name, a.name, s.number, m.customer_name,
                                                        f.name, m.created_by_name)) LIKE '%' || v_termo || '%')
  ),
  pagina AS (
    SELECT id, occurred_date, created_at FROM filtrados
     ORDER BY occurred_date DESC, created_at DESC, id DESC OFFSET v_pagina * v_por LIMIT v_por
  )
  SELECT jsonb_build_object(
    'itens', coalesce((SELECT jsonb_agg(public.movimento_json(g.id, (SELECT s.saldo FROM saldos s WHERE s.id = g.id))
                                        ORDER BY g.occurred_date DESC, g.created_at DESC, g.id DESC) FROM pagina g), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtrados),
    'soma_entradas_cents', (SELECT coalesce(sum(amount_cents) FILTER (WHERE direction = 'entrada'), 0) FROM filtrados),
    'soma_saidas_cents', (SELECT coalesce(sum(amount_cents) FILTER (WHERE direction = 'saida'), 0) FROM filtrados),
    'saldo_liquido_cents', (SELECT coalesce(sum(CASE WHEN direction = 'entrada' THEN amount_cents ELSE -amount_cents END), 0) FROM filtrados),
    'saldo_atual_conta_cents', CASE WHEN v_conta IS NULL THEN NULL ELSE public.caixa_saldo_conta(v_conta) END)
  INTO v_res;
  RETURN v_res;
END;
$$;

-- Confere a conta de um lançamento manual (trava a conta) e as regras da conta de dinheiro
CREATE OR REPLACE FUNCTION public.financeiro_conferir_conta(p_conta UUID, p_data DATE, p_saida BIGINT)
RETURNS public.financial_accounts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  a public.financial_accounts%ROWTYPE;
  v_saldo BIGINT;
BEGIN
  SELECT * INTO a FROM public.financial_accounts WHERE id = p_conta AND active FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escolha uma conta ativa.' USING ERRCODE = '23514';
  END IF;
  IF a.kind = 'caixa' THEN
    IF p_data <> public.hoje_local() THEN
      RAISE EXCEPTION 'Lançamento em dinheiro (%) só com a data de hoje.', a.name USING ERRCODE = '23514';
    END IF;
    v_saldo := public.caixa_saldo_conta(a.id);
    IF p_saida > v_saldo THEN
      RAISE EXCEPTION 'A saída (%) é maior que o saldo em % (%).',
        public.formatar_reais(p_saida), a.name, public.formatar_reais(v_saldo) USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN a;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.financeiro_conferir_conta(UUID, DATE, BIGINT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.financeiro_lancar_avulso(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_direcao TEXT := p->>'direction';
  v_valor BIGINT := round(coalesce((p->>'amount_cents')::numeric, 0));
  v_data DATE := coalesce(nullif(p->>'occurred_date', '')::date, public.hoje_local());
  v_forma TEXT := p->>'method';
  v_texto TEXT := btrim(coalesce(p->>'description', ''));
  v_categoria UUID := nullif(p->>'category_id', '')::uuid;
  v_fornecedor UUID := nullif(p->>'supplier_id', '')::uuid;
  a public.financial_accounts%ROWTYPE;
  v_id UUID;
BEGIN
  PERFORM public.financeiro_exige_completo();
  IF v_direcao IS NULL OR v_direcao NOT IN ('entrada', 'saida') THEN
    RAISE EXCEPTION 'Informe se é receita ou despesa.' USING ERRCODE = '23514';
  END IF;
  IF v_valor <= 0 THEN
    RAISE EXCEPTION 'Informe um valor maior que zero.' USING ERRCODE = '23514';
  END IF;
  IF v_texto = '' THEN
    RAISE EXCEPTION 'Informe a descrição do lançamento.' USING ERRCODE = '23514';
  END IF;
  IF v_data > public.hoje_local() THEN
    RAISE EXCEPTION 'A data do lançamento não pode ser no futuro.' USING ERRCODE = '23514';
  END IF;
  IF v_forma IS NULL OR v_forma NOT IN ('dinheiro', 'pix', 'debito', 'credito', 'boleto', 'transferencia', 'cheque') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida.' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.financial_categories c
                  WHERE c.id = v_categoria AND c.active
                    AND c.kind = CASE v_direcao WHEN 'entrada' THEN 'receita' ELSE 'despesa' END) THEN
    RAISE EXCEPTION 'Escolha uma categoria de %.', CASE v_direcao WHEN 'entrada' THEN 'receita' ELSE 'despesa' END
      USING ERRCODE = '23514';
  END IF;

  a := public.financeiro_conferir_conta(nullif(p->>'account_id', '')::uuid, v_data,
                                        CASE WHEN v_direcao = 'saida' THEN v_valor ELSE 0 END);
  IF (a.kind = 'caixa') <> (v_forma = 'dinheiro') THEN
    RAISE EXCEPTION 'Dinheiro entra e sai só pela conta de caixa, e a conta de caixa só aceita dinheiro.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.financial_movements (occurred_date, direction, amount_cents, account_id, category_id, method,
                                          origin_type, supplier_id, description, created_by_name, created_at)
  VALUES (v_data, v_direcao, v_valor, a.id, v_categoria, v_forma, 'avulso',
          CASE WHEN v_direcao = 'saida' THEN v_fornecedor END, v_texto, public.vendas_ator_nome(), clock_timestamp())
  RETURNING id INTO v_id;
  RETURN public.movimento_json(v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_transferir(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_valor BIGINT := round(coalesce((p->>'amount_cents')::numeric, 0));
  v_data DATE := coalesce(nullif(p->>'occurred_date', '')::date, public.hoje_local());
  v_de UUID := nullif(p->>'from_account_id', '')::uuid;
  v_para UUID := nullif(p->>'to_account_id', '')::uuid;
  v_obs TEXT := coalesce(' (' || nullif(btrim(coalesce(p->>'description', '')), '') || ')', '');
  de public.financial_accounts%ROWTYPE;
  para public.financial_accounts%ROWTYPE;
  v_par UUID := gen_random_uuid();
  v_agora TIMESTAMPTZ := clock_timestamp();
  v_ator TEXT := public.vendas_ator_nome();
  v_saida UUID; v_entrada UUID;
BEGIN
  PERFORM public.financeiro_exige_completo();
  IF v_valor <= 0 THEN
    RAISE EXCEPTION 'Informe um valor maior que zero para transferir.' USING ERRCODE = '23514';
  END IF;
  IF v_de IS NOT DISTINCT FROM v_para THEN
    RAISE EXCEPTION 'Escolha contas de origem e destino diferentes.' USING ERRCODE = '23514';
  END IF;
  IF v_data > public.hoje_local() THEN
    RAISE EXCEPTION 'A data da transferência não pode ser no futuro.' USING ERRCODE = '23514';
  END IF;
  -- Trava as contas sempre na mesma ordem (duas transferências cruzadas não se travam uma à outra)
  PERFORM 1 FROM public.financial_accounts WHERE id IN (v_de, v_para) ORDER BY id FOR UPDATE;
  de := public.financeiro_conferir_conta(v_de, v_data, v_valor);
  para := public.financeiro_conferir_conta(v_para, v_data, 0);

  INSERT INTO public.financial_movements (occurred_date, direction, amount_cents, account_id, method, origin_type,
                                          transfer_pair_id, description, created_by_name, created_at)
  VALUES (v_data, 'saida', v_valor, de.id, 'transferencia', 'transferencia', v_par,
          'Transferência para ' || para.name || v_obs, v_ator, v_agora)
  RETURNING id INTO v_saida;
  INSERT INTO public.financial_movements (occurred_date, direction, amount_cents, account_id, method, origin_type,
                                          transfer_pair_id, description, created_by_name, created_at)
  VALUES (v_data, 'entrada', v_valor, para.id, 'transferencia', 'transferencia', v_par,
          'Transferência recebida de ' || de.name || v_obs, v_ator, v_agora)
  RETURNING id INTO v_entrada;
  RETURN jsonb_build_object('saida', public.movimento_json(v_saida), 'entrada', public.movimento_json(v_entrada));
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_estornar(p_id UUID, p_motivo TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  alvo public.financial_movements%ROWTYPE;
  m public.financial_movements%ROWTYPE;
  a public.financial_accounts%ROWTYPE;
  v_motivo TEXT := btrim(coalesce(p_motivo, ''));
  v_ator TEXT := public.vendas_ator_nome();
  v_agora TIMESTAMPTZ := clock_timestamp();
  v_novo UUID; v_retorno UUID;
  v_saldo BIGINT;
BEGIN
  PERFORM public.financeiro_exige_completo();
  IF v_motivo = '' THEN
    RAISE EXCEPTION 'Informe o motivo do estorno.' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO alvo FROM public.financial_movements WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimento não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF alvo.reverses_movement_id IS NOT NULL THEN
    RAISE EXCEPTION 'Um movimento de estorno não pode ser estornado.' USING ERRCODE = '23514';
  END IF;
  IF alvo.origin_type IN ('venda', 'tarifa_cartao') THEN
    RAISE EXCEPTION 'Movimento de venda se desfaz cancelando a venda.' USING ERRCODE = '23514';
  END IF;
  IF alvo.origin_type NOT IN ('avulso', 'transferencia') THEN
    RAISE EXCEPTION 'Este movimento não se estorna pelo extrato. No caixa, use reforço ou retirada.' USING ERRCODE = '23514';
  END IF;

  -- A transferência volta inteira. A trava nas contas impede o estorno duplo simultâneo.
  PERFORM 1 FROM public.financial_accounts c
   WHERE c.id IN (SELECT x.account_id FROM public.financial_movements x
                   WHERE x.id = alvo.id OR (alvo.transfer_pair_id IS NOT NULL AND x.transfer_pair_id = alvo.transfer_pair_id))
   ORDER BY c.id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.financial_movements e WHERE e.reverses_movement_id = alvo.id) THEN
    RAISE EXCEPTION 'Este movimento já foi estornado.' USING ERRCODE = '23514';
  END IF;

  FOR m IN
    SELECT x.* FROM public.financial_movements x
     WHERE x.reverses_movement_id IS NULL
       AND (x.id = alvo.id OR (alvo.transfer_pair_id IS NOT NULL AND x.transfer_pair_id = alvo.transfer_pair_id))
       AND NOT EXISTS (SELECT 1 FROM public.financial_movements e WHERE e.reverses_movement_id = x.id)
  LOOP
    -- O estorno de uma entrada em dinheiro não pode tirar mais do que há
    SELECT * INTO a FROM public.financial_accounts WHERE id = m.account_id;
    IF a.kind = 'caixa' AND m.direction = 'entrada' THEN
      v_saldo := public.caixa_saldo_conta(a.id);
      IF m.amount_cents > v_saldo THEN
        RAISE EXCEPTION 'O estorno tira % de %, que tem só %.',
          public.formatar_reais(m.amount_cents), a.name, public.formatar_reais(v_saldo) USING ERRCODE = '23514';
      END IF;
    END IF;
    INSERT INTO public.financial_movements (occurred_date, direction, amount_cents, account_id, category_id, method,
                                            origin_type, supplier_id, customer_name, description, reverses_movement_id,
                                            reversal_reason, transfer_pair_id, created_by_name, created_at)
    VALUES (public.hoje_local(), CASE m.direction WHEN 'entrada' THEN 'saida' ELSE 'entrada' END, m.amount_cents,
            m.account_id, m.category_id, m.method, m.origin_type, m.supplier_id, m.customer_name,
            'Estorno: ' || m.description, m.id, v_motivo, m.transfer_pair_id, v_ator, v_agora)
    RETURNING id INTO v_novo;
    IF m.id = alvo.id THEN v_retorno := v_novo; END IF;
  END LOOP;
  RETURN public.movimento_json(v_retorno);
END;
$$;

DO $permissoes$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY['movimentos_listar(jsonb)', 'financeiro_lancar_avulso(jsonb)',
                           'financeiro_transferir(jsonb)', 'financeiro_estornar(uuid, text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END
$permissoes$;

COMMIT;
