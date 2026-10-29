-- =====================================================================
-- Formulários de campo (orçamento, carga de gás, PMOC...).
--  - form_templates: modelo montado pelo escritório; as perguntas ficam em JSONB.
--  - form_responses: formulário preenchido pelo técnico na atividade. Guarda uma
--    CÓPIA das perguntas (editar o modelo depois não altera respostas antigas).
--
-- Formato de uma pergunta (JSONB em form_templates.questions / form_responses.questions):
--   { "id": "pavimento",              -- chave estável, única no formulário
--     "type": "text|textarea|number|single|dropdown|multi|date|photo|signature",
--     "title": "Texto da pergunta",
--     "help": "dica opcional",
--     "required": false,
--     "options": ["A", "B"],          -- só single | dropdown | multi
--     "unit": "°C",                   -- opcional, só number
--     "visible_if": { "question": "local", "in": ["Casa", "Comércio"] } }  -- opcional
-- Respostas (form_responses.answers): objeto { "<id da pergunta>": valor }
--   text/textarea/date -> string; number -> número; single/dropdown -> string;
--   multi -> string[]; photo -> string[] de attachments.id; signature -> attachments.id
--
-- Rodar no SQL Editor (ou `supabase db push`). Não altera dados existentes.
-- =====================================================================

CREATE TABLE public.form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(questions) = 'array'),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  field_control_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX form_templates_name_key ON public.form_templates (lower(trim(name)));

CREATE TABLE public.form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.form_templates(id) ON DELETE SET NULL,
  template_name TEXT NOT NULL,
  questions JSONB NOT NULL CHECK (jsonb_typeof(questions) = 'array'),
  answers JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(answers) = 'object'),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'preenchido')),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES public.equipments(id) ON DELETE SET NULL,
  filled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  filled_at TIMESTAMPTZ,
  field_control_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX form_responses_task_idx ON public.form_responses (task_id);
CREATE INDEX form_responses_order_idx ON public.form_responses (service_order_id);
CREATE INDEX form_responses_equipment_idx ON public.form_responses (equipment_id) WHERE equipment_id IS NOT NULL;
CREATE UNIQUE INDEX form_responses_fc_key ON public.form_responses (field_control_id) WHERE field_control_id IS NOT NULL;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.form_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.form_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ao criar: copia nome e perguntas do modelo e herda a OS da atividade.
-- Ao alterar (técnico): só mexe em respostas e status; quem preencheu e quando vêm do login.
CREATE FUNCTION public.form_responses_preenche()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT service_order_id INTO NEW.service_order_id FROM public.tasks WHERE id = NEW.task_id;
    IF NEW.template_id IS NOT NULL AND auth.uid() IS NOT NULL THEN
      -- cliente não escolhe o conteúdo das perguntas: sempre vem do modelo
      SELECT name, questions INTO NEW.template_name, NEW.questions
      FROM public.form_templates WHERE id = NEW.template_id;
    END IF;
    IF NEW.template_name IS NULL OR NEW.questions IS NULL THEN
      RAISE EXCEPTION 'Modelo de formulário não encontrado' USING ERRCODE = '23502';
    END IF;
  ELSIF auth.uid() IS NOT NULL AND NOT public.eh_escritorio() THEN
    IF NEW.template_id IS DISTINCT FROM OLD.template_id
       OR NEW.template_name IS DISTINCT FROM OLD.template_name
       OR NEW.questions IS DISTINCT FROM OLD.questions
       OR NEW.task_id IS DISTINCT FROM OLD.task_id
       OR NEW.service_order_id IS DISTINCT FROM OLD.service_order_id THEN
      RAISE EXCEPTION 'Somente o escritório altera o modelo ou a atividade do formulário'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.status = 'preenchido' AND (TG_OP = 'INSERT' OR OLD.status <> 'preenchido') THEN
    NEW.filled_at := NOW();
    NEW.filled_by := auth.uid();
  ELSIF NEW.status = 'pendente' THEN
    NEW.filled_at := NULL;
    NEW.filled_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER form_responses_preenche
  BEFORE INSERT OR UPDATE ON public.form_responses
  FOR EACH ROW EXECUTE FUNCTION public.form_responses_preenche();

-- RLS
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.form_templates FROM anon;
REVOKE ALL ON public.form_responses FROM anon;

CREATE POLICY "Escritório gerencia" ON public.form_templates FOR ALL TO authenticated
  USING ((SELECT public.eh_escritorio())) WITH CHECK ((SELECT public.eh_escritorio()));
CREATE POLICY "Escritório gerencia" ON public.form_responses FOR ALL TO authenticated
  USING ((SELECT public.eh_escritorio())) WITH CHECK ((SELECT public.eh_escritorio()));

