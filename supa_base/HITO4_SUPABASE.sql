-- =============================================================
-- HITO #4 — MYD3000 ADMIN
-- Finanzas Operativas + Obligaciones + Personal + Documentos
-- Ejecutar en: Supabase SQL Editor
-- Seguro: sin DROP TABLE, sin TRUNCATE, idempotente con IF NOT EXISTS
-- =============================================================

-- ─── FUNCIÓN updated_at (reutilizada si no existe) ────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN new.updated_at = now(); RETURN new; END; $$;

-- ─── 1. CATEGORÍAS DE GASTOS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text,
  active      boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='expense_categories' AND policyname='Authenticated users can read expense_categories'
  ) THEN
    CREATE POLICY "Authenticated users can read expense_categories"
      ON public.expense_categories FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='expense_categories' AND policyname='Authenticated users can manage expense_categories'
  ) THEN
    CREATE POLICY "Authenticated users can manage expense_categories"
      ON public.expense_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Datos iniciales (idempotente)
INSERT INTO public.expense_categories (name, sort_order) VALUES
  ('Nómina',         1),
  ('Arquitectos',    2),
  ('Carpinteros',    3),
  ('Servicios',      4),
  ('Impuestos',      5),
  ('Alquiler',       6),
  ('Condominio',     7),
  ('Electricidad',   8),
  ('Seguro Social',  9),
  ('FAOV',          10),
  ('Transporte',    11),
  ('Compras',       12),
  ('Proyecto',      13),
  ('Administrativo',14),
  ('Otros',         15)
ON CONFLICT (name) DO NOTHING;


-- ─── 2. MÉTODOS DE PAGO ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  active      boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='payment_methods' AND policyname='Authenticated users can read payment_methods'
  ) THEN
    CREATE POLICY "Authenticated users can read payment_methods"
      ON public.payment_methods FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='payment_methods' AND policyname='Authenticated users can manage payment_methods'
  ) THEN
    CREATE POLICY "Authenticated users can manage payment_methods"
      ON public.payment_methods FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO public.payment_methods (name, sort_order) VALUES
  ('Efectivo',      1),
  ('Transferencia', 2),
  ('Zelle',         3),
  ('Pago móvil',    4),
  ('Cheque',        5),
  ('Tarjeta',       6),
  ('USDT',          7),
  ('Otro',          8)
ON CONFLICT (name) DO NOTHING;


-- ─── 3. CATEGORÍAS DE DOCUMENTOS ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='document_categories' AND policyname='Authenticated users can read document_categories'
  ) THEN
    CREATE POLICY "Authenticated users can read document_categories"
      ON public.document_categories FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='document_categories' AND policyname='Authenticated users can manage document_categories'
  ) THEN
    CREATE POLICY "Authenticated users can manage document_categories"
      ON public.document_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

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
ON CONFLICT (name) DO NOTHING;


-- ─── 4. CUENTAS POR PAGAR ─────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.payable_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.payables (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_number          bigint UNIQUE NOT NULL DEFAULT nextval('public.payable_number_seq'),
  concept                 text NOT NULL,
  description             text,
  category_id             uuid REFERENCES public.expense_categories(id),
  beneficiary_type        text,
  beneficiary_id          uuid,
  beneficiary_name        text,
  project_id              uuid REFERENCES public.projects(id),
  amount                  numeric(14,2) NOT NULL,
  paid_amount             numeric(14,2) NOT NULL DEFAULT 0,
  due_date                date,
  status                  text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','partial','paid','cancelled')),
  priority                text NOT NULL DEFAULT 'normal'
                          CHECK (priority IN ('normal','high','urgent')),
  notes                   text,
  recurring_obligation_id uuid,
  period_key              text,
  created_by              uuid REFERENCES auth.users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payables_amount_positive       CHECK (amount > 0),
  CONSTRAINT payables_paid_amount_positive  CHECK (paid_amount >= 0),
  CONSTRAINT payables_paid_lte_amount       CHECK (paid_amount <= amount)
);

CREATE UNIQUE INDEX IF NOT EXISTS payables_obligation_period_idx
  ON public.payables (recurring_obligation_id, period_key)
  WHERE recurring_obligation_id IS NOT NULL AND period_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS payables_due_date_idx    ON public.payables (due_date);
CREATE INDEX IF NOT EXISTS payables_status_idx      ON public.payables (status);
CREATE INDEX IF NOT EXISTS payables_category_id_idx ON public.payables (category_id);

ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='payables' AND policyname='Authenticated users can read payables'
  ) THEN
    CREATE POLICY "Authenticated users can read payables"
      ON public.payables FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='payables' AND policyname='Authenticated users can create payables'
  ) THEN
    CREATE POLICY "Authenticated users can create payables"
      ON public.payables FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='payables' AND policyname='Authenticated users can update payables'
  ) THEN
    CREATE POLICY "Authenticated users can update payables"
      ON public.payables FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;

