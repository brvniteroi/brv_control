-- =====================================================================
-- Relatório de vendas (histórico do SicWeb + vendas do BRV Control) e busca no histórico do SicWeb.
-- Pedido do usuário, 2026-11-26: usar para projeções e decisões. SÓ ADMIN. O lucro do SicWeb NÃO sai daqui
-- (não é confiável até se conferir como é calculado).
--
-- Para não contar a mesma venda duas vezes: vale o SicWeb ANTES do dia da virada e o Control A PARTIR dele
-- (vendas de teste feitas no Control antes disso ficam de fora). Se a virada mudar de dia, basta rodar de novo
-- só a função virada_sicweb() com a data nova.
--
-- Colar no SQL Editor do projeto BRV Control. Depois, rodar supabase/verificacao/relatorio_vendas.sql.
-- =====================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.virada_sicweb()
RETURNS DATE LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$ SELECT DATE '2026-12-05' $$;
REVOKE EXECUTE ON FUNCTION public.virada_sicweb() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.virada_sicweb() TO authenticated;

-- Todas as vendas válidas das duas origens (uso interno das funções abaixo; ninguém lê direto)
CREATE OR REPLACE VIEW public.relatorio_vendas_base AS
  SELECT v.data, v.total::NUMERIC AS total, v.customer_id, 'sicweb'::TEXT AS origem, v.controle AS sicweb_controle, NULL::UUID AS venda_id
    FROM public.sicweb_vendas v
   WHERE NOT v.cancelada AND v.data < public.virada_sicweb()
  UNION ALL
  SELECT (s.created_at AT TIME ZONE 'America/Sao_Paulo')::DATE, (s.total_cents / 100.0)::NUMERIC, s.customer_id, 'control', NULL, s.id
    FROM public.sales s
   WHERE s.status = 'ativa' AND (s.created_at AT TIME ZONE 'America/Sao_Paulo')::DATE >= public.virada_sicweb();
REVOKE ALL ON public.relatorio_vendas_base FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 1. Mês a mês de todos os anos, com o recorte "até o mesmo dia" do último dia com venda (comparação justa)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.relatorio_vendas_mensal()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_ultimo DATE;
BEGIN
  IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Relatório de vendas é só para administradores.' USING ERRCODE = '42501'; END IF;
  SELECT max(data) INTO v_ultimo FROM public.relatorio_vendas_base;
  RETURN jsonb_build_object(
    'ultimo_dia', v_ultimo,
    'virada', public.virada_sicweb(),
    'meses', coalesce((
      SELECT jsonb_agg(m ORDER BY m.ano, m.mes) FROM (
        SELECT extract(YEAR FROM data)::INT AS ano,
               extract(MONTH FROM data)::INT AS mes,
               count(*) AS vendas,
               count(*) FILTER (WHERE total > 0) AS vendas_com_valor,
               round(sum(total), 2) AS total,
               count(*) FILTER (WHERE to_char(data, 'MMDD') <= to_char(v_ultimo, 'MMDD')) AS vendas_ate_dia,
               count(*) FILTER (WHERE total > 0 AND to_char(data, 'MMDD') <= to_char(v_ultimo, 'MMDD')) AS vendas_com_valor_ate_dia,
               round(coalesce(sum(total) FILTER (WHERE to_char(data, 'MMDD') <= to_char(v_ultimo, 'MMDD')), 0), 2) AS total_ate_dia
          FROM public.relatorio_vendas_base
         GROUP BY 1, 2
      ) m), '[]'::JSONB));
END
$$;

-- ---------------------------------------------------------------------
-- 2. Detalhe de um período: produtos x serviços, itens e clientes que mais faturam
-- Item do SicWeb é classificado pelo catálogo importado (catalog_items.legacy_code = código interno do produto).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.relatorio_vendas_detalhe(p_inicio DATE, p_fim DATE)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  r JSONB;
BEGIN
  IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Relatório de vendas é só para administradores.' USING ERRCODE = '42501'; END IF;

  WITH vendas AS MATERIALIZED (
    SELECT * FROM public.relatorio_vendas_base WHERE data BETWEEN p_inicio AND p_fim
  ),
  itens AS MATERIALIZED (
    SELECT coalesce(c.name, i.produto_nome, 'Item sem nome') AS nome,
           coalesce(c.kind, 'sem_classificacao') AS tipo,
           i.quantidade::NUMERIC AS quantidade,
           i.total::NUMERIC AS total
      FROM vendas v
      JOIN public.sicweb_venda_itens i ON i.venda_controle = v.sicweb_controle
      LEFT JOIN public.catalog_items c ON c.legacy_code = i.produto_codigo::TEXT
    UNION ALL
    SELECT coalesce(c.name, i.name), i.kind, i.quantity, i.total_cents / 100.0
      FROM vendas v
      JOIN public.sale_items i ON i.sale_id = v.venda_id
      LEFT JOIN public.catalog_items c ON c.id = i.catalog_item_id
  )
  SELECT jsonb_build_object(
    'tipos', coalesce((SELECT jsonb_agg(t ORDER BY t.total DESC) FROM (
        SELECT tipo, round(sum(total), 2) AS total FROM itens GROUP BY tipo) t), '[]'::JSONB),
    'produtos', coalesce((SELECT jsonb_agg(t ORDER BY t.total DESC) FROM (
        SELECT nome, round(sum(quantidade), 3) AS quantidade, round(sum(total), 2) AS total
          FROM itens WHERE tipo = 'produto' GROUP BY nome ORDER BY sum(total) DESC LIMIT 20) t), '[]'::JSONB),
    'servicos', coalesce((SELECT jsonb_agg(t ORDER BY t.total DESC) FROM (
        SELECT nome, round(sum(quantidade), 3) AS quantidade, round(sum(total), 2) AS total
          FROM itens WHERE tipo = 'servico' GROUP BY nome ORDER BY sum(total) DESC LIMIT 20) t), '[]'::JSONB),
    -- O "Cliente Balcão" (código 004707) e a venda sem cliente ficam fora do ranking e aparecem à parte
    'clientes', coalesce((SELECT jsonb_agg(t ORDER BY t.total DESC) FROM (
        SELECT cu.id, cu.name AS nome, count(*) AS vendas, round(sum(v.total), 2) AS total
          FROM vendas v JOIN public.customers cu ON cu.id = v.customer_id
         WHERE NOT EXISTS (SELECT 1 FROM public.customer_sicweb_codes k WHERE k.codigo = '004707' AND k.customer_id = cu.id)
         GROUP BY cu.id, cu.name ORDER BY sum(v.total) DESC LIMIT 20) t), '[]'::JSONB),
    'balcao', (SELECT jsonb_build_object('vendas', count(*), 'total', round(coalesce(sum(v.total), 0), 2))
        FROM vendas v
       WHERE v.customer_id IS NULL
          OR EXISTS (SELECT 1 FROM public.customer_sicweb_codes k WHERE k.codigo = '004707' AND k.customer_id = v.customer_id))
  ) INTO r;
  RETURN r;
