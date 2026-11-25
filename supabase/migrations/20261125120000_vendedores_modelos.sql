-- =====================================================================
-- Vendas: vendedores e modelos de orçamento (2026-11-25, pedido do Braulio).
--
--   * Só VENDEDOR (e o admin) entra em Vendas, Orçamentos e Catálogo. Vendedor = profiles.sales_access,
--     marcado pelo admin na tela /vendas/vendedores, com nível financeiro caixa ou completo.
--     O nome que sai no orçamento é o do funcionário ligado ao login (criado aqui se não existir).
--   * Modelos de orçamento: listas prontas de itens do catálogo ("Instalação split 9.000"). Ao aplicar,
--     o preço é o do catálogo no momento e a quantidade fica em branco (salvo a sugerida, ex.: mão de obra).
--
-- Rodar DEPOIS de 20261125100000 e 20261125110000. Colar no SQL Editor do projeto BRV Control.
-- =====================================================================
BEGIN;

-- ---------------------------------------------------------------------
-- 1. Quem é vendedor
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sales_access BOOLEAN NOT NULL DEFAULT FALSE;

-- Admin sempre acessa; escritório, só se for vendedor
CREATE OR REPLACE FUNCTION public.pode_vender()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid() AND active AND (role = 'admin' OR (role = 'escritorio' AND sales_access))
  );
$$;
REVOKE EXECUTE ON FUNCTION public.pode_vender() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_vender() TO authenticated;

-- Só o admin muda quem vende e o nível financeiro (scripts com service_role passam)
CREATE OR REPLACE FUNCTION public.profiles_protege_acesso_financeiro()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF (NEW.financial_access IS DISTINCT FROM OLD.financial_access OR NEW.sales_access IS DISTINCT FROM OLD.sales_access)
     AND auth.uid() IS NOT NULL
     AND NOT public.eh_admin() THEN
    RAISE EXCEPTION 'Só o administrador muda o acesso às vendas e ao financeiro.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_protege_acesso_financeiro ON public.profiles;
CREATE TRIGGER profiles_protege_acesso_financeiro
  BEFORE UPDATE OF financial_access, sales_access ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_protege_acesso_financeiro();

-- Funções de orçamento e venda: onde pediam "escritório", passam a pedir "vendedor".
-- A troca é feita no texto da função que está no banco, para não repetir aqui as 18 funções inteiras.
DO $$
DECLARE
  f RECORD;
  v_trocadas INTEGER := 0;
BEGIN
  FOR f IN
    SELECT p.oid, pg_get_functiondef(p.oid) AS texto
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         'orcamento_anotar', 'orcamento_buscar', 'orcamento_duplicar', 'orcamento_excluir', 'orcamento_gerar_os',
         'orcamento_novo_link', 'orcamento_reabrir', 'orcamento_registrar_envio', 'orcamento_registrar_resposta',
         'orcamento_salvar', 'orcamentos_listar',
         'venda_buscar', 'venda_cancelar', 'venda_cancelar_nota', 'venda_concluir', 'venda_receber',
         'venda_registrar_nota', 'vendas_listar')
  LOOP
    EXECUTE replace(f.texto, 'public.eh_escritorio()', 'public.pode_vender()');
    v_trocadas := v_trocadas + 1;
  END LOOP;
  IF v_trocadas <> 18 THEN
    RAISE EXCEPTION 'Esperava 18 funções de orçamento e venda, achei %.', v_trocadas;
  END IF;
END $$;

-- Leitura e escrita das tabelas
ALTER POLICY "Escritório lê" ON public.catalog_items USING ((SELECT public.pode_vender()));
ALTER POLICY "Escritório cadastra" ON public.catalog_items WITH CHECK ((SELECT public.pode_vender()));
ALTER POLICY "Escritório altera" ON public.catalog_items
  USING ((SELECT public.pode_vender())) WITH CHECK ((SELECT public.pode_vender()));
ALTER POLICY "Escritório gerencia" ON public.quote_texts
  USING ((SELECT public.pode_vender())) WITH CHECK ((SELECT public.pode_vender()));
ALTER POLICY "Escritório lê" ON public.quotes USING ((SELECT public.pode_vender()));
ALTER POLICY "Escritório lê" ON public.quote_items USING ((SELECT public.pode_vender()));
ALTER POLICY "Escritório lê" ON public.quote_events USING ((SELECT public.pode_vender()));
ALTER POLICY "Escritório lê" ON public.sales USING ((SELECT public.pode_vender()));
ALTER POLICY "Escritório lê" ON public.sale_items USING ((SELECT public.pode_vender()));
ALTER POLICY "Escritório lê" ON public.sale_payments USING ((SELECT public.pode_vender()));
ALTER POLICY "Escritório lê" ON public.sale_documents USING ((SELECT public.pode_vender()));
ALTER POLICY "Escritório lê" ON public.sale_events USING ((SELECT public.pode_vender()));

