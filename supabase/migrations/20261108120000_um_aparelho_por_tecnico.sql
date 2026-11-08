-- =====================================================================
-- Um aparelho por técnico (2026-11-08): login de técnico vale em um celular só.
--
-- Cada aparelho tem uma identificação própria (gerada e guardada no próprio celular). Ao fazer login, o
-- aparelho "assume" o técnico; o app de campo confere a cada minuto se ainda é o aparelho dele e, se não for,
-- sai sozinho ("Seu login foi aberto em outro aparelho"). Cada troca fica registrada e o Mapa avisa o
-- escritório quando o mesmo login aparece em 2 aparelhos nas últimas 24 h (login compartilhado).
-- Só vale para o papel `tecnico`; escritório e admin seguem podendo usar vários computadores.
--
-- Colar no SQL Editor do Supabase.
-- =====================================================================

-- Aparelho atual de cada técnico (só pelas funções abaixo)
CREATE TABLE IF NOT EXISTS public.tecnico_aparelho (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  aparelho_id TEXT NOT NULL,
  user_agent TEXT,
  desde TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.tecnico_aparelho ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tecnico_aparelho FROM anon, authenticated;

-- Histórico das trocas (o escritório lê para o alerta do Mapa)
CREATE TABLE IF NOT EXISTS public.tecnico_aparelho_trocas (
  id BIGSERIAL PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees (id) ON DELETE CASCADE,
  aparelho_id TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tecnico_aparelho_trocas_idx ON public.tecnico_aparelho_trocas (employee_id, created_at DESC);
ALTER TABLE public.tecnico_aparelho_trocas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tecnico_aparelho_trocas FROM anon;
DROP POLICY IF EXISTS "Escritório lê" ON public.tecnico_aparelho_trocas;
CREATE POLICY "Escritório lê" ON public.tecnico_aparelho_trocas FOR SELECT TO authenticated
  USING ((SELECT public.eh_escritorio()));

-- Este aparelho passa a ser o do técnico logado. Devolve FALSE se o login não é de técnico (nada muda).
CREATE OR REPLACE FUNCTION public.assumir_aparelho(p_aparelho TEXT, p_user_agent TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_atual TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'tecnico') THEN
    RETURN FALSE;
  END IF;
  IF coalesce(char_length(p_aparelho), 0) NOT BETWEEN 8 AND 100 THEN
    RAISE EXCEPTION 'Identificação do aparelho inválida.';
  END IF;

  SELECT aparelho_id INTO v_atual FROM public.tecnico_aparelho WHERE profile_id = auth.uid();
  IF v_atual IS DISTINCT FROM p_aparelho THEN
    INSERT INTO public.tecnico_aparelho (profile_id, aparelho_id, user_agent, desde)
    VALUES (auth.uid(), p_aparelho, left(p_user_agent, 300), NOW())
    ON CONFLICT (profile_id) DO UPDATE
      SET aparelho_id = EXCLUDED.aparelho_id, user_agent = EXCLUDED.user_agent, desde = NOW();
    INSERT INTO public.tecnico_aparelho_trocas (profile_id, employee_id, aparelho_id, user_agent)
    VALUES (auth.uid(), (SELECT id FROM public.employees WHERE profile_id = auth.uid()), p_aparelho, left(p_user_agent, 300));
  END IF;
  RETURN TRUE;
END;
$$;

-- Este aparelho ainda é o do técnico? Sem aparelho registrado (login anterior a esta regra), o primeiro
-- que perguntar fica com o técnico. Para quem não é técnico, sempre TRUE.
CREATE OR REPLACE FUNCTION public.aparelho_liberado(p_aparelho TEXT, p_user_agent TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_atual TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'tecnico') THEN
    RETURN TRUE;
  END IF;
  SELECT aparelho_id INTO v_atual FROM public.tecnico_aparelho WHERE profile_id = auth.uid();
  IF v_atual IS NULL THEN
    RETURN public.assumir_aparelho(p_aparelho, p_user_agent);
  END IF;
  RETURN v_atual = p_aparelho;
END;
$$;

REVOKE ALL ON FUNCTION public.assumir_aparelho(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.aparelho_liberado(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assumir_aparelho(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aparelho_liberado(TEXT, TEXT) TO authenticated;
