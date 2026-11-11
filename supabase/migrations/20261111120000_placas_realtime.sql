-- Placas: quadro atualiza sozinho (ex.: cliente aprova o orçamento pelo link e a placa ganha o destaque
-- "Aprovado, iniciar reparo" na hora). A RLS de board_orders (só admin/escritório) continua valendo no Realtime.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'board_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.board_orders;
  END IF;
END $$;
