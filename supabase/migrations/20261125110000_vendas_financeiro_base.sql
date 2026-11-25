-- =====================================================================
-- Vendas, parte 2: vendas e base financeira (2026-11-25).
--
-- Liga ao banco a tela /vendas (Nova venda, recebimento, cancelamento e registro do número das notas)
-- e os cadastros de contas, maquininhas, categorias e fornecedores. Caixa da loja, recebimentos dos
-- técnicos e extrato entram na parte 3.
--
-- Regras (docs/financeiro.md):
--   * Venda só se grava pelas funções venda_* (o banco recalcula itens, desconto, totais, troco e taxa).
--   * Receber dinheiro exige nível financeiro "caixa" ou "completo"; cancelar venda e cancelar nota,
--     "completo". Desconto acima de 10% do bruto, "completo".
--   * Movimento financeiro NÃO se altera nem se apaga (gatilho). Correção só por estorno, uma única vez.
--   * Saldo é sempre calculado pelos movimentos até hoje; cartão cai (bruto) na conta da maquininha no
--     dia útil seguinte, com a taxa lançada como tarifa. Dias úteis = segunda a sexta (feriado não conta).
--   * Nota fiscal: ainda não há emissão pelo sistema; só se registra o número da nota emitida fora.
--
-- Colar no SQL Editor do projeto BRV Control.
-- =====================================================================
BEGIN;

-- ---------------------------------------------------------------------
-- 1. Cadastros do financeiro
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  kind TEXT NOT NULL CHECK (kind IN ('caixa', 'banco')),
  initial_balance_cents BIGINT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS financial_accounts_nome_key ON public.financial_accounts (lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.card_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  settlement_account_id UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
  settlement_business_days INTEGER NOT NULL DEFAULT 1 CHECK (settlement_business_days BETWEEN 0 AND 60),
  debit_fee_percent NUMERIC(6,3) NOT NULL DEFAULT 0 CHECK (debit_fee_percent BETWEEN 0 AND 50),
  credit_sight_fee_percent NUMERIC(6,3) NOT NULL DEFAULT 0 CHECK (credit_sight_fee_percent BETWEEN 0 AND 50),
  credit_installment_rates JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(credit_installment_rates) = 'array'),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS card_machines_nome_key ON public.card_machines (lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.financial_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  kind TEXT NOT NULL CHECK (kind IN ('receita', 'despesa')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  system_key TEXT UNIQUE,                      -- categorias que o sistema usa sozinho (o nome pode mudar)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS financial_categories_nome_key ON public.financial_categories (kind, lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  person_type TEXT NOT NULL DEFAULT 'PJ' CHECK (person_type IN ('PF', 'PJ')),
  document TEXT,
  phone TEXT,
  email TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $cadastros$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['financial_accounts', 'card_machines', 'financial_categories', 'suppliers'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('DROP POLICY IF EXISTS "Financeiro completo lê" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Financeiro completo lê" ON public.%I FOR SELECT TO authenticated USING ((SELECT public.nivel_financeiro()) = ''completo'')', t);
    EXECUTE format('DROP POLICY IF EXISTS "Financeiro completo cadastra" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Financeiro completo cadastra" ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT public.nivel_financeiro()) = ''completo'')', t);
    EXECUTE format('DROP POLICY IF EXISTS "Financeiro completo altera" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Financeiro completo altera" ON public.%I FOR UPDATE TO authenticated USING ((SELECT public.nivel_financeiro()) = ''completo'') WITH CHECK ((SELECT public.nivel_financeiro()) = ''completo'')', t);
    -- Sem DELETE: cadastro usado em lançamento só se desativa
  END LOOP;
END
$cadastros$;

INSERT INTO public.financial_accounts (name, kind, sort_order)
SELECT t.nome, t.tipo, t.ordem
  FROM (VALUES ('Caixa BRV', 'caixa', 1), ('Itaú', 'banco', 2), ('Caixa Econômica', 'banco', 3), ('Nubank', 'banco', 4)) AS t(nome, tipo, ordem)
 WHERE NOT EXISTS (SELECT 1 FROM public.financial_accounts);

-- Maquininhas com taxa ZERO de propósito: as taxas reais são cadastradas na tela (nada de valor inventado)
INSERT INTO public.card_machines (name, settlement_account_id, settlement_business_days)
SELECT t.nome, (SELECT id FROM public.financial_accounts WHERE name = 'Itaú'), 1
  FROM (VALUES ('Rede'), ('InfinitePay')) AS t(nome)
 WHERE NOT EXISTS (SELECT 1 FROM public.card_machines);

INSERT INTO public.financial_categories (name, kind, system_key)
SELECT t.nome, t.tipo, t.chave
  FROM (VALUES ('Venda loja', 'receita', 'venda_loja'), ('Serviço', 'receita', 'servico'),
               ('Outras receitas', 'receita', NULL), ('Tarifa de cartão', 'despesa', 'tarifa_cartao'),
               ('Compra de materiais', 'despesa', NULL), ('Despesas da loja', 'despesa', NULL),
               ('Outras despesas', 'despesa', NULL)) AS t(nome, tipo, chave)
 WHERE NOT EXISTS (SELECT 1 FROM public.financial_categories);

-- ---------------------------------------------------------------------
-- 2. Vendas
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.sale_number_seq START 30001;

CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE DEFAULT ('VND-' || lpad(nextval('public.sale_number_seq')::text, 5, '0')),
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'cancelada')),
  origin_type TEXT NOT NULL DEFAULT 'balcao' CHECK (origin_type IN ('balcao', 'orcamento', 'os')),
  quote_id UUID REFERENCES public.quotes(id) ON DELETE RESTRICT,
  service_order_id UUID REFERENCES public.service_orders(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,       -- NULL = Consumidor final
  customer_name TEXT NOT NULL DEFAULT 'Consumidor final',
  customer_person_type TEXT NOT NULL DEFAULT 'PF' CHECK (customer_person_type IN ('PF', 'PJ')),
  customer_document TEXT,
  invoice_document TEXT,
  address_id UUID REFERENCES public.customer_addresses(id) ON DELETE SET NULL,
  address_text TEXT,
  seller_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  seller_name TEXT,
  products_subtotal_cents BIGINT NOT NULL DEFAULT 0 CHECK (products_subtotal_cents >= 0),
  services_subtotal_cents BIGINT NOT NULL DEFAULT 0 CHECK (services_subtotal_cents >= 0),
  general_discount_cents BIGINT NOT NULL DEFAULT 0 CHECK (general_discount_cents >= 0),
  freight_cents BIGINT NOT NULL DEFAULT 0 CHECK (freight_cents >= 0),
  total_cents BIGINT NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  paid_cents BIGINT NOT NULL DEFAULT 0 CHECK (paid_cents >= 0),
  change_cents BIGINT NOT NULL DEFAULT 0 CHECK (change_cents >= 0),
  notes TEXT,
  cancel_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by_name TEXT,
  busca TEXT NOT NULL DEFAULT '',
  created_by UUID DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (paid_cents <= total_cents)
);
CREATE INDEX IF NOT EXISTS sales_criada_idx ON public.sales (created_at DESC);
CREATE INDEX IF NOT EXISTS sales_cliente_idx ON public.sales (customer_id);
CREATE INDEX IF NOT EXISTS sales_busca_trgm_idx ON public.sales USING gin (busca extensions.gin_trgm_ops);
-- Um orçamento vira no máximo uma venda que esteja valendo
CREATE UNIQUE INDEX IF NOT EXISTS sales_orcamento_key ON public.sales (quote_id) WHERE quote_id IS NOT NULL AND status = 'ativa';
DROP TRIGGER IF EXISTS set_updated_at ON public.sales;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_venda_fkey;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_venda_fkey
  FOREIGN KEY (converted_sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  catalog_item_id UUID REFERENCES public.catalog_items(id) ON DELETE SET NULL,
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
CREATE INDEX IF NOT EXISTS sale_items_venda_idx ON public.sale_items (sale_id, sort_order);
CREATE INDEX IF NOT EXISTS sale_items_catalogo_idx ON public.sale_items (catalog_item_id) WHERE catalog_item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('dinheiro', 'pix', 'debito', 'credito', 'boleto', 'transferencia', 'cheque')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  tendered_cents BIGINT,
  change_cents BIGINT NOT NULL DEFAULT 0 CHECK (change_cents >= 0),
  account_id UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
  account_name TEXT NOT NULL,
  card_machine_id UUID REFERENCES public.card_machines(id) ON DELETE RESTRICT,
  card_machine_name TEXT,
  installments INTEGER NOT NULL DEFAULT 1 CHECK (installments BETWEEN 1 AND 24),
  estimated_fee_percent NUMERIC(6,3),
  estimated_fee_cents BIGINT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID DEFAULT auth.uid(),
  created_by_name TEXT NOT NULL,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS sale_payments_venda_idx ON public.sale_payments (sale_id, paid_at);

CREATE TABLE IF NOT EXISTS public.sale_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  "group" TEXT NOT NULL CHECK ("group" IN ('produtos', 'servicos')),
  model TEXT NOT NULL CHECK (model IN ('nfce', 'nfe', 'nfse')),
  status TEXT NOT NULL DEFAULT 'nao_emitida' CHECK (status IN ('nao_emitida', 'emitindo', 'emitida', 'cancelada', 'erro')),
  amount_cents BIGINT NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  number TEXT,
  series TEXT,
  access_key TEXT,
  xml_url TEXT,                                -- o arquivo fica na HostGator ou no provedor, nunca no banco
  pdf_url TEXT,
  error_message TEXT,
  cancel_reason TEXT,
  issued_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  UNIQUE (sale_id, "group")
);

CREATE TABLE IF NOT EXISTS public.sale_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  actor_id UUID DEFAULT auth.uid(),
  actor_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sale_events_venda_idx ON public.sale_events (sale_id, created_at DESC);

DO $rls$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sales', 'sale_items', 'sale_payments', 'sale_documents', 'sale_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('DROP POLICY IF EXISTS "Escritório lê" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Escritório lê" ON public.%I FOR SELECT TO authenticated USING ((SELECT public.eh_escritorio()))', t);
    -- Nenhuma política de escrita: só as funções venda_*
  END LOOP;
END
$rls$;

-- ---------------------------------------------------------------------
-- 3. Movimentos financeiros (imutáveis)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financial_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_date DATE NOT NULL,                 -- dia em que o dinheiro entra ou sai da conta
  direction TEXT NOT NULL CHECK (direction IN ('entrada', 'saida')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  account_id UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES public.financial_categories(id) ON DELETE RESTRICT,
  method TEXT NOT NULL CHECK (method IN ('dinheiro', 'pix', 'debito', 'credito', 'boleto', 'transferencia', 'cheque')),
  origin_type TEXT NOT NULL CHECK (origin_type IN ('venda', 'os', 'avulso', 'transferencia', 'caixa', 'tarifa_cartao')),
  sale_id UUID REFERENCES public.sales(id) ON DELETE RESTRICT,
  sale_payment_id UUID REFERENCES public.sale_payments(id) ON DELETE RESTRICT,
  service_order_id UUID REFERENCES public.service_orders(id) ON DELETE RESTRICT,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  customer_name TEXT,                          -- texto no momento do lançamento (não muda ao unir clientes)
  description TEXT NOT NULL,
  reverses_movement_id UUID REFERENCES public.financial_movements(id) ON DELETE RESTRICT,
  reversal_reason TEXT,
  transfer_pair_id UUID,
  created_by UUID DEFAULT auth.uid(),
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS financial_movements_estorno_key ON public.financial_movements (reverses_movement_id) WHERE reverses_movement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS financial_movements_conta_idx ON public.financial_movements (account_id, occurred_date);
CREATE INDEX IF NOT EXISTS financial_movements_data_idx ON public.financial_movements (occurred_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS financial_movements_venda_idx ON public.financial_movements (sale_id) WHERE sale_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.movimento_imutavel()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Movimento financeiro não se altera nem se apaga. Use o estorno.' USING ERRCODE = '23514';
END;
$$;
DROP TRIGGER IF EXISTS financial_movements_imutavel ON public.financial_movements;
CREATE TRIGGER financial_movements_imutavel BEFORE UPDATE OR DELETE ON public.financial_movements
  FOR EACH ROW EXECUTE FUNCTION public.movimento_imutavel();

ALTER TABLE public.financial_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.financial_movements FROM anon;
DROP POLICY IF EXISTS "Financeiro completo lê" ON public.financial_movements;
CREATE POLICY "Financeiro completo lê" ON public.financial_movements FOR SELECT TO authenticated
  USING ((SELECT public.nivel_financeiro()) = 'completo');

-- ---------------------------------------------------------------------
-- 4. Contas e maquininhas para as telas (o nível "caixa" escolhe a conta, mas não vê saldo)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.financeiro_contas()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_nivel TEXT := public.nivel_financeiro();
BEGIN
  IF v_nivel = 'nenhum' THEN
    RETURN '[]'::jsonb;
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', a.id, 'name', a.name, 'kind', a.kind, 'active', a.active,
             'initial_balance_cents', CASE WHEN v_nivel = 'completo' THEN a.initial_balance_cents ELSE 0 END,
             'current_balance_cents', CASE WHEN v_nivel = 'completo' THEN a.initial_balance_cents + coalesce((
                 SELECT sum(CASE WHEN m.direction = 'entrada' THEN m.amount_cents ELSE -m.amount_cents END)
                   FROM public.financial_movements m
                  WHERE m.account_id = a.id AND m.occurred_date <= public.hoje_local()), 0) ELSE 0 END)
           ORDER BY a.sort_order, a.name)
      FROM public.financial_accounts a), '[]'::jsonb);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.financeiro_contas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.financeiro_contas() TO authenticated;

