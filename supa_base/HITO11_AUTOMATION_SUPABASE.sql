-- ================================================================
-- HITO11_AUTOMATION_SUPABASE.sql
-- MYD3000 ADMIN — Automatización Operativa + Alertas + Control Diario
--
-- Ejecutar DESPUÉS de HITO10_PROYECTOS_PAGOS_SUPABASE.sql
-- Seguro: idempotente, sin DROP TABLE, sin TRUNCATE
-- ================================================================

-- ─── 1. TASKS (tareas administrativas manuales) ──────────────────

CREATE TABLE IF NOT EXISTS public.tasks (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title                text        NOT NULL,
  description          text,
  due_date             date,
  priority             text        NOT NULL DEFAULT 'normal'
                                   CHECK (priority IN ('low','normal','high','urgent')),
  status               text        NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending','completed','cancelled')),
  assigned_to          uuid        REFERENCES auth.users(id),
  related_entity_type  text,
  related_entity_id    uuid,
  created_by           uuid        REFERENCES auth.users(id),
  completed_at         timestamptz,
  completed_by         uuid        REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_status_idx    ON public.tasks (status);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx  ON public.tasks (due_date);
CREATE INDEX IF NOT EXISTS tasks_assigned_idx  ON public.tasks (assigned_to);
CREATE INDEX IF NOT EXISTS tasks_created_at_idx ON public.tasks (created_at DESC);

DROP TRIGGER IF EXISTS tasks_updated_at ON public.tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read tasks"   ON public.tasks;
CREATE POLICY "Authenticated can read tasks"
  ON public.tasks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can create tasks" ON public.tasks;
CREATE POLICY "Authenticated can create tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated can update tasks" ON public.tasks;
CREATE POLICY "Authenticated can update tasks"
  ON public.tasks FOR UPDATE TO authenticated USING (true);

-- ─── 2. NOTIFICATIONS — Agregar dedupe_key ───────────────────────

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_key_idx
  ON public.notifications (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- ─── 3. COMPANY SETTINGS — Agregar timezone + alert config ───────

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS timezone               text    DEFAULT 'America/Caracas',
  ADD COLUMN IF NOT EXISTS alert_days_documents   integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS alert_days_quotes      integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS alert_days_receivables integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS alert_days_payables    integer DEFAULT 3;

-- ─── 4. generate_due_recurring_obligations() — RPC idempotente ───
-- Genera cuentas por pagar para todas las obligaciones activas
-- que aún no tienen cuenta para el período corriente.
-- Es segura de ejecutar múltiples veces (idempotente via period_key).

CREATE OR REPLACE FUNCTION public.generate_due_recurring_obligations(
  p_lookahead_days integer DEFAULT 7
)
RETURNS TABLE (
  obligation_id uuid,
  obligation_name text,
  payable_id uuid,
  period_key text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz       text := 'America/Caracas';
  v_today    date := (now() AT TIME ZONE v_tz)::date;
  v_cutoff   date := v_today + p_lookahead_days;
  v_ob       public.recurring_obligations%ROWTYPE;
  v_period   text;
  v_due      date;
  v_new_id   uuid;
  v_dow      integer;
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  -- Fetch timezone from company settings if available
  SELECT COALESCE(timezone, 'America/Caracas') INTO v_tz
  FROM public.company_settings LIMIT 1;

  v_today  := (now() AT TIME ZONE v_tz)::date;
  v_cutoff := v_today + p_lookahead_days;

  FOR v_ob IN
    SELECT * FROM public.recurring_obligations
    WHERE active = true AND archived_at IS NULL
  LOOP
    -- Calculate due date and period_key for current cycle
    CASE v_ob.frequency
      WHEN 'monthly' THEN
        v_due := make_date(
          EXTRACT(YEAR FROM v_today)::int,
          EXTRACT(MONTH FROM v_today)::int,
          LEAST(COALESCE(v_ob.day_of_month, 5), 28)
        );
        -- If this month's date already passed, use next month
        IF v_due < v_today THEN
          v_due := v_due + interval '1 month';
        END IF;
        v_period := to_char(v_due, 'YYYY-MM');

      WHEN 'weekly' THEN
        -- Find next occurrence of day_of_week (0=Sun..6=Sat)
        v_dow := COALESCE(v_ob.day_of_week, 5); -- default Friday
        v_due := v_today + ((v_dow - EXTRACT(DOW FROM v_today)::int + 7) % 7);
        IF v_due = v_today THEN v_due := v_due + 7; END IF;
        v_period := to_char(v_due, 'IYYY"-W"IW');

      WHEN 'biweekly' THEN
        -- First or second half of month
        IF EXTRACT(DAY FROM v_today) <= 15 THEN
          v_due := make_date(
            EXTRACT(YEAR FROM v_today)::int,
            EXTRACT(MONTH FROM v_today)::int,
            LEAST(COALESCE(v_ob.day_of_month, 15), 15)
          );
          v_period := to_char(v_today, 'YYYY-MM') || '-Q1';
        ELSE
          v_due := make_date(
            EXTRACT(YEAR FROM v_today)::int,
            EXTRACT(MONTH FROM v_today)::int,
            LEAST(COALESCE(v_ob.day_of_month, 28), 28)
          );
          v_period := to_char(v_today, 'YYYY-MM') || '-Q2';
        END IF;
        IF v_due < v_today THEN
          v_due := v_due + interval '1 month';
          v_period := to_char(v_due, 'YYYY-MM') ||
            CASE WHEN EXTRACT(DAY FROM v_today) <= 15 THEN '-Q1' ELSE '-Q2' END;
        END IF;

      WHEN 'quarterly' THEN
        v_due := make_date(
          EXTRACT(YEAR FROM v_today)::int,
          ((EXTRACT(QUARTER FROM v_today)::int - 1) * 3 + 1),
          LEAST(COALESCE(v_ob.day_of_month, 5), 28)
        );
        IF v_due < v_today THEN
          v_due := v_due + interval '3 months';
        END IF;
        v_period := to_char(v_due, 'YYYY') || '-Q' || EXTRACT(QUARTER FROM v_due)::text;

      WHEN 'annual' THEN
        v_due := make_date(
          EXTRACT(YEAR FROM v_today)::int,
          1,
          LEAST(COALESCE(v_ob.day_of_month, 5), 28)
        );
        IF v_due < v_today THEN
          v_due := v_due + interval '1 year';
        END IF;
        v_period := to_char(v_due, 'YYYY');

      ELSE
        CONTINUE;
    END CASE;

    -- Skip if due date is beyond lookahead window
    IF v_due > v_cutoff THEN
      CONTINUE;
    END IF;

    -- Skip if obligation hasn't started yet
    IF v_ob.start_date > v_due THEN
      CONTINUE;
    END IF;

    -- Skip if obligation has ended
    IF v_ob.end_date IS NOT NULL AND v_ob.end_date < v_due THEN
      CONTINUE;
    END IF;

    -- Skip if payable already exists for this period (idempotency)
    IF EXISTS (
      SELECT 1 FROM public.payables
      WHERE recurring_obligation_id = v_ob.id
        AND period_key = v_period
        AND status != 'cancelled'
    ) THEN
      -- Return info but skip
      obligation_id   := v_ob.id;
      obligation_name := v_ob.name;
      payable_id      := (SELECT id FROM public.payables
                          WHERE recurring_obligation_id = v_ob.id
                            AND period_key = v_period
                            AND status != 'cancelled'
                          LIMIT 1);
      period_key      := v_period;
      status          := 'already_exists';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Skip if amount is null/0
    IF v_ob.amount IS NULL OR v_ob.amount <= 0 THEN
      obligation_id   := v_ob.id;
      obligation_name := v_ob.name;
      payable_id      := NULL;
      period_key      := v_period;
      status          := 'skipped_no_amount';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Generate the payable
    INSERT INTO public.payables (
      concept, description, category_id,
      beneficiary_type, beneficiary_name,
      managed_entity_id,
      amount, due_date,
      recurring_obligation_id, period_key,
      created_by
    )
    VALUES (
      v_ob.name, v_ob.description, v_ob.category_id,
      v_ob.beneficiary_type, v_ob.beneficiary_name,
      v_ob.managed_entity_id,
      v_ob.amount, v_due,
      v_ob.id, v_period,
      auth.uid()
    )
    RETURNING id INTO v_new_id;

    INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
    VALUES (
      auth.uid(), 'payable', v_new_id::text, 'obligation.generated',
      jsonb_build_object('obligation_id', v_ob.id, 'period', v_period, 'due_date', v_due)
    );

    obligation_id   := v_ob.id;
    obligation_name := v_ob.name;
    payable_id      := v_new_id;
    period_key      := v_period;
    status          := 'created';
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ─── 5. create_notification_safe() — Inserta si no existe dedupe ─

CREATE OR REPLACE FUNCTION public.create_notification_safe(
  p_type        text,
  p_title       text,
  p_message     text         DEFAULT NULL,
  p_entity_type text         DEFAULT NULL,
  p_entity_id   text         DEFAULT NULL,
  p_priority    text         DEFAULT 'normal',
  p_dedupe_key  text         DEFAULT NULL,
  p_role_target text         DEFAULT NULL,
  p_user_id     uuid         DEFAULT NULL,
  p_expires_at  timestamptz  DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_dedupe_key IS NOT NULL THEN
    SELECT id INTO v_id FROM public.notifications WHERE dedupe_key = p_dedupe_key;
    IF FOUND THEN RETURN v_id; END IF;
  END IF;

  INSERT INTO public.notifications (
    user_id, role_target, type, title, message,
    entity_type, entity_id, priority, dedupe_key, expires_at
  )
  VALUES (
    p_user_id, p_role_target, p_type, p_title, p_message,
    p_entity_type, p_entity_id::uuid, p_priority, p_dedupe_key, p_expires_at
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ─── 6. get_dashboard_summary() — RPC unificado ──────────────────

CREATE OR REPLACE FUNCTION public.get_dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz      text;
  v_today   date;
  v_week    date;
  v_month_s date;
  v_month_e date;
  v_soon7   date;
  v_soon30  date;
  v_result  jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  SELECT COALESCE(timezone, 'America/Caracas') INTO v_tz
  FROM public.company_settings LIMIT 1;
  IF v_tz IS NULL THEN v_tz := 'America/Caracas'; END IF;

  v_today   := (now() AT TIME ZONE v_tz)::date;
  v_week    := v_today + 7;
  v_soon7   := v_today + 7;
  v_soon30  := v_today + 30;
  v_month_s := date_trunc('month', v_today::timestamptz)::date;
  v_month_e := (date_trunc('month', v_today::timestamptz) + interval '1 month - 1 day')::date;

  -- Receivables summary
  v_result := v_result || jsonb_build_object(
    'receivables', (
      SELECT jsonb_build_object(
        'total_pending', COALESCE(SUM(amount - paid_amount) FILTER (WHERE status NOT IN ('paid','cancelled')), 0),
        'overdue_amount', COALESCE(SUM(amount - paid_amount) FILTER (WHERE status NOT IN ('paid','cancelled') AND due_date < v_today), 0),
        'overdue_count', COUNT(*) FILTER (WHERE status NOT IN ('paid','cancelled') AND due_date < v_today),
        'due_today', COUNT(*) FILTER (WHERE status NOT IN ('paid','cancelled') AND due_date = v_today),
        'due_week', COUNT(*) FILTER (WHERE status NOT IN ('paid','cancelled') AND due_date BETWEEN v_today AND v_week),
        'collected_month', COALESCE((SELECT SUM(amount) FROM public.payments_received WHERE payment_date BETWEEN v_month_s AND v_month_e), 0)
      )
      FROM public.receivables
    )
  );

  -- Payables summary
  v_result := v_result || jsonb_build_object(
    'payables', (
      SELECT jsonb_build_object(
        'total_pending', COALESCE(SUM(amount - paid_amount) FILTER (WHERE status NOT IN ('paid','cancelled')), 0),
        'overdue_amount', COALESCE(SUM(amount - paid_amount) FILTER (WHERE status NOT IN ('paid','cancelled') AND due_date < v_today), 0),
        'overdue_count', COUNT(*) FILTER (WHERE status NOT IN ('paid','cancelled') AND due_date < v_today),
        'due_today', COUNT(*) FILTER (WHERE status NOT IN ('paid','cancelled') AND due_date = v_today),
        'due_week', COUNT(*) FILTER (WHERE status NOT IN ('paid','cancelled') AND due_date BETWEEN v_today AND v_week),
        'paid_month', COALESCE((SELECT SUM(amount) FROM public.payments_made WHERE payment_date BETWEEN v_month_s AND v_month_e), 0)
      )
      FROM public.payables
    )
  );

  -- Projects summary
  v_result := v_result || jsonb_build_object(
    'projects', (
      SELECT jsonb_build_object(
        'active', COUNT(*) FILTER (WHERE status NOT IN ('completed','cancelled') AND archived_at IS NULL),
        'delayed', COUNT(*) FILTER (
          WHERE status NOT IN ('completed','cancelled') AND archived_at IS NULL
          AND estimated_delivery_date IS NOT NULL AND estimated_delivery_date < v_today
        ),
        'needs_design', COUNT(*) FILTER (
          WHERE status IN ('design','design_approval','production') AND archived_at IS NULL
          AND id NOT IN (
            SELECT DISTINCT project_id FROM public.project_designs
            WHERE status = 'client_approved' AND archived_at IS NULL
          )
        )
      )
      FROM public.projects
    )
  );

  -- Tasks summary
  v_result := v_result || jsonb_build_object(
    'tasks', (
      SELECT jsonb_build_object(
        'pending_today', COUNT(*) FILTER (WHERE status = 'pending' AND due_date <= v_today),
        'pending_total', COUNT(*) FILTER (WHERE status = 'pending')
      )
      FROM public.tasks
      WHERE status = 'pending'
    )
  );

  -- Managed entities summaries
  v_result := v_result || jsonb_build_object(
    'managed_entities', (
      SELECT jsonb_agg(jsonb_build_object(
        'id',       me.id,
        'name',     me.name,
        'pending',  COALESCE(ep.pending, 0),
        'overdue',  COALESCE(ep.overdue, 0),
        'next_due', ep.next_due,
        'next_concept', ep.next_concept
      ))
      FROM public.managed_entities me
      LEFT JOIN LATERAL (
        SELECT
          SUM(p.amount - p.paid_amount) FILTER (WHERE p.status NOT IN ('paid','cancelled'))     AS pending,
          SUM(p.amount - p.paid_amount) FILTER (WHERE p.status NOT IN ('paid','cancelled') AND p.due_date < v_today) AS overdue,
          MIN(p.due_date) FILTER (WHERE p.status NOT IN ('paid','cancelled') AND p.due_date >= v_today) AS next_due,
          (SELECT p2.concept FROM public.payables p2
           WHERE p2.managed_entity_id = me.id AND p2.status NOT IN ('paid','cancelled')
             AND p2.due_date >= v_today ORDER BY p2.due_date LIMIT 1) AS next_concept
        FROM public.payables p
        WHERE p.managed_entity_id = me.id
      ) ep ON true
      WHERE me.active = true
      ORDER BY me.sort_order
    )
  );

  -- Quotes in review
  v_result := v_result || jsonb_build_object(
    'quotes_review_count', (SELECT COUNT(*) FROM public.quotes WHERE status = 'review' AND archived_at IS NULL)
  );

  -- Documents expiring soon
  v_result := v_result || jsonb_build_object(
    'documents_expiring', (
      SELECT COUNT(*) FROM public.documents
      WHERE expiration_date IS NOT NULL
        AND expiration_date BETWEEN v_today AND v_soon30
        AND deleted_at IS NULL
    )
  );

  v_result := v_result || jsonb_build_object('today', v_today::text, 'timezone', v_tz);

  RETURN v_result;
END;
$$;

-- ─── 7. get_pending_items() — Lista unificada de pendientes ──────

CREATE OR REPLACE FUNCTION public.get_pending_items(
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  item_type    text,
  item_id      text,
  label        text,
  sub_label    text,
  amount       numeric,
  due_date     date,
  priority     text,
  urgency_rank integer,
  route        text,
  entity_id    text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz    text;
  v_today date;
  v_week  date;
  v_soon7 date;
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  SELECT COALESCE(timezone, 'America/Caracas') INTO v_tz
  FROM public.company_settings LIMIT 1;
  IF v_tz IS NULL THEN v_tz := 'America/Caracas'; END IF;

  v_today := (now() AT TIME ZONE v_tz)::date;
  v_week  := v_today + 7;
  v_soon7 := v_today + 7;

  RETURN QUERY

  -- Receivables due/overdue
  SELECT
    'receivable'::text,
    r.id::text,
    'Cobrar: ' || r.concept,
    COALESCE(c.full_name, '—'),
    r.amount - r.paid_amount,
    r.due_date,
    CASE
      WHEN r.due_date < v_today THEN 'urgent'
      WHEN r.due_date = v_today THEN 'high'
      WHEN r.due_date <= v_today + 1 THEN 'high'
      ELSE 'normal'
    END,
    CASE
      WHEN r.due_date < v_today THEN 1
      WHEN r.due_date = v_today THEN 2
      WHEN r.due_date = v_today + 1 THEN 3
      ELSE 4
    END,
    '/cuentas-por-cobrar',
    r.id::text
  FROM public.receivables r
  LEFT JOIN public.clients c ON c.id = r.client_id
  WHERE r.status NOT IN ('paid','cancelled')
    AND (r.due_date IS NULL OR r.due_date <= v_week)

  UNION ALL

  -- Payables due/overdue
  SELECT
    'payable'::text,
    p.id::text,
    'Pagar: ' || p.concept,
    COALESCE(me.name, p.beneficiary_name, '—'),
    p.amount - p.paid_amount,
    p.due_date,
    CASE
      WHEN p.due_date < v_today THEN 'urgent'
      WHEN p.due_date = v_today THEN 'high'
      WHEN p.due_date <= v_today + 1 THEN 'high'
      ELSE 'normal'
    END,
    CASE
      WHEN p.due_date < v_today THEN 1
      WHEN p.due_date = v_today THEN 2
      WHEN p.due_date = v_today + 1 THEN 3
      ELSE 4
    END,
    '/cuentas-por-pagar/' || p.id::text,
    p.id::text
  FROM public.payables p
  LEFT JOIN public.managed_entities me ON me.id = p.managed_entity_id
  WHERE p.status NOT IN ('paid','cancelled')
    AND (p.due_date IS NULL OR p.due_date <= v_week)

  UNION ALL

  -- Documents expiring
  SELECT
    'document'::text,
    d.id::text,
    'Documento vence: ' || d.title,
    CASE
      WHEN d.expiration_date < v_today THEN 'Vencido'
      WHEN d.expiration_date = v_today THEN 'Vence hoy'
      ELSE 'Vence en ' || (d.expiration_date - v_today)::text || ' días'
    END,
    NULL::numeric,
    d.expiration_date,
    CASE
      WHEN d.expiration_date < v_today THEN 'urgent'
      WHEN d.expiration_date <= v_today + 7 THEN 'high'
      ELSE 'normal'
    END,
    CASE
      WHEN d.expiration_date < v_today THEN 1
      WHEN d.expiration_date = v_today THEN 2
      WHEN d.expiration_date = v_today + 1 THEN 3
      ELSE 4
    END,
    '/documentos',
    d.id::text
  FROM public.documents d
  WHERE d.expiration_date IS NOT NULL
    AND d.expiration_date <= v_today + 30
    AND d.deleted_at IS NULL

  UNION ALL

  -- Projects delayed
  SELECT
    'project'::text,
    pr.id::text,
    'Proyecto atrasado: ' || pr.name,
    'Etapa: ' || pr.status || ' · Entrega prevista: ' || to_char(pr.estimated_delivery_date, 'DD/MM/YYYY'),
    NULL::numeric,
    pr.estimated_delivery_date,
    'urgent'::text,
    1,
    '/proyectos/' || pr.id::text,
    pr.id::text
  FROM public.projects pr
  WHERE pr.status NOT IN ('completed','cancelled')
    AND pr.archived_at IS NULL
    AND pr.estimated_delivery_date IS NOT NULL
    AND pr.estimated_delivery_date < v_today

  UNION ALL

  -- Projects needing design approval
  SELECT
    'design'::text,
    pr.id::text,
    'Diseño pendiente: ' || pr.name,
    'Etapa ' || pr.status || ' sin diseño aprobado por cliente',
    NULL::numeric,
    v_today,
    CASE WHEN pr.status = 'production' THEN 'urgent' ELSE 'high' END,
    CASE WHEN pr.status = 'production' THEN 1 ELSE 2 END,
    '/proyectos/' || pr.id::text,
    pr.id::text
  FROM public.projects pr
  WHERE pr.status IN ('design','design_approval','production')
    AND pr.archived_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.project_designs pd
      WHERE pd.project_id = pr.id AND pd.status = 'client_approved' AND pd.archived_at IS NULL
    )

  UNION ALL

  -- Tasks due today or overdue
  SELECT
    'task'::text,
    t.id::text,
    'Tarea: ' || t.title,
    CASE
      WHEN t.due_date < v_today THEN 'Vencida'
      WHEN t.due_date = v_today THEN 'Vence hoy'
      ELSE NULL
    END,
    NULL::numeric,
    t.due_date,
    CASE
      WHEN t.priority = 'urgent' THEN 'urgent'
      WHEN t.due_date < v_today THEN 'urgent'
      WHEN t.due_date = v_today THEN 'high'
      ELSE t.priority
    END,
    CASE
      WHEN t.due_date < v_today THEN 1
      WHEN t.due_date = v_today THEN 2
      ELSE 4
    END,
    '/tareas',
    t.id::text
  FROM public.tasks t
  WHERE t.status = 'pending'
    AND (t.due_date IS NULL OR t.due_date <= v_week)

  ORDER BY urgency_rank, due_date NULLS LAST
  LIMIT p_limit;
END;
$$;

-- ─── 8. CALENDARIO — get_calendar_events() ───────────────────────

CREATE OR REPLACE FUNCTION public.get_calendar_events(
  p_from date,
  p_to   date
)
RETURNS TABLE (
  event_type text,
  event_id   text,
  title      text,
  event_date date,
  amount     numeric,
  status     text,
  route      text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  RETURN QUERY

  SELECT 'receivable'::text, r.id::text, 'Cobrar: ' || r.concept,
    r.due_date, r.amount - r.paid_amount, r.status::text, '/cuentas-por-cobrar'
  FROM public.receivables r
  WHERE r.due_date BETWEEN p_from AND p_to AND r.status NOT IN ('paid','cancelled')

  UNION ALL

  SELECT 'payable'::text, p.id::text, 'Pagar: ' || p.concept,
    p.due_date, p.amount - p.paid_amount, p.status::text, '/cuentas-por-pagar/' || p.id::text
  FROM public.payables p
  WHERE p.due_date BETWEEN p_from AND p_to AND p.status NOT IN ('paid','cancelled')

  UNION ALL

  SELECT 'document'::text, d.id::text, 'Vence: ' || d.title,
    d.expiration_date, NULL::numeric, 'expiring'::text, '/documentos'
  FROM public.documents d
  WHERE d.expiration_date BETWEEN p_from AND p_to AND d.deleted_at IS NULL

  UNION ALL

  SELECT 'project'::text, pr.id::text, pr.name,
    pr.estimated_delivery_date, pr.total_amount, pr.status::text, '/proyectos/' || pr.id::text
  FROM public.projects pr
  WHERE pr.estimated_delivery_date BETWEEN p_from AND p_to
    AND pr.status NOT IN ('completed','cancelled') AND pr.archived_at IS NULL

  UNION ALL

  SELECT 'task'::text, t.id::text, t.title,
    t.due_date, NULL::numeric, t.status::text, '/tareas'
  FROM public.tasks t
  WHERE t.due_date BETWEEN p_from AND p_to AND t.status = 'pending'

  ORDER BY event_date, event_type;
END;
$$;

-- ─── 9. VERIFICACIÓN ─────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM public.tasks) AS tasks_count,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'dedupe_key') AS has_dedupe_key,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'timezone') AS has_timezone;
