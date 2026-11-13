-- =====================================================================
-- Backup sob demanda e painel do backup no Dashboard do administrador (2026-11-13).
--
-- O backup roda no PC da empresa (scripts/backup/backup.mjs). Aqui ficam:
--   backup_runs   cada backup (agendado das 9h ou pedido pelo botão do Dashboard) e o resultado;
--   backup_agent  o "sinal de vida" do vigia que roda no PC da empresa (scripts/backup/agente-backup.mjs);
--   backup_solicitar()  o botão "Fazer backup agora": só administrador, só com o PC da empresa online,
--                       e não deixa pedir outro enquanto há um pendente/em andamento.
-- O vigia e o backup agendado gravam com a chave de serviço (que já fica só no .env do PC da empresa);
-- o navegador só LÊ (administrador) e chama a função de pedido.
--
-- Colar no SQL Editor do Supabase.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.backup_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origem TEXT NOT NULL CHECK (origem IN ('manual', 'agendado')),
  status TEXT NOT NULL CHECK (status IN ('pendente', 'executando', 'ok', 'falhou')),
  requested_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  detalhe TEXT
);
CREATE INDEX IF NOT EXISTS backup_runs_data_idx ON public.backup_runs (requested_at DESC);

CREATE TABLE IF NOT EXISTS public.backup_agent (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  info JSONB
);

ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_agent ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backup_runs, public.backup_agent FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.backup_runs, public.backup_agent TO authenticated;

DROP POLICY IF EXISTS "Só admin lê" ON public.backup_runs;
DROP POLICY IF EXISTS "Só admin lê" ON public.backup_agent;
CREATE POLICY "Só admin lê" ON public.backup_runs FOR SELECT TO authenticated USING ((SELECT public.eh_admin()));
CREATE POLICY "Só admin lê" ON public.backup_agent FOR SELECT TO authenticated USING ((SELECT public.eh_admin()));

-- Botão "Fazer backup agora"
CREATE OR REPLACE FUNCTION public.backup_solicitar()
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.eh_admin() THEN
    RAISE EXCEPTION 'Só o administrador pede backup.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.backup_agent WHERE last_seen > NOW() - INTERVAL '3 minutes') THEN
    RAISE EXCEPTION 'O PC da empresa está desligado ou o vigia do backup não está rodando. Ligue o PC e tente de novo.'
      USING ERRCODE = '55000';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.backup_runs
     WHERE origem = 'manual' AND status IN ('pendente', 'executando') AND requested_at > NOW() - INTERVAL '2 hours'
  ) THEN
    RAISE EXCEPTION 'Já existe um backup pedido, aguardando ou em andamento.' USING ERRCODE = '55000';
  END IF;
  INSERT INTO public.backup_runs (origem, status, requested_by)
  VALUES ('manual', 'pendente', auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.backup_solicitar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.backup_solicitar() TO authenticated;
