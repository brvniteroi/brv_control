-- =====================================================================
-- Cadastro de cargos e dados pessoais dos funcionários (2026-11-08).
--
-- 1. public.cargos: nome livre ("Mecânico de Refrigeração", "Ajudante"...), cada um numa categoria
--    (tecnico, auxiliar, supervisor, administrativo). A categoria é o que o sistema usa para saber quem
--    atende em campo (linha do tempo, agenda, relatórios): employees.role passa a ser copiado do cargo.
-- 2. employees.cargo_id: cargo do funcionário (os atuais recebem o cargo da função que já tinham).
-- 3. public.funcionario_dados: CPF, RG, nascimento, CTPS, PIS, admissão, registro profissional e endereço.
--    Dados pessoais (LGPD): SÓ O ADMIN lê e altera; escritório e técnico não enxergam.
--
-- Colar no SQL Editor do Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cargos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cargos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  categoria TEXT NOT NULL DEFAULT 'tecnico'
    CHECK (categoria IN ('tecnico', 'auxiliar', 'supervisor', 'administrativo')),
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS cargos_nome_key ON public.cargos (lower(trim(nome)));

DROP TRIGGER IF EXISTS set_updated_at ON public.cargos;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.cargos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cargos FROM anon;

DROP POLICY IF EXISTS "Escritório gerencia" ON public.cargos;
CREATE POLICY "Escritório gerencia" ON public.cargos FOR ALL TO authenticated
  USING ((SELECT public.eh_escritorio()))
  WITH CHECK ((SELECT public.eh_escritorio()));
DROP POLICY IF EXISTS "Só admin exclui" ON public.cargos;
CREATE POLICY "Só admin exclui" ON public.cargos AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((SELECT public.eh_admin()));
-- O técnico vê o nome do próprio cargo
DROP POLICY IF EXISTS "Colaboradores leem" ON public.cargos;
CREATE POLICY "Colaboradores leem" ON public.cargos FOR SELECT TO authenticated
  USING ((SELECT public.meu_colaborador_id()) IS NOT NULL);

-- Cargos iniciais: um por função que já existia
INSERT INTO public.cargos (nome, categoria)
VALUES ('Mecânico de Refrigeração', 'tecnico'),
       ('Auxiliar', 'auxiliar'),
       ('Supervisor', 'supervisor'),
       ('Administrativo', 'administrativo')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. Cargo do funcionário (RESTRICT: cargo em uso só pode ser desativado)
-- ---------------------------------------------------------------------
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS cargo_id UUID REFERENCES public.cargos (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS employees_cargo_idx ON public.employees (cargo_id);

-- Funcionários atuais recebem o cargo inicial da função que tinham
UPDATE public.employees e
   SET cargo_id = c.id
  FROM public.cargos c
 WHERE e.cargo_id IS NULL
   AND c.nome = CASE e.role
                  WHEN 'tecnico' THEN 'Mecânico de Refrigeração'
                  WHEN 'auxiliar' THEN 'Auxiliar'
                  WHEN 'supervisor' THEN 'Supervisor'
                  WHEN 'administrativo' THEN 'Administrativo'
                END;

-- employees.role (usado em todo o sistema) acompanha a categoria do cargo
CREATE OR REPLACE FUNCTION public.employees_role_do_cargo()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.cargo_id IS NOT NULL THEN
    SELECT categoria INTO NEW.role FROM public.cargos WHERE id = NEW.cargo_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS employees_role_do_cargo ON public.employees;
CREATE TRIGGER employees_role_do_cargo
  BEFORE INSERT OR UPDATE OF cargo_id, role ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.employees_role_do_cargo();

-- Mudou a categoria do cargo: os funcionários dele mudam junto
CREATE OR REPLACE FUNCTION public.cargos_propaga_categoria()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.employees SET role = NEW.categoria WHERE cargo_id = NEW.id AND role IS DISTINCT FROM NEW.categoria;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS cargos_propaga_categoria ON public.cargos;
CREATE TRIGGER cargos_propaga_categoria
  AFTER UPDATE OF categoria ON public.cargos
  FOR EACH ROW EXECUTE FUNCTION public.cargos_propaga_categoria();

-- ---------------------------------------------------------------------
-- 3. Dados pessoais (só admin)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.funcionario_dados (
  employee_id UUID PRIMARY KEY REFERENCES public.employees (id) ON DELETE CASCADE,
  cpf TEXT,
  rg TEXT,
  rg_orgao TEXT,                -- órgão emissor/UF, ex.: "Detran/RJ"
  data_nascimento DATE,
  ctps_numero TEXT,             -- CTPS física; a digital (desde 2019) é o próprio CPF
  ctps_serie TEXT,
  ctps_uf TEXT,
  pis TEXT,                     -- PIS/PASEP/NIS
  data_admissao DATE,
  registro_profissional TEXT,   -- ex.: "CFT 123456789" (responsável técnico do PMOC)
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS funcionario_dados_cpf_key ON public.funcionario_dados (cpf) WHERE cpf IS NOT NULL AND cpf <> '';

DROP TRIGGER IF EXISTS set_updated_at ON public.funcionario_dados;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.funcionario_dados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.funcionario_dados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.funcionario_dados FROM anon;

DROP POLICY IF EXISTS "Só admin" ON public.funcionario_dados;
CREATE POLICY "Só admin" ON public.funcionario_dados FOR ALL TO authenticated
  USING ((SELECT public.eh_admin()))
  WITH CHECK ((SELECT public.eh_admin()));
