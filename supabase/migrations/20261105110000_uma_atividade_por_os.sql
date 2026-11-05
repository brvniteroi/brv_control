-- Cada OS tem no máximo uma atividade não cancelada: outra visita ao cliente é uma OS nova.
-- Cancelada não conta: dá para cancelar e criar outra na mesma OS (reagendar) ou reativar, se não houver outra.
-- O histórico com várias atividades fica como está: a regra só olha quem está entrando (criar, reativar ou
-- mudar de OS), então editar, concluir ou cancelar as atividades que já existem continua funcionando.
-- Scripts com service_role (auth.uid() nulo) não são barrados.

CREATE OR REPLACE FUNCTION public.tasks_uma_por_os()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NEW.status = 'cancelada' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status <> 'cancelada'
     AND NEW.service_order_id IS NOT DISTINCT FROM OLD.service_order_id THEN
    RETURN NEW;
  END IF;

  -- Trava a OS para dois salvamentos ao mesmo tempo não passarem juntos
  PERFORM 1 FROM public.service_orders WHERE id = NEW.service_order_id FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.service_order_id = NEW.service_order_id
      AND t.status <> 'cancelada'
      AND t.id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'Esta OS já tem uma atividade. Para outra visita, crie uma nova OS.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_uma_por_os ON public.tasks;
CREATE TRIGGER tasks_uma_por_os
  BEFORE INSERT OR UPDATE OF status, service_order_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_uma_por_os();
