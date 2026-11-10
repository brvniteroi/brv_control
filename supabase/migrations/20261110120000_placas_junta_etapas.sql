-- Placas: "Aguardando Peça" e "Teste em Simulador" deixam de ser etapas do quadro (decisão do usuário, 2026-11-10).
-- Quem estava nelas passa para "Em Reparo" (agora "Em Reparo / Aguardando Peça"). Os valores antigos continuam
-- permitidos pelo CHECK só para o histórico (board_events é imutável e cita essas etapas).
-- Rodando no SQL Editor (sem login) as regras de etapa não se aplicam; o gatilho de histórico registra a mudança.

UPDATE public.board_orders
SET status = 'em_reparo'
WHERE status IN ('aguardando_peca', 'teste');
