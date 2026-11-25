-- =====================================================================
-- Vendas, parte 1: catálogo de produtos e serviços e orçamentos (2026-11-25).
--
-- Liga ao banco as telas /catalogo, /orcamentos e a página pública /orcamento/<token>
-- (rodada 1 do Gemini; contrato em src/types/vendas.ts). Vendas e financeiro entram na parte 2.
--
-- Regras:
--   * Só admin e escritório leem e mexem. O custo do produto fica numa tabela à parte, que só o nível
--     financeiro "completo" lê (admin sempre é completo; escritório conforme profiles.financial_access).
--   * Orçamento só se grava pelas funções orcamento_* (o banco recalcula itens e totais; a tela não manda total).
--   * Numeração própria ORC-30001 em diante (o SicWeb está no 28.092: os números nunca se cruzam).
--   * O cliente vê e aprova pelo link (orcamento_publico_ver/aprovar, sem login, só o orçamento do token):
--     só orçamento enviado e dentro da validade; nunca vê a observação interna.
--
-- Colar no SQL Editor do projeto BRV Control.
-- =====================================================================
BEGIN;

-- ---------------------------------------------------------------------
-- 1. Nível de acesso financeiro no perfil (docs/financeiro.md: nível no perfil, não papel novo)
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS financial_access TEXT NOT NULL DEFAULT 'nenhum';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_financial_access_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_financial_access_check
  CHECK (financial_access IN ('nenhum', 'caixa', 'completo'));

-- Nível de quem está logado: admin é sempre "completo"; escritório usa o campo; os demais, "nenhum"
CREATE OR REPLACE FUNCTION public.nivel_financeiro()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT coalesce((
    SELECT CASE WHEN p.role = 'admin' THEN 'completo'
                WHEN p.role = 'escritorio' THEN p.financial_access
                ELSE 'nenhum' END
      FROM public.profiles p
     WHERE p.id = auth.uid() AND p.active
  ), 'nenhum');
$$;
REVOKE EXECUTE ON FUNCTION public.nivel_financeiro() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nivel_financeiro() TO authenticated;

-- Só o admin muda o nível de alguém (scripts com service_role passam)
CREATE OR REPLACE FUNCTION public.profiles_protege_acesso_financeiro()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.financial_access IS DISTINCT FROM OLD.financial_access
     AND auth.uid() IS NOT NULL
     AND NOT public.eh_admin() THEN
    RAISE EXCEPTION 'Só o administrador muda o acesso ao financeiro.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_protege_acesso_financeiro ON public.profiles;
CREATE TRIGGER profiles_protege_acesso_financeiro
  BEFORE UPDATE OF financial_access ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_protege_acesso_financeiro();

-- ---------------------------------------------------------------------
-- 2. Funções de apoio
-- ---------------------------------------------------------------------
-- Dia de hoje em Niterói (nunca o dia em UTC: depois das 21h ele já é amanhã)
CREATE OR REPLACE FUNCTION public.hoje_local()
RETURNS DATE
LANGUAGE sql STABLE SET search_path = ''
AS $$ SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date $$;