END
$$;

-- ---------------------------------------------------------------------
-- 3. Busca no histórico do SicWeb (período + palavras no cliente, no produto ou o número da venda)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sicweb_vendas_buscar(
  p_busca TEXT DEFAULT '', p_inicio DATE DEFAULT NULL, p_fim DATE DEFAULT NULL, p_pagina INT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_padroes TEXT[];
  r JSONB;
BEGIN
  IF NOT public.eh_admin() THEN RAISE EXCEPTION 'O histórico de vendas é só para administradores.' USING ERRCODE = '42501'; END IF;
  SELECT coalesce(array_agg('%' || replace(replace(replace(p, '\', '\\'), '%', '\%'), '_', '\_') || '%'), '{}')
    INTO v_padroes
    FROM regexp_split_to_table(lower(public.sem_acento(coalesce(p_busca, ''))), '\s+') AS p
   WHERE p <> '';

  WITH palavras AS (
    SELECT q.padrao, q.n FROM unnest(v_padroes) WITH ORDINALITY AS q(padrao, n)
  ),
  -- (palavra, venda): a palavra pode estar no número, no nome do cliente ou em algum produto da venda.
  -- Cada fonte é percorrida uma vez por palavra (não uma vez por venda).
  casadas AS MATERIALIZED (
    SELECT w.n, v.controle FROM palavras w JOIN public.sicweb_vendas v ON v.controle::TEXT LIKE w.padrao
    UNION
    SELECT w.n, v.controle FROM palavras w
      JOIN public.customers c ON lower(public.sem_acento(c.name)) LIKE w.padrao
      JOIN public.sicweb_vendas v ON v.customer_id = c.id
    UNION
    SELECT w.n, i.venda_controle FROM palavras w
      JOIN public.sicweb_venda_itens i ON lower(public.sem_acento(coalesce(i.produto_nome, ''))) LIKE w.padrao
  ),
  achadas AS MATERIALIZED (
    SELECT v.controle, v.data, v.total, v.cancelada, v.customer_id
      FROM public.sicweb_vendas v
     WHERE (p_inicio IS NULL OR v.data >= p_inicio)
       AND (p_fim IS NULL OR v.data <= p_fim)
       -- todas as palavras precisam aparecer
       AND (cardinality(v_padroes) = 0 OR v.controle IN (
             SELECT k.controle FROM casadas k GROUP BY k.controle HAVING count(*) = cardinality(v_padroes)))
  )
  SELECT jsonb_build_object(
    'quantidade', (SELECT count(*) FROM achadas),
    'canceladas', (SELECT count(*) FROM achadas WHERE cancelada),
    'total', (SELECT round(coalesce(sum(total), 0), 2) FROM achadas WHERE NOT cancelada),
    'vendas', coalesce((SELECT jsonb_agg(t ORDER BY t.data DESC, t.controle DESC) FROM (
        SELECT a.controle, a.data, a.total, a.cancelada, v.tipo_nome, v.observacoes, v.frete, a.customer_id, c.name AS cliente
          FROM (SELECT * FROM achadas ORDER BY data DESC, controle DESC LIMIT 50 OFFSET greatest(p_pagina, 0) * 50) a
          JOIN public.sicweb_vendas v ON v.controle = a.controle
          LEFT JOIN public.customers c ON c.id = a.customer_id) t), '[]'::JSONB)
  ) INTO r;
  RETURN r;
END
$$;

REVOKE EXECUTE ON FUNCTION public.relatorio_vendas_mensal() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.relatorio_vendas_detalhe(DATE, DATE) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sicweb_vendas_buscar(TEXT, DATE, DATE, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relatorio_vendas_mensal() TO authenticated;
GRANT EXECUTE ON FUNCTION public.relatorio_vendas_detalhe(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sicweb_vendas_buscar(TEXT, DATE, DATE, INT) TO authenticated;

COMMIT;
