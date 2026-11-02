-- Atividade não tem mais 'pendente' nem 'pausada': já nasce agendada, com técnico e horário.
-- Fim da fila "A agendar". Sistema ainda em criação: as atividades pendentes ou pausadas
-- são apagadas (fotos e formulários ligados a elas vão junto, por ON DELETE CASCADE),
-- assim como qualquer atividade em aberto que esteja sem técnico ou sem horário.

DELETE FROM public.tasks
WHERE status IN ('pendente', 'pausada')
   OR (status IN ('agendada', 'em_deslocamento', 'em_execucao')
       AND (employee_id IS NULL OR scheduled_start IS NULL));

ALTER TABLE public.tasks DROP CONSTRAINT tasks_status_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('agendada', 'em_deslocamento', 'em_execucao', 'concluida', 'cancelada'));
ALTER TABLE public.tasks ALTER COLUMN status SET DEFAULT 'agendada';

-- Atividade em aberto sempre tem técnico e horário (concluídas/canceladas importadas podem não ter)
ALTER TABLE public.tasks DROP CONSTRAINT tasks_scheduled_needs_slot;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_scheduled_needs_slot CHECK (
  status IN ('concluida', 'cancelada') OR (employee_id IS NOT NULL AND scheduled_start IS NOT NULL)
);
