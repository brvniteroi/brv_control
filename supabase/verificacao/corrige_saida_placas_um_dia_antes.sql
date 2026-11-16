-- Correção (2026-11-16): saídas de placas gravadas com UM DIA A MENOS.
-- Até o commit desta correção, a tela de entrega mandava só a data (ex. '2026-11-16') e o banco lia meia-noite UTC,
-- que é 21h do dia anterior em Niterói: a saída aparecia um dia antes (e a garantia de 90 dias também contava um dia antes).
-- Só mexe nas placas entregues PELO CONTROL (com login) cuja saída ficou exatamente em 00:00 UTC.
-- Placas importadas do Equipamentos não são tocadas.
-- Colar no SQL Editor e rodar. Primeiro rode só o PASSO 1 e confira a lista.

-- PASSO 1: só mostra (não altera nada)
WITH entregas AS (
  SELECT DISTINCT ON (e.board_order_id)
         e.board_order_id, e.created_at AS registrada_em
  FROM public.board_events e
  WHERE e.to_stage = 'entregue' AND e.actor_id IS NOT NULL
  ORDER BY e.board_order_id, e.created_at DESC
)
SELECT b.board_number,
       to_char(b.finished_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS saida_hoje_no_sistema,
       (b.finished_at AT TIME ZONE 'UTC')::date                                      AS data_escolhida_na_tela,
       to_char(en.registrada_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS entrega_registrada_em
FROM public.board_orders b
JOIN entregas en ON en.board_order_id = b.id
WHERE b.status = 'entregue'
  AND (b.finished_at AT TIME ZONE 'UTC')::time = '00:00'
ORDER BY b.finished_at;

-- PASSO 2: corrige. Se a data escolhida foi o próprio dia em que a entrega foi registrada, usa o momento do registro;
-- se foi um dia anterior, usa 23:59 daquele dia (horário de Niterói).
-- BEGIN;
-- WITH entregas AS (
--   SELECT DISTINCT ON (e.board_order_id)
--          e.board_order_id, e.created_at AS registrada_em
--   FROM public.board_events e
--   WHERE e.to_stage = 'entregue' AND e.actor_id IS NOT NULL
--   ORDER BY e.board_order_id, e.created_at DESC
-- )
-- UPDATE public.board_orders b
-- SET finished_at = CASE
--       WHEN (b.finished_at AT TIME ZONE 'UTC')::date = (en.registrada_em AT TIME ZONE 'America/Sao_Paulo')::date
--         THEN en.registrada_em
--       ELSE ((b.finished_at AT TIME ZONE 'UTC')::date + TIME '23:59') AT TIME ZONE 'America/Sao_Paulo'
--     END
-- FROM entregas en
-- WHERE en.board_order_id = b.id
--   AND b.status = 'entregue'
--   AND (b.finished_at AT TIME ZONE 'UTC')::time = '00:00';
-- -- Conferir: rode o PASSO 1 de novo; deve vir vazio. Se estiver tudo certo: COMMIT;  (senão: ROLLBACK;)
