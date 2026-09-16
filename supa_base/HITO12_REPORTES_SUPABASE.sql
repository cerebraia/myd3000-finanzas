-- ================================================================
-- HITO12_REPORTES_SUPABASE.sql
-- MYD3000 ADMIN — Reportes Gerenciales + Flujo de Caja + Cierre Mensual
--
-- Ejecutar DESPUÉS de HITO11_AUTOMATION_SUPABASE.sql
-- Seguro: idempotente, sin DROP TABLE, sin TRUNCATE
-- ================================================================

-- ─── 1. Índices de performance para reportes ────────────────────

CREATE INDEX IF NOT EXISTS payments_received_payment_date_idx
  ON public.payments_received (payment_date);

CREATE INDEX IF NOT EXISTS payments_received_project_id_idx
  ON public.payments_received (project_id);

CREATE INDEX IF NOT EXISTS payments_received_voided_at_idx
  ON public.payments_received (voided_at);

CREATE INDEX IF NOT EXISTS payments_made_payment_date_idx
  ON public.payments_made (payment_date);

CREATE INDEX IF NOT EXISTS payments_made_payable_id_idx
  ON public.payments_made (payable_id);

CREATE INDEX IF NOT EXISTS payments_made_voided_at_idx
  ON public.payments_made (voided_at);

CREATE INDEX IF NOT EXISTS payables_due_date_status_idx
  ON public.payables (due_date, status);

CREATE INDEX IF NOT EXISTS receivables_due_date_status_idx
  ON public.receivables (due_date, status);

CREATE INDEX IF NOT EXISTS payables_managed_entity_status_idx
  ON public.payables (managed_entity_id, status);

-- ─── 2. get_financial_summary(start_date, end_date) ──────────────