CREATE OR REPLACE FUNCTION public.financeiro_maquininhas()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF public.nivel_financeiro() = 'nenhum' THEN
    RETURN '[]'::jsonb;
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', m.id, 'name', m.name, 'settlement_account_id', m.settlement_account_id,
             'settlement_account_name', a.name, 'settlement_business_days', m.settlement_business_days,
             'debit_fee_percent', m.debit_fee_percent, 'credit_sight_fee_percent', m.credit_sight_fee_percent,
             'credit_installment_rates', m.credit_installment_rates, 'active', m.active)
           ORDER BY m.created_at, m.name)
      FROM public.card_machines m JOIN public.financial_accounts a ON a.id = m.settlement_account_id), '[]'::jsonb);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.financeiro_maquininhas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.financeiro_maquininhas() TO authenticated;

CREATE OR REPLACE FUNCTION public.financeiro_categorias()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF public.nivel_financeiro() = 'nenhum' THEN
    RETURN '[]'::jsonb;
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'kind', c.kind, 'active', c.active) ORDER BY c.kind DESC, c.name)
      FROM public.financial_categories c), '[]'::jsonb);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.financeiro_categorias() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.financeiro_categorias() TO authenticated;

-- ---------------------------------------------------------------------
-- 5. Apoio das vendas (uso interno)
-- ---------------------------------------------------------------------
-- p_data + N dias úteis (segunda a sexta)
CREATE OR REPLACE FUNCTION public.somar_dias_uteis(p_data DATE, p_dias INTEGER)
RETURNS DATE
LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
DECLARE
  v_dia DATE := p_data;
  v_faltam INTEGER := greatest(coalesce(p_dias, 0), 0);
