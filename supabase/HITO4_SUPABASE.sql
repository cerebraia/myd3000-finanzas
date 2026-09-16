-- ============================================================
-- MYD3000 ADMIN — HITO #4
-- Finanzas operativas, obligaciones, personal, documentos
-- Proyecto: bxmuuphzcruyewbergqd
-- Prerequisito: HITO3_SUPABASE.sql debe haber sido ejecutado.
-- Seguro: no DROP TABLE, no TRUNCATE, no pérdida de datos.
-- ============================================================

-- ─── 1. EXPENSE_CATEGORIES (categorías de gastos) ────────────
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  active      boolean     NOT NULL DEFAULT true,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth users can view expense categories"   ON public.expense_categories;
DROP POLICY IF EXISTS "Auth users can manage expense categories" ON public.expense_categories;
CREATE POLICY "Auth users can view expense categories"
  ON public.expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage expense categories"
  ON public.expense_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Datos iniciales
INSERT INTO public.expense_categories (name, sort_order) VALUES
  ('Nómina',          1),
  ('Arquitectos',     2),
  ('Carpinteros',     3),
  ('Servicios',       4),
  ('Impuestos',       5),
  ('Alquiler',        6),
  ('Condominio',      7),
  ('Electricidad',    8),
  ('Seguro Social',   9),
  ('FAOV',           10),
  ('Transporte',     11),
  ('Compras',        12),
  ('Proyecto',       13),
  ('Administrativo', 14),
  ('Otros',          15)
ON CONFLICT DO NOTHING;

-- ─── 2. PAYMENT_METHODS (métodos de pago configurables) ──────
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  active      boolean     NOT NULL DEFAULT true,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth users can view payment methods"   ON public.payment_methods;
DROP POLICY IF EXISTS "Auth users can manage payment methods" ON public.payment_methods;
CREATE POLICY "Auth users can view payment methods"
  ON public.payment_methods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage payment methods"
  ON public.payment_methods FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.payment_methods (name, sort_order) VALUES
  ('Efectivo',      1),
  ('Transferencia', 2),
  ('Zelle',         3),
  ('Pago móvil',    4),
  ('Cheque',        5),
  ('Tarjeta',       6),
  ('USDT',          7),
  ('Otro',          8)
ON CONFLICT DO NOTHING;

-- ─── 3. DOCUMENT_CATEGORIES ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth users can view doc categories"   ON public.document_categories;
DROP POLICY IF EXISTS "Auth users can manage doc categories" ON public.document_categories;
CREATE POLICY "Auth users can view doc categories"
  ON public.document_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage doc categories"
  ON public.document_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.document_categories (name) VALUES
  ('Vehículos'),
  ('Personal'),
  ('Legal'),
  ('Administrativo'),
  ('Rifas'),
  ('Impuestos'),
  ('Seguros'),
  ('Proyectos'),
  ('Contratos'),
  ('Otros')
ON CONFLICT DO NOTHING;

