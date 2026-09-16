CREATE OR REPLACE FUNCTION public.register_receivable_payment(
  p_receivable_id   uuid,
  p_amount          numeric,
  p_payment_date    date,
  p_payment_method  text DEFAULT NULL,
  p_reference       text DEFAULT NULL,
  p_notes           text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_receivable    public.receivables%ROWTYPE;
  v_new_paid      numeric;
  v_new_status    text;
  v_payment_id    uuid;
  v_balance       numeric;
BEGIN
  -- 1. Fetch receivable
  SELECT * INTO v_receivable FROM public.receivables WHERE id = p_receivable_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receivable not found';
  END IF;
  IF v_receivable.status IN ('paid', 'cancelled') THEN
    RAISE EXCEPTION 'This receivable is already %', v_receivable.status;
  END IF;

  -- 2. Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  v_balance := v_receivable.amount - v_receivable.paid_amount;
  IF p_amount > v_balance THEN
    RAISE EXCEPTION 'Payment amount (%) exceeds pending balance (%)', p_amount, v_balance;
  END IF;

  -- 3. Insert payment
  INSERT INTO public.payments_received (
    receivable_id, project_id, client_id, amount, payment_date, payment_method, reference, notes, created_by
  ) VALUES (
    p_receivable_id, v_receivable.project_id, v_receivable.client_id,
    p_amount, p_payment_date, p_payment_method, p_reference, p_notes, auth.uid()
  )
  RETURNING id INTO v_payment_id;

  -- 4. Calculate new totals
  v_new_paid := v_receivable.paid_amount + p_amount;
  IF v_new_paid >= v_receivable.amount THEN
    v_new_status := 'paid';
  ELSIF v_new_paid > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'pending';
  END IF;

  -- 5. Update receivable
  UPDATE public.receivables SET
    paid_amount = v_new_paid,
    status      = v_new_status,
    paid_at     = CASE WHEN v_new_status = 'paid' THEN now() ELSE paid_at END,
    updated_at  = now()
  WHERE id = p_receivable_id;

  -- 6. Log
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    auth.uid(), 'payment', v_payment_id, 'received',
    jsonb_build_object(
      'receivable_id', p_receivable_id,
      'project_id', v_receivable.project_id,
      'amount', p_amount,
      'payment_method', p_payment_method,
      'new_status', v_new_status
    )
  );

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'new_paid_amount', v_new_paid,
    'new_status', v_new_status,
    'remaining', v_receivable.amount - v_new_paid
  );
END;
$$;
