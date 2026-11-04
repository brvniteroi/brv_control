-- A agenda acompanha o horário real: quando o técnico inicia, a atividade passa a começar na hora em que
-- ele iniciou (mesma duração); quando conclui, passa a terminar na hora em que concluiu. Assim a linha do
-- tempo, o calendário e o Mapa mostram o que aconteceu, não só o que estava previsto.
-- Se a mesma alteração já muda o horário (escritório arrastando na linha do tempo), vale o que veio.
--
-- Roda depois de tasks_protege_agenda (gatilhos BEFORE vão em ordem alfabética: "protege" < "segue"),
-- então o técnico continua proibido de mexer no horário por conta própria; quem mexe aqui é o banco.

CREATE OR REPLACE FUNCTION public.tasks_segue_horario_real()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_duracao INTERVAL;
BEGIN
  IF NEW.scheduled_start IS DISTINCT FROM OLD.scheduled_start
     OR NEW.scheduled_end IS DISTINCT FROM OLD.scheduled_end THEN
    RETURN NEW;
  END IF;
  IF NEW.scheduled_start IS NULL OR NEW.scheduled_end IS NULL THEN
    RETURN NEW;
  END IF;

  v_duracao := NEW.scheduled_end - NEW.scheduled_start;

  -- Iniciou (ou o início real foi corrigido): começa na hora real, com a mesma duração
  IF NEW.started_at IS NOT NULL AND NEW.started_at IS DISTINCT FROM OLD.started_at THEN
    NEW.scheduled_start := date_trunc('minute', NEW.started_at);
    NEW.scheduled_end := NEW.scheduled_start + v_duracao;
  END IF;

  -- Concluiu: termina na hora real
  IF NEW.finished_at IS NOT NULL AND NEW.finished_at IS DISTINCT FROM OLD.finished_at THEN
    NEW.scheduled_end := greatest(date_trunc('minute', NEW.finished_at), NEW.scheduled_start + INTERVAL '1 minute');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_segue_horario_real ON public.tasks;
CREATE TRIGGER tasks_segue_horario_real
  BEFORE UPDATE OF started_at, finished_at ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_segue_horario_real();

-- Acerta as atividades desde a virada do Field (2026-11-02) que já foram iniciadas/concluídas.
-- O histórico importado do Field fica como está.
UPDATE public.tasks
   SET scheduled_start = date_trunc('minute', started_at),
       scheduled_end = CASE
         WHEN finished_at IS NOT NULL
           THEN greatest(date_trunc('minute', finished_at), date_trunc('minute', started_at) + INTERVAL '1 minute')
         ELSE date_trunc('minute', started_at) + (scheduled_end - scheduled_start)
       END
 WHERE started_at IS NOT NULL
   AND scheduled_start IS NOT NULL
   AND scheduled_end IS NOT NULL
   AND field_control_id IS NULL
   AND started_at >= '2026-11-02'
   AND status IN ('em_execucao', 'concluida');