CREATE OR REPLACE FUNCTION public.get_financial_summary(
  p_start date,
  p_end   date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz text;
BEGIN
  IF NOT public.is_admin_or_administration() THEN
    RAISE EXCEPTION 'Permiso insuficiente para ver reportes financieros';
  END IF;

  SELECT COALESCE(timezone, 'America/Caracas') INTO v_tz FROM public.company_settings LIMIT 1;
  IF v_tz IS NULL THEN v_tz := 'America/Caracas'; END IF;

  RETURN jsonb_build_object(
    -- Ingresos: solo payments_received no anulados, en el período
    'received', COALESCE((
      SELECT SUM(amount) FROM public.payments_received
      WHERE payment_date BETWEEN p_start AND p_end AND voided_at IS NULL
    ), 0),

    -- Egresos: solo payments_made no anulados, en el período
    'paid', COALESCE((
      SELECT SUM(amount) FROM public.payments_made pm
      WHERE pm.payment_date BETWEEN p_start AND p_end AND pm.voided_at IS NULL
    ), 0),

    -- Flujo neto del período
    'net', (
      COALESCE((SELECT SUM(amount) FROM public.payments_received WHERE payment_date BETWEEN p_start AND p_end AND voided_at IS NULL), 0)
      - COALESCE((SELECT SUM(pm.amount) FROM public.payments_made pm WHERE pm.payment_date BETWEEN p_start AND p_end AND pm.voided_at IS NULL), 0)
    ),

    -- Saldo total pendiente por cobrar (no depende del período)
    'receivable_balance', COALESCE((
      SELECT SUM(amount - paid_amount) FROM public.receivables WHERE status NOT IN ('paid','cancelled')
    ), 0),

    -- Saldo total pendiente por pagar
    'payable_balance', COALESCE((
      SELECT SUM(amount - paid_amount) FROM public.payables WHERE status NOT IN ('paid','cancelled')
    ), 0),

    -- Vencido por cobrar
    'receivable_overdue', COALESCE((
      SELECT SUM(amount - paid_amount) FROM public.receivables
      WHERE status NOT IN ('paid','cancelled')
        AND due_date < (now() AT TIME ZONE v_tz)::date
    ), 0),

    -- Vencido por pagar
    'payable_overdue', COALESCE((
      SELECT SUM(amount - paid_amount) FROM public.payables
      WHERE status NOT IN ('paid','cancelled')
        AND due_date < (now() AT TIME ZONE v_tz)::date
    ), 0),

    -- Comparación: mismo período mes anterior
    'received_prev_period', COALESCE((
      SELECT SUM(amount) FROM public.payments_received
      WHERE payment_date BETWEEN
        (p_start - (p_end - p_start + 1)) AND
        (p_start - 1)
        AND voided_at IS NULL
    ), 0),

    'paid_prev_period', COALESCE((
      SELECT SUM(pm.amount) FROM public.payments_made pm
      WHERE pm.payment_date BETWEEN
        (p_start - (p_end - p_start + 1)) AND
        (p_start - 1)
        AND pm.voided_at IS NULL
    ), 0),

    'period_start', p_start::text,
    'period_end',   p_end::text
  );
END;
$$;

-- ─── 3. get_cashflow_detail(start_date, end_date) ────────────────

CREATE OR REPLACE FUNCTION public.get_cashflow_detail(
  p_start date,
  p_end   date,
  p_managed_entity_id uuid DEFAULT NULL
)
RETURNS TABLE (
  movement_id   uuid,
  movement_type text,
  movement_date date,
  concept       text,
  entity_name   text,
  project_name  text,
  category_name text,
  amount_in     numeric,
  amount_out    numeric,
  payment_method text,
  reference     text,
  has_receipt   boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_or_administration() THEN
    RAISE EXCEPTION 'Permiso insuficiente para ver reportes financieros';
  END IF;

  RETURN QUERY

  -- Entradas (payments_received)
  SELECT
    pr.id,
    'income'::text,
    pr.payment_date,
    COALESCE(r.concept, 'Cobro'),
    COALESCE(c.full_name, '—'),
    COALESCE(p.name, '—'),
    NULL::text,
    pr.amount,
    0::numeric,
    pr.payment_method,
    pr.reference,
    false
  FROM public.payments_received pr
  LEFT JOIN public.receivables r  ON r.id = pr.receivable_id
  LEFT JOIN public.clients    c   ON c.id = pr.client_id
  LEFT JOIN public.projects   p   ON p.id = pr.project_id
  WHERE pr.payment_date BETWEEN p_start AND p_end
    AND pr.voided_at IS NULL

  UNION ALL

  -- Salidas (payments_made)
  SELECT
    pm.id,
    'expense'::text,
    pm.payment_date,
    COALESCE(pa.concept, 'Pago'),
    COALESCE(me.name, pa.beneficiary_name, '—'),
    COALESCE(proj.name, '—'),
    COALESCE(ec.name, '—'),
    0::numeric,
    pm.amount,
    pm.payment_method,
    pm.reference,
    pm.receipt_storage_path IS NOT NULL
  FROM public.payments_made pm
  LEFT JOIN public.payables          pa   ON pa.id = pm.payable_id
  LEFT JOIN public.managed_entities  me   ON me.id = pa.managed_entity_id
  LEFT JOIN public.projects          proj ON proj.id = pa.project_id
  LEFT JOIN public.expense_categories ec  ON ec.id = pa.category_id
  WHERE pm.payment_date BETWEEN p_start AND p_end
    AND pm.voided_at IS NULL
    AND (p_managed_entity_id IS NULL OR pa.managed_entity_id = p_managed_entity_id)

  ORDER BY movement_date, movement_type;
END;
$$;

-- ─── 4. get_receivables_aging(as_of_date) ────────────────────────

CREATE OR REPLACE FUNCTION public.get_receivables_aging(
  p_as_of date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz    text;
  v_today date;
BEGIN
  IF NOT public.is_admin_or_administration() THEN
    RAISE EXCEPTION 'Permiso insuficiente';
  END IF;

  SELECT COALESCE(timezone, 'America/Caracas') INTO v_tz FROM public.company_settings LIMIT 1;
  IF v_tz IS NULL THEN v_tz := 'America/Caracas'; END IF;

  v_today := COALESCE(p_as_of, (now() AT TIME ZONE v_tz)::date);

  RETURN jsonb_build_object(
    'total',       COALESCE((SELECT SUM(amount - paid_amount) FROM public.receivables WHERE status NOT IN ('paid','cancelled')), 0),
    'current',     COALESCE((SELECT SUM(amount - paid_amount) FROM public.receivables WHERE status NOT IN ('paid','cancelled') AND (due_date IS NULL OR due_date >= v_today)), 0),
    'days_1_7',    COALESCE((SELECT SUM(amount - paid_amount) FROM public.receivables WHERE status NOT IN ('paid','cancelled') AND due_date < v_today AND due_date >= v_today - 7), 0),
    'days_8_15',   COALESCE((SELECT SUM(amount - paid_amount) FROM public.receivables WHERE status NOT IN ('paid','cancelled') AND due_date < v_today - 7 AND due_date >= v_today - 15), 0),
    'days_16_30',  COALESCE((SELECT SUM(amount - paid_amount) FROM public.receivables WHERE status NOT IN ('paid','cancelled') AND due_date < v_today - 15 AND due_date >= v_today - 30), 0),
    'days_31_60',  COALESCE((SELECT SUM(amount - paid_amount) FROM public.receivables WHERE status NOT IN ('paid','cancelled') AND due_date < v_today - 30 AND due_date >= v_today - 60), 0),
    'days_60_plus',COALESCE((SELECT SUM(amount - paid_amount) FROM public.receivables WHERE status NOT IN ('paid','cancelled') AND due_date < v_today - 60), 0),
    -- Top clients by balance
    'top_clients', (
      SELECT jsonb_agg(row ORDER BY balance DESC) FROM (
        SELECT jsonb_build_object(
          'client_id', r.client_id,
          'client_name', c.full_name,
          'balance', SUM(r.amount - r.paid_amount)
        ) AS row,
        SUM(r.amount - r.paid_amount) AS balance
        FROM public.receivables r
        LEFT JOIN public.clients c ON c.id = r.client_id
        WHERE r.status NOT IN ('paid','cancelled')
        GROUP BY r.client_id, c.full_name
        ORDER BY balance DESC
        LIMIT 10
      ) sub
    ),
    'as_of', v_today::text
  );
END;
$$;

-- ─── 5. get_payables_aging(as_of_date) ───────────────────────────

CREATE OR REPLACE FUNCTION public.get_payables_aging(
  p_as_of date DEFAULT NULL,
  p_managed_entity_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz    text;
  v_today date;
BEGIN
  IF NOT public.is_admin_or_administration() THEN
    RAISE EXCEPTION 'Permiso insuficiente';
  END IF;

  SELECT COALESCE(timezone, 'America/Caracas') INTO v_tz FROM public.company_settings LIMIT 1;
  IF v_tz IS NULL THEN v_tz := 'America/Caracas'; END IF;

  v_today := COALESCE(p_as_of, (now() AT TIME ZONE v_tz)::date);

  RETURN jsonb_build_object(
    'total',       COALESCE((SELECT SUM(amount - paid_amount) FROM public.payables WHERE status NOT IN ('paid','cancelled') AND (p_managed_entity_id IS NULL OR managed_entity_id = p_managed_entity_id)), 0),
    'current',     COALESCE((SELECT SUM(amount - paid_amount) FROM public.payables WHERE status NOT IN ('paid','cancelled') AND (due_date IS NULL OR due_date >= v_today) AND (p_managed_entity_id IS NULL OR managed_entity_id = p_managed_entity_id)), 0),
    'days_1_7',    COALESCE((SELECT SUM(amount - paid_amount) FROM public.payables WHERE status NOT IN ('paid','cancelled') AND due_date < v_today AND due_date >= v_today - 7 AND (p_managed_entity_id IS NULL OR managed_entity_id = p_managed_entity_id)), 0),
    'days_8_15',   COALESCE((SELECT SUM(amount - paid_amount) FROM public.payables WHERE status NOT IN ('paid','cancelled') AND due_date < v_today - 7 AND due_date >= v_today - 15 AND (p_managed_entity_id IS NULL OR managed_entity_id = p_managed_entity_id)), 0),
    'days_16_30',  COALESCE((SELECT SUM(amount - paid_amount) FROM public.payables WHERE status NOT IN ('paid','cancelled') AND due_date < v_today - 15 AND due_date >= v_today - 30 AND (p_managed_entity_id IS NULL OR managed_entity_id = p_managed_entity_id)), 0),
    'days_31_60',  COALESCE((SELECT SUM(amount - paid_amount) FROM public.payables WHERE status NOT IN ('paid','cancelled') AND due_date < v_today - 30 AND due_date >= v_today - 60 AND (p_managed_entity_id IS NULL OR managed_entity_id = p_managed_entity_id)), 0),
    'days_60_plus',COALESCE((SELECT SUM(amount - paid_amount) FROM public.payables WHERE status NOT IN ('paid','cancelled') AND due_date < v_today - 60 AND (p_managed_entity_id IS NULL OR managed_entity_id = p_managed_entity_id)), 0),
    'as_of', v_today::text
  );
END;
$$;

-- ─── 6. get_projects_financial_report() ──────────────────────────

CREATE OR REPLACE FUNCTION public.get_projects_financial_report(
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  project_id       uuid,
  project_number   bigint,
  project_name     text,
  client_name      text,
  total_amount     numeric,
  amount_received  numeric,
  receivable_balance numeric,
  amount_paid_out  numeric,
  operational_flow numeric,
  project_status   text,
  start_date       date,
  estimated_delivery date,
  architect        text,
  has_pending_receivable boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_or_administration() THEN
    RAISE EXCEPTION 'Permiso insuficiente';
  END IF;

  RETURN QUERY
  SELECT
    pr.id,
    pr.project_number,
    pr.name,
    COALESCE(c.full_name, '—'),
    pr.total_amount,
    COALESCE(inc.received, 0::numeric),
    COALESCE(bal.balance, 0::numeric),
    COALESCE(out.paid, 0::numeric),
    COALESCE(inc.received, 0::numeric) - COALESCE(out.paid, 0::numeric),
    pr.status::text,
    pr.start_date,
    pr.estimated_delivery_date,
    pr.responsible_architect_name,
    (bal.balance > 0)
  FROM public.projects pr
  LEFT JOIN public.clients c ON c.id = pr.client_id
  LEFT JOIN LATERAL (
    SELECT SUM(p.amount) AS received
    FROM public.payments_received p
    WHERE p.project_id = pr.id AND p.voided_at IS NULL
  ) inc ON true
  LEFT JOIN LATERAL (
    SELECT SUM(r.amount - r.paid_amount) AS balance
    FROM public.receivables r
    WHERE r.project_id = pr.id AND r.status NOT IN ('paid','cancelled')
  ) bal ON true
  LEFT JOIN LATERAL (
    SELECT SUM(pm.amount) AS paid
    FROM public.payments_made pm
    JOIN public.payables pa ON pa.id = pm.payable_id
    WHERE pa.project_id = pr.id AND pm.voided_at IS NULL
  ) out ON true
  WHERE pr.archived_at IS NULL
    AND (p_status IS NULL OR pr.status = p_status)
  ORDER BY pr.project_number DESC;
END;
$$;

-- ─── 7. get_monthly_close(year, month) ───────────────────────────

CREATE OR REPLACE FUNCTION public.get_monthly_close(
  p_year  integer,
  p_month integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz    text;
  v_start date;
  v_end   date;
  v_today date;
BEGIN
  IF NOT public.is_admin_or_administration() THEN
    RAISE EXCEPTION 'Permiso insuficiente';
  END IF;

  SELECT COALESCE(timezone, 'America/Caracas') INTO v_tz FROM public.company_settings LIMIT 1;
  IF v_tz IS NULL THEN v_tz := 'America/Caracas'; END IF;

  v_today := (now() AT TIME ZONE v_tz)::date;
  v_start := make_date(p_year, p_month, 1);
  v_end   := (v_start + interval '1 month - 1 day')::date;

  RETURN jsonb_build_object(
    'period_start', v_start::text,
    'period_end',   v_end::text,
    'month_label',  to_char(v_start, 'TMMonth YYYY'),

    -- Ingresos del mes
    'received', COALESCE((
      SELECT SUM(amount) FROM public.payments_received
      WHERE payment_date BETWEEN v_start AND v_end AND voided_at IS NULL
    ), 0),

    -- Egresos del mes
    'paid', COALESCE((
      SELECT SUM(pm.amount) FROM public.payments_made pm
      WHERE pm.payment_date BETWEEN v_start AND v_end AND pm.voided_at IS NULL
    ), 0),

    -- Flujo neto
    'net', (
      COALESCE((SELECT SUM(amount) FROM public.payments_received WHERE payment_date BETWEEN v_start AND v_end AND voided_at IS NULL), 0)
      - COALESCE((SELECT SUM(pm.amount) FROM public.payments_made pm WHERE pm.payment_date BETWEEN v_start AND v_end AND pm.voided_at IS NULL), 0)
    ),

    -- Saldos pendientes (estado actual, no del mes)
    'receivable_pending', COALESCE((SELECT SUM(amount - paid_amount) FROM public.receivables WHERE status NOT IN ('paid','cancelled')), 0),
    'payable_pending',    COALESCE((SELECT SUM(amount - paid_amount) FROM public.payables WHERE status NOT IN ('paid','cancelled')), 0),
    'receivable_overdue', COALESCE((SELECT SUM(amount - paid_amount) FROM public.receivables WHERE status NOT IN ('paid','cancelled') AND due_date < v_today), 0),
    'payable_overdue',    COALESCE((SELECT SUM(amount - paid_amount) FROM public.payables WHERE status NOT IN ('paid','cancelled') AND due_date < v_today), 0),

    -- Egresos por categoría
    'by_category', (
      SELECT jsonb_agg(jsonb_build_object(
        'category', COALESCE(ec.name, 'Sin categoría'),
        'amount', SUM(pm.amount)
      ) ORDER BY SUM(pm.amount) DESC)
      FROM public.payments_made pm
      LEFT JOIN public.payables pa ON pa.id = pm.payable_id
      LEFT JOIN public.expense_categories ec ON ec.id = pa.category_id
      WHERE pm.payment_date BETWEEN v_start AND v_end AND pm.voided_at IS NULL
      GROUP BY ec.name
    ),

    -- Compromisos por entidad administrada
    'by_managed_entity', (
      SELECT jsonb_agg(jsonb_build_object(
        'entity_id', me.id,
        'entity_name', me.name,
        'paid_month', COALESCE(SUM(pm.amount) FILTER (WHERE pm.payment_date BETWEEN v_start AND v_end AND pm.voided_at IS NULL), 0),
        'pending', COALESCE(SUM(pa.amount - pa.paid_amount) FILTER (WHERE pa.status NOT IN ('paid','cancelled')), 0),
        'overdue', COALESCE(SUM(pa.amount - pa.paid_amount) FILTER (WHERE pa.status NOT IN ('paid','cancelled') AND pa.due_date < v_today), 0)
      ))
      FROM public.managed_entities me
      LEFT JOIN public.payables pa ON pa.managed_entity_id = me.id
      LEFT JOIN public.payments_made pm ON pm.payable_id = pa.id
      WHERE me.active = true
      GROUP BY me.id, me.name, me.sort_order
      ORDER BY me.sort_order
    ),

    -- Alertas de calidad de datos
    'data_quality', jsonb_build_object(
      'payments_no_receipt', (
        SELECT COUNT(*) FROM public.payments_made pm
        WHERE pm.payment_date BETWEEN v_start AND v_end
          AND pm.receipt_storage_path IS NULL
          AND pm.voided_at IS NULL
      ),
      'payables_no_category', (
        SELECT COUNT(*) FROM public.payables WHERE category_id IS NULL AND status NOT IN ('paid','cancelled')
      ),
      'projects_no_amount', (
        SELECT COUNT(*) FROM public.projects WHERE total_amount = 0 AND status NOT IN ('completed','cancelled') AND archived_at IS NULL
      ),
      'projects_no_architect', (
        SELECT COUNT(*) FROM public.projects WHERE responsible_architect_name IS NULL AND status NOT IN ('completed','cancelled') AND archived_at IS NULL
      ),
      'completed_with_balance', (
        SELECT COUNT(DISTINCT r.project_id) FROM public.receivables r
        JOIN public.projects p ON p.id = r.project_id
        WHERE p.status = 'completed' AND r.status NOT IN ('paid','cancelled') AND r.amount - r.paid_amount > 0
      )
    )
  );
END;
$$;

-- ─── 8. get_quotes_report(start_date, end_date) ──────────────────

CREATE OR REPLACE FUNCTION public.get_quotes_report(
  p_start date,
  p_end   date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_or_administration() THEN
    RAISE EXCEPTION 'Permiso insuficiente';
  END IF;

  RETURN jsonb_build_object(
    'total_issued',    (SELECT COUNT(*) FROM public.quotes WHERE issue_date BETWEEN p_start AND p_end AND archived_at IS NULL),
    'total_amount',    COALESCE((SELECT SUM(total) FROM public.quotes WHERE issue_date BETWEEN p_start AND p_end AND archived_at IS NULL), 0),
    'approved',        (SELECT COUNT(*) FROM public.quotes WHERE issue_date BETWEEN p_start AND p_end AND status = 'approved' AND archived_at IS NULL),
    'approved_amount', COALESCE((SELECT SUM(total) FROM public.quotes WHERE issue_date BETWEEN p_start AND p_end AND status = 'approved' AND archived_at IS NULL), 0),
    'rejected',        (SELECT COUNT(*) FROM public.quotes WHERE issue_date BETWEEN p_start AND p_end AND status = 'rejected' AND archived_at IS NULL),
    'in_review',       (SELECT COUNT(*) FROM public.quotes WHERE status = 'review' AND archived_at IS NULL),
    'draft',           (SELECT COUNT(*) FROM public.quotes WHERE status = 'draft' AND archived_at IS NULL)
  );
END;
$$;

-- ─── 9. Verificación ─────────────────────────────────────────────
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_financial_summary', 'get_cashflow_detail',
    'get_receivables_aging', 'get_payables_aging',
    'get_projects_financial_report', 'get_monthly_close',
    'get_quotes_report'
  )
ORDER BY routine_name;