-- 123456 -> 'R$ 1.234,56' (texto do histórico)
CREATE OR REPLACE FUNCTION public.formatar_reais(p_centavos BIGINT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT CASE WHEN p_centavos < 0 THEN '-' ELSE '' END || 'R$ ' ||
         translate(to_char(abs(coalesce(p_centavos, 0)) / 100.0, 'FM999G999G999G990D00'), ',.', '.,');
$$;

-- Linha de item: a mesma conta de calcularLinhaItemCentavos (src/utils/dinheiro.ts)
CREATE OR REPLACE FUNCTION public.calcular_linha_centavos(
  p_quantidade NUMERIC, p_unitario BIGINT, p_modo TEXT, p_entrada NUMERIC,
  OUT bruto BIGINT, OUT desconto BIGINT, OUT total BIGINT)
LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
BEGIN
  bruto := round(greatest(coalesce(p_quantidade, 0), 0) * greatest(coalesce(p_unitario, 0), 0));
  IF p_modo = 'percentual' THEN
    desconto := round(bruto * least(greatest(coalesce(p_entrada, 0), 0), 100) / 100.0);
  ELSE
    desconto := round(greatest(coalesce(p_entrada, 0), 0));
  END IF;
  desconto := least(bruto, desconto);
  total := greatest(0, bruto - desconto);
END;
$$;

-- Nome de quem está agindo (histórico)
CREATE OR REPLACE FUNCTION public.vendas_ator_nome()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT coalesce((SELECT full_name FROM public.profiles WHERE id = auth.uid()), 'Sistema');
$$;
REVOKE EXECUTE ON FUNCTION public.vendas_ator_nome() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Catálogo de produtos e serviços
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL CHECK (length(btrim(code)) > 0),
  barcode TEXT,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  kind TEXT NOT NULL DEFAULT 'produto' CHECK (kind IN ('produto', 'servico')),
  unit TEXT NOT NULL DEFAULT 'UN',
  category TEXT,
  manufacturer TEXT,                           -- fabricante (SicWeb: "Fabricante")
  notes TEXT,                                  -- observações do produto (SicWeb: "Observações")
  sale_price_cents BIGINT NOT NULL DEFAULT 0 CHECK (sale_price_cents >= 0),
  price_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- último reajuste do preço de venda
  controls_stock BOOLEAN NOT NULL DEFAULT FALSE,
  stock_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  min_stock_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (min_stock_quantity >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  type_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  is_frequent BOOLEAN NOT NULL DEFAULT FALSE,
  -- Fiscal do produto (NFC-e / NF-e)
  ncm TEXT CHECK (ncm IS NULL OR ncm ~ '^[0-9]{8}$'),
  cfop TEXT CHECK (cfop IS NULL OR cfop ~ '^[0-9]{4}$'),
  csosn TEXT CHECK (csosn IS NULL OR csosn ~ '^[0-9]{3}$'),
  origin SMALLINT NOT NULL DEFAULT 0 CHECK (origin BETWEEN 0 AND 8),
  taxable_unit TEXT,
  -- Fiscal do serviço (NFS-e nacional)
  service_code TEXT,
  iss_rate NUMERIC(5,2) CHECK (iss_rate IS NULL OR iss_rate BETWEEN 0 AND 100),
  invoice_description TEXT,
  legacy_code TEXT,                            -- chave do SicWeb (TABEST1.controle): importação repetível
  busca TEXT GENERATED ALWAYS AS (
    public.sem_acento(
      code || ' ' || coalesce(barcode, '') || ' ' || name || ' ' || coalesce(category, '') || ' ' ||
      coalesce(manufacturer, '') || ' ' || coalesce(notes, '')
    )
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS catalog_items_code_key ON public.catalog_items (lower(btrim(code)));
CREATE UNIQUE INDEX IF NOT EXISTS catalog_items_legacy_key ON public.catalog_items (legacy_code) WHERE legacy_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS catalog_items_barcode_idx ON public.catalog_items (barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS catalog_items_busca_trgm_idx ON public.catalog_items USING gin (busca extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS catalog_items_nome_idx ON public.catalog_items (name);

DROP TRIGGER IF EXISTS set_updated_at ON public.catalog_items;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Reajuste: guarda quando o preço de venda mudou
CREATE OR REPLACE FUNCTION public.catalog_items_reajuste()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NEW.sale_price_cents IS DISTINCT FROM OLD.sale_price_cents THEN
    NEW.price_updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS catalog_items_reajuste ON public.catalog_items;
CREATE TRIGGER catalog_items_reajuste BEFORE UPDATE OF sale_price_cents ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.catalog_items_reajuste();

ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalog_items FROM anon;
DROP POLICY IF EXISTS "Escritório lê" ON public.catalog_items;
CREATE POLICY "Escritório lê" ON public.catalog_items FOR SELECT TO authenticated
  USING ((SELECT public.eh_escritorio()));
DROP POLICY IF EXISTS "Escritório cadastra" ON public.catalog_items;
CREATE POLICY "Escritório cadastra" ON public.catalog_items FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.eh_escritorio()));
DROP POLICY IF EXISTS "Escritório altera" ON public.catalog_items;
CREATE POLICY "Escritório altera" ON public.catalog_items FOR UPDATE TO authenticated
  USING ((SELECT public.eh_escritorio())) WITH CHECK ((SELECT public.eh_escritorio()));
-- Sem DELETE: item usado em orçamento ou venda só se inativa

-- Custo do produto: só o nível financeiro "completo"
CREATE TABLE IF NOT EXISTS public.catalog_item_costs (
  catalog_item_id UUID PRIMARY KEY REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  cost_price_cents BIGINT NOT NULL CHECK (cost_price_cents >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS set_updated_at ON public.catalog_item_costs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.catalog_item_costs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.catalog_item_costs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalog_item_costs FROM anon;
DROP POLICY IF EXISTS "Financeiro completo" ON public.catalog_item_costs;
CREATE POLICY "Financeiro completo" ON public.catalog_item_costs FOR ALL TO authenticated
  USING ((SELECT public.nivel_financeiro()) = 'completo')
  WITH CHECK ((SELECT public.nivel_financeiro()) = 'completo');

-- "Revisar tipos": nome com cara de mão de obra (mesma regra de pareceItemDeServico em regrasVendas.ts)
CREATE OR REPLACE FUNCTION public.catalogo_parece_servico(p_nome TEXT)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT n ~ '^m\.?\s*o\M'
      OR n LIKE '%mao de obra%' OR n LIKE '%instalacao%' OR n LIKE '%desinstalacao%'
      OR n LIKE '%manutencao%' OR n LIKE '%visita%'
    FROM (SELECT public.sem_acento(coalesce(p_nome, '')) AS n) x;
$$;

-- ---------------------------------------------------------------------
-- 4. Observações prontas do orçamento
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_texts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  content TEXT NOT NULL CHECK (length(btrim(content)) > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS set_updated_at ON public.quote_texts;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.quote_texts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.quote_texts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_texts FROM anon;
DROP POLICY IF EXISTS "Escritório gerencia" ON public.quote_texts;
CREATE POLICY "Escritório gerencia" ON public.quote_texts FOR ALL TO authenticated
  USING ((SELECT public.eh_escritorio())) WITH CHECK ((SELECT public.eh_escritorio()));

-- As 4 observações que se repetem nos orçamentos do SicWeb (texto real; o resto o escritório cadastra)
INSERT INTO public.quote_texts (title, content, sort_order)
SELECT t.title, t.content, t.ordem
  FROM (VALUES
    ('Conforme informações do cliente', 'Orçamento feito de acordo com informações passadas pelo cliente, qualquer alteração o orçamento será refeito.', 1),
    ('Elétrica e dreno', 'Elétrica e dreno por conta do cliente.', 2),
    ('Paredes, tetos e janelas', 'A empresa não realiza fechamento de paredes ou tetos (gesso ou forro PVC), nem retirada ou colocação de janelas, grades, telas ou vidros, ficando estes serviços por conta do cliente.', 3),
    ('Fio e mão de obra da elétrica', 'O fio para a elétrica e a mão de obra serão acrescentados no orçamento depois do serviço, pois não sabemos a metragem.', 4)
  ) AS t(title, content, ordem)
 WHERE NOT EXISTS (SELECT 1 FROM public.quote_texts);

-- ---------------------------------------------------------------------
-- 5. Orçamentos, itens e histórico
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.quote_number_seq START 30001;

CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE DEFAULT ('ORC-' || lpad(nextval('public.quote_number_seq')::text, 5, '0')),
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'enviado', 'aprovado', 'recusado', 'convertido')),
  customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,   -- NULL = Consumidor final
  customer_name TEXT NOT NULL DEFAULT 'Consumidor final',
  customer_person_type TEXT NOT NULL DEFAULT 'PF' CHECK (customer_person_type IN ('PF', 'PJ')),
  customer_document TEXT,
  address_id UUID REFERENCES public.customer_addresses(id) ON DELETE SET NULL,
  address_text TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  seller_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  seller_name TEXT,
  validity_days INTEGER NOT NULL DEFAULT 10 CHECK (validity_days BETWEEN 1 AND 365),
  valid_until DATE NOT NULL,
  products_subtotal_cents BIGINT NOT NULL DEFAULT 0 CHECK (products_subtotal_cents >= 0),
  services_subtotal_cents BIGINT NOT NULL DEFAULT 0 CHECK (services_subtotal_cents >= 0),
  general_discount_cents BIGINT NOT NULL DEFAULT 0 CHECK (general_discount_cents >= 0),
  freight_cents BIGINT NOT NULL DEFAULT 0 CHECK (freight_cents >= 0),
  total_cents BIGINT NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  payment_terms_note TEXT,
  notes TEXT,                                  -- sai no documento e no link
  internal_notes TEXT,                         -- só o escritório
  public_token TEXT NOT NULL UNIQUE
    DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  response_channel TEXT CHECK (response_channel IN ('link', 'whatsapp', 'telefone', 'presencial', 'email')),
  responded_by_name TEXT,
  response_note TEXT,
  converted_sale_id UUID,                      -- FK entra com a tabela de vendas (parte 2)
  converted_sale_number TEXT,
  converted_service_order_id UUID REFERENCES public.service_orders(id) ON DELETE SET NULL,
  busca TEXT NOT NULL DEFAULT '',
  created_by UUID DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS quotes_criado_idx ON public.quotes (created_at DESC);
CREATE INDEX IF NOT EXISTS quotes_cliente_idx ON public.quotes (customer_id);
CREATE INDEX IF NOT EXISTS quotes_vendedor_idx ON public.quotes (seller_id);
CREATE INDEX IF NOT EXISTS quotes_busca_trgm_idx ON public.quotes USING gin (busca extensions.gin_trgm_ops);
DROP TRIGGER IF EXISTS set_updated_at ON public.quotes;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  catalog_item_id UUID REFERENCES public.catalog_items(id) ON DELETE SET NULL,   -- NULL = item avulso
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  kind TEXT NOT NULL CHECK (kind IN ('produto', 'servico')),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit_price_cents BIGINT NOT NULL CHECK (unit_price_cents >= 0),
  discount_mode TEXT NOT NULL DEFAULT 'valor' CHECK (discount_mode IN ('valor', 'percentual')),
  discount_input NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_input >= 0),
  discount_cents BIGINT NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  total_cents BIGINT NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS quote_items_orcamento_idx ON public.quote_items (quote_id, sort_order);
CREATE INDEX IF NOT EXISTS quote_items_catalogo_idx ON public.quote_items (catalog_item_id) WHERE catalog_item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.quote_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'criado', 'alterado', 'enviado', 'reaberto', 'novo_link', 'aprovado', 'recusado',
    'convertido_venda', 'convertido_os', 'nota')),
  actor_id UUID DEFAULT auth.uid(),
  actor_name TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS quote_events_orcamento_idx ON public.quote_events (quote_id, created_at DESC);

-- Leitura para o escritório; escrita só pelas funções orcamento_* (nenhuma política de escrita)
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quotes, public.quote_items, public.quote_events FROM anon;
DROP POLICY IF EXISTS "Escritório lê" ON public.quotes;
CREATE POLICY "Escritório lê" ON public.quotes FOR SELECT TO authenticated USING ((SELECT public.eh_escritorio()));
DROP POLICY IF EXISTS "Escritório lê" ON public.quote_items;
CREATE POLICY "Escritório lê" ON public.quote_items FOR SELECT TO authenticated USING ((SELECT public.eh_escritorio()));
DROP POLICY IF EXISTS "Escritório lê" ON public.quote_events;
CREATE POLICY "Escritório lê" ON public.quote_events FOR SELECT TO authenticated USING ((SELECT public.eh_escritorio()));

-- Catálogo com "já foi usado" e "parece serviço" (view com a RLS de quem consulta)
CREATE OR REPLACE VIEW public.catalogo_itens WITH (security_invoker = true) AS
SELECT c.*,
       EXISTS (SELECT 1 FROM public.quote_items qi WHERE qi.catalog_item_id = c.id) AS has_usage,
       (c.active AND c.kind = 'produto' AND NOT c.type_reviewed AND public.catalogo_parece_servico(c.name)) AS sugere_servico
  FROM public.catalog_items c;
REVOKE ALL ON public.catalogo_itens FROM anon;

-- ---------------------------------------------------------------------
-- 6. Funções do orçamento (escritório)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.orcamento_evento(p_quote UUID, p_tipo TEXT, p_nota TEXT, p_ator TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.quote_events (quote_id, event_type, actor_name, note)
  VALUES (p_quote, p_tipo, coalesce(p_ator, public.vendas_ator_nome()), p_nota)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.orcamento_evento(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- Texto de busca da lista (número, cliente, contato, vendedor e itens)
CREATE OR REPLACE FUNCTION public.orcamento_atualiza_busca(p_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  UPDATE public.quotes q
     SET busca = public.sem_acento(
           q.number || ' ' || q.customer_name || ' ' || coalesce(q.contact_name, '') || ' ' ||
           coalesce(q.contact_phone, '') || ' ' || coalesce(q.seller_name, '') || ' ' ||
           coalesce((SELECT string_agg(i.code || ' ' || i.name, ' ') FROM public.quote_items i WHERE i.quote_id = q.id), ''))
   WHERE q.id = p_id;
$$;
REVOKE EXECUTE ON FUNCTION public.orcamento_atualiza_busca(UUID) FROM PUBLIC, anon, authenticated;

-- Situação mostrada na tela (vencido é calculado)
CREATE OR REPLACE FUNCTION public.orcamento_situacao(p_status TEXT, p_validade DATE, p_venda UUID, p_os UUID)
RETURNS TEXT
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_status = 'convertido' OR p_venda IS NOT NULL OR p_os IS NOT NULL THEN 'convertido'
    WHEN p_status = 'enviado' AND p_validade < public.hoje_local() THEN 'vencido'
    ELSE p_status END;
$$;

-- Orçamento completo em JSON (formato do tipo Quote de src/types/vendas.ts)
CREATE OR REPLACE FUNCTION public.orcamento_json(p_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT to_jsonb(q) - 'busca' - 'created_by'
         || jsonb_build_object(
              'converted_service_order_number', (SELECT o.number FROM public.service_orders o WHERE o.id = q.converted_service_order_id),
              'items', coalesce((
                SELECT jsonb_agg(to_jsonb(i) ORDER BY i.kind, i.sort_order)
                  FROM public.quote_items i WHERE i.quote_id = q.id), '[]'::jsonb))
    FROM public.quotes q
   WHERE q.id = p_id;
$$;
REVOKE EXECUTE ON FUNCTION public.orcamento_json(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.orcamento_buscar(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  RETURN public.orcamento_json(p_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.orcamento_buscar(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orcamento_buscar(UUID) TO authenticated;

-- Lista paginada com contagem por situação e soma (filtros iguais aos da tela /orcamentos)
CREATE OR REPLACE FUNCTION public.orcamentos_listar(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_termo TEXT := public.sem_acento(btrim(coalesce(p->>'busca', '')));
  v_sit TEXT := coalesce(nullif(p->>'situacao', ''), 'todos');
  v_vend UUID := nullif(p->>'vendedor_id', '')::uuid;
  v_ini DATE := nullif(p->>'data_inicio', '')::date;
  v_fim DATE := nullif(p->>'data_fim', '')::date;
  v_comp TEXT := coalesce(nullif(p->>'composicao', ''), 'todos');
  v_pagina INTEGER := greatest(coalesce((p->>'pagina')::int, 0), 0);
  v_por INTEGER := least(greatest(coalesce((p->>'por_pagina')::int, 50), 1), 200);
  v_res JSONB;
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;

  WITH base AS (
    SELECT q.id, q.created_at, q.total_cents,
           public.orcamento_situacao(q.status, q.valid_until, q.converted_sale_id, q.converted_service_order_id) AS sit
      FROM public.quotes q
     WHERE (v_termo = '' OR q.busca LIKE '%' || v_termo || '%')
       AND (v_vend IS NULL OR q.seller_id = v_vend)
       AND (v_ini IS NULL OR (q.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= v_ini)
       AND (v_fim IS NULL OR (q.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= v_fim)
       AND (v_comp = 'todos'
            OR (v_comp = 'com_servico' AND EXISTS (SELECT 1 FROM public.quote_items i WHERE i.quote_id = q.id AND i.kind = 'servico'))
            OR (v_comp = 'com_produto' AND EXISTS (SELECT 1 FROM public.quote_items i WHERE i.quote_id = q.id AND i.kind = 'produto')))
  ),
  filtrados AS (
    SELECT * FROM base WHERE v_sit = 'todos' OR sit = v_sit
  ),
  pagina AS (
    SELECT id, created_at FROM filtrados ORDER BY created_at DESC, id OFFSET v_pagina * v_por LIMIT v_por
  )
  SELECT jsonb_build_object(
    'itens', coalesce((SELECT jsonb_agg(public.orcamento_json(pg.id) ORDER BY pg.created_at DESC, pg.id) FROM pagina pg), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtrados),
    'soma_total_cents', (SELECT coalesce(sum(total_cents), 0) FROM filtrados),
    'contagens', jsonb_build_object(
      'todos', (SELECT count(*) FROM base),
      'rascunho', (SELECT count(*) FROM base WHERE sit = 'rascunho'),
      'enviado', (SELECT count(*) FROM base WHERE sit = 'enviado'),
      'aprovado', (SELECT count(*) FROM base WHERE sit = 'aprovado'),
      'recusado', (SELECT count(*) FROM base WHERE sit = 'recusado'),
      'convertido', (SELECT count(*) FROM base WHERE sit = 'convertido'),
      'vencido', (SELECT count(*) FROM base WHERE sit = 'vencido')))
  INTO v_res;
  RETURN v_res;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.orcamentos_listar(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orcamentos_listar(JSONB) TO authenticated;

-- Criar ou alterar (o banco recalcula itens e totais; só rascunho e recusado se alteram)
CREATE OR REPLACE FUNCTION public.orcamento_salvar(p JSONB)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_id UUID := nullif(p->>'id', '')::uuid;
  q public.quotes%ROWTYPE;
  v_cliente UUID := nullif(p->>'customer_id', '')::uuid;
  v_nome TEXT; v_tipo TEXT; v_doc TEXT;
  v_end UUID := nullif(p->>'address_id', '')::uuid;
  v_vend UUID := nullif(p->>'seller_id', '')::uuid;
  v_vend_nome TEXT;
  v_dias INTEGER := least(greatest(coalesce((p->>'validity_days')::int, 10), 1), 365);
  v_item JSONB; v_ordem BIGINT;
  v_qtd NUMERIC; v_unit BIGINT; v_modo TEXT; v_ent NUMERIC; v_kind TEXT; v_cat UUID; v_avulso BOOLEAN; v_nome_item TEXT;
  v_linha RECORD;
  v_prod BIGINT := 0; v_serv BIGINT := 0; v_desc BIGINT; v_frete BIGINT;
  v_novo BOOLEAN := v_id IS NULL;
  v_qtd_itens INTEGER;
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'items') = 0 THEN
    RAISE EXCEPTION 'Adicione ao menos um produto ou serviço ao orçamento.' USING ERRCODE = '23514';
  END IF;

  -- Cliente: com cadastro, nome/tipo/documento vêm do cadastro; sem, é Consumidor final
  IF v_cliente IS NOT NULL THEN
    SELECT c.name, c.person_type, c.document INTO v_nome, v_tipo, v_doc FROM public.customers c WHERE c.id = v_cliente;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente não encontrado.' USING ERRCODE = 'P0002';
    END IF;
    IF v_end IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.customer_addresses a WHERE a.id = v_end AND a.customer_id = v_cliente) THEN
      v_end := NULL;
    END IF;
  ELSE
    v_nome := 'Consumidor final';
    v_tipo := CASE WHEN p->>'customer_person_type' = 'PJ' THEN 'PJ' ELSE 'PF' END;
    v_doc := nullif(btrim(coalesce(p->>'customer_document', '')), '');
    v_end := NULL;
  END IF;

  -- Vendedor: funcionário ativo; sem escolha, quem está logado
  IF v_vend IS NOT NULL THEN
    SELECT e.name INTO v_vend_nome FROM public.employees e WHERE e.id = v_vend AND e.active;
    IF NOT FOUND THEN v_vend := NULL; END IF;
  END IF;
  IF v_vend IS NULL THEN
    v_vend := public.meu_funcionario_id();
    SELECT e.name INTO v_vend_nome FROM public.employees e WHERE e.id = v_vend;
  END IF;

  IF v_novo THEN
    INSERT INTO public.quotes (customer_id, customer_name, customer_person_type, customer_document, address_id, valid_until)
    VALUES (v_cliente, v_nome, v_tipo, v_doc, v_end, public.hoje_local() + v_dias)
    RETURNING * INTO q;
    v_id := q.id;
  ELSE
    SELECT * INTO q FROM public.quotes WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Orçamento não encontrado.' USING ERRCODE = 'P0002';
    END IF;
    IF q.status NOT IN ('rascunho', 'recusado') THEN
      RAISE EXCEPTION 'Orçamento enviado, aprovado ou convertido não pode ser alterado. Use "Reabrir para editar" ou "Duplicar".' USING ERRCODE = '23514';
    END IF;
    DELETE FROM public.quote_items WHERE quote_id = v_id;
  END IF;

  FOR v_item, v_ordem IN SELECT value, ordinality FROM jsonb_array_elements(p->'items') WITH ORDINALITY LOOP
    v_nome_item := btrim(coalesce(v_item->>'name', ''));
    IF v_nome_item = '' THEN
      RAISE EXCEPTION 'Há um item sem descrição.' USING ERRCODE = '23514';
    END IF;
    v_qtd := (v_item->>'quantity')::numeric;
    IF v_qtd IS NULL OR v_qtd <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida em "%".', v_nome_item USING ERRCODE = '23514';
    END IF;
    v_unit := round(coalesce((v_item->>'unit_price_cents')::numeric, 0));
    IF v_unit < 0 THEN
      RAISE EXCEPTION 'Valor negativo em "%".', v_nome_item USING ERRCODE = '23514';
    END IF;
    v_modo := CASE WHEN v_item->>'discount_mode' = 'percentual' THEN 'percentual' ELSE 'valor' END;
    v_ent := greatest(coalesce((v_item->>'discount_input')::numeric, 0), 0);
    v_kind := CASE WHEN v_item->>'kind' = 'servico' THEN 'servico' ELSE 'produto' END;
    v_avulso := coalesce((v_item->>'is_custom')::boolean, FALSE);
    v_cat := CASE WHEN v_avulso THEN NULL ELSE nullif(v_item->>'catalog_item_id', '')::uuid END;
    IF v_cat IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.catalog_items c WHERE c.id = v_cat) THEN
      RAISE EXCEPTION 'Item do catálogo não encontrado: "%".', v_nome_item USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_linha FROM public.calcular_linha_centavos(v_qtd, v_unit, v_modo, v_ent);
    INSERT INTO public.quote_items (quote_id, catalog_item_id, is_custom, kind, code, name, unit, quantity,
                                    unit_price_cents, discount_mode, discount_input, discount_cents, total_cents, sort_order)
    VALUES (v_id, v_cat, v_avulso OR v_cat IS NULL, v_kind,
            coalesce(nullif(btrim(v_item->>'code'), ''), CASE WHEN v_cat IS NULL THEN 'AVULSO' ELSE 'ITEM' END),
            v_nome_item,
            coalesce(nullif(btrim(v_item->>'unit'), ''), CASE WHEN v_kind = 'servico' THEN 'SRV' ELSE 'UN' END),
            v_qtd, v_unit, v_modo, v_ent, v_linha.desconto, v_linha.total, v_ordem);

    IF v_kind = 'produto' THEN v_prod := v_prod + v_linha.total; ELSE v_serv := v_serv + v_linha.total; END IF;
  END LOOP;

  v_desc := least(v_prod + v_serv, greatest(round(coalesce((p->>'general_discount_cents')::numeric, 0)), 0));
  v_frete := greatest(round(coalesce((p->>'freight_cents')::numeric, 0)), 0);

  UPDATE public.quotes SET
    customer_id = v_cliente,
    customer_name = v_nome,
    customer_person_type = v_tipo,
    customer_document = v_doc,
    address_id = v_end,
    address_text = nullif(btrim(coalesce(p->>'address_text', '')), ''),
    contact_name = nullif(btrim(coalesce(p->>'contact_name', '')), ''),
    contact_phone = nullif(btrim(coalesce(p->>'contact_phone', '')), ''),
    seller_id = v_vend,
    seller_name = v_vend_nome,
    validity_days = v_dias,
    valid_until = CASE WHEN v_novo THEN public.hoje_local() + v_dias
                       ELSE (coalesce(q.sent_at, q.created_at) AT TIME ZONE 'America/Sao_Paulo')::date + v_dias END,
    products_subtotal_cents = v_prod,
    services_subtotal_cents = v_serv,
    general_discount_cents = v_desc,
    freight_cents = v_frete,
    total_cents = greatest(v_prod + v_serv - v_desc + v_frete, 0),
    payment_terms_note = nullif(btrim(coalesce(p->>'payment_terms_note', '')), ''),
    notes = nullif(btrim(coalesce(p->>'notes', '')), ''),
    internal_notes = nullif(btrim(coalesce(p->>'internal_notes', '')), '')
  WHERE id = v_id
  RETURNING * INTO q;

  PERFORM public.orcamento_atualiza_busca(v_id);
  v_qtd_itens := jsonb_array_length(p->'items');
  IF v_novo THEN
    PERFORM public.orcamento_evento(v_id, 'criado', format('Orçamento %s criado (%s).', q.number, public.formatar_reais(q.total_cents)));
  ELSE
    PERFORM public.orcamento_evento(v_id, 'alterado', format('Orçamento atualizado (%s %s, total %s).',
      v_qtd_itens, CASE WHEN v_qtd_itens = 1 THEN 'item' ELSE 'itens' END, public.formatar_reais(q.total_cents)));
  END IF;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.orcamento_salvar(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orcamento_salvar(JSONB) TO authenticated;

-- Cópia como rascunho novo (número e link novos)
CREATE OR REPLACE FUNCTION public.orcamento_duplicar(p_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  o public.quotes%ROWTYPE;
  v_novo UUID;
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO o FROM public.quotes WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento original não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.quotes (customer_id, customer_name, customer_person_type, customer_document, address_id, address_text,
                             contact_name, contact_phone, seller_id, seller_name, validity_days, valid_until,
                             products_subtotal_cents, services_subtotal_cents, general_discount_cents, freight_cents, total_cents,
                             payment_terms_note, notes, internal_notes)
  VALUES (o.customer_id, o.customer_name, o.customer_person_type, o.customer_document, o.address_id, o.address_text,
          o.contact_name, o.contact_phone, o.seller_id, o.seller_name, o.validity_days, public.hoje_local() + o.validity_days,
          o.products_subtotal_cents, o.services_subtotal_cents, o.general_discount_cents, o.freight_cents, o.total_cents,
          o.payment_terms_note, o.notes, o.internal_notes)
  RETURNING id INTO v_novo;

  INSERT INTO public.quote_items (quote_id, catalog_item_id, is_custom, kind, code, name, unit, quantity,
                                  unit_price_cents, discount_mode, discount_input, discount_cents, total_cents, sort_order)
  SELECT v_novo, catalog_item_id, is_custom, kind, code, name, unit, quantity,
         unit_price_cents, discount_mode, discount_input, discount_cents, total_cents, sort_order
    FROM public.quote_items WHERE quote_id = p_id;

  PERFORM public.orcamento_atualiza_busca(v_novo);
  PERFORM public.orcamento_evento(v_novo, 'criado', format('Duplicado a partir do orçamento %s.', o.number));
  RETURN v_novo;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.orcamento_duplicar(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orcamento_duplicar(UUID) TO authenticated;

-- Excluir: só rascunho (o resto fica no histórico)
CREATE OR REPLACE FUNCTION public.orcamento_excluir(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_status TEXT;
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  SELECT status INTO v_status FROM public.quotes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'rascunho' THEN
    RAISE EXCEPTION 'Apenas orçamentos em rascunho podem ser excluídos.' USING ERRCODE = '23514';
  END IF;
  DELETE FROM public.quotes WHERE id = p_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.orcamento_excluir(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orcamento_excluir(UUID) TO authenticated;

-- Volta para rascunho e troca o link (o anterior deixa de abrir)
CREATE OR REPLACE FUNCTION public.orcamento_reabrir(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE o public.quotes%ROWTYPE;
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO o FROM public.quotes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF public.orcamento_situacao(o.status, o.valid_until, o.converted_sale_id, o.converted_service_order_id) = 'convertido' THEN
    RAISE EXCEPTION 'Orçamento já convertido não pode ser reaberto. Duplique-o se precisar de outro.' USING ERRCODE = '23514';
  END IF;
  UPDATE public.quotes SET
    status = 'rascunho',
    public_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    responded_at = NULL, response_channel = NULL, responded_by_name = NULL, response_note = NULL
  WHERE id = p_id;
  PERFORM public.orcamento_evento(p_id, 'reaberto', 'Reaberto como rascunho para edição (o link público anterior foi revogado).');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.orcamento_reabrir(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orcamento_reabrir(UUID) TO authenticated;

-- Enviado ao cliente: a validade passa a contar de hoje
CREATE OR REPLACE FUNCTION public.orcamento_registrar_envio(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  o public.quotes%ROWTYPE;
  v_validade DATE;
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO o FROM public.quotes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF public.orcamento_situacao(o.status, o.valid_until, o.converted_sale_id, o.converted_service_order_id) = 'convertido' THEN
    RAISE EXCEPTION 'Este orçamento já foi convertido.' USING ERRCODE = '23514';
  END IF;
  v_validade := public.hoje_local() + o.validity_days;
  UPDATE public.quotes SET
    status = CASE WHEN status = 'rascunho' THEN 'enviado' ELSE status END,
    sent_at = NOW(),
    valid_until = v_validade
  WHERE id = p_id;
  PERFORM public.orcamento_evento(p_id, 'enviado', format('Orçamento enviado ao cliente (válido até %s).', to_char(v_validade, 'DD/MM/YYYY')));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.orcamento_registrar_envio(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orcamento_registrar_envio(UUID) TO authenticated;

-- Resposta do cliente registrada pelo escritório (WhatsApp, telefone, presencial, e-mail)
CREATE OR REPLACE FUNCTION public.orcamento_registrar_resposta(p_id UUID, p_decisao TEXT, p_canal TEXT, p_observacao TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  o public.quotes%ROWTYPE;
  v_obs TEXT := nullif(btrim(coalesce(p_observacao, '')), '');
  v_canal TEXT := CASE p_canal WHEN 'whatsapp' THEN 'WhatsApp' WHEN 'telefone' THEN 'telefone' WHEN 'presencial' THEN 'presencial'
                               WHEN 'email' THEN 'e-mail' WHEN 'link' THEN 'link' ELSE p_canal END;
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF p_decisao NOT IN ('aprovado', 'recusado') THEN
    RAISE EXCEPTION 'Resposta inválida.' USING ERRCODE = '22023';
  END IF;
  IF p_canal NOT IN ('link', 'whatsapp', 'telefone', 'presencial', 'email') THEN
    RAISE EXCEPTION 'Canal inválido.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO o FROM public.quotes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF public.orcamento_situacao(o.status, o.valid_until, o.converted_sale_id, o.converted_service_order_id) = 'convertido' THEN
    RAISE EXCEPTION 'Este orçamento já foi convertido.' USING ERRCODE = '23514';
  END IF;
  UPDATE public.quotes SET
    status = p_decisao,
    responded_at = NOW(),
    response_channel = p_canal,
    responded_by_name = public.vendas_ator_nome(),
    response_note = v_obs
  WHERE id = p_id;
  PERFORM public.orcamento_evento(p_id, p_decisao, format('Cliente %s o orçamento via %s%s',
    CASE WHEN p_decisao = 'aprovado' THEN 'APROVOU' ELSE 'RECUSOU' END, v_canal,
    CASE WHEN v_obs IS NULL THEN '.' ELSE ': ' || v_obs END));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.orcamento_registrar_resposta(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orcamento_registrar_resposta(UUID, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.orcamento_novo_link(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.quotes
     SET public_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
   WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.orcamento_evento(p_id, 'novo_link', 'Gerado novo link público de aprovação (o link anterior foi revogado).');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.orcamento_novo_link(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orcamento_novo_link(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.orcamento_anotar(p_id UUID, p_nota TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_nota TEXT := btrim(coalesce(p_nota, ''));
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF v_nota = '' THEN
    RAISE EXCEPTION 'Digite uma anotação.' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quotes WHERE id = p_id) THEN
    RAISE EXCEPTION 'Orçamento não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  RETURN public.orcamento_evento(p_id, 'nota', left(v_nota, 2000));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.orcamento_anotar(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orcamento_anotar(UUID, TEXT) TO authenticated;

-- Gera a OS dos serviços do orçamento (OS sem atividade: o escritório agenda pela linha do tempo).
-- O tipo de serviço é escolhido pelo nome dos serviços (instalação, manutenção, desinstalação); dá para trocar na OS.
CREATE OR REPLACE FUNCTION public.orcamento_gerar_os(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  o public.quotes%ROWTYPE;
  v_servicos TEXT;
  v_nomes TEXT;
  v_padrao TEXT;
  v_tipo UUID;
  v_end UUID;
  v_os_id UUID;
  v_os_num BIGINT;
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO o FROM public.quotes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF o.converted_service_order_id IS NOT NULL OR o.status = 'convertido' THEN
    RAISE EXCEPTION 'Este orçamento já foi convertido.' USING ERRCODE = '23514';
  END IF;
  IF o.customer_id IS NULL THEN
    RAISE EXCEPTION 'Para gerar a OS, escolha um cliente cadastrado (Consumidor final não tem OS).' USING ERRCODE = '23514';
  END IF;

  SELECT string_agg(trim_scale(i.quantity)::text || ' ' || i.unit || ' — ' || i.name, E'\n' ORDER BY i.sort_order),
         public.sem_acento(string_agg(i.name, ' '))
    INTO v_servicos, v_nomes
    FROM public.quote_items i
   WHERE i.quote_id = p_id AND i.kind = 'servico';
  IF v_servicos IS NULL THEN
    RAISE EXCEPTION 'Este orçamento não possui itens de serviço para gerar uma Ordem de Serviço.' USING ERRCODE = '23514';
  END IF;

  -- "instal" que não seja "desinstal" -> Instalação; senão manutenção; senão desinstalação
  v_padrao := CASE
    WHEN v_nomes ~ '(^|[^s])instal' THEN 'instala'
    WHEN v_nomes LIKE '%manut%' THEN 'manuten'
    WHEN v_nomes LIKE '%desinstal%' THEN 'desinstala'
    ELSE NULL END;
  IF v_padrao = 'desinstala' THEN
    SELECT t.id INTO v_tipo FROM public.service_types t
     WHERE t.active AND public.sem_acento(t.name) LIKE '%desinstala%'
     ORDER BY length(t.name), t.name LIMIT 1;
  ELSIF v_padrao IS NOT NULL THEN
    SELECT t.id INTO v_tipo FROM public.service_types t
     WHERE t.active AND public.sem_acento(t.name) LIKE '%' || v_padrao || '%'
       AND public.sem_acento(t.name) NOT LIKE '%desinstala%'
     ORDER BY length(t.name), t.name LIMIT 1;
  END IF;
  IF v_tipo IS NULL THEN
    SELECT t.id INTO v_tipo FROM public.service_types t WHERE t.active ORDER BY t.name LIMIT 1;
  END IF;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Cadastre um tipo de serviço antes de gerar a OS.' USING ERRCODE = 'P0002';
  END IF;

  -- Endereço do orçamento; sem ele, o principal do cliente
  v_end := o.address_id;
  IF v_end IS NULL OR NOT EXISTS (SELECT 1 FROM public.customer_addresses a WHERE a.id = v_end AND a.customer_id = o.customer_id) THEN
    SELECT a.id INTO v_end FROM public.customer_addresses a
     WHERE a.customer_id = o.customer_id AND a.active ORDER BY a.is_primary DESC, a.created_at LIMIT 1;
  END IF;

  INSERT INTO public.service_orders (customer_id, address_id, service_type_id, status, description, internal_notes)
  VALUES (o.customer_id, v_end, v_tipo, 'agendada', v_servicos,
          format('Gerada do orçamento %s (%s).', o.number, public.formatar_reais(o.total_cents)))
  RETURNING id, number INTO v_os_id, v_os_num;

  UPDATE public.quotes SET status = 'convertido', converted_service_order_id = v_os_id WHERE id = p_id;
  PERFORM public.orcamento_evento(p_id, 'convertido_os', format('Gerada OS nº %s com os serviços do orçamento.', v_os_num));

  RETURN jsonb_build_object('service_order_id', v_os_id, 'service_order_number', v_os_num, 'descricao', v_servicos);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.orcamento_gerar_os(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orcamento_gerar_os(UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- 7. Página pública /orcamento/<token> (sem login, só o orçamento do token)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.orcamento_publico_ver(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE o public.quotes%ROWTYPE;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 THEN
    RETURN NULL;
  END IF;
  SELECT * INTO o FROM public.quotes WHERE public_token = p_token;
  IF NOT FOUND OR o.status = 'rascunho' THEN
    RETURN NULL;   -- rascunho ainda não foi mandado ao cliente
  END IF;
  RETURN jsonb_build_object(
    'number', o.number,
    'status', o.status,
    'is_expired', o.status = 'enviado' AND o.valid_until < public.hoje_local(),
    'customer_name', o.customer_name,
    'customer_person_type', o.customer_person_type,
    'customer_document', o.customer_document,
    'address_text', o.address_text,
    'contact_name', o.contact_name,
    'contact_phone', o.contact_phone,
    'seller_name', o.seller_name,
    'validity_days', o.validity_days,
    'valid_until', o.valid_until,
    'products_subtotal_cents', o.products_subtotal_cents,
    'services_subtotal_cents', o.services_subtotal_cents,
    'general_discount_cents', o.general_discount_cents,
    'freight_cents', o.freight_cents,
    'total_cents', o.total_cents,
    'payment_terms_note', o.payment_terms_note,
    'notes', o.notes,
    'sent_at', o.sent_at,
    'responded_at', o.responded_at,
    'response_channel', o.response_channel,
    'responded_by_name', o.responded_by_name,
    'created_at', o.created_at,
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', i.id, 'quote_id', i.quote_id, 'catalog_item_id', NULL, 'is_custom', i.is_custom, 'kind', i.kind,
               'code', i.code, 'name', i.name, 'unit', i.unit, 'quantity', i.quantity,
               'unit_price_cents', i.unit_price_cents, 'discount_mode', i.discount_mode, 'discount_input', i.discount_input,
               'discount_cents', i.discount_cents, 'total_cents', i.total_cents, 'sort_order', i.sort_order)
             ORDER BY i.kind, i.sort_order)
        FROM public.quote_items i WHERE i.quote_id = o.id), '[]'::jsonb)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.orcamento_publico_ver(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.orcamento_publico_ver(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.orcamento_publico_aprovar(p_token TEXT, p_nome TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  o public.quotes%ROWTYPE;
  v_nome TEXT := left(btrim(coalesce(p_nome, '')), 120);
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 32 THEN
    RAISE EXCEPTION 'Link de orçamento inválido ou revogado.' USING ERRCODE = 'P0002';
  END IF;
  IF char_length(v_nome) < 3 THEN
    RAISE EXCEPTION 'Informe seu nome completo para aprovar o orçamento.' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO o FROM public.quotes WHERE public_token = p_token FOR UPDATE;
  IF NOT FOUND OR o.status = 'rascunho' THEN
    RAISE EXCEPTION 'Link de orçamento inválido ou revogado.' USING ERRCODE = 'P0002';
  END IF;
  IF o.status = 'aprovado' THEN
    RETURN public.orcamento_publico_ver(p_token);   -- clique repetido
  END IF;
  IF o.status <> 'enviado' THEN
    RAISE EXCEPTION 'Este orçamento não está aguardando aprovação.' USING ERRCODE = '23514';
  END IF;
  IF o.valid_until < public.hoje_local() THEN
    RAISE EXCEPTION 'Este orçamento está vencido. Solicite a revalidação à BRV pelo WhatsApp.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.quotes SET
    status = 'aprovado',
    responded_at = NOW(),
    response_channel = 'link',
    responded_by_name = v_nome,
    response_note = 'Aprovado pelo cliente na página pública ("Li e concordo").'
  WHERE id = o.id;
  PERFORM public.orcamento_evento(o.id, 'aprovado', format('Aprovado pelo link público por "%s" ("Li e concordo").', v_nome),
                                  v_nome || ' (pelo link)');
  RETURN public.orcamento_publico_ver(p_token);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.orcamento_publico_aprovar(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.orcamento_publico_aprovar(TEXT, TEXT) TO anon, authenticated;

COMMIT;
