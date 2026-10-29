-- =====================================================================
-- Gestão da equipe: nunca deixar o sistema sem administrador ativo.
-- Rodar no SQL Editor (ou `supabase db push`). Não altera dados existentes.
-- =====================================================================
CREATE FUNCTION public.profiles_protege_ultimo_admin()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Só importa quando um administrador ativo deixa de ser (rebaixado, desativado ou excluído)
  IF OLD.role = 'admin' AND OLD.active
     AND (TG_OP = 'DELETE' OR NEW.role <> 'admin' OR NOT NEW.active) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE role = 'admin' AND active AND id <> OLD.id
    ) THEN
      RAISE EXCEPTION 'É preciso manter pelo menos um administrador ativo.';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER profiles_protege_ultimo_admin
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_protege_ultimo_admin();