CREATE OR REPLACE TRIGGER payables_updated_at
  BEFORE UPDATE ON public.payables
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ─── 5. PAGOS REALIZADOS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments_made (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_id           uuid NOT NULL REFERENCES public.payables(id),
  amount               numeric(14,2) NOT NULL,
  payment_date         date NOT NULL DEFAULT CURRENT_DATE,
  payment_method       text,
  reference            text,
  notes                text,
  receipt_storage_path text,
  receipt_file_name    text,
  created_by           uuid REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_made_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS payments_made_payable_id_idx   ON public.payments_made (payable_id);
CREATE INDEX IF NOT EXISTS payments_made_payment_date_idx ON public.payments_made (payment_date);

ALTER TABLE public.payments_made ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='payments_made' AND policyname='Authenticated users can read payments_made'
  ) THEN
    CREATE POLICY "Authenticated users can read payments_made"
      ON public.payments_made FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='payments_made' AND policyname='Authenticated users can create payments_made'
  ) THEN
    CREATE POLICY "Authenticated users can create payments_made"
      ON public.payments_made FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;


-- ─── 6. OBLIGACIONES RECURRENTES ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.recurring_obligations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  description          text,
  category_id          uuid REFERENCES public.expense_categories(id),
  beneficiary_type     text,
  beneficiary_id       uuid,
  beneficiary_name     text,
  amount               numeric(14,2),
  frequency            text NOT NULL
                       CHECK (frequency IN ('weekly','biweekly','monthly','quarterly','annual','custom')),
  day_of_week          integer CHECK (day_of_week BETWEEN 0 AND 6),
  day_of_month         integer CHECK (day_of_month BETWEEN 1 AND 28),
  start_date           date NOT NULL DEFAULT CURRENT_DATE,
  end_date             date,
  active               boolean NOT NULL DEFAULT true,
  reminder_days_before integer NOT NULL DEFAULT 3 CHECK (reminder_days_before >= 0),
  notes                text,
  created_by           uuid REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recurring_obligations_active_idx ON public.recurring_obligations (active);

ALTER TABLE public.recurring_obligations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='recurring_obligations' AND policyname='Authenticated users can read recurring_obligations'
  ) THEN
    CREATE POLICY "Authenticated users can read recurring_obligations"
      ON public.recurring_obligations FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='recurring_obligations' AND policyname='Authenticated users can manage recurring_obligations'
  ) THEN
    CREATE POLICY "Authenticated users can manage recurring_obligations"
      ON public.recurring_obligations FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE TRIGGER recurring_obligations_updated_at
  BEFORE UPDATE ON public.recurring_obligations
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ─── 7. EMPLEADOS / PERSONAL ──────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.employee_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.employees (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number         bigint UNIQUE NOT NULL DEFAULT nextval('public.employee_number_seq'),
  first_name              text NOT NULL,
  last_name               text NOT NULL,
  document_type           text,
  document_number         text,
  phone                   text,
  email                   text,
  location                text,
  address                 text,
  employee_type           text NOT NULL DEFAULT 'employee'
                          CHECK (employee_type IN ('employee','architect','carpenter','driver','cook','administrative','contractor','other')),
  position                text,
  specialty               text,
  status                  text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','inactive','suspended','terminated')),
  hire_date               date,
  termination_date        date,
  photo_storage_path      text,
  resume_storage_path     text,
  service_record_path     text,
  notes                   text,
  created_by              uuid REFERENCES auth.users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS employees_type_idx   ON public.employees (employee_type);
CREATE INDEX IF NOT EXISTS employees_status_idx ON public.employees (status);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='employees' AND policyname='Authenticated users can read employees'
  ) THEN
    CREATE POLICY "Authenticated users can read employees"
      ON public.employees FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='employees' AND policyname='Authenticated users can manage employees'
  ) THEN
    CREATE POLICY "Authenticated users can manage employees"
      ON public.employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE TRIGGER employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ─── 8. DOCUMENTOS ADMINISTRATIVOS ───────────────────────────
CREATE TABLE IF NOT EXISTS public.documents (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                text NOT NULL,
  description          text,
  category_id          uuid REFERENCES public.document_categories(id),
  document_type        text,
  related_entity_type  text,
  related_entity_id    uuid,
  issue_date           date,
  expiration_date      date,
  storage_path         text,
  file_name            text,
  mime_type            text,
  notes                text,
  uploaded_by          uuid REFERENCES auth.users(id),
  deleted_at           timestamptz,
  deleted_by           uuid REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_category_id_idx     ON public.documents (category_id);
CREATE INDEX IF NOT EXISTS documents_expiration_date_idx ON public.documents (expiration_date);
CREATE INDEX IF NOT EXISTS documents_deleted_at_idx      ON public.documents (deleted_at);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='documents' AND policyname='Authenticated users can read documents'
  ) THEN
    CREATE POLICY "Authenticated users can read documents"
      ON public.documents FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='documents' AND policyname='Authenticated users can manage documents'
  ) THEN
    CREATE POLICY "Authenticated users can manage documents"
      ON public.documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE TRIGGER documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ─── 9. RPC: REGISTRAR PAGO DE CUENTA POR PAGAR ──────────────
