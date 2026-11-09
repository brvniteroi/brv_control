-- =====================================================================
-- Módulo Oficina, fase 1: base (2026-11-08). Plano em docs/oficina.md.
--
-- Equipamento (ou parte dele) recolhido do cliente para conserto na loja:
--   em_transito → entrada → diagnostico → aguardando_orcamento → aguardando_cliente
--   → aguardando_peca / em_reparo → pronto → entregue        (finais: entregue, descarte, cancelado)
--
-- 1. Papéis novos: 'oficina' (técnico de bancada: só a Oficina) e 'impressora' (agente da Elgin no
--    servidor da loja). Categoria de cargo 'oficina' (não aparece na linha do tempo nem nos relatórios).
-- 2. workshop_orders: cada item na oficina, sempre ligado a uma OS do Control (o número exibido é o da OS;
--    vários itens da mesma OS viram "OS 17300 · item 2"). Entrada de balcão cria a OS junto.
-- 3. workshop_order_events: histórico que ninguém altera nem apaga (quem, quando, de/para, campos mudados).
-- 4. Regras no banco: etapas válidas, o que o papel 'oficina' pode mexer, descarte só com autorização do
--    cliente (vira comentário na OS de origem), carimbos de data e autor vindos do login.
-- 5. Fotos em attachments.workshop_order_id.
-- 6. Fila de impressão (print_jobs) e sinal de vida do agente (print_agents).
-- 7. Funções: entrada de balcão, recolher pelo app de campo, buscar OS pelo número, agente da impressora.
--
-- Sem login (scripts com a service_role, ex.: importação do BRV Equipamentos) as regras de etapa não se
-- aplicam e as alterações não geram histórico (só a criação).
--
-- Colar no SQL Editor do Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Papéis e categoria de cargo
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'escritorio', 'tecnico', 'cliente', 'oficina', 'impressora'));

ALTER TABLE public.cargos DROP CONSTRAINT IF EXISTS cargos_categoria_check;
ALTER TABLE public.cargos ADD CONSTRAINT cargos_categoria_check
  CHECK (categoria IN ('tecnico', 'auxiliar', 'supervisor', 'administrativo', 'oficina'));

ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_role_check
  CHECK (role IN ('tecnico', 'auxiliar', 'supervisor', 'administrativo', 'oficina'));

INSERT INTO public.cargos (nome, categoria, descricao)
VALUES ('Ajudante de Oficina', 'oficina', 'Recebe, analisa e conserta equipamentos na loja'),
       ('Mecânico de Oficina', 'oficina', 'Recebe, analisa e conserta equipamentos na loja')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.eh_oficina()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND active AND role = 'oficina');
$$;

-- Escritório (admin/escritorio) ou oficina: quem trabalha nos equipamentos da loja
CREATE OR REPLACE FUNCTION public.eh_equipe_oficina()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND active AND role IN ('admin', 'escritorio', 'oficina')
  );
$$;

CREATE OR REPLACE FUNCTION public.eh_impressora()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND active AND role = 'impressora');
$$;

-- Funcionário ligado ao login atual (qualquer papel; NULL se não houver)
CREATE OR REPLACE FUNCTION public.meu_funcionario_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT e.id FROM public.employees e WHERE e.profile_id = auth.uid() AND e.active LIMIT 1;
$$;

-- ---------------------------------------------------------------------
-- 2. Itens na oficina
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workshop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL DEFAULT 'equipamento' CHECK (kind IN ('equipamento', 'placa')),

  -- OS do Control (o número exibido é o dela). Só item importado do sistema antigo pode ficar sem.
  service_order_id UUID REFERENCES public.service_orders (id) ON DELETE RESTRICT,
  item_number SMALLINT NOT NULL DEFAULT 1 CHECK (item_number > 0),
  task_id UUID REFERENCES public.tasks (id) ON DELETE SET NULL,            -- atividade em que foi recolhido
  customer_id UUID NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,  -- copiado da OS
  equipment_id UUID REFERENCES public.equipments (id) ON DELETE SET NULL,   -- aparelho do cliente (opcional)

  status TEXT NOT NULL DEFAULT 'entrada' CHECK (status IN (
    'em_transito', 'entrada', 'diagnostico', 'aguardando_orcamento', 'aguardando_cliente',
    'aguardando_peca', 'em_reparo', 'pronto', 'entregue', 'descarte', 'cancelado'
  )),

  -- O que veio
  equipment_type TEXT NOT NULL CHECK (char_length(btrim(equipment_type)) > 0),  -- 'Split Hi-Wall', 'Janela (ACJ)'...
  units_collected TEXT NOT NULL DEFAULT 'evaporadora' CHECK (units_collected IN (
    'evaporadora', 'condensadora', 'conjunto', 'aparelho', 'outro'
  )),
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  capacity_btu INTEGER CHECK (capacity_btu > 0),
  voltage TEXT,
  accessories TEXT,             -- controle remoto, suporte, cabo...
  reported_defect TEXT,         -- defeito relatado (cliente/técnico na retirada)
  field_report TEXT,            -- relato do técnico de campo
  intake_notes TEXT,            -- conferência na chegada (estado, avarias aparentes)

  -- Bancada
  diagnosis TEXT,
  parts_needed TEXT,
  parts_status TEXT NOT NULL DEFAULT 'nao_necessario'
    CHECK (parts_status IN ('nao_necessario', 'a_comprar', 'comprada', 'chegou')),
  repair_notes TEXT,            -- serviço executado
  pickup_employee_id UUID REFERENCES public.employees (id) ON DELETE SET NULL,
  bench_employee_id UUID REFERENCES public.employees (id) ON DELETE SET NULL,

  -- Garantia (retorno de serviço anterior: não passa por orçamento)
  is_warranty BOOLEAN NOT NULL DEFAULT FALSE,
  warranty_origin_id UUID REFERENCES public.workshop_orders (id) ON DELETE SET NULL,

  -- Orçamento: feito no SicWeb; aqui só a referência
  quote_reference TEXT,         -- nº do orçamento no SicWeb
  quote_amount NUMERIC(10, 2) CHECK (quote_amount >= 0),
  quote_sent_at TIMESTAMPTZ,

  -- Resposta do cliente ao orçamento
  decision TEXT CHECK (decision IN ('aprovado', 'recusado')),
  decision_channel TEXT CHECK (decision_channel IN ('whatsapp', 'telefone', 'presencial', 'email')),
  decision_note TEXT,
  decision_at TIMESTAMPTZ,
  decision_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,

  -- Autorização de descarte dada pelo cliente
  discard_channel TEXT CHECK (discard_channel IN ('whatsapp', 'telefone', 'presencial', 'email')),
  discard_note TEXT,
  discard_authorized_at TIMESTAMPTZ,
  discard_authorized_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,

  -- Devolução
  return_service_order_id UUID REFERENCES public.service_orders (id) ON DELETE SET NULL,
  cancel_reason TEXT,

  -- Marcos (preenchidos pelo banco)
  received_at TIMESTAMPTZ,
  received_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  ready_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,      -- entregue, descarte ou cancelado

  -- Importação do BRV Equipamentos (repetível sem duplicar)
  legacy_table TEXT,
  legacy_id TEXT,
  legacy_reference TEXT,        -- os_field_control / 'BALCAO-n' / codigo_interno do sistema antigo

  created_by UUID DEFAULT auth.uid() REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT workshop_orders_tem_os CHECK (service_order_id IS NOT NULL OR legacy_id IS NOT NULL),
  CONSTRAINT workshop_orders_legacy_key UNIQUE (legacy_table, legacy_id),
  CONSTRAINT workshop_orders_item_key UNIQUE (service_order_id, item_number)
);
CREATE INDEX IF NOT EXISTS workshop_orders_status_idx ON public.workshop_orders (status);
CREATE INDEX IF NOT EXISTS workshop_orders_customer_idx ON public.workshop_orders (customer_id);
CREATE INDEX IF NOT EXISTS workshop_orders_return_os_idx ON public.workshop_orders (return_service_order_id);
CREATE INDEX IF NOT EXISTS workshop_orders_task_idx ON public.workshop_orders (task_id);

