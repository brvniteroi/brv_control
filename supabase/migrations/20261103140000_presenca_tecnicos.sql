-- Presença do técnico: sinal de vida do app de campo (independe do GPS e de ter se movido).
-- O app chama registrar_presenca() a cada minuto enquanto está aberto e visível; o escritório vê quem está online.
-- Guarda só o último contato (sem histórico).

CREATE TABLE IF NOT EXISTS public.technician_presence (
  employee_id UUID PRIMARY KEY REFERENCES public.employees (id) ON DELETE CASCADE,
  -- Hora do servidor (o relógio do celular pode estar errado)
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.technician_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.technician_presence FROM anon;

DROP POLICY IF EXISTS "Escritório lê presença" ON public.technician_presence;
CREATE POLICY "Escritório lê presença" ON public.technician_presence
  FOR SELECT TO authenticated USING ((SELECT public.eh_escritorio()));

CREATE OR REPLACE FUNCTION public.registrar_presenca()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_colaborador UUID := public.meu_colaborador_id();
BEGIN
  IF v_colaborador IS NULL THEN
    RAISE EXCEPTION 'Só técnico ativo registra presença';
  END IF;
  INSERT INTO public.technician_presence (employee_id, last_seen)
  VALUES (v_colaborador, NOW())
  ON CONFLICT (employee_id) DO UPDATE SET last_seen = EXCLUDED.last_seen;
END $$;
REVOKE EXECUTE ON FUNCTION public.registrar_presenca() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_presenca() TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'technician_presence'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.technician_presence;
  END IF;
END $$;
