-- Endereço "como veio do Field Control": cópia fixa, gravada antes de qualquer ajuste feito aqui
-- (scripts/field-control/ajustar-numero-endereco.mjs). Serve de consulta se surgir conflito no futuro.
-- Só o escritório lê (o app do técnico não enxerga); ninguém altera pelo app, só a importação (service_role).

CREATE TABLE IF NOT EXISTS public.customer_address_field_original (
  address_id UUID PRIMARY KEY REFERENCES public.customer_addresses (id) ON DELETE CASCADE,
  -- Texto pronto para exibir
  original TEXT NOT NULL,
  -- Os campos separados, como vieram: street, number, complement, district, city, state, zip_code
  dados JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.customer_address_field_original ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_address_field_original FROM anon, authenticated;
GRANT SELECT ON public.customer_address_field_original TO authenticated;
DROP POLICY IF EXISTS "Escritório lê" ON public.customer_address_field_original;
CREATE POLICY "Escritório lê" ON public.customer_address_field_original FOR SELECT TO authenticated
  USING ((SELECT public.eh_escritorio()));
