CREATE OR REPLACE FUNCTION public.create_project_from_quote(p_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_quote           public.quotes%ROWTYPE;
  v_project_id      uuid;
  v_project_number  bigint;
  v_contract_id     uuid;
  v_contract_number bigint;
BEGIN
  -- 1. Fetch and validate quote
  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;
  IF v_quote.status <> 'approved' THEN
    RAISE EXCEPTION 'Quote must be approved to create a project';
  END IF;

  -- 2. Check no duplicate project
  IF EXISTS (SELECT 1 FROM public.projects WHERE quote_id = p_quote_id) THEN
    RAISE EXCEPTION 'A project already exists for this quote';
  END IF;

  -- 3. Create project
  INSERT INTO public.projects (
    client_id, quote_id, name, total_amount, status, created_by
  ) VALUES (
    v_quote.client_id,
    p_quote_id,
    COALESCE(v_quote.title, 'Proyecto'),
    v_quote.total,
    'planning',
    auth.uid()
  )
  RETURNING id, project_number INTO v_project_id, v_project_number;

  -- 4. Create contract
  INSERT INTO public.contracts (
    project_id, client_id, quote_id, total_amount, terms, status, contract_date, created_by
  ) VALUES (
    v_project_id,
    v_quote.client_id,
    p_quote_id,
    v_quote.total,
    v_quote.terms,
    'draft',
    CURRENT_DATE,
    auth.uid()
  )
  RETURNING id, contract_number INTO v_contract_id, v_contract_number;

  -- 5. Create receivables (initial + final payment)
  INSERT INTO public.receivables (
    project_id, client_id, quote_id, concept, installment_number, percentage, amount, due_date, status
  ) VALUES
  (
    v_project_id, v_quote.client_id, p_quote_id,
    'Abono inicial', 1, v_quote.initial_payment_percentage, v_quote.initial_payment_amount,
    CURRENT_DATE, 'pending'
  ),
  (
    v_project_id, v_quote.client_id, p_quote_id,
    'Saldo final', 2, v_quote.final_payment_percentage, v_quote.final_payment_amount,
    NULL, 'pending'
  );

  -- 6. Log activity
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    auth.uid(), 'project', v_project_id, 'created',
    jsonb_build_object(
      'project_number', v_project_number,
      'quote_id', p_quote_id,
      'client_id', v_quote.client_id,
      'amount', v_quote.total
    )
  );

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    auth.uid(), 'contract', v_contract_id, 'created',
    jsonb_build_object('contract_number', v_contract_number, 'project_id', v_project_id)
  );

  RETURN jsonb_build_object(
    'project_id', v_project_id,
    'project_number', v_project_number,
    'contract_id', v_contract_id,
    'contract_number', v_contract_number
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_contract_status(
  p_contract_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('draft','pending_signature','signed','completed','cancelled') THEN
    RAISE EXCEPTION 'Invalid contract status: %', p_status;
  END IF;

  UPDATE public.contracts SET
    status    = p_status,
    signed_at = CASE WHEN p_status = 'signed' THEN now() ELSE signed_at END,
    updated_at = now()
  WHERE id = p_contract_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'contract', p_contract_id, p_status,
    jsonb_build_object('status', p_status));
END;
$$;

CREATE OR REPLACE FUNCTION public.update_project_status(
  p_project_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('planning','measurement','production','installation','completed','cancelled') THEN
    RAISE EXCEPTION 'Invalid project status: %', p_status;
  END IF;

  UPDATE public.projects SET
    status     = p_status,
    updated_at = now()
  WHERE id = p_project_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'project', p_project_id, 'status_changed',
    jsonb_build_object('new_status', p_status));
END;
$$;