-- ---------------------------------------------------------------------
-- 2. Cadastro de vendedores (tela /vendas/vendedores, só admin)
-- ---------------------------------------------------------------------
-- Funcionário ligado ao login; se não houver, aproveita um sem login com o mesmo nome ou cria (administrativo)
CREATE OR REPLACE FUNCTION public.vendedor_funcionario(p_profile UUID, p_nome TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_id UUID;
  v_ativo BOOLEAN;
  v_nome TEXT := btrim(coalesce(p_nome, ''));
BEGIN
  SELECT e.id, e.active INTO v_id, v_ativo FROM public.employees e WHERE e.profile_id = p_profile;
  IF FOUND THEN
    IF NOT v_ativo THEN
      RAISE EXCEPTION 'O funcionário ligado a este login está inativo. Reative-o em Equipe.' USING ERRCODE = '23514';
    END IF;
    RETURN v_id;
  END IF;
  IF v_nome = '' THEN
    SELECT p.full_name INTO v_nome FROM public.profiles p WHERE p.id = p_profile;
  END IF;
  SELECT e.id INTO v_id FROM public.employees e
   WHERE e.profile_id IS NULL AND e.active AND public.sem_acento(e.name) = public.sem_acento(v_nome)
   ORDER BY e.created_at LIMIT 1;
  IF v_id IS NOT NULL THEN
    UPDATE public.employees SET profile_id = p_profile WHERE id = v_id;
  ELSE
    INSERT INTO public.employees (profile_id, name, role) VALUES (p_profile, v_nome, 'administrativo')
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.vendedor_funcionario(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- Logins que podem ser vendedores (admin e escritório)
CREATE OR REPLACE FUNCTION public.vendedores_cadastro()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.eh_admin() THEN
    RAISE EXCEPTION 'Só o administrador cadastra vendedores.' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'profile_id', p.id, 'full_name', p.full_name, 'email', p.email, 'role', p.role, 'active', p.active,
             'sales_access', p.sales_access, 'financial_access', p.financial_access,
             'employee_id', e.id, 'seller_name', e.name, 'employee_active', e.active)
           ORDER BY p.active DESC, public.sem_acento(p.full_name))
      FROM public.profiles p
      LEFT JOIN public.employees e ON e.profile_id = p.id
     WHERE p.role IN ('admin', 'escritorio')), '[]'::jsonb);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.vendedores_cadastro() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendedores_cadastro() TO authenticated;

CREATE OR REPLACE FUNCTION public.vendedor_salvar(p_profile UUID, p_vende BOOLEAN, p_nivel TEXT DEFAULT NULL, p_nome TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_papel TEXT;
BEGIN
  IF NOT public.eh_admin() THEN
    RAISE EXCEPTION 'Só o administrador cadastra vendedores.' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO v_papel FROM public.profiles WHERE id = p_profile FOR UPDATE;
  IF NOT FOUND OR v_papel NOT IN ('admin', 'escritorio') THEN
    RAISE EXCEPTION 'Só login de administrador ou de escritório pode ser vendedor.' USING ERRCODE = '23514';
  END IF;
  IF coalesce(p_vende, FALSE) THEN
    IF v_papel = 'escritorio' AND coalesce(p_nivel, '') NOT IN ('caixa', 'completo') THEN
      RAISE EXCEPTION 'Escolha o nível do vendedor: caixa ou completo.' USING ERRCODE = '23514';
    END IF;
    PERFORM public.vendedor_funcionario(p_profile, p_nome);
  END IF;
  -- O admin é sempre "completo" (nivel_financeiro); o campo dele não muda
  UPDATE public.profiles SET
    sales_access = coalesce(p_vende, FALSE),
    financial_access = CASE WHEN v_papel = 'admin' THEN financial_access
                            WHEN coalesce(p_vende, FALSE) THEN p_nivel
                            ELSE 'nenhum' END
  WHERE id = p_profile;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.vendedor_salvar(UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendedor_salvar(UUID, BOOLEAN, TEXT, TEXT) TO authenticated;

-- Lista do campo "Vendedor(a)" no orçamento e na venda
CREATE OR REPLACE FUNCTION public.vendas_vendedores()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.pode_vender() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'role', e.role)
                     ORDER BY (p.id = auth.uid()) DESC, public.sem_acento(e.name))
      FROM public.employees e
      JOIN public.profiles p ON p.id = e.profile_id
     WHERE e.active AND p.active AND p.sales_access AND p.role IN ('admin', 'escritorio')), '[]'::jsonb);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.vendas_vendedores() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendas_vendedores() TO authenticated;

