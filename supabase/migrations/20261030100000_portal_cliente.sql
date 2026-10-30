-- =====================================================================
-- Portal do Cliente: o cliente final entra com login próprio (perfil 'cliente'),
-- vê só os dados do próprio cadastro, abre chamados e baixa laudos.
--
-- Segurança: o perfil 'cliente' NÃO tem política em nenhuma tabela operacional
-- (customers, service_orders, tasks...), então não lê nada direto. O acesso é por
-- funções (security definer) que filtram pelo cliente vinculado ao login, e assim
-- campos internos (internal_notes etc.) nunca saem. As únicas exceções são laudos
-- preenchidos e fotos de OS já concluídas do próprio cliente (para exibir o laudo).
--
-- Rodar no SQL Editor (ou `supabase db push`). Não altera dados existentes.
-- =====================================================================

-- 1. Novo papel
ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'escritorio', 'tecnico', 'cliente'));

-- 2. Ligação login <-> cliente (um login atende um cliente; um cliente pode ter vários logins)
CREATE TABLE public.customer_users (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX customer_users_customer_idx ON public.customer_users (customer_id);

ALTER TABLE public.customer_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_users FROM anon;
CREATE POLICY "Escritório gerencia" ON public.customer_users FOR ALL TO authenticated
  USING ((SELECT public.eh_escritorio()))
  WITH CHECK ((SELECT public.eh_escritorio()));
CREATE POLICY "Cliente lê o próprio vínculo" ON public.customer_users FOR SELECT TO authenticated
  USING (profile_id = (SELECT auth.uid()));

-- 3. Cliente do login atual (NULL se não for um cliente ativo)
CREATE FUNCTION public.meu_cliente_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT cu.customer_id
  FROM public.customer_users cu
  JOIN public.profiles p ON p.id = cu.profile_id
  JOIN public.customers c ON c.id = cu.customer_id
  WHERE cu.profile_id = auth.uid() AND p.active AND p.role = 'cliente' AND c.active;
$$;

-- OS concluídas do cliente logado (laudos e fotos só aparecem depois da conclusão)
CREATE FUNCTION public.portal_os_concluidas()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT so.id FROM public.service_orders so
  WHERE so.customer_id = public.meu_cliente_id() AND so.status = 'concluida';
$$;

CREATE POLICY "Cliente lê laudos preenchidos das OS concluídas" ON public.form_responses
  FOR SELECT TO authenticated
  USING (status = 'preenchido' AND service_order_id IN (SELECT public.portal_os_concluidas()));

CREATE POLICY "Cliente lê fotos das OS concluídas" ON public.attachments
  FOR SELECT TO authenticated
  USING (service_order_id IN (SELECT public.portal_os_concluidas()));

-- 4. Dados do portal ---------------------------------------------------

CREATE FUNCTION public.portal_meu_cliente()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE r JSONB;
BEGIN
  SELECT jsonb_build_object('id', c.id, 'name', c.name, 'trade_name', c.trade_name)
    INTO r FROM public.customers c WHERE c.id = public.meu_cliente_id();
  RETURN r;  -- NULL: login sem cliente vinculado
END;
$$;

-- Chamados (OS) do cliente, com a próxima visita e os equipamentos atendidos
CREATE FUNCTION public.portal_chamados()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE cid UUID := public.meu_cliente_id();
BEGIN
  IF cid IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(s.o ORDER BY s.num DESC)
    FROM (
      SELECT so.number AS num,
        jsonb_build_object(
          'id', so.id,
          'number', so.number,
          'status', so.status,
          'priority', so.priority,
          'description', so.description,
          'opened_at', so.opened_at,
          'completed_at', so.completed_at,
          'tipo', st.name,
          'endereco', NULLIF(concat_ws(', ', ca.street, ca.number, ca.district), ''),
          'proxima_visita', (
            SELECT MIN(t.scheduled_start) FROM public.tasks t
            WHERE t.service_order_id = so.id AND t.scheduled_start IS NOT NULL
              AND t.status NOT IN ('cancelada', 'concluida')
          ),
          'equipamentos', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', e.id,
              'nome', concat_ws(' ', e.category, e.brand, e.model),
              'local', e.location,
              'servico', soe.service_performed))
            FROM public.service_order_equipments soe
            JOIN public.equipments e ON e.id = soe.equipment_id
            WHERE soe.service_order_id = so.id
          ), '[]'::jsonb)
        ) AS o
      FROM public.service_orders so
      JOIN public.service_types st ON st.id = so.service_type_id
      LEFT JOIN public.customer_addresses ca ON ca.id = so.address_id
      WHERE so.customer_id = cid
      ORDER BY so.number DESC
      LIMIT 200
    ) s
  ), '[]'::jsonb);
END;
$$;

-- Listas do formulário "Abrir novo chamado"
CREATE FUNCTION public.portal_opcoes_chamado()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE cid UUID := public.meu_cliente_id();
BEGIN
  IF cid IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'tipos', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY name)
                         FROM public.service_types WHERE active), '[]'::jsonb),
    'enderecos', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                    'id', a.id,
                    'nome', concat_ws(' — ', a.label, NULLIF(concat_ws(', ', a.street, a.number, a.district), '')))
                    ORDER BY a.is_primary DESC, a.created_at)
                  FROM public.customer_addresses a WHERE a.customer_id = cid AND a.active), '[]'::jsonb),
    'equipamentos', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                    'id', e.id,
                    'nome', concat_ws(' ', e.category, e.brand, e.model),
                    'local', e.location)
                    ORDER BY e.category, e.location)
                  FROM public.equipments e WHERE e.customer_id = cid AND e.active), '[]'::jsonb)
  );
