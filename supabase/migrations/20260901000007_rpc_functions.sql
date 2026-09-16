-- RPC: Create quote with items atomically
CREATE OR REPLACE FUNCTION public.create_quote_with_items(
  quote_data jsonb,
  items_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_quote_id uuid;
  v_item jsonb;
  v_sort_order integer := 0;
BEGIN
  -- Insert the quote
  INSERT INTO public.quotes (
    client_id,
    title,
    status,
    issue_date,
    valid_until,
    subtotal,
    discount,
    tax,
    total,
    initial_payment_percentage,
    initial_payment_amount,
    final_payment_percentage,
    final_payment_amount,
    includes,
    excludes,
    terms,
    notes,
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
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(quote_data->'includes')),
      ARRAY[]::text[]
    ),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(quote_data->'excludes')),
      ARRAY[]::text[]
    ),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(quote_data->'terms')),
      ARRAY[]::text[]
    ),
    quote_data->>'notes',
    auth.uid()
  )
  RETURNING id INTO v_quote_id;

  -- Insert items
  FOR v_item IN SELECT * FROM jsonb_array_elements(items_data)
  LOOP
    INSERT INTO public.quote_items (
      quote_id,
      description,
      height,
      width,
      depth,
      measurement_notes,
      quantity,
      unit_price,
      line_total,
      sort_order
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
      v_sort_order
    );
    v_sort_order := v_sort_order + 1;
  END LOOP;

  -- Log activity
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', v_quote_id, 'created', quote_data);

  RETURN v_quote_id;
END;
$$;

-- RPC: Update quote with items atomically
CREATE OR REPLACE FUNCTION public.update_quote_with_items(
  p_quote_id uuid,
  quote_data jsonb,
  items_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_sort_order integer := 0;
BEGIN
  -- Update the quote
  UPDATE public.quotes SET
    client_id                  = COALESCE((quote_data->>'client_id')::uuid, client_id),
    title                      = quote_data->>'title',
    status                     = COALESCE(quote_data->>'status', status),
    issue_date                 = COALESCE((quote_data->>'issue_date')::date, issue_date),
    valid_until                = (quote_data->>'valid_until')::date,
    subtotal                   = COALESCE((quote_data->>'subtotal')::numeric, subtotal),
    discount                   = COALESCE((quote_data->>'discount')::numeric, discount),
    tax                        = COALESCE((quote_data->>'tax')::numeric, tax),
    total                      = COALESCE((quote_data->>'total')::numeric, total),
    initial_payment_percentage = COALESCE((quote_data->>'initial_payment_percentage')::numeric, initial_payment_percentage),
    initial_payment_amount     = COALESCE((quote_data->>'initial_payment_amount')::numeric, initial_payment_amount),
    final_payment_percentage   = COALESCE((quote_data->>'final_payment_percentage')::numeric, final_payment_percentage),
    final_payment_amount       = COALESCE((quote_data->>'final_payment_amount')::numeric, final_payment_amount),
    includes = COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(quote_data->'includes')),
      includes
    ),
    excludes = COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(quote_data->'excludes')),
      excludes
    ),
    terms = COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(quote_data->'terms')),
      terms
    ),
    notes    = quote_data->>'notes',
    updated_at = now()
  WHERE id = p_quote_id;

  -- Delete old items and re-insert
  DELETE FROM public.quote_items WHERE quote_id = p_quote_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(items_data)
  LOOP
    INSERT INTO public.quote_items (
      quote_id,
      description,
      height,
      width,
      depth,
      measurement_notes,
      quantity,
      unit_price,
      line_total,
      sort_order
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
      v_sort_order
    );
    v_sort_order := v_sort_order + 1;
  END LOOP;

  -- Log activity
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'updated', quote_data);

  RETURN p_quote_id;
END;
$$;

-- RPC: Update quote status
CREATE OR REPLACE FUNCTION public.update_quote_status(
  p_quote_id         uuid,
  p_status           text,
  p_rejection_reason text DEFAULT NULL,
  p_rejection_notes  text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Validate status
  IF p_status NOT IN ('draft', 'sent', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  UPDATE public.quotes SET
    status           = p_status,
    approved_at      = CASE WHEN p_status = 'approved' THEN now() ELSE approved_at END,
    rejected_at      = CASE WHEN p_status = 'rejected' THEN now() ELSE rejected_at END,
    rejection_reason = CASE WHEN p_status = 'rejected' THEN p_rejection_reason ELSE rejection_reason END,
    rejection_notes  = CASE WHEN p_status = 'rejected' THEN p_rejection_notes ELSE rejection_notes END,
    updated_at       = now()
  WHERE id = p_quote_id;

  -- Log activity
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    auth.uid(),
    'quote',
    p_quote_id,
    p_status,
    jsonb_build_object(
      'reason', p_rejection_reason,
      'notes', p_rejection_notes
    )
  );
END;
$$;
