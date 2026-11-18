-- Atividade/OS "impedida": o técnico foi ao local, mas não conseguiu atender (cliente ausente, portão
-- fechado, acesso negado...). A atividade fica na linha do tempo (com o tempo da visita) e guarda o
-- motivo em tasks.impediment_reason. A OS segue as atividades: com a atividade impedida e nenhuma
-- agendada/em andamento, a OS fica "impedida" (o escritório reagenda: volta a atividade para "agendada").
--   - impedida conta como "resolvida" para liberar a próxima atividade do técnico no dia;
--   - só o escritório tira uma atividade de "impedida" (reagendar); o motivo é limpo ao sair dela;
--   - impedida não é concluída: relatórios e avaliação continuam olhando só "concluida".

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS impediment_reason TEXT;

ALTER TABLE public.tasks DROP CONSTRAINT tasks_status_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('agendada', 'em_deslocamento', 'em_execucao', 'impedida', 'concluida', 'cancelada'));

ALTER TABLE public.tasks ADD CONSTRAINT tasks_impedida_tem_motivo
  CHECK (status <> 'impedida' OR length(btrim(coalesce(impediment_reason, ''))) > 0);

ALTER TABLE public.service_orders DROP CONSTRAINT service_orders_status_check;
ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_status_check
  CHECK (status IN ('agendada', 'em_andamento', 'impedida', 'concluida', 'cancelada'));

-- Motivo só vale enquanto está impedida
CREATE OR REPLACE FUNCTION public.tasks_limpa_impedimento()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NEW.status <> 'impedida' THEN
    NEW.impediment_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_limpa_impedimento ON public.tasks;
CREATE TRIGGER tasks_limpa_impedimento
  BEFORE UPDATE OF status ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_limpa_impedimento();

-- Situação da OS: acrescenta "impedida" (alguma impedida, nenhuma a caminho/em execução/agendada)
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
  v_impedidas INT;
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
         count(*) FILTER (WHERE status = 'impedida'),
         count(*) FILTER (WHERE status = 'cancelada'),
         max(finished_at) FILTER (WHERE status = 'concluida')
    INTO v_total, v_andamento, v_agendadas, v_impedidas, v_canceladas, v_fim
    FROM public.tasks
   WHERE service_order_id = p_os;

  IF v_total = v_canceladas THEN
    RETURN;
  END IF;

  v_novo := CASE
    WHEN v_andamento > 0 THEN 'em_andamento'
    WHEN v_agendadas > 0 THEN 'agendada'
    WHEN v_impedidas > 0 THEN 'impedida'
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
REVOKE EXECUTE ON FUNCTION public.atualizar_status_os(UUID) FROM PUBLIC, anon, authenticated;

-- Ordem de execução: a anterior "impedida" também libera a próxima; só o escritório tira da "impedida"
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
    IF OLD.status = 'impedida' AND NEW.status <> 'impedida' THEN
      RAISE EXCEPTION 'Somente o escritório pode reagendar uma atividade impedida'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Saindo de "agendada" para a caminho / em execução / impedida / concluída (cancelar não conta)
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

      IF FOUND AND v_anterior.status NOT IN ('concluida', 'impedida') THEN
        RAISE EXCEPTION 'Conclua antes a OS %', v_anterior.number USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Acerta a situação das OS (nenhuma atividade está impedida ainda; só garante a regra nova aplicada)
DO $$
DECLARE v_id UUID;
BEGIN
  FOR v_id IN SELECT DISTINCT service_order_id FROM public.tasks WHERE status = 'impedida' LOOP
    PERFORM public.atualizar_status_os(v_id);
  END LOOP;
END $$;
