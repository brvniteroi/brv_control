-- =====================================================================
-- BRV Control - Schema inicial
-- Clientes, colaboradores, equipamentos instalados, ordens de serviço,
-- atividades (linha do tempo) e anexos (arquivo fica na HostGator; aqui
-- ficam só os metadados e a URL).
--
-- Projeto Supabase NOVO e vazio. Rodar uma única vez:
--   SQL Editor > New query > colar tudo > Run
--   (ou `supabase db push` com a CLI vinculada ao projeto)
-- =====================================================================

-- updated_at automático
CREATE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 1. Perfis de acesso (1:1 com auth.users)
--    admin      -> tudo, inclusive excluir e gerenciar usuários
--    escritorio -> cadastros, OS, linha do tempo
--    tecnico    -> app de campo, só as próprias atividades
-- ---------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'tecnico' CHECK (role IN ('admin', 'escritorio', 'tecnico')),
  active BOOLEAN NOT NULL DEFAULT FALSE,   -- todo usuário novo nasce bloqueado
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cria o perfil automaticamente quando um usuário é criado no Auth
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. Clientes
-- ---------------------------------------------------------------------
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_type TEXT NOT NULL DEFAULT 'PJ' CHECK (person_type IN ('PF', 'PJ')),
  name TEXT NOT NULL,                 -- Razão social / nome completo
  trade_name TEXT,                    -- Nome fantasia
  document TEXT,                      -- CPF/CNPJ sem máscara
  state_registration TEXT,            -- Inscrição estadual
  email TEXT,
  phone TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  field_control_id TEXT UNIQUE,       -- ID de origem no Field Control (migração)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- CPF: 11 dígitos. CNPJ: 12 alfanuméricos + 2 dígitos verificadores
  -- (formato alfanumérico da Receita, válido desde jul/2026).
  CONSTRAINT customers_document_format CHECK (
    document IS NULL
    OR (person_type = 'PF' AND document ~ '^[0-9]{11}$')
    OR (person_type = 'PJ' AND document ~ '^[0-9A-Z]{12}[0-9]{2}$')
  )
);
CREATE UNIQUE INDEX customers_document_key ON public.customers (document) WHERE document IS NOT NULL;

-- Contatos (síndico, zelador, gerente da loja...)
CREATE TABLE public.customer_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,                          -- Cargo / função
  phone TEXT,
  is_whatsapp BOOLEAN NOT NULL DEFAULT TRUE,
  email TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX customer_contacts_customer_idx ON public.customer_contacts (customer_id);
CREATE UNIQUE INDEX customer_contacts_one_primary ON public.customer_contacts (customer_id) WHERE is_primary;

-- Endereços (matriz, filiais, obras)
CREATE TABLE public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  label TEXT,                         -- Ex.: 'Matriz', 'Loja Icaraí'
  zip_code TEXT,
  street TEXT NOT NULL,
  number TEXT,
  complement TEXT,
  district TEXT,
  city TEXT NOT NULL DEFAULT 'Niterói',
  state CHAR(2) NOT NULL DEFAULT 'RJ',
  reference TEXT,                     -- Ponto de referência para o técnico
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  field_control_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Alvo das FKs compostas: garante que o endereço é do mesmo cliente
  CONSTRAINT customer_addresses_id_customer_key UNIQUE (id, customer_id)
);
CREATE INDEX customer_addresses_customer_idx ON public.customer_addresses (customer_id);
CREATE UNIQUE INDEX customer_addresses_one_primary ON public.customer_addresses (customer_id) WHERE is_primary;

-- ---------------------------------------------------------------------
-- 3. Colaboradores (técnicos, auxiliares, supervisores)
--    Nem todo colaborador tem login (ex.: auxiliar): profile_id é opcional.
-- ---------------------------------------------------------------------
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'tecnico'
    CHECK (role IN ('tecnico', 'auxiliar', 'supervisor', 'administrativo')),
  phone TEXT,
  email TEXT,
  timeline_color TEXT NOT NULL DEFAULT '#2563EB' CHECK (timeline_color ~ '^#[0-9A-Fa-f]{6}$'),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  field_control_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 4. Equipamentos / ativos instalados no cliente