DROP TRIGGER IF EXISTS set_updated_at ON public.workshop_orders;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.workshop_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. Histórico (só leitura para todos; gravado pelos triggers)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workshop_order_events (
  id BIGSERIAL PRIMARY KEY,
  workshop_order_id UUID NOT NULL REFERENCES public.workshop_orders (id) ON DELETE CASCADE,
  event TEXT NOT NULL CHECK (event IN ('criado', 'etapa', 'alteracao', 'decisao', 'descarte_autorizado', 'nota')),
  from_status TEXT,
  to_status TEXT,
  changes JSONB,                -- {"campo": [antes, depois]}
  note TEXT,
  actor_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  actor_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS workshop_order_events_item_idx ON public.workshop_order_events (workshop_order_id, created_at);

-- Nota manual: autor e data vêm do login
CREATE OR REPLACE FUNCTION public.workshop_order_events_preenche()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.event <> 'nota' OR coalesce(char_length(btrim(NEW.note)), 0) NOT BETWEEN 1 AND 4000 THEN
      RAISE EXCEPTION 'Só é possível escrever notas no histórico.' USING ERRCODE = '42501';
    END IF;
    NEW.note := btrim(NEW.note);
    NEW.from_status := NULL;
    NEW.to_status := NULL;
    NEW.changes := NULL;
    NEW.actor_id := auth.uid();
    NEW.actor_name := (SELECT full_name FROM public.profiles WHERE id = auth.uid());
    NEW.created_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS workshop_order_events_preenche ON public.workshop_order_events;
CREATE TRIGGER workshop_order_events_preenche
  BEFORE INSERT ON public.workshop_order_events
  FOR EACH ROW EXECUTE FUNCTION public.workshop_order_events_preenche();

-- ---------------------------------------------------------------------
-- 4. Regras do item
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.workshop_orders_regras()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_escritorio BOOLEAN := public.eh_escritorio();
  v_admin BOOLEAN := public.eh_admin();
  v_finais CONSTANT TEXT[] := ARRAY['entregue', 'descarte', 'cancelado'];
  v_cliente UUID;
BEGIN
  -- Cliente sempre o da OS; número do item dentro da OS
  IF TG_OP = 'INSERT' THEN
    IF NEW.service_order_id IS NOT NULL THEN
      -- trava a OS para dois itens simultâneos não pegarem o mesmo número
      SELECT customer_id INTO v_cliente FROM public.service_orders WHERE id = NEW.service_order_id FOR UPDATE;
      IF v_cliente IS NULL THEN
        RAISE EXCEPTION 'OS não encontrada.' USING ERRCODE = '23503';
      END IF;
      NEW.customer_id := v_cliente;
      NEW.item_number := coalesce(
        (SELECT max(item_number) FROM public.workshop_orders WHERE service_order_id = NEW.service_order_id), 0) + 1;
    END IF;
  END IF;

  -- Sem login (importação/scripts) ou baixa automática pela OS de devolução: vale o que foi informado
  IF auth.uid() IS NULL OR current_setting('app.oficina_sistema', TRUE) = 'on' THEN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'entregue' THEN
      NEW.finished_at := NOW();
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('em_transito', 'entrada') THEN
      RAISE EXCEPTION 'Item novo entra em trânsito ou na entrada da oficina.' USING ERRCODE = '23514';
    END IF;
    IF NEW.service_order_id IS NULL THEN
      RAISE EXCEPTION 'Item da oficina precisa de uma OS.' USING ERRCODE = '23514';
    END IF;
    NEW.created_by := auth.uid();
    NEW.created_at := NOW();
    NEW.legacy_table := NULL;
    NEW.legacy_id := NULL;
    NEW.legacy_reference := NULL;
    NEW.decision := NULL;
    NEW.discard_channel := NULL;
    NEW.return_service_order_id := NULL;
    NEW.received_at := NULL;
    NEW.ready_at := NULL;
    NEW.finished_at := NULL;
    IF NEW.status = 'entrada' THEN
      NEW.received_at := NOW();
      NEW.received_by := auth.uid();
    END IF;
  ELSE
    -- O que nunca muda depois de criado
    IF NEW.kind IS DISTINCT FROM OLD.kind
       OR NEW.service_order_id IS DISTINCT FROM OLD.service_order_id
       OR NEW.item_number IS DISTINCT FROM OLD.item_number
       OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.legacy_table IS DISTINCT FROM OLD.legacy_table
       OR NEW.legacy_id IS DISTINCT FROM OLD.legacy_id
       OR NEW.legacy_reference IS DISTINCT FROM OLD.legacy_reference THEN
      RAISE EXCEPTION 'A OS, o cliente e a origem do item não podem ser alterados.' USING ERRCODE = '42501';
    END IF;

    -- Oficina: parte técnica; orçamento, resposta do cliente, descarte e devolução são do escritório
    IF NOT v_escritorio THEN
      IF NEW.task_id IS DISTINCT FROM OLD.task_id
         OR NEW.pickup_employee_id IS DISTINCT FROM OLD.pickup_employee_id
         OR NEW.is_warranty IS DISTINCT FROM OLD.is_warranty
         OR NEW.warranty_origin_id IS DISTINCT FROM OLD.warranty_origin_id
         OR NEW.quote_reference IS DISTINCT FROM OLD.quote_reference
         OR NEW.quote_amount IS DISTINCT FROM OLD.quote_amount
         OR NEW.quote_sent_at IS DISTINCT FROM OLD.quote_sent_at
         OR NEW.decision IS DISTINCT FROM OLD.decision
         OR NEW.decision_channel IS DISTINCT FROM OLD.decision_channel
         OR NEW.decision_note IS DISTINCT FROM OLD.decision_note
         OR NEW.discard_channel IS DISTINCT FROM OLD.discard_channel
         OR NEW.discard_note IS DISTINCT FROM OLD.discard_note
         OR NEW.return_service_order_id IS DISTINCT FROM OLD.return_service_order_id
         OR NEW.cancel_reason IS DISTINCT FROM OLD.cancel_reason THEN
        RAISE EXCEPTION 'Orçamento, resposta do cliente, descarte e devolução são registrados pelo escritório.'
          USING ERRCODE = '42501';
      END IF;
      IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
           (OLD.status, NEW.status) IN (
             ('em_transito', 'entrada'),
             ('entrada', 'diagnostico'),
             ('diagnostico', 'entrada'),
             ('diagnostico', 'aguardando_orcamento'),
             ('aguardando_orcamento', 'diagnostico'),
             ('aguardando_peca', 'em_reparo'),
             ('em_reparo', 'aguardando_peca'),
             ('em_reparo', 'pronto'),
             ('pronto', 'em_reparo')
           )
           -- Garantia não passa por orçamento: a oficina segue direto do diagnóstico
           OR (OLD.is_warranty AND OLD.status = 'diagnostico' AND NEW.status IN ('aguardando_peca', 'em_reparo'))
         ) THEN
        RAISE EXCEPTION 'A oficina não pode mudar esta etapa. Peça ao escritório.' USING ERRCODE = '42501';
      END IF;
    END IF;

    -- Marcos que o navegador não escolhe
    NEW.received_at := OLD.received_at;
    NEW.received_by := OLD.received_by;
    NEW.ready_at := OLD.ready_at;
    NEW.finished_at := OLD.finished_at;
    NEW.decision_at := OLD.decision_at;
    NEW.decision_by := OLD.decision_by;
    NEW.discard_authorized_at := OLD.discard_authorized_at;
    NEW.discard_authorized_by := OLD.discard_authorized_by;

    -- Item finalizado só volta pelas mãos do admin
    IF OLD.status = ANY (v_finais) AND NEW.status IS DISTINCT FROM OLD.status AND NOT v_admin THEN
      RAISE EXCEPTION 'Item finalizado. Só o administrador pode reabrir.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Resposta do cliente: canal obrigatório; data e autor do login
  IF NEW.decision IS NULL THEN
    NEW.decision_channel := NULL;
    NEW.decision_note := NULL;
    NEW.decision_at := NULL;
    NEW.decision_by := NULL;
  ELSE
    IF NEW.decision_channel IS NULL THEN
      RAISE EXCEPTION 'Informe por onde o cliente respondeu (WhatsApp, telefone, presencial ou e-mail).'
        USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'INSERT' OR NEW.decision IS DISTINCT FROM OLD.decision
       OR NEW.decision_channel IS DISTINCT FROM OLD.decision_channel THEN
      NEW.decision_at := NOW();
      NEW.decision_by := auth.uid();
    END IF;
  END IF;

  -- Autorização de descarte: canal e observação obrigatórios
  IF NEW.discard_channel IS NULL THEN
    NEW.discard_note := NULL;
    NEW.discard_authorized_at := NULL;
    NEW.discard_authorized_by := NULL;
  ELSE
    IF coalesce(char_length(btrim(NEW.discard_note)), 0) = 0 THEN
      RAISE EXCEPTION 'Descreva a autorização de descarte (quem autorizou e como).' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'INSERT' OR NEW.discard_channel IS DISTINCT FROM OLD.discard_channel
       OR NEW.discard_note IS DISTINCT FROM OLD.discard_note THEN
      NEW.discard_authorized_at := NOW();
      NEW.discard_authorized_by := auth.uid();
    END IF;
  END IF;

  -- Etapas: condições de quem entra
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('aguardando_peca', 'em_reparo')
       AND NOT (NEW.decision = 'aprovado' OR NEW.is_warranty) THEN
      RAISE EXCEPTION 'Registre a aprovação do cliente antes de seguir para o conserto.' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'pronto' AND NOT (NEW.decision IS NOT NULL OR NEW.is_warranty) THEN
      RAISE EXCEPTION 'Registre a resposta do cliente ao orçamento antes de marcar como pronto.' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'entregue' AND OLD.status <> 'pronto' THEN
      RAISE EXCEPTION 'Só um item pronto pode ser entregue.' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'descarte' AND NEW.discard_channel IS NULL THEN
      RAISE EXCEPTION 'Descarte só com a autorização do cliente registrada.' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'cancelado' AND coalesce(char_length(btrim(NEW.cancel_reason)), 0) = 0 THEN
      RAISE EXCEPTION 'Informe o motivo do cancelamento.' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'aguardando_cliente' AND NEW.quote_sent_at IS NULL THEN
      NEW.quote_sent_at := NOW();
    END IF;

    IF NEW.status = 'entrada' AND NEW.received_at IS NULL THEN
      NEW.received_at := NOW();
      NEW.received_by := auth.uid();
    END IF;
    IF NEW.status = 'pronto' THEN
      NEW.ready_at := NOW();
    END IF;
    IF NEW.status = ANY (v_finais) THEN
      NEW.finished_at := NOW();
    ELSE
      NEW.finished_at := NULL;
    END IF;
    -- Quem mexe na bancada fica como técnico de bancada, se ainda não houver
    IF NEW.status IN ('diagnostico', 'em_reparo') AND NEW.bench_employee_id IS NULL THEN
      NEW.bench_employee_id := public.meu_funcionario_id();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS workshop_orders_regras ON public.workshop_orders;
