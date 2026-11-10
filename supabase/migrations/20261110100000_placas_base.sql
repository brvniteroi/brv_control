-- =====================================================================
-- Módulo Placas (reparo de placas eletrônicas), fase P1: banco. Plano em docs/placas.md.
--
-- Tabelas próprias (não mexe na Oficina dos equipamentos):
--   board_clients      cadastro PARALELO de clientes de placas (instaladores parceiros e cliente final)
--   board_orders       a placa no laboratório (número próprio OS-DDMMAA-NNN; OS do Control só se a equipe retirou em campo)
--   board_finance      valor cobrado e reembolso (só quem passa em tem_financeiro_placas(): o Braulio)
--   board_photos       fotos (arquivo na HostGator, aqui só o registro)
--   board_events       histórico que ninguém altera nem apaga (só notas pela tela)
--   board_number_seq   contador do número por dia (sem contar registros no navegador)
--
-- Acesso: só admin e escritório (papel 'oficina' e técnicos não entram). Financeiro só com a marca do perfil.
-- Regras no banco: bloqueio de etapa sem orçamento aprovado (fora garantia), só "pronto" vira "entregue",
-- sem conserto exige motivo, finalizada só reabre o admin, número/data de entrada/token não mudam por fora.
-- Página pública do parceiro: função placa_acompanhamento(token), sem login, devolve só dados seguros.
-- Sem login (scripts com a service_role, ex.: importador) as regras de etapa não se aplicam.
--
-- Colar no SQL Editor do Supabase (tudo numa transação: se der erro, nada é aplicado).
-- =====================================================================
BEGIN;

