-- Notificação push no APK do app de campo (Android): o WebView não faz Web Push, então o aparelho se
-- registra no Firebase (FCM) e guarda o token aqui. O aviso de agenda alterada (trigger
-- tasks_notifica_tecnico -> push_enfileirar -> Edge Function notificar-tecnico) passa a enviar também
-- para esses tokens. O Web Push do navegador continua funcionando como antes.
--
-- Depois de aplicar: republicar a Edge Function `notificar-tecnico` e criar o segredo
-- FIREBASE_SERVICE_ACCOUNT (JSON da conta de serviço do Firebase) em Edge Functions > Secrets.

CREATE TABLE IF NOT EXISTS public.push_fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS push_fcm_tokens_profile_idx ON public.push_fcm_tokens (profile_id);
ALTER TABLE public.push_fcm_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_fcm_tokens FROM anon, authenticated;
-- Sem política: só pelas funções abaixo e pela Edge Function (service_role)

-- O mesmo celular com outro login passa para o novo dono
CREATE OR REPLACE FUNCTION public.registrar_push_fcm(p_token TEXT, p_user_agent TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  IF coalesce(btrim(p_token), '') = '' OR char_length(p_token) > 4096 THEN
    RAISE EXCEPTION 'Token inválido.';
  END IF;
  INSERT INTO public.push_fcm_tokens (profile_id, token, user_agent)
  VALUES (auth.uid(), p_token, left(p_user_agent, 300))
  ON CONFLICT (token) DO UPDATE
    SET profile_id = EXCLUDED.profile_id, user_agent = EXCLUDED.user_agent, updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.remover_push_fcm(p_token TEXT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  DELETE FROM public.push_fcm_tokens WHERE token = p_token AND profile_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.registrar_push_fcm(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remover_push_fcm(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_push_fcm(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remover_push_fcm(TEXT) TO authenticated;

-- Só chama a Edge Function se o técnico tem aparelho (navegador ou APK) inscrito
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
  ) AND NOT EXISTS (
    SELECT 1 FROM public.push_fcm_tokens t JOIN public.employees e ON e.profile_id = t.profile_id
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
