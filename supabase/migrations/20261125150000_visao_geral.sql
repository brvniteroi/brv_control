-- =====================================================================
-- Financeiro, parte 3c: visão geral (2026-11-25).
--
-- "Recebido" é o que os clientes PAGARAM no dia (pagamentos das vendas que não foram canceladas) mais as
-- receitas avulsas não estornadas. Não usa a data do extrato: venda no cartão de hoje só cai amanhã e
-- ainda assim foi recebida hoje. Transferência, reforço, retirada e ajuste do caixa não são receita.
-- "A cair" é o cartão com crédito previsto para depois de hoje (bruto, tarifa e líquido).
--
-- Nível "caixa": só o recebido hoje e as vendas a receber. Saldos, período, gráfico e cartão a cair
-- são do nível "completo".
--
-- Colar no SQL Editor do projeto BRV Control.
-- =====================================================================
BEGIN;

-- Tudo o que foi recebido entre duas datas (dia de Niterói), uma linha por recebimento. Uso interno.
CREATE OR REPLACE FUNCTION public.financeiro_recebidos(p_ini DATE, p_fim DATE)
RETURNS TABLE (dia DATE, forma TEXT, valor BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT (p.paid_at AT TIME ZONE 'America/Sao_Paulo')::date, p.method, p.amount_cents
    FROM public.sale_payments p
    JOIN public.sales s ON s.id = p.sale_id AND s.status = 'ativa'
   WHERE (p.paid_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_ini AND p_fim
  UNION ALL
  SELECT m.occurred_date, m.method, m.amount_cents
    FROM public.financial_movements m
   WHERE m.origin_type = 'avulso' AND m.direction = 'entrada' AND m.reverses_movement_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.financial_movements e WHERE e.reverses_movement_id = m.id)
     AND m.occurred_date BETWEEN p_ini AND p_fim;
$$;
REVOKE EXECUTE ON FUNCTION public.financeiro_recebidos(DATE, DATE) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.financeiro_resumo(p_inicio DATE DEFAULT NULL, p_fim DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_nivel TEXT := public.nivel_financeiro();
  v_completo BOOLEAN;
  v_hoje DATE := public.hoje_local();
  v_fim DATE := coalesce(p_fim, public.hoje_local());
  v_ini DATE;
  v_contas JSONB := '[]'::jsonb;
  v_res JSONB;
BEGIN
  IF v_nivel NOT IN ('caixa', 'completo') THEN
    RAISE EXCEPTION 'Seu usuário não tem acesso ao financeiro.' USING ERRCODE = '42501';
  END IF;
  v_completo := v_nivel = 'completo';
  v_ini := coalesce(p_inicio, date_trunc('month', v_hoje)::date);

  IF v_completo THEN
    SELECT coalesce(jsonb_agg(x.value), '[]'::jsonb) INTO v_contas
      FROM jsonb_array_elements(public.financeiro_contas()) x
     WHERE (x.value->>'active')::boolean;
  END IF;

  WITH hoje AS (
    SELECT forma, sum(valor)::bigint AS total FROM public.financeiro_recebidos(v_hoje, v_hoje) GROUP BY forma
  ),
  periodo AS (
    SELECT forma, sum(valor)::bigint AS total FROM public.financeiro_recebidos(v_ini, v_fim) WHERE v_completo GROUP BY forma
  ),
  formas AS (
    SELECT unnest(ARRAY['dinheiro', 'pix', 'debito', 'credito', 'boleto', 'transferencia', 'cheque']) AS forma
  ),
  trinta AS (
    SELECT d::date AS dia,
           coalesce((SELECT sum(r.valor) FROM public.financeiro_recebidos(v_hoje - 29, v_hoje) r WHERE r.dia = d::date), 0)::bigint AS total
      FROM generate_series(v_hoje - 29, v_hoje, INTERVAL '1 day') d
     WHERE v_completo
  ),
  a_cair AS (
    SELECT q.id, q.name, a.name AS conta,
           coalesce(sum(m.amount_cents) FILTER (WHERE m.direction = 'entrada'), 0)::bigint AS bruto,
           coalesce(sum(m.amount_cents) FILTER (WHERE m.direction = 'saida'), 0)::bigint AS tarifa,
           min(m.occurred_date) AS proxima
      FROM public.financial_movements m
      JOIN public.sale_payments p ON p.id = m.sale_payment_id
      JOIN public.card_machines q ON q.id = p.card_machine_id
      JOIN public.financial_accounts a ON a.id = q.settlement_account_id
     WHERE v_completo AND m.occurred_date > v_hoje AND m.reverses_movement_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM public.financial_movements e WHERE e.reverses_movement_id = m.id)
     GROUP BY q.id, q.name, a.name
  ),
  abertas AS (
    SELECT s.id, s.number, s.customer_name, s.created_at, s.total_cents, s.paid_cents
      FROM public.sales s
     WHERE s.status = 'ativa' AND s.paid_cents < s.total_cents
  )
  SELECT jsonb_build_object(
    'accounts', v_contas,
    'total_accounts_balance_cents',
      (SELECT coalesce(sum((x.value->>'current_balance_cents')::bigint), 0) FROM jsonb_array_elements(v_contas) x),
    'pending_machines', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'machine_id', c.id, 'machine_name', c.name, 'settlement_account_name', c.conta,
               'pending_gross_cents', c.bruto, 'estimated_fee_cents', c.tarifa,
               'pending_net_cents', c.bruto - c.tarifa, 'next_settlement_date', c.proxima) ORDER BY c.name)
        FROM a_cair c), '[]'::jsonb),
    'received_today_cents', (SELECT coalesce(sum(total), 0) FROM hoje),
    'received_today_by_method',
      (SELECT jsonb_object_agg(f.forma, coalesce(h.total, 0)) FROM formas f LEFT JOIN hoje h ON h.forma = f.forma),
    'received_month_cents', (SELECT coalesce(sum(total), 0) FROM periodo),
    'received_month_by_method',
      (SELECT jsonb_object_agg(f.forma, coalesce(h.total, 0)) FROM formas f LEFT JOIN periodo h ON h.forma = f.forma),
    -- Recebimentos dos técnicos ainda não existem no banco
    'technician_cash_total_cents', 0,
    'technician_cash_list', '[]'::jsonb,
    'pending_receipts_count', 0,
    'open_sales_total_cents', (SELECT coalesce(sum(total_cents - paid_cents), 0) FROM abertas),
    'open_sales_count', (SELECT count(*) FROM abertas),
    'open_sales_oldest', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'sale_id', o.id, 'sale_number', o.number, 'customer_name', o.customer_name, 'created_at', o.created_at,
               'total_cents', o.total_cents, 'paid_cents', o.paid_cents, 'remaining_cents', o.total_cents - o.paid_cents,
               'payments', coalesce((SELECT jsonb_agg(jsonb_build_object('method', p.method, 'installments', p.installments) ORDER BY p.paid_at)
                                       FROM public.sale_payments p WHERE p.sale_id = o.id), '[]'::jsonb))
             ORDER BY o.created_at)
        FROM (SELECT * FROM abertas ORDER BY created_at LIMIT 6) o), '[]'::jsonb),
    'daily_received_30d', coalesce((SELECT jsonb_agg(jsonb_build_object('date', t.dia, 'amount_cents', t.total) ORDER BY t.dia) FROM trinta t), '[]'::jsonb))
  INTO v_res;
  RETURN v_res;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.financeiro_resumo(DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.financeiro_resumo(DATE, DATE) TO authenticated;

COMMIT;
