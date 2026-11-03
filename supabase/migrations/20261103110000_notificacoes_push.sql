-- Notificação push no celular do técnico quando o escritório mexe na agenda de HOJE dele:
-- atividade nova, horário alterado, atividade passada para outro técnico ou para outro dia, cancelada.
--
-- Caminho: trigger em tasks -> push_enfileirar -> pg_net chama a Edge Function `notificar-tecnico`
-- (supabase/functions/notificar-tecnico) -> Web Push para os aparelhos do técnico (push_subscriptions).
-- A chamada vai depois do COMMIT (pg_net é assíncrono) e nunca impede salvar a atividade.
-- Mudança feita pelo próprio técnico (a caminho, iniciar, concluir) ou sem login (scripts de importação)
-- não gera aviso.
--
-- Depois de aplicar: rodar `node --env-file=.env scripts/configurar-push.mjs` (gera as chaves VAPID)
-- e publicar a Edge Function `notificar-tecnico` com "Verify JWT" DESLIGADO (ela confere o segredo abaixo).

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Aparelhos inscritos (um por navegador/celular; o mesmo aparelho com outro login passa para o novo dono)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_profile_idx ON public.push_subscriptions (profile_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;
-- Sem política: só pelas funções abaixo e pela Edge Function (service_role)

-- Configuração privada (ninguém do app lê; só as funções security definer e a Edge Function)
CREATE TABLE IF NOT EXISTS public.push_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  function_url TEXT NOT NULL,
  segredo TEXT NOT NULL,
  vapid_public TEXT,
  vapid_private TEXT,
  vapid_subject TEXT NOT NULL DEFAULT 'https://control.brvniteroi.com.br'
);
ALTER TABLE public.push_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_config FROM anon, authenticated;
INSERT INTO public.push_config (function_url, segredo)
VALUES (
  'https://kxznmsadntuihzlizlyp.supabase.co/functions/v1/notificar-tecnico',
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
)
ON CONFLICT (id) DO NOTHING;

-- Chave pública VAPID (o navegador precisa dela para se inscrever)
CREATE OR REPLACE FUNCTION public.push_chave_publica()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT vapid_public FROM public.push_config WHERE id = 1 AND auth.uid() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.registrar_push(p_endpoint TEXT, p_p256dh TEXT, p_auth TEXT, p_user_agent TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_endpoint !~ '^https://' OR coalesce(p_p256dh, '') = '' OR coalesce(p_auth, '') = '' THEN
    RAISE EXCEPTION 'Inscrição inválida.';
  END IF;
  INSERT INTO public.push_subscriptions (profile_id, endpoint, p256dh, auth, user_agent)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  ON CONFLICT (endpoint) DO UPDATE
    SET profile_id = EXCLUDED.profile_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent, updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.remover_push(p_endpoint TEXT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  DELETE FROM public.push_subscriptions WHERE endpoint = p_endpoint AND profile_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.push_chave_publica() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_push(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remover_push(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.push_chave_publica() TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_push(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remover_push(TEXT) TO authenticated;

-- Pede o envio à Edge Function (só se o técnico tem aparelho inscrito e as chaves já foram geradas)
CREATE OR REPLACE FUNCTION public.push_enfileirar(p_employee UUID, p_task UUID, p_evento TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_cfg public.push_config;
BEGIN
  SELECT * INTO v_cfg FROM public.push_config WHERE id = 1;
  IF v_cfg.vapid_private IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.push_subscriptions s JOIN public.employees e ON e.profile_id = s.profile_id
     WHERE e.id = p_employee
  ) THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := v_cfg.function_url,
    body := jsonb_build_object('employee_id', p_employee, 'task_id', p_task, 'evento', p_evento),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-segredo', v_cfg.segredo),
    timeout_milliseconds := 10000
  );
EXCEPTION WHEN OTHERS THEN
  -- Aviso é extra: nunca impede salvar a atividade
  RAISE WARNING 'push_enfileirar: %', SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.push_enfileirar(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_notifica_tecnico()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_hoje DATE := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_novo_hoje BOOLEAN := NEW.scheduled_start IS NOT NULL
    AND (NEW.scheduled_start AT TIME ZONE 'America/Sao_Paulo')::date = v_hoje;
  v_velho_hoje BOOLEAN;
  v_aberta_antes BOOLEAN;
BEGIN
  -- Sem login (importação, scripts) não avisa
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.employee_id IS NOT NULL AND v_novo_hoje AND NEW.status = 'agendada' THEN
      PERFORM public.push_enfileirar(NEW.employee_id, NEW.id, 'nova');
    END IF;
    RETURN NULL;
  END IF;

  -- O próprio técnico mexendo na atividade dele não gera aviso
  IF EXISTS (SELECT 1 FROM public.employees WHERE id = NEW.employee_id AND profile_id = auth.uid()) THEN
    RETURN NULL;
  END IF;

  v_velho_hoje := OLD.scheduled_start IS NOT NULL
    AND (OLD.scheduled_start AT TIME ZONE 'America/Sao_Paulo')::date = v_hoje;
  v_aberta_antes := OLD.status NOT IN ('concluida', 'cancelada');

  IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
    -- Passou para outro técnico: avisa quem recebeu e quem perdeu
    IF NEW.employee_id IS NOT NULL AND v_novo_hoje AND NEW.status = 'agendada' THEN
      PERFORM public.push_enfileirar(NEW.employee_id, NEW.id, 'nova');
    END IF;
    IF OLD.employee_id IS NOT NULL AND v_velho_hoje AND v_aberta_antes THEN
      PERFORM public.push_enfileirar(OLD.employee_id, NEW.id, 'removida');
    END IF;
  ELSIF NEW.employee_id IS NOT NULL THEN
    IF NEW.status = 'cancelada' AND v_aberta_antes THEN
      IF v_velho_hoje THEN PERFORM public.push_enfileirar(NEW.employee_id, NEW.id, 'cancelada'); END IF;
    ELSIF NEW.status = 'agendada' AND NEW.scheduled_start IS DISTINCT FROM OLD.scheduled_start THEN
      IF v_novo_hoje AND NOT v_velho_hoje THEN
        PERFORM public.push_enfileirar(NEW.employee_id, NEW.id, 'nova');      -- trazida para hoje
      ELSIF v_novo_hoje THEN
        PERFORM public.push_enfileirar(NEW.employee_id, NEW.id, 'horario');
      ELSIF v_velho_hoje THEN
        PERFORM public.push_enfileirar(NEW.employee_id, NEW.id, 'removida');  -- passou para outro dia
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tasks_notifica_tecnico ON public.tasks;
CREATE TRIGGER tasks_notifica_tecnico
  AFTER INSERT OR UPDATE OF employee_id, scheduled_start, status ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_notifica_tecnico();