CREATE TRIGGER workshop_orders_regras
  BEFORE INSERT OR UPDATE ON public.workshop_orders
  FOR EACH ROW EXECUTE FUNCTION public.workshop_orders_regras();

-- Rótulos usados no histórico e no comentário da OS
CREATE OR REPLACE FUNCTION public.oficina_rotulo_unidade(p TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT CASE p
    WHEN 'evaporadora' THEN 'evaporadora'
    WHEN 'condensadora' THEN 'condensadora'
    WHEN 'conjunto' THEN 'evaporadora e condensadora'
    WHEN 'aparelho' THEN 'aparelho'
    ELSE 'peça'
  END;
$$;

CREATE OR REPLACE FUNCTION public.oficina_rotulo_canal(p TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT CASE p
    WHEN 'whatsapp' THEN 'WhatsApp'
    WHEN 'telefone' THEN 'telefone'
    WHEN 'presencial' THEN 'pessoalmente'
    WHEN 'email' THEN 'e-mail'
    ELSE p
  END;
$$;

-- Histórico automático e comentário de descarte na OS de origem
CREATE OR REPLACE FUNCTION public.workshop_orders_historico()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_nome TEXT := (SELECT full_name FROM public.profiles WHERE id = auth.uid());
  v_mudancas JSONB;
  v_os BIGINT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.workshop_order_events (workshop_order_id, event, to_status, actor_id, actor_name, note)
    VALUES (NEW.id, 'criado', NEW.status, auth.uid(),
            coalesce(v_nome, CASE WHEN NEW.legacy_id IS NOT NULL THEN 'Importação do BRV Equipamentos' ELSE 'Sistema' END),
            NULL);
    RETURN NULL;
  END IF;

  -- Alterações feitas por scripts (sem login) não geram histórico
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  IF current_setting('app.oficina_sistema', TRUE) = 'on' THEN
    v_nome := 'Automático: OS de devolução concluída por ' || coalesce(v_nome, 'usuário');
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.workshop_order_events (workshop_order_id, event, from_status, to_status, actor_id, actor_name, note)
    VALUES (NEW.id, 'etapa', OLD.status, NEW.status, auth.uid(), v_nome,
            CASE WHEN NEW.status = 'cancelado' THEN NEW.cancel_reason END);
  END IF;

  IF NEW.decision IS DISTINCT FROM OLD.decision AND NEW.decision IS NOT NULL THEN
    INSERT INTO public.workshop_order_events (workshop_order_id, event, actor_id, actor_name, note)
    VALUES (NEW.id, 'decisao', auth.uid(), v_nome,
            'Cliente ' || CASE NEW.decision WHEN 'aprovado' THEN 'aprovou' ELSE 'recusou' END
            || ' o orçamento por ' || public.oficina_rotulo_canal(NEW.decision_channel)
            || coalesce('. ' || nullif(btrim(NEW.decision_note), ''), ''));
  END IF;

  IF NEW.discard_channel IS NOT NULL AND (NEW.discard_channel IS DISTINCT FROM OLD.discard_channel
                                          OR NEW.discard_note IS DISTINCT FROM OLD.discard_note) THEN
    INSERT INTO public.workshop_order_events (workshop_order_id, event, actor_id, actor_name, note)
    VALUES (NEW.id, 'descarte_autorizado', auth.uid(), v_nome,
            'Descarte autorizado pelo cliente por ' || public.oficina_rotulo_canal(NEW.discard_channel)
            || '. ' || NEW.discard_note);
  END IF;

  -- Demais campos alterados, com o valor antigo e o novo
  SELECT jsonb_object_agg(o.key, jsonb_build_array(o.value, n.value))
    INTO v_mudancas
    FROM jsonb_each(to_jsonb(OLD)) o
    JOIN jsonb_each(to_jsonb(NEW)) n USING (key)
   WHERE o.value IS DISTINCT FROM n.value
     AND o.key NOT IN ('updated_at', 'status', 'received_at', 'received_by', 'ready_at', 'finished_at',
                       'decision', 'decision_channel', 'decision_note', 'decision_at', 'decision_by',
                       'discard_channel', 'discard_note', 'discard_authorized_at', 'discard_authorized_by',
                       'cancel_reason');
  IF v_mudancas IS NOT NULL THEN
    INSERT INTO public.workshop_order_events (workshop_order_id, event, changes, actor_id, actor_name)
    VALUES (NEW.id, 'alteracao', v_mudancas, auth.uid(), v_nome);
  END IF;

  -- Descarte: fica registrado também na OS de origem
  IF NEW.status = 'descarte' AND OLD.status <> 'descarte' AND NEW.service_order_id IS NOT NULL THEN
    SELECT number INTO v_os FROM public.service_orders WHERE id = NEW.service_order_id;
    INSERT INTO public.service_order_comments (service_order_id, message)
    VALUES (NEW.service_order_id, left(
            'Oficina: cliente autorizou o descarte da ' || public.oficina_rotulo_unidade(NEW.units_collected)
            || ' (' || NEW.equipment_type || coalesce(' ' || NEW.brand, '') || ', OS ' || v_os
            || ' · item ' || NEW.item_number || ') em ' || to_char(NEW.discard_authorized_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')
            || ', por ' || public.oficina_rotulo_canal(NEW.discard_channel)
            || '. Registrado por ' || coalesce(v_nome, 'usuário') || '. ' || NEW.discard_note, 4000));
  END IF;

  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS workshop_orders_historico ON public.workshop_orders;
CREATE TRIGGER workshop_orders_historico
  AFTER INSERT OR UPDATE ON public.workshop_orders
  FOR EACH ROW EXECUTE FUNCTION public.workshop_orders_historico();

-- ---------------------------------------------------------------------
-- 5. RLS dos itens e do histórico
-- ---------------------------------------------------------------------
-- OS em que o técnico logado tem atividade: os itens recolhidos nelas
CREATE OR REPLACE FUNCTION public.minhas_oficinas()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT w.id FROM public.workshop_orders w WHERE w.service_order_id IN (SELECT public.minhas_os());
$$;

ALTER TABLE public.workshop_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workshop_orders FROM anon;

DROP POLICY IF EXISTS "Equipe da oficina lê" ON public.workshop_orders;
DROP POLICY IF EXISTS "Escritório inclui" ON public.workshop_orders;
DROP POLICY IF EXISTS "Oficina inclui em OS existente" ON public.workshop_orders;
DROP POLICY IF EXISTS "Equipe da oficina altera" ON public.workshop_orders;
DROP POLICY IF EXISTS "Só admin exclui" ON public.workshop_orders;
DROP POLICY IF EXISTS "Técnico lê os itens das próprias OS" ON public.workshop_orders;

CREATE POLICY "Equipe da oficina lê" ON public.workshop_orders FOR SELECT TO authenticated
  USING ((SELECT public.eh_equipe_oficina()));
CREATE POLICY "Escritório inclui" ON public.workshop_orders FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.eh_escritorio()));
CREATE POLICY "Oficina inclui em OS existente" ON public.workshop_orders FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.eh_oficina()) AND service_order_id IS NOT NULL);
CREATE POLICY "Equipe da oficina altera" ON public.workshop_orders FOR UPDATE TO authenticated
  USING ((SELECT public.eh_equipe_oficina()))
  WITH CHECK ((SELECT public.eh_equipe_oficina()));