END;
$$;

-- Abre a OS (status 'aberta'); o escritório vê na hora e agenda. Devolve o número.
CREATE FUNCTION public.portal_abrir_chamado(
  p_tipo UUID,
  p_descricao TEXT,
  p_endereco UUID DEFAULT NULL,
  p_equipamento UUID DEFAULT NULL,
  p_urgente BOOLEAN DEFAULT FALSE
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  cid UUID := public.meu_cliente_id();
  nova UUID;
  numero BIGINT;
BEGIN
  IF cid IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_descricao, ''))) < 5 THEN
    RAISE EXCEPTION 'Descreva o que precisa ser feito.';
  END IF;
  IF length(p_descricao) > 2000 THEN
    RAISE EXCEPTION 'A descrição está muito longa (máximo de 2000 caracteres).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.service_types WHERE id = p_tipo AND active) THEN
    RAISE EXCEPTION 'Escolha o tipo de serviço.';
  END IF;
  IF p_endereco IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.customer_addresses WHERE id = p_endereco AND customer_id = cid AND active
  ) THEN
    RAISE EXCEPTION 'Endereço inválido.';
  END IF;
  IF p_equipamento IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.equipments WHERE id = p_equipamento AND customer_id = cid
  ) THEN
    RAISE EXCEPTION 'Equipamento inválido.';
  END IF;
  -- Freio contra abuso: no máximo 5 chamados por hora por login
  IF (SELECT count(*) FROM public.service_orders
       WHERE created_by = auth.uid() AND created_at > NOW() - INTERVAL '1 hour') >= 5 THEN
    RAISE EXCEPTION 'Muitos chamados em pouco tempo. Aguarde um pouco ou ligue para a BRV.';
  END IF;

  INSERT INTO public.service_orders
    (customer_id, address_id, service_type_id, status, priority, description, internal_notes)
  VALUES
    (cid, p_endereco, p_tipo, 'aberta', CASE WHEN p_urgente THEN 'alta' ELSE 'normal' END,
     trim(p_descricao), 'Aberto pelo Portal do Cliente')
  RETURNING id, number INTO nova, numero;

  IF p_equipamento IS NOT NULL THEN
    INSERT INTO public.service_order_equipments (service_order_id, equipment_id) VALUES (nova, p_equipamento);
  END IF;
  RETURN numero;
END;
$$;

-- Laudos disponíveis: formulários preenchidos de OS concluídas
CREATE FUNCTION public.portal_documentos()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE cid UUID := public.meu_cliente_id();
BEGIN
  IF cid IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(d.o ORDER BY d.quando DESC NULLS LAST)
    FROM (
      SELECT fr.filled_at AS quando,
        jsonb_build_object(
          'id', fr.id,
          'nome', fr.template_name,
          'filled_at', fr.filled_at,
          'os_numero', so.number,
          'equipamento', NULLIF(concat_ws(' ', e.category, e.brand, e.model), '')
        ) AS o
      FROM public.form_responses fr
      JOIN public.service_orders so ON so.id = fr.service_order_id
      LEFT JOIN public.equipments e ON e.id = fr.equipment_id
      WHERE so.customer_id = cid AND so.status = 'concluida' AND fr.status = 'preenchido'
      ORDER BY fr.filled_at DESC NULLS LAST
      LIMIT 200
    ) d
  ), '[]'::jsonb);
END;
$$;

-- 5. Liberar o acesso de um cliente (admin, ou SQL Editor)
--    Primeiro crie o usuário em Authentication > Users; depois:
--      SELECT public.liberar_portal_cliente('email@do.cliente', '<id do cliente>');
CREATE FUNCTION public.liberar_portal_cliente(p_email TEXT, p_customer_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE perfil public.profiles;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.eh_admin() THEN
    RAISE EXCEPTION 'Somente administrador' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO perfil FROM public.profiles WHERE lower(email) = lower(trim(p_email));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado: crie-o antes em Authentication > Users.';
  END IF;
  IF perfil.role IN ('admin', 'escritorio') THEN
    RAISE EXCEPTION 'Este e-mail é de um usuário da equipe, não pode virar cliente.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id) THEN
    RAISE EXCEPTION 'Cliente não encontrado.';
  END IF;
  UPDATE public.profiles SET role = 'cliente', active = TRUE WHERE id = perfil.id;
  INSERT INTO public.customer_users (profile_id, customer_id) VALUES (perfil.id, p_customer_id)
    ON CONFLICT (profile_id) DO UPDATE SET customer_id = EXCLUDED.customer_id;
END;
$$;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'meu_cliente_id()', 'portal_os_concluidas()', 'portal_meu_cliente()', 'portal_chamados()',
    'portal_opcoes_chamado()', 'portal_abrir_chamado(uuid, text, uuid, uuid, boolean)',
    'portal_documentos()', 'liberar_portal_cliente(text, uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
