-- Ajustes para importar a base completa do Field Control (scripts/field-control/importar.mjs).
-- A importação roda com a chave service_role (sem login: auth.uid() é NULL).

-- 1. Formulário importado guarda a data em que foi preenchido no Field Control.
--    Com login, quem preencheu e quando continuam vindo do servidor.
CREATE OR REPLACE FUNCTION public.form_responses_preenche()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT service_order_id INTO NEW.service_order_id FROM public.tasks WHERE id = NEW.task_id;
    IF NEW.template_id IS NOT NULL AND auth.uid() IS NOT NULL THEN
      -- cliente não escolhe o conteúdo das perguntas: sempre vem do modelo
      SELECT name, questions INTO NEW.template_name, NEW.questions
      FROM public.form_templates WHERE id = NEW.template_id;
    END IF;
    IF NEW.template_name IS NULL OR NEW.questions IS NULL THEN
      RAISE EXCEPTION 'Modelo de formulário não encontrado' USING ERRCODE = '23502';
    END IF;
  ELSIF auth.uid() IS NOT NULL AND NOT public.eh_escritorio() THEN
    IF NEW.template_id IS DISTINCT FROM OLD.template_id
       OR NEW.template_name IS DISTINCT FROM OLD.template_name
       OR NEW.questions IS DISTINCT FROM OLD.questions
       OR NEW.task_id IS DISTINCT FROM OLD.task_id
       OR NEW.service_order_id IS DISTINCT FROM OLD.service_order_id THEN
      RAISE EXCEPTION 'Somente o escritório altera o modelo ou a atividade do formulário'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.status = 'preenchido' AND (TG_OP = 'INSERT' OR OLD.status <> 'preenchido') THEN
    IF auth.uid() IS NOT NULL OR NEW.filled_at IS NULL THEN
      NEW.filled_at := NOW();
      NEW.filled_by := auth.uid();
    END IF;
  ELSIF NEW.status = 'pendente' THEN
    NEW.filled_at := NULL;
    NEW.filled_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. O Field Control tem vídeos anexados às OS (mp4/mov)
ALTER TABLE public.attachments DROP CONSTRAINT IF EXISTS attachments_mime_type_check;
ALTER TABLE public.attachments ADD CONSTRAINT attachments_mime_type_check
  CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'));

-- 3. Depois de importar: a numeração das OS novas continua após a maior OS importada.
--    Só o importador (service_role) chama.
CREATE OR REPLACE FUNCTION public.ajustar_numeracao_os()
RETURNS BIGINT
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  SELECT setval(pg_get_serial_sequence('public.service_orders', 'number'),
                GREATEST((SELECT MAX(number) FROM public.service_orders), 1));
$$;
REVOKE EXECUTE ON FUNCTION public.ajustar_numeracao_os() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ajustar_numeracao_os() TO service_role;
