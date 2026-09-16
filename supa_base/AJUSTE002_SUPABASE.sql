-- ================================================================
-- AJUSTE002_SUPABASE.sql
-- MYD3000 ADMIN — Anulación de pagos individuales
--
-- Prerequisito: HITO7 (voided_at/voided_by/void_reason ya existen)
-- Seguro: incremental, sin DROP, sin TRUNCATE
-- ================================================================


-- ================================================================
-- 1. void_received_payment — anular un pago recibido
-- ================================================================

CREATE OR REPLACE FUNCTION public.void_received_payment(
  p_payment_id uuid,
  p_reason     text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_payment  public.payments_received%ROWTYPE;
  v_total    numeric;
  v_new_paid numeric;
  v_new_status text;
BEGIN
  -- Solo usuarios activos con rol administrator o manager
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND active = true
      AND role IN ('administrator', 'manager')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para anular pagos';
  END IF;

  -- Obtener pago con lock
  SELECT * INTO v_payment
  FROM public.payments_received
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pago no encontrado';
  END IF;

  IF v_payment.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Este pago ya fue anulado';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'El motivo de anulación es obligatorio';
  END IF;

  -- Marcar como anulado
  UPDATE public.payments_received SET
    voided_at   = now(),
    voided_by   = auth.uid(),
    void_reason = p_reason
  WHERE id = p_payment_id;

  -- Recalcular monto pagado (excluir pagos anulados)
  SELECT amount INTO v_total
  FROM public.receivables
  WHERE id = v_payment.receivable_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_new_paid
  FROM public.payments_received
  WHERE receivable_id = v_payment.receivable_id
    AND voided_at IS NULL;

  -- Determinar nuevo estado
  v_new_status := CASE
    WHEN v_new_paid >= v_total THEN 'paid'
    WHEN v_new_paid > 0        THEN 'partial'
    ELSE                            'pending'
  END;

  UPDATE public.receivables SET
    paid_amount = v_new_paid,
    status      = v_new_status,
    updated_at  = now()
  WHERE id = v_payment.receivable_id;

  -- Auditoría
  INSERT INTO public.activity_log
    (user_id, entity_type, entity_id, action, old_data, new_data, metadata)
  VALUES (
    auth.uid(),
    'payment',
    p_payment_id,
    'voided',
    jsonb_build_object(
      'amount',        v_payment.amount,
      'payment_date',  v_payment.payment_date::text,
      'receivable_id', v_payment.receivable_id
    ),
    jsonb_build_object(
      'voided_at', now()::text,
      'voided_by', auth.uid()::text
    ),
    jsonb_build_object('reason', p_reason)
  );
END;
$$;


-- ================================================================
-- 2. void_made_payment — anular un pago realizado
-- ================================================================

CREATE OR REPLACE FUNCTION public.void_made_payment(
  p_payment_id uuid,
  p_reason     text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_payment    public.payments_made%ROWTYPE;
  v_total      numeric;
  v_new_paid   numeric;
  v_new_status text;
BEGIN
  -- Solo administrator o manager
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND active = true
      AND role IN ('administrator', 'manager')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para anular pagos';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments_made
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pago no encontrado';
  END IF;

  IF v_payment.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Este pago ya fue anulado';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'El motivo de anulación es obligatorio';
  END IF;

  UPDATE public.payments_made SET
    voided_at   = now(),
    voided_by   = auth.uid(),
    void_reason = p_reason
  WHERE id = p_payment_id;

  SELECT amount INTO v_total
  FROM public.payables
  WHERE id = v_payment.payable_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_new_paid
  FROM public.payments_made
  WHERE payable_id = v_payment.payable_id
    AND voided_at IS NULL;

  v_new_status := CASE
    WHEN v_new_paid >= v_total THEN 'paid'
    WHEN v_new_paid > 0        THEN 'partial'
    ELSE                            'pending'
  END;

  UPDATE public.payables SET
    paid_amount = v_new_paid,
    status      = v_new_status,
    updated_at  = now()
  WHERE id = v_payment.payable_id;

  INSERT INTO public.activity_log
    (user_id, entity_type, entity_id, action, old_data, new_data, metadata)
  VALUES (
    auth.uid(),
    'payment',
    p_payment_id,
    'voided',
    jsonb_build_object(
      'amount',      v_payment.amount,
      'payment_date', v_payment.payment_date::text,
      'payable_id',  v_payment.payable_id
    ),
    jsonb_build_object(
      'voided_at', now()::text,
      'voided_by', auth.uid()::text
    ),
    jsonb_build_object('reason', p_reason)
  );
END;
$$;


-- ================================================================
-- Verificación
-- ================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_name = 'void_received_payment' AND routine_schema = 'public'
  ) THEN
    RAISE WARNING 'void_received_payment no fue creada';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_name = 'void_made_payment' AND routine_schema = 'public'
  ) THEN
    RAISE WARNING 'void_made_payment no fue creada';
  END IF;
  RAISE NOTICE 'AJUSTE002_SUPABASE verificación completada.';
END;
$$;
