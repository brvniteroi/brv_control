-- Etiqueta das placas na Elgin pela mesma fila de impressão da Oficina (agente no servidor da loja).
-- A fila e o agente não mudam: só aceitam um tipo novo de pedido ('etiqueta_placa') e guardam de qual placa é.
-- As regras de quem pede e cancela continuam as de print_jobs (admin, escritório e oficina; placas são só admin/escritório).
BEGIN;

DO $$
DECLARE c TEXT;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.print_jobs'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%etiqueta_oficina%'
  LOOP
    EXECUTE format('ALTER TABLE public.print_jobs DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.print_jobs
  ADD CONSTRAINT print_jobs_kind_check CHECK (kind IN ('etiqueta_oficina', 'etiqueta_placa', 'teste'));

ALTER TABLE public.print_jobs
  ADD COLUMN IF NOT EXISTS board_order_id UUID REFERENCES public.board_orders (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS print_jobs_placa_idx ON public.print_jobs (board_order_id, created_at DESC) WHERE board_order_id IS NOT NULL;

COMMIT;