-- Primeiros vendedores (decisão do Braulio, 2026-11-25). Só na primeira vez; depois vale o que estiver na tela.
DO $$
DECLARE r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE sales_access) THEN
    RETURN;
  END IF;
  FOR r IN
    SELECT p.id, x.nome, x.nivel
      FROM public.profiles p
      JOIN (VALUES
        -- "Braulio" sem o sobrenome: "Braulio Rodrigues Valente" é o técnico das placas (reconhecido pelo nome)
        ('braulio valente', 'Braulio', 'completo'),
        ('jessica moura', 'Jéssica Moura', 'caixa'),
        ('pedro lobo valente', 'Pedro Lobo Valente', 'caixa')
      ) AS x(chave, nome, nivel) ON public.sem_acento(btrim(p.full_name)) = x.chave
     WHERE p.role = 'escritorio' AND p.active
  LOOP
    PERFORM public.vendedor_funcionario(r.id, r.nome);
    UPDATE public.profiles SET sales_access = TRUE, financial_access = r.nivel WHERE id = r.id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 3. Modelos de orçamento
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS quote_templates_nome_key ON public.quote_templates (lower(btrim(name)));
DROP TRIGGER IF EXISTS set_updated_at ON public.quote_templates;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.quote_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.quote_template_items (
  template_id UUID NOT NULL REFERENCES public.quote_templates(id) ON DELETE CASCADE,
  catalog_item_id UUID NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  suggested_quantity NUMERIC(14,3) CHECK (suggested_quantity IS NULL OR suggested_quantity > 0),  -- NULL = em branco
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (template_id, catalog_item_id)
);

ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_template_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_templates, public.quote_template_items FROM anon;
-- Gravação só por modelo_salvar; a tela lê e pode excluir
DROP POLICY IF EXISTS "Vendedores leem" ON public.quote_templates;
CREATE POLICY "Vendedores leem" ON public.quote_templates FOR SELECT TO authenticated USING ((SELECT public.pode_vender()));
DROP POLICY IF EXISTS "Vendedores excluem" ON public.quote_templates;
CREATE POLICY "Vendedores excluem" ON public.quote_templates FOR DELETE TO authenticated USING ((SELECT public.pode_vender()));
DROP POLICY IF EXISTS "Vendedores leem" ON public.quote_template_items;
CREATE POLICY "Vendedores leem" ON public.quote_template_items FOR SELECT TO authenticated USING ((SELECT public.pode_vender()));

-- p = { name, replace, items: [{ catalog_item_id, quantity | null }] }. Nome repetido só grava com replace.
CREATE OR REPLACE FUNCTION public.modelo_salvar(p JSONB)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_nome TEXT := btrim(coalesce(p->>'name', ''));
  v_id UUID;
  v_item JSONB; v_ordem BIGINT;
  v_qtd NUMERIC;
BEGIN
  IF NOT public.pode_vender() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF length(v_nome) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'Dê um nome ao modelo (até 60 letras).' USING ERRCODE = '23514';
  END IF;
  IF jsonb_typeof(p->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'items') = 0 THEN
    RAISE EXCEPTION 'O modelo precisa de ao menos um item do catálogo.' USING ERRCODE = '23514';
  END IF;

  SELECT t.id INTO v_id FROM public.quote_templates t WHERE lower(btrim(t.name)) = lower(v_nome) FOR UPDATE;
  IF v_id IS NULL THEN
    INSERT INTO public.quote_templates (name, sort_order)
    VALUES (v_nome, coalesce((SELECT max(sort_order) FROM public.quote_templates), 0) + 1)
    RETURNING id INTO v_id;
  ELSE
    IF NOT coalesce((p->>'replace')::boolean, FALSE) THEN
      RAISE EXCEPTION 'Já existe um modelo com esse nome.' USING ERRCODE = '23505';
    END IF;
    UPDATE public.quote_templates SET name = v_nome WHERE id = v_id;
    DELETE FROM public.quote_template_items WHERE template_id = v_id;
  END IF;

  FOR v_item, v_ordem IN SELECT value, ordinality FROM jsonb_array_elements(p->'items') WITH ORDINALITY LOOP
    v_qtd := nullif(v_item->>'quantity', '')::numeric;
    INSERT INTO public.quote_template_items (template_id, catalog_item_id, suggested_quantity, sort_order)
    VALUES (v_id, (v_item->>'catalog_item_id')::uuid, CASE WHEN v_qtd > 0 THEN v_qtd END, v_ordem)
    ON CONFLICT (template_id, catalog_item_id) DO NOTHING;
  END LOOP;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.modelo_salvar(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modelo_salvar(JSONB) TO authenticated;

-- Primeiro modelo: itens do orçamento 31974 do SicWeb (24/11/2026). Só a mão de obra vem com quantidade.
DO $$
DECLARE v_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.quote_templates) THEN
    RETURN;
  END IF;
  INSERT INTO public.quote_templates (name, sort_order) VALUES ('Instalação split 9.000', 1) RETURNING id INTO v_id;
  INSERT INTO public.quote_template_items (template_id, catalog_item_id, suggested_quantity, sort_order)
  SELECT v_id, c.id, x.qtd, x.ordem
    FROM (VALUES
      ('9', NULL::numeric, 1), ('26', NULL, 2), ('11', NULL, 3), ('32', NULL, 4), ('13', NULL, 5),
      ('41', NULL, 6), ('859', NULL, 7), ('858', NULL, 8), ('867', NULL, 9), ('290', 1, 10)
    ) AS x(legado, qtd, ordem)
    JOIN public.catalog_items c ON c.legacy_code = x.legado;
END $$;

COMMIT;
