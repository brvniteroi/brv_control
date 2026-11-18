-- Busca de clientes também pelo endereço (ou parte dele), sem acento e sem diferenciar maiúsculas.
-- `customers.busca_enderecos` junta apelido, rua, número, complemento, bairro, cidade, CEP e
-- referência de TODOS os endereços do cliente (inclusive os inativos: a OS antiga pode ter sido
-- feita lá). Um trigger em customer_addresses mantém a coluna em dia; o app procura nela com ILIKE
-- (cada palavra digitada precisa aparecer, em qualquer ordem).

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS busca_enderecos TEXT NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.customers_recalcula_busca_enderecos(p_customer UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  UPDATE public.customers c
     SET busca_enderecos = coalesce((
           SELECT string_agg(
                    public.sem_acento(
                      coalesce(a.label, '') || ' ' || coalesce(a.street, '') || ' ' || coalesce(a.number, '') || ' ' ||
                      coalesce(a.complement, '') || ' ' || coalesce(a.district, '') || ' ' || coalesce(a.city, '') || ' ' ||
                      coalesce(a.zip_code, '') || ' ' || coalesce(a.reference, '')
                    ), ' | ')
             FROM public.customer_addresses a
            WHERE a.customer_id = c.id
         ), '')
   WHERE c.id = p_customer;
$$;
REVOKE ALL ON FUNCTION public.customers_recalcula_busca_enderecos(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.customer_addresses_atualiza_busca()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.customers_recalcula_busca_enderecos(OLD.customer_id);
  ELSE
    PERFORM public.customers_recalcula_busca_enderecos(NEW.customer_id);
    -- endereço que mudou de cliente (agrupamento de cadastros): o antigo também recalcula
    IF TG_OP = 'UPDATE' AND OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
      PERFORM public.customers_recalcula_busca_enderecos(OLD.customer_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.customer_addresses_atualiza_busca() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS customer_addresses_atualiza_busca ON public.customer_addresses;
CREATE TRIGGER customer_addresses_atualiza_busca
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.customer_addresses_atualiza_busca();

-- Preenche os clientes que já existem (sem mexer no "atualizado em" deles)
ALTER TABLE public.customers DISABLE TRIGGER set_updated_at;
UPDATE public.customers c
   SET busca_enderecos = coalesce((
         SELECT string_agg(
                  public.sem_acento(
                    coalesce(a.label, '') || ' ' || coalesce(a.street, '') || ' ' || coalesce(a.number, '') || ' ' ||
                    coalesce(a.complement, '') || ' ' || coalesce(a.district, '') || ' ' || coalesce(a.city, '') || ' ' ||
                    coalesce(a.zip_code, '') || ' ' || coalesce(a.reference, '')
                  ), ' | ')
           FROM public.customer_addresses a
          WHERE a.customer_id = c.id
       ), '');
ALTER TABLE public.customers ENABLE TRIGGER set_updated_at;

CREATE INDEX IF NOT EXISTS customers_busca_enderecos_trgm_idx
  ON public.customers USING gin (busca_enderecos extensions.gin_trgm_ops);