CREATE POLICY "Só admin exclui" ON public.workshop_orders FOR DELETE TO authenticated
  USING ((SELECT public.eh_admin()));
CREATE POLICY "Técnico lê os itens das próprias OS" ON public.workshop_orders FOR SELECT TO authenticated
  USING (service_order_id IN (SELECT public.minhas_os()));

ALTER TABLE public.workshop_order_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workshop_order_events FROM anon;
DROP POLICY IF EXISTS "Equipe da oficina lê" ON public.workshop_order_events;
DROP POLICY IF EXISTS "Equipe da oficina anota" ON public.workshop_order_events;
CREATE POLICY "Equipe da oficina lê" ON public.workshop_order_events FOR SELECT TO authenticated
  USING ((SELECT public.eh_equipe_oficina()));
CREATE POLICY "Equipe da oficina anota" ON public.workshop_order_events FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.eh_equipe_oficina()) AND event = 'nota');
-- Sem UPDATE e sem DELETE: ninguém altera nem apaga o histórico pelo app

-- Visão para as telas: nomes do cliente, da OS e dos técnicos sem abrir customers/service_orders ao papel
-- 'oficina' (ele não vê telefone, e-mail nem o cadastro). Roda com os direitos do dono, por isso filtra no WHERE.
DROP VIEW IF EXISTS public.oficina_itens;
CREATE VIEW public.oficina_itens AS
SELECT w.*,
       so.number AS os_number,
       coalesce(c.trade_name, c.name) AS customer_name,
       ep.name AS pickup_employee_name,
       eb.name AS bench_employee_name,
       rso.number AS return_os_number,
       rso.status AS return_os_status,
       wo.item_number AS warranty_origin_item,
       wso.number AS warranty_origin_os_number
  FROM public.workshop_orders w
  LEFT JOIN public.service_orders so ON so.id = w.service_order_id
  LEFT JOIN public.customers c ON c.id = w.customer_id
  LEFT JOIN public.employees ep ON ep.id = w.pickup_employee_id
  LEFT JOIN public.employees eb ON eb.id = w.bench_employee_id
  LEFT JOIN public.service_orders rso ON rso.id = w.return_service_order_id
  LEFT JOIN public.workshop_orders wo ON wo.id = w.warranty_origin_id
  LEFT JOIN public.service_orders wso ON wso.id = wo.service_order_id
 WHERE public.eh_equipe_oficina();
