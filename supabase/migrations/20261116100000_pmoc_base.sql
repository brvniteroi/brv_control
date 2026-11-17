-- =====================================================================
-- PMOC, fase 1 (plano em docs/pmoc.md): planos, ambientes, aparelhos do plano, cronograma, modelos de tarefa,
-- registros de execução mensal (preenchidos na fase 2) e histórico do plano.
--
-- Decisões (2026-11-16): o aparelho do plano é o do cadastro do cliente (`equipments`); o responsável técnico é copiado
-- de `funcionario_dados` (só admin lê) para o plano, por função que devolve só nome, CPF e registro; gravação do plano
-- inteiro numa única função (tudo ou nada): `pmoc_salvar_plano`.
-- Acesso: admin e escritório leem; escrevem só pelas funções. Excluir plano: só admin. Técnico: fase 2.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Modelos de tarefa por tipo de aparelho
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pmoc_task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_type TEXT NOT NULL CHECK (char_length(btrim(equipment_type)) > 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS pmoc_task_templates_tipo_key ON public.pmoc_task_templates (lower(btrim(equipment_type)));

CREATE TABLE IF NOT EXISTS public.pmoc_task_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.pmoc_task_templates (id) ON DELETE CASCADE,
  description TEXT NOT NULL CHECK (char_length(btrim(description)) > 0),
  periodicity TEXT NOT NULL CHECK (periodicity IN ('mensal', 'bimestral', 'trimestral', 'semestral', 'anual')),
  relative_start_month SMALLINT NOT NULL DEFAULT 1 CHECK (relative_start_month BETWEEN 1 AND 12),
  requires_measurement BOOLEAN NOT NULL DEFAULT FALSE,
  measurement_fields TEXT[] NOT NULL DEFAULT '{}'
    CHECK (measurement_fields <@ ARRAY['current_a', 'temp_supply_c', 'temp_return_c', 'temp_ambient_c']::TEXT[]),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS pmoc_task_template_items_tpl_idx ON public.pmoc_task_template_items (template_id, sort_order);

-- ---------------------------------------------------------------------
-- 2. Planos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pmoc_code_seq (
  ano INTEGER PRIMARY KEY,
  ultimo INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.pmoc_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,                               -- PMOC-AAAA-NNNN
  customer_id UUID NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  -- Cópia dos dados do cliente impressos no documento (o documento é um retrato do contrato)
  customer_name TEXT NOT NULL,
  customer_trade_name TEXT,
  customer_person_type TEXT NOT NULL DEFAULT 'PJ' CHECK (customer_person_type IN ('PF', 'PJ')),
  customer_document TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  address_id UUID REFERENCES public.customer_addresses (id) ON DELETE SET NULL,
  address_snapshot JSONB,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'vigente', 'encerrado')),
  -- Responsável técnico (cópia congelada; CPF e registro vêm de funcionario_dados)
  responsible_employee_id UUID REFERENCES public.employees (id) ON DELETE SET NULL,
  responsible_name TEXT NOT NULL DEFAULT '',
  responsible_cpf TEXT,
  responsible_email TEXT,
  responsible_phone TEXT,
  registration_type TEXT NOT NULL DEFAULT 'CFT' CHECK (registration_type IN ('CFT', 'CREA')),
  registration_number TEXT NOT NULL DEFAULT '',
  responsibility_term_number TEXT NOT NULL DEFAULT '',    -- TRT (CFT) ou ART (CREA)
  trt_attachment_url TEXT,
  trt_attachment_name TEXT,
  trt_attachment_mime TEXT,
  elaborated_by TEXT NOT NULL DEFAULT 'BRV Niterói Elétrica e Refrigeração Ltda',
  notes TEXT,
  created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pmoc_plans_vigencia CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS pmoc_plans_customer_idx ON public.pmoc_plans (customer_id);