-- Técnico: lê os modelos ativos e trabalha só nos formulários das próprias atividades
CREATE POLICY "Técnico lê modelos ativos" ON public.form_templates FOR SELECT TO authenticated
  USING (active AND (SELECT public.meu_colaborador_id()) IS NOT NULL);

CREATE POLICY "Técnico lê formulários das próprias atividades" ON public.form_responses
  FOR SELECT TO authenticated
  USING (task_id IN (SELECT id FROM public.tasks WHERE employee_id = (SELECT public.meu_colaborador_id())));
CREATE POLICY "Técnico abre formulário nas próprias atividades" ON public.form_responses
  FOR INSERT TO authenticated
  WITH CHECK (task_id IN (SELECT id FROM public.tasks WHERE employee_id = (SELECT public.meu_colaborador_id())));
CREATE POLICY "Técnico preenche formulários das próprias atividades" ON public.form_responses
  FOR UPDATE TO authenticated
  USING (task_id IN (SELECT id FROM public.tasks WHERE employee_id = (SELECT public.meu_colaborador_id())))
  WITH CHECK (task_id IN (SELECT id FROM public.tasks WHERE employee_id = (SELECT public.meu_colaborador_id())));

-- Excluir modelo/resposta: só admin (some junto com o histórico)
CREATE POLICY "Só admin exclui" ON public.form_templates AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((SELECT public.eh_admin()));
CREATE POLICY "Só admin exclui" ON public.form_responses AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((SELECT public.eh_admin()));

-- =====================================================================
-- Modelos que já existem no Field Control (versão atual do orçamento inclui
-- "aparelho a substituir" e "Inverter ou On-Off"). PMOC fica para depois.
-- =====================================================================
INSERT INTO public.form_templates (name, description, questions) VALUES
('Orçamento de Instalação de Split',
 'Levantamento em campo para o escritório montar o orçamento.',
 $q$[
  {"id":"local","type":"multi","title":"Local da instalação","required":true,"options":["Casa","Comércio","Apartamento"]},
  {"id":"pavimento","type":"single","title":"Sendo Casa ou Comércio, qual o pavimento de instalação?","options":["Térreo","2º Andar","3º Andar"],"visible_if":{"question":"local","in":["Casa","Comércio"]}},
  {"id":"quantidade","type":"single","title":"Quantidade de Equipamentos","required":true,"options":["1","2","3","4","5","Mais de 5"]},
  {"id":"tipo","type":"single","title":"Tipo de Equipamento","required":true,"options":["High Wall","Cassete","Piso Teto"]},
  {"id":"potencia","type":"dropdown","title":"Qual a Potência dos Equipamentos","required":true,"options":["9.000 Btus","12.000 Btus","18.000 Btus","22.000 / 24.000 Btus","30.000 Btus","36.000 Btus","48.000 Btus"]},
  {"id":"inverter","type":"single","title":"Aparelho é Inverter ou On-Off?","options":["Inverter","On-Off"]},
  {"id":"dreno","type":"single","title":"Já existe Dreno na Evaporadora?","options":["Sim","Não"]},
  {"id":"ponto_220v","type":"single","title":"Já existe ponto elétrico 220V próximo à instalação?","options":["Sim","Não"]},
  {"id":"aparelho_existente","type":"single","title":"Já existe algum aparelho instalado no local (a ser substituído) ou tubulação já passada?","options":["Sim","Não"]},
  {"id":"tubulacao_existente","type":"textarea","title":"Se SIM, qual a tubulação existente e vai precisar de limpeza de sistema?","visible_if":{"question":"aparelho_existente","in":["Sim"]}},
  {"id":"materiais","type":"textarea","title":"Descreva os materiais que serão utilizados"},
  {"id":"observacoes","type":"textarea","title":"Outras Observações"},
  {"id":"fotos","type":"photo","title":"Fotos do local"}
 ]$q$::jsonb),
('Carga de Gás',
 NULL,
 $q$[
  {"id":"marca","type":"text","title":"Marca do Equipamento","required":true},
  {"id":"vazamento","type":"single","title":"Foi encontrado o vazamento?","required":true,"options":["Sim","Não"]},
  {"id":"local_vazamento","type":"text","title":"Local do vazamento","visible_if":{"question":"vazamento","in":["Sim"]}},
  {"id":"gas","type":"single","title":"Qual o Gás utilizado?","options":["R 22","R 410"]}
 ]$q$::jsonb),
('Instalação de Split',
 NULL,
 $q$[
  {"id":"tipo","type":"dropdown","title":"Tipo de Equipamento","options":["Hi-wall Convencional","Hi-wall Inverter","Piso Teto Convencional","Piso Teto Inverter","Cassete"]},
  {"id":"quantidade","type":"single","title":"Quantidade de Equipamentos","options":["1","2","3","4","5","6","Mais de 6"]}
 ]$q$::jsonb);
