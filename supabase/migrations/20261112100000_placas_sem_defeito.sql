-- =====================================================================
-- Placas: "Placa sem defeito" (2026-11-12).
--
-- Depois do teste em bancada, se a placa não tem defeito, o escritório clica em "Placa sem defeito":
-- a placa vai direto para Pronto, SEM orçamento e SEM aprovação do cliente. O valor da avaliação em bancada
-- fica em `quote_amount` (o financeiro já usa esse valor como sugestão na entrega) e o cliente é avisado pelo
-- WhatsApp. Retorno em garantia não cobra avaliação.
--
-- Regras novas (refaz `board_orders_regras`; o resto da função é igual ao da migration 20261110100000):
--   - `no_defect_found` só pode ser marcado na Entrada ou no Diagnóstico, junto com a mudança para Pronto;
--   - fora garantia, exige o valor da avaliação (`quote_amount` > 0);
--   - placa marcada sem defeito dispensa a aprovação do orçamento só para ir a Pronto/Entregue
--     (Em Reparo, Aguardando Peça e Teste continuam exigindo aprovação);
--   - se a placa voltar para Entrada/Diagnóstico (reabertura), a marca é limpa.
--
-- Colar no SQL Editor do Supabase.
-- =====================================================================

ALTER TABLE public.board_orders
  ADD COLUMN IF NOT EXISTS no_defect_found BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.board_orders_regras()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_final_old BOOLEAN := OLD.status IN ('entregue', 'sem_conserto');
  v_final_new BOOLEAN := NEW.status IN ('entregue', 'sem_conserto');
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;          -- script (importador): sem regras de etapa
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.board_number IS DISTINCT FROM OLD.board_number THEN
    RAISE EXCEPTION 'O número e a data de entrada da placa não mudam.' USING ERRCODE = '42501';
  END IF;
  IF NEW.public_token IS DISTINCT FROM OLD.public_token AND coalesce(current_setting('board.novo_link', TRUE), '') <> '1' THEN
    RAISE EXCEPTION 'O link de acompanhamento só muda por "Gerar novo link".' USING ERRCODE = '42501';
  END IF;

  -- Finalizada: só arquivar; reabrir é do administrador
  IF v_final_old THEN
    IF NEW.status = OLD.status THEN
      IF (to_jsonb(NEW) - 'archived' - 'archived_at' - 'updated_at')
         IS DISTINCT FROM (to_jsonb(OLD) - 'archived' - 'archived_at' - 'updated_at') THEN
        RAISE EXCEPTION 'Placa finalizada: só pode ser arquivada, ou reaberta pelo administrador.' USING ERRCODE = '42501';
      END IF;
    ELSIF NOT public.eh_admin() THEN
      RAISE EXCEPTION 'Só o administrador reabre uma placa finalizada.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Garantia não tem orçamento
  IF NEW.is_warranty AND (
       NEW.quote_amount IS DISTINCT FROM OLD.quote_amount
       OR NEW.quote_status IS DISTINCT FROM OLD.quote_status
       OR NEW.quote_sent_at IS DISTINCT FROM OLD.quote_sent_at) THEN
    RAISE EXCEPTION 'Retorno em garantia não tem orçamento.' USING ERRCODE = '23514';
  END IF;

  -- Orçamento enviado: precisa de valor e de parecer
  IF NEW.quote_status = 'enviado' AND (OLD.quote_status IS DISTINCT FROM 'enviado' OR NEW.quote_sent_at IS DISTINCT FROM OLD.quote_sent_at) THEN
    IF coalesce(NEW.quote_amount, 0) <= 0 OR char_length(btrim(coalesce(NEW.quote_technical_opinion, ''))) = 0 THEN
      RAISE EXCEPTION 'Registre o valor e o parecer técnico antes de enviar o orçamento.' USING ERRCODE = '23514';
    END IF;
    NEW.quote_sent_at := NOW();
  END IF;

  -- Resposta do cliente: canal obrigatório; data e autor vêm do servidor
  IF NEW.quote_status IN ('aprovado', 'recusado') AND NEW.quote_status IS DISTINCT FROM OLD.quote_status THEN
    IF NEW.quote_response_channel IS NULL THEN
      RAISE EXCEPTION 'Informe por onde o cliente respondeu ao orçamento.' USING ERRCODE = '23514';
    END IF;
    IF coalesce(NEW.quote_amount, 0) <= 0 THEN
      RAISE EXCEPTION 'Registre o valor do orçamento antes da resposta do cliente.' USING ERRCODE = '23514';
    END IF;
    NEW.quote_responded_at := NOW();
    NEW.quote_responded_by := auth.uid();
  END IF;

  -- Placa sem defeito: só na Entrada/Diagnóstico, indo direto para Pronto, com o valor da avaliação (garantia não cobra)
  IF NEW.no_defect_found AND NOT OLD.no_defect_found THEN
    IF OLD.status NOT IN ('entrada', 'diagnostico') THEN
      RAISE EXCEPTION 'Só marque "Placa sem defeito" na Entrada ou no Diagnóstico.' USING ERRCODE = '23514';
    END IF;
    IF NEW.status <> 'pronto' THEN
      RAISE EXCEPTION 'A placa sem defeito segue direto para Pronto.' USING ERRCODE = '23514';
    END IF;
    IF NOT NEW.is_warranty AND coalesce(NEW.quote_amount, 0) <= 0 THEN
      RAISE EXCEPTION 'Informe o valor da avaliação em bancada.' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Mudança de etapa
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- (reabrir placa arquivada = admin desarquiva na mesma alteração)
    IF OLD.cancelled_entry OR (OLD.archived AND NEW.archived) THEN
      RAISE EXCEPTION 'Placa cancelada ou arquivada não muda de etapa.' USING ERRCODE = '42501';
    END IF;
    IF NEW.status IN ('aguardando_peca', 'em_reparo', 'teste', 'pronto', 'entregue')
       AND NEW.quote_status <> 'aprovado' AND NOT NEW.is_warranty
       AND NOT (NEW.no_defect_found AND NEW.status IN ('pronto', 'entregue')) THEN
      IF NEW.quote_status = 'recusado' THEN
        RAISE EXCEPTION 'O cliente recusou o orçamento: finalize como "Sem Conserto / Devolvido".' USING ERRCODE = '23514';
      END IF;
      RAISE EXCEPTION 'Registre a aprovação do orçamento antes de seguir para o conserto.' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'entregue' AND OLD.status <> 'pronto' THEN
      RAISE EXCEPTION 'Só uma placa pronta pode ser entregue.' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'sem_conserto' AND char_length(btrim(coalesce(NEW.unrepaired_reason, ''))) = 0 THEN
      RAISE EXCEPTION 'Informe o motivo de finalizar sem conserto.' USING ERRCODE = '23514';
    END IF;

    -- Voltou para a bancada: a marca "sem defeito" não vale mais (o fluxo normal de orçamento volta)
    IF NEW.status IN ('entrada', 'diagnostico') THEN
      NEW.no_defect_found := FALSE;
    END IF;

    NEW.stage_changed_at := NOW();
    IF v_final_new THEN
      NEW.finished_at := least(coalesce(NEW.finished_at, NOW()), NOW());
      IF NEW.finished_at < OLD.created_at THEN
        RAISE EXCEPTION 'A saída não pode ser antes da entrada da placa.' USING ERRCODE = '23514';
      END IF;
    ELSE
      NEW.finished_at := NULL;
      NEW.unrepaired_reason := NULL;
    END IF;
  END IF;

  -- Cancelar e arquivar
  IF NEW.cancelled_entry AND NOT OLD.cancelled_entry THEN
    IF char_length(btrim(coalesce(NEW.cancel_reason, ''))) = 0 THEN
      RAISE EXCEPTION 'Informe o motivo do cancelamento da entrada.' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.archived AND NOT OLD.archived THEN
    NEW.archived_at := NOW();
  ELSIF NOT NEW.archived THEN
    NEW.archived_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.board_orders_regras() FROM PUBLIC, anon, authenticated;
