-- ================================================================
-- MYD3000 — QUOTES IMPROVEMENTS
-- Adds commercial_total column and updates affected RPCs.
--
-- Changes:
--   1. quotes.commercial_total (nullable numeric)
--      NULL  → use calculated total (backward compatible)
--      value → use as the commercial/contractual amount
--   2. create_quote_with_items — stores commercial_total
--   3. update_quote_with_items — stores commercial_total
--   4. approve_quote — uses COALESCE(commercial_total, total)
--      for project.total_amount and contract.total_amount
--   5. duplicate_quote — copies commercial_total
--
-- Safe to apply: additive only, no data loss.
-- Existing quotes get commercial_total = NULL → no behavior change.
-- ================================================================

BEGIN;

-- ================================================================
-- 1. Add column to quotes
-- ================================================================

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS commercial_total numeric;

-- ================================================================
-- 2. create_quote_with_items
-- ================================================================

CREATE OR REPLACE FUNCTION public.create_quote_with_items(
  quote_data jsonb,
  items_data jsonb,
  terms_data jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_quote_id uuid;
  v_item     jsonb;
  v_term     jsonb;
  v_sort     integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  INSERT INTO public.quotes (
    client_id, title, status, issue_date, valid_until,
    subtotal, discount, tax, total, commercial_total,
    initial_payment_percentage, initial_payment_amount,
    final_payment_percentage,   final_payment_amount,
    includes, excludes, terms, notes,
    project_type, responsible_architect_name, responsible_architect_id,
    created_by
  ) VALUES (
    (quote_data->>'client_id')::uuid,
    quote_data->>'title',
    COALESCE(quote_data->>'status', 'draft'),
    COALESCE((quote_data->>'issue_date')::date, CURRENT_DATE),
    (quote_data->>'valid_until')::date,
    COALESCE((quote_data->>'subtotal')::numeric, 0),
    COALESCE((quote_data->>'discount')::numeric, 0),
    COALESCE((quote_data->>'tax')::numeric, 0),
    COALESCE((quote_data->>'total')::numeric, 0),
    (quote_data->>'commercial_total')::numeric,
    COALESCE((quote_data->>'initial_payment_percentage')::numeric, 80),
    COALESCE((quote_data->>'initial_payment_amount')::numeric, 0),
    COALESCE((quote_data->>'final_payment_percentage')::numeric, 20),
    COALESCE((quote_data->>'final_payment_amount')::numeric, 0),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(quote_data->'includes')), ARRAY[]::text[]),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(quote_data->'excludes')), ARRAY[]::text[]),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(quote_data->'terms')),    ARRAY[]::text[]),
    quote_data->>'notes',
    quote_data->>'project_type',
    quote_data->>'responsible_architect_name',
    (quote_data->>'responsible_architect_id')::uuid,
    auth.uid()
  ) RETURNING id INTO v_quote_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(items_data) LOOP
    INSERT INTO public.quote_items (
      quote_id, description, height, width, depth, measurement_notes,
      quantity, unit_price, line_total, sort_order
    ) VALUES (
      v_quote_id,
      v_item->>'description',
      (v_item->>'height')::numeric,
      (v_item->>'width')::numeric,
      (v_item->>'depth')::numeric,
      v_item->>'measurement_notes',
      COALESCE((v_item->>'quantity')::integer, 1),
      COALESCE((v_item->>'unit_price')::numeric, 0),
      COALESCE((v_item->>'line_total')::numeric, 0),
      v_sort
    );
    v_sort := v_sort + 1;
  END LOOP;

  v_sort := 0;
  FOR v_term IN SELECT * FROM jsonb_array_elements(terms_data) LOOP
    INSERT INTO public.quote_payment_terms (
      quote_id, installment_number, concept, percentage, amount,
      due_condition, due_date, sort_order
    ) VALUES (
      v_quote_id,
      COALESCE((v_term->>'installment_number')::integer, v_sort + 1),
      COALESCE(v_term->>'concept', 'Cuota'),
      (v_term->>'percentage')::numeric,
      (v_term->>'amount')::numeric,
      v_term->>'due_condition',
      (v_term->>'due_date')::date,
      v_sort
    );
    v_sort := v_sort + 1;
  END LOOP;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    auth.uid(), 'quote', v_quote_id, 'created',
    jsonb_build_object('total', quote_data->>'total', 'client_id', quote_data->>'client_id')
  );

  RETURN v_quote_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_quote_with_items(jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_quote_with_items(jsonb, jsonb, jsonb) TO authenticated;

-- ================================================================
-- 3. update_quote_with_items
-- ================================================================

CREATE OR REPLACE FUNCTION public.update_quote_with_items(
  p_quote_id uuid,
  quote_data jsonb,
  items_data jsonb,
  terms_data jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item jsonb;
  v_term jsonb;
  v_sort integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  UPDATE public.quotes SET
    client_id                  = COALESCE((quote_data->>'client_id')::uuid, client_id),
    title                      = quote_data->>'title',
    issue_date                 = COALESCE((quote_data->>'issue_date')::date, issue_date),
    valid_until                = (quote_data->>'valid_until')::date,
    subtotal                   = COALESCE((quote_data->>'subtotal')::numeric,  subtotal),
    discount                   = COALESCE((quote_data->>'discount')::numeric,  discount),
    tax                        = COALESCE((quote_data->>'tax')::numeric,       tax),
    total                      = COALESCE((quote_data->>'total')::numeric,     total),
    commercial_total           = (quote_data->>'commercial_total')::numeric,
    initial_payment_percentage = COALESCE((quote_data->>'initial_payment_percentage')::numeric, initial_payment_percentage),
    initial_payment_amount     = COALESCE((quote_data->>'initial_payment_amount')::numeric,     initial_payment_amount),
    final_payment_percentage   = COALESCE((quote_data->>'final_payment_percentage')::numeric,   final_payment_percentage),
    final_payment_amount       = COALESCE((quote_data->>'final_payment_amount')::numeric,       final_payment_amount),
    includes = COALESCE(ARRAY(SELECT jsonb_array_elements_text(quote_data->'includes')), includes),
    excludes = COALESCE(ARRAY(SELECT jsonb_array_elements_text(quote_data->'excludes')), excludes),
    terms    = COALESCE(ARRAY(SELECT jsonb_array_elements_text(quote_data->'terms')),    terms),
    notes                      = quote_data->>'notes',
    project_type               = COALESCE(quote_data->>'project_type', project_type),
    responsible_architect_name = quote_data->>'responsible_architect_name',
    responsible_architect_id   = (quote_data->>'responsible_architect_id')::uuid,
    updated_at                 = now()
  WHERE id = p_quote_id;

  DELETE FROM public.quote_items WHERE quote_id = p_quote_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(items_data) LOOP
    INSERT INTO public.quote_items (
      quote_id, description, height, width, depth, measurement_notes,
      quantity, unit_price, line_total, sort_order
    ) VALUES (
      p_quote_id,
      v_item->>'description',
      (v_item->>'height')::numeric,
      (v_item->>'width')::numeric,
      (v_item->>'depth')::numeric,
      v_item->>'measurement_notes',
      COALESCE((v_item->>'quantity')::integer, 1),
      COALESCE((v_item->>'unit_price')::numeric, 0),
      COALESCE((v_item->>'line_total')::numeric, 0),
      v_sort
    );
    v_sort := v_sort + 1;
  END LOOP;

  DELETE FROM public.quote_payment_terms WHERE quote_id = p_quote_id;
  v_sort := 0;
  FOR v_term IN SELECT * FROM jsonb_array_elements(terms_data) LOOP
    INSERT INTO public.quote_payment_terms (
      quote_id, installment_number, concept, percentage, amount,
      due_condition, due_date, sort_order
    ) VALUES (
      p_quote_id,
      COALESCE((v_term->>'installment_number')::integer, v_sort + 1),
      COALESCE(v_term->>'concept', 'Cuota'),
      (v_term->>'percentage')::numeric,
      (v_term->>'amount')::numeric,
      v_term->>'due_condition',
      (v_term->>'due_date')::date,
      v_sort
    );
    v_sort := v_sort + 1;
  END LOOP;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'updated',
    jsonb_build_object('total', quote_data->>'total'));

  RETURN p_quote_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_quote_with_items(uuid, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_quote_with_items(uuid, jsonb, jsonb, jsonb) TO authenticated;

-- ================================================================
-- 4. approve_quote — use COALESCE(commercial_total, total)
-- ================================================================

CREATE OR REPLACE FUNCTION public.approve_quote(p_quote_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
  v_quote           public.quotes%ROWTYPE;
  v_project_id      uuid;
  v_project_number  bigint;
  v_contract_id     uuid;
  v_contract_number bigint;
  v_amount          numeric;
BEGIN
  SELECT * INTO v_quote FROM public.quotes WHERE id=p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;
  IF v_quote.status NOT IN ('review','draft') THEN
    RAISE EXCEPTION 'La cotización ya fue procesada (estado: %)', v_quote.status;
  END IF;
  IF EXISTS (SELECT 1 FROM public.projects WHERE quote_id=p_quote_id) THEN
    RAISE EXCEPTION 'already exists for this quote';
  END IF;

  -- Use commercial_total when set, otherwise use calculated total
  v_amount := COALESCE(v_quote.commercial_total, v_quote.total, 0);

  UPDATE public.quotes SET
    status=      'approved',
    approved_by= auth.uid(),
    approved_at= now(),
    updated_at=  now()
  WHERE id=p_quote_id;

  INSERT INTO public.projects (
    client_id, quote_id, name, total_amount, status, project_origin,
    project_type, responsible_architect_name, responsible_architect_id, created_by
  ) VALUES (
    v_quote.client_id, p_quote_id,
    COALESCE(v_quote.title, 'Proyecto sin título'),
    v_amount, 'planning', 'quote',
    v_quote.project_type,
    v_quote.responsible_architect_name,
    v_quote.responsible_architect_id,
    auth.uid()
  ) RETURNING id, project_number INTO v_project_id, v_project_number;

  INSERT INTO public.contracts (
    project_id, client_id, quote_id, total_amount,
    terms, status, contract_date, created_by
  ) VALUES (
    v_project_id, v_quote.client_id, p_quote_id,
    v_amount,
    COALESCE(v_quote.terms, ARRAY[]::text[]),
    'draft', CURRENT_DATE, auth.uid()
  ) RETURNING id, contract_number INTO v_contract_id, v_contract_number;

  -- Prefer quote_payment_terms when present; fall back to summary fields
  IF EXISTS (SELECT 1 FROM public.quote_payment_terms WHERE quote_id = p_quote_id) THEN
    INSERT INTO public.receivables (
      project_id, client_id, quote_id, concept,
      installment_number, percentage, amount, status
    )
    SELECT
      v_project_id, v_quote.client_id, p_quote_id,
      concept, installment_number, COALESCE(percentage, 0), COALESCE(amount, 0), 'pending'
    FROM public.quote_payment_terms
    WHERE quote_id = p_quote_id
      AND COALESCE(amount, 0) > 0
    ORDER BY sort_order;
  ELSE
    IF COALESCE(v_quote.initial_payment_amount, 0) > 0 THEN
      INSERT INTO public.receivables (
        project_id, client_id, quote_id, concept,
        installment_number, percentage, amount, status
      ) VALUES (
        v_project_id, v_quote.client_id, p_quote_id, 'Abono inicial', 1,
        COALESCE(v_quote.initial_payment_percentage, 0),
        v_quote.initial_payment_amount, 'pending'
      );
    END IF;
    IF COALESCE(v_quote.final_payment_amount, 0) > 0 THEN
      INSERT INTO public.receivables (
        project_id, client_id, quote_id, concept,
        installment_number, percentage, amount, status
      ) VALUES (
        v_project_id, v_quote.client_id, p_quote_id, 'Saldo final', 2,
        COALESCE(v_quote.final_payment_percentage, 0),
        v_quote.final_payment_amount, 'pending'
      );
    END IF;
  END IF;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'approved',
    jsonb_build_object('project_id', v_project_id, 'project_number', v_project_number));

  RETURN jsonb_build_object(
    'project_id',      v_project_id,
    'project_number',  v_project_number,
    'contract_id',     v_contract_id,
    'contract_number', v_contract_number
  );
END; $$;

-- ================================================================
-- 5. duplicate_quote — copy commercial_total
-- ================================================================

CREATE OR REPLACE FUNCTION public.duplicate_quote(p_quote_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_old    public.quotes%ROWTYPE;
  v_new_id uuid;
BEGIN
  SELECT * INTO v_old FROM public.quotes WHERE id=p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;
  INSERT INTO public.quotes (
    client_id, title, status, issue_date,
    subtotal, discount, tax, total, commercial_total,
    initial_payment_percentage, initial_payment_amount,
    final_payment_percentage,   final_payment_amount,
    includes, excludes, terms, notes,
    project_type, responsible_architect_name, responsible_architect_id,
    created_by
  ) VALUES (
    v_old.client_id,
    COALESCE(v_old.title,'') || ' (copia)',
    'draft', CURRENT_DATE,
    v_old.subtotal,
    COALESCE(v_old.discount, 0),
    COALESCE(v_old.tax, 0),
    v_old.total,
    v_old.commercial_total,
    COALESCE(v_old.initial_payment_percentage, 0),
    COALESCE(v_old.initial_payment_amount, 0),
    COALESCE(v_old.final_payment_percentage, 0),
    COALESCE(v_old.final_payment_amount, 0),
    COALESCE(v_old.includes, ARRAY[]::text[]),
    COALESCE(v_old.excludes, ARRAY[]::text[]),
    COALESCE(v_old.terms,    ARRAY[]::text[]),
    v_old.notes,
    v_old.project_type,
    v_old.responsible_architect_name,
    v_old.responsible_architect_id,
    auth.uid()
  ) RETURNING id INTO v_new_id;
  INSERT INTO public.quote_items (
    quote_id, description, height, width, depth,
    measurement_notes, quantity, unit_price, line_total, sort_order
  )
  SELECT v_new_id, description, height, width, depth,
         measurement_notes, quantity, unit_price, line_total, sort_order
  FROM public.quote_items WHERE quote_id=p_quote_id;
  INSERT INTO public.quote_payment_terms (
    quote_id, installment_number, concept, percentage,
    amount, due_condition, sort_order
  )
  SELECT v_new_id, installment_number, concept, percentage,
         amount, due_condition, sort_order
  FROM public.quote_payment_terms WHERE quote_id=p_quote_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', v_new_id, 'duplicated',
    jsonb_build_object('original_id', p_quote_id));
  RETURN v_new_id;
END; $$;

-- ================================================================
-- Verification (read-only)
-- ================================================================
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'quotes'
  AND column_name = 'commercial_total';
-- Expected: 1 row, numeric, YES (nullable)

COMMIT;
