-- =====================================================================
-- Orçamentos antigos do SicWeb: passam a ser lidos por quem vende (pedido do usuário, 2026-11-25), e não só
-- pelo admin. Vale para os vendedores marcados em Vendas > Vendedores (pode_vender() já inclui o admin).
-- O histórico de VENDAS do SicWeb (que tem lucro) continua só do admin.
--
-- Colar no SQL Editor do projeto BRV Control. Depois, rodar supabase/verificacao/orcamentos_sicweb_vendedores.sql.
-- =====================================================================
BEGIN;

DO $politicas$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sicweb_orcamentos', 'sicweb_orcamento_itens'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Só admin lê" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Vendedor lê" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Vendedor lê" ON public.%I FOR SELECT TO authenticated USING ((SELECT public.pode_vender()))', t);
  END LOOP;
END
$politicas$;

COMMIT;
