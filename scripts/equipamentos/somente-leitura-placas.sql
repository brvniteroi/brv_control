-- =====================================================================
-- BRV EQUIPAMENTOS (projeto tnsmwpewdkdigwjyaufr): reparo de PLACAS e apoio técnico SÓ LEITURA.
-- Virada das placas para o BRV Control em 2026-11-10 (docs/placas.md). Complementa somente-leitura-equipamentos.sql.
--
-- Colar no SQL Editor do projeto **BRV Equipamentos** (NÃO no do BRV Control).
--
-- Bloqueia incluir, alterar e excluir em reparos_os, reparos_clientes, reparos_historico, fichas_tecnicas_split e
-- documentos_fabricantes para quem usa o site (anon e authenticated). Consultar continua normal.
-- A chave service_role (importadores) não é afetada. Políticas RESTRICTIVE: valem junto com as que já existem.
-- Tabela que não existir é pulada (aviso no resultado).
-- =====================================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['reparos_os', 'reparos_clientes', 'reparos_historico', 'fichas_tecnicas_split', 'documentos_fabricantes'] LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE NOTICE 'Tabela % não existe, pulada', t;
      CONTINUE;
    END IF;

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

-- Conferência: com este script e o dos equipamentos, devem aparecer 24 linhas (3 por tabela, 8 tabelas), todas RESTRICTIVE
SELECT tablename, policyname, permissive, cmd
  FROM pg_policies
 WHERE schemaname = 'public' AND policyname LIKE 'Somente leitura:%'
 ORDER BY tablename, cmd;

-- ---------------------------------------------------------------------
-- PARA DESFAZER (se algum dia precisar lançar de novo no sistema antigo): apagar as políticas destas 5 tabelas.
--
-- DO $$
-- DECLARE t TEXT;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY['reparos_os', 'reparos_clientes', 'reparos_historico', 'fichas_tecnicas_split', 'documentos_fabricantes'] LOOP
--     EXECUTE format('DROP POLICY IF EXISTS "Somente leitura: inclusao (virada BRV Control)" ON public.%I', t);
--     EXECUTE format('DROP POLICY IF EXISTS "Somente leitura: alteracao (virada BRV Control)" ON public.%I', t);
--     EXECUTE format('DROP POLICY IF EXISTS "Somente leitura: exclusao (virada BRV Control)" ON public.%I', t);
--   END LOOP;
-- END $$;
-- ---------------------------------------------------------------------
