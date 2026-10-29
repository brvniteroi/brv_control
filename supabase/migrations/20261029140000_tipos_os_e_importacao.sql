-- =====================================================================
-- Tipos de OS editáveis (substituem a lista fixa service_orders.type) e
-- ajustes para importar OS, atividades e fotos do Field Control.
-- Rodar no SQL Editor (ou `supabase db push`).
-- =====================================================================

-- A coluna `type` será removida: só é seguro enquanto não houver OS.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.service_orders) THEN
    RAISE EXCEPTION 'Já existem OS: migrar service_orders.type para service_type_id manualmente antes de rodar esta migration.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1. Tipos de OS
-- ---------------------------------------------------------------------
CREATE TABLE public.service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  default_duration_minutes INTEGER CHECK (default_duration_minutes > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  field_control_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX service_types_name_key ON public.service_types (lower(trim(name)));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.service_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.service_types FROM anon;

CREATE POLICY "Escritório gerencia" ON public.service_types FOR ALL TO authenticated
  USING ((SELECT public.eh_escritorio()))
  WITH CHECK ((SELECT public.eh_escritorio()));
-- Técnicos precisam do nome do tipo nas próprias OS
CREATE POLICY "Colaboradores leem" ON public.service_types FOR SELECT TO authenticated
  USING ((SELECT public.meu_colaborador_id()) IS NOT NULL);

-- ---------------------------------------------------------------------
-- 2. OS apontam para o tipo (RESTRICT: tipo usado em OS só pode ser arquivado)
-- ---------------------------------------------------------------------
ALTER TABLE public.service_orders DROP COLUMN type;
ALTER TABLE public.service_orders
  ADD COLUMN service_type_id UUID NOT NULL REFERENCES public.service_types(id) ON DELETE RESTRICT;
CREATE INDEX service_orders_service_type_idx ON public.service_orders (service_type_id);

-- ---------------------------------------------------------------------
-- 3. Importação: atividades também guardam o ID de origem
-- ---------------------------------------------------------------------
ALTER TABLE public.tasks ADD COLUMN field_control_id TEXT UNIQUE;

-- ---------------------------------------------------------------------
-- 4. Anexos importados: o arquivo continua no Field Control (S3), sem tipo
--    nem tamanho conhecidos. storage_path e public_url guardam a mesma URL.
-- ---------------------------------------------------------------------
ALTER TABLE public.attachments ADD COLUMN field_control_id TEXT UNIQUE;
ALTER TABLE public.attachments ALTER COLUMN mime_type DROP NOT NULL;
ALTER TABLE public.attachments ALTER COLUMN size_bytes DROP NOT NULL;

DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.attachments'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%hostgator%'
  LOOP
    EXECUTE format('ALTER TABLE public.attachments DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_storage_check CHECK (storage IN ('hostgator', 'supabase', 'fieldcontrol')),
  ADD CONSTRAINT attachments_arquivo_conhecido CHECK (
    storage = 'fieldcontrol' OR (mime_type IS NOT NULL AND size_bytes IS NOT NULL)
  );

-- Autor e data vêm do servidor quando há login (anti-falsificação). Sem login
-- (importação pelo SQL Editor ou service_role) valem os valores informados.
CREATE OR REPLACE FUNCTION public.attachments_preenche()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.task_id IS NOT NULL THEN
    SELECT service_order_id INTO NEW.service_order_id FROM public.tasks WHERE id = NEW.task_id;
  END IF;
  IF auth.uid() IS NOT NULL THEN
    NEW.uploaded_by := auth.uid();
    NEW.created_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;
