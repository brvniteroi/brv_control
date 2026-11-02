-- Situação da OS passa a seguir as atividades (antes era só manual).
-- Mesma regra da importação do Field Control (scripts/field-control/importar.mjs, statusOS):
--   alguma a caminho ou em execução       -> em_andamento
--   senão, alguma agendada                -> agendada
--   senão (todas concluídas ou canceladas) -> concluida (completed_at = fim da última atividade)
-- Não mexe em OS cancelada (decisão do escritório), em OS sem atividade ("a distribuir")
-- nem quando todas as atividades estão canceladas (o escritório decide se reagenda ou cancela a OS).

CREATE OR REPLACE FUNCTION public.atualizar_status_os(p_os UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_atual TEXT;
  v_novo TEXT;
  v_total INT;
  v_andamento INT;
  v_agendadas INT;
  v_canceladas INT;
  v_fim TIMESTAMPTZ;
BEGIN
  SELECT status INTO v_atual FROM public.service_orders WHERE id = p_os FOR UPDATE;
  IF NOT FOUND OR v_atual = 'cancelada' THEN
    RETURN;
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE status IN ('em_deslocamento', 'em_execucao')),
         count(*) FILTER (WHERE status = 'agendada'),
         count(*) FILTER (WHERE status = 'cancelada'),
         max(finished_at) FILTER (WHERE status = 'concluida')
    INTO v_total, v_andamento, v_agendadas, v_canceladas, v_fim
    FROM public.tasks
   WHERE service_order_id = p_os;

  IF v_total = v_canceladas THEN
    RETURN;
  END IF;

  v_novo := CASE
    WHEN v_andamento > 0 THEN 'em_andamento'
    WHEN v_agendadas > 0 THEN 'agendada'
    ELSE 'concluida'
  END;
  IF v_novo = v_atual THEN
    RETURN;
  END IF;

  UPDATE public.service_orders
     SET status = v_novo,
         completed_at = CASE WHEN v_novo = 'concluida' THEN coalesce(v_fim, NOW()) END
   WHERE id = p_os;
END;
$$;
-- Só para uso interno (trigger)
REVOKE EXECUTE ON FUNCTION public.atualizar_status_os(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_atualiza_status_os()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.atualizar_status_os(OLD.service_order_id);
  END IF;
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.service_order_id IS DISTINCT FROM OLD.service_order_id) THEN
    PERFORM public.atualizar_status_os(NEW.service_order_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tasks_atualiza_status_os ON public.tasks;
CREATE TRIGGER tasks_atualiza_status_os
  AFTER INSERT OR DELETE OR UPDATE OF status, service_order_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_atualiza_status_os();

-- Acerta as OS que já existem
DO $$
DECLARE v_id UUID;
BEGIN
  FOR v_id IN SELECT DISTINCT service_order_id FROM public.tasks LOOP
    PERFORM public.atualizar_status_os(v_id);
  END LOOP;
END $$;
