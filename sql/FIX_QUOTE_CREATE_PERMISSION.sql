-- ================================================================
-- MYD3000 — FIX: quote creation and update permissions
-- ================================================================
-- Root cause: create_quote_with_items / update_quote_with_items
--   are SECURITY INVOKER. MYD3000_CRUD_CREATE_FIX.sql correctly
--   revoked INSERT/UPDATE/DELETE on activity_log from authenticated
--   (immutability enforcement). But SECURITY INVOKER functions run
--   as the caller (authenticated), so the final INSERT INTO
--   activity_log inside both RPCs now fails with PG error 42501.
--
-- Fix: convert both functions to SECURITY DEFINER, consistent with
--   create_project_manual, create_contract_manual, and all other
--   multi-table write RPCs in MYD3000_CORE_FUNCTIONAL_FINAL.sql.
--   SECURITY DEFINER runs as the function owner (postgres superuser),
--   which can INSERT into activity_log.
--
-- Security properties maintained:
--   • auth.uid() IS NOT NULL guard — function cannot be called
--     without a valid JWT (PostgREST also enforces this).
--   • created_by = auth.uid() inside the INSERT on quotes ensures
--     rows are owned by the real caller even without RLS enforcement.
--   • REVOKE EXECUTE FROM PUBLIC + GRANT TO authenticated: anon
--     cannot call these functions.
--   • SET search_path = public: prevents search_path injection.
--
-- Incremental, idempotent (CREATE OR REPLACE).
-- ================================================================

BEGIN;

-- ================================================================
-- 1. create_quote_with_items
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
    subtotal, discount, tax, total,
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
-- 2. update_quote_with_items
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
-- Verification
-- ================================================================
SELECT proname, prosecdef
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN ('create_quote_with_items', 'update_quote_with_items');
-- Expected: prosecdef = true for both rows

COMMIT;