-- ---------------------------------------------------------------------
CREATE TABLE public.equipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  address_id UUID,
  category TEXT NOT NULL,             -- Ex.: 'Split Hi-Wall', 'Cassete', 'VRF', 'Quadro Elétrico'
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  capacity_btu INTEGER CHECK (capacity_btu > 0),
  voltage TEXT,                       -- '127V', '220V', '380V'
  refrigerant TEXT,                   -- 'R-410A', 'R-32', 'R-22'
  location TEXT,                      -- Ex.: 'Sala de reunião - 2º andar'
  installed_at DATE,
  warranty_until DATE,
  qr_code TEXT UNIQUE,                -- Etiqueta patrimonial / PMOC
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  field_control_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT equipments_address_fk FOREIGN KEY (address_id, customer_id)
    REFERENCES public.customer_addresses (id, customer_id) ON DELETE RESTRICT
);
CREATE INDEX equipments_customer_idx ON public.equipments (customer_id);

-- ---------------------------------------------------------------------
-- 5. Ordens de serviço
-- ---------------------------------------------------------------------
CREATE TABLE public.service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Número exibido para equipe/cliente. BY DEFAULT permite importar os
  -- números do Field Control; depois da importação ajuste a sequência:
  --   SELECT setval(pg_get_serial_sequence('public.service_orders', 'number'),
  --                 (SELECT MAX(number) FROM public.service_orders));
  number BIGINT GENERATED BY DEFAULT AS IDENTITY UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  address_id UUID,
  contact_id UUID REFERENCES public.customer_contacts(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN (
    'instalacao', 'manutencao_preventiva', 'manutencao_corretiva',
    'visita_tecnica', 'orcamento', 'pmoc', 'eletrica', 'outros'
  )),
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN (
    'aberta', 'agendada', 'em_andamento', 'pausada', 'concluida', 'cancelada'
  )),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('baixa', 'normal', 'alta', 'urgente')),
  description TEXT,                   -- Solicitação do cliente
  internal_notes TEXT,                -- Uso do escritório (ver obs. no RLS)
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_by UUID DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  field_control_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_orders_address_fk FOREIGN KEY (address_id, customer_id)
    REFERENCES public.customer_addresses (id, customer_id) ON DELETE RESTRICT
);
CREATE INDEX service_orders_customer_idx ON public.service_orders (customer_id);
CREATE INDEX service_orders_status_idx ON public.service_orders (status);

-- Equipamentos atendidos em cada OS (forma o histórico do ativo)
CREATE TABLE public.service_order_equipments (
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE RESTRICT,
  service_performed TEXT,             -- O que foi feito neste equipamento
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (service_order_id, equipment_id)
);
CREATE INDEX service_order_equipments_equipment_idx ON public.service_order_equipments (equipment_id);

-- ---------------------------------------------------------------------
-- 6. Atividades (cards da linha do tempo)
--    employee_id NULL = atividade ainda sem técnico (coluna "A distribuir").
-- ---------------------------------------------------------------------
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN (
    'pendente', 'agendada', 'em_deslocamento', 'em_execucao',
    'pausada', 'concluida', 'cancelada'
  )),
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  started_at TIMESTAMPTZ,             -- Check-in real do técnico
  finished_at TIMESTAMPTZ,            -- Check-out real do técnico
  checkin_lat NUMERIC(9, 6),
  checkin_lng NUMERIC(9, 6),
  checkout_lat NUMERIC(9, 6),
  checkout_lng NUMERIC(9, 6),
  technician_notes TEXT,              -- Relato do técnico em campo
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tasks_schedule_valid CHECK (
    (scheduled_start IS NULL AND scheduled_end IS NULL)
    OR (scheduled_start IS NOT NULL AND scheduled_end > scheduled_start)
  ),
  CONSTRAINT tasks_execution_valid CHECK (
    finished_at IS NULL OR (started_at IS NOT NULL AND finished_at >= started_at)
  ),
  CONSTRAINT tasks_scheduled_needs_slot CHECK (
    status <> 'agendada' OR (employee_id IS NOT NULL AND scheduled_start IS NOT NULL)
  )
);
CREATE INDEX tasks_service_order_idx ON public.tasks (service_order_id);
-- Consulta da linha do tempo: atividades de um dia, agrupadas por técnico
CREATE INDEX tasks_timeline_idx ON public.tasks (scheduled_start, employee_id);
CREATE INDEX tasks_employee_idx ON public.tasks (employee_id, scheduled_start);

