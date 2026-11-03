-- Observações do cliente como vieram do Field Control: cópia fixa, para consulta se surgir conflito
-- (scripts/field-control/guardar-observacoes-field.mjs). Mostrada junto do "Endereço antigo no Field".
-- Só o escritório lê (o app do técnico não enxerga); só a importação (service_role) grava.

CREATE TABLE IF NOT EXISTS public.customer_field_original (
  customer_id UUID PRIMARY KEY REFERENCES public.customers (id) ON DELETE CASCADE,
  notes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.customer_field_original ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_field_original FROM anon, authenticated;
GRANT SELECT ON public.customer_field_original TO authenticated;
DROP POLICY IF EXISTS "Escritório lê" ON public.customer_field_original;
CREATE POLICY "Escritório lê" ON public.customer_field_original FOR SELECT TO authenticated
  USING ((SELECT public.eh_escritorio()));
