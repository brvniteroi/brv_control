-- Financeiro das placas: só quem tem a marca no perfil (hoje, só o Braulio). Decisão de 2026-11-09.
--
-- Não é papel novo (mesma ideia do nível de acesso do financeiro, docs/financeiro.md): é um campo no perfil,
-- que admin e escritório continuam com os papéis de sempre. A marca vale para o dashboard financeiro das placas e
-- para o que for financeiro nelas (reembolso). Orçamento da placa segue com o escritório.
--
-- Só quem JÁ tem a marca pode dar ou tirar a marca de outro usuário (admin comum não consegue se promover).
-- Pelo SQL Editor (sem login) a marca pode ser dada, como abaixo.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS board_finance_access BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.tem_financeiro_placas()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND active AND role IN ('admin', 'escritorio') AND board_finance_access
  );
$$;
REVOKE EXECUTE ON FUNCTION public.tem_financeiro_placas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tem_financeiro_placas() TO authenticated;

CREATE OR REPLACE FUNCTION public.profiles_protege_financeiro_placas()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.board_finance_access IS DISTINCT FROM OLD.board_finance_access
     AND auth.uid() IS NOT NULL
     AND NOT public.tem_financeiro_placas() THEN
    RAISE EXCEPTION 'Só quem tem acesso ao financeiro das placas pode mudar esse acesso.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protege_financeiro_placas ON public.profiles;
CREATE TRIGGER profiles_protege_financeiro_placas
  BEFORE UPDATE OF board_finance_access ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_protege_financeiro_placas();

-- Braulio (login admin "Administrador BRV")
UPDATE public.profiles SET board_finance_access = TRUE WHERE email = 'brvniteroi@gmail.com';
