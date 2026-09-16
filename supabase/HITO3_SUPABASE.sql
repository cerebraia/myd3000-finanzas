-- ============================================================
-- MYD3000 ADMIN — HITO #3
-- Ejecutar en Supabase SQL Editor (proyecto bxmuuphzcruyewbergqd)
-- Seguro: no usa DROP TABLE, no TRUNCATE, no borra datos.
-- Idempotente: puede re-ejecutarse sin efectos negativos.
-- ============================================================

-- ─── 0. FUNCIONES BASE (si no existen ya) ────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ─── 1. MODIFICAR TABLE quotes ───────────────────────────────
-- 1a. Migrar 'sent' → 'review' antes de tocar el constraint
UPDATE public.quotes SET status = 'review' WHERE status = 'sent';

-- 1b. Drop old status check constraint (nombre autogenerado por Postgres)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.quotes'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE 'ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

-- 1c. Nuevo check constraint
ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('draft', 'review', 'approved', 'rejected'));

-- 1d. Nuevas columnas en quotes
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS project_type             text,
  ADD COLUMN IF NOT EXISTS responsible_architect_name text,
  ADD COLUMN IF NOT EXISTS responsible_architect_id   uuid,
  ADD COLUMN IF NOT EXISTS company_signed_at          timestamptz,
  ADD COLUMN IF NOT EXISTS company_signed_by          text,
  ADD COLUMN IF NOT EXISTS client_signed_at           timestamptz,
  ADD COLUMN IF NOT EXISTS client_signer_name         text;

