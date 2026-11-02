-- =====================================================================
-- Duração prevista da atividade (minutos), informada ao criar.
-- Fica guardada mesmo sem horário: é o tamanho do card ao arrastar da
-- fila "A agendar" para a linha do tempo.
-- =====================================================================

ALTER TABLE public.tasks
  ADD COLUMN estimated_minutes INTEGER CHECK (estimated_minutes > 0);

-- Atividades já agendadas: a duração é o próprio horário
UPDATE public.tasks
SET estimated_minutes = GREATEST(1, ROUND(EXTRACT(EPOCH FROM scheduled_end - scheduled_start) / 60))::INTEGER
WHERE scheduled_start IS NOT NULL AND scheduled_end IS NOT NULL;

-- Técnico também não altera a duração prevista
CREATE OR REPLACE FUNCTION public.tasks_protege_agenda()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.eh_escritorio() THEN
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
  RETURN NEW;
END;
$$;