CREATE OR REPLACE FUNCTION public.register_payable_payment(
  p_payable_id   uuid,
  p_amount       numeric,
  p_payment_date date,
  p_method       text DEFAULT NULL,
  p_reference    text DEFAULT NULL,
  p_notes        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_payable    public.payables%ROWTYPE;
  v_new_paid   numeric;
  v_new_status text;
  v_payment_id uuid;
  v_balance    numeric;
BEGIN
  SELECT * INTO v_payable FROM public.payables WHERE id = p_payable_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta por pagar no encontrada';
  END IF;
  IF v_payable.status IN ('paid','cancelled') THEN
    RAISE EXCEPTION 'Esta cuenta ya está %', v_payable.status;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a cero';
  END IF;

  v_balance := v_payable.amount - v_payable.paid_amount;
  IF p_amount > v_balance THEN
    RAISE EXCEPTION 'El monto (%) supera el saldo pendiente (%)', p_amount, v_balance;
  END IF;

  INSERT INTO public.payments_made (
    payable_id, amount, payment_date, payment_method, reference, notes, created_by
  ) VALUES (
    p_payable_id, p_amount, p_payment_date, p_method, p_reference, p_notes, auth.uid()
  )
  RETURNING id INTO v_payment_id;

  v_new_paid := v_payable.paid_amount + p_amount;

  IF v_new_paid >= v_payable.amount THEN
    v_new_status := 'paid';
  ELSIF v_new_paid > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'pending';
  END IF;

  UPDATE public.payables SET
    paid_amount = v_new_paid,
    status      = v_new_status,
    updated_at  = now()
  WHERE id = p_payable_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    auth.uid(), 'payable', p_payable_id,
    CASE WHEN v_new_status = 'paid' THEN 'payable.paid' ELSE 'payable.payment_registered' END,
    jsonb_build_object(
      'amount', p_amount,
      'method', p_method,
      'new_status', v_new_status,
      'remaining', v_payable.amount - v_new_paid
    )
  );

  RETURN jsonb_build_object(
    'payment_id',  v_payment_id,
    'new_status',  v_new_status,
    'remaining',   v_payable.amount - v_new_paid
  );
END;
$$;


-- ─── 10. RPC: GENERAR CUENTA DESDE OBLIGACIÓN ─────────────────
CREATE OR REPLACE FUNCTION public.generate_payable_from_obligation(
  p_obligation_id uuid,
  p_period_key    text,
  p_due_date      date,
  p_amount        numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_obl       public.recurring_obligations%ROWTYPE;
  v_amount    numeric;
  v_payable_id uuid;
BEGIN
  SELECT * INTO v_obl FROM public.recurring_obligations WHERE id = p_obligation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Obligación no encontrada';
  END IF;

  v_amount := COALESCE(p_amount, v_obl.amount);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Debes especificar un monto greater than zero';
  END IF;

  INSERT INTO public.payables (
    concept, category_id, beneficiary_name, amount,
    due_date, recurring_obligation_id, period_key, created_by
  ) VALUES (
    v_obl.name || ' — ' || p_period_key,
    v_obl.category_id,
    v_obl.beneficiary_name,
    v_amount,
    p_due_date,
    p_obligation_id,
    p_period_key,
    auth.uid()
  )
  RETURNING id INTO v_payable_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    auth.uid(), 'payable', v_payable_id, 'obligation.generated',
    jsonb_build_object(
      'obligation_id', p_obligation_id,
      'obligation_name', v_obl.name,
      'period_key', p_period_key,
      'amount', v_amount
    )
  );

  RETURN v_payable_id;
END;
$$;


-- =============================================================
-- STORAGE — Configurar en Supabase Dashboard
-- =============================================================
-- 1. Ir a Storage > New Bucket
-- 2. Nombre: "admin-files"
-- 3. Público: NO (privado)
-- 4. Políticas de acceso:
--    SELECT/INSERT/UPDATE/DELETE → rol authenticated
--
-- Estructura de carpetas esperada (se crea automáticamente):
--   employees/{id}/photo/
--   employees/{id}/resume/
--   employees/{id}/service-record/
--   documents/{timestamp_name}
--   payables/{id}/receipts/
-- =============================================================

-- =============================================================
-- VERIFICACIÓN (ejecutar después de aplicar el script)
-- =============================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN (
--   'expense_categories','payment_methods','document_categories',
--   'payables','payments_made','recurring_obligations',
--   'employees','documents'
-- )
-- ORDER BY table_name;
