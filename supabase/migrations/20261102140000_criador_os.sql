-- Quem criou a OS: as do BRV Control já têm created_by (login); as importadas guardam o nome do usuário do
-- Field Control que a criou (não há login correspondente). Preenchido por scripts/field-control/preencher-criador.mjs.
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS field_control_created_by TEXT;