-- ─── 4. CUENTAS POR PAGAR (payables) ─────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.payable_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.payables (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_number   bigint        UNIQUE NOT NULL DEFAULT nextval('public.payable_number_seq'),
  concept          text          NOT NULL,
  description      text,
  category_id      uuid          REFERENCES public.expense_categories(id),
  beneficiary_type text,
  beneficiary_id   uuid,
  beneficiary_name text,
  project_id       uuid          REFERENCES public.projects(id),
  amount           numeric(14,2) NOT NULL CHECK (amount > 0),
  paid_amount      numeric(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  due_date         date,
  status           text          NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','partial','paid','cancelled')),
  priority         text          NOT NULL DEFAULT 'normal'
                   CHECK (priority IN ('normal','high','urgent')),
  notes            text,
  recurring_obligation_id uuid,
  period_key       text,
  created_by       uuid          REFERENCES auth.users(id),
  created_at       timestamptz   DEFAULT now(),
  updated_at       timestamptz   DEFAULT now(),
  CONSTRAINT payables_paid_le_amount CHECK (paid_amount <= amount)
);

CREATE UNIQUE INDEX IF NOT EXISTS payables_obligation_period_idx
  ON public.payables (recurring_obligation_id, period_key)
  WHERE recurring_obligation_id IS NOT NULL AND period_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS payables_status_idx   ON public.payables (status);
CREATE INDEX IF NOT EXISTS payables_due_date_idx ON public.payables (due_date);
CREATE INDEX IF NOT EXISTS payables_project_idx  ON public.payables (project_id);

ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth users can view payables"   ON public.payables;
DROP POLICY IF EXISTS "Auth users can create payables" ON public.payables;
DROP POLICY IF EXISTS "Auth users can update payables" ON public.payables;
CREATE POLICY "Auth users can view payables"
  ON public.payables FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can create payables"
  ON public.payables FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can update payables"
  ON public.payables FOR UPDATE TO authenticated USING (true);

DROP TRIGGER IF EXISTS payables_updated_at ON public.payables;
CREATE TRIGGER payables_updated_at BEFORE UPDATE ON public.payables
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ─── 5. PAGOS REALIZADOS (payments_made) ─────────────────────
CREATE TABLE IF NOT EXISTS public.payments_made (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_id           uuid          NOT NULL REFERENCES public.payables(id),
  amount               numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_date         date          NOT NULL DEFAULT CURRENT_DATE,
  payment_method       text,
  reference            text,
  notes                text,
  receipt_storage_path text,
  receipt_file_name    text,
  created_by           uuid          REFERENCES auth.users(id),
  created_at           timestamptz   DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_made_payable_idx ON public.payments_made (payable_id);

ALTER TABLE public.payments_made ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth users can view payments_made"   ON public.payments_made;
DROP POLICY IF EXISTS "Auth users can create payments_made" ON public.payments_made;
CREATE POLICY "Auth users can view payments_made"
  ON public.payments_made FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can create payments_made"
  ON public.payments_made FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 6. OBLIGACIONES RECURRENTES ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.recurring_obligations (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text        NOT NULL,
  description          text,
  category_id          uuid        REFERENCES public.expense_categories(id),
  beneficiary_type     text,
  beneficiary_id       uuid,
  beneficiary_name     text,
  amount               numeric(14,2),
  frequency            text        NOT NULL
                       CHECK (frequency IN ('weekly','biweekly','monthly','quarterly','annual','custom')),
  day_of_week          integer,
  day_of_month         integer,
  start_date           date        NOT NULL DEFAULT CURRENT_DATE,
  end_date             date,
  active               boolean     NOT NULL DEFAULT true,
  reminder_days_before integer     NOT NULL DEFAULT 3,
  notes                text,
  created_by           uuid        REFERENCES auth.users(id),
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

ALTER TABLE public.recurring_obligations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth users can view obligations"   ON public.recurring_obligations;
DROP POLICY IF EXISTS "Auth users can manage obligations" ON public.recurring_obligations;
CREATE POLICY "Auth users can view obligations"
  ON public.recurring_obligations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage obligations"
  ON public.recurring_obligations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS obligations_updated_at ON public.recurring_obligations;
CREATE TRIGGER obligations_updated_at BEFORE UPDATE ON public.recurring_obligations
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ─── 7. PERSONAL (employees) ─────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.employee_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.employees (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number          bigint      UNIQUE NOT NULL DEFAULT nextval('public.employee_number_seq'),
  first_name               text        NOT NULL,
  last_name                text        NOT NULL,
  document_type            text,
  document_number          text,
  phone                    text,
  email                    text,
  location                 text,
  address                  text,
  employee_type            text        NOT NULL DEFAULT 'employee'
                           CHECK (employee_type IN (
                             'employee','architect','carpenter','driver',
                             'cook','administrative','contractor','other'
                           )),
  position                 text,
  specialty                text,
  status                   text        NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','inactive','suspended','terminated')),
  hire_date                date,
  termination_date         date,
  photo_storage_path       text,
  resume_storage_path      text,
  service_record_path      text,
  notes                    text,
  created_by               uuid        REFERENCES auth.users(id),
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employees_type_idx   ON public.employees (employee_type);
CREATE INDEX IF NOT EXISTS employees_status_idx ON public.employees (status);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth users can view employees"   ON public.employees;
DROP POLICY IF EXISTS "Auth users can manage employees" ON public.employees;
CREATE POLICY "Auth users can view employees"
  ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage employees"
  ON public.employees FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS employees_updated_at ON public.employees;
CREATE TRIGGER employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ─── 8. DOCUMENTOS ADMINISTRATIVOS ───────────────────────────
CREATE TABLE IF NOT EXISTS public.documents (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title                text        NOT NULL,
  description          text,
  category_id          uuid        REFERENCES public.document_categories(id),
  document_type        text,
  related_entity_type  text,
  related_entity_id    uuid,
  issue_date           date,
  expiration_date      date,
  storage_path         text,
  file_name            text,
  mime_type            text,
  notes                text,
  uploaded_by          uuid        REFERENCES auth.users(id),
  deleted_at           timestamptz,
  deleted_by           uuid        REFERENCES auth.users(id),
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_category_idx    ON public.documents (category_id);
CREATE INDEX IF NOT EXISTS documents_expiry_idx      ON public.documents (expiration_date) WHERE expiration_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS documents_entity_idx      ON public.documents (related_entity_type, related_entity_id);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth users can view documents"   ON public.documents;
DROP POLICY IF EXISTS "Auth users can manage documents" ON public.documents;
CREATE POLICY "Auth users can view documents"
  ON public.documents FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "Auth users can manage documents"
  ON public.documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS documents_updated_at ON public.documents;
CREATE TRIGGER documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ─── 9. ADD receipt_storage_path TO payments_received ────────
ALTER TABLE public.payments_received
  ADD COLUMN IF NOT EXISTS receipt_storage_path text,
  ADD COLUMN IF NOT EXISTS receipt_file_name    text;

-- ─── 10. STORAGE BUCKETS ─────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'admin-files', 'admin-files', false, 52428800,
  ARRAY['image/png','image/jpeg','image/webp','application/pdf',
        'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Auth upload admin files"  ON storage.objects;
DROP POLICY IF EXISTS "Auth read admin files"    ON storage.objects;
DROP POLICY IF EXISTS "Auth delete admin files"  ON storage.objects;
CREATE POLICY "Auth upload admin files"
  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'admin-files');
CREATE POLICY "Auth read admin files"
  ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'admin-files');
CREATE POLICY "Auth delete admin files"
  ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'admin-files');

-- ─── 11. RPC: register_payable_payment ───────────────────────
CREATE OR REPLACE FUNCTION public.register_payable_payment(
  p_payable_id     uuid,
  p_amount         numeric,
  p_payment_date   date,
  p_method         text    DEFAULT NULL,
  p_reference      text    DEFAULT NULL,
  p_notes          text    DEFAULT NULL,
  p_receipt_path   text    DEFAULT NULL,
  p_receipt_name   text    DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_payable   public.payables%ROWTYPE;
  v_new_paid  numeric;
  v_new_status text;
  v_payment_id uuid;
  v_balance   numeric;
BEGIN
  SELECT * INTO v_payable FROM public.payables WHERE id = p_payable_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payable not found'; END IF;
  IF v_payable.status IN ('paid','cancelled') THEN
    RAISE EXCEPTION 'This payable is already %', v_payable.status;
  END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero'; END IF;
  v_balance := v_payable.amount - v_payable.paid_amount;
  IF p_amount > v_balance THEN
    RAISE EXCEPTION 'Payment amount (%) exceeds pending balance (%)', p_amount, v_balance;
  END IF;

  INSERT INTO public.payments_made
    (payable_id, amount, payment_date, payment_method, reference, notes, receipt_storage_path, receipt_file_name, created_by)
  VALUES
    (p_payable_id, p_amount, p_payment_date, p_method, p_reference, p_notes, p_receipt_path, p_receipt_name, auth.uid())
  RETURNING id INTO v_payment_id;

  v_new_paid   := v_payable.paid_amount + p_amount;
  v_new_status := CASE
    WHEN v_new_paid >= v_payable.amount THEN 'paid'
    WHEN v_new_paid > 0                 THEN 'partial'
    ELSE 'pending'
  END;

  UPDATE public.payables SET
    paid_amount = v_new_paid,
    status      = v_new_status,
    updated_at  = now()
  WHERE id = p_payable_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'payable', p_payable_id, 'payment_registered',
    jsonb_build_object(
      'payment_id', v_payment_id,
      'amount', p_amount,
      'new_status', v_new_status,
      'remaining', v_payable.amount - v_new_paid
    ));

  RETURN jsonb_build_object(
    'payment_id',      v_payment_id,
    'new_paid_amount', v_new_paid,
    'new_status',      v_new_status,
    'remaining',       v_payable.amount - v_new_paid
  );
END; $$;

-- ─── 12. RPC: generate_payable_from_obligation ───────────────
CREATE OR REPLACE FUNCTION public.generate_payable_from_obligation(
  p_obligation_id uuid,
  p_period_key    text,
  p_due_date      date,
  p_amount        numeric DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_obl    public.recurring_obligations%ROWTYPE;
  v_id     uuid;
  v_amount numeric;
BEGIN
  SELECT * INTO v_obl FROM public.recurring_obligations WHERE id = p_obligation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Obligation not found'; END IF;
  IF NOT v_obl.active THEN RAISE EXCEPTION 'Obligation is inactive'; END IF;

  v_amount := COALESCE(p_amount, v_obl.amount, 0);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero. Specify amount or configure obligation amount.';
  END IF;

  INSERT INTO public.payables (
    concept, description, category_id, beneficiary_type, beneficiary_id, beneficiary_name,
    amount, due_date, status, priority, recurring_obligation_id, period_key, created_by
  ) VALUES (
    v_obl.name || ' — ' || p_period_key,
    v_obl.description,
    v_obl.category_id, v_obl.beneficiary_type, v_obl.beneficiary_id, v_obl.beneficiary_name,
    v_amount, p_due_date, 'pending', 'normal', p_obligation_id, p_period_key, auth.uid()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'payable', v_id, 'created',
    jsonb_build_object('obligation_id', p_obligation_id, 'period_key', p_period_key, 'amount', v_amount));

  RETURN v_id;
END; $$;

-- ─── 13. VISTA CUENTAS POR COBRAR VENCIDAS ───────────────────
-- Helper view para el dashboard: calcula vencidas dinámicamente
CREATE OR REPLACE VIEW public.receivables_overdue AS
SELECT *
FROM public.receivables
WHERE due_date < CURRENT_DATE
  AND paid_amount < amount
  AND status NOT IN ('paid','cancelled');

-- ─── FIN ─────────────────────────────────────────────────────
