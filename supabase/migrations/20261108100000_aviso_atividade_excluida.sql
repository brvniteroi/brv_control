-- Excluir (lixeira) uma atividade de HOJE também avisa o técnico: "Atividade retirada da sua agenda de hoje".
-- Antes só criação e alteração avisavam, e o técnico podia ir a um cliente cuja atividade foi apagada.
--
-- Quando a Edge Function roda, a atividade já não existe; por isso o banco manda junto os dados para a mensagem
-- (`dados`: número da OS, cliente, tipo, título). Depois de aplicar: republicar a Edge Function `notificar-tecnico`.

-- push_enfileirar ganha o parâmetro opcional p_dados (versão de 20261103150000_push_fcm.sql + dados)
DROP FUNCTION IF EXISTS public.push_enfileirar(UUID, UUID, TEXT);
CREATE OR REPLACE FUNCTION public.push_enfileirar(p_employee UUID, p_task UUID, p_evento TEXT, p_dados JSONB DEFAULT NULL)
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
    body := jsonb_build_object('employee_id', p_employee, 'task_id', p_task, 'evento', p_evento, 'dados', p_dados),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-segredo', v_cfg.segredo),
    timeout_milliseconds := 10000
  );
EXCEPTION WHEN OTHERS THEN
  -- Aviso é extra: nunca impede salvar a atividade
  RAISE WARNING 'push_enfileirar: %', SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.push_enfileirar(UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_notifica_tecnico()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_hoje DATE := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_novo_hoje BOOLEAN;
  v_velho_hoje BOOLEAN;
  v_aberta_antes BOOLEAN;
  v_dados JSONB;
BEGIN
  -- Sem login (importação, scripts) não avisa
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.employee_id IS NULL
       OR OLD.status IN ('concluida', 'cancelada')
       OR OLD.scheduled_start IS NULL
       OR (OLD.scheduled_start AT TIME ZONE 'America/Sao_Paulo')::date <> v_hoje
       OR EXISTS (SELECT 1 FROM public.employees WHERE id = OLD.employee_id AND profile_id = auth.uid()) THEN
      RETURN NULL;
    END IF;
    -- A OS pode já ter sido apagada junto (exclusão em cascata): aí vai só o título
    SELECT jsonb_build_object('numero', so.number, 'cliente', coalesce(c.trade_name, c.name), 'tipo', st.name)
      INTO v_dados
      FROM public.service_orders so
      LEFT JOIN public.customers c ON c.id = so.customer_id
      LEFT JOIN public.service_types st ON st.id = so.service_type_id
     WHERE so.id = OLD.service_order_id;
    v_dados := coalesce(v_dados, '{}'::jsonb) || jsonb_build_object('titulo', OLD.title);
    PERFORM public.push_enfileirar(OLD.employee_id, OLD.id, 'removida', v_dados);
    RETURN NULL;
  END IF;

  v_novo_hoje := NEW.scheduled_start IS NOT NULL
    AND (NEW.scheduled_start AT TIME ZONE 'America/Sao_Paulo')::date = v_hoje;

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
  AFTER INSERT OR UPDATE OF employee_id, scheduled_start, status OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_notifica_tecnico();
