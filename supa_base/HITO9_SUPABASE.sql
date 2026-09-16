-- ================================================================
-- HITO9_SUPABASE.sql
-- MYD3000 ADMIN — CRUD Total: Proveedores + Duplicar Cotización +
--                 Cuentas manuales + Contratos manuales
--
-- Ejecutar DESPUÉS de HITO8_SUPABASE.sql
-- Seguro: idempotente, sin DROP TABLE, sin TRUNCATE
-- ================================================================

-- ─── SUPPLIERS (nueva tabla) ─────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.supplier_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.suppliers (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_number  bigint      UNIQUE NOT NULL DEFAULT nextval('public.supplier_number_seq'),
  company_name     text        NOT NULL,
  contact_name     text,
  document_number  text,
  phone            text,
  email            text,
  address          text,
  category         text,
  notes            text,
  status           text        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active','inactive')),
  archived_at      timestamptz,
  archived_by      uuid        REFERENCES auth.users(id),
  created_by       uuid        REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS suppliers_company_name_idx ON public.suppliers (company_name);
CREATE INDEX IF NOT EXISTS suppliers_archived_at_idx  ON public.suppliers (archived_at);

DROP TRIGGER IF EXISTS suppliers_updated_at ON public.suppliers;
CREATE TRIGGER suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read suppliers"   ON public.suppliers;
CREATE POLICY "Authenticated users can read suppliers"
  ON public.suppliers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage suppliers" ON public.suppliers;
CREATE POLICY "Authenticated users can manage suppliers"
  ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── FK SUPPLIER → PAYABLES (nullable) ──────────────────────────
ALTER TABLE public.payables
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id);

-- ─── RPC: archive_supplier / restore_supplier ────────────────────
CREATE OR REPLACE FUNCTION public.archive_supplier(p_supplier_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.suppliers
  SET archived_at = now(), archived_by = auth.uid()
  WHERE id = p_supplier_id AND archived_at IS NULL;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'supplier', p_supplier_id::text, 'archived', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_supplier(p_supplier_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.suppliers
  SET archived_at = NULL, archived_by = NULL
  WHERE id = p_supplier_id AND archived_at IS NOT NULL;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'supplier', p_supplier_id::text, 'restored', '{}'::jsonb);
END;
$$;

-- ─── RPC: duplicate_quote ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.duplicate_quote(p_quote_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_src       record;
  v_new_id    uuid;
BEGIN
  SELECT * INTO v_src FROM public.quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quote not found'; END IF;

  INSERT INTO public.quotes (
    client_id, title, issue_date, valid_until, project_type,
    responsible_architect_name, responsible_architect_id,
    subtotal, discount, tax, total,
    initial_payment_percentage, initial_payment_amount,
    final_payment_percentage, final_payment_amount,
    includes, excludes, terms, notes,
    status, created_by
  )
  VALUES (
    v_src.client_id, v_src.title,
    current_date, NULL, v_src.project_type,
    v_src.responsible_architect_name, v_src.responsible_architect_id,
    v_src.subtotal, v_src.discount, v_src.tax, v_src.total,
    v_src.initial_payment_percentage, v_src.initial_payment_amount,
    v_src.final_payment_percentage, v_src.final_payment_amount,
    v_src.includes, v_src.excludes, v_src.terms, v_src.notes,
    'draft', auth.uid()
  )
  RETURNING id INTO v_new_id;

  -- Copy items
  INSERT INTO public.quote_items (
    quote_id, description, height, width, depth, measurement_notes,
    quantity, unit_price, line_total, sort_order
  )
  SELECT v_new_id, description, height, width, depth, measurement_notes,
         quantity, unit_price, line_total, sort_order
  FROM   public.quote_items WHERE quote_id = p_quote_id;

  -- Copy payment terms
  INSERT INTO public.quote_payment_terms (
    quote_id, installment_number, concept, percentage, amount,
    due_condition, due_date, sort_order
  )
  SELECT v_new_id, installment_number, concept, percentage, amount,
         due_condition, NULL, sort_order
  FROM   public.quote_payment_terms WHERE quote_id = p_quote_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', v_new_id::text, 'created',
          jsonb_build_object('duplicated_from', p_quote_id));

  RETURN v_new_id;
END;
$$;

-- ─── RPC: create_receivable_manual ───────────────────────────────
CREATE OR REPLACE FUNCTION public.create_receivable_manual(
  p_client_id    uuid,
  p_project_id   uuid     DEFAULT NULL,
  p_concept      text     DEFAULT 'Pago',
  p_amount       numeric  DEFAULT 0,
  p_due_date     date     DEFAULT NULL,
  p_notes        text     DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.receivables (
    client_id, project_id, concept, amount, due_date, notes, status, paid_amount
  )
  VALUES (p_client_id, p_project_id, p_concept, p_amount, p_due_date, p_notes, 'pending', 0)
  RETURNING id INTO v_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'receivable', v_id::text, 'created',
          jsonb_build_object('origin', 'manual'));
  RETURN v_id;
END;
$$;

-- ─── RPC: update_receivable_fields ───────────────────────────────
CREATE OR REPLACE FUNCTION public.update_receivable_fields(
  p_receivable_id uuid,
  p_concept       text     DEFAULT NULL,
  p_due_date      date     DEFAULT NULL,
  p_notes         text     DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.receivables
  SET concept   = COALESCE(p_concept, concept),
      due_date  = p_due_date,
      notes     = p_notes,
      updated_at = now()
  WHERE id = p_receivable_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'receivable', p_receivable_id::text, 'updated', '{}'::jsonb);
END;
$$;

-- ─── RPC: create_contract_manual ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_contract_manual(
  p_client_id      uuid,
  p_project_id     uuid     DEFAULT NULL,
  p_quote_id       uuid     DEFAULT NULL,
  p_contract_date  date     DEFAULT NULL,
  p_total_amount   numeric  DEFAULT NULL,
  p_status         text     DEFAULT 'draft',
  p_terms          text[]   DEFAULT '{}',
  p_notes          text     DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.contracts (
    client_id, project_id, quote_id, contract_date,
    total_amount, status, terms, notes, created_by
  )
  VALUES (
    p_client_id, p_project_id, p_quote_id, p_contract_date,
    p_total_amount, p_status, p_terms, p_notes, auth.uid()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'contract', v_id::text, 'created',
          jsonb_build_object('origin', 'manual'));
  RETURN v_id;
END;
$$;

-- ─── RPC: update_contract_fields ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_contract_fields(
  p_contract_id    uuid,
  p_contract_date  date     DEFAULT NULL,
  p_total_amount   numeric  DEFAULT NULL,
  p_status         text     DEFAULT NULL,
  p_terms          text[]   DEFAULT NULL,
  p_notes          text     DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.contracts
  SET contract_date = COALESCE(p_contract_date, contract_date),
      total_amount  = COALESCE(p_total_amount, total_amount),
      status        = COALESCE(p_status, status),
      terms         = COALESCE(p_terms, terms),
      notes         = p_notes,
      updated_at    = now()
  WHERE id = p_contract_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'contract', p_contract_id::text, 'updated', '{}'::jsonb);
END;
$$;

-- ─── VERIFICACIÓN ────────────────────────────────────────────────
SELECT 'suppliers' AS tabla, COUNT(*) FROM public.suppliers;
