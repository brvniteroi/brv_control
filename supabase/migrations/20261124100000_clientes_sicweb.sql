-- Códigos dos clientes no SicWeb (importação de 2026-11-24, scripts/sicweb/importar-clientes.mjs).
-- Um cliente do Control pode ter mais de um código do SicWeb (cadastros duplicados lá viram um só aqui),
-- por isso é uma tabela e não uma coluna. É a ponte para o financeiro: título, venda ou nota do SicWeb
-- aponta para o código antigo e daqui se chega ao cliente.
-- `dados` guarda a linha do SicWeb como veio (documento, identidade, nascimento, filiação, profissão, etc.).
-- Só o escritório lê; só a importação (service_role) grava.

CREATE TABLE IF NOT EXISTS public.customer_sicweb_codes (
  codigo TEXT PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  cadastrado_em DATE,
  dados JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customer_sicweb_codes_customer_idx ON public.customer_sicweb_codes (customer_id);

ALTER TABLE public.customer_sicweb_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_sicweb_codes FROM anon, authenticated;
GRANT SELECT ON public.customer_sicweb_codes TO authenticated;
DROP POLICY IF EXISTS "Escritório lê" ON public.customer_sicweb_codes;
CREATE POLICY "Escritório lê" ON public.customer_sicweb_codes FOR SELECT TO authenticated
  USING ((SELECT public.eh_escritorio()));
