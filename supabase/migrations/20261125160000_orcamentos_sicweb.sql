-- =====================================================================
-- Orçamentos antigos do SicWeb, só para consulta (2026-11-25).
-- Só o último ano (a partir de 2025-11-24, decisão do usuário), importado por scripts/sicweb/importar-orcamentos.mjs
-- (TABEST4 e TABEST5). Não se misturam com os orçamentos novos do Control. SÓ ADMIN lê, como o histórico de vendas.
-- A maioria dos orçamentos do SicWeb não tem cliente, só o nome digitado: o importador liga pelo nome quando há um
-- único cliente com exatamente o mesmo nome, e marca ligado_por = 'nome'.
-- Também refaz unir_clientes para levar estes orçamentos junto.
--
-- Colar no SQL Editor do projeto BRV Control.
-- =====================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.sicweb_orcamentos (
  controle INTEGER PRIMARY KEY,                -- número do orçamento no SicWeb
  customer_id UUID REFERENCES public.customers (id) ON DELETE RESTRICT,
  ligado_por TEXT CHECK (ligado_por IN ('codigo', 'nome')),
  cliente_codigo TEXT,
  cliente_nome TEXT,                           -- como foi digitado no orçamento
  contato TEXT,
  data DATE NOT NULL,
  hora TIME,
  vendedor_codigo INTEGER,
  observacoes TEXT,
  total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  busca TEXT GENERATED ALWAYS AS (
    public.sem_acento(controle::text || ' ' || coalesce(cliente_nome, '') || ' ' || coalesce(contato, ''))) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sicweb_orcamentos_cliente_idx ON public.sicweb_orcamentos (customer_id, data DESC);
CREATE INDEX IF NOT EXISTS sicweb_orcamentos_data_idx ON public.sicweb_orcamentos (data DESC, controle DESC);

CREATE TABLE IF NOT EXISTS public.sicweb_orcamento_itens (
  controle INTEGER PRIMARY KEY,
  orcamento_controle INTEGER NOT NULL REFERENCES public.sicweb_orcamentos (controle) ON DELETE CASCADE,
  produto_codigo INTEGER,
  produto_nome TEXT,
  quantidade NUMERIC(14, 3) NOT NULL DEFAULT 0,
  valor_unitario NUMERIC(14, 4) NOT NULL DEFAULT 0,
  total NUMERIC(14, 2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS sicweb_orcamento_itens_orc_idx ON public.sicweb_orcamento_itens (orcamento_controle);

DO $rls$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sicweb_orcamentos', 'sicweb_orcamento_itens'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS "Só admin lê" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Só admin lê" ON public.%I FOR SELECT TO authenticated USING ((SELECT public.eh_admin()))', t);
  END LOOP;
END
$rls$;

-- unir_clientes: acrescenta os orçamentos antigos antes da parte dos orçamentos novos, sem copiar a função inteira
DO $unir$
DECLARE
  v_def TEXT;
  v_marca TEXT := '    -- orçamentos e vendas do Control';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'unir_clientes';
  IF v_def IS NULL OR position(v_marca IN v_def) = 0 THEN
    RAISE EXCEPTION 'unir_clientes não está como o esperado; nada foi alterado.';
  END IF;
  IF position('sicweb_orcamentos' IN v_def) = 0 THEN
    EXECUTE replace(v_def, v_marca,
      '    UPDATE public.sicweb_orcamentos SET customer_id = p_principal WHERE customer_id = ANY (p_duplicados);' || E'\n\n' || v_marca);
  END IF;
END
$unir$;

COMMIT;
