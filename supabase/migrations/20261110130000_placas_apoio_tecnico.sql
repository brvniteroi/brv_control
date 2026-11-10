-- Placas: apoio técnico (fichas técnicas de splits e manuais/textos de códigos de erro), fase P7 de docs/placas.md.
-- Vem do BRV Equipamentos (fichas_tecnicas_split, 131 linhas; documentos_fabricantes, 18 textos de códigos de erro).
-- Leitura e cadastro: admin e escritório. Editar ficha e excluir ficha/manual: só admin.
-- O conteúdo em texto do manual (content_text) é o que a IA lê para responder códigos de erro.

CREATE TABLE IF NOT EXISTS public.board_tech_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fabricante TEXT NOT NULL CHECK (char_length(btrim(fabricante)) > 0),
  linha TEXT,
  tipo_split TEXT,
  capacidade_btu TEXT,
  capacidade_w TEXT,
  evaporadora TEXT,
  medida_evaporadora TEXT,
  ref_evaporadora TEXT,
  condensadora TEXT,
  medida_condensadora TEXT,
  ref_condensadora TEXT,
  revisao_manual TEXT,
  gas TEXT,
  cobre_liquido TEXT,
  cobre_succao TEXT,
  dist_min TEXT,
  dist_padrao TEXT,
  dist_max TEXT,
  desnivel_max TEXT,
  carga_fabrica TEXT,
  carga_extra TEXT,
  regra_bitola TEXT,
  tensao TEXT,
  alimentacao_em TEXT,
  p_nominal TEXT,
  p_max_dim TEXT,
  i_refrigeracao TEXT,
  i_aquecimento TEXT,
  i_max_dim TEXT,
  origem_eletrica TEXT,
  cabo_alimentacao TEXT,
  cabo_interligacao TEXT,
  protecao TEXT,
  observacao TEXT,
  lacunas TEXT,
  fonte TEXT,
  arquivo_original_url TEXT,
  legacy_id UUID,
  created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS board_tech_sheets_legacy_key ON public.board_tech_sheets (legacy_id) WHERE legacy_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS board_tech_sheets_fabricante_idx ON public.board_tech_sheets (fabricante);

CREATE TABLE IF NOT EXISTS public.board_manuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer TEXT NOT NULL CHECK (char_length(btrim(manufacturer)) > 0),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) > 0),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'TXT' CHECK (file_type IN ('PDF', 'TXT')),
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  file_url TEXT,                 -- PDF enviado para a HostGator; texto importado não tem arquivo
  content_text TEXT,             -- texto que a IA consulta (TXT: o próprio conteúdo; PDF: extraído depois)
  has_extracted_text BOOLEAN GENERATED ALWAYS AS (coalesce(btrim(content_text), '') <> '') STORED,
  uploaded_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL DEFAULT auth.uid(),
  uploaded_by_name TEXT NOT NULL DEFAULT '',
  legacy_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS board_manuals_legacy_key ON public.board_manuals (legacy_id) WHERE legacy_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS board_manuals_fabricante_idx ON public.board_manuals (manufacturer);

DROP TRIGGER IF EXISTS set_updated_at ON public.board_tech_sheets;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.board_tech_sheets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Nome de quem enviou o manual vem do servidor (não do cliente)
CREATE OR REPLACE FUNCTION public.board_manuals_autor()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.uploaded_by := auth.uid();
    NEW.uploaded_by_name := coalesce((SELECT full_name FROM public.profiles WHERE id = auth.uid()), '');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.board_manuals_autor() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS board_manuals_autor ON public.board_manuals;
CREATE TRIGGER board_manuals_autor BEFORE INSERT ON public.board_manuals
  FOR EACH ROW EXECUTE FUNCTION public.board_manuals_autor();

ALTER TABLE public.board_tech_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_manuals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.board_tech_sheets, public.board_manuals FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_tech_sheets, public.board_manuals TO authenticated;

DROP POLICY IF EXISTS "Escritório lê" ON public.board_tech_sheets;
DROP POLICY IF EXISTS "Escritório inclui" ON public.board_tech_sheets;
DROP POLICY IF EXISTS "Só admin altera" ON public.board_tech_sheets;
DROP POLICY IF EXISTS "Só admin exclui" ON public.board_tech_sheets;
CREATE POLICY "Escritório lê" ON public.board_tech_sheets FOR SELECT TO authenticated USING ((SELECT public.eh_escritorio()));
CREATE POLICY "Escritório inclui" ON public.board_tech_sheets FOR INSERT TO authenticated WITH CHECK ((SELECT public.eh_escritorio()));
CREATE POLICY "Só admin altera" ON public.board_tech_sheets FOR UPDATE TO authenticated
  USING ((SELECT public.eh_admin())) WITH CHECK ((SELECT public.eh_admin()));
CREATE POLICY "Só admin exclui" ON public.board_tech_sheets FOR DELETE TO authenticated USING ((SELECT public.eh_admin()));

DROP POLICY IF EXISTS "Escritório lê" ON public.board_manuals;
DROP POLICY IF EXISTS "Escritório inclui" ON public.board_manuals;
DROP POLICY IF EXISTS "Só admin exclui" ON public.board_manuals;
CREATE POLICY "Escritório lê" ON public.board_manuals FOR SELECT TO authenticated USING ((SELECT public.eh_escritorio()));
CREATE POLICY "Escritório inclui" ON public.board_manuals FOR INSERT TO authenticated WITH CHECK ((SELECT public.eh_escritorio()));
CREATE POLICY "Só admin exclui" ON public.board_manuals FOR DELETE TO authenticated USING ((SELECT public.eh_admin()));