-- ---------------------------------------------------------------------
-- 1. Clientes de placas (cadastro paralelo ao de customers)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.board_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) > 0),
  phone TEXT NOT NULL CHECK (char_length(btrim(phone)) > 0),
  kind TEXT NOT NULL DEFAULT 'instalador' CHECK (kind IN ('instalador', 'final')),
  city TEXT,
  document TEXT,
  person_type TEXT NOT NULL DEFAULT 'PF' CHECK (person_type IN ('PF', 'PJ')),
  address TEXT,
  notes TEXT,
  legacy_id TEXT,                              -- id do reparos_clientes no BRV Equipamentos
  created_by UUID DEFAULT auth.uid() REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  busca TEXT GENERATED ALWAYS AS (
    public.sem_acento(coalesce(name, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(city, ''))
  ) STORED
);
CREATE UNIQUE INDEX IF NOT EXISTS board_clients_legacy_key ON public.board_clients (legacy_id) WHERE legacy_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS board_clients_busca_trgm_idx ON public.board_clients USING gin (busca extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- 2. Número da placa: OS-DDMMAA-NNN (data de Brasília), contador por dia com trava
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.board_number_seq (
  day DATE PRIMARY KEY,
  last INTEGER NOT NULL
);

CREATE OR REPLACE FUNCTION public.board_next_number(p_day DATE DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_day DATE := coalesce(p_day, (NOW() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_n INTEGER;
BEGIN
  INSERT INTO public.board_number_seq (day, last) VALUES (v_day, 1)
  ON CONFLICT (day) DO UPDATE SET last = public.board_number_seq.last + 1
  RETURNING last INTO v_n;
  RETURN 'OS-' || to_char(v_day, 'DDMMYY') || '-' || lpad(v_n::text, 3, '0');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.board_next_number(DATE) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. A placa
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.board_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_number TEXT NOT NULL UNIQUE,
  public_token TEXT NOT NULL UNIQUE
    DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),

  status TEXT NOT NULL DEFAULT 'entrada' CHECK (status IN (
    'entrada', 'diagnostico', 'aguardando_peca', 'em_reparo', 'teste', 'pronto', 'entregue', 'sem_conserto'
  )),
  stage_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,                      -- entregue ou sem conserto
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  cancelled_entry BOOLEAN NOT NULL DEFAULT FALSE,
  cancel_reason TEXT,
  unrepaired_reason TEXT,

  -- Cliente: OU do cadastro paralelo (balcão/portador) OU do Control (retirada em campo), nunca os dois
  board_client_id UUID REFERENCES public.board_clients (id) ON DELETE RESTRICT,
  customer_id UUID REFERENCES public.customers (id) ON DELETE RESTRICT,
  service_order_id UUID REFERENCES public.service_orders (id) ON DELETE RESTRICT,   -- OS do Control (só retirada em campo)
  customer_kind TEXT NOT NULL DEFAULT 'instalador' CHECK (customer_kind IN ('instalador', 'final')),
  customer_city TEXT,
  customer_document TEXT,
  customer_person_type TEXT NOT NULL DEFAULT 'PF' CHECK (customer_person_type IN ('PF', 'PJ')),
  customer_address TEXT,

  -- A placa
  equipment_type TEXT NOT NULL DEFAULT 'Split Inverter' CHECK (char_length(btrim(equipment_type)) > 0),
  brand_model TEXT NOT NULL CHECK (char_length(btrim(brand_model)) > 0),
  board_code TEXT NOT NULL CHECK (char_length(btrim(board_code)) > 0),
  peripherals TEXT,
  reported_defect TEXT NOT NULL CHECK (char_length(btrim(reported_defect)) > 0),
  no_apparent_defect BOOLEAN NOT NULL DEFAULT FALSE,
  pickup_employee_id UUID REFERENCES public.employees (id) ON DELETE SET NULL,
  bench_employee_id UUID REFERENCES public.employees (id) ON DELETE SET NULL,

  -- Bancada
  error_code TEXT,
  technical_diagnosis TEXT,
  replaced_components TEXT,

  -- Orçamento (feito no Control)
  quote_status TEXT NOT NULL DEFAULT 'nao_feito' CHECK (quote_status IN ('nao_feito', 'enviado', 'aprovado', 'recusado')),
  quote_amount NUMERIC(10, 2) CHECK (quote_amount >= 0),
  quote_validity_days INTEGER NOT NULL DEFAULT 10 CHECK (quote_validity_days BETWEEN 1 AND 365),
  quote_technical_opinion TEXT,
  quote_sent_at TIMESTAMPTZ,
  quote_responded_at TIMESTAMPTZ,
  quote_response_channel TEXT CHECK (quote_response_channel IN ('whatsapp', 'telefone', 'presencial', 'email')),
  quote_response_notes TEXT,
  quote_responded_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,

  -- Garantia (retorno de reparo anterior: sem orçamento)
  is_warranty BOOLEAN NOT NULL DEFAULT FALSE,
  warranty_origin_id UUID REFERENCES public.board_orders (id) ON DELETE SET NULL,

  legacy_id TEXT,                               -- id do reparos_os no BRV Equipamentos (importador repetível)
  created_by UUID DEFAULT auth.uid() REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- data de ENTRADA (não muda)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  busca TEXT GENERATED ALWAYS AS (
    public.sem_acento(
      coalesce(board_number, '') || ' ' || coalesce(brand_model, '') || ' ' || coalesce(board_code, '') || ' ' ||
      coalesce(error_code, '') || ' ' || coalesce(equipment_type, '')
    )
  ) STORED,

  CONSTRAINT board_orders_um_cliente CHECK ((board_client_id IS NOT NULL)::int + (customer_id IS NOT NULL)::int = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS board_orders_legacy_key ON public.board_orders (legacy_id) WHERE legacy_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS board_orders_status_idx ON public.board_orders (status) WHERE NOT archived AND NOT cancelled_entry;
CREATE INDEX IF NOT EXISTS board_orders_finished_idx ON public.board_orders (finished_at DESC) WHERE finished_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS board_orders_client_idx ON public.board_orders (board_client_id);
CREATE INDEX IF NOT EXISTS board_orders_customer_idx ON public.board_orders (customer_id);
CREATE INDEX IF NOT EXISTS board_orders_os_idx ON public.board_orders (service_order_id);
CREATE INDEX IF NOT EXISTS board_orders_busca_trgm_idx ON public.board_orders USING gin (busca extensions.gin_trgm_ops);

-- Financeiro: tabela à parte (RLS só para quem tem a marca), porque o Postgres não esconde coluna por papel
CREATE TABLE IF NOT EXISTS public.board_finance (
  board_order_id UUID PRIMARY KEY REFERENCES public.board_orders (id) ON DELETE CASCADE,
  charged_amount NUMERIC(10, 2) CHECK (charged_amount >= 0),
  refunded BOOLEAN NOT NULL DEFAULT FALSE,
  refund_amount NUMERIC(10, 2) CHECK (refund_amount >= 0),
  refunded_at DATE,
  refund_reason TEXT,
  updated_by UUID DEFAULT auth.uid() REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT board_finance_reembolso CHECK (
    NOT refunded OR (coalesce(refund_amount, 0) > 0 AND refunded_at IS NOT NULL AND char_length(btrim(coalesce(refund_reason, ''))) > 0)
  )
);

CREATE TABLE IF NOT EXISTS public.board_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_order_id UUID NOT NULL REFERENCES public.board_orders (id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'outros' CHECK (category IN ('antes', 'depois', 'outros')),
  public_url TEXT NOT NULL CHECK (char_length(btrim(public_url)) > 0),
  file_name TEXT,
  caption TEXT,
  stage_at_capture TEXT,
  uploaded_by UUID DEFAULT auth.uid() REFERENCES public.profiles (id) ON DELETE SET NULL,
  uploaded_by_name TEXT,
  legacy_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS board_photos_order_idx ON public.board_photos (board_order_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS board_photos_legacy_key ON public.board_photos (legacy_id) WHERE legacy_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.board_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_order_id UUID NOT NULL REFERENCES public.board_orders (id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'entrada', 'mudanca_etapa', 'edicao_campo', 'orcamento', 'envio_orcamento', 'resposta_orcamento',
    'reembolso', 'arquivamento', 'cancelamento', 'reabertura', 'novo_link', 'nota'
  )),
  from_stage TEXT,
  to_stage TEXT,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  note TEXT,
  visibility TEXT NOT NULL DEFAULT 'todos' CHECK (visibility IN ('todos', 'escritorio', 'financeiro')),
  actor_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  actor_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS board_events_order_idx ON public.board_events (board_order_id, created_at);

-- updated_at automático
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['board_clients', 'board_orders', 'board_finance'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 4. Regras da placa (antes de gravar)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.board_orders_preenche()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    -- Pela tela: nasce sempre em "entrada", com número, token e data de entrada do servidor
    NEW.board_number := public.board_next_number();
    NEW.public_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    NEW.status := 'entrada';
    NEW.created_at := NOW();
    NEW.stage_changed_at := NOW();
    NEW.finished_at := NULL;
    NEW.archived := FALSE;
    NEW.archived_at := NULL;
    NEW.cancelled_entry := FALSE;
    NEW.cancel_reason := NULL;
    NEW.unrepaired_reason := NULL;
    NEW.created_by := auth.uid();
    NEW.quote_status := 'nao_feito';
    NEW.quote_amount := NULL;
    NEW.quote_technical_opinion := NULL;
    NEW.quote_sent_at := NULL;
    NEW.quote_responded_at := NULL;
    NEW.quote_response_channel := NULL;
    NEW.quote_response_notes := NULL;
    NEW.quote_responded_by := NULL;
    IF NEW.is_warranty AND NEW.warranty_origin_id IS NULL THEN
      RAISE EXCEPTION 'Escolha a placa original do retorno em garantia.' USING ERRCODE = '23514';
    END IF;
    IF NOT NEW.is_warranty THEN
      NEW.warranty_origin_id := NULL;
    END IF;
  ELSIF NEW.board_number IS NULL OR btrim(NEW.board_number) = '' THEN
    NEW.board_number := public.board_next_number();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.board_orders_preenche() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS board_orders_preenche ON public.board_orders;
CREATE TRIGGER board_orders_preenche
  BEFORE INSERT ON public.board_orders
  FOR EACH ROW EXECUTE FUNCTION public.board_orders_preenche();

CREATE OR REPLACE FUNCTION public.board_orders_regras()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_final_old BOOLEAN := OLD.status IN ('entregue', 'sem_conserto');
  v_final_new BOOLEAN := NEW.status IN ('entregue', 'sem_conserto');
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;          -- script (importador): sem regras de etapa
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.board_number IS DISTINCT FROM OLD.board_number THEN
    RAISE EXCEPTION 'O número e a data de entrada da placa não mudam.' USING ERRCODE = '42501';
  END IF;
  IF NEW.public_token IS DISTINCT FROM OLD.public_token AND coalesce(current_setting('board.novo_link', TRUE), '') <> '1' THEN
    RAISE EXCEPTION 'O link de acompanhamento só muda por "Gerar novo link".' USING ERRCODE = '42501';
  END IF;

  -- Finalizada: só arquivar; reabrir é do administrador
  IF v_final_old THEN
    IF NEW.status = OLD.status THEN
      IF (to_jsonb(NEW) - 'archived' - 'archived_at' - 'updated_at')
         IS DISTINCT FROM (to_jsonb(OLD) - 'archived' - 'archived_at' - 'updated_at') THEN
        RAISE EXCEPTION 'Placa finalizada: só pode ser arquivada, ou reaberta pelo administrador.' USING ERRCODE = '42501';
      END IF;
    ELSIF NOT public.eh_admin() THEN
      RAISE EXCEPTION 'Só o administrador reabre uma placa finalizada.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Garantia não tem orçamento
  IF NEW.is_warranty AND (
       NEW.quote_amount IS DISTINCT FROM OLD.quote_amount
       OR NEW.quote_status IS DISTINCT FROM OLD.quote_status
       OR NEW.quote_sent_at IS DISTINCT FROM OLD.quote_sent_at) THEN
    RAISE EXCEPTION 'Retorno em garantia não tem orçamento.' USING ERRCODE = '23514';
  END IF;

  -- Orçamento enviado: precisa de valor e de parecer
  IF NEW.quote_status = 'enviado' AND (OLD.quote_status IS DISTINCT FROM 'enviado' OR NEW.quote_sent_at IS DISTINCT FROM OLD.quote_sent_at) THEN
    IF coalesce(NEW.quote_amount, 0) <= 0 OR char_length(btrim(coalesce(NEW.quote_technical_opinion, ''))) = 0 THEN
      RAISE EXCEPTION 'Registre o valor e o parecer técnico antes de enviar o orçamento.' USING ERRCODE = '23514';
    END IF;
    NEW.quote_sent_at := NOW();
  END IF;

  -- Resposta do cliente: canal obrigatório; data e autor vêm do servidor
  IF NEW.quote_status IN ('aprovado', 'recusado') AND NEW.quote_status IS DISTINCT FROM OLD.quote_status THEN
    IF NEW.quote_response_channel IS NULL THEN
      RAISE EXCEPTION 'Informe por onde o cliente respondeu ao orçamento.' USING ERRCODE = '23514';
    END IF;
    IF coalesce(NEW.quote_amount, 0) <= 0 THEN
      RAISE EXCEPTION 'Registre o valor do orçamento antes da resposta do cliente.' USING ERRCODE = '23514';
    END IF;
    NEW.quote_responded_at := NOW();
    NEW.quote_responded_by := auth.uid();
  END IF;

  -- Mudança de etapa
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- (reabrir placa arquivada = admin desarquiva na mesma alteração)
    IF OLD.cancelled_entry OR (OLD.archived AND NEW.archived) THEN
      RAISE EXCEPTION 'Placa cancelada ou arquivada não muda de etapa.' USING ERRCODE = '42501';
    END IF;
    IF NEW.status IN ('aguardando_peca', 'em_reparo', 'teste', 'pronto', 'entregue')
       AND NEW.quote_status <> 'aprovado' AND NOT NEW.is_warranty THEN
      IF NEW.quote_status = 'recusado' THEN
        RAISE EXCEPTION 'O cliente recusou o orçamento: finalize como "Sem Conserto / Devolvido".' USING ERRCODE = '23514';
      END IF;
      RAISE EXCEPTION 'Registre a aprovação do orçamento antes de seguir para o conserto.' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'entregue' AND OLD.status <> 'pronto' THEN
      RAISE EXCEPTION 'Só uma placa pronta pode ser entregue.' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'sem_conserto' AND char_length(btrim(coalesce(NEW.unrepaired_reason, ''))) = 0 THEN
      RAISE EXCEPTION 'Informe o motivo de finalizar sem conserto.' USING ERRCODE = '23514';
    END IF;

    NEW.stage_changed_at := NOW();
    IF v_final_new THEN
      NEW.finished_at := least(coalesce(NEW.finished_at, NOW()), NOW());
      IF NEW.finished_at < OLD.created_at THEN
        RAISE EXCEPTION 'A saída não pode ser antes da entrada da placa.' USING ERRCODE = '23514';
      END IF;
    ELSE
      NEW.finished_at := NULL;
      NEW.unrepaired_reason := NULL;
    END IF;
  END IF;

  -- Cancelar e arquivar
  IF NEW.cancelled_entry AND NOT OLD.cancelled_entry THEN
    IF char_length(btrim(coalesce(NEW.cancel_reason, ''))) = 0 THEN
      RAISE EXCEPTION 'Informe o motivo do cancelamento da entrada.' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.archived AND NOT OLD.archived THEN
    NEW.archived_at := NOW();
  ELSIF NOT NEW.archived THEN
    NEW.archived_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.board_orders_regras() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS board_orders_regras ON public.board_orders;
CREATE TRIGGER board_orders_regras
  BEFORE UPDATE ON public.board_orders
  FOR EACH ROW EXECUTE FUNCTION public.board_orders_regras();

-- ---------------------------------------------------------------------
-- 5. Histórico automático (quem, quando, o quê) e notas
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.board_ator()
RETURNS TABLE (id UUID, nome TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT auth.uid(), coalesce((SELECT full_name FROM public.profiles WHERE profiles.id = auth.uid()), 'Sistema');
$$;
REVOKE EXECUTE ON FUNCTION public.board_ator() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.board_orders_audita()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_ator UUID;
  v_nome TEXT;
  o JSONB;
  n JSONB;
  c TEXT;
  v_antes TEXT;
  v_depois TEXT;
  v_campos TEXT[] := ARRAY[
    'equipment_type', 'brand_model', 'board_code', 'peripherals', 'reported_defect', 'no_apparent_defect',
    'error_code', 'technical_diagnosis', 'replaced_components'
  ];
  v_orcamento TEXT[] := ARRAY['quote_amount', 'quote_validity_days', 'quote_technical_opinion', 'customer_document', 'customer_address'];
BEGIN
  SELECT a.id, a.nome INTO v_ator, v_nome FROM public.board_ator() a;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.board_events (board_order_id, event_type, to_stage, note, actor_id, actor_name)
    VALUES (NEW.id, 'entrada', NEW.status, 'Placa registrada: ' || NEW.board_number, v_ator, v_nome);
    RETURN NULL;
  END IF;

  o := to_jsonb(OLD);
  n := to_jsonb(NEW);

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.board_events (board_order_id, event_type, from_stage, to_stage, note, actor_id, actor_name)
    VALUES (
      NEW.id,
      CASE WHEN OLD.status IN ('entregue', 'sem_conserto') THEN 'reabertura' ELSE 'mudanca_etapa' END,
      OLD.status, NEW.status,
      CASE WHEN NEW.status = 'sem_conserto' THEN NEW.unrepaired_reason ELSE NULL END,
      v_ator, v_nome
    );
  END IF;

  FOREACH c IN ARRAY v_campos LOOP
    IF o -> c IS DISTINCT FROM n -> c THEN
      INSERT INTO public.board_events (board_order_id, event_type, field_name, old_value, new_value, actor_id, actor_name)
      VALUES (NEW.id, 'edicao_campo', c, left(o ->> c, 500), left(n ->> c, 500), v_ator, v_nome);
    END IF;
  END LOOP;

  IF NEW.pickup_employee_id IS DISTINCT FROM OLD.pickup_employee_id THEN
    INSERT INTO public.board_events (board_order_id, event_type, field_name, old_value, new_value, actor_id, actor_name)
    VALUES (NEW.id, 'edicao_campo', 'pickup_technician_id',
            (SELECT name FROM public.employees WHERE id = OLD.pickup_employee_id),
            (SELECT name FROM public.employees WHERE id = NEW.pickup_employee_id), v_ator, v_nome);
  END IF;
  IF NEW.bench_employee_id IS DISTINCT FROM OLD.bench_employee_id THEN
    INSERT INTO public.board_events (board_order_id, event_type, field_name, old_value, new_value, actor_id, actor_name)
    VALUES (NEW.id, 'edicao_campo', 'bench_technician_id',
            (SELECT name FROM public.employees WHERE id = OLD.bench_employee_id),
            (SELECT name FROM public.employees WHERE id = NEW.bench_employee_id), v_ator, v_nome);
  END IF;

  FOREACH c IN ARRAY v_orcamento LOOP
    IF o -> c IS DISTINCT FROM n -> c THEN
      INSERT INTO public.board_events (board_order_id, event_type, field_name, old_value, new_value, visibility, actor_id, actor_name)
      VALUES (NEW.id, 'orcamento', c, left(o ->> c, 500), left(n ->> c, 500), 'escritorio', v_ator, v_nome);
    END IF;
  END LOOP;

  IF NEW.quote_status = 'enviado' AND (OLD.quote_status IS DISTINCT FROM 'enviado' OR NEW.quote_sent_at IS DISTINCT FROM OLD.quote_sent_at) THEN
    INSERT INTO public.board_events (board_order_id, event_type, note, visibility, actor_id, actor_name)
    VALUES (NEW.id, 'envio_orcamento', 'Orçamento enviado ao cliente', 'escritorio', v_ator, v_nome);
  END IF;

  IF NEW.quote_status IN ('aprovado', 'recusado') AND NEW.quote_status IS DISTINCT FROM OLD.quote_status THEN
    v_depois := CASE WHEN NEW.quote_status = 'aprovado' THEN 'Orçamento aprovado' ELSE 'Orçamento recusado' END
      || ' (' || coalesce(NEW.quote_response_channel, '?') || ')'
      || CASE WHEN NEW.quote_response_notes IS NOT NULL AND btrim(NEW.quote_response_notes) <> '' THEN ': ' || NEW.quote_response_notes ELSE '' END;
    INSERT INTO public.board_events (board_order_id, event_type, note, visibility, actor_id, actor_name)
    VALUES (NEW.id, 'resposta_orcamento', left(v_depois, 1000), 'escritorio', v_ator, v_nome);
  END IF;

  IF NEW.archived AND NOT OLD.archived THEN
    INSERT INTO public.board_events (board_order_id, event_type, note, actor_id, actor_name)
    VALUES (NEW.id, 'arquivamento', 'Placa arquivada', v_ator, v_nome);
  END IF;
  IF NEW.cancelled_entry AND NOT OLD.cancelled_entry THEN
    INSERT INTO public.board_events (board_order_id, event_type, note, actor_id, actor_name)
    VALUES (NEW.id, 'cancelamento', 'Entrada cancelada: ' || coalesce(NEW.cancel_reason, ''), v_ator, v_nome);
  END IF;
  IF NEW.public_token IS DISTINCT FROM OLD.public_token THEN
    INSERT INTO public.board_events (board_order_id, event_type, note, actor_id, actor_name)
    VALUES (NEW.id, 'novo_link', 'Novo link de acompanhamento gerado (o anterior deixou de valer)', v_ator, v_nome);
  END IF;

  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.board_orders_audita() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS board_orders_audita ON public.board_orders;
CREATE TRIGGER board_orders_audita
  AFTER INSERT OR UPDATE ON public.board_orders
  FOR EACH ROW EXECUTE FUNCTION public.board_orders_audita();

-- Financeiro: reembolso e valor cobrado vão para o histórico só de quem vê o financeiro
CREATE OR REPLACE FUNCTION public.board_finance_audita()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_ator UUID;
  v_nome TEXT;
BEGIN
  SELECT a.id, a.nome INTO v_ator, v_nome FROM public.board_ator() a;
  IF TG_OP = 'UPDATE' AND NEW.charged_amount IS DISTINCT FROM OLD.charged_amount THEN
    INSERT INTO public.board_events (board_order_id, event_type, field_name, old_value, new_value, visibility, actor_id, actor_name)
    VALUES (NEW.board_order_id, 'edicao_campo', 'charged_amount', OLD.charged_amount::text, NEW.charged_amount::text, 'financeiro', v_ator, v_nome);
  ELSIF TG_OP = 'INSERT' AND NEW.charged_amount IS NOT NULL THEN
    INSERT INTO public.board_events (board_order_id, event_type, field_name, new_value, visibility, actor_id, actor_name)
    VALUES (NEW.board_order_id, 'edicao_campo', 'charged_amount', NEW.charged_amount::text, 'financeiro', v_ator, v_nome);
  END IF;
  IF (TG_OP = 'INSERT' AND NEW.refunded) OR (TG_OP = 'UPDATE' AND (
       NEW.refunded IS DISTINCT FROM OLD.refunded OR NEW.refund_amount IS DISTINCT FROM OLD.refund_amount
       OR NEW.refunded_at IS DISTINCT FROM OLD.refunded_at OR NEW.refund_reason IS DISTINCT FROM OLD.refund_reason)) THEN
    INSERT INTO public.board_events (board_order_id, event_type, note, visibility, actor_id, actor_name)
    VALUES (
      NEW.board_order_id, 'reembolso',
      CASE WHEN NEW.refunded
        THEN 'Reembolso de R$ ' || to_char(NEW.refund_amount, 'FM999G999D00') || ' em ' || to_char(NEW.refunded_at, 'DD/MM/YYYY') || ': ' || coalesce(NEW.refund_reason, '')
        ELSE 'Reembolso desmarcado' END,
      'financeiro', v_ator, v_nome);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.board_finance_audita() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS board_finance_audita ON public.board_finance;
CREATE TRIGGER board_finance_audita
  AFTER INSERT OR UPDATE ON public.board_finance
  FOR EACH ROW EXECUTE FUNCTION public.board_finance_audita();

-- Nota pela tela: só nota, com autor e data do servidor (o resto do histórico vem dos gatilhos acima)
CREATE OR REPLACE FUNCTION public.board_events_preenche()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND pg_trigger_depth() = 1 THEN
    IF NEW.event_type <> 'nota' OR coalesce(char_length(btrim(NEW.note)), 0) NOT BETWEEN 1 AND 4000 THEN
      RAISE EXCEPTION 'Só é possível escrever notas no histórico.' USING ERRCODE = '42501';
    END IF;
    NEW.note := btrim(NEW.note);
    NEW.from_stage := NULL;
    NEW.to_stage := NULL;
    NEW.field_name := NULL;
    NEW.old_value := NULL;
    NEW.new_value := NULL;
    NEW.visibility := 'todos';
    NEW.actor_id := auth.uid();
    NEW.actor_name := (SELECT full_name FROM public.profiles WHERE id = auth.uid());
    NEW.created_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.board_events_preenche() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS board_events_preenche ON public.board_events;
CREATE TRIGGER board_events_preenche
  BEFORE INSERT ON public.board_events
  FOR EACH ROW EXECUTE FUNCTION public.board_events_preenche();

-- Histórico não se altera nem se apaga (nem pelo admin); some junto com a placa (ON DELETE CASCADE só pelo banco)
CREATE OR REPLACE FUNCTION public.board_events_imutavel()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND pg_trigger_depth() = 1 THEN
    RAISE EXCEPTION 'O histórico da placa não pode ser alterado nem apagado.' USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.board_events_imutavel() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS board_events_imutavel ON public.board_events;
CREATE TRIGGER board_events_imutavel
  BEFORE UPDATE OR DELETE ON public.board_events
  FOR EACH ROW EXECUTE FUNCTION public.board_events_imutavel();

-- Foto: autor e etapa vêm do servidor
CREATE OR REPLACE FUNCTION public.board_photos_preenche()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.uploaded_by := auth.uid();
    NEW.uploaded_by_name := (SELECT full_name FROM public.profiles WHERE id = auth.uid());
    NEW.stage_at_capture := (SELECT status FROM public.board_orders WHERE id = NEW.board_order_id);
    NEW.created_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.board_photos_preenche() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS board_photos_preenche ON public.board_photos;
CREATE TRIGGER board_photos_preenche
  BEFORE INSERT ON public.board_photos
  FOR EACH ROW EXECUTE FUNCTION public.board_photos_preenche();

-- ---------------------------------------------------------------------
-- 6. Segurança (RLS): só admin e escritório; financeiro só com a marca
-- ---------------------------------------------------------------------
ALTER TABLE public.board_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_finance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_number_seq ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.board_clients, public.board_orders, public.board_finance, public.board_photos,
              public.board_events, public.board_number_seq FROM anon;

DROP POLICY IF EXISTS "Escritório lê" ON public.board_clients;
DROP POLICY IF EXISTS "Escritório inclui" ON public.board_clients;
DROP POLICY IF EXISTS "Escritório altera" ON public.board_clients;
DROP POLICY IF EXISTS "Escritório exclui" ON public.board_clients;
CREATE POLICY "Escritório lê" ON public.board_clients FOR SELECT TO authenticated USING ((SELECT public.eh_escritorio()));
CREATE POLICY "Escritório inclui" ON public.board_clients FOR INSERT TO authenticated WITH CHECK ((SELECT public.eh_escritorio()));
CREATE POLICY "Escritório altera" ON public.board_clients FOR UPDATE TO authenticated
  USING ((SELECT public.eh_escritorio())) WITH CHECK ((SELECT public.eh_escritorio()));
CREATE POLICY "Escritório exclui" ON public.board_clients FOR DELETE TO authenticated USING ((SELECT public.eh_escritorio()));

DROP POLICY IF EXISTS "Escritório lê" ON public.board_orders;
DROP POLICY IF EXISTS "Escritório inclui" ON public.board_orders;
DROP POLICY IF EXISTS "Escritório altera" ON public.board_orders;
DROP POLICY IF EXISTS "Só admin exclui" ON public.board_orders;
CREATE POLICY "Escritório lê" ON public.board_orders FOR SELECT TO authenticated USING ((SELECT public.eh_escritorio()));
CREATE POLICY "Escritório inclui" ON public.board_orders FOR INSERT TO authenticated WITH CHECK ((SELECT public.eh_escritorio()));
CREATE POLICY "Escritório altera" ON public.board_orders FOR UPDATE TO authenticated
  USING ((SELECT public.eh_escritorio())) WITH CHECK ((SELECT public.eh_escritorio()));
CREATE POLICY "Só admin exclui" ON public.board_orders FOR DELETE TO authenticated USING ((SELECT public.eh_admin()));

DROP POLICY IF EXISTS "Financeiro das placas" ON public.board_finance;
CREATE POLICY "Financeiro das placas" ON public.board_finance FOR ALL TO authenticated
  USING ((SELECT public.tem_financeiro_placas())) WITH CHECK ((SELECT public.tem_financeiro_placas()));

DROP POLICY IF EXISTS "Escritório lê" ON public.board_photos;
DROP POLICY IF EXISTS "Escritório inclui" ON public.board_photos;
DROP POLICY IF EXISTS "Escritório exclui" ON public.board_photos;
CREATE POLICY "Escritório lê" ON public.board_photos FOR SELECT TO authenticated USING ((SELECT public.eh_escritorio()));
CREATE POLICY "Escritório inclui" ON public.board_photos FOR INSERT TO authenticated WITH CHECK ((SELECT public.eh_escritorio()));
CREATE POLICY "Escritório exclui" ON public.board_photos FOR DELETE TO authenticated USING ((SELECT public.eh_escritorio()));

DROP POLICY IF EXISTS "Escritório lê" ON public.board_events;
DROP POLICY IF EXISTS "Escritório anota" ON public.board_events;
CREATE POLICY "Escritório lê" ON public.board_events FOR SELECT TO authenticated
  USING ((SELECT public.eh_escritorio()) AND (visibility <> 'financeiro' OR (SELECT public.tem_financeiro_placas())));
CREATE POLICY "Escritório anota" ON public.board_events FOR INSERT TO authenticated WITH CHECK ((SELECT public.eh_escritorio()));
-- board_number_seq: sem política (só as funções do banco mexem)

-- Tempo real no Kanban
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'board_orders'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.board_orders;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 7. Funções chamadas pela tela
-- ---------------------------------------------------------------------

-- Gerar novo link de acompanhamento (o anterior deixa de valer)
CREATE OR REPLACE FUNCTION public.board_novo_link(p_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_token TEXT := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('board.novo_link', '1', TRUE);
  UPDATE public.board_orders SET public_token = v_token WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Placa não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_token;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.board_novo_link(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.board_novo_link(UUID) TO authenticated;

-- Página pública do parceiro (/placa/<token>): sem login, só o que o cliente pode ver
CREATE OR REPLACE FUNCTION public.placa_acompanhamento(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  b public.board_orders%ROWTYPE;
  v_etapas JSONB;
  v_fotos JSONB;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 THEN
    RETURN NULL;
  END IF;
  SELECT * INTO b FROM public.board_orders WHERE public_token = p_token AND NOT cancelled_entry;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Quando passou por cada etapa (a primeira vez)
  SELECT coalesce(jsonb_object_agg(to_stage, quando), '{}'::jsonb) INTO v_etapas
  FROM (
    SELECT to_stage, min(created_at) AS quando
    FROM public.board_events
    WHERE board_order_id = b.id AND event_type IN ('entrada', 'mudanca_etapa') AND to_stage IS NOT NULL
    GROUP BY to_stage
  ) t;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', f.id, 'category', f.category, 'public_url', f.public_url, 'caption', f.caption, 'created_at', f.created_at
         ) ORDER BY f.created_at), '[]'::jsonb) INTO v_fotos
  FROM public.board_photos f WHERE f.board_order_id = b.id;

  RETURN jsonb_build_object(
    'board_number', b.board_number,
    'equipment_type', b.equipment_type,
    'brand_model', b.brand_model,
    'board_code', b.board_code,
    'status', b.status,
    'created_at', b.created_at,
    'stage_changed_at', b.stage_changed_at,
    'finished_at', b.finished_at,
    'quote_status', b.quote_status,
    'is_warranty', b.is_warranty,
    'reached', v_etapas,
    'photos', v_fotos
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.placa_acompanhamento(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.placa_acompanhamento(TEXT) TO anon, authenticated;

COMMIT;
