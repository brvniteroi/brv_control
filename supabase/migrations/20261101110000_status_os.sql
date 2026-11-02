-- Situação da OS passa a ter só 4 valores: agendada, em_andamento, concluida, cancelada.
-- As OS 'aberta' viram 'agendada' e as 'pausada' viram 'em_andamento'.

UPDATE public.service_orders SET status = 'agendada' WHERE status = 'aberta';
UPDATE public.service_orders SET status = 'em_andamento' WHERE status = 'pausada';

ALTER TABLE public.service_orders DROP CONSTRAINT service_orders_status_check;
ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_status_check
  CHECK (status IN ('agendada', 'em_andamento', 'concluida', 'cancelada'));
ALTER TABLE public.service_orders ALTER COLUMN status SET DEFAULT 'agendada';

-- Chamado do portal nasce 'agendada' (antes 'aberta'); o escritório agenda a atividade.
CREATE OR REPLACE FUNCTION public.portal_abrir_chamado(
  p_tipo UUID,
  p_descricao TEXT,
  p_endereco UUID DEFAULT NULL,
  p_equipamento UUID DEFAULT NULL,
  p_urgente BOOLEAN DEFAULT FALSE
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  cid UUID := public.meu_cliente_id();
  nova UUID;
  numero BIGINT;
BEGIN
  IF cid IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_descricao, ''))) < 5 THEN
    RAISE EXCEPTION 'Descreva o que precisa ser feito.';
  END IF;
  IF length(p_descricao) > 2000 THEN
    RAISE EXCEPTION 'A descrição está muito longa (máximo de 2000 caracteres).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.service_types WHERE id = p_tipo AND active) THEN
    RAISE EXCEPTION 'Escolha o tipo de serviço.';
  END IF;
  IF p_endereco IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.customer_addresses WHERE id = p_endereco AND customer_id = cid AND active
  ) THEN
    RAISE EXCEPTION 'Endereço inválido.';
  END IF;
  IF p_equipamento IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.equipments WHERE id = p_equipamento AND customer_id = cid
  ) THEN
    RAISE EXCEPTION 'Equipamento inválido.';
  END IF;
  -- Freio contra abuso: no máximo 5 chamados por hora por login
  IF (SELECT count(*) FROM public.service_orders
       WHERE created_by = auth.uid() AND created_at > NOW() - INTERVAL '1 hour') >= 5 THEN
    RAISE EXCEPTION 'Muitos chamados em pouco tempo. Aguarde um pouco ou ligue para a BRV.';
  END IF;

  INSERT INTO public.service_orders
    (customer_id, address_id, service_type_id, status, priority, description, internal_notes)
  VALUES
    (cid, p_endereco, p_tipo, 'agendada', CASE WHEN p_urgente THEN 'alta' ELSE 'normal' END,
     trim(p_descricao), 'Aberto pelo Portal do Cliente')
  RETURNING id, number INTO nova, numero;

  IF p_equipamento IS NOT NULL THEN
    INSERT INTO public.service_order_equipments (service_order_id, equipment_id) VALUES (nova, p_equipamento);
  END IF;
  RETURN numero;
END;
$$;
