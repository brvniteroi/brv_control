-- Página Mapa: última posição conhecida de cada técnico (GPS do celular).
-- O app de campo envia a posição enquanto está aberto; guarda-se só a última (sem histórico de trajeto).
-- O técnico grava só a própria, pela função registrar_posicao; só o escritório lê.

CREATE TABLE IF NOT EXISTS public.technician_locations (
  employee_id UUID PRIMARY KEY REFERENCES public.employees (id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  -- Precisão informada pelo celular, em metros
  accuracy_m INTEGER CHECK (accuracy_m >= 0),
  -- Hora do servidor (o relógio do celular pode estar errado)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.technician_locations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.technician_locations FROM anon;

DROP POLICY IF EXISTS "Escritório lê posições" ON public.technician_locations;
CREATE POLICY "Escritório lê posições" ON public.technician_locations
  FOR SELECT TO authenticated USING ((SELECT public.eh_escritorio()));

-- Técnico grava a própria posição (o colaborador vem do login, não do aparelho)
CREATE OR REPLACE FUNCTION public.registrar_posicao(p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_precisao INTEGER)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_colaborador UUID := public.meu_colaborador_id();
BEGIN
  IF v_colaborador IS NULL THEN
    RAISE EXCEPTION 'Só técnico ativo registra posição';
  END IF;
  INSERT INTO public.technician_locations (employee_id, latitude, longitude, accuracy_m, updated_at)
  VALUES (v_colaborador, p_lat, p_lng, GREATEST(p_precisao, 0), NOW())
  ON CONFLICT (employee_id) DO UPDATE
    SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
        accuracy_m = EXCLUDED.accuracy_m, updated_at = EXCLUDED.updated_at;
END $$;
REVOKE EXECUTE ON FUNCTION public.registrar_posicao(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_posicao(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO authenticated;

-- O mapa do escritório move o técnico na hora
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'technician_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.technician_locations;
  END IF;
END $$;
