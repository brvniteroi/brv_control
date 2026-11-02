-- Busca de clientes sem distinguir acento nem maiúsculas: "joao" acha "João".
-- Coluna gerada `busca` (nome, nome fantasia e e-mail sem acento, em minúsculas);
-- o app tira os acentos do termo e procura nela com ILIKE.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- unaccent() não é IMMUTABLE (depende do search_path); com o dicionário fixo pode ser
CREATE OR REPLACE FUNCTION public.sem_acento(t TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path = ''
AS $$ SELECT lower(extensions.unaccent('extensions.unaccent'::regdictionary, t)) $$;

-- concat_ws não é IMMUTABLE (não serve em coluna gerada); por isso || com coalesce
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS busca TEXT GENERATED ALWAYS AS (
    public.sem_acento(coalesce(name, '') || ' ' || coalesce(trade_name, '') || ' ' || coalesce(email, ''))
  ) STORED;

-- Deixa o ILIKE '%termo%' rápido mesmo com milhares de clientes
CREATE INDEX IF NOT EXISTS customers_busca_trgm_idx ON public.customers USING gin (busca extensions.gin_trgm_ops);
