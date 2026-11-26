-- =====================================================================
-- Aviso de orçamento aprovado (2026-11-25, pedido do usuário).
--
-- Quando o cliente aprova pelo link, quem está com o BRV Control aberto (vendedor ou admin) recebe um aviso
-- na tela, com bipe, em qualquer página. Para isso a tabela de orçamentos entra no Realtime, como as placas
-- (20261111120000). A RLS de quotes (só quem pode vender lê) continua valendo no Realtime.
--
-- Colar no SQL Editor do projeto BRV Control.
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'quotes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;
  END IF;
END $$;

-- Conferência: deve devolver 1 linha
SELECT tablename AS no_realtime FROM pg_publication_tables
 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'quotes';
