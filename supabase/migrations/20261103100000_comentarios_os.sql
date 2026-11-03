-- Comentários internos da OS (só o escritório vê). Histórico: comentários da equipe no Field Control
-- (field_control_id = id do comentário no Field), importados por scripts/field-control/importar-extras.mjs.
-- Novos: o autor e a data vêm do login (trigger), não do que o navegador mandar.

CREATE TABLE IF NOT EXISTS public.service_order_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES public.service_orders (id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  -- Nome de quem escreveu (no Field é só o nome; nos novos, cópia do perfil)
  author_name TEXT,
  message TEXT NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 4000),
  field_control_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS service_order_comments_os_idx ON public.service_order_comments (service_order_id, created_at);

CREATE OR REPLACE FUNCTION public.comentarios_os_preenche()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Sem login (importação com a service_role) valem os valores informados
  IF auth.uid() IS NOT NULL THEN
    NEW.author_id := auth.uid();
    NEW.author_name := (SELECT full_name FROM public.profiles WHERE id = auth.uid());
    NEW.created_at := NOW();
    NEW.field_control_id := NULL;
  END IF;
  NEW.message := btrim(NEW.message);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS comentarios_os_preenche ON public.service_order_comments;
CREATE TRIGGER comentarios_os_preenche
  BEFORE INSERT ON public.service_order_comments
  FOR EACH ROW EXECUTE FUNCTION public.comentarios_os_preenche();

ALTER TABLE public.service_order_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.service_order_comments FROM anon;
DROP POLICY IF EXISTS "Escritório lê" ON public.service_order_comments;
DROP POLICY IF EXISTS "Escritório comenta" ON public.service_order_comments;
DROP POLICY IF EXISTS "Autor ou admin exclui" ON public.service_order_comments;
CREATE POLICY "Escritório lê" ON public.service_order_comments FOR SELECT TO authenticated
  USING ((SELECT public.eh_escritorio()));
CREATE POLICY "Escritório comenta" ON public.service_order_comments FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.eh_escritorio()));
CREATE POLICY "Autor ou admin exclui" ON public.service_order_comments FOR DELETE TO authenticated
  USING ((SELECT public.eh_escritorio()) AND (author_id = (SELECT auth.uid()) OR (SELECT public.eh_admin())));
-- Sem UPDATE: comentário não é editado (exclui e escreve de novo)
