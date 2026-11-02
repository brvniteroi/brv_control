-- Etiquetas de OS (ex.: "Aguardando pagamento", "Pago"): catálogo com cor e ligação N:N com as
-- ordens de serviço. Aparecem na lista/detalhe da OS, na linha do tempo e no calendário.
-- Só o escritório vê e altera (o técnico não enxerga). O Field Control não tem etiquetas.

-- Versão anterior (etiquetas de cliente), caso já tenha sido rodada
DROP FUNCTION IF EXISTS public.definir_etiquetas_cliente(UUID, UUID[]);
DROP TABLE IF EXISTS public.customer_tags;

CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (btrim(name) <> '' AND char_length(name) <= 40),
  color TEXT NOT NULL DEFAULT '#2563EB' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- "pago", "Pago" e "PAGO" são a mesma etiqueta
CREATE UNIQUE INDEX IF NOT EXISTS tags_nome_key ON public.tags (public.sem_acento(btrim(name)));

CREATE TABLE IF NOT EXISTS public.service_order_tags (
  service_order_id UUID NOT NULL REFERENCES public.service_orders (id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (service_order_id, tag_id)
);
CREATE INDEX IF NOT EXISTS service_order_tags_tag_idx ON public.service_order_tags (tag_id);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_tags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tags, public.service_order_tags FROM anon;

DROP POLICY IF EXISTS "Escritório gerencia" ON public.tags;
DROP POLICY IF EXISTS "Só admin exclui" ON public.tags;
DROP POLICY IF EXISTS "Técnico lê etiquetas" ON public.tags;
DROP POLICY IF EXISTS "Escritório gerencia" ON public.service_order_tags;

CREATE POLICY "Escritório gerencia" ON public.tags FOR ALL TO authenticated
  USING ((SELECT public.eh_escritorio())) WITH CHECK ((SELECT public.eh_escritorio()));
-- Apagar a etiqueta do catálogo tira de todas as OS: só admin
CREATE POLICY "Só admin exclui" ON public.tags AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((SELECT public.eh_admin()));
CREATE POLICY "Escritório gerencia" ON public.service_order_tags FOR ALL TO authenticated
  USING ((SELECT public.eh_escritorio())) WITH CHECK ((SELECT public.eh_escritorio()));

-- Troca o conjunto de etiquetas da OS de uma vez (RLS do chamador vale: SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.definir_etiquetas_ordem(p_service_order_id UUID, p_tag_ids UUID[])
RETURNS VOID
LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$
  DELETE FROM public.service_order_tags
  WHERE service_order_id = p_service_order_id AND NOT (tag_id = ANY (coalesce(p_tag_ids, '{}')));
  INSERT INTO public.service_order_tags (service_order_id, tag_id)
  SELECT p_service_order_id, t FROM unnest(coalesce(p_tag_ids, '{}')) AS t
  ON CONFLICT DO NOTHING;
$$;
REVOKE EXECUTE ON FUNCTION public.definir_etiquetas_ordem(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_etiquetas_ordem(UUID, UUID[]) TO authenticated;

-- Linha do tempo e calendário atualizam na hora quando alguém muda a etiqueta
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'service_order_tags'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_order_tags;
  END IF;
END $$;
