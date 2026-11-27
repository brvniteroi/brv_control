-- =====================================================================
-- Registro do ajuste de DADOS de 2026-11-27 (não é migration): tirar "mão de obra"/"M.O" do catálogo
-- e do texto de orçamento, por orientação da contabilidade (empresa do Simples Nacional).
-- Já aplicado no banco; não rodar de novo (a conferência abaixo para com erro se já foi feito).
-- Nomes antigos: os de cada UPDATE abaixo ("de" -> "para"). Orçamentos e vendas já feitos não mudam.
-- =====================================================================
BEGIN;

CREATE TEMP TABLE troca (de TEXT PRIMARY KEY, para TEXT NOT NULL) ON COMMIT DROP;
INSERT INTO troca VALUES
  ('M.O Instal Ar Cond split 7.500 btus',  'Instalação de ar-condicionado split 7.500 btus'),
  ('M.O Instal Ar Cond split 9.000 btus',  'Instalação de ar-condicionado split 9.000 btus'),
  ('M.O Instal Ar Cond split 12.000 btus', 'Instalação de ar-condicionado split 12.000 btus'),
  ('M.O Instal Ar Cond split 18.000 btus', 'Instalação de ar-condicionado split 18.000 btus'),
  ('M.O Instal Ar Cond split 22.000 btus', 'Instalação de ar-condicionado split 22.000 btus'),
  ('M.O Instal Ar Cond split 24.000 btus', 'Instalação de ar-condicionado split 24.000 btus'),
  ('M.O Instal Ar Cond split 30.000 btus', 'Instalação de ar-condicionado split 30.000 btus'),
  ('M.O Instal Ar Cond split 36.000 btus', 'Instalação de ar-condicionado split 36.000 btus'),
  ('M.O Instal Ar Cond split 48.000 btus', 'Instalação de ar-condicionado split 48.000 btus'),
  ('M.O Instal Ar Cond split 60.000 btus', 'Instalação de ar-condicionado split 60.000 btus'),
  ('M.O Instal Ar Cond split 80.000 btus', 'Instalação de ar-condicionado split 80.000 btus'),
  ('M.O Instalação Multi Inverter',        'Instalação de ar-condicionado Multi Inverter'),
  ('MÃO-DE-OBRA DE CORTINA DE AR',         'Instalação de cortina de ar'),
  ('Mão-de-Obra Elétrica',                 'Serviço elétrico'),
  ('Serviço de M.O de Dreno',              'Serviço de dreno'),
  ('Mão-de-obra de serviços',              'Serviço de manutenção e conserto de ar-condicionado');

DO $ajuste$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM public.catalog_items c JOIN troca t ON t.de = c.name AND c.kind = 'servico' AND c.active;
  IF n <> 16 THEN RAISE EXCEPTION 'Esperava 16 serviços com o nome antigo, achei %.', n; END IF;

  UPDATE public.catalog_items c SET name = t.para FROM troca t WHERE t.de = c.name AND c.kind = 'servico';

  INSERT INTO public.catalog_items (code, name, kind, unit, category, sale_price_cents, type_reviewed)
  VALUES ('000900', 'Serviço de instalação de ar-condicionado', 'servico', 'SRV', 'Serviços', 0, TRUE);

  UPDATE public.quote_texts
     SET title = 'Fio e serviço elétrico',
         content = 'O fio e o serviço elétrico serão acrescentados no orçamento depois da execução, pois não sabemos a metragem.'
   WHERE title = 'Fio e mão de obra da elétrica';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Esperava 1 texto de orçamento, achei %.', n; END IF;

  SELECT count(*) INTO n FROM public.catalog_items WHERE public.sem_acento(name) ~ '(\mm\.\s?o\M|mao[ -]de[ -]obra)';
  IF n <> 0 THEN RAISE EXCEPTION 'Ainda há % item(ns) com o termo.', n; END IF;
END $ajuste$;

COMMIT;
