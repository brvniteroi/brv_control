-- Histórico de vendas do SicWeb (importação de 2026-11-24, scripts/sicweb/importar-vendas.mjs).
-- São tabelas de CONSULTA do que foi vendido até hoje: o módulo financeiro novo vai ter as suas próprias
-- (títulos, parcelas, movimentos) e pode apontar para estas pela chave `controle` do SicWeb.
--   sicweb_vendas            uma linha por documento de venda do SicWeb (TABEST3A, venda = 1)
--   sicweb_venda_itens       itens da venda (TABEST3B); `total` = o que foi cobrado (totvenda), `total_tabela` = preço de tabela
--   sicweb_venda_pagamentos  como foi pago, por forma (TABEST3R + TABEST7); vendas antigas podem não ter
-- `customer_id` vem de `customer_sicweb_codes` (migration 20261124100000); NULL = consumidor final ou cliente
-- que ainda não foi importado (o código do SicWeb fica em `cliente_codigo` e a importação preenche depois).
-- Acesso: SÓ ADMIN lê (tem valores e lucro). Quando existir o nível de acesso do financeiro, a política passa a ele.
-- Só a importação (service_role) grava.

CREATE TABLE IF NOT EXISTS public.sicweb_vendas (
  controle INTEGER PRIMARY KEY,
  customer_id UUID REFERENCES public.customers (id) ON DELETE RESTRICT,
  cliente_codigo TEXT,
  data DATE NOT NULL,
  hora TIME,
  tipo SMALLINT,
  tipo_nome TEXT,
  nota INTEGER,
  serie TEXT,
  pedido INTEGER,
  nfe INTEGER,
  vendedor_codigo INTEGER,
  observacoes TEXT,
  frete NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_tabela NUMERIC(14, 2) NOT NULL DEFAULT 0,
  lucro NUMERIC(14, 2) NOT NULL DEFAULT 0,
  pago NUMERIC(14, 2) NOT NULL DEFAULT 0,
  cancelada BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sicweb_vendas_cliente_idx ON public.sicweb_vendas (customer_id, data DESC);
CREATE INDEX IF NOT EXISTS sicweb_vendas_data_idx ON public.sicweb_vendas (data DESC);

CREATE TABLE IF NOT EXISTS public.sicweb_venda_itens (
  controle INTEGER PRIMARY KEY,
  venda_controle INTEGER NOT NULL REFERENCES public.sicweb_vendas (controle) ON DELETE CASCADE,
  produto_codigo INTEGER,
  produto_nome TEXT,
  quantidade NUMERIC(14, 3) NOT NULL DEFAULT 0,
  total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_tabela NUMERIC(14, 2) NOT NULL DEFAULT 0,
  lucro NUMERIC(14, 2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS sicweb_venda_itens_venda_idx ON public.sicweb_venda_itens (venda_controle);

CREATE TABLE IF NOT EXISTS public.sicweb_venda_pagamentos (
  controle INTEGER PRIMARY KEY,
  venda_controle INTEGER NOT NULL REFERENCES public.sicweb_vendas (controle) ON DELETE CASCADE,
  forma_codigo INTEGER,
  forma TEXT,
  valor NUMERIC(14, 2) NOT NULL DEFAULT 0,
  troco NUMERIC(14, 2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS sicweb_venda_pagamentos_venda_idx ON public.sicweb_venda_pagamentos (venda_controle);

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sicweb_vendas', 'sicweb_venda_itens', 'sicweb_venda_pagamentos'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS "Só admin lê" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Só admin lê" ON public.%I FOR SELECT TO authenticated USING ((SELECT public.eh_admin()))', t);
  END LOOP;
END $$;
