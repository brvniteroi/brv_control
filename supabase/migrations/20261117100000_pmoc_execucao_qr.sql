-- =====================================================================
-- PMOC, fases 2 e 3 (docs/pmoc.md): OS do mês, checklist no app de campo, relatório mensal por link,
-- QR Code por aparelho com página pública e etiqueta na Elgin.
--
-- Decisões (2026-11-16/17):
--  * OS do mês: botão do escritório escolhe técnico, data, hora e duração; uma OS por plano por mês (OS cancelada não conta).
--  * Checklist próprio do PMOC, por aparelho, gravado em `pmoc_executions` (o técnico não lê as tabelas: tudo por funções).
--  * Sem assinatura: só o nome de quem acompanhou a visita (`accompanied_by`), obrigatório ao concluir.
--  * Token do aparelho em `equipments.public_token` (não adivinhável; NÃO usa `qr_code`, que é digitado à mão).
--  * Token do relatório por plano e mês em `pmoc_report_links`.
--  * Páginas públicas por funções SECURITY DEFINER que só devolvem dados do token (sem CPF, telefone, endereço).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Colunas e tabela novas
-- ---------------------------------------------------------------------
-- Token do QR Code do aparelho: 32 caracteres hexadecimais aleatórios (UUID sem hífens)
ALTER TABLE public.equipments
  ADD COLUMN IF NOT EXISTS public_token TEXT NOT NULL DEFAULT replace(gen_random_uuid()::TEXT, '-', '');
CREATE UNIQUE INDEX IF NOT EXISTS equipments_public_token_key ON public.equipments (public_token);

-- Fotos da visita por aparelho (URLs da HostGator)
ALTER TABLE public.pmoc_executions
  ADD COLUMN IF NOT EXISTS photo_urls JSONB NOT NULL DEFAULT '[]'::JSONB;

-- Tipo da OS gerada pelo sistema
INSERT INTO public.service_types (name) VALUES ('PMOC')
ON CONFLICT DO NOTHING;

-- Link público do relatório do mês (um por plano e mês)
CREATE TABLE IF NOT EXISTS public.pmoc_report_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.pmoc_plans (id) ON DELETE CASCADE,
  reference_month TEXT NOT NULL CHECK (reference_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::TEXT, '-', ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pmoc_report_links_mes_key UNIQUE (plan_id, reference_month)
);
ALTER TABLE public.pmoc_report_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pmoc_report_links FROM anon;
DROP POLICY IF EXISTS "Escritório lê" ON public.pmoc_report_links;
CREATE POLICY "Escritório lê" ON public.pmoc_report_links FOR SELECT TO authenticated
  USING ((SELECT public.eh_escritorio()));

-- Etiqueta do PMOC na fila da Elgin
ALTER TABLE public.print_jobs DROP CONSTRAINT IF EXISTS print_jobs_kind_check;
ALTER TABLE public.print_jobs
  ADD CONSTRAINT print_jobs_kind_check CHECK (kind IN ('etiqueta_oficina', 'etiqueta_placa', 'etiqueta_pmoc', 'teste'));

-- ---------------------------------------------------------------------
-- 2. Apoio: a tarefa cai no mês? (mesma regra de `tarefaCaiNoMes` em regrasPmoc.ts)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pmoc_tarefa_cai_no_mes(p_periodicidade TEXT, p_inicio INT, p_mes INT)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT p_mes BETWEEN 1 AND 12
     AND p_mes >= GREATEST(1, LEAST(12, COALESCE(p_inicio, 1)))
     AND (p_mes - GREATEST(1, LEAST(12, COALESCE(p_inicio, 1))))
         % (CASE p_periodicidade WHEN 'mensal' THEN 1 WHEN 'bimestral' THEN 2 WHEN 'trimestral' THEN 3
                                 WHEN 'semestral' THEN 6 ELSE 12 END) = 0;
$$;

