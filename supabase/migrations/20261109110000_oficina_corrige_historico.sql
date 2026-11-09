-- =====================================================================
-- Oficina: corrige o histórico automático (2026-11-09).
--
-- Erro: "Só é possível escrever notas no histórico." ao registrar retirada no app de campo, criar entrada,
-- mudar etapa ou salvar um item da Oficina (qualquer ação com login).
-- Causa: o trigger que protege workshop_order_events (pela tela só se escreve nota) também barrava os
-- eventos gravados pelo próprio banco (trigger workshop_orders_historico), porque havia login.
-- Correção: a proteção vale só para o que vem direto da tela (pg_trigger_depth() = 1); os eventos gravados
-- por outro trigger (profundidade > 1) passam com autor e data já preenchidos por ele.
--
-- Colar no SQL Editor do Supabase (BRV Control).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.workshop_order_events_preenche()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Direto da tela (ou de uma função chamada pela tela), com login: só nota, autor e data do servidor
  IF auth.uid() IS NOT NULL AND pg_trigger_depth() = 1 THEN
    IF NEW.event <> 'nota' OR coalesce(char_length(btrim(NEW.note)), 0) NOT BETWEEN 1 AND 4000 THEN
      RAISE EXCEPTION 'Só é possível escrever notas no histórico.' USING ERRCODE = '42501';
    END IF;
    NEW.note := btrim(NEW.note);
    NEW.from_status := NULL;
    NEW.to_status := NULL;
    NEW.changes := NULL;
    NEW.actor_id := auth.uid();
    NEW.actor_name := (SELECT full_name FROM public.profiles WHERE id = auth.uid());
    NEW.created_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.workshop_order_events_preenche() FROM PUBLIC, anon, authenticated;
