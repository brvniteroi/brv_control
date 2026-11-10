-- Limite de uso da IA do apoio técnico (Edge Function apoio-tecnico): conta as consultas de cada pessoa por hora.
-- Só a função (chave de serviço) grava e lê; ninguém com login acessa direto.

CREATE TABLE IF NOT EXISTS public.board_ai_usage (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('erro', 'assistente', 'ficha')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS board_ai_usage_user_idx ON public.board_ai_usage (user_id, created_at DESC);

ALTER TABLE public.board_ai_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.board_ai_usage FROM PUBLIC, anon, authenticated;