-- ─── 2. TABLA quote_payment_terms ────────────────────────────
CREATE TABLE IF NOT EXISTS public.quote_payment_terms (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id           uuid        NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  installment_number integer     NOT NULL,
  concept            text        NOT NULL,
  percentage         numeric(5,2),
  amount             numeric(14,2),
  due_condition      text,
  due_date           date,
  sort_order         integer     NOT NULL DEFAULT 0,
  created_at         timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_terms_quote_id_idx ON public.quote_payment_terms (quote_id);

ALTER TABLE public.quote_payment_terms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view payment terms"   ON public.quote_payment_terms;
DROP POLICY IF EXISTS "Authenticated users can manage payment terms" ON public.quote_payment_terms;
CREATE POLICY "Authenticated users can view payment terms"
  ON public.quote_payment_terms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage payment terms"
  ON public.quote_payment_terms FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 3. SECUENCIAS HITO #2 ───────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.project_number_seq  START 1;
CREATE SEQUENCE IF NOT EXISTS public.contract_number_seq START 1;

-- ─── 4. TABLA projects ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_number            bigint      UNIQUE NOT NULL DEFAULT nextval('public.project_number_seq'),
  client_id                 uuid        NOT NULL REFERENCES public.clients(id),
  quote_id                  uuid        UNIQUE REFERENCES public.quotes(id),
  name                      text        NOT NULL,
  project_type              text,
  description               text,
  responsible_architect_name text,
  responsible_architect_id   uuid,
  status                    text        NOT NULL DEFAULT 'planning'
                            CHECK (status IN (
                              'planning','design','design_approval','materials',
                              'production','installation','completed','cancelled'
                            )),
  total_amount              numeric(14,2) NOT NULL DEFAULT 0,
  start_date                date,
  estimated_delivery_date   date,
  completion_date           date,
  notes                     text,
  created_by                uuid        REFERENCES auth.users(id),
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_client_id_idx ON public.projects (client_id);
CREATE INDEX IF NOT EXISTS projects_status_idx    ON public.projects (status);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view projects"   ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can create projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can update projects" ON public.projects;
CREATE POLICY "Authenticated users can view projects"
  ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create projects"
  ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update projects"
  ON public.projects FOR UPDATE TO authenticated USING (true);

DROP TRIGGER IF EXISTS projects_updated_at ON public.projects;
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ─── 5. TABLA contracts ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contracts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number  bigint      UNIQUE NOT NULL DEFAULT nextval('public.contract_number_seq'),
  project_id       uuid        NOT NULL UNIQUE REFERENCES public.projects(id),
  client_id        uuid        NOT NULL REFERENCES public.clients(id),
  quote_id         uuid        REFERENCES public.quotes(id),
  status           text        NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','pending_signature','signed','completed','cancelled')),
  contract_date    date        DEFAULT CURRENT_DATE,
  signed_at        timestamptz,
  total_amount     numeric(14,2),
  terms            text[]      DEFAULT ARRAY[]::text[],
  notes            text,
  created_by       uuid        REFERENCES auth.users(id),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contracts_status_idx ON public.contracts (status);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view contracts"   ON public.contracts;
DROP POLICY IF EXISTS "Authenticated users can create contracts" ON public.contracts;
DROP POLICY IF EXISTS "Authenticated users can update contracts" ON public.contracts;
CREATE POLICY "Authenticated users can view contracts"
  ON public.contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create contracts"
  ON public.contracts FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update contracts"
  ON public.contracts FOR UPDATE TO authenticated USING (true);

DROP TRIGGER IF EXISTS contracts_updated_at ON public.contracts;
CREATE TRIGGER contracts_updated_at BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ─── 6. TABLA receivables ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.receivables (
  id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         uuid          NOT NULL REFERENCES public.projects(id),
  client_id          uuid          NOT NULL REFERENCES public.clients(id),
  quote_id           uuid          REFERENCES public.quotes(id),
  concept            text          NOT NULL,
  installment_number integer,
  percentage         numeric(5,2),
  amount             numeric(14,2) NOT NULL,
  due_date           date,
  status             text          NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','partial','paid','overdue','cancelled')),
  paid_amount        numeric(14,2) NOT NULL DEFAULT 0,
  paid_at            timestamptz,
  notes              text,
  created_at         timestamptz   DEFAULT now(),
  updated_at         timestamptz   DEFAULT now()
);
CREATE INDEX IF NOT EXISTS receivables_project_id_idx ON public.receivables (project_id);
CREATE INDEX IF NOT EXISTS receivables_status_idx     ON public.receivables (status);

ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view receivables"   ON public.receivables;
DROP POLICY IF EXISTS "Authenticated users can manage receivables" ON public.receivables;
CREATE POLICY "Authenticated users can view receivables"
  ON public.receivables FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage receivables"
  ON public.receivables FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS receivables_updated_at ON public.receivables;
CREATE TRIGGER receivables_updated_at BEFORE UPDATE ON public.receivables
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ─── 7. TABLA payments_received ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments_received (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_id  uuid          NOT NULL REFERENCES public.receivables(id),
  project_id     uuid          NOT NULL REFERENCES public.projects(id),
  client_id      uuid          NOT NULL REFERENCES public.clients(id),
  amount         numeric(14,2) NOT NULL,
  payment_date   date          NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  reference      text,
  notes          text,
  created_by     uuid          REFERENCES auth.users(id),
  created_at     timestamptz   DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_project_id_idx ON public.payments_received (project_id);

ALTER TABLE public.payments_received ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view payments_received"   ON public.payments_received;
DROP POLICY IF EXISTS "Authenticated users can create payments_received" ON public.payments_received;
CREATE POLICY "Authenticated users can view payments_received"
  ON public.payments_received FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create payments_received"
  ON public.payments_received FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 8. TABLA project_designs ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_designs (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version                 integer     NOT NULL DEFAULT 1,
  description             text,
  notes                   text,
  storage_path            text,
  file_name               text,
  mime_type               text,
  status                  text        NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','architect_approved','client_approved','rejected')),
  architect_approved_at   timestamptz,
  architect_approved_by   uuid        REFERENCES auth.users(id),
  client_approved_at      timestamptz,
  client_signer_name      text,
  client_approval_notes   text,
  created_by              uuid        REFERENCES auth.users(id),
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS designs_project_id_idx ON public.project_designs (project_id);

ALTER TABLE public.project_designs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view designs"   ON public.project_designs;
DROP POLICY IF EXISTS "Authenticated users can manage designs" ON public.project_designs;
CREATE POLICY "Authenticated users can view designs"
  ON public.project_designs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage designs"
  ON public.project_designs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS designs_updated_at ON public.project_designs;
CREATE TRIGGER designs_updated_at BEFORE UPDATE ON public.project_designs
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ─── 9. TABLA project_materials ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_materials (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  description text        NOT NULL,
  category    text,
  quantity    numeric     NOT NULL DEFAULT 1,
  unit        text,
  notes       text,
  status      text        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','requested','purchased','received','used')),
  created_by  uuid        REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS materials_project_id_idx ON public.project_materials (project_id);

ALTER TABLE public.project_materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view materials"   ON public.project_materials;
DROP POLICY IF EXISTS "Authenticated users can manage materials" ON public.project_materials;
CREATE POLICY "Authenticated users can view materials"
  ON public.project_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage materials"
  ON public.project_materials FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS materials_updated_at ON public.project_materials;
CREATE TRIGGER materials_updated_at BEFORE UPDATE ON public.project_materials
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ─── 10. STORAGE BUCKET project-files ────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-files', 'project-files', false, 52428800,
  ARRAY['image/png','image/jpeg','image/webp','application/pdf','image/svg+xml','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Auth upload project files"  ON storage.objects;
DROP POLICY IF EXISTS "Auth read project files"    ON storage.objects;
DROP POLICY IF EXISTS "Auth delete project files"  ON storage.objects;
CREATE POLICY "Auth upload project files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-files');
CREATE POLICY "Auth read project files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-files');
CREATE POLICY "Auth delete project files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-files');

-- ─── 11. RPC: create_quote_with_items (actualizado) ──────────
CREATE OR REPLACE FUNCTION public.create_quote_with_items(
  quote_data  jsonb,
  items_data  jsonb,
  terms_data  jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_quote_id uuid;
  v_item     jsonb;
  v_term     jsonb;
  v_sort     integer := 0;
  v_tsort    integer := 0;
BEGIN
  INSERT INTO public.quotes (
    client_id, title, status, issue_date, valid_until,
    subtotal, discount, tax, total,
    initial_payment_percentage, initial_payment_amount,
    final_payment_percentage, final_payment_amount,
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
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(quote_data->'terms')), ARRAY[]::text[]),
    quote_data->>'notes',
    quote_data->>'project_type',
    quote_data->>'responsible_architect_name',
    (quote_data->>'responsible_architect_id')::uuid,
    auth.uid()
  )
  RETURNING id INTO v_quote_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(items_data) LOOP
    INSERT INTO public.quote_items (
      quote_id, description, height, width, depth, measurement_notes,
      quantity, unit_price, line_total, sort_order
    ) VALUES (
      v_quote_id, v_item->>'description',
      (v_item->>'height')::numeric, (v_item->>'width')::numeric,
      (v_item->>'depth')::numeric, v_item->>'measurement_notes',
      COALESCE((v_item->>'quantity')::integer, 1),
      COALESCE((v_item->>'unit_price')::numeric, 0),
      COALESCE((v_item->>'line_total')::numeric, 0), v_sort
    );
    v_sort := v_sort + 1;
  END LOOP;

  FOR v_term IN SELECT * FROM jsonb_array_elements(terms_data) LOOP
    INSERT INTO public.quote_payment_terms (
      quote_id, installment_number, concept, percentage, amount, due_date, sort_order
    ) VALUES (
      v_quote_id,
      COALESCE((v_term->>'installment_number')::integer, v_tsort + 1),
      v_term->>'concept',
      (v_term->>'percentage')::numeric,
      (v_term->>'amount')::numeric,
      (v_term->>'due_date')::date,
      v_tsort
    );
    v_tsort := v_tsort + 1;
  END LOOP;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', v_quote_id, 'created', quote_data);

  RETURN v_quote_id;
END; $$;

-- ─── 12. RPC: update_quote_with_items (actualizado) ──────────
CREATE OR REPLACE FUNCTION public.update_quote_with_items(
  p_quote_id  uuid,
  quote_data  jsonb,
  items_data  jsonb,
  terms_data  jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_item  jsonb;
  v_term  jsonb;
  v_sort  integer := 0;
  v_tsort integer := 0;
BEGIN
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
    includes   = COALESCE(ARRAY(SELECT jsonb_array_elements_text(quote_data->'includes')), includes),
    excludes   = COALESCE(ARRAY(SELECT jsonb_array_elements_text(quote_data->'excludes')), excludes),
    terms      = COALESCE(ARRAY(SELECT jsonb_array_elements_text(quote_data->'terms')), terms),
    notes      = quote_data->>'notes',
    project_type                = COALESCE(quote_data->>'project_type', project_type),
    responsible_architect_name  = COALESCE(quote_data->>'responsible_architect_name', responsible_architect_name),
    updated_at = now()
  WHERE id = p_quote_id;

  DELETE FROM public.quote_items WHERE quote_id = p_quote_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(items_data) LOOP
    INSERT INTO public.quote_items (
      quote_id, description, height, width, depth, measurement_notes,
      quantity, unit_price, line_total, sort_order
    ) VALUES (
      p_quote_id, v_item->>'description',
      (v_item->>'height')::numeric, (v_item->>'width')::numeric,
      (v_item->>'depth')::numeric, v_item->>'measurement_notes',
      COALESCE((v_item->>'quantity')::integer, 1),
      COALESCE((v_item->>'unit_price')::numeric, 0),
      COALESCE((v_item->>'line_total')::numeric, 0), v_sort
    );
    v_sort := v_sort + 1;
  END LOOP;

  DELETE FROM public.quote_payment_terms WHERE quote_id = p_quote_id;
  FOR v_term IN SELECT * FROM jsonb_array_elements(terms_data) LOOP
    INSERT INTO public.quote_payment_terms (
      quote_id, installment_number, concept, percentage, amount, due_date, sort_order
    ) VALUES (
      p_quote_id,
      COALESCE((v_term->>'installment_number')::integer, v_tsort + 1),
      v_term->>'concept',
      (v_term->>'percentage')::numeric,
      (v_term->>'amount')::numeric,
      (v_term->>'due_date')::date,
      v_tsort
    );
    v_tsort := v_tsort + 1;
  END LOOP;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'updated', quote_data);

  RETURN p_quote_id;
END; $$;

-- ─── 13. RPC: send_quote_to_review ───────────────────────────
CREATE OR REPLACE FUNCTION public.send_quote_to_review(p_quote_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.quotes SET status = 'review', updated_at = now()
  WHERE id = p_quote_id AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found or not in draft status';
  END IF;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'review', '{}');
END; $$;

-- ─── 14. RPC: approve_quote ──────────────────────────────────
-- Transaccional: aprueba + crea proyecto + crea receivables + activity_log
CREATE OR REPLACE FUNCTION public.approve_quote(p_quote_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_quote           public.quotes%ROWTYPE;
  v_project_id      uuid;
  v_project_number  bigint;
  v_contract_id     uuid;
  v_contract_number bigint;
  v_term            RECORD;
BEGIN
  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quote not found'; END IF;
  IF v_quote.status != 'review' THEN
    RAISE EXCEPTION 'Quote must be in review status to approve (current: %)', v_quote.status;
  END IF;
  IF EXISTS (SELECT 1 FROM public.projects WHERE quote_id = p_quote_id) THEN
    RAISE EXCEPTION 'A project already exists for this quote';
  END IF;

  -- Aprobar cotización
  UPDATE public.quotes SET status = 'approved', approved_at = now(), updated_at = now()
  WHERE id = p_quote_id;

  -- Crear proyecto
  INSERT INTO public.projects (
    client_id, quote_id, name, project_type,
    responsible_architect_name, responsible_architect_id,
    total_amount, status, created_by
  ) VALUES (
    v_quote.client_id, p_quote_id,
    COALESCE(NULLIF(v_quote.title, ''), 'Proyecto ' || to_char(now(), 'YYYY-MM-DD')),
    v_quote.project_type,
    v_quote.responsible_architect_name,
    v_quote.responsible_architect_id,
    v_quote.total, 'planning', auth.uid()
  )
  RETURNING id, project_number INTO v_project_id, v_project_number;

  -- Crear contrato
  INSERT INTO public.contracts (
    project_id, client_id, quote_id, total_amount, terms, status, contract_date, created_by
  ) VALUES (
    v_project_id, v_quote.client_id, p_quote_id,
    v_quote.total, v_quote.terms, 'draft', CURRENT_DATE, auth.uid()
  )
  RETURNING id, contract_number INTO v_contract_id, v_contract_number;

  -- Crear cuentas por cobrar desde payment_terms (si existen) o fallback 80/20
  IF EXISTS (SELECT 1 FROM public.quote_payment_terms WHERE quote_id = p_quote_id) THEN
    FOR v_term IN
      SELECT * FROM public.quote_payment_terms WHERE quote_id = p_quote_id ORDER BY sort_order
    LOOP
      INSERT INTO public.receivables (
        project_id, client_id, quote_id, concept,
        installment_number, percentage, amount, due_date, status
      ) VALUES (
        v_project_id, v_quote.client_id, p_quote_id,
        v_term.concept, v_term.installment_number,
        v_term.percentage,
        COALESCE(v_term.amount, v_quote.total * COALESCE(v_term.percentage, 0) / 100),
        v_term.due_date, 'pending'
      );
    END LOOP;
  ELSE
    INSERT INTO public.receivables
      (project_id, client_id, quote_id, concept, installment_number, percentage, amount, status)
    VALUES
      (v_project_id, v_quote.client_id, p_quote_id, 'Anticipo', 1,
       v_quote.initial_payment_percentage, v_quote.initial_payment_amount, 'pending'),
      (v_project_id, v_quote.client_id, p_quote_id, 'Saldo final', 2,
       v_quote.final_payment_percentage, v_quote.final_payment_amount, 'pending');
  END IF;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata) VALUES
    (auth.uid(), 'quote',   p_quote_id,    'approved',
     jsonb_build_object('project_id', v_project_id, 'project_number', v_project_number)),
    (auth.uid(), 'project', v_project_id,  'created',
     jsonb_build_object('quote_id', p_quote_id, 'amount', v_quote.total, 'project_number', v_project_number));

  RETURN jsonb_build_object(
    'project_id',      v_project_id,
    'project_number',  v_project_number,
    'contract_id',     v_contract_id,
    'contract_number', v_contract_number
  );
END; $$;

-- ─── 15. RPC: reject_quote ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_quote(
  p_quote_id         uuid,
  p_rejection_reason text DEFAULT NULL,
  p_rejection_notes  text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.quotes SET
    status           = 'rejected',
    rejected_at      = now(),
    rejection_reason = p_rejection_reason,
    rejection_notes  = p_rejection_notes,
    updated_at       = now()
  WHERE id = p_quote_id AND status = 'review';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found or not in review status';
  END IF;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'rejected',
    jsonb_build_object('reason', p_rejection_reason, 'notes', p_rejection_notes));
END; $$;

-- ─── 16. RPC: update_quote_status (reopen to draft) ─────────
CREATE OR REPLACE FUNCTION public.update_quote_status(
  p_quote_id         uuid,
  p_status           text,
  p_rejection_reason text DEFAULT NULL,
  p_rejection_notes  text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN ('draft','review','approved','rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;
  UPDATE public.quotes SET
    status           = p_status,
    approved_at      = CASE WHEN p_status = 'approved' THEN now() ELSE approved_at END,
    rejected_at      = CASE WHEN p_status = 'rejected' THEN now() ELSE rejected_at END,
    rejection_reason = CASE WHEN p_status = 'rejected' THEN p_rejection_reason ELSE rejection_reason END,
    rejection_notes  = CASE WHEN p_status = 'rejected' THEN p_rejection_notes  ELSE rejection_notes  END,
    updated_at       = now()
  WHERE id = p_quote_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, p_status,
    jsonb_build_object('reason', p_rejection_reason, 'notes', p_rejection_notes));
END; $$;

-- ─── 17. RPC: update_project_status (con nuevos estados) ─────
CREATE OR REPLACE FUNCTION public.update_project_status(p_project_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN (
    'planning','design','design_approval','materials',
    'production','installation','completed','cancelled'
  ) THEN RAISE EXCEPTION 'Invalid project status: %', p_status; END IF;

  UPDATE public.projects SET status = p_status, updated_at = now() WHERE id = p_project_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'project', p_project_id, 'status_changed',
    jsonb_build_object('new_status', p_status));
END; $$;

-- ─── 18. RPC: finalize_project ───────────────────────────────
CREATE OR REPLACE FUNCTION public.finalize_project(p_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.projects SET
    status          = 'completed',
    completion_date = CURRENT_DATE,
    updated_at      = now()
  WHERE id = p_project_id AND status != 'completed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or already completed';
  END IF;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'project', p_project_id, 'completed',
    jsonb_build_object('completion_date', CURRENT_DATE));
END; $$;

-- ─── 19. RPC: update_contract_status ─────────────────────────
CREATE OR REPLACE FUNCTION public.update_contract_status(p_contract_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN ('draft','pending_signature','signed','completed','cancelled') THEN
    RAISE EXCEPTION 'Invalid contract status: %', p_status;
  END IF;
  UPDATE public.contracts SET
    status     = p_status,
    signed_at  = CASE WHEN p_status = 'signed' THEN now() ELSE signed_at END,
    updated_at = now()
  WHERE id = p_contract_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'contract', p_contract_id, p_status, jsonb_build_object('status', p_status));
END; $$;

-- ─── 20. RPC: register_receivable_payment ────────────────────
CREATE OR REPLACE FUNCTION public.register_receivable_payment(
  p_receivable_id  uuid,
  p_amount         numeric,
  p_payment_date   date,
  p_payment_method text DEFAULT NULL,
  p_reference      text DEFAULT NULL,
  p_notes          text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_rec        public.receivables%ROWTYPE;
  v_new_paid   numeric;
  v_new_status text;
  v_payment_id uuid;
  v_balance    numeric;
BEGIN
  SELECT * INTO v_rec FROM public.receivables WHERE id = p_receivable_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Receivable not found'; END IF;
  IF v_rec.status IN ('paid','cancelled') THEN
    RAISE EXCEPTION 'This receivable is already %', v_rec.status;
  END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero'; END IF;
  v_balance := v_rec.amount - v_rec.paid_amount;
  IF p_amount > v_balance THEN
    RAISE EXCEPTION 'Payment amount (%) exceeds pending balance (%)', p_amount, v_balance;
  END IF;

  INSERT INTO public.payments_received
    (receivable_id, project_id, client_id, amount, payment_date, payment_method, reference, notes, created_by)
  VALUES
    (p_receivable_id, v_rec.project_id, v_rec.client_id,
     p_amount, p_payment_date, p_payment_method, p_reference, p_notes, auth.uid())
  RETURNING id INTO v_payment_id;

  v_new_paid   := v_rec.paid_amount + p_amount;
  v_new_status := CASE
    WHEN v_new_paid >= v_rec.amount THEN 'paid'
    WHEN v_new_paid > 0             THEN 'partial'
    ELSE 'pending'
  END;

  UPDATE public.receivables SET
    paid_amount = v_new_paid,
    status      = v_new_status,
    paid_at     = CASE WHEN v_new_status = 'paid' THEN now() ELSE paid_at END,
    updated_at  = now()
  WHERE id = p_receivable_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'payment', v_payment_id, 'received',
    jsonb_build_object(
      'receivable_id', p_receivable_id,
      'project_id',    v_rec.project_id,
      'amount',        p_amount,
      'new_status',    v_new_status
    ));

  RETURN jsonb_build_object(
    'payment_id',      v_payment_id,
    'new_paid_amount', v_new_paid,
    'new_status',      v_new_status,
    'remaining',       v_rec.amount - v_new_paid
  );
END; $$;

-- ─── 21. RPC: approve_design_by_architect ────────────────────
CREATE OR REPLACE FUNCTION public.approve_design_by_architect(p_design_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.project_designs SET
    status                = 'architect_approved',
    architect_approved_at = now(),
    architect_approved_by = auth.uid(),
    updated_at            = now()
  WHERE id = p_design_id AND status IN ('draft', 'rejected');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Design not found or cannot be approved in its current status';
  END IF;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'design', p_design_id, 'architect_approved', '{}');
END; $$;

-- ─── 22. RPC: approve_design_by_client ───────────────────────
CREATE OR REPLACE FUNCTION public.approve_design_by_client(
  p_design_id   uuid,
  p_client_name text DEFAULT NULL,
  p_notes       text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.project_designs SET
    status                = 'client_approved',
    client_approved_at    = now(),
    client_signer_name    = p_client_name,
    client_approval_notes = p_notes,
    updated_at            = now()
  WHERE id = p_design_id AND status = 'architect_approved';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Design must be architect-approved before client approval';
  END IF;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'design', p_design_id, 'client_approved',
    jsonb_build_object('client_name', p_client_name, 'notes', p_notes));
END; $$;

-- ─── 23. RPC: reject_design ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_design(p_design_id uuid, p_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.project_designs SET
    status     = 'rejected',
    notes      = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE id = p_design_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Design not found'; END IF;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'design', p_design_id, 'rejected',
    jsonb_build_object('notes', p_notes));
END; $$;

-- ─── FIN ─────────────────────────────────────────────────────
