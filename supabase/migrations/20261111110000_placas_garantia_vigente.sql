-- =====================================================================
-- Placas: retorno em garantia só com a placa original ENTREGUE e a garantia de 90 dias VIGENTE (2026-11-11).
--
-- Decisões do Braulio: garantia vencida entra como placa normal (com orçamento); não existe garantia
-- "avulsa" (sem a placa original); a placa que volta em garantia, ao ser entregue de novo, ganha novos
-- 90 dias a partir da nova saída (isso já é o comportamento: a validade conta do finished_at de cada placa).
-- O termo de garantia é só impresso na retirada (sem envio pelo WhatsApp).
--
-- Vale para quem usa a tela (com login). O importador (service_role, sem login) não é barrado.
-- Colar no SQL Editor do projeto BRV Control.
-- =====================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.board_orders_preenche()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  o public.board_orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    -- Pela tela: nasce sempre em "entrada", com número, token e data de entrada do servidor
    NEW.board_number := public.board_next_number();
    NEW.public_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    NEW.status := 'entrada';
    NEW.created_at := NOW();
    NEW.stage_changed_at := NOW();
    NEW.finished_at := NULL;
    NEW.archived := FALSE;
    NEW.archived_at := NULL;
    NEW.cancelled_entry := FALSE;
    NEW.cancel_reason := NULL;
    NEW.unrepaired_reason := NULL;
    NEW.created_by := auth.uid();
    NEW.quote_status := 'nao_feito';
    NEW.quote_amount := NULL;
    NEW.quote_technical_opinion := NULL;
    NEW.quote_sent_at := NULL;
    NEW.quote_responded_at := NULL;
    NEW.quote_response_channel := NULL;
    NEW.quote_response_notes := NULL;
    NEW.quote_responded_by := NULL;
    IF NEW.is_warranty THEN
      IF NEW.warranty_origin_id IS NULL THEN
        RAISE EXCEPTION 'Escolha a placa original do retorno em garantia.' USING ERRCODE = '23514';
      END IF;
      SELECT * INTO o FROM public.board_orders WHERE id = NEW.warranty_origin_id;
      IF NOT FOUND OR o.cancelled_entry OR o.status <> 'entregue' OR o.finished_at IS NULL THEN
        RAISE EXCEPTION 'A placa original do retorno em garantia precisa estar entregue.' USING ERRCODE = '23514';
      END IF;
      IF o.finished_at + INTERVAL '90 days' < NOW() THEN
        RAISE EXCEPTION 'A garantia da placa % venceu em %. Registre como placa normal, com orçamento.',
          o.board_number, to_char(o.finished_at + INTERVAL '90 days', 'DD/MM/YYYY') USING ERRCODE = '23514';
      END IF;
    ELSE
      NEW.warranty_origin_id := NULL;
    END IF;
  ELSIF NEW.board_number IS NULL OR btrim(NEW.board_number) = '' THEN
    NEW.board_number := public.board_next_number();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.board_orders_preenche() FROM PUBLIC, anon, authenticated;

-- Garantia é definida na entrada: depois não muda pela tela (senão daria para "virar garantia" e pular o orçamento)
CREATE OR REPLACE FUNCTION public.board_orders_garantia_fixa()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND (NEW.is_warranty IS DISTINCT FROM OLD.is_warranty OR NEW.warranty_origin_id IS DISTINCT FROM OLD.warranty_origin_id) THEN
    RAISE EXCEPTION 'Retorno em garantia é definido na entrada da placa e não muda depois.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.board_orders_garantia_fixa() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS board_orders_garantia_fixa ON public.board_orders;
CREATE TRIGGER board_orders_garantia_fixa
  BEFORE UPDATE ON public.board_orders
  FOR EACH ROW EXECUTE FUNCTION public.board_orders_garantia_fixa();

COMMIT;