DROP TRIGGER IF EXISTS set_updated_at ON public.pmoc_plans;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.pmoc_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.pmoc_task_templates;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.pmoc_task_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. Ambientes, aparelhos do plano e cronograma
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pmoc_environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.pmoc_plans (id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) > 0),
  code TEXT NOT NULL CHECK (code ~ '^[A-Z]{2,3}$'),       -- sigla do identificador AR-<SIGLA>-0001
  fixed_occupants INTEGER NOT NULL DEFAULT 0 CHECK (fixed_occupants >= 0),
  floating_occupants INTEGER NOT NULL DEFAULT 0 CHECK (floating_occupants >= 0),
  area_m2 NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (area_m2 >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Adiada para o fim da transação: trocar a sigla entre dois ambientes no mesmo salvamento não pode falhar no meio
  CONSTRAINT pmoc_environments_sigla_key UNIQUE (plan_id, code) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS public.pmoc_plan_equipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.pmoc_plans (id) ON DELETE CASCADE,
  -- Decisão 1: sempre um aparelho do cadastro do cliente (tipo, marca, modelo, série e BTU ficam lá)
  equipment_id UUID NOT NULL REFERENCES public.equipments (id) ON DELETE RESTRICT,
  environment_id UUID REFERENCES public.pmoc_environments (id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) > 0),
  identifier TEXT NOT NULL CHECK (char_length(btrim(identifier)) > 0),   -- AR-<SIGLA>-0001
  photo_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pmoc_plan_equipments_identificador_key UNIQUE (plan_id, identifier) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT pmoc_plan_equipments_aparelho_key UNIQUE (plan_id, equipment_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS pmoc_plan_equipments_equipment_idx ON public.pmoc_plan_equipments (equipment_id);

CREATE TABLE IF NOT EXISTS public.pmoc_equipment_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.pmoc_plans (id) ON DELETE CASCADE,
  plan_equipment_id UUID NOT NULL REFERENCES public.pmoc_plan_equipments (id) ON DELETE CASCADE,
  template_item_id UUID REFERENCES public.pmoc_task_template_items (id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  periodicity TEXT NOT NULL CHECK (periodicity IN ('mensal', 'bimestral', 'trimestral', 'semestral', 'anual')),
  start_month_offset SMALLINT NOT NULL DEFAULT 1 CHECK (start_month_offset BETWEEN 1 AND 12),
  requires_measurement BOOLEAN NOT NULL DEFAULT FALSE,
  measurement_fields TEXT[] NOT NULL DEFAULT '{}'
    CHECK (measurement_fields <@ ARRAY['current_a', 'temp_supply_c', 'temp_return_c', 'temp_ambient_c']::TEXT[]),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS pmoc_equipment_tasks_eq_idx ON public.pmoc_equipment_tasks (plan_equipment_id, sort_order);
CREATE INDEX IF NOT EXISTS pmoc_equipment_tasks_plan_idx ON public.pmoc_equipment_tasks (plan_id);

-- ---------------------------------------------------------------------
-- 4. Execução mensal por aparelho (a fase 2 preenche pelo app de campo)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pmoc_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.pmoc_plans (id) ON DELETE CASCADE,
  -- RESTRICT: aparelho com manutenção registrada não sai do plano (desativa)
  plan_equipment_id UUID NOT NULL REFERENCES public.pmoc_plan_equipments (id) ON DELETE RESTRICT,
  reference_month TEXT NOT NULL CHECK (reference_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluida', 'nao_atendido')),
  service_order_id UUID REFERENCES public.service_orders (id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks (id) ON DELETE SET NULL,
  technician_id UUID REFERENCES public.employees (id) ON DELETE SET NULL,
  executed_at TIMESTAMPTZ,
  measurements JSONB NOT NULL DEFAULT '{}'::JSONB,
  task_results JSONB NOT NULL DEFAULT '[]'::JSONB,
  technician_notes TEXT,
  unattended_reason TEXT,
  accompanied_by TEXT,                                    -- decisão 4: nome de quem acompanhou (sem assinatura)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pmoc_executions_mes_key UNIQUE (plan_equipment_id, reference_month)
);
CREATE INDEX IF NOT EXISTS pmoc_executions_plan_idx ON public.pmoc_executions (plan_id, reference_month);
CREATE INDEX IF NOT EXISTS pmoc_executions_os_idx ON public.pmoc_executions (service_order_id) WHERE service_order_id IS NOT NULL;
DROP TRIGGER IF EXISTS set_updated_at ON public.pmoc_executions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.pmoc_executions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5. Histórico do plano (imutável)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pmoc_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.pmoc_plans (id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('criacao', 'situacao', 'responsavel', 'termo', 'vigencia')),
  old_value TEXT,
  new_value TEXT,
  actor_id UUID,
  actor_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pmoc_events_plan_idx ON public.pmoc_events (plan_id, created_at);

CREATE OR REPLACE FUNCTION public.pmoc_plans_audita()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_ator UUID := auth.uid();
  v_nome TEXT := (SELECT full_name FROM public.profiles WHERE id = auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.pmoc_events (plan_id, event_type, new_value, actor_id, actor_name)
    VALUES (NEW.id, 'criacao', NEW.code || ' (' || NEW.status || ')', v_ator, v_nome);
    RETURN NULL;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.pmoc_events (plan_id, event_type, old_value, new_value, actor_id, actor_name)
    VALUES (NEW.id, 'situacao', OLD.status, NEW.status, v_ator, v_nome);
  END IF;
  IF (NEW.responsible_name, NEW.responsible_cpf, NEW.registration_type, NEW.registration_number)
     IS DISTINCT FROM (OLD.responsible_name, OLD.responsible_cpf, OLD.registration_type, OLD.registration_number) THEN
    INSERT INTO public.pmoc_events (plan_id, event_type, old_value, new_value, actor_id, actor_name)
    VALUES (NEW.id, 'responsavel', OLD.responsible_name || ' / ' || OLD.registration_number,
            NEW.responsible_name || ' / ' || NEW.registration_number, v_ator, v_nome);
  END IF;
  IF (NEW.responsibility_term_number, NEW.trt_attachment_url) IS DISTINCT FROM (OLD.responsibility_term_number, OLD.trt_attachment_url) THEN
    INSERT INTO public.pmoc_events (plan_id, event_type, old_value, new_value, actor_id, actor_name)
    VALUES (NEW.id, 'termo', OLD.responsibility_term_number || coalesce(' (' || OLD.trt_attachment_name || ')', ''),
            NEW.responsibility_term_number || coalesce(' (' || NEW.trt_attachment_name || ')', ''), v_ator, v_nome);
  END IF;
  IF (NEW.start_date, NEW.end_date) IS DISTINCT FROM (OLD.start_date, OLD.end_date) THEN
    INSERT INTO public.pmoc_events (plan_id, event_type, old_value, new_value, actor_id, actor_name)
    VALUES (NEW.id, 'vigencia', to_char(OLD.start_date, 'DD/MM/YYYY') || ' a ' || to_char(OLD.end_date, 'DD/MM/YYYY'),
            to_char(NEW.start_date, 'DD/MM/YYYY') || ' a ' || to_char(NEW.end_date, 'DD/MM/YYYY'), v_ator, v_nome);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pmoc_plans_audita() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS pmoc_plans_audita ON public.pmoc_plans;
CREATE TRIGGER pmoc_plans_audita AFTER INSERT OR UPDATE ON public.pmoc_plans
  FOR EACH ROW EXECUTE FUNCTION public.pmoc_plans_audita();

-- ---------------------------------------------------------------------
-- 6. Acesso (RLS): leitura para admin e escritório; escrita só pelas funções abaixo
-- ---------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['pmoc_task_templates', 'pmoc_task_template_items', 'pmoc_code_seq', 'pmoc_plans', 'pmoc_environments',
                           'pmoc_plan_equipments', 'pmoc_equipment_tasks', 'pmoc_executions', 'pmoc_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['pmoc_task_templates', 'pmoc_task_template_items', 'pmoc_plans', 'pmoc_environments',
                           'pmoc_plan_equipments', 'pmoc_equipment_tasks', 'pmoc_executions', 'pmoc_events'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Escritório lê" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Escritório lê" ON public.%I FOR SELECT TO authenticated USING ((SELECT public.eh_escritorio()))', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Só admin exclui" ON public.pmoc_plans;
CREATE POLICY "Só admin exclui" ON public.pmoc_plans FOR DELETE TO authenticated USING ((SELECT public.eh_admin()));

-- ---------------------------------------------------------------------
-- 7. Responsável técnico: só nome, CPF e registro (o resto de funcionario_dados continua só do admin)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pmoc_dados_responsavel(p_employee UUID)
RETURNS TABLE (employee_id UUID, nome TEXT, cpf TEXT, registro TEXT, email TEXT, telefone TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT e.id, e.name, fd.cpf, fd.registro_profissional, e.email, e.phone
    FROM public.employees e
    LEFT JOIN public.funcionario_dados fd ON fd.employee_id = e.id
    WHERE e.id = p_employee;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pmoc_dados_responsavel(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pmoc_dados_responsavel(UUID) TO authenticated;

-- Responsável sugerido no plano novo (decisão 7: hoje é sempre o Braulio): o único funcionário ativo com registro profissional
CREATE OR REPLACE FUNCTION public.pmoc_responsavel_padrao()
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_ids UUID[];
BEGIN
  IF NOT public.eh_escritorio() THEN
    RETURN NULL;
  END IF;
  SELECT array_agg(e.id) INTO v_ids
  FROM public.employees e
  JOIN public.funcionario_dados fd ON fd.employee_id = e.id
  WHERE e.active AND char_length(btrim(coalesce(fd.registro_profissional, ''))) > 0;
  RETURN CASE WHEN array_length(v_ids, 1) = 1 THEN v_ids[1] ELSE NULL END;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pmoc_responsavel_padrao() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pmoc_responsavel_padrao() TO authenticated;

-- ---------------------------------------------------------------------
-- 8. Gravar o plano inteiro (dados gerais, ambientes, aparelhos e cronograma) numa transação só
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pmoc_salvar_plano(
  p_plano JSONB,
  p_ambientes JSONB DEFAULT '[]'::JSONB,
  p_equipamentos JSONB DEFAULT '[]'::JSONB,
  p_tarefas JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_id UUID := NULLIF(p_plano->>'id', '')::UUID;
  v_existe BOOLEAN;
  v_cliente UUID := NULLIF(p_plano->>'customer_id', '')::UUID;
  v_endereco UUID := NULLIF(p_plano->>'address_id', '')::UUID;
  v_inicio DATE := NULLIF(p_plano->>'start_date', '')::DATE;
  v_fim DATE := NULLIF(p_plano->>'end_date', '')::DATE;
  v_status TEXT := coalesce(NULLIF(p_plano->>'status', ''), 'rascunho');
  v_resp UUID := NULLIF(p_plano->>'responsible_employee_id', '')::UUID;
  v_resp_nome TEXT := btrim(coalesce(p_plano->>'responsible_name', ''));
  v_resp_cpf TEXT := NULLIF(btrim(coalesce(p_plano->>'responsible_cpf', '')), '');
  v_registro TEXT := btrim(coalesce(p_plano->>'registration_number', ''));
  v_termo TEXT := btrim(coalesce(p_plano->>'responsibility_term_number', ''));
  v_fd_nome TEXT; v_fd_cpf TEXT; v_fd_registro TEXT;
  v_ano INTEGER; v_seq INTEGER;
  a JSONB; e JSONB; t JSONB;
  v_amb_ids UUID[] := '{}';
  v_eq_ids UUID[] := '{}';
  v_tar_ids UUID[] := '{}';
  v_aparelho UUID; v_pe UUID; v_dono UUID; v_plano_do_item UUID;
  v_cap INTEGER; v_nome_amb TEXT;
  v_ordem INTEGER;
  v_ordem_eq JSONB := '{}'::JSONB;
  v_tpl UUID; v_tpl_item UUID;
  r RECORD;
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Só o escritório ou o administrador grava planos PMOC.' USING ERRCODE = '42501';
  END IF;
  IF v_cliente IS NULL OR NOT EXISTS (SELECT 1 FROM public.customers WHERE id = v_cliente) THEN
    RAISE EXCEPTION 'Selecione o cliente do plano.' USING ERRCODE = '23514';
  END IF;
  IF v_inicio IS NULL OR v_fim IS NULL THEN
    RAISE EXCEPTION 'Preencha o início e o fim da vigência.' USING ERRCODE = '23514';
  END IF;
  IF v_status NOT IN ('rascunho', 'vigente', 'encerrado') THEN
    RAISE EXCEPTION 'Situação do plano inválida.' USING ERRCODE = '23514';
  END IF;
  IF v_endereco IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.customer_addresses WHERE id = v_endereco AND customer_id = v_cliente) THEN
    RAISE EXCEPTION 'O endereço escolhido não é deste cliente.' USING ERRCODE = '23514';
  END IF;

  -- Responsável: o que não foi digitado vem do cadastro do funcionário (CPF e registro ficam em funcionario_dados)
  IF v_resp IS NOT NULL THEN
    SELECT e2.name, fd.cpf, fd.registro_profissional INTO v_fd_nome, v_fd_cpf, v_fd_registro
    FROM public.employees e2 LEFT JOIN public.funcionario_dados fd ON fd.employee_id = e2.id
    WHERE e2.id = v_resp;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Responsável técnico não encontrado.' USING ERRCODE = '23514';
    END IF;
    v_resp_nome := coalesce(NULLIF(v_resp_nome, ''), v_fd_nome, '');
    v_resp_cpf := coalesce(v_resp_cpf, NULLIF(btrim(coalesce(v_fd_cpf, '')), ''));
    v_registro := coalesce(NULLIF(v_registro, ''), btrim(coalesce(v_fd_registro, '')));
  END IF;

  -- Dados gerais
  v_existe := v_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.pmoc_plans WHERE id = v_id);
  IF v_existe THEN
    UPDATE public.pmoc_plans SET
      customer_id = v_cliente,
      customer_name = btrim(coalesce(p_plano->>'customer_name', '')),
      customer_trade_name = NULLIF(btrim(coalesce(p_plano->>'customer_trade_name', '')), ''),
      customer_person_type = coalesce(NULLIF(p_plano->>'customer_person_type', ''), 'PJ'),
      customer_document = NULLIF(btrim(coalesce(p_plano->>'customer_document', '')), ''),
      customer_email = NULLIF(btrim(coalesce(p_plano->>'customer_email', '')), ''),
      customer_phone = NULLIF(btrim(coalesce(p_plano->>'customer_phone', '')), ''),
      address_id = v_endereco,
      address_snapshot = CASE WHEN jsonb_typeof(p_plano->'address_snapshot') = 'object' THEN p_plano->'address_snapshot' END,
      start_date = v_inicio,
      end_date = v_fim,
      status = v_status,
      responsible_employee_id = v_resp,
      responsible_name = v_resp_nome,
      responsible_cpf = v_resp_cpf,
      responsible_email = NULLIF(btrim(coalesce(p_plano->>'responsible_email', '')), ''),
      responsible_phone = NULLIF(btrim(coalesce(p_plano->>'responsible_phone', '')), ''),
      registration_type = coalesce(NULLIF(p_plano->>'registration_type', ''), 'CFT'),
      registration_number = v_registro,
      responsibility_term_number = v_termo,
      trt_attachment_url = NULLIF(p_plano->>'trt_attachment_url', ''),
      trt_attachment_name = NULLIF(p_plano->>'trt_attachment_name', ''),
      trt_attachment_mime = NULLIF(p_plano->>'trt_attachment_mime', ''),
      elaborated_by = coalesce(NULLIF(btrim(coalesce(p_plano->>'elaborated_by', '')), ''), 'BRV Niterói Elétrica e Refrigeração Ltda'),
      notes = NULLIF(btrim(coalesce(p_plano->>'notes', '')), '')
    WHERE id = v_id;
  ELSE
    v_ano := extract(YEAR FROM v_inicio)::INTEGER;
    INSERT INTO public.pmoc_code_seq AS s (ano, ultimo) VALUES (v_ano, 1)
      ON CONFLICT (ano) DO UPDATE SET ultimo = s.ultimo + 1
      RETURNING ultimo INTO v_seq;
    INSERT INTO public.pmoc_plans (
      code, customer_id, customer_name, customer_trade_name, customer_person_type, customer_document, customer_email,
      customer_phone, address_id, address_snapshot, start_date, end_date, status, responsible_employee_id, responsible_name,
      responsible_cpf, responsible_email, responsible_phone, registration_type, registration_number, responsibility_term_number,
      trt_attachment_url, trt_attachment_name, trt_attachment_mime, elaborated_by, notes, created_by
    ) VALUES (
      'PMOC-' || v_ano || '-' || lpad(v_seq::TEXT, 4, '0'), v_cliente,
      btrim(coalesce(p_plano->>'customer_name', '')),
      NULLIF(btrim(coalesce(p_plano->>'customer_trade_name', '')), ''),
      coalesce(NULLIF(p_plano->>'customer_person_type', ''), 'PJ'),
      NULLIF(btrim(coalesce(p_plano->>'customer_document', '')), ''),
      NULLIF(btrim(coalesce(p_plano->>'customer_email', '')), ''),
      NULLIF(btrim(coalesce(p_plano->>'customer_phone', '')), ''),
      v_endereco,
      CASE WHEN jsonb_typeof(p_plano->'address_snapshot') = 'object' THEN p_plano->'address_snapshot' END,
      v_inicio, v_fim, v_status, v_resp, v_resp_nome, v_resp_cpf,
      NULLIF(btrim(coalesce(p_plano->>'responsible_email', '')), ''),
      NULLIF(btrim(coalesce(p_plano->>'responsible_phone', '')), ''),
      coalesce(NULLIF(p_plano->>'registration_type', ''), 'CFT'), v_registro, v_termo,
      NULLIF(p_plano->>'trt_attachment_url', ''), NULLIF(p_plano->>'trt_attachment_name', ''), NULLIF(p_plano->>'trt_attachment_mime', ''),
      coalesce(NULLIF(btrim(coalesce(p_plano->>'elaborated_by', '')), ''), 'BRV Niterói Elétrica e Refrigeração Ltda'),
      NULLIF(btrim(coalesce(p_plano->>'notes', '')), ''),
      auth.uid()
    ) RETURNING id INTO v_id;
  END IF;

  -- Ambientes (sincroniza: o que não veio na lista sai; os aparelhos dele ficam sem ambiente)
  v_ordem := 0;
  FOR a IN SELECT * FROM jsonb_array_elements(coalesce(p_ambientes, '[]'::JSONB)) LOOP
    v_ordem := v_ordem + 1;
    v_pe := NULLIF(a->>'id', '')::UUID;
    SELECT plan_id INTO v_plano_do_item FROM public.pmoc_environments WHERE id = v_pe;
    IF FOUND AND v_plano_do_item <> v_id THEN
      RAISE EXCEPTION 'Ambiente de outro plano.' USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.pmoc_environments AS x (id, plan_id, name, code, fixed_occupants, floating_occupants, area_m2, sort_order)
    VALUES (coalesce(v_pe, gen_random_uuid()), v_id, btrim(coalesce(a->>'name', '')), upper(btrim(coalesce(a->>'code', ''))),
            greatest(0, coalesce((a->>'fixed_occupants')::NUMERIC, 0))::INTEGER,
            greatest(0, coalesce((a->>'floating_occupants')::NUMERIC, 0))::INTEGER,
            round(greatest(0, coalesce((a->>'area_m2')::NUMERIC, 0)), 2), v_ordem)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code, fixed_occupants = EXCLUDED.fixed_occupants,
      floating_occupants = EXCLUDED.floating_occupants, area_m2 = EXCLUDED.area_m2, sort_order = EXCLUDED.sort_order
    RETURNING x.id INTO v_pe;
    v_amb_ids := v_amb_ids || v_pe;
  END LOOP;
  DELETE FROM public.pmoc_environments WHERE plan_id = v_id AND NOT (id = ANY (v_amb_ids));

  -- Aparelhos: sem aparelho do cadastro, cria no cadastro do cliente (decisão 1); com aparelho, atualiza o cadastro
  v_ordem := 0;
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_equipamentos, '[]'::JSONB)) LOOP
    v_ordem := v_ordem + 1;
    v_pe := NULLIF(e->>'id', '')::UUID;
    v_aparelho := NULLIF(e->>'equipment_id', '')::UUID;
    v_cap := NULLIF(greatest(0, coalesce((e->>'capacity_btu')::NUMERIC, 0))::INTEGER, 0);
    SELECT plan_id INTO v_plano_do_item FROM public.pmoc_plan_equipments WHERE id = v_pe;
    IF FOUND AND v_plano_do_item <> v_id THEN
      RAISE EXCEPTION 'Aparelho de outro plano.' USING ERRCODE = '23514';
    END IF;
    IF char_length(btrim(coalesce(e->>'equipment_type', ''))) = 0 THEN
      RAISE EXCEPTION 'Informe o tipo do aparelho "%".', coalesce(e->>'name', '') USING ERRCODE = '23514';
    END IF;
    SELECT name INTO v_nome_amb FROM public.pmoc_environments WHERE id = NULLIF(e->>'environment_id', '')::UUID AND plan_id = v_id;

    IF v_aparelho IS NULL THEN
      INSERT INTO public.equipments (customer_id, address_id, category, brand, model, serial_number, capacity_btu, location)
      VALUES (v_cliente, v_endereco, btrim(e->>'equipment_type'),
              NULLIF(btrim(coalesce(e->>'brand', '')), ''), NULLIF(btrim(coalesce(e->>'model', '')), ''),
              NULLIF(btrim(coalesce(e->>'serial_number', '')), ''), v_cap, v_nome_amb)
      RETURNING id INTO v_aparelho;
    ELSE
      SELECT customer_id INTO v_dono FROM public.equipments WHERE id = v_aparelho;
      IF NOT FOUND OR v_dono <> v_cliente THEN
        RAISE EXCEPTION 'O aparelho "%" não é do cliente deste plano.', coalesce(e->>'name', '') USING ERRCODE = '23514';
      END IF;
      UPDATE public.equipments SET
        category = btrim(e->>'equipment_type'),
        brand = coalesce(NULLIF(btrim(coalesce(e->>'brand', '')), ''), brand),
        model = coalesce(NULLIF(btrim(coalesce(e->>'model', '')), ''), model),
        serial_number = coalesce(NULLIF(btrim(coalesce(e->>'serial_number', '')), ''), serial_number),
        capacity_btu = coalesce(v_cap, capacity_btu)
      WHERE id = v_aparelho;
    END IF;

    INSERT INTO public.pmoc_plan_equipments AS x (id, plan_id, equipment_id, environment_id, name, identifier, photo_url, sort_order, active)
    VALUES (coalesce(v_pe, gen_random_uuid()), v_id, v_aparelho,
            (SELECT id FROM public.pmoc_environments WHERE id = NULLIF(e->>'environment_id', '')::UUID AND plan_id = v_id),
            btrim(coalesce(e->>'name', '')), upper(btrim(coalesce(e->>'identifier', ''))),
            NULLIF(e->>'photo_url', ''), v_ordem, coalesce((e->>'active')::BOOLEAN, TRUE))
    ON CONFLICT (id) DO UPDATE SET equipment_id = EXCLUDED.equipment_id, environment_id = EXCLUDED.environment_id,
      name = EXCLUDED.name, identifier = EXCLUDED.identifier, photo_url = EXCLUDED.photo_url,
      sort_order = EXCLUDED.sort_order, active = EXCLUDED.active
    RETURNING x.id INTO v_pe;
    v_eq_ids := v_eq_ids || v_pe;
  END LOOP;

  FOR r IN
    SELECT pe.id, pe.name FROM public.pmoc_plan_equipments pe
    WHERE pe.plan_id = v_id AND NOT (pe.id = ANY (v_eq_ids))
      AND EXISTS (SELECT 1 FROM public.pmoc_executions x WHERE x.plan_equipment_id = pe.id)
  LOOP
    RAISE EXCEPTION 'O aparelho "%" já tem manutenção registrada e não pode sair do plano. Desative-o em vez de remover.', r.name
      USING ERRCODE = '23514';
  END LOOP;
  DELETE FROM public.pmoc_plan_equipments WHERE plan_id = v_id AND NOT (id = ANY (v_eq_ids));

  -- Cronograma: tarefas de aparelhos do plano; a ordem é a da lista, por aparelho
  FOR t IN SELECT * FROM jsonb_array_elements(coalesce(p_tarefas, '[]'::JSONB)) LOOP
    v_pe := NULLIF(t->>'plan_equipment_id', '')::UUID;
    CONTINUE WHEN v_pe IS NULL OR NOT (v_pe = ANY (v_eq_ids));
    v_ordem := coalesce((v_ordem_eq->>v_pe::TEXT)::INTEGER, 0) + 1;
    v_ordem_eq := v_ordem_eq || jsonb_build_object(v_pe::TEXT, v_ordem);
    v_tpl_item := (SELECT id FROM public.pmoc_task_template_items
                   WHERE id::TEXT = NULLIF(t->>'template_item_id', ''));
    SELECT plan_id INTO v_plano_do_item FROM public.pmoc_equipment_tasks WHERE id = NULLIF(t->>'id', '')::UUID;
    IF FOUND AND v_plano_do_item <> v_id THEN
      RAISE EXCEPTION 'Tarefa de outro plano.' USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.pmoc_equipment_tasks AS x (id, plan_id, plan_equipment_id, template_item_id, description, periodicity,
      start_month_offset, requires_measurement, measurement_fields, sort_order, active)
    VALUES (
      coalesce(NULLIF(t->>'id', '')::UUID, gen_random_uuid()), v_id, v_pe, v_tpl_item, btrim(coalesce(t->>'description', '')),
      coalesce(NULLIF(t->>'periodicity', ''), 'mensal'),
      least(12, greatest(1, coalesce((t->>'start_month_offset')::NUMERIC, 1)))::SMALLINT,
      coalesce((t->>'requires_measurement')::BOOLEAN, FALSE),
      CASE WHEN coalesce((t->>'requires_measurement')::BOOLEAN, FALSE) AND jsonb_typeof(t->'measurement_fields') = 'array'
           THEN ARRAY(SELECT jsonb_array_elements_text(t->'measurement_fields')) ELSE '{}'::TEXT[] END,
      v_ordem, coalesce((t->>'active')::BOOLEAN, TRUE)
    )
    ON CONFLICT (id) DO UPDATE SET plan_equipment_id = EXCLUDED.plan_equipment_id, template_item_id = EXCLUDED.template_item_id,
      description = EXCLUDED.description, periodicity = EXCLUDED.periodicity, start_month_offset = EXCLUDED.start_month_offset,
      requires_measurement = EXCLUDED.requires_measurement, measurement_fields = EXCLUDED.measurement_fields,
      sort_order = EXCLUDED.sort_order, active = EXCLUDED.active
    RETURNING x.id INTO v_tpl;
    v_tar_ids := v_tar_ids || v_tpl;
  END LOOP;
  DELETE FROM public.pmoc_equipment_tasks WHERE plan_id = v_id AND NOT (id = ANY (v_tar_ids));

  -- Aparelho sem nenhuma tarefa: recebe o modelo do tipo dele (ou o Split Hi-Wall, que é o padrão da BRV)
  FOR r IN
    SELECT pe.id, eq.category FROM public.pmoc_plan_equipments pe JOIN public.equipments eq ON eq.id = pe.equipment_id
    WHERE pe.plan_id = v_id AND NOT EXISTS (SELECT 1 FROM public.pmoc_equipment_tasks x WHERE x.plan_equipment_id = pe.id)
  LOOP
    v_tpl := coalesce(
      (SELECT id FROM public.pmoc_task_templates WHERE lower(btrim(equipment_type)) = lower(btrim(r.category))),
      (SELECT id FROM public.pmoc_task_templates WHERE lower(btrim(equipment_type)) = 'split hi-wall'),
      (SELECT id FROM public.pmoc_task_templates ORDER BY created_at LIMIT 1));
    INSERT INTO public.pmoc_equipment_tasks (plan_id, plan_equipment_id, template_item_id, description, periodicity,
      start_month_offset, requires_measurement, measurement_fields, sort_order)
    SELECT v_id, r.id, i.id, i.description, i.periodicity, i.relative_start_month, i.requires_measurement, i.measurement_fields, i.sort_order
    FROM public.pmoc_task_template_items i WHERE i.template_id = v_tpl;
  END LOOP;

  -- Plano vigente: o documento precisa estar completo
  IF v_status = 'vigente' THEN
    IF v_endereco IS NULL THEN
      RAISE EXCEPTION 'Escolha o endereço atendido antes de marcar o plano como vigente.' USING ERRCODE = '23514';
    END IF;
    IF v_resp_nome = '' OR v_resp_cpf IS NULL OR v_registro = '' THEN
      RAISE EXCEPTION 'Plano vigente precisa do responsável técnico com nome, CPF e registro (o CPF e o registro vêm do cadastro do funcionário, em Equipe).'
        USING ERRCODE = '23514';
    END IF;
    IF v_termo = '' THEN
      RAISE EXCEPTION 'Informe o número do termo de responsabilidade (TRT/ART) antes de marcar o plano como vigente.' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM public.pmoc_plan_equipments WHERE plan_id = v_id AND active AND environment_id IS NULL) THEN
      RAISE EXCEPTION 'Todos os aparelhos ativos precisam de um ambiente antes de o plano ficar vigente.' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pmoc_salvar_plano(JSONB, JSONB, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pmoc_salvar_plano(JSONB, JSONB, JSONB, JSONB) TO authenticated;

-- ---------------------------------------------------------------------
-- 9. Gravar um modelo de tarefas (tipo de aparelho + lista)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pmoc_salvar_modelo(p_modelo JSONB)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_id UUID := NULLIF(p_modelo->>'id', '')::UUID;
  v_tipo TEXT := btrim(coalesce(p_modelo->>'equipment_type', ''));
  v_ids UUID[] := '{}';
  v_item UUID;
  v_ordem INTEGER := 0;
  t JSONB;
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Só o escritório ou o administrador edita os modelos.' USING ERRCODE = '42501';
  END IF;
  IF v_tipo = '' THEN
    RAISE EXCEPTION 'Informe o tipo de aparelho do modelo.' USING ERRCODE = '23514';
  END IF;
  IF jsonb_array_length(coalesce(p_modelo->'tasks', '[]'::JSONB)) = 0 THEN
    RAISE EXCEPTION 'O modelo precisa de pelo menos uma tarefa.' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pmoc_task_templates WHERE lower(btrim(equipment_type)) = lower(v_tipo) AND id IS DISTINCT FROM v_id) THEN
    RAISE EXCEPTION 'Já existe um modelo para o tipo "%".', v_tipo USING ERRCODE = '23505';
  END IF;

  IF v_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.pmoc_task_templates WHERE id = v_id) THEN
    UPDATE public.pmoc_task_templates SET equipment_type = v_tipo,
      description = NULLIF(btrim(coalesce(p_modelo->>'description', '')), '') WHERE id = v_id;
  ELSE
    INSERT INTO public.pmoc_task_templates (equipment_type, description)
    VALUES (v_tipo, NULLIF(btrim(coalesce(p_modelo->>'description', '')), '')) RETURNING id INTO v_id;
  END IF;

  FOR t IN SELECT * FROM jsonb_array_elements(p_modelo->'tasks') LOOP
    v_ordem := v_ordem + 1;
    IF char_length(btrim(coalesce(t->>'description', ''))) = 0 THEN
      RAISE EXCEPTION 'Preencha a descrição da tarefa %.', v_ordem USING ERRCODE = '23514';
    END IF;
    -- Mantém o id dos itens que já existiam (o cronograma dos planos aponta para eles)
    v_item := (SELECT id FROM public.pmoc_task_template_items WHERE id::TEXT = NULLIF(t->>'id', '') AND template_id = v_id);
    INSERT INTO public.pmoc_task_template_items AS x (id, template_id, description, periodicity, relative_start_month,
      requires_measurement, measurement_fields, sort_order)
    VALUES (coalesce(v_item, gen_random_uuid()), v_id, btrim(t->>'description'), coalesce(NULLIF(t->>'periodicity', ''), 'mensal'),
      least(12, greatest(1, coalesce((t->>'relative_start_month')::NUMERIC, 1)))::SMALLINT,
      coalesce((t->>'requires_measurement')::BOOLEAN, FALSE),
      CASE WHEN coalesce((t->>'requires_measurement')::BOOLEAN, FALSE) AND jsonb_typeof(t->'measurement_fields') = 'array'
           THEN ARRAY(SELECT jsonb_array_elements_text(t->'measurement_fields')) ELSE '{}'::TEXT[] END,
      v_ordem)
    ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, periodicity = EXCLUDED.periodicity,
      relative_start_month = EXCLUDED.relative_start_month, requires_measurement = EXCLUDED.requires_measurement,
      measurement_fields = EXCLUDED.measurement_fields, sort_order = EXCLUDED.sort_order
    RETURNING x.id INTO v_item;
    v_ids := v_ids || v_item;
  END LOOP;
  DELETE FROM public.pmoc_task_template_items WHERE template_id = v_id AND NOT (id = ANY (v_ids));
  UPDATE public.pmoc_task_templates SET updated_at = NOW() WHERE id = v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pmoc_salvar_modelo(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pmoc_salvar_modelo(JSONB) TO authenticated;

-- ---------------------------------------------------------------------
-- 10. Modelos iniciais: as 22 tarefas do PMOC da BRV para Split Hi-Wall, Cassete, Split Piso-Teto e VRF
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_tipo RECORD;
  v_tpl UUID;
BEGIN
  FOR v_tipo IN SELECT * FROM (VALUES
    ('Split Hi-Wall', 'Modelo padrão da BRV Niterói (22 tarefas preventivas).'),
    ('Cassete', 'Checklist preventivo para evaporadoras tipo Cassete 1 ou 4 vias.'),
    ('Split Piso-Teto', 'Checklist preventivo para condicionadores Split Piso-Teto comerciais.'),
    ('VRF', 'Checklist preventivo para sistemas multi-split / VRF.')
  ) AS m (tipo, descricao) LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.pmoc_task_templates WHERE lower(equipment_type) = lower(v_tipo.tipo));
    INSERT INTO public.pmoc_task_templates (equipment_type, description) VALUES (v_tipo.tipo, v_tipo.descricao) RETURNING id INTO v_tpl;
    INSERT INTO public.pmoc_task_template_items (template_id, description, periodicity, relative_start_month, requires_measurement, measurement_fields, sort_order)
    SELECT v_tpl, d.descricao, d.periodicidade, 1, d.medicao, d.campos, d.ordem
    FROM (VALUES
      (1, 'Verificar estado de fiação, terminais e contatos elétricos', 'mensal', FALSE, '{}'::TEXT[]),
      (2, 'Medir e registrar corrente elétrica ventilador/compressor', 'mensal', TRUE, '{current_a}'::TEXT[]),
      (3, 'Medir e registrar temperatura ar insuflamento, retorno e ambiente', 'mensal', TRUE, '{temp_supply_c,temp_return_c,temp_ambient_c}'::TEXT[]),
      (4, 'Efetuar reaperto dos terminais, parafusos e molas', 'mensal', FALSE, '{}'::TEXT[]),
      (5, 'Limpar bandeja condensação e dreno e sua operação', 'mensal', FALSE, '{}'::TEXT[]),
      (6, 'Verificar a vedação dos painéis de fechamento do gabinete', 'mensal', FALSE, '{}'::TEXT[]),
      (7, 'Verificar a tensão das correias, para evitar o escorregamento nas polias', 'mensal', FALSE, '{}'::TEXT[]),
      (8, 'Lavar as serpentinas e bandejas com remoção do bio-filme (lodo) sem o uso de produto desengraxante e corrosivo', 'mensal', FALSE, '{}'::TEXT[]),
      (9, 'Limpar o gabinete do condicionador e ventiladores (carcaça e rotor)', 'mensal', FALSE, '{}'::TEXT[]),
      (10, 'Verificar o funcionamento da resistência de aquecimento do cárter', 'mensal', FALSE, '{}'::TEXT[]),
      (11, 'Verificar filtro e secador', 'mensal', FALSE, '{}'::TEXT[]),
      (12, 'Verificar carga de gás refrigerante e vazamentos', 'mensal', FALSE, '{}'::TEXT[]),
      (13, 'Verificar nível de óleo do compressor', 'mensal', FALSE, '{}'::TEXT[]),
      (14, 'Verificar a operação da válvula de expansão', 'mensal', FALSE, '{}'::TEXT[]),
      (15, 'Verificar e calibrar os dispositivos de segurança (pressostatos de alta/baixa e óleo)', 'mensal', FALSE, '{}'::TEXT[]),
      (16, 'Verificar resistência de isolamento dos motores e compressores', 'mensal', FALSE, '{}'::TEXT[]),
      (17, 'Verificar e calibrar os dispositivos de segurança, relés térmicos e fusíveis', 'mensal', FALSE, '{}'::TEXT[]),
      (18, 'Verificar a calibragem e regulagem do termostato de controle de temperatura do ambiente', 'mensal', FALSE, '{}'::TEXT[]),
      (19, 'Eliminar danos e sujeiras e corrosão no gabinete, na moldura da serpentina e na bandeja', 'trimestral', FALSE, '{}'::TEXT[]),
      (20, 'Verificar e eliminar sujeiras, danos e corrosão', 'trimestral', FALSE, '{}'::TEXT[]),
      (21, 'Limpeza de condensador', 'semestral', FALSE, '{}'::TEXT[]),
      (22, 'Verificar protetor térmico compressor', 'semestral', FALSE, '{}'::TEXT[])
    ) AS d (ordem, descricao, periodicidade, medicao, campos);
  END LOOP;
END $$;