-- ---------------------------------------------------------------------
-- 7. Anexos (fotos de campo). O arquivo fica na HostGator (hostgator-api/upload.php).
-- ---------------------------------------------------------------------
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID REFERENCES public.service_orders(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES public.equipments(id) ON DELETE SET NULL,
  storage TEXT NOT NULL DEFAULT 'hostgator' CHECK (storage IN ('hostgator', 'supabase')),
  storage_path TEXT NOT NULL UNIQUE,  -- Relativo à pasta de uploads: '2026/10/<aleatório>.webp'
  public_url TEXT NOT NULL,
  file_name TEXT,                     -- Nome original no aparelho
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  width INTEGER,
  height INTEGER,
  category TEXT NOT NULL DEFAULT 'outros' CHECK (category IN (
    'antes', 'depois', 'placa_equipamento', 'assinatura', 'documento', 'outros'
  )),
  caption TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attachments_has_owner CHECK (num_nonnulls(service_order_id, task_id, equipment_id) >= 1)
);
CREATE INDEX attachments_service_order_idx ON public.attachments (service_order_id);
CREATE INDEX attachments_task_idx ON public.attachments (task_id);
CREATE INDEX attachments_equipment_idx ON public.attachments (equipment_id);

-- Anexo de atividade herda a OS da atividade; autor vem do login (anti-falsificação)
CREATE FUNCTION public.attachments_preenche()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.task_id IS NOT NULL THEN
    SELECT service_order_id INTO NEW.service_order_id FROM public.tasks WHERE id = NEW.task_id;
  END IF;
  NEW.uploaded_by := auth.uid();
  NEW.created_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER attachments_preenche
  BEFORE INSERT ON public.attachments
  FOR EACH ROW EXECUTE FUNCTION public.attachments_preenche();

-- Triggers de updated_at
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles', 'customers', 'customer_addresses', 'employees',
                           'equipments', 'service_orders', 'tasks'] LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

-- =====================================================================
-- 8. Funções de acesso (SECURITY DEFINER evita recursão de RLS)
-- =====================================================================
CREATE FUNCTION public.eh_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND active AND role = 'admin');
$$;

CREATE FUNCTION public.eh_escritorio()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND active AND role IN ('admin', 'escritorio')
  );
$$;

-- Colaborador vinculado ao login atual (NULL se não for técnico ativo)
CREATE FUNCTION public.meu_colaborador_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT e.id
  FROM public.employees e
  JOIN public.profiles p ON p.id = e.profile_id
  WHERE e.profile_id = auth.uid() AND e.active AND p.active AND p.role = 'tecnico';
$$;

-- OS em que o técnico logado tem alguma atividade não cancelada
CREATE FUNCTION public.minhas_os()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT DISTINCT t.service_order_id
  FROM public.tasks t
  WHERE t.employee_id = public.meu_colaborador_id()
    AND t.status <> 'cancelada';
$$;

-- Clientes dessas OS
CREATE FUNCTION public.meus_clientes()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT DISTINCT so.customer_id
  FROM public.service_orders so
  WHERE so.id IN (SELECT public.minhas_os());
$$;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY['eh_admin()', 'eh_escritorio()', 'meu_colaborador_id()',
                           'minhas_os()', 'meus_clientes()'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- Técnico só altera a execução da própria atividade (status, check-in/out,
-- relato). Reagendar, trocar de técnico ou cancelar é tarefa do escritório.
CREATE FUNCTION public.tasks_protege_agenda()
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
       OR (NEW.status = 'cancelada' AND OLD.status <> 'cancelada') THEN
      RAISE EXCEPTION 'Somente o escritório pode reagendar, reatribuir ou cancelar atividades'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_protege_agenda
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_protege_agenda();

-- =====================================================================
-- 9. Row Level Security
-- =====================================================================

-- Perfis: cada um lê o próprio; escritório lê todos (nomes na tela);
-- só admin altera (impede alguém de se promover ou se reativar).
-- Inclusão é pelo trigger do Auth; exclusão é excluir o usuário no Auth.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM anon;

CREATE POLICY "Usuário lê o próprio perfil" ON public.profiles
  FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));
CREATE POLICY "Escritório lê os perfis" ON public.profiles
  FOR SELECT TO authenticated USING ((SELECT public.eh_escritorio()));
