-- =====================================================================
-- Orçamento que virou OS também vira venda (2026-11-25, pedido do usuário).
--
-- Fluxo da BRV: orçamento aprovado -> Gerar OS -> o técnico executa -> o cliente paga. Antes, "convertido"
-- (orçamento que virou OS) bloqueava a venda. Agora:
--   * venda_concluir aceita orçamento que só gerou OS (não aceita o que já virou venda) e liga a venda a essa OS;
--   * orcamento_gerar_os aceita orçamento que já virou venda (cliente que paga antes) e liga a venda à OS nova;
--     é a versão da migration 20261125180000 (tipo de serviço certo) com essa mudança;
--   * venda_cancelar libera o orçamento: ele volta a poder virar venda (fica "convertido" se tiver OS, senão "aprovado").
-- Permissão: pode_vender() (migration 20261125120000). Pode ser colada antes ou depois da 20261125180000.
--
-- Colar no SQL Editor do projeto BRV Control.
-- =====================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.venda_concluir(p JSONB)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_id UUID;
  v_numero TEXT;
  v_orc public.quotes%ROWTYPE;
  v_orc_id UUID := nullif(p->>'quote_id', '')::uuid;
  v_os UUID := nullif(p->>'service_order_id', '')::uuid;
  v_cliente UUID := nullif(p->>'customer_id', '')::uuid;
  v_nome TEXT; v_tipo TEXT; v_doc TEXT; v_doc_nota TEXT;
  v_end UUID := nullif(p->>'address_id', '')::uuid;
  v_end_texto TEXT := nullif(btrim(coalesce(p->>'address_text', '')), '');
  v_vend UUID := nullif(p->>'seller_id', '')::uuid;
  v_vend_nome TEXT;
  v_item JSONB; v_ordem BIGINT;
  v_qtd NUMERIC; v_unit BIGINT; v_modo TEXT; v_ent NUMERIC; v_kind TEXT; v_cat UUID; v_avulso BOOLEAN; v_nome_item TEXT;
  v_linha RECORD;
  v_prod BIGINT := 0; v_serv BIGINT := 0; v_bruto BIGINT := 0; v_desc_linhas BIGINT := 0;
  v_desc BIGINT; v_frete BIGINT; v_total BIGINT;
  v_desc_prod BIGINT; v_modelo TEXT;
  v_pago BIGINT;