REVOKE ALL ON public.oficina_itens FROM anon, PUBLIC;
GRANT SELECT ON public.oficina_itens TO authenticated;

-- ---------------------------------------------------------------------
-- 6. Fotos da oficina em attachments
-- ---------------------------------------------------------------------
ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS workshop_order_id UUID REFERENCES public.workshop_orders (id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS workshop_status TEXT;   -- etapa do item quando a foto foi tirada
CREATE INDEX IF NOT EXISTS attachments_workshop_order_idx ON public.attachments (workshop_order_id);

ALTER TABLE public.attachments DROP CONSTRAINT IF EXISTS attachments_has_owner;
ALTER TABLE public.attachments ADD CONSTRAINT attachments_has_owner
  CHECK (num_nonnulls(service_order_id, task_id, equipment_id, workshop_order_id) >= 1);

CREATE OR REPLACE FUNCTION public.attachments_preenche()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.task_id IS NOT NULL THEN
    SELECT service_order_id INTO NEW.service_order_id FROM public.tasks WHERE id = NEW.task_id;
  END IF;
  IF NEW.workshop_order_id IS NOT NULL AND (auth.uid() IS NOT NULL OR NEW.workshop_status IS NULL) THEN
    SELECT status INTO NEW.workshop_status FROM public.workshop_orders WHERE id = NEW.workshop_order_id;
  END IF;
  IF auth.uid() IS NOT NULL THEN
    NEW.uploaded_by := auth.uid();
    NEW.created_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Oficina lê fotos da oficina" ON public.attachments;
DROP POLICY IF EXISTS "Oficina anexa fotos da oficina" ON public.attachments;
DROP POLICY IF EXISTS "Técnico lê fotos dos itens recolhidos" ON public.attachments;
DROP POLICY IF EXISTS "Técnico anexa fotos dos itens recolhidos" ON public.attachments;
CREATE POLICY "Oficina lê fotos da oficina" ON public.attachments FOR SELECT TO authenticated
  USING (workshop_order_id IS NOT NULL AND (SELECT public.eh_oficina()));
CREATE POLICY "Oficina anexa fotos da oficina" ON public.attachments FOR INSERT TO authenticated
  WITH CHECK (workshop_order_id IS NOT NULL AND service_order_id IS NULL AND task_id IS NULL
              AND equipment_id IS NULL AND (SELECT public.eh_oficina()));
CREATE POLICY "Técnico lê fotos dos itens recolhidos" ON public.attachments FOR SELECT TO authenticated
  USING (workshop_order_id IN (SELECT public.minhas_oficinas()));
CREATE POLICY "Técnico anexa fotos dos itens recolhidos" ON public.attachments FOR INSERT TO authenticated
  WITH CHECK (workshop_order_id IN (SELECT public.minhas_oficinas())
              AND service_order_id IS NULL AND task_id IS NULL AND equipment_id IS NULL);

-- ---------------------------------------------------------------------
-- 7. Funções usadas pelas telas
-- ---------------------------------------------------------------------
-- Tipo de OS das entradas de balcão
INSERT INTO public.service_types (name)
SELECT 'Oficina (balcão)'
WHERE NOT EXISTS (SELECT 1 FROM public.service_types WHERE lower(trim(name)) = 'oficina (balcão)');

-- Campos do item que as telas podem informar ao criar (o resto vem do banco)
CREATE OR REPLACE FUNCTION public.oficina_item_de_json(p JSONB)
RETURNS public.workshop_orders
LANGUAGE plpgsql STABLE SET search_path = ''
AS $$
DECLARE
  r public.workshop_orders;
  v public.workshop_orders := jsonb_populate_record(NULL::public.workshop_orders, p);
BEGIN
  r.equipment_type := btrim(v.equipment_type);
  r.units_collected := coalesce(v.units_collected, 'evaporadora');
  r.brand := nullif(btrim(v.brand), '');
  r.model := nullif(btrim(v.model), '');
  r.serial_number := nullif(btrim(v.serial_number), '');
  r.capacity_btu := v.capacity_btu;
  r.voltage := nullif(btrim(v.voltage), '');
  r.accessories := nullif(btrim(v.accessories), '');
  r.reported_defect := nullif(btrim(v.reported_defect), '');
  r.field_report := nullif(btrim(v.field_report), '');
  r.intake_notes := nullif(btrim(v.intake_notes), '');
  r.equipment_id := v.equipment_id;
  r.is_warranty := coalesce(v.is_warranty, FALSE);
  r.warranty_origin_id := v.warranty_origin_id;
  RETURN r;
END;
$$;

-- Entrada de balcão (sem visita): cria a OS e o item juntos. Só o escritório.
CREATE OR REPLACE FUNCTION public.oficina_entrada_balcao(p_customer_id UUID, p_address_id UUID, p_item JSONB)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tipo UUID;
  v_os UUID;
  v_item public.workshop_orders := public.oficina_item_de_json(p_item);
  v_id UUID;
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Só o escritório registra entrada de balcão.' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_tipo FROM public.service_types WHERE lower(trim(name)) = 'oficina (balcão)';
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Tipo de serviço "Oficina (balcão)" não encontrado (foi renomeado?).' USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.service_orders (customer_id, address_id, service_type_id, status, description)
  VALUES (p_customer_id, p_address_id, v_tipo, 'em_andamento',
          'Entrada na oficina (balcão): ' || coalesce(v_item.equipment_type, '')
          || coalesce(' ' || v_item.brand, '') || coalesce('. Defeito: ' || v_item.reported_defect, ''))
  RETURNING id INTO v_os;

  INSERT INTO public.workshop_orders (
    service_order_id, status, equipment_type, units_collected, brand, model, serial_number, capacity_btu,
    voltage, accessories, reported_defect, intake_notes, equipment_id, is_warranty, warranty_origin_id
  ) VALUES (
    v_os, 'entrada', v_item.equipment_type, v_item.units_collected, v_item.brand, v_item.model,
    v_item.serial_number, v_item.capacity_btu, v_item.voltage, v_item.accessories, v_item.reported_defect,
    v_item.intake_notes, v_item.equipment_id, v_item.is_warranty, v_item.warranty_origin_id
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Técnico recolhe pelo app de campo, na atividade de hoje (a caminho, em execução ou concluída)
CREATE OR REPLACE FUNCTION public.oficina_recolher(p_task_id UUID, p_item JSONB)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_eu UUID := public.meu_colaborador_id();
  v_tarefa RECORD;
  v_item public.workshop_orders := public.oficina_item_de_json(p_item);
  v_id UUID;
BEGIN
  IF v_eu IS NULL THEN
    RAISE EXCEPTION 'Só o técnico da atividade registra a retirada.' USING ERRCODE = '42501';
  END IF;
  SELECT t.id, t.service_order_id, t.status, t.technician_notes INTO v_tarefa
    FROM public.tasks t WHERE t.id = p_task_id AND t.employee_id = v_eu;
  IF v_tarefa.id IS NULL THEN
    RAISE EXCEPTION 'Atividade não encontrada.' USING ERRCODE = '42501';
  END IF;
  IF v_tarefa.status NOT IN ('em_deslocamento', 'em_execucao', 'concluida') THEN
    RAISE EXCEPTION 'Inicie a atividade antes de registrar a retirada.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.workshop_orders (
    service_order_id, task_id, status, pickup_employee_id, equipment_type, units_collected, brand, model,
    serial_number, capacity_btu, voltage, accessories, reported_defect, field_report, equipment_id
  ) VALUES (
    v_tarefa.service_order_id, v_tarefa.id, 'em_transito', v_eu, v_item.equipment_type, v_item.units_collected,
    v_item.brand, v_item.model, v_item.serial_number, v_item.capacity_btu, v_item.voltage, v_item.accessories,
    v_item.reported_defect, coalesce(v_item.field_report, v_tarefa.technician_notes), v_item.equipment_id
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Dados de uma OS pelo número, para a entrada na oficina (escritório e oficina; sem telefone/e-mail)
CREATE OR REPLACE FUNCTION public.oficina_buscar_os(p_numero BIGINT)
RETURNS TABLE (
  service_order_id UUID, os_number BIGINT, os_status TEXT, customer_id UUID, customer_name TEXT,
  bairro TEXT, cidade TEXT, description TEXT, task_id UUID, technician_id UUID, technician_name TEXT,
  technician_notes TEXT, task_finished_at TIMESTAMPTZ, itens_na_oficina INTEGER
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.eh_equipe_oficina() THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT so.id, so.number, so.status, c.id, coalesce(c.trade_name, c.name), a.district, a.city, so.description,
         t.id, e.id, e.name, t.technician_notes, t.finished_at,
         (SELECT count(*)::INTEGER FROM public.workshop_orders w WHERE w.service_order_id = so.id)
    FROM public.service_orders so
    JOIN public.customers c ON c.id = so.customer_id
    LEFT JOIN public.customer_addresses a ON a.id = so.address_id
    LEFT JOIN LATERAL (
      SELECT * FROM public.tasks tt
       WHERE tt.service_order_id = so.id AND tt.status <> 'cancelada'
       ORDER BY tt.scheduled_start DESC NULLS LAST LIMIT 1
    ) t ON TRUE
    LEFT JOIN public.employees e ON e.id = t.employee_id
   WHERE so.number = p_numero;
END;
$$;

-- Funcionários para escolher técnico de bancada/retirada (só nome e categoria; o papel oficina não lê employees)
CREATE OR REPLACE FUNCTION public.oficina_funcionarios()
RETURNS TABLE (id UUID, name TEXT, role TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.eh_equipe_oficina() THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT e.id, e.name, e.role FROM public.employees e
   WHERE e.active AND e.role IN ('oficina', 'tecnico', 'auxiliar')
   ORDER BY e.name;
END;
$$;

-- OS de devolução: uma OS (sem atividade; o escritório agenda depois pela linha do tempo) para um ou mais itens
-- prontos da mesma OS de origem. Cliente e endereço vêm da OS de origem.
CREATE OR REPLACE FUNCTION public.oficina_criar_os_devolucao(p_item_ids UUID[], p_service_type_id UUID,
                                                             p_descricao TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_origem RECORD;
  v_qtd INTEGER;
  v_os UUID;
  v_lista TEXT;
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Só o escritório cria a OS de devolução.' USING ERRCODE = '42501';
  END IF;
  IF coalesce(array_length(p_item_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Escolha ao menos um item.' USING ERRCODE = '23514';
  END IF;

  SELECT count(*) INTO v_qtd FROM public.workshop_orders w WHERE w.id = ANY (p_item_ids);
  IF v_qtd <> array_length(p_item_ids, 1) THEN
    RAISE EXCEPTION 'Item não encontrado.' USING ERRCODE = '23503';
  END IF;
  IF (SELECT count(DISTINCT service_order_id) FROM public.workshop_orders WHERE id = ANY (p_item_ids)) <> 1 THEN
    RAISE EXCEPTION 'Os itens precisam ser da mesma OS de origem.' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.workshop_orders WHERE id = ANY (p_item_ids)
              AND (status <> 'pronto' OR return_service_order_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'Só itens prontos e ainda sem OS de devolução.' USING ERRCODE = '23514';
  END IF;

  SELECT so.customer_id, so.address_id, so.number INTO v_origem
    FROM public.service_orders so
   WHERE so.id = (SELECT service_order_id FROM public.workshop_orders WHERE id = p_item_ids[1]);

  SELECT string_agg(
           public.oficina_rotulo_unidade(w.units_collected) || ' ' || w.equipment_type || coalesce(' ' || w.brand, '')
           || CASE WHEN w.decision = 'recusado' THEN ' (sem conserto, recusado pelo cliente)' ELSE '' END,
           '; ' ORDER BY w.item_number)
    INTO v_lista
    FROM public.workshop_orders w WHERE w.id = ANY (p_item_ids);

  INSERT INTO public.service_orders (customer_id, address_id, service_type_id, status, description)
  VALUES (v_origem.customer_id, v_origem.address_id, p_service_type_id, 'agendada',
          coalesce(nullif(btrim(p_descricao), ''),
                   'Devolução de equipamento da oficina (OS de origem ' || v_origem.number || '): ' || v_lista || '.'))
  RETURNING id INTO v_os;

  UPDATE public.workshop_orders SET return_service_order_id = v_os WHERE id = ANY (p_item_ids);
  RETURN v_os;
END;
$$;

-- OS de devolução concluída: os itens dela (prontos) passam para "entregue"
CREATE OR REPLACE FUNCTION public.service_orders_entrega_oficina()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'concluida' AND OLD.status IS DISTINCT FROM 'concluida' THEN
    PERFORM set_config('app.oficina_sistema', 'on', TRUE);
    UPDATE public.workshop_orders
       SET status = 'entregue'
     WHERE return_service_order_id = NEW.id AND status = 'pronto';
    PERFORM set_config('app.oficina_sistema', 'off', TRUE);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS service_orders_entrega_oficina ON public.service_orders;
CREATE TRIGGER service_orders_entrega_oficina
  AFTER UPDATE OF status ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.service_orders_entrega_oficina();

-- ---------------------------------------------------------------------
-- 8. Fila de impressão (Elgin L42PRO no servidor da loja)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printer TEXT NOT NULL DEFAULT 'elgin' CHECK (printer ~ '^[a-z0-9_-]{1,40}$'),
  kind TEXT NOT NULL CHECK (kind IN ('etiqueta_oficina', 'teste')),
  workshop_order_id UUID REFERENCES public.workshop_orders (id) ON DELETE SET NULL,
  payload TEXT NOT NULL CHECK (char_length(payload) BETWEEN 10 AND 20000),   -- ZPL
  copies SMALLINT NOT NULL DEFAULT 1 CHECK (copies BETWEEN 1 AND 10),
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'imprimindo', 'impressa', 'falhou', 'cancelada')),
  error TEXT,
  attempts SMALLINT NOT NULL DEFAULT 0,
  agent TEXT,
  requested_by UUID DEFAULT auth.uid() REFERENCES public.profiles (id) ON DELETE SET NULL,
  requested_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS print_jobs_fila_idx ON public.print_jobs (printer, created_at) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS print_jobs_item_idx ON public.print_jobs (workshop_order_id, created_at DESC);

-- Pedido novo: sempre pendente, autor do login. Depois só o agente (pelas funções) ou "cancelar" mudam.
CREATE OR REPLACE FUNCTION public.print_jobs_preenche()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pendente';
    NEW.error := NULL;
    NEW.attempts := 0;
    NEW.agent := NULL;
    NEW.started_at := NULL;
    NEW.finished_at := NULL;
    NEW.requested_by := auth.uid();
    NEW.requested_by_name := (SELECT full_name FROM public.profiles WHERE id = auth.uid());
    NEW.created_at := NOW();
  ELSIF NOT public.eh_impressora() THEN
    -- Equipe só cancela pedido que ainda não começou a imprimir
    IF NOT (OLD.status = 'pendente' AND NEW.status = 'cancelada')
       OR NEW.payload IS DISTINCT FROM OLD.payload OR NEW.copies IS DISTINCT FROM OLD.copies
       OR NEW.printer IS DISTINCT FROM OLD.printer THEN
      RAISE EXCEPTION 'Só é possível cancelar um pedido que ainda está na fila.' USING ERRCODE = '42501';
    END IF;
    NEW.finished_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS print_jobs_preenche ON public.print_jobs;
CREATE TRIGGER print_jobs_preenche
  BEFORE INSERT OR UPDATE ON public.print_jobs
  FOR EACH ROW EXECUTE FUNCTION public.print_jobs_preenche();

ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.print_jobs FROM anon;
DROP POLICY IF EXISTS "Equipe lê a fila" ON public.print_jobs;
DROP POLICY IF EXISTS "Equipe pede impressão" ON public.print_jobs;
DROP POLICY IF EXISTS "Equipe cancela" ON public.print_jobs;
DROP POLICY IF EXISTS "Agente lê a fila" ON public.print_jobs;
CREATE POLICY "Equipe lê a fila" ON public.print_jobs FOR SELECT TO authenticated
  USING ((SELECT public.eh_equipe_oficina()));
CREATE POLICY "Equipe pede impressão" ON public.print_jobs FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.eh_equipe_oficina()));
CREATE POLICY "Equipe cancela" ON public.print_jobs FOR UPDATE TO authenticated
  USING ((SELECT public.eh_equipe_oficina())) WITH CHECK ((SELECT public.eh_equipe_oficina()));
-- O agente lê (para o Realtime avisar) e muda a situação só pelas funções abaixo
CREATE POLICY "Agente lê a fila" ON public.print_jobs FOR SELECT TO authenticated
  USING ((SELECT public.eh_impressora()));

-- Sinal de vida do agente (a tela mostra "Elgin pronta" ou "servidor da loja desligado")
CREATE TABLE IF NOT EXISTS public.print_agents (
  id TEXT PRIMARY KEY CHECK (id ~ '^[a-z0-9_-]{1,40}$'),     -- ex.: 'servidor-loja'
  printer TEXT NOT NULL DEFAULT 'elgin',
  version TEXT,
  info JSONB,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.print_agents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.print_agents FROM anon;
DROP POLICY IF EXISTS "Equipe lê" ON public.print_agents;
CREATE POLICY "Equipe lê" ON public.print_agents FOR SELECT TO authenticated
  USING ((SELECT public.eh_equipe_oficina()));

-- Agente: pega o próximo pedido (um por vez, sem dois agentes pegarem o mesmo)
CREATE OR REPLACE FUNCTION public.impressora_pegar(p_agente TEXT, p_impressora TEXT DEFAULT 'elgin')
RETURNS SETOF public.print_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_job public.print_jobs;
BEGIN
  IF NOT public.eh_impressora() THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  -- Pedido parado há mais de 30 min (servidor estava desligado) não sai mais: imprimir etiqueta velha confunde
  UPDATE public.print_jobs
     SET status = 'falhou', error = 'Expirou na fila (o servidor da loja estava desligado). Peça de novo.',
         finished_at = NOW()
   WHERE status = 'pendente' AND printer = p_impressora AND created_at < NOW() - INTERVAL '30 minutes';

  UPDATE public.print_jobs j
     SET status = 'imprimindo', started_at = NOW(), attempts = j.attempts + 1, agent = left(p_agente, 40)
   WHERE j.id = (
     SELECT id FROM public.print_jobs
      WHERE status = 'pendente' AND printer = p_impressora
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
   )
  RETURNING j.* INTO v_job;
  IF v_job.id IS NOT NULL THEN
    RETURN NEXT v_job;
  END IF;
  RETURN;
END;
$$;

-- Agente: resultado da impressão
CREATE OR REPLACE FUNCTION public.impressora_concluir(p_id UUID, p_ok BOOLEAN, p_erro TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.eh_impressora() THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  UPDATE public.print_jobs
     SET status = CASE WHEN p_ok THEN 'impressa' ELSE 'falhou' END,
         error = CASE WHEN p_ok THEN NULL ELSE left(coalesce(p_erro, 'Erro desconhecido'), 1000) END,
         finished_at = NOW()
   WHERE id = p_id AND status = 'imprimindo';
END;
$$;

-- Agente: sinal de vida (a cada 30 s) e limpeza de pedido que ficou "imprimindo" (agente caiu no meio)
CREATE OR REPLACE FUNCTION public.impressora_sinal(p_agente TEXT, p_impressora TEXT DEFAULT 'elgin',
                                                   p_versao TEXT DEFAULT NULL, p_info JSONB DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.eh_impressora() THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.print_agents (id, printer, version, info, last_seen_at)
  VALUES (p_agente, p_impressora, left(p_versao, 40), p_info, NOW())
  ON CONFLICT (id) DO UPDATE
    SET printer = EXCLUDED.printer, version = EXCLUDED.version, info = EXCLUDED.info, last_seen_at = NOW();

  UPDATE public.print_jobs
     SET status = 'falhou', error = 'Interrompido no meio da impressão. Confira a etiqueta e peça de novo se preciso.',
         finished_at = NOW()
   WHERE status = 'imprimindo' AND agent = p_agente AND started_at < NOW() - INTERVAL '2 minutes';
END;
$$;

-- ---------------------------------------------------------------------
-- 9. Permissões das funções e Realtime
-- ---------------------------------------------------------------------
DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'eh_oficina()', 'eh_equipe_oficina()', 'eh_impressora()', 'meu_funcionario_id()', 'minhas_oficinas()',
    'oficina_entrada_balcao(uuid, uuid, jsonb)', 'oficina_recolher(uuid, jsonb)', 'oficina_buscar_os(bigint)',
    'oficina_criar_os_devolucao(uuid[], uuid, text)', 'oficina_funcionarios()',
    'impressora_pegar(text, text)', 'impressora_concluir(uuid, boolean, text)',
    'impressora_sinal(text, text, text, jsonb)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  -- Funções internas (só os triggers e as funções acima usam)
  FOREACH f IN ARRAY ARRAY['oficina_item_de_json(jsonb)', 'workshop_orders_regras()', 'workshop_orders_historico()',
                           'workshop_order_events_preenche()', 'print_jobs_preenche()',
                           'service_orders_entrega_oficina()'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                  WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'workshop_orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workshop_orders;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                  WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'print_jobs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.print_jobs;
  END IF;
END $$;

-- =====================================================================
-- DEPOIS DE RODAR
--   Login do agente da impressora (no servidor da loja):
--     1. Authentication > Users > Add user: impressora@brvniteroi.com.br, senha forte, "Auto Confirm User"
--     2. UPDATE public.profiles SET role = 'impressora', active = TRUE, full_name = 'Impressora da loja'
--        WHERE email = 'impressora@brvniteroi.com.br';
--   Gustavo: Equipe > Usuários > criar com o papel "Oficina" (depois de republicar gerenciar-usuario),
--   e em Funcionários colocar o cargo "Ajudante de Oficina".
-- =====================================================================
