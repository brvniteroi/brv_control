-- =====================================================================
-- Relatório de produtos vendidos (apoio à decisão de compras; pedido do usuário, 2026-11-26). SÓ ADMIN.
-- Mesma base do relatório de vendas (20261126100000): SicWeb antes da virada, BRV Control a partir dela.
-- Só PRODUTOS. Itens do SicWeb de produtos apagados do cadastro não têm nome nem tipo: vão somados à parte.
--
-- Colar no SQL Editor do projeto BRV Control. Depois, rodar supabase/verificacao/relatorio_produtos.sql.
-- =====================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.relatorio_produtos_vendidos(p_inicio DATE, p_fim DATE)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_antes_inicio DATE := (p_inicio - INTERVAL '1 year')::DATE;
  v_antes_fim DATE := (p_fim - INTERVAL '1 year')::DATE;
  r JSONB;
BEGIN
  IF NOT public.eh_admin() THEN RAISE EXCEPTION 'Relatório de produtos é só para administradores.' USING ERRCODE = '42501'; END IF;

  WITH vendas AS MATERIALIZED (
    SELECT data, sicweb_controle, venda_id,
           data BETWEEN p_inicio AND p_fim AS atual,
           data BETWEEN v_antes_inicio AND v_antes_fim AS antes
      FROM public.relatorio_vendas_base
     WHERE data BETWEEN p_inicio AND p_fim OR data BETWEEN v_antes_inicio AND v_antes_fim
  ),
  itens AS MATERIALIZED (
    SELECT v.data, v.atual, v.antes, 's' || v.sicweb_controle AS venda,
           c.name AS nome, c.unit AS unidade, c.category AS categoria, c.manufacturer AS fabricante, c.code AS codigo,
           coalesce(c.kind, 'sem_classificacao') AS tipo,
           i.quantidade::NUMERIC AS quantidade, i.total::NUMERIC AS total
      FROM vendas v
      JOIN public.sicweb_venda_itens i ON i.venda_controle = v.sicweb_controle
      LEFT JOIN public.catalog_items c ON c.legacy_code = i.produto_codigo::TEXT
    UNION ALL
    SELECT v.data, v.atual, v.antes, 'c' || v.venda_id,
           coalesce(c.name, i.name), coalesce(c.unit, i.unit), c.category, c.manufacturer, coalesce(c.code, i.code),
           i.kind, i.quantity, i.total_cents / 100.0
      FROM vendas v
      JOIN public.sale_items i ON i.sale_id = v.venda_id
      LEFT JOIN public.catalog_items c ON c.id = i.catalog_item_id
  )
  SELECT jsonb_build_object(
    'ultimo_dia', (SELECT max(data) FROM public.relatorio_vendas_base),
    'anterior_inicio', v_antes_inicio,
    'anterior_fim', v_antes_fim,
    'sem_classificacao', (SELECT jsonb_build_object('quantidade', round(coalesce(sum(quantidade), 0), 3), 'total', round(coalesce(sum(total), 0), 2))
                            FROM itens WHERE atual AND tipo = 'sem_classificacao'),
    -- O mesmo produto cadastrado duas vezes (mesmo nome e unidade) aparece em uma linha só.
    -- Entra também quem vendeu só no período anterior (parou de vender: quantidade 0 agora).
    'produtos', coalesce((SELECT jsonb_agg(p ORDER BY p.total DESC, p.nome) FROM (
        SELECT nome, unidade, max(categoria) AS categoria, max(fabricante) AS fabricante, min(codigo) AS codigo,
               round(coalesce(sum(quantidade) FILTER (WHERE atual), 0), 3) AS quantidade,
               round(coalesce(sum(total) FILTER (WHERE atual), 0), 2) AS total,
               count(DISTINCT venda) FILTER (WHERE atual) AS vendas,
               round(coalesce(sum(quantidade) FILTER (WHERE antes), 0), 3) AS quantidade_anterior,
               max(data) AS ultima_venda
          FROM itens
         WHERE tipo = 'produto'
         GROUP BY nome, unidade
      ) p), '[]'::JSONB)
  ) INTO r;
  RETURN r;
END
$$;

REVOKE EXECUTE ON FUNCTION public.relatorio_produtos_vendidos(DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relatorio_produtos_vendidos(DATE, DATE) TO authenticated;

COMMIT;
