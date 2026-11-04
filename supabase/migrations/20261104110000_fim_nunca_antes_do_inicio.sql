-- Concluir atividade cujo início real ficou DEPOIS da hora de conclusão (ex.: o escritório arrastou a
-- atividade em execução para mais tarde na linha do tempo, ou o relógio do celular está adiantado/atrasado)
-- dava erro "tasks_execution_valid" e a conclusão ficava presa na fila do app de campo.
-- Agora o fim nunca fica antes do início: se vier menor, vira igual ao início.
-- Nome "ajusta" vem antes de "protege"/"segue" na ordem alfabética dos gatilhos BEFORE.

CREATE OR REPLACE FUNCTION public.tasks_ajusta_fim()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NEW.finished_at IS NOT NULL AND NEW.started_at IS NOT NULL AND NEW.finished_at < NEW.started_at THEN
    NEW.finished_at := NEW.started_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_ajusta_fim ON public.tasks;
CREATE TRIGGER tasks_ajusta_fim
  BEFORE UPDATE OF started_at, finished_at ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_ajusta_fim();