BEGIN
  WHILE v_faltam > 0 LOOP
    v_dia := v_dia + 1;
    IF extract(isodow FROM v_dia) < 6 THEN
      v_faltam := v_faltam - 1;
    END IF;
  END LOOP;
  RETURN v_dia;
END;
$$;

CREATE OR REPLACE FUNCTION public.venda_evento(p_venda UUID, p_texto TEXT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  INSERT INTO public.sale_events (sale_id, description, actor_name, created_at)
  VALUES (p_venda, p_texto, public.vendas_ator_nome(), clock_timestamp());
$$;
REVOKE EXECUTE ON FUNCTION public.venda_evento(UUID, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.venda_atualiza_busca(p_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  UPDATE public.sales s
     SET busca = public.sem_acento(
           s.number || ' ' || s.customer_name || ' ' || coalesce(s.seller_name, '') || ' ' ||
           coalesce((SELECT q.number FROM public.quotes q WHERE q.id = s.quote_id), '') || ' ' ||
           coalesce((SELECT o.number::text FROM public.service_orders o WHERE o.id = s.service_order_id), '') || ' ' ||
           coalesce((SELECT string_agg(i.code || ' ' || i.name, ' ') FROM public.sale_items i WHERE i.sale_id = s.id), '') || ' ' ||
           coalesce((SELECT string_agg(d.number, ' ') FROM public.sale_documents d WHERE d.sale_id = s.id AND d.number IS NOT NULL), ''))
   WHERE s.id = p_id;
$$;
REVOKE EXECUTE ON FUNCTION public.venda_atualiza_busca(UUID) FROM PUBLIC, anon, authenticated;

-- Lança os pagamentos de uma venda: sale_payments + movimentos (e a tarifa do cartão). Usada por concluir e receber.
CREATE OR REPLACE FUNCTION public.venda_lancar_pagamentos(p_venda UUID, p_pagamentos JSONB, p_data DATE)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  s public.sales%ROWTYPE;
  pg JSONB;
  v_metodo TEXT;
  v_valor BIGINT; v_entregue BIGINT; v_troco BIGINT;
  v_conta public.financial_accounts%ROWTYPE;
  v_maq public.card_machines%ROWTYPE;
  v_parcelas INTEGER;
  v_taxa NUMERIC; v_taxa_cents BIGINT;
  v_soma BIGINT := 0; v_soma_troco BIGINT := 0;
  v_pag_id UUID;
  v_dia DATE; v_dia_mov DATE;
  v_momento TIMESTAMPTZ;
  v_categoria UUID; v_categoria_tarifa UUID;
  v_ator TEXT := public.vendas_ator_nome();
  v_cartao BOOLEAN;
BEGIN
  IF jsonb_typeof(p_pagamentos) IS DISTINCT FROM 'array' OR jsonb_array_length(p_pagamentos) = 0 THEN
    RETURN 0;
  END IF;
  IF public.nivel_financeiro() NOT IN ('caixa', 'completo') THEN
    RAISE EXCEPTION 'Seu usuário não tem acesso ao financeiro para registrar pagamentos.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO s FROM public.sales WHERE id = p_venda FOR UPDATE;
  v_dia := coalesce(p_data, public.hoje_local());
  IF v_dia > public.hoje_local() THEN
    RAISE EXCEPTION 'A data do recebimento não pode ser no futuro.' USING ERRCODE = '23514';
  END IF;
  -- Nunca data sem hora em TIMESTAMPTZ: hoje = agora; dia passado = 23:59 de Niterói
  v_momento := CASE WHEN v_dia = public.hoje_local() THEN NOW()
                    ELSE (v_dia + TIME '23:59') AT TIME ZONE 'America/Sao_Paulo' END;

  SELECT id INTO v_categoria FROM public.financial_categories
   WHERE system_key = CASE WHEN s.products_subtotal_cents = 0 THEN 'servico' ELSE 'venda_loja' END;
  SELECT id INTO v_categoria_tarifa FROM public.financial_categories WHERE system_key = 'tarifa_cartao';

  FOR pg IN SELECT value FROM jsonb_array_elements(p_pagamentos) LOOP
    v_metodo := pg->>'method';
    v_valor := round(coalesce((pg->>'amount_cents')::numeric, 0));
    CONTINUE WHEN v_valor = 0;
    IF v_valor < 0 THEN
      RAISE EXCEPTION 'Pagamento com valor negativo.' USING ERRCODE = '23514';
    END IF;
    IF v_metodo IS NULL OR v_metodo NOT IN ('dinheiro', 'pix', 'debito', 'credito', 'boleto', 'transferencia', 'cheque') THEN
      RAISE EXCEPTION 'Forma de pagamento inválida.' USING ERRCODE = '23514';
    END IF;

    v_cartao := v_metodo IN ('debito', 'credito');
    v_maq := NULL; v_conta := NULL; v_taxa := NULL; v_taxa_cents := NULL;
    v_entregue := NULL; v_troco := 0;
    v_parcelas := CASE WHEN v_metodo = 'credito' THEN least(greatest(coalesce((pg->>'installments')::int, 1), 1), 24) ELSE 1 END;

    IF v_cartao THEN
      SELECT * INTO v_maq FROM public.card_machines WHERE id = nullif(pg->>'card_machine_id', '')::uuid AND active;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Escolha a maquininha do pagamento em cartão.' USING ERRCODE = '23514';
      END IF;
      SELECT * INTO v_conta FROM public.financial_accounts WHERE id = v_maq.settlement_account_id;
      IF v_metodo = 'debito' THEN
        v_taxa := v_maq.debit_fee_percent;
      ELSIF v_parcelas = 1 THEN
        v_taxa := v_maq.credit_sight_fee_percent;
      ELSE
        -- Taxa da quantidade de parcelas; sem ela, a da maior faixa cadastrada; sem faixa, a de 1x
        SELECT (f->>'fee_percent')::numeric INTO v_taxa
          FROM jsonb_array_elements(v_maq.credit_installment_rates) f
         ORDER BY ((f->>'installments')::int = v_parcelas) DESC, (f->>'installments')::int DESC
         LIMIT 1;
        v_taxa := coalesce(v_taxa, v_maq.credit_sight_fee_percent);
      END IF;
      v_taxa_cents := round(v_valor * v_taxa / 100.0);
      v_dia_mov := public.somar_dias_uteis(v_dia, v_maq.settlement_business_days);
    ELSE
      IF v_metodo = 'dinheiro' THEN
        SELECT * INTO v_conta FROM public.financial_accounts
         WHERE active AND kind = 'caixa'
         ORDER BY (id = nullif(pg->>'account_id', '')::uuid) DESC NULLS LAST, sort_order, name LIMIT 1;
        v_entregue := round((pg->>'tendered_cents')::numeric);
        IF v_entregue IS NOT NULL AND v_entregue > v_valor THEN
          v_troco := v_entregue - v_valor;
        ELSE
          v_entregue := NULL;
        END IF;
      ELSE
        SELECT * INTO v_conta FROM public.financial_accounts WHERE id = nullif(pg->>'account_id', '')::uuid AND active;
      END IF;
      IF v_conta.id IS NULL THEN
        RAISE EXCEPTION 'Escolha a conta que vai receber o pagamento.' USING ERRCODE = '23514';
      END IF;
      v_dia_mov := v_dia;
    END IF;

    INSERT INTO public.sale_payments (sale_id, method, amount_cents, tendered_cents, change_cents, account_id, account_name,
                                      card_machine_id, card_machine_name, installments, estimated_fee_percent,
                                      estimated_fee_cents, paid_at, created_by_name, notes)
    VALUES (p_venda, v_metodo, v_valor, v_entregue, v_troco, v_conta.id, v_conta.name,
            v_maq.id, v_maq.name, v_parcelas, v_taxa, v_taxa_cents, v_momento, v_ator,
            nullif(btrim(coalesce(pg->>'notes', '')), ''))
    RETURNING id INTO v_pag_id;

    INSERT INTO public.financial_movements (occurred_date, direction, amount_cents, account_id, category_id, method,
                                            origin_type, sale_id, sale_payment_id, service_order_id, customer_name,
                                            description, created_by_name)
    VALUES (v_dia_mov, 'entrada', v_valor, v_conta.id, v_categoria, v_metodo, 'venda', p_venda, v_pag_id,
            s.service_order_id, s.customer_name, format('Recebimento %s — %s', s.number, s.customer_name), v_ator);

    IF coalesce(v_taxa_cents, 0) > 0 THEN
      INSERT INTO public.financial_movements (occurred_date, direction, amount_cents, account_id, category_id, method,
                                              origin_type, sale_id, sale_payment_id, description, created_by_name)
      VALUES (v_dia_mov, 'saida', v_taxa_cents, v_conta.id, v_categoria_tarifa, v_metodo, 'tarifa_cartao', p_venda, v_pag_id,
              format('Tarifa %s (%s%% — %s)', v_maq.name, replace(trim_scale(v_taxa)::text, '.', ','), s.number), v_ator);
    END IF;

    v_soma := v_soma + v_valor;
    v_soma_troco := v_soma_troco + v_troco;
  END LOOP;

  IF v_soma > s.total_cents - s.paid_cents THEN
    RAISE EXCEPTION 'A soma dos pagamentos (%) passa do saldo a receber (%).',
      public.formatar_reais(v_soma), public.formatar_reais(s.total_cents - s.paid_cents) USING ERRCODE = '23514';
  END IF;
  UPDATE public.sales SET paid_cents = paid_cents + v_soma, change_cents = change_cents + v_soma_troco WHERE id = p_venda;
  RETURN v_soma;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.venda_lancar_pagamentos(UUID, JSONB, DATE) FROM PUBLIC, anon, authenticated;

-- Venda completa em JSON (tipo Sale de src/types/vendas.ts)
CREATE OR REPLACE FUNCTION public.venda_json(p_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT to_jsonb(s) - 'busca' - 'created_by'
         || jsonb_build_object(
              'quote_number', (SELECT q.number FROM public.quotes q WHERE q.id = s.quote_id),
              'service_order_number', (SELECT o.number FROM public.service_orders o WHERE o.id = s.service_order_id),
              'items', coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.sort_order)
                                   FROM public.sale_items i WHERE i.sale_id = s.id), '[]'::jsonb),
              'payments', coalesce((SELECT jsonb_agg(to_jsonb(p) - 'created_by' ORDER BY p.paid_at, p.id)
                                      FROM public.sale_payments p WHERE p.sale_id = s.id), '[]'::jsonb),
              'documents', coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d."group")
                                       FROM public.sale_documents d WHERE d.sale_id = s.id), '[]'::jsonb),
              'events', coalesce((SELECT jsonb_agg(to_jsonb(e) - 'actor_id' ORDER BY e.created_at DESC)
                                    FROM public.sale_events e WHERE e.sale_id = s.id), '[]'::jsonb))
    FROM public.sales s
   WHERE s.id = p_id;
