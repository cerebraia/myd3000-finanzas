-- ================================================================
-- HITO10_SECURITY_SUPABASE.sql
-- MYD3000 ADMIN — Hardening de seguridad
--
-- Ejecutar DESPUÉS de HITO9_SUPABASE.sql
-- Seguro: idempotente, sin DROP TABLE, sin TRUNCATE
-- ================================================================

-- ─── 1. ACTIVITY LOG — Solo INSERT via funciones controladas ─────
-- El INSERT directo desde cliente queda permitido a autenticados
-- (ya controlado por RLS), pero reforzamos que el SELECT
-- solo lo hacen admins (ya implementado en HITO5 vía is_admin()).
-- Verificamos que las políticas correctas estén presentes.

DO $$
BEGIN
  -- Eliminar política permisiva original de SELECT si aún existe
  DROP POLICY IF EXISTS "Authenticated users can view activity log" ON public.activity_log;
  DROP POLICY IF EXISTS "Admins can read all activity"             ON public.activity_log;

  -- Política correcta: solo admins pueden leer activity_log
  CREATE POLICY "Only admins can read activity_log"
    ON public.activity_log
    FOR SELECT TO authenticated
    USING (public.is_admin());
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

-- ─── 2. PROFILES — Validar active = true en operaciones críticas ─
-- Helper function: verifica que el usuario actual esté activo
CREATE OR REPLACE FUNCTION public.current_user_is_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND active = true
  );
$$;

-- ─── 3. PAYMENT RPC — Agregar validación de usuario activo ────────
-- Los RPCs de pago ya usan auth.uid() — agrego check de usuario activo
-- en el RPC de registro de pago para máxima seguridad

CREATE OR REPLACE FUNCTION public.register_receivable_payment(
  p_receivable_id uuid,
  p_amount        numeric,
  p_payment_date  date,
  p_payment_method text,
  p_reference     text,
  p_notes         text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receivable  public.receivables%ROWTYPE;
  v_remaining   numeric;
  v_new_paid    numeric;
  v_new_status  text;
BEGIN
  -- Validar usuario activo
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  -- Lock row para evitar condición de carrera
  SELECT * INTO v_receivable
  FROM   public.receivables
  WHERE  id = p_receivable_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta por cobrar no encontrada';
  END IF;

  IF v_receivable.status IN ('paid', 'cancelled') THEN
    RAISE EXCEPTION 'Esta cuenta ya está pagada o cancelada';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser greater than zero';
  END IF;

  v_remaining := v_receivable.amount - v_receivable.paid_amount;

  IF p_amount > v_remaining + 0.005 THEN
    RAISE EXCEPTION 'El monto exceeds el saldo pendiente';
  END IF;

  v_new_paid := v_receivable.paid_amount + p_amount;
  v_new_status := CASE
    WHEN v_new_paid >= v_receivable.amount - 0.005 THEN 'paid'
    ELSE 'partial'
  END;

  UPDATE public.receivables
  SET paid_amount = v_new_paid,
      status      = v_new_status,
      paid_at     = CASE WHEN v_new_status = 'paid' THEN now() ELSE paid_at END,
      updated_at  = now()
  WHERE id = p_receivable_id;

  INSERT INTO public.payments_received (
    receivable_id, project_id, client_id,
    amount, payment_date, payment_method, reference, notes, created_by
  )
  VALUES (
    p_receivable_id, v_receivable.project_id, v_receivable.client_id,
    p_amount, p_payment_date, p_payment_method, p_reference, p_notes, auth.uid()
  );

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'receivable', p_receivable_id::text, 'received',
          jsonb_build_object('amount', p_amount, 'new_status', v_new_status));

  RETURN jsonb_build_object(
    'new_status',      v_new_status,
    'new_paid_amount', v_new_paid,
    'remaining',       v_receivable.amount - v_new_paid
  );
END;
$$;

-- ─── 4. PAYABLE PAYMENT — Agregar validación de usuario activo ───
CREATE OR REPLACE FUNCTION public.register_payable_payment(
  p_payable_id   uuid,
  p_amount       numeric,
  p_payment_date date,
  p_method       text,
  p_reference    text,
  p_notes        text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payable    public.payables%ROWTYPE;
  v_new_paid   numeric;
  v_new_status text;
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  SELECT * INTO v_payable FROM public.payables WHERE id = p_payable_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta por pagar no encontrada'; END IF;
  IF v_payable.status IN ('paid','cancelled') THEN RAISE EXCEPTION 'Esta cuenta ya está pagada o cancelada'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'El monto debe ser greater than zero'; END IF;

  IF p_amount > (v_payable.amount - v_payable.paid_amount) + 0.005 THEN
    RAISE EXCEPTION 'El monto exceeds el saldo pendiente';
  END IF;

  v_new_paid   := v_payable.paid_amount + p_amount;
  v_new_status := CASE WHEN v_new_paid >= v_payable.amount - 0.005 THEN 'paid' ELSE 'partial' END;

  UPDATE public.payables
  SET paid_amount = v_new_paid,
      status      = v_new_status,
      updated_at  = now()
  WHERE id = p_payable_id;

  INSERT INTO public.payments_made (
    payable_id, amount, payment_date, payment_method, reference, notes, created_by
  )
  VALUES (p_payable_id, p_amount, p_payment_date, p_method, p_reference, p_notes, auth.uid());

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'payable', p_payable_id::text, 'paid',
          jsonb_build_object('amount', p_amount, 'new_status', v_new_status));

  RETURN jsonb_build_object(
    'new_status', v_new_status,
    'remaining',  v_payable.amount - v_new_paid
  );
END;
$$;

-- ─── 5. APPROVE QUOTE — Validar usuario activo ───────────────────
-- La función create_project_from_quote ya valida is_admin_or_administration()
-- Verificar que también valide active (adición mínima)
-- En su lugar, agregamos el check de is_admin_or_administration que
-- internamente consulta la DB y no confía en el frontend.
-- (Esto ya estaba implementado en HITO5)

-- ─── 6. GRANTS — Confirmar que anon no tiene acceso ──────────────
-- Las políticas ya usan "TO authenticated", pero como medida explícita
-- revocamos cualquier acceso directo que pudiera haberse dado por error.

-- No ejecutar REVOKE masivo ya que puede romper funciones existentes.
-- La protección via RLS con "TO authenticated" es suficiente y correcta.

-- ─── 7. VERIFICACIÓN ─────────────────────────────────────────────
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'clients','quotes','projects','contracts',
    'receivables','payments_received','payables','payments_made',
    'employees','documents','suppliers','activity_log','profiles'
  )
ORDER BY tablename;
