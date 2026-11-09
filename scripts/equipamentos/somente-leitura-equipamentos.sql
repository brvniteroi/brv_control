-- =====================================================================
-- BRV EQUIPAMENTOS (projeto tnsmwpewdkdigwjyaufr): Kanban de equipamentos SÓ LEITURA.
-- Virada da oficina para o BRV Control em 2026-11-09 (docs/oficina.md).
--
-- Colar no SQL Editor do projeto **BRV Equipamentos** (NÃO no do BRV Control).
--
-- Bloqueia incluir, alterar e excluir em equipamentos, midias e historico_movimentacao para quem usa o site
-- (anon e authenticated). Consultar continua normal. As PLACAS não são afetadas (reparos_os, reparos_historico,
-- reparos_clientes e o Storage seguem como estão). A chave service_role (importador) não é afetada.
-- As políticas são RESTRICTIVE: valem junto com as que já existem, sem precisar mexer nelas.
-- =====================================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['equipamentos', 'midias', 'historico_movimentacao'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS "Somente leitura: inclusao (virada BRV Control)" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Somente leitura: alteracao (virada BRV Control)" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Somente leitura: exclusao (virada BRV Control)" ON public.%I', t);

    EXECUTE format('CREATE POLICY "Somente leitura: inclusao (virada BRV Control)" ON public.%I
                    AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false)', t);
    EXECUTE format('CREATE POLICY "Somente leitura: alteracao (virada BRV Control)" ON public.%I
                    AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false)', t);
    EXECUTE format('CREATE POLICY "Somente leitura: exclusao (virada BRV Control)" ON public.%I
                    AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false)', t);
  END LOOP;
END $$;

-- Conferência: devem aparecer 9 linhas (3 por tabela), todas RESTRICTIVE
SELECT tablename, policyname, permissive, cmd
  FROM pg_policies
 WHERE schemaname = 'public' AND policyname LIKE 'Somente leitura:%'
 ORDER BY tablename, cmd;

-- ---------------------------------------------------------------------
-- PARA DESFAZER (se algum dia precisar lançar de novo no sistema antigo): apagar as 9 políticas.
--
-- DO $$
-- DECLARE t TEXT;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY['equipamentos', 'midias', 'historico_movimentacao'] LOOP
--     EXECUTE format('DROP POLICY IF EXISTS "Somente leitura: inclusao (virada BRV Control)" ON public.%I', t);
--     EXECUTE format('DROP POLICY IF EXISTS "Somente leitura: alteracao (virada BRV Control)" ON public.%I', t);
--     EXECUTE format('DROP POLICY IF EXISTS "Somente leitura: exclusao (virada BRV Control)" ON public.%I', t);
--   END LOOP;
-- END $$;
-- ---------------------------------------------------------------------