BEGIN
  IF NOT public.pode_vender() THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'items') = 0 THEN
    RAISE EXCEPTION 'Adicione ao menos um item ao carrinho antes de concluir a venda.' USING ERRCODE = '23514';
  END IF;

  IF v_orc_id IS NOT NULL THEN
    SELECT * INTO v_orc FROM public.quotes WHERE id = v_orc_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Orçamento não encontrado.' USING ERRCODE = 'P0002';
    END IF;
    -- Já virou venda: não vende de novo. Só virou OS (orçamento -> OS -> técnico executa -> cliente paga): pode vender.
    IF v_orc.converted_sale_id IS NOT NULL THEN
      RAISE EXCEPTION 'Este orçamento já virou a venda %.', v_orc.converted_sale_number USING ERRCODE = '23514';
    END IF;
    IF v_orc.status = 'convertido' AND v_orc.converted_service_order_id IS NULL THEN
      RAISE EXCEPTION 'Este orçamento já foi convertido.' USING ERRCODE = '23514';
    END IF;
    -- A venda fica ligada à OS que o orçamento gerou (mesmo cliente)
    IF v_os IS NULL AND v_orc.converted_service_order_id IS NOT NULL AND v_cliente IS NOT DISTINCT FROM v_orc.customer_id THEN
      v_os := v_orc.converted_service_order_id;
    END IF;
    -- Endereço do orçamento, se a venda é para o mesmo cliente e não veio outro
    IF v_end IS NULL AND v_cliente IS NOT DISTINCT FROM v_orc.customer_id THEN
      v_end := v_orc.address_id;
      v_end_texto := coalesce(v_end_texto, v_orc.address_text);
    END IF;
  END IF;

  IF v_cliente IS NOT NULL THEN
    SELECT c.name, c.person_type, c.document INTO v_nome, v_tipo, v_doc FROM public.customers c WHERE c.id = v_cliente;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente não encontrado.' USING ERRCODE = 'P0002';
    END IF;
    IF v_end IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.customer_addresses a WHERE a.id = v_end AND a.customer_id = v_cliente) THEN
      v_end := NULL;
    END IF;
    IF v_end IS NULL THEN
      SELECT a.id INTO v_end FROM public.customer_addresses a
       WHERE a.customer_id = v_cliente AND a.active ORDER BY a.is_primary DESC, a.created_at LIMIT 1;
    END IF;
    IF v_end_texto IS NULL AND v_end IS NOT NULL THEN
      SELECT concat_ws(', ', nullif(a.street, ''), nullif(a.number, ''), nullif(a.complement, ''), nullif(a.district, ''), nullif(a.city, ''))
        INTO v_end_texto FROM public.customer_addresses a WHERE a.id = v_end;
    END IF;
    v_doc_nota := v_doc;
  ELSE
    v_nome := 'Consumidor final';
    v_tipo := CASE WHEN p->>'customer_person_type' = 'PJ' THEN 'PJ' ELSE 'PF' END;
    v_doc := NULL;
    v_end := NULL;
    v_end_texto := NULL;
    v_doc_nota := nullif(btrim(coalesce(p->>'invoice_document', '')), '');
  END IF;

  -- OS: só do próprio cliente
  IF v_os IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.service_orders o WHERE o.id = v_os AND o.customer_id = v_cliente) THEN
    RAISE EXCEPTION 'A OS informada não é deste cliente.' USING ERRCODE = '23514';
  END IF;

  IF v_vend IS NOT NULL THEN
    SELECT e.name INTO v_vend_nome FROM public.employees e WHERE e.id = v_vend AND e.active;
    IF NOT FOUND THEN v_vend := NULL; END IF;
  END IF;
  IF v_vend IS NULL THEN
    v_vend := public.meu_funcionario_id();
    SELECT e.name INTO v_vend_nome FROM public.employees e WHERE e.id = v_vend;
  END IF;

  INSERT INTO public.sales (origin_type, quote_id, service_order_id, customer_id, customer_name, customer_person_type,
                            customer_document, invoice_document, address_id, address_text, seller_id, seller_name, notes)
  VALUES (CASE WHEN v_orc_id IS NOT NULL THEN 'orcamento' WHEN v_os IS NOT NULL THEN 'os' ELSE 'balcao' END,
          v_orc_id, v_os, v_cliente, v_nome, v_tipo, v_doc, v_doc_nota, v_end, v_end_texto, v_vend, v_vend_nome,
          nullif(btrim(coalesce(p->>'notes', '')), ''))
  RETURNING id, number INTO v_id, v_numero;

  FOR v_item, v_ordem IN SELECT value, ordinality FROM jsonb_array_elements(p->'items') WITH ORDINALITY LOOP
    v_nome_item := btrim(coalesce(v_item->>'name', ''));
    IF v_nome_item = '' THEN
      RAISE EXCEPTION 'Há um item sem descrição.' USING ERRCODE = '23514';
    END IF;
    v_qtd := (v_item->>'quantity')::numeric;
    IF v_qtd IS NULL OR v_qtd <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida em "%".', v_nome_item USING ERRCODE = '23514';
    END IF;
    v_unit := round(coalesce((v_item->>'unit_price_cents')::numeric, 0));
    IF v_unit < 0 THEN
      RAISE EXCEPTION 'Valor negativo em "%".', v_nome_item USING ERRCODE = '23514';
    END IF;
    v_modo := CASE WHEN v_item->>'discount_mode' = 'percentual' THEN 'percentual' ELSE 'valor' END;
    v_ent := greatest(coalesce((v_item->>'discount_input')::numeric, 0), 0);
    v_kind := CASE WHEN v_item->>'kind' = 'servico' THEN 'servico' ELSE 'produto' END;
    v_avulso := coalesce((v_item->>'is_custom')::boolean, FALSE);
    v_cat := CASE WHEN v_avulso THEN NULL ELSE nullif(v_item->>'catalog_item_id', '')::uuid END;
    IF v_cat IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.catalog_items c WHERE c.id = v_cat) THEN
      RAISE EXCEPTION 'Item do catálogo não encontrado: "%".', v_nome_item USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_linha FROM public.calcular_linha_centavos(v_qtd, v_unit, v_modo, v_ent);
    INSERT INTO public.sale_items (sale_id, catalog_item_id, is_custom, kind, code, name, unit, quantity,
                                   unit_price_cents, discount_mode, discount_input, discount_cents, total_cents, sort_order)
    VALUES (v_id, v_cat, v_avulso OR v_cat IS NULL, v_kind,
            coalesce(nullif(btrim(v_item->>'code'), ''), CASE WHEN v_cat IS NULL THEN 'AVULSO' ELSE 'ITEM' END),
            v_nome_item,
            coalesce(nullif(btrim(v_item->>'unit'), ''), CASE WHEN v_kind = 'servico' THEN 'SRV' ELSE 'UN' END),
            v_qtd, v_unit, v_modo, v_ent, v_linha.desconto, v_linha.total, v_ordem);

    v_bruto := v_bruto + v_linha.bruto;
    v_desc_linhas := v_desc_linhas + v_linha.desconto;
    IF v_kind = 'produto' THEN v_prod := v_prod + v_linha.total; ELSE v_serv := v_serv + v_linha.total; END IF;
  END LOOP;

  v_desc := least(v_prod + v_serv, greatest(round(coalesce((p->>'general_discount_cents')::numeric, 0)), 0));
  v_frete := greatest(round(coalesce((p->>'freight_cents')::numeric, 0)), 0);
  v_total := v_prod + v_serv - v_desc + v_frete;

  IF v_bruto > 0 AND (v_desc_linhas + v_desc) * 100.0 / v_bruto > 10.005 AND public.nivel_financeiro() <> 'completo' THEN
    RAISE EXCEPTION 'Desconto acima de 10%% só com acesso financeiro completo.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.sales SET products_subtotal_cents = v_prod, services_subtotal_cents = v_serv,
         general_discount_cents = v_desc, freight_cents = v_frete, total_cents = v_total
   WHERE id = v_id;

  -- Valor de cada nota: o desconto geral é repartido na proporção; o frete vai na nota de produtos (se houver).
  -- As duas somadas dão exatamente o total da venda.
  v_desc_prod := CASE WHEN v_prod + v_serv = 0 THEN 0 ELSE round(v_desc * v_prod::numeric / (v_prod + v_serv)) END;
  IF v_prod > 0 THEN
    v_modelo := p->>'preferred_product_invoice_model';
    IF v_modelo IS NULL OR v_modelo NOT IN ('nfce', 'nfe') THEN
      v_modelo := CASE WHEN v_tipo = 'PJ' OR length(regexp_replace(coalesce(v_doc_nota, ''), '[^A-Za-z0-9]', '', 'g')) = 14
                       THEN 'nfe' ELSE 'nfce' END;
    END IF;
    INSERT INTO public.sale_documents (sale_id, "group", model, amount_cents)
    VALUES (v_id, 'produtos', v_modelo, v_prod - v_desc_prod + v_frete);
  END IF;
  IF v_serv > 0 THEN
    INSERT INTO public.sale_documents (sale_id, "group", model, amount_cents)
    VALUES (v_id, 'servicos', 'nfse', v_serv - (v_desc - v_desc_prod) + CASE WHEN v_prod > 0 THEN 0 ELSE v_frete END);
  END IF;

  PERFORM public.venda_evento(v_id, format('Venda %s concluída (%s).', v_numero, public.formatar_reais(v_total)));
  v_pago := public.venda_lancar_pagamentos(v_id, coalesce(p->'payments', '[]'::jsonb), NULL);

  IF v_pago < v_total AND v_cliente IS NULL THEN
    RAISE EXCEPTION 'Para deixar a venda a receber, escolha um cliente cadastrado.' USING ERRCODE = '23514';
  END IF;

  IF v_orc_id IS NOT NULL THEN
    UPDATE public.quotes SET status = 'convertido', converted_sale_id = v_id, converted_sale_number = v_numero WHERE id = v_orc_id;
    PERFORM public.orcamento_evento(v_orc_id, 'convertido_venda', format('Convertido na venda %s.', v_numero));
  END IF;

  PERFORM public.venda_atualiza_busca(v_id);
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.venda_concluir(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.venda_concluir(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.venda_cancelar(p_id UUID, p_motivo TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  s public.sales%ROWTYPE;
  d public.sale_documents%ROWTYPE;
  v_motivo TEXT := btrim(coalesce(p_motivo, ''));
  v_ator TEXT := public.vendas_ator_nome();
BEGIN
  IF NOT public.pode_vender() OR public.nivel_financeiro() <> 'completo' THEN
    RAISE EXCEPTION 'Só o acesso financeiro completo cancela venda.' USING ERRCODE = '42501';
  END IF;
  IF v_motivo = '' THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento da venda.' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO s FROM public.sales WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF s.status = 'cancelada' THEN
    RAISE EXCEPTION 'Esta venda já está cancelada.' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO d FROM public.sale_documents WHERE sale_id = p_id AND status = 'emitida' LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Esta venda tem nota fiscal emitida (% nº %). Cancele a nota primeiro.', upper(d.model), d.number USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.financial_movements (occurred_date, direction, amount_cents, account_id, category_id, method, origin_type,
                                          sale_id, sale_payment_id, service_order_id, customer_name, description,
                                          reverses_movement_id, reversal_reason, created_by_name)
  SELECT greatest(public.hoje_local(), m.occurred_date),   -- cartão ainda não caído: estorna na data prevista
         CASE m.direction WHEN 'entrada' THEN 'saida' ELSE 'entrada' END,
         m.amount_cents, m.account_id, m.category_id, m.method, m.origin_type, m.sale_id, m.sale_payment_id,
         m.service_order_id, m.customer_name, 'Estorno: ' || m.description, m.id, v_motivo, v_ator
    FROM public.financial_movements m
   WHERE m.sale_id = p_id AND m.reverses_movement_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.financial_movements e WHERE e.reverses_movement_id = m.id);

  UPDATE public.sales SET status = 'cancelada', cancel_reason = v_motivo, cancelled_at = NOW(), cancelled_by_name = v_ator
   WHERE id = p_id;
  -- O orçamento de origem volta a poder virar venda (continua "convertido" se tiver gerado OS)
  IF s.quote_id IS NOT NULL THEN
    UPDATE public.quotes
       SET converted_sale_id = NULL, converted_sale_number = NULL,
           status = CASE WHEN converted_service_order_id IS NOT NULL THEN 'convertido' ELSE 'aprovado' END
     WHERE id = s.quote_id AND converted_sale_id = p_id;
    IF FOUND THEN
      PERFORM public.orcamento_evento(s.quote_id, 'nota', format('Venda %s cancelada: o orçamento pode virar venda de novo. Motivo: %s', s.number, v_motivo));
    END IF;
  END IF;

  PERFORM public.venda_evento(p_id, format('Venda cancelada%s. Motivo: %s',
    CASE WHEN s.paid_cents > 0 THEN ' (pagamentos estornados)' ELSE '' END, v_motivo));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.venda_cancelar(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.venda_cancelar(UUID, TEXT) TO authenticated;

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
  -- Já gerou OS: não gera outra. Só virou venda (cliente pagou antes): pode gerar a OS.
  IF o.converted_service_order_id IS NOT NULL THEN
    RAISE EXCEPTION 'Este orçamento já gerou a OS nº %.', (SELECT so.number FROM public.service_orders so WHERE so.id = o.converted_service_order_id) USING ERRCODE = '23514';
  END IF;
  IF o.status = 'convertido' AND o.converted_sale_id IS NULL THEN
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
  -- Se o orçamento já tinha virado venda, a venda passa a apontar para a OS
  UPDATE public.sales SET service_order_id = v_os_id
   WHERE id = o.converted_sale_id AND service_order_id IS NULL AND customer_id = o.customer_id;
  PERFORM public.orcamento_evento(p_id, 'convertido_os', format('Gerada OS nº %s com os serviços do orçamento.', v_os_num));

  RETURN jsonb_build_object('service_order_id', v_os_id, 'service_order_number', v_os_num, 'descricao', v_servicos);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.orcamento_gerar_os(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orcamento_gerar_os(UUID) TO authenticated;

COMMIT;