$$;
REVOKE EXECUTE ON FUNCTION public.venda_json(UUID) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Funções da tela de vendas
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.venda_buscar(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  RETURN public.venda_json(p_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.venda_buscar(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.venda_buscar(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendas_listar(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_termo TEXT := public.sem_acento(btrim(coalesce(p->>'busca', '')));
  v_chip TEXT := coalesce(nullif(p->>'chip', ''), 'todas');
  v_sit TEXT := coalesce(nullif(p->>'situacao', ''), 'todas');
  v_forma TEXT := coalesce(nullif(p->>'forma', ''), 'todas');
  v_origem TEXT := coalesce(nullif(p->>'origem', ''), 'todas');
  v_nota TEXT := coalesce(nullif(p->>'status_nota', ''), 'todas');
  v_ini DATE := nullif(p->>'data_inicio', '')::date;
  v_fim DATE := nullif(p->>'data_fim', '')::date;
  v_pagina INTEGER := greatest(coalesce((p->>'pagina')::int, 0), 0);
  v_por INTEGER := least(greatest(coalesce((p->>'por_pagina')::int, 50), 1), 200);
  v_res JSONB;
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;

  WITH todas AS (
    SELECT s.id, s.created_at, s.status, s.origin_type, s.total_cents, s.paid_cents, s.busca,
           CASE WHEN s.status = 'cancelada' THEN 'cancelada'
                WHEN s.paid_cents >= s.total_cents AND s.total_cents > 0 THEN 'paga'
                WHEN s.paid_cents > 0 THEN 'parcial'
                ELSE 'aberta' END AS sit
      FROM public.sales s
  ),
  filtradas AS (
    SELECT t.* FROM todas t
     WHERE (v_termo = '' OR t.busca LIKE '%' || v_termo || '%')
       AND (v_chip <> 'a_receber' OR t.sit IN ('aberta', 'parcial'))
       AND (v_chip <> 'canceladas' OR t.sit = 'cancelada')
       AND (v_sit = 'todas' OR t.sit = v_sit)
       AND (v_origem = 'todas' OR t.origin_type = v_origem)
       AND (v_forma = 'todas' OR EXISTS (SELECT 1 FROM public.sale_payments g WHERE g.sale_id = t.id AND g.method = v_forma))
       AND (v_nota = 'todas' OR EXISTS (SELECT 1 FROM public.sale_documents d WHERE d.sale_id = t.id AND d.status =
             CASE v_nota WHEN 'com_nota_emitida' THEN 'emitida' WHEN 'com_nota_pendente' THEN 'nao_emitida' ELSE 'erro' END))
       -- Período pelo dia de Niterói (venda depois das 21h não pula para o dia seguinte)
       AND (v_ini IS NULL OR (t.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= v_ini)
       AND (v_fim IS NULL OR (t.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= v_fim)
  ),
  pagina AS (
    SELECT id, created_at FROM filtradas ORDER BY created_at DESC, id OFFSET v_pagina * v_por LIMIT v_por
  )
  SELECT jsonb_build_object(
    'itens', coalesce((SELECT jsonb_agg(public.venda_json(g.id) ORDER BY g.created_at DESC, g.id) FROM pagina g), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtradas),
    'soma_total_cents', (SELECT coalesce(sum(total_cents), 0) FROM filtradas WHERE status = 'ativa'),
    'soma_recebido_cents', (SELECT coalesce(sum(paid_cents), 0) FROM filtradas WHERE status = 'ativa'),
    'soma_a_receber_cents', (SELECT coalesce(sum(total_cents - paid_cents), 0) FROM filtradas WHERE status = 'ativa'),
    'contagens', jsonb_build_object(
      'todas', (SELECT count(*) FROM todas),
      'a_receber', (SELECT count(*) FROM todas WHERE sit IN ('aberta', 'parcial')),
      'canceladas', (SELECT count(*) FROM todas WHERE sit = 'cancelada')))
  INTO v_res;
  RETURN v_res;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.vendas_listar(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendas_listar(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.venda_concluir(p JSONB)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_id UUID;
  v_numero TEXT;
  v_orc public.quotes%ROWTYPE;
  v_orc_id UUID := nullif(p->>'quote_id', '')::uuid;
  v_os UUID := nullif(p->>'service_order_id', '')::uuid;
  v_cliente UUID := nullif(p->>'customer_id', '')::uuid;
  v_nome TEXT; v_tipo TEXT; v_doc TEXT; v_doc_nota TEXT;
  v_end UUID := nullif(p->>'address_id', '')::uuid;
  v_end_texto TEXT := nullif(btrim(coalesce(p->>'address_text', '')), '');
  v_vend UUID := nullif(p->>'seller_id', '')::uuid;
  v_vend_nome TEXT;
  v_item JSONB; v_ordem BIGINT;
  v_qtd NUMERIC; v_unit BIGINT; v_modo TEXT; v_ent NUMERIC; v_kind TEXT; v_cat UUID; v_avulso BOOLEAN; v_nome_item TEXT;
  v_linha RECORD;
  v_prod BIGINT := 0; v_serv BIGINT := 0; v_bruto BIGINT := 0; v_desc_linhas BIGINT := 0;
  v_desc BIGINT; v_frete BIGINT; v_total BIGINT;
  v_desc_prod BIGINT; v_modelo TEXT;
  v_pago BIGINT;
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'items') = 0 THEN
    RAISE EXCEPTION 'Adicione ao menos um item ao carrinho antes de concluir a venda.' USING ERRCODE = '23514';
  END IF;

  IF v_orc_id IS NOT NULL THEN
    SELECT * INTO v_orc FROM public.quotes WHERE id = v_orc_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Orçamento não encontrado.' USING ERRCODE = 'P0002';
    END IF;
    IF v_orc.status = 'convertido' OR v_orc.converted_sale_id IS NOT NULL OR v_orc.converted_service_order_id IS NOT NULL THEN
      RAISE EXCEPTION 'Este orçamento já foi convertido.' USING ERRCODE = '23514';
    END IF;
    -- Endereço do orçamento, se a venda é para o mesmo cliente e não veio outro
    IF v_end IS NULL AND v_cliente IS NOT DISTINCT FROM v_orc.customer_id THEN
      v_end := v_orc.address_id;
      v_end_texto := coalesce(v_end_texto, v_orc.address_text);
    END IF;
  END IF;

  IF v_cliente IS NOT NULL THEN
    SELECT c.name, c.person_type, c.document INTO v_nome, v_tipo, v_doc FROM public.customers c WHERE c.id = v_cliente;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente não encontrado.' USING ERRCODE = 'P0002';
    END IF;
    IF v_end IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.customer_addresses a WHERE a.id = v_end AND a.customer_id = v_cliente) THEN
      v_end := NULL;
    END IF;
    IF v_end IS NULL THEN
      SELECT a.id INTO v_end FROM public.customer_addresses a
       WHERE a.customer_id = v_cliente AND a.active ORDER BY a.is_primary DESC, a.created_at LIMIT 1;
    END IF;
    IF v_end_texto IS NULL AND v_end IS NOT NULL THEN
      SELECT concat_ws(', ', nullif(a.street, ''), nullif(a.number, ''), nullif(a.complement, ''), nullif(a.district, ''), nullif(a.city, ''))
        INTO v_end_texto FROM public.customer_addresses a WHERE a.id = v_end;
    END IF;
    v_doc_nota := v_doc;
  ELSE
    v_nome := 'Consumidor final';
    v_tipo := CASE WHEN p->>'customer_person_type' = 'PJ' THEN 'PJ' ELSE 'PF' END;
    v_doc := NULL;
    v_end := NULL;
    v_end_texto := NULL;
    v_doc_nota := nullif(btrim(coalesce(p->>'invoice_document', '')), '');
  END IF;

  -- OS: só do próprio cliente
  IF v_os IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.service_orders o WHERE o.id = v_os AND o.customer_id = v_cliente) THEN
    RAISE EXCEPTION 'A OS informada não é deste cliente.' USING ERRCODE = '23514';
  END IF;

  IF v_vend IS NOT NULL THEN
    SELECT e.name INTO v_vend_nome FROM public.employees e WHERE e.id = v_vend AND e.active;
    IF NOT FOUND THEN v_vend := NULL; END IF;
  END IF;
  IF v_vend IS NULL THEN
    v_vend := public.meu_funcionario_id();
    SELECT e.name INTO v_vend_nome FROM public.employees e WHERE e.id = v_vend;
  END IF;

  INSERT INTO public.sales (origin_type, quote_id, service_order_id, customer_id, customer_name, customer_person_type,
                            customer_document, invoice_document, address_id, address_text, seller_id, seller_name, notes)
  VALUES (CASE WHEN v_orc_id IS NOT NULL THEN 'orcamento' WHEN v_os IS NOT NULL THEN 'os' ELSE 'balcao' END,
          v_orc_id, v_os, v_cliente, v_nome, v_tipo, v_doc, v_doc_nota, v_end, v_end_texto, v_vend, v_vend_nome,
          nullif(btrim(coalesce(p->>'notes', '')), ''))
  RETURNING id, number INTO v_id, v_numero;

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
    INSERT INTO public.sale_items (sale_id, catalog_item_id, is_custom, kind, code, name, unit, quantity,
                                   unit_price_cents, discount_mode, discount_input, discount_cents, total_cents, sort_order)
    VALUES (v_id, v_cat, v_avulso OR v_cat IS NULL, v_kind,
            coalesce(nullif(btrim(v_item->>'code'), ''), CASE WHEN v_cat IS NULL THEN 'AVULSO' ELSE 'ITEM' END),
            v_nome_item,
            coalesce(nullif(btrim(v_item->>'unit'), ''), CASE WHEN v_kind = 'servico' THEN 'SRV' ELSE 'UN' END),
            v_qtd, v_unit, v_modo, v_ent, v_linha.desconto, v_linha.total, v_ordem);

    v_bruto := v_bruto + v_linha.bruto;
    v_desc_linhas := v_desc_linhas + v_linha.desconto;
    IF v_kind = 'produto' THEN v_prod := v_prod + v_linha.total; ELSE v_serv := v_serv + v_linha.total; END IF;
  END LOOP;

  v_desc := least(v_prod + v_serv, greatest(round(coalesce((p->>'general_discount_cents')::numeric, 0)), 0));
  v_frete := greatest(round(coalesce((p->>'freight_cents')::numeric, 0)), 0);
  v_total := v_prod + v_serv - v_desc + v_frete;

  IF v_bruto > 0 AND (v_desc_linhas + v_desc) * 100.0 / v_bruto > 10.005 AND public.nivel_financeiro() <> 'completo' THEN
    RAISE EXCEPTION 'Desconto acima de 10%% só com acesso financeiro completo.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.sales SET products_subtotal_cents = v_prod, services_subtotal_cents = v_serv,
         general_discount_cents = v_desc, freight_cents = v_frete, total_cents = v_total
   WHERE id = v_id;

  -- Valor de cada nota: o desconto geral é repartido na proporção; o frete vai na nota de produtos (se houver).
  -- As duas somadas dão exatamente o total da venda.
  v_desc_prod := CASE WHEN v_prod + v_serv = 0 THEN 0 ELSE round(v_desc * v_prod::numeric / (v_prod + v_serv)) END;
  IF v_prod > 0 THEN
    v_modelo := p->>'preferred_product_invoice_model';
    IF v_modelo IS NULL OR v_modelo NOT IN ('nfce', 'nfe') THEN
      v_modelo := CASE WHEN v_tipo = 'PJ' OR length(regexp_replace(coalesce(v_doc_nota, ''), '[^A-Za-z0-9]', '', 'g')) = 14
                       THEN 'nfe' ELSE 'nfce' END;
    END IF;
    INSERT INTO public.sale_documents (sale_id, "group", model, amount_cents)
    VALUES (v_id, 'produtos', v_modelo, v_prod - v_desc_prod + v_frete);
  END IF;
  IF v_serv > 0 THEN
    INSERT INTO public.sale_documents (sale_id, "group", model, amount_cents)
    VALUES (v_id, 'servicos', 'nfse', v_serv - (v_desc - v_desc_prod) + CASE WHEN v_prod > 0 THEN 0 ELSE v_frete END);
  END IF;

  PERFORM public.venda_evento(v_id, format('Venda %s concluída (%s).', v_numero, public.formatar_reais(v_total)));
  v_pago := public.venda_lancar_pagamentos(v_id, coalesce(p->'payments', '[]'::jsonb), NULL);

  IF v_pago < v_total AND v_cliente IS NULL THEN
    RAISE EXCEPTION 'Para deixar a venda a receber, escolha um cliente cadastrado.' USING ERRCODE = '23514';
  END IF;

  IF v_orc_id IS NOT NULL THEN
    UPDATE public.quotes SET status = 'convertido', converted_sale_id = v_id, converted_sale_number = v_numero WHERE id = v_orc_id;
    PERFORM public.orcamento_evento(v_orc_id, 'convertido_venda', format('Convertido na venda %s.', v_numero));
  END IF;

  PERFORM public.venda_atualiza_busca(v_id);
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.venda_concluir(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.venda_concluir(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.venda_receber(p_id UUID, p_pagamentos JSONB, p_data DATE DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  s public.sales%ROWTYPE;
  v_pago BIGINT;
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO s FROM public.sales WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF s.status = 'cancelada' THEN
    RAISE EXCEPTION 'Não é possível receber em uma venda cancelada.' USING ERRCODE = '23514';
  END IF;
  v_pago := public.venda_lancar_pagamentos(p_id, p_pagamentos, p_data);
  IF v_pago <= 0 THEN
    RAISE EXCEPTION 'Informe ao menos um pagamento com valor maior que zero.' USING ERRCODE = '23514';
  END IF;
  PERFORM public.venda_evento(p_id, format('Recebido %s.', public.formatar_reais(v_pago)));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.venda_receber(UUID, JSONB, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.venda_receber(UUID, JSONB, DATE) TO authenticated;

-- Cancelar: estorna todos os movimentos da venda (o pagamento fica registrado; o dinheiro volta pelo estorno)
CREATE OR REPLACE FUNCTION public.venda_cancelar(p_id UUID, p_motivo TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  s public.sales%ROWTYPE;
  d public.sale_documents%ROWTYPE;
  v_motivo TEXT := btrim(coalesce(p_motivo, ''));
  v_ator TEXT := public.vendas_ator_nome();
BEGIN
  IF NOT public.eh_escritorio() OR public.nivel_financeiro() <> 'completo' THEN
    RAISE EXCEPTION 'Só o acesso financeiro completo cancela venda.' USING ERRCODE = '42501';
  END IF;
  IF v_motivo = '' THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento da venda.' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO s FROM public.sales WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF s.status = 'cancelada' THEN
    RAISE EXCEPTION 'Esta venda já está cancelada.' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO d FROM public.sale_documents WHERE sale_id = p_id AND status = 'emitida' LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Esta venda tem nota fiscal emitida (% nº %). Cancele a nota primeiro.', upper(d.model), d.number USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.financial_movements (occurred_date, direction, amount_cents, account_id, category_id, method, origin_type,
                                          sale_id, sale_payment_id, service_order_id, customer_name, description,
                                          reverses_movement_id, reversal_reason, created_by_name)
  SELECT greatest(public.hoje_local(), m.occurred_date),   -- cartão ainda não caído: estorna na data prevista
         CASE m.direction WHEN 'entrada' THEN 'saida' ELSE 'entrada' END,
         m.amount_cents, m.account_id, m.category_id, m.method, m.origin_type, m.sale_id, m.sale_payment_id,
         m.service_order_id, m.customer_name, 'Estorno: ' || m.description, m.id, v_motivo, v_ator
    FROM public.financial_movements m
   WHERE m.sale_id = p_id AND m.reverses_movement_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.financial_movements e WHERE e.reverses_movement_id = m.id);

  UPDATE public.sales SET status = 'cancelada', cancel_reason = v_motivo, cancelled_at = NOW(), cancelled_by_name = v_ator
   WHERE id = p_id;
  PERFORM public.venda_evento(p_id, format('Venda cancelada%s. Motivo: %s',
    CASE WHEN s.paid_cents > 0 THEN ' (pagamentos estornados)' ELSE '' END, v_motivo));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.venda_cancelar(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.venda_cancelar(UUID, TEXT) TO authenticated;

-- Número de uma nota emitida fora do sistema (portal da NFS-e ou emissor do SicWeb)
CREATE OR REPLACE FUNCTION public.venda_registrar_nota(p_id UUID, p_modelo TEXT, p_numero TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  s public.sales%ROWTYPE;
  d public.sale_documents%ROWTYPE;
  v_grupo TEXT := CASE WHEN p_modelo = 'nfse' THEN 'servicos' ELSE 'produtos' END;
  v_numero TEXT := left(btrim(coalesce(p_numero, '')), 60);
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF p_modelo IS NULL OR p_modelo NOT IN ('nfce', 'nfe', 'nfse') THEN
    RAISE EXCEPTION 'Modelo de nota inválido.' USING ERRCODE = '23514';
  END IF;
  IF v_numero = '' THEN
    RAISE EXCEPTION 'Informe o número da nota fiscal emitida.' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO s FROM public.sales WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF s.status = 'cancelada' THEN
    RAISE EXCEPTION 'Venda cancelada não recebe nota.' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO d FROM public.sale_documents WHERE sale_id = p_id AND "group" = v_grupo;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta venda não tem itens para essa nota.' USING ERRCODE = '23514';
  END IF;
  IF d.status = 'emitida' THEN
    RAISE EXCEPTION 'Já há uma nota registrada (nº %). Cancele-a antes de registrar outra.', d.number USING ERRCODE = '23514';
  END IF;

  UPDATE public.sale_documents SET model = p_modelo, status = 'emitida', number = v_numero, series = NULL,
         access_key = NULL, xml_url = NULL, pdf_url = NULL, error_message = NULL, cancel_reason = NULL,
         issued_at = NOW(), cancelled_at = NULL
   WHERE id = d.id;
  PERFORM public.venda_evento(p_id, format('Registrada a %s nº %s, emitida fora do sistema.',
    CASE p_modelo WHEN 'nfse' THEN 'NFS-e' WHEN 'nfe' THEN 'NF-e' ELSE 'NFC-e' END, v_numero));
  PERFORM public.venda_atualiza_busca(p_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.venda_registrar_nota(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.venda_registrar_nota(UUID, TEXT, TEXT) TO authenticated;

-- Marca a nota como cancelada (o cancelamento fiscal é feito onde ela foi emitida)
CREATE OR REPLACE FUNCTION public.venda_cancelar_nota(p_nota UUID, p_motivo TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  d public.sale_documents%ROWTYPE;
  v_motivo TEXT := btrim(coalesce(p_motivo, ''));
BEGIN
  IF NOT public.eh_escritorio() OR public.nivel_financeiro() <> 'completo' THEN
    RAISE EXCEPTION 'Só o acesso financeiro completo cancela nota.' USING ERRCODE = '42501';
  END IF;
  IF v_motivo = '' THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento da nota fiscal.' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO d FROM public.sale_documents WHERE id = p_nota FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota fiscal não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF d.status <> 'emitida' THEN
    RAISE EXCEPTION 'Só uma nota emitida pode ser cancelada.' USING ERRCODE = '23514';
  END IF;
  UPDATE public.sale_documents SET status = 'cancelada', cancel_reason = v_motivo, cancelled_at = NOW() WHERE id = p_nota;
  PERFORM public.venda_evento(d.sale_id, format('%s nº %s marcada como cancelada. Motivo: %s',
    CASE d.model WHEN 'nfse' THEN 'NFS-e' WHEN 'nfe' THEN 'NF-e' ELSE 'NFC-e' END, d.number, v_motivo));
  RETURN d.sale_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.venda_cancelar_nota(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.venda_cancelar_nota(UUID, TEXT) TO authenticated;

-- Catálogo: "já foi usado" passa a olhar também as vendas
CREATE OR REPLACE VIEW public.catalogo_itens WITH (security_invoker = true) AS
SELECT c.*,
       (EXISTS (SELECT 1 FROM public.quote_items qi WHERE qi.catalog_item_id = c.id)
        OR EXISTS (SELECT 1 FROM public.sale_items si WHERE si.catalog_item_id = c.id)) AS has_usage,
       (c.active AND c.kind = 'produto' AND NOT c.type_reviewed AND public.catalogo_parece_servico(c.name)) AS sugere_servico
  FROM public.catalog_items c;
REVOKE ALL ON public.catalogo_itens FROM anon;

-- ---------------------------------------------------------------------
-- 7. Unir clientes: passa a levar também os orçamentos e as vendas do Control
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unir_clientes(
  p_principal UUID,
  p_duplicados UUID[],
  p_simular BOOLEAN DEFAULT TRUE,
  p_rotulos JSONB DEFAULT '[]'::JSONB,
  p_nome TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_rel JSONB := '{}'::JSONB;
  v_map JSONB := '{}'::JSONB;
  v_end JSONB := '[]'::JSONB;
  v_principal public.customers%ROWTYPE;
  v_dup public.customers%ROWTYPE;
  a public.customer_addresses%ROWTYPE;
  v_igual UUID;
  v_novo UUID;
  v_rotulo TEXT;
  v_tem_principal BOOLEAN;
  v_doc TEXT;
  v_tipo TEXT;
  v_notas TEXT;
  v_nomes TEXT[] := '{}';
  r RECORD;
  v_n INT;
  v_os INT := 0;
  v_equip INT := 0;
  v_vendas INT := 0;
  v_codigos INT := 0;
  v_mov INT := 0;
  v_desc INT := 0;
  v_resto INT;
  v_doc_passou BOOLEAN := FALSE;
  v_texto TEXT;
BEGIN
  IF p_principal IS NULL OR COALESCE(array_length(p_duplicados, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Informe o cadastro principal e pelo menos um duplicado.';
  END IF;
  IF p_principal = ANY (p_duplicados) THEN
    RAISE EXCEPTION 'O principal não pode estar na lista de duplicados.';
  END IF;
  IF (SELECT COUNT(*) FROM public.customers WHERE id = p_principal OR id = ANY (p_duplicados))
     <> 1 + (SELECT COUNT(DISTINCT x) FROM unnest(p_duplicados) x) THEN
    RAISE EXCEPTION 'Algum cadastro informado não existe.';
  END IF;

  BEGIN -- subtransação: no modo simulação tudo que está aqui dentro é desfeito
    SELECT * INTO v_principal FROM public.customers WHERE id = p_principal;
    SELECT array_agg(name ORDER BY created_at) INTO v_nomes FROM public.customers WHERE id = ANY (p_duplicados);

    -- 1) endereços dos duplicados: reaproveita o que o principal já tem ou copia para o principal
    SELECT EXISTS (SELECT 1 FROM public.customer_addresses WHERE customer_id = p_principal AND is_primary AND active) INTO v_tem_principal;
    FOR a IN
      SELECT x.* FROM public.customer_addresses x WHERE x.customer_id = ANY (p_duplicados) ORDER BY x.is_primary DESC, x.created_at
    LOOP
      v_igual := NULL;
      SELECT p.id INTO v_igual
        FROM public.customer_addresses p
       WHERE p.customer_id = p_principal
         AND public._unir_endereco_igual(p.street, p.number, p.complement, p.zip_code, a.street, a.number, a.complement, a.zip_code)
       ORDER BY p.is_primary DESC LIMIT 1;
      IF v_igual IS NOT NULL THEN
        UPDATE public.customer_addresses p SET
            zip_code = coalesce(nullif(p.zip_code, ''), nullif(a.zip_code, '')),
            complement = coalesce(nullif(p.complement, ''), nullif(a.complement, '')),
            district = coalesce(nullif(p.district, ''), nullif(a.district, '')),
            reference = coalesce(nullif(p.reference, ''), nullif(a.reference, '')),
            latitude = coalesce(p.latitude, a.latitude),
            longitude = coalesce(p.longitude, a.longitude)
         WHERE p.id = v_igual;
        v_map := v_map || jsonb_build_object(a.id::TEXT, v_igual::TEXT);
        v_end := v_end || jsonb_build_object('origem', concat_ws(', ', a.street, a.number, a.complement), 'acao', 'já existia no principal');
      ELSE
        v_novo := gen_random_uuid();
        SELECT name INTO v_texto FROM public.customers WHERE id = a.customer_id;
        v_rotulo := CASE WHEN nullif(btrim(coalesce(a.label, '')), '') IS NULL OR a.label = 'Principal'
                         THEN 'Do cadastro: ' || left(v_texto, 40) ELSE a.label END;
        INSERT INTO public.customer_addresses (id, customer_id, label, zip_code, street, number, complement, district, city, state, reference, latitude, longitude, is_primary, active)
          VALUES (v_novo, p_principal, v_rotulo, a.zip_code, a.street, a.number, a.complement, a.district, a.city, a.state, a.reference, a.latitude, a.longitude,
                  (NOT v_tem_principal AND a.is_primary AND a.active), a.active);
        IF NOT v_tem_principal AND a.is_primary AND a.active THEN v_tem_principal := TRUE; END IF;
        v_map := v_map || jsonb_build_object(a.id::TEXT, v_novo::TEXT);
        v_end := v_end || jsonb_build_object('origem', concat_ws(', ', a.street, a.number, a.complement), 'acao', 'copiado para o principal', 'rotulo', v_rotulo);
      END IF;
    END LOOP;

    -- nomes de endereço pedidos ("trecho" do texto do endereço -> rótulo)
    FOR r IN SELECT x ->> 'trecho' AS trecho, x ->> 'rotulo' AS rotulo FROM jsonb_array_elements(p_rotulos) x LOOP
      UPDATE public.customer_addresses
         SET label = r.rotulo
       WHERE customer_id = p_principal
         AND public.sem_acento(lower(concat_ws(' ', street, number, complement, district))) LIKE '%' || public.sem_acento(lower(r.trecho)) || '%';
      GET DIAGNOSTICS v_n = ROW_COUNT;
      IF v_n = 0 THEN RAISE EXCEPTION 'Nenhum endereço do principal contém "%".', r.trecho; END IF;
    END LOOP;

    -- 2) o que aponta para os duplicados passa para o principal, com o endereço trocado pelo novo
    UPDATE public.service_orders o SET customer_id = p_principal,
           address_id = coalesce((v_map ->> o.address_id::TEXT)::UUID, o.address_id)
     WHERE o.customer_id = ANY (p_duplicados);
    GET DIAGNOSTICS v_os = ROW_COUNT;

    UPDATE public.equipments e SET customer_id = p_principal,
           address_id = coalesce((v_map ->> e.address_id::TEXT)::UUID, e.address_id)
     WHERE e.customer_id = ANY (p_duplicados);
    GET DIAGNOSTICS v_equip = ROW_COUNT;

    UPDATE public.pmoc_plans p SET customer_id = p_principal,
           address_id = coalesce((v_map ->> p.address_id::TEXT)::UUID, p.address_id)
     WHERE p.customer_id = ANY (p_duplicados);
    UPDATE public.workshop_orders SET customer_id = p_principal WHERE customer_id = ANY (p_duplicados);
    UPDATE public.board_orders SET customer_id = p_principal WHERE customer_id = ANY (p_duplicados);
    UPDATE public.ratings SET customer_id = p_principal WHERE customer_id = ANY (p_duplicados);
    UPDATE public.rating_requests SET customer_id = p_principal WHERE customer_id = ANY (p_duplicados);
    UPDATE public.customer_users SET customer_id = p_principal WHERE customer_id = ANY (p_duplicados);

    UPDATE public.customer_sicweb_codes SET customer_id = p_principal WHERE customer_id = ANY (p_duplicados);
    GET DIAGNOSTICS v_codigos = ROW_COUNT;

    -- vendas do SicWeb: o endereço é o do cadastro de onde a venda veio (o principal dele, já mapeado)
    UPDATE public.sicweb_vendas v SET customer_id = p_principal,
           address_id = coalesce(
             (v_map ->> v.address_id::TEXT)::UUID,
             (v_map ->> (SELECT x.id::TEXT FROM public.customer_addresses x WHERE x.customer_id = v.customer_id AND x.is_primary AND x.active LIMIT 1))::UUID)
     WHERE v.customer_id = ANY (p_duplicados);
    GET DIAGNOSTICS v_vendas = ROW_COUNT;

    -- orçamentos e vendas do Control (o texto do nome no documento fica como foi emitido)
    UPDATE public.quotes q SET customer_id = p_principal,
           address_id = coalesce((v_map ->> q.address_id::TEXT)::UUID, q.address_id)
     WHERE q.customer_id = ANY (p_duplicados);
    UPDATE public.sales s SET customer_id = p_principal,
           address_id = coalesce((v_map ->> s.address_id::TEXT)::UUID, s.address_id)
     WHERE s.customer_id = ANY (p_duplicados);

    -- 3) contatos: passam os que o principal ainda não tem (mesmo telefone ou e-mail = repetido)
    FOR r IN SELECT * FROM public.customer_contacts WHERE customer_id = ANY (p_duplicados) LOOP
      IF EXISTS (
        SELECT 1 FROM public.customer_contacts k
         WHERE k.customer_id = p_principal
           AND ((nullif(regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'), '') IS NOT NULL
                 AND regexp_replace(coalesce(k.phone, ''), '\D', '', 'g') = regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'))
                OR (nullif(lower(btrim(coalesce(r.email, ''))), '') IS NOT NULL AND lower(btrim(coalesce(k.email, ''))) = lower(btrim(r.email))))
      ) OR (nullif(regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'), '') IS NULL AND nullif(btrim(coalesce(r.email, '')), '') IS NULL) THEN
        v_desc := v_desc + 1;
      ELSE
        UPDATE public.customer_contacts SET customer_id = p_principal, is_primary = FALSE WHERE id = r.id;
        v_mov := v_mov + 1;
      END IF;
    END LOOP;

    -- 4) dados do cadastro principal: preenche o que faltava e soma as observações
    SELECT document, person_type INTO v_doc, v_tipo FROM public.customers
     WHERE id = ANY (p_duplicados) AND document IS NOT NULL ORDER BY created_at LIMIT 1;
    UPDATE public.customers SET document = NULL WHERE id = ANY (p_duplicados) AND document IS NOT NULL; -- libera o CPF/CNPJ (é único)
    IF v_principal.document IS NULL AND v_doc IS NOT NULL THEN
      UPDATE public.customers SET document = v_doc, person_type = v_tipo WHERE id = p_principal;
      v_doc_passou := TRUE;
    END IF;
    SELECT string_agg(btrim(notes), E'\n---\n' ORDER BY created_at) INTO v_notas
      FROM public.customers WHERE id = ANY (p_duplicados) AND nullif(btrim(coalesce(notes, '')), '') IS NOT NULL;
    UPDATE public.customers c SET
        email = coalesce(c.email, (SELECT x.email FROM public.customers x WHERE x.id = ANY (p_duplicados) AND x.email IS NOT NULL ORDER BY x.created_at LIMIT 1)),
        state_registration = coalesce(c.state_registration, (SELECT x.state_registration FROM public.customers x WHERE x.id = ANY (p_duplicados) AND x.state_registration IS NOT NULL ORDER BY x.created_at LIMIT 1)),
        trade_name = coalesce(c.trade_name, (SELECT x.trade_name FROM public.customers x WHERE x.id = ANY (p_duplicados) AND x.trade_name IS NOT NULL ORDER BY x.created_at LIMIT 1)),
        notes = CASE WHEN v_notas IS NULL THEN c.notes
                     WHEN nullif(btrim(coalesce(c.notes, '')), '') IS NULL THEN v_notas
                     ELSE c.notes || E'\n---\nDe cadastro unido:\n' || v_notas END,
        created_at = least(c.created_at, (SELECT min(x.created_at) FROM public.customers x WHERE x.id = ANY (p_duplicados))),
        name = coalesce(nullif(btrim(p_nome), ''), c.name)
     WHERE c.id = p_principal;

    -- 5) trava: nada mais pode apontar para os duplicados (só os que apagam em cascata, já tratados ou sem valor)
    FOR r IN
      SELECT c.conrelid::regclass::TEXT AS tabela, a2.attname AS coluna
        FROM pg_constraint c
        JOIN pg_attribute a2 ON a2.attrelid = c.conrelid AND a2.attnum = c.conkey[1]
       WHERE c.confrelid = 'public.customers'::regclass AND c.contype = 'f' AND array_length(c.conkey, 1) = 1
         AND c.conrelid::regclass::TEXT NOT IN ('customer_addresses', 'customer_contacts', 'customer_field_original')
    LOOP
      EXECUTE format('SELECT COUNT(*) FROM public.%s WHERE %I = ANY ($1)', r.tabela, r.coluna) INTO v_resto USING p_duplicados;
      IF v_resto > 0 THEN
        RAISE EXCEPTION 'Ainda há % linha(s) em % apontando para o cadastro duplicado; nada foi alterado.', v_resto, r.tabela;
      END IF;
    END LOOP;

    DELETE FROM public.customers WHERE id = ANY (p_duplicados); -- leva junto os endereços e contatos que sobraram

    SELECT jsonb_build_object(
             'principal', c.name,
             'documento', c.document,
             'enderecos', (SELECT coalesce(jsonb_agg(jsonb_build_object('rotulo', x.label, 'endereco', concat_ws(', ', x.street, x.number, x.complement), 'principal', x.is_primary) ORDER BY x.is_primary DESC, x.created_at), '[]'::JSONB)
                             FROM public.customer_addresses x WHERE x.customer_id = c.id),
             'os', (SELECT COUNT(*) FROM public.service_orders o WHERE o.customer_id = c.id),
             'vendas', (SELECT COUNT(*) FROM public.sicweb_vendas v WHERE v.customer_id = c.id),
             'codigos_sicweb', (SELECT coalesce(string_agg(codigo, ' ' ORDER BY codigo), '') FROM public.customer_sicweb_codes k WHERE k.customer_id = c.id),
             'contatos', (SELECT COUNT(*) FROM public.customer_contacts k WHERE k.customer_id = c.id))
      INTO v_rel
      FROM public.customers c WHERE c.id = p_principal;
    v_rel := v_rel || jsonb_build_object(
      'unidos', to_jsonb(v_nomes),
      'movido_os', v_os, 'movido_equipamentos', v_equip, 'movido_vendas', v_vendas, 'movido_codigos', v_codigos,
      'contatos_movidos', v_mov, 'contatos_repetidos_descartados', v_desc,
      'documento_veio_do_duplicado', v_doc_passou, 'enderecos_tratados', v_end);

    IF p_simular THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = '__simulacao__';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> '__simulacao__' THEN RAISE; END IF; -- só a "exceção" da simulação é engolida; o resto desfaz e avisa
  END;

  RETURN v_rel || jsonb_build_object('simulacao', p_simular);
END;
$$;

COMMIT;