-- Posição (1 a 12) do mês 'AAAA-MM' dentro da vigência que começa em p_inicio; NULL se fora dos 12 meses
CREATE OR REPLACE FUNCTION public.pmoc_offset_do_mes(p_inicio DATE, p_mes TEXT)
RETURNS INT
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT CASE WHEN d BETWEEN 0 AND 11 THEN d + 1 END
    FROM (SELECT (substr(p_mes, 1, 4)::INT * 12 + substr(p_mes, 6, 2)::INT)
                 - (EXTRACT(YEAR FROM p_inicio)::INT * 12 + EXTRACT(MONTH FROM p_inicio)::INT) AS d) x;
$$;

-- Aparelhos ativos do plano que têm tarefa prevista no mês, na ordem do plano (a letra A, B, C... segue essa ordem entre TODOS os ativos)
CREATE OR REPLACE FUNCTION public.pmoc_aparelhos_do_mes(p_plano UUID, p_mes TEXT)
RETURNS TABLE (plan_equipment_id UUID, letra_idx INT, qtd_tarefas INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH plano AS (SELECT start_date FROM public.pmoc_plans WHERE id = p_plano),
       ativos AS (
         SELECT e.id, (ROW_NUMBER() OVER (ORDER BY e.sort_order, e.id) - 1)::INT AS idx
           FROM public.pmoc_plan_equipments e WHERE e.plan_id = p_plano AND e.active
       )
  SELECT a.id, a.idx,
         (SELECT COUNT(*)::INT FROM public.pmoc_equipment_tasks t
           WHERE t.plan_equipment_id = a.id AND t.active
             AND public.pmoc_tarefa_cai_no_mes(t.periodicity, t.start_month_offset::INT,
                   COALESCE(public.pmoc_offset_do_mes((SELECT start_date FROM plano), p_mes), 0))) AS qtd
    FROM ativos a
   ORDER BY a.idx;
$$;
REVOKE EXECUTE ON FUNCTION public.pmoc_aparelhos_do_mes(UUID, TEXT) FROM PUBLIC, anon, authenticated;   -- só as outras funções (definer) chamam

-- ---------------------------------------------------------------------
-- 3. Gerar a OS do mês (só escritório)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pmoc_gerar_os_mes(
  p_plano UUID,
  p_mes TEXT,
  p_tecnico UUID,
  p_inicio TIMESTAMPTZ,
  p_minutos INT,
  p_obs TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_plano public.pmoc_plans;
  v_offset INT;
  v_tipo UUID;
  v_os UUID;
  v_num BIGINT;
  v_task UUID;
  v_incluidos INT := 0;
  v_existe RECORD;
  v_titulo TEXT;
  v_tec_nome TEXT;
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Só o escritório gera a OS do mês.' USING ERRCODE = '42501';
  END IF;
  IF p_mes IS NULL OR p_mes !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Mês de referência inválido.' USING ERRCODE = '23514';
  END IF;
  IF p_tecnico IS NULL THEN
    RAISE EXCEPTION 'Escolha o técnico responsável pela visita.' USING ERRCODE = '23514';
  END IF;
  IF p_inicio IS NULL THEN
    RAISE EXCEPTION 'Informe a data e a hora de início da visita.' USING ERRCODE = '23514';
  END IF;
  IF p_minutos IS NULL OR p_minutos <= 0 THEN
    RAISE EXCEPTION 'Informe a duração prevista da visita.' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_plano FROM public.pmoc_plans WHERE id = p_plano FOR UPDATE;   -- trava: dois cliques não geram duas OS
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano PMOC não encontrado.' USING ERRCODE = '23503';
  END IF;
  IF v_plano.status <> 'vigente' THEN
    RAISE EXCEPTION 'Só plano vigente gera OS do mês.' USING ERRCODE = '23514';
  END IF;
  v_offset := public.pmoc_offset_do_mes(v_plano.start_date, p_mes);
  IF v_offset IS NULL THEN
    RAISE EXCEPTION 'O mês % está fora da vigência do plano.', p_mes USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_tecnico AND active) THEN
    RAISE EXCEPTION 'Técnico não encontrado ou inativo.' USING ERRCODE = '23503';
  END IF;

  -- Já existe OS (não cancelada) para este plano e mês?
  SELECT so.id, so.number INTO v_existe
    FROM public.pmoc_executions x
    JOIN public.service_orders so ON so.id = x.service_order_id
   WHERE x.plan_id = p_plano AND x.reference_month = p_mes AND so.status <> 'cancelada'
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'service_order_id', v_existe.id, 'service_order_number', v_existe.number, 'reference_month', p_mes,
      'already_existed', TRUE,
      'message', 'A OS ' || v_existe.number || ' já foi gerada para este mês.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.pmoc_aparelhos_do_mes(p_plano, p_mes) WHERE qtd_tarefas > 0) THEN
    RAISE EXCEPTION 'Nenhum aparelho tem tarefa prevista neste mês.' USING ERRCODE = '23514';
  END IF;

  SELECT id INTO v_tipo FROM public.service_types WHERE lower(trim(name)) = 'pmoc' AND active;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Tipo de serviço "PMOC" não encontrado ou arquivado.' USING ERRCODE = '23503';
  END IF;

  SELECT name INTO v_tec_nome FROM public.employees WHERE id = p_tecnico;
  v_titulo := 'PMOC ' || v_plano.code || ' - ' || p_mes;

  INSERT INTO public.service_orders (customer_id, address_id, service_type_id, status, description, internal_notes)
  VALUES (v_plano.customer_id, v_plano.address_id, v_tipo, 'agendada',
          'Manutenção preventiva do PMOC ' || v_plano.code || ' (' || p_mes || ').',
          nullif(btrim(p_obs), ''))
  RETURNING id, number INTO v_os, v_num;

  -- Uma atividade por OS (regra do Control): técnico, data, hora e duração escolhidos
  INSERT INTO public.tasks (service_order_id, employee_id, title, status, scheduled_start, scheduled_end, estimated_minutes)
  VALUES (v_os, p_tecnico, v_titulo, 'agendada', p_inicio, p_inicio + make_interval(mins => p_minutos), p_minutos)
  RETURNING id INTO v_task;

  -- Aparelhos da visita: ligados à OS e uma linha de execução pendente por aparelho
  INSERT INTO public.service_order_equipments (service_order_id, equipment_id)
  SELECT v_os, pe.equipment_id
    FROM public.pmoc_aparelhos_do_mes(p_plano, p_mes) a
    JOIN public.pmoc_plan_equipments pe ON pe.id = a.plan_equipment_id
   WHERE a.qtd_tarefas > 0
  ON CONFLICT DO NOTHING;

  -- Mês refeito depois de OS cancelada: reaproveita a linha (única por aparelho e mês)
  INSERT INTO public.pmoc_executions (plan_id, plan_equipment_id, reference_month, status, service_order_id, task_id, technician_id)
  SELECT p_plano, a.plan_equipment_id, p_mes, 'pendente', v_os, v_task, p_tecnico
    FROM public.pmoc_aparelhos_do_mes(p_plano, p_mes) a
   WHERE a.qtd_tarefas > 0
  ON CONFLICT (plan_equipment_id, reference_month) DO UPDATE
     SET service_order_id = EXCLUDED.service_order_id, task_id = EXCLUDED.task_id,
         technician_id = EXCLUDED.technician_id
   WHERE public.pmoc_executions.status = 'pendente';
  GET DIAGNOSTICS v_incluidos = ROW_COUNT;

  RETURN jsonb_build_object(
    'service_order_id', v_os, 'service_order_number', v_num, 'task_id', v_task, 'reference_month', p_mes,
    'equipments_included', v_incluidos, 'already_existed', FALSE,
    'message', 'OS ' || v_num || ' gerada e agendada para ' || v_tec_nome || '.');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pmoc_gerar_os_mes(UUID, TEXT, UUID, TIMESTAMPTZ, INT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pmoc_gerar_os_mes(UUID, TEXT, UUID, TIMESTAMPTZ, INT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------
-- 4. Checklist do técnico (app de campo): ler, salvar um aparelho, concluir
-- ---------------------------------------------------------------------
-- Pode quem é escritório ou o técnico dono da atividade
CREATE OR REPLACE FUNCTION public.pmoc_pode_mexer_na_atividade(p_task UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.eh_escritorio()
      OR EXISTS (SELECT 1 FROM public.tasks t
                  WHERE t.id = p_task AND t.employee_id IS NOT NULL
                    AND t.employee_id = public.meu_colaborador_id());
$$;
REVOKE EXECUTE ON FUNCTION public.pmoc_pode_mexer_na_atividade(UUID) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.pmoc_checklist_atividade(p_task UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_cab RECORD;
  v_aparelhos JSONB;
BEGIN
  IF NOT public.pmoc_pode_mexer_na_atividade(p_task) THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT x.plan_id, x.reference_month, x.service_order_id, so.number AS os_numero, p.code,
         coalesce(nullif(btrim(p.customer_trade_name), ''), p.customer_name) AS cliente,
         p.start_date,
         (SELECT x2.accompanied_by FROM public.pmoc_executions x2
           WHERE x2.task_id = p_task AND x2.accompanied_by IS NOT NULL LIMIT 1) AS acompanhado
    INTO v_cab
    FROM public.pmoc_executions x
    JOIN public.pmoc_plans p ON p.id = x.plan_id
    LEFT JOIN public.service_orders so ON so.id = x.service_order_id
   WHERE x.task_id = p_task
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('is_pmoc', FALSE, 'task_id', p_task, 'equipments', '[]'::JSONB);
  END IF;

  SELECT coalesce(jsonb_agg(item ORDER BY ord), '[]'::JSONB) INTO v_aparelhos
    FROM (
      SELECT a.letra_idx AS ord,
             jsonb_build_object(
               'plan_equipment_id', pe.id,
               'equipment_id', pe.equipment_id,
               'letter_idx', a.letra_idx,   -- o app converte em A, B, C... (letraEquipamento)
               'name', pe.name,
               'identifier', pe.identifier,
               'environment_name', env.name,
               'equipment_type', eq.category,
               'capacity_btu', coalesce(eq.capacity_btu, 0),
               'status', x.status,
               'scheduled_tasks', coalesce((
                  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.sort_order)
                    FROM public.pmoc_equipment_tasks t
                   WHERE t.plan_equipment_id = pe.id AND t.active
                     AND public.pmoc_tarefa_cai_no_mes(t.periodicity, t.start_month_offset::INT,
                           coalesce(public.pmoc_offset_do_mes(v_cab.start_date, v_cab.reference_month), 0))), '[]'::JSONB),
               'required_measurements', coalesce((
                  SELECT jsonb_agg(DISTINCT m)
                    FROM public.pmoc_equipment_tasks t, unnest(t.measurement_fields) m
                   WHERE t.plan_equipment_id = pe.id AND t.active AND t.requires_measurement
                     AND public.pmoc_tarefa_cai_no_mes(t.periodicity, t.start_month_offset::INT,
                           coalesce(public.pmoc_offset_do_mes(v_cab.start_date, v_cab.reference_month), 0))), '[]'::JSONB),
               'task_results', x.task_results,
               'measurements', jsonb_build_object(
                  'current_a', x.measurements -> 'current_a', 'temp_supply_c', x.measurements -> 'temp_supply_c',
                  'temp_return_c', x.measurements -> 'temp_return_c', 'temp_ambient_c', x.measurements -> 'temp_ambient_c'),
               'technician_notes', x.technician_notes,
               'photo_urls', x.photo_urls,
               'unattended_reason', x.unattended_reason,
               'updated_at', x.updated_at
             ) AS item
        FROM public.pmoc_executions x
        JOIN public.pmoc_plan_equipments pe ON pe.id = x.plan_equipment_id
        JOIN public.equipments eq ON eq.id = pe.equipment_id
        LEFT JOIN public.pmoc_environments env ON env.id = pe.environment_id
        JOIN LATERAL (SELECT a2.letra_idx FROM public.pmoc_aparelhos_do_mes(x.plan_id, x.reference_month) a2
                       WHERE a2.plan_equipment_id = pe.id) a ON TRUE
       WHERE x.task_id = p_task
    ) q;

  RETURN jsonb_build_object(
    'is_pmoc', TRUE, 'task_id', p_task, 'service_order_id', v_cab.service_order_id,
    'service_order_number', v_cab.os_numero, 'plan_id', v_cab.plan_id, 'plan_code', v_cab.code,
    'customer_name', v_cab.cliente, 'reference_month', v_cab.reference_month,
    'accompanied_by', v_cab.acompanhado, 'equipments', v_aparelhos);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pmoc_checklist_atividade(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pmoc_checklist_atividade(UUID) TO authenticated;

-- Grava um aparelho da visita (tudo ou nada)
CREATE OR REPLACE FUNCTION public.pmoc_salvar_execucao(p_task UUID, p_plano_equip UUID, p_dados JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_x public.pmoc_executions;
  v_plano public.pmoc_plans;
  v_status TEXT := p_dados ->> 'status';
  v_motivo TEXT := nullif(btrim(coalesce(p_dados ->> 'unattended_reason', '')), '');
  v_resultados JSONB := coalesce(p_dados -> 'task_results', '[]'::JSONB);
  v_medidas JSONB := coalesce(p_dados -> 'measurements', '{}'::JSONB);
  v_fotos JSONB := coalesce(p_dados -> 'photo_urls', '[]'::JSONB);
  v_task_status TEXT;
  v_offset INT;
  v_faltando TEXT;
  v_k TEXT;
BEGIN
  IF NOT public.pmoc_pode_mexer_na_atividade(p_task) THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  IF v_status NOT IN ('concluida', 'nao_atendido') THEN
    RAISE EXCEPTION 'Situação do aparelho inválida.' USING ERRCODE = '23514';
  END IF;
  IF jsonb_typeof(v_resultados) <> 'array' OR jsonb_typeof(v_fotos) <> 'array' OR jsonb_typeof(v_medidas) <> 'object' THEN
    RAISE EXCEPTION 'Dados da visita inválidos.' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_x FROM public.pmoc_executions WHERE task_id = p_task AND plan_equipment_id = p_plano_equip FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este aparelho não faz parte da visita.' USING ERRCODE = '23503';
  END IF;
  SELECT status INTO v_task_status FROM public.tasks WHERE id = p_task;
  IF v_task_status IN ('cancelada') OR (v_task_status = 'concluida' AND NOT public.eh_escritorio()) THEN
    RAISE EXCEPTION 'A atividade já foi encerrada.' USING ERRCODE = '42501';
  END IF;

  IF v_status = 'nao_atendido' THEN
    IF v_motivo IS NULL THEN
      RAISE EXCEPTION 'Informe o motivo pelo qual o aparelho não pôde ser atendido.' USING ERRCODE = '23514';
    END IF;
  ELSE
    -- Toda tarefa prevista no mês precisa de resultado; "não feito" exige observação
    SELECT * INTO v_plano FROM public.pmoc_plans WHERE id = v_x.plan_id;
    v_offset := coalesce(public.pmoc_offset_do_mes(v_plano.start_date, v_x.reference_month), 0);
    SELECT t.description INTO v_faltando
      FROM public.pmoc_equipment_tasks t
     WHERE t.plan_equipment_id = p_plano_equip AND t.active
       AND public.pmoc_tarefa_cai_no_mes(t.periodicity, t.start_month_offset::INT, v_offset)
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_resultados) r
                        WHERE r ->> 'equipment_task_id' = t.id::TEXT
                          AND r ->> 'result' IN ('feito', 'nao_feito', 'nao_se_aplica'))
     LIMIT 1;
    IF v_faltando IS NOT NULL THEN
      RAISE EXCEPTION 'Marque o resultado da tarefa "%".', v_faltando USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_resultados) r
                WHERE r ->> 'result' = 'nao_feito' AND nullif(btrim(coalesce(r ->> 'notes', '')), '') IS NULL) THEN
      RAISE EXCEPTION 'Informe a observação das tarefas marcadas como "Não feito".' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Só as 4 grandezas conhecidas, só números
  FOR v_k IN SELECT jsonb_object_keys(v_medidas) LOOP
    IF v_k NOT IN ('current_a', 'temp_supply_c', 'temp_return_c', 'temp_ambient_c') THEN
      RAISE EXCEPTION 'Medição desconhecida: %.', v_k USING ERRCODE = '23514';
    END IF;
    IF jsonb_typeof(v_medidas -> v_k) NOT IN ('number', 'null') THEN
      RAISE EXCEPTION 'A medição % precisa ser um número.', v_k USING ERRCODE = '23514';
    END IF;
  END LOOP;
  -- Fotos: só links https (da HostGator) e no máximo 30
  IF jsonb_array_length(v_fotos) > 30 OR EXISTS (
       SELECT 1 FROM jsonb_array_elements_text(v_fotos) f WHERE f !~ '^https://') THEN
    RAISE EXCEPTION 'Fotos inválidas.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.pmoc_executions SET
    status = v_status,
    task_results = CASE WHEN v_status = 'concluida' THEN v_resultados ELSE '[]'::JSONB END,
    measurements = CASE WHEN v_status = 'concluida' THEN v_medidas ELSE '{}'::JSONB END,
    technician_notes = nullif(btrim(coalesce(p_dados ->> 'technician_notes', '')), ''),
    unattended_reason = CASE WHEN v_status = 'nao_atendido' THEN v_motivo ELSE NULL END,
    photo_urls = v_fotos,
    executed_at = NOW(),
    technician_id = coalesce(public.meu_colaborador_id(), technician_id)
  WHERE id = v_x.id
  RETURNING * INTO v_x;

  RETURN to_jsonb(v_x);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pmoc_salvar_execucao(UUID, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pmoc_salvar_execucao(UUID, UUID, JSONB) TO authenticated;

-- Garante o link público do relatório do plano no mês (uso interno)
CREATE OR REPLACE FUNCTION public.pmoc_garante_link(p_plano UUID, p_mes TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_token TEXT;
BEGIN
  INSERT INTO public.pmoc_report_links (plan_id, reference_month) VALUES (p_plano, p_mes)
  ON CONFLICT (plan_id, reference_month) DO NOTHING;
  SELECT token INTO v_token FROM public.pmoc_report_links WHERE plan_id = p_plano AND reference_month = p_mes;
  RETURN v_token;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pmoc_garante_link(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- Conclui o checklist: todos os aparelhos preenchidos + nome de quem acompanhou
CREATE OR REPLACE FUNCTION public.pmoc_concluir_checklist(p_task UUID, p_acompanhado TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_nome TEXT := nullif(btrim(coalesce(p_acompanhado, '')), '');
  v_plano UUID;
  v_mes TEXT;
  v_pend INT;
BEGIN
  IF NOT public.pmoc_pode_mexer_na_atividade(p_task) THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE = '42501';
  END IF;
  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Informe o nome de quem acompanhou a visita.' USING ERRCODE = '23514';
  END IF;
  SELECT plan_id, reference_month INTO v_plano, v_mes FROM public.pmoc_executions WHERE task_id = p_task LIMIT 1;
  IF NOT FOUND THEN
    RETURN;   -- atividade comum: nada a fazer
  END IF;
  SELECT COUNT(*) INTO v_pend FROM public.pmoc_executions WHERE task_id = p_task AND status = 'pendente';
  IF v_pend > 0 THEN
    RAISE EXCEPTION 'Falta preencher % aparelho(s) do checklist PMOC antes de concluir a visita.', v_pend USING ERRCODE = '23514';
  END IF;
  UPDATE public.pmoc_executions SET accompanied_by = left(v_nome, 120) WHERE task_id = p_task;
  PERFORM public.pmoc_garante_link(v_plano, v_mes);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pmoc_concluir_checklist(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pmoc_concluir_checklist(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------
-- 5. Link do relatório (escritório) e páginas públicas (anon)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pmoc_link_relatorio(p_plano UUID, p_mes TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.eh_escritorio() THEN
    RAISE EXCEPTION 'Só o escritório gera o link do relatório.' USING ERRCODE = '42501';
  END IF;
  IF p_mes IS NULL OR p_mes !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Mês de referência inválido.' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pmoc_plans WHERE id = p_plano) THEN
    RAISE EXCEPTION 'Plano PMOC não encontrado.' USING ERRCODE = '23503';
  END IF;
  RETURN public.pmoc_garante_link(p_plano, p_mes);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pmoc_link_relatorio(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pmoc_link_relatorio(UUID, TEXT) TO authenticated;

-- Relatório mensal público: devolve as peças brutas (o app monta o relatório com as mesmas regras da tela interna).
-- Sem CPF/CNPJ do cliente, sem CPF do responsável, sem observações internas do plano.
CREATE OR REPLACE FUNCTION public.pmoc_relatorio_publico(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_link public.pmoc_report_links;
  v_plano JSONB;
BEGIN
  IF p_token IS NULL OR length(p_token) NOT BETWEEN 8 AND 64 THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_link FROM public.pmoc_report_links WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  -- Só o que o cliente precisa ver: relatório de mês em que houve visita registrada
  IF NOT EXISTS (SELECT 1 FROM public.pmoc_executions
                  WHERE plan_id = v_link.plan_id AND reference_month = v_link.reference_month
                    AND status IN ('concluida', 'nao_atendido')) THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(p) - 'customer_document' - 'responsible_cpf' - 'notes' - 'created_by' - 'trt_attachment_url'
         - 'trt_attachment_name' - 'trt_attachment_mime' - 'address_id'
    INTO v_plano FROM public.pmoc_plans p WHERE p.id = v_link.plan_id;

  RETURN jsonb_build_object(
    'public_token', v_link.token,
    'reference_month', v_link.reference_month,
    'plan', v_plano,
    'environments', coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.sort_order)
                                FROM public.pmoc_environments e WHERE e.plan_id = v_link.plan_id), '[]'::JSONB),
    'equipments', coalesce((SELECT jsonb_agg(to_jsonb(pe) || jsonb_build_object(
                              'equipment', jsonb_build_object('category', eq.category, 'brand', eq.brand, 'model', eq.model,
                                                              'serial_number', eq.serial_number, 'capacity_btu', eq.capacity_btu))
                              ORDER BY pe.sort_order)
                              FROM public.pmoc_plan_equipments pe JOIN public.equipments eq ON eq.id = pe.equipment_id
                             WHERE pe.plan_id = v_link.plan_id), '[]'::JSONB),
    'tasks', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.sort_order)
                         FROM public.pmoc_equipment_tasks t WHERE t.plan_id = v_link.plan_id), '[]'::JSONB),
    'executions', coalesce((SELECT jsonb_agg(to_jsonb(x) || jsonb_build_object(
                              'service_order_number', so.number, 'technician_name', emp.name))
                              FROM public.pmoc_executions x
                              LEFT JOIN public.service_orders so ON so.id = x.service_order_id
                              LEFT JOIN public.employees emp ON emp.id = x.technician_id
                             WHERE x.plan_id = v_link.plan_id AND x.reference_month = v_link.reference_month), '[]'::JSONB)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pmoc_relatorio_publico(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pmoc_relatorio_publico(TEXT) TO anon, authenticated;

-- Página pública do aparelho (QR Code): só o que está na etiqueta e no histórico
CREATE OR REPLACE FUNCTION public.pmoc_equipamento_publico(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_eq public.equipments;
  v_pe RECORD;
  v_vigente BOOLEAN := FALSE;
  v_historico JSONB;
BEGIN
  IF p_token IS NULL OR length(p_token) NOT BETWEEN 8 AND 64 THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_eq FROM public.equipments WHERE public_token = p_token;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Plano em que o aparelho aparece: o vigente hoje; senão o mais recente
  SELECT pe.id AS pe_id, pe.name, pe.identifier, pe.active, env.name AS ambiente,
         p.id AS plano_id, p.code, p.start_date, p.end_date, p.status, p.responsible_name,
         p.registration_type, p.registration_number, p.responsibility_term_number,
         coalesce(nullif(btrim(p.customer_trade_name), ''), p.customer_name) AS cliente
    INTO v_pe
    FROM public.pmoc_plan_equipments pe
    JOIN public.pmoc_plans p ON p.id = pe.plan_id
    LEFT JOIN public.pmoc_environments env ON env.id = pe.environment_id
   WHERE pe.equipment_id = v_eq.id
   ORDER BY (p.status = 'vigente' AND CURRENT_DATE BETWEEN p.start_date AND p.end_date AND pe.active) DESC,
            p.start_date DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;   -- aparelho sem PMOC: não há página pública
  END IF;
  v_vigente := v_pe.active AND v_pe.status = 'vigente' AND CURRENT_DATE BETWEEN v_pe.start_date AND v_pe.end_date;

  SELECT coalesce(jsonb_agg(h ORDER BY h ->> 'reference_month' DESC), '[]'::JSONB) INTO v_historico
    FROM (
      SELECT jsonb_build_object(
               'reference_month', x.reference_month,
               'executed_at', x.executed_at,
               'status', x.status,
               'tasks_done_count', (SELECT COUNT(*) FROM jsonb_array_elements(x.task_results) r WHERE r ->> 'result' = 'feito'),
               'tasks_total_count', (SELECT COUNT(*) FROM public.pmoc_equipment_tasks t
                                      WHERE t.plan_equipment_id = x.plan_equipment_id AND t.active
                                        AND public.pmoc_tarefa_cai_no_mes(t.periodicity, t.start_month_offset::INT,
                                              coalesce(public.pmoc_offset_do_mes(pl.start_date, x.reference_month), 0))),
               'report_token', (SELECT l.token FROM public.pmoc_report_links l
                                 WHERE l.plan_id = x.plan_id AND l.reference_month = x.reference_month)
             ) AS h
        FROM public.pmoc_executions x
        JOIN public.pmoc_plan_equipments pe2 ON pe2.id = x.plan_equipment_id
        JOIN public.pmoc_plans pl ON pl.id = x.plan_id
       WHERE pe2.equipment_id = v_eq.id AND x.status IN ('concluida', 'nao_atendido')
       ORDER BY x.reference_month DESC
       LIMIT 12
    ) q;

  RETURN jsonb_build_object(
    'token', p_token,
    'customer_display_name', v_pe.cliente,
    'environment_name', v_pe.ambiente,
    'identifier', v_pe.identifier,
    'name', v_pe.name,
    'equipment_type', v_eq.category,
    'brand', v_eq.brand,
    'model', v_eq.model,
    'capacity_btu', coalesce(v_eq.capacity_btu, 0),
    'has_active_plan', v_vigente,
    'active_plan', CASE WHEN v_vigente THEN jsonb_build_object(
        'code', v_pe.code, 'start_date', v_pe.start_date, 'end_date', v_pe.end_date,
        'responsible_name', v_pe.responsible_name, 'registration_type', v_pe.registration_type,
        'registration_number', v_pe.registration_number,
        'responsibility_term_number', v_pe.responsibility_term_number) END,
    'recent_maintenances', v_historico
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pmoc_equipamento_publico(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pmoc_equipamento_publico(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Rede de proteção: o técnico não conclui atividade de PMOC sem o checklist completo
--    (cobre o caso de o app não ter carregado o checklist, por exemplo sem internet).
--    O escritório pode concluir à mão (correção); scripts com service_role não são barrados.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tasks_exige_checklist_pmoc()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.eh_escritorio() THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'concluida' AND OLD.status IS DISTINCT FROM 'concluida' THEN
    IF EXISTS (SELECT 1 FROM public.pmoc_executions x
                WHERE x.task_id = NEW.id AND (x.status = 'pendente' OR x.accompanied_by IS NULL)) THEN
      RAISE EXCEPTION 'Preencha o checklist do PMOC (todos os aparelhos e o nome de quem acompanhou) antes de concluir a atividade.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tasks_exige_checklist_pmoc ON public.tasks;
CREATE TRIGGER tasks_exige_checklist_pmoc
  BEFORE UPDATE OF status ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_exige_checklist_pmoc();
