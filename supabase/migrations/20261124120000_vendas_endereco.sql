-- Cada venda do SicWeb pode apontar para o endereço do cliente onde foi feita (ex.: casa x consultório).
-- Preenchido ao unir cadastros duplicados de um mesmo cliente com vários endereços; NULL = sem endereço definido.
-- FK composta (endereço, cliente) garante que o endereço é do mesmo cliente da venda; apagar o endereço só limpa a coluna.

ALTER TABLE public.sicweb_vendas ADD COLUMN IF NOT EXISTS address_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sicweb_vendas_address_fk') THEN
    ALTER TABLE public.sicweb_vendas
      ADD CONSTRAINT sicweb_vendas_address_fk FOREIGN KEY (address_id, customer_id)
      REFERENCES public.customer_addresses (id, customer_id) ON DELETE SET NULL (address_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS sicweb_vendas_address_idx ON public.sicweb_vendas (address_id) WHERE address_id IS NOT NULL;
