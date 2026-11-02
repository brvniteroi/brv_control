-- App do técnico: as avaliações que ele mesmo recebeu nos últimos dias (estrela no cabeçalho).
-- O técnico não lê a tabela ratings; esta função devolve só as dele, sem dados do cliente além do comentário.
CREATE OR REPLACE FUNCTION public.minhas_avaliacoes(p_dias INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH minhas AS (
    SELECT r.stars, r.comment, r.created_at, so.number
      FROM public.ratings r
      JOIN public.service_orders so ON so.id = r.service_order_id
     WHERE r.employee_id = public.meu_colaborador_id()
       AND r.created_at >= NOW() - make_interval(days => LEAST(GREATEST(coalesce(p_dias, 30), 1), 365))
  )
  SELECT jsonb_build_object(
    'media', (SELECT round(avg(stars), 2) FROM minhas),
    'quantidade', (SELECT count(*) FROM minhas),
    'itens', coalesce((
      SELECT jsonb_agg(jsonb_build_object('estrelas', stars, 'comentario', comment, 'data', created_at, 'os', number)
                       ORDER BY created_at DESC)
        FROM minhas), '[]'::jsonb)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.minhas_avaliacoes(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.minhas_avaliacoes(INTEGER) TO authenticated;
