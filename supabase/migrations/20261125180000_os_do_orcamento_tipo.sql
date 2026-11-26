-- =====================================================================
-- "Gerar OS" do orçamento: escolha do tipo de serviço (2026-11-25).
--
-- Problema: a regra antiga pegava, entre os tipos com "instalação" no nome, o de nome mais curto, e o
-- orçamento de instalação de split gerou a OS 17565 como "Instalação Placa" (tipo nunca usado).
-- Agora, entre os tipos ativos que combinam com os serviços (instalação, manutenção, desinstalação):
--   1. preferência para o que fala do mesmo aparelho (split ou janela) que os itens do orçamento;
--   2. depois, o mais usado em OS nos últimos 12 meses;
--   3. "Orçamento de ..." e "Finalizar ..." nunca são escolhidos (não são o serviço em si).
-- Mantém o resto da função como estava (permissão pode_vender(), da migration 20261125120000).
-- Também corrige o tipo da OS 17565 (gerada do ORC-30004) para "Instalação de Split".
--
-- Colar no SQL Editor do projeto BRV Control.
-- =====================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.orcamento_gerar_os(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  o public.quotes%ROWTYPE;
  v_servicos TEXT;
  v_nomes TEXT;
  v_padrao TEXT;
  v_aparelho TEXT;
  v_tipo UUID;
  v_end UUID;
  v_os_id UUID;
  v_os_num BIGINT;
BEGIN
  IF NOT public.pode_vender() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO o FROM public.quotes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF o.converted_service_order_id IS NOT NULL OR o.status = 'convertido' THEN
    RAISE EXCEPTION 'Este orçamento já foi convertido.' USING ERRCODE = '23514';
  END IF;
  IF o.customer_id IS NULL THEN
    RAISE EXCEPTION 'Para gerar a OS, escolha um cliente cadastrado (Consumidor final não tem OS).' USING ERRCODE = '23514';
  END IF;

  SELECT string_agg(trim_scale(i.quantity)::text || ' ' || i.unit || ' — ' || i.name, E'\n' ORDER BY i.sort_order),
         public.sem_acento(string_agg(i.name, ' '))
    INTO v_servicos, v_nomes
    FROM public.quote_items i
   WHERE i.quote_id = p_id AND i.kind = 'servico';
  IF v_servicos IS NULL THEN
    RAISE EXCEPTION 'Este orçamento não possui itens de serviço para gerar uma Ordem de Serviço.' USING ERRCODE = '23514';
  END IF;

  -- Que serviço é ("instal" que não seja "desinstal" -> instalação) e de que aparelho
  v_padrao := CASE
    WHEN v_nomes ~ '(^|[^s])instal' THEN 'instala'
    WHEN v_nomes LIKE '%manut%' THEN 'manuten'
    WHEN v_nomes LIKE '%desinstal%' THEN 'desinstala'
    ELSE NULL END;
  v_aparelho := CASE
    WHEN v_nomes LIKE '%split%' THEN 'split'
    WHEN v_nomes LIKE '%janela%' THEN 'janela'
    ELSE NULL END;

  IF v_padrao IS NOT NULL THEN
    SELECT t.id INTO v_tipo
      FROM public.service_types t
     WHERE t.active
       AND public.sem_acento(t.name) LIKE '%' || v_padrao || '%'
       AND (v_padrao = 'desinstala' OR public.sem_acento(t.name) NOT LIKE '%desinstala%')
       AND public.sem_acento(t.name) NOT LIKE '%orcamento%'
       AND public.sem_acento(t.name) NOT LIKE '%finalizar%'
     ORDER BY (v_aparelho IS NOT NULL AND public.sem_acento(t.name) LIKE '%' || v_aparelho || '%') DESC,
              (SELECT count(*) FROM public.service_orders so
                WHERE so.service_type_id = t.id AND so.opened_at > NOW() - INTERVAL '365 days') DESC,
              t.name
     LIMIT 1;
  END IF;
  IF v_tipo IS NULL THEN
    SELECT t.id INTO v_tipo FROM public.service_types t WHERE t.active ORDER BY t.name LIMIT 1;
  END IF;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Cadastre um tipo de serviço antes de gerar a OS.' USING ERRCODE = 'P0002';
  END IF;

  -- Endereço do orçamento; sem ele, o principal do cliente
  v_end := o.address_id;
  IF v_end IS NULL OR NOT EXISTS (SELECT 1 FROM public.customer_addresses a WHERE a.id = v_end AND a.customer_id = o.customer_id) THEN
    SELECT a.id INTO v_end FROM public.customer_addresses a
     WHERE a.customer_id = o.customer_id AND a.active ORDER BY a.is_primary DESC, a.created_at LIMIT 1;
  END IF;

  INSERT INTO public.service_orders (customer_id, address_id, service_type_id, status, description, internal_notes)
  VALUES (o.customer_id, v_end, v_tipo, 'agendada', v_servicos,
          format('Gerada do orçamento %s (%s).', o.number, public.formatar_reais(o.total_cents)))
  RETURNING id, number INTO v_os_id, v_os_num;

  UPDATE public.quotes SET status = 'convertido', converted_service_order_id = v_os_id WHERE id = p_id;
  PERFORM public.orcamento_evento(p_id, 'convertido_os', format('Gerada OS nº %s com os serviços do orçamento.', v_os_num));

  RETURN jsonb_build_object('service_order_id', v_os_id, 'service_order_number', v_os_num, 'descricao', v_servicos);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.orcamento_gerar_os(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orcamento_gerar_os(UUID) TO authenticated;

-- OS 17565 (do ORC-30004, instalação de split 18.000) saiu como "Instalação Placa"
UPDATE public.service_orders so
   SET service_type_id = (SELECT id FROM public.service_types WHERE name = 'Instalação de Split')
 WHERE so.number = 17565
   AND so.service_type_id = (SELECT id FROM public.service_types WHERE name = 'Instalação Placa')
   AND EXISTS (SELECT 1 FROM public.service_types WHERE name = 'Instalação de Split');

COMMIT;