CREATE POLICY "Admin altera perfis" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT public.eh_admin())) WITH CHECK ((SELECT public.eh_admin()));

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers', 'customer_contacts', 'customer_addresses', 'employees',
                           'equipments', 'service_orders', 'service_order_equipments',
                           'tasks', 'attachments'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    -- Escritório: acesso total
    EXECUTE format('CREATE POLICY "Escritório gerencia" ON public.%I FOR ALL TO authenticated
                    USING ((SELECT public.eh_escritorio()))
                    WITH CHECK ((SELECT public.eh_escritorio()))', t);
  END LOOP;

  -- Excluir cadastro principal ou OS: só admin. RESTRICTIVE = soma-se (AND)
  -- às políticas acima; as demais exclusões seguem livres para o escritório.
  FOREACH t IN ARRAY ARRAY['customers', 'employees', 'equipments', 'service_orders'] LOOP
    EXECUTE format('CREATE POLICY "Só admin exclui" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated
                    USING ((SELECT public.eh_admin()))', t);
  END LOOP;
END $$;

-- Técnico: enxerga só o que está ligado às próprias atividades

CREATE POLICY "Técnico lê o próprio cadastro" ON public.employees
  FOR SELECT TO authenticated
  USING (id = (SELECT public.meu_colaborador_id()));

CREATE POLICY "Técnico lê as próprias atividades" ON public.tasks
  FOR SELECT TO authenticated
  USING (employee_id = (SELECT public.meu_colaborador_id()));

CREATE POLICY "Técnico executa as próprias atividades" ON public.tasks
  FOR UPDATE TO authenticated
  USING (employee_id = (SELECT public.meu_colaborador_id()))
  WITH CHECK (employee_id = (SELECT public.meu_colaborador_id()));

-- Obs.: RLS filtra linhas, não colunas. internal_notes chega ao técnico se o
-- app fizer select('*'); para esconder de verdade, mover para tabela própria
-- ou expor ao app de campo uma view sem a coluna.
CREATE POLICY "Técnico lê as próprias OS" ON public.service_orders
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.minhas_os()));

CREATE POLICY "Técnico lê clientes das próprias OS" ON public.customers
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.meus_clientes()));

CREATE POLICY "Técnico lê contatos dos próprios clientes" ON public.customer_contacts
  FOR SELECT TO authenticated
  USING (customer_id IN (SELECT public.meus_clientes()));

CREATE POLICY "Técnico lê endereços dos próprios clientes" ON public.customer_addresses
  FOR SELECT TO authenticated
  USING (customer_id IN (SELECT public.meus_clientes()));

-- Em campo o técnico costuma achar equipamento não cadastrado: pode incluir
CREATE POLICY "Técnico lê equipamentos dos próprios clientes" ON public.equipments
  FOR SELECT TO authenticated
  USING (customer_id IN (SELECT public.meus_clientes()));
CREATE POLICY "Técnico cadastra equipamento nos próprios clientes" ON public.equipments
  FOR INSERT TO authenticated
  WITH CHECK (customer_id IN (SELECT public.meus_clientes()));

CREATE POLICY "Técnico lê equipamentos das próprias OS" ON public.service_order_equipments
  FOR SELECT TO authenticated
  USING (service_order_id IN (SELECT public.minhas_os()));
CREATE POLICY "Técnico vincula equipamento às próprias OS" ON public.service_order_equipments
  FOR INSERT TO authenticated
  WITH CHECK (service_order_id IN (SELECT public.minhas_os()));
CREATE POLICY "Técnico registra serviço nas próprias OS" ON public.service_order_equipments
  FOR UPDATE TO authenticated
  USING (service_order_id IN (SELECT public.minhas_os()))
  WITH CHECK (service_order_id IN (SELECT public.minhas_os()));

-- Anexos: o técnico envia e vê fotos das próprias OS, mas não apaga
CREATE POLICY "Técnico lê anexos das próprias OS" ON public.attachments
  FOR SELECT TO authenticated
  USING (service_order_id IN (SELECT public.minhas_os()));
CREATE POLICY "Técnico anexa nas próprias OS" ON public.attachments
  FOR INSERT TO authenticated
  WITH CHECK (service_order_id IN (SELECT public.minhas_os()));

-- =====================================================================
-- 10. Realtime (WebSockets): linha do tempo do escritório e app dos técnicos.
--     O Realtime respeita o RLS acima: cada técnico só recebe eventos das
--     próprias atividades. Com RLS ativo, o "old" de UPDATE/DELETE traz só o
--     id, então o front localiza o card pelo id (ver useRealtimeTable).
-- =====================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_orders, public.tasks, public.attachments;

-- =====================================================================
-- PRIMEIRO ACESSO (depois de rodar este arquivo)
--   1. Authentication > Users > "Add user" com o seu e-mail
--   2. UPDATE public.profiles SET active = TRUE, role = 'admin', full_name = 'Seu Nome'
--      WHERE email = 'seu@email.com';
--
-- CADASTRAR UM TÉCNICO COM LOGIN
--   1. Criar o usuário em Authentication > Users (o perfil nasce bloqueado)
--   2. UPDATE public.profiles SET active = TRUE, role = 'tecnico'
--      WHERE email = 'tecnico@exemplo.com';
--   3. INSERT INTO public.employees (profile_id, name, timeline_color)
--      SELECT id, full_name, '#16A34A' FROM public.profiles
--      WHERE email = 'tecnico@exemplo.com';
-- =====================================================================
