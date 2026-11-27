-- =====================================================================
-- Nova data da virada do SicWeb: 10/01/2027 (decisão do usuário, 2026-11-27; antes era 05/12/2026).
-- Só muda virada_sicweb(): o Relatório de vendas e o de Produtos vendidos usam o SicWeb ANTES desse dia
-- e o BRV Control A PARTIR dele.
--
-- Colar no SQL Editor do projeto BRV Control. Depois, rodar supabase/verificacao/virada_10_01_2027.sql.
-- =====================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.virada_sicweb()
RETURNS DATE LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$ SELECT DATE '2027-01-10' $$;
REVOKE EXECUTE ON FUNCTION public.virada_sicweb() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.virada_sicweb() TO authenticated;

COMMIT;
