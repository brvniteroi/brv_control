-- Avaliação do atendimento pelo cliente (1 a 5 estrelas e comentário).
-- Histórico: avaliações do Field Control (uma por atividade; field_control_id = id da atividade no Field),
-- importadas por scripts/field-control/importar-avaliacoes.mjs.
-- Novas: uma por OS. Com a OS concluída, o escritório gera o link (gerar_link_avaliacao) e manda pelo
-- WhatsApp; o cliente abre /avaliar/<token> sem login. Única porta para quem não tem login (anon):
-- as funções avaliacao_ver e avaliacao_enviar, que só enxergam a OS daquele token.

CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES public.service_orders (id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks (id) ON DELETE SET NULL,
  -- Técnico avaliado (o da atividade avaliada ou o da última concluída da OS)
  employee_id UUID REFERENCES public.employees (id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT CHECK (char_length(comment) <= 1000),
  field_control_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Avaliação nova: no máximo uma por OS (as do Field podem ser várias, uma por atividade)
CREATE UNIQUE INDEX IF NOT EXISTS ratings_uma_por_os ON public.ratings (service_order_id) WHERE field_control_id IS NULL;
CREATE INDEX IF NOT EXISTS ratings_os_idx ON public.ratings (service_order_id);
CREATE INDEX IF NOT EXISTS ratings_cliente_idx ON public.ratings (customer_id);
CREATE INDEX IF NOT EXISTS ratings_tecnico_idx ON public.ratings (employee_id);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ratings FROM anon;
DROP POLICY IF EXISTS "Escritório gerencia" ON public.ratings;
DROP POLICY IF EXISTS "Só admin exclui" ON public.ratings;
CREATE POLICY "Escritório gerencia" ON public.ratings FOR ALL TO authenticated
  USING ((SELECT public.eh_escritorio())) WITH CHECK ((SELECT public.eh_escritorio()));
CREATE POLICY "Só admin exclui" ON public.ratings AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((SELECT public.eh_admin()));

-- Média e quantidade por técnico (tela Equipe)
CREATE OR REPLACE VIEW public.avaliacoes_por_tecnico
WITH (security_invoker = on) AS
SELECT employee_id, round(avg(stars), 2) AS media, count(*) AS quantidade
  FROM public.ratings
 WHERE employee_id IS NOT NULL
 GROUP BY employee_id;
REVOKE ALL ON public.avaliacoes_por_tecnico FROM anon;
GRANT SELECT ON public.avaliacoes_por_tecnico TO authenticated;

-- Link da avaliação: um segredo aleatório por OS (criado na primeira vez que o escritório pede)
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS rating_token TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.gerar_link_avaliacao(p_os UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_status TEXT; v_token TEXT;
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  SELECT status, rating_token INTO v_status, v_token FROM public.service_orders WHERE id = p_os FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OS não encontrada.'; END IF;
  IF v_status <> 'concluida' THEN RAISE EXCEPTION 'A avaliação só pode ser pedida com a OS concluída.'; END IF;
  IF v_token IS NULL THEN
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    UPDATE public.service_orders SET rating_token = v_token WHERE id = p_os;
  END IF;
  RETURN v_token;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.gerar_link_avaliacao(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_link_avaliacao(UUID) TO authenticated;

-- Última atividade concluída da OS (técnico avaliado)
CREATE OR REPLACE FUNCTION public.avaliacao_ultima_atividade(p_os UUID)
RETURNS public.tasks
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT t.* FROM public.tasks t
   WHERE t.service_order_id = p_os AND t.status = 'concluida'
   ORDER BY t.finished_at DESC NULLS LAST, t.scheduled_start DESC NULLS LAST
   LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.avaliacao_ultima_atividade(UUID) FROM PUBLIC, anon, authenticated;

-- Página pública: o que mostrar para quem abriu o link (NULL = link inválido)
CREATE OR REPLACE FUNCTION public.avaliacao_ver(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_os public.service_orders; v_t public.tasks; v_r public.ratings; v_tecnico TEXT; v_servico TEXT;
BEGIN
  IF p_token IS NULL OR length(p_token) <> 64 THEN RETURN NULL; END IF;
  SELECT * INTO v_os FROM public.service_orders WHERE rating_token = p_token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_t := public.avaliacao_ultima_atividade(v_os.id);
  -- Só o primeiro nome do técnico
  SELECT split_part(trim(name), ' ', 1) INTO v_tecnico FROM public.employees WHERE id = v_t.employee_id;
  SELECT name INTO v_servico FROM public.service_types WHERE id = v_os.service_type_id;
  SELECT * INTO v_r FROM public.ratings WHERE service_order_id = v_os.id AND field_control_id IS NULL;
  RETURN jsonb_build_object(
    'numero', v_os.number,
    'servico', v_servico,
    'data', coalesce(v_t.finished_at, v_os.completed_at),
    'tecnico', v_tecnico,
    'avaliada', v_r.id IS NOT NULL,
    'estrelas', v_r.stars,
    'comentario', v_r.comment
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.avaliacao_enviar(p_token TEXT, p_estrelas INTEGER, p_comentario TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_os public.service_orders; v_t public.tasks; v_comentario TEXT := nullif(trim(coalesce(p_comentario, '')), '');
BEGIN
  IF p_token IS NULL OR length(p_token) <> 64 THEN RAISE EXCEPTION 'Link de avaliação inválido.'; END IF;
  SELECT * INTO v_os FROM public.service_orders WHERE rating_token = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link de avaliação inválido.'; END IF;
  IF p_estrelas IS NULL OR p_estrelas NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Escolha de 1 a 5 estrelas.'; END IF;
  IF char_length(v_comentario) > 1000 THEN RAISE EXCEPTION 'O comentário está muito longo (máximo de 1000 caracteres).'; END IF;
  IF EXISTS (SELECT 1 FROM public.ratings WHERE service_order_id = v_os.id AND field_control_id IS NULL) THEN
    RAISE EXCEPTION 'Este atendimento já foi avaliado. Obrigado!';
  END IF;
  v_t := public.avaliacao_ultima_atividade(v_os.id);
  INSERT INTO public.ratings (service_order_id, task_id, employee_id, customer_id, stars, comment)
  VALUES (v_os.id, v_t.id, v_t.employee_id, v_os.customer_id, p_estrelas, v_comentario);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.avaliacao_ver(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.avaliacao_enviar(TEXT, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.avaliacao_ver(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.avaliacao_enviar(TEXT, INTEGER, TEXT) TO anon, authenticated;
