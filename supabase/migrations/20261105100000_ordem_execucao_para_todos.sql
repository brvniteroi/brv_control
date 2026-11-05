-- Ordem de execução vale para todos (técnico e escritório): uma atividade só sai de "agendada"
-- (a caminho, em execução ou concluída direto) se a anterior do MESMO técnico no mesmo dia já estiver
-- concluída ou cancelada. Ordem = scheduled_start, depois id. Antes só o técnico era barrado, e o escritório
-- conseguia abrir/mudar o status fora de ordem pela OS.
-- "Só atividades de hoje" continua só para o técnico (o escritório corrige dias passados).
-- Scripts com service_role (auth.uid() nulo) não são barrados.
-- Para liberar um caso preso: concluir ou cancelar a atividade anterior, ou reagendar a ordem.

CREATE OR REPLACE FUNCTION public.tasks_protege_agenda()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_anterior RECORD;
  v_escritorio BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  v_escritorio := public.eh_escritorio();

  IF NOT v_escritorio THEN
    IF NEW.service_order_id IS DISTINCT FROM OLD.service_order_id
       OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.scheduled_start IS DISTINCT FROM OLD.scheduled_start
       OR NEW.scheduled_end IS DISTINCT FROM OLD.scheduled_end
       OR NEW.estimated_minutes IS DISTINCT FROM OLD.estimated_minutes
       OR (NEW.status = 'cancelada' AND OLD.status <> 'cancelada') THEN
      RAISE EXCEPTION 'Somente o escritório pode reagendar, reatribuir ou cancelar atividades'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Saindo de "agendada" para a caminho / em execução / concluída (cancelar não conta)
  IF OLD.status = 'agendada' AND NEW.status NOT IN ('agendada', 'cancelada') THEN
    IF NOT v_escritorio AND (
         OLD.scheduled_start IS NULL
         OR (OLD.scheduled_start AT TIME ZONE 'America/Sao_Paulo')::date
            <> (NOW() AT TIME ZONE 'America/Sao_Paulo')::date) THEN
      RAISE EXCEPTION 'Só dá para iniciar atividades de hoje' USING ERRCODE = '42501';
    END IF;

    IF OLD.employee_id IS NOT NULL AND OLD.scheduled_start IS NOT NULL THEN
      SELECT t.status, so.number INTO v_anterior
      FROM public.tasks t
      LEFT JOIN public.service_orders so ON so.id = t.service_order_id
      WHERE t.employee_id = OLD.employee_id
        AND t.id <> OLD.id
        AND t.status <> 'cancelada'
        AND (t.scheduled_start AT TIME ZONE 'America/Sao_Paulo')::date
            = (OLD.scheduled_start AT TIME ZONE 'America/Sao_Paulo')::date
        AND (t.scheduled_start, t.id) < (OLD.scheduled_start, OLD.id)
      ORDER BY t.scheduled_start DESC, t.id DESC
      LIMIT 1;

      IF FOUND AND v_anterior.status <> 'concluida' THEN
        RAISE EXCEPTION 'Conclua antes a OS %', v_anterior.number USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
