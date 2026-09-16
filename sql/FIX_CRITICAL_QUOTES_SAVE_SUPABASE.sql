-- ================================================================
-- FIX CRÍTICO — COTIZACIONES: GUARDAR
-- Fecha: 2026-09-10
-- Tipo: INCREMENTAL — NO DESTRUCTIVO
--
-- CAUSAS RAÍZ CONFIRMADAS:
--   1. quotes.responsible_architect_name  → columna FALTANTE
--   2. quotes.responsible_architect_id    → columna FALTANTE
--   3. quotes.archived_at / archived_by   → columnas FALTANTES
--   4. quotes.submitted_by / submitted_at → columnas FALTANTES
--   5. quotes.approved_by / rejected_by   → columnas FALTANTES
--   6. status CHECK tiene 'sent' en vez de 'review'
--   7. quote_payment_terms                → tabla INEXISTENTE
--
-- EFECTO: RPC create_quote_with_items falla al ejecutarse porque:
--   a. Intenta INSERT responsible_architect_name → columna no existe
--   b. Intenta INSERT en quote_payment_terms → tabla no existe
--
-- ESTE ARCHIVO:
--   • Añade columnas faltantes a quotes (ADD COLUMN IF NOT EXISTS)
--   • Corrige constraint de status (drop/recreate idempotente)
--   • Crea quote_payment_terms con RLS
--   • Recrea RPCs completas para cotizaciones
--   • NO hace DROP TABLE, TRUNCATE ni DELETE
-- ================================================================

BEGIN;

-- ================================================================
-- 1. COLUMNAS FALTANTES EN quotes
-- ================================================================

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS responsible_architect_name text,
  ADD COLUMN IF NOT EXISTS responsible_architect_id   uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archived_at                timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by                uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS submitted_by               uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS submitted_at               timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by                uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejected_by                uuid REFERENCES auth.users(id);

-- ================================================================
-- 2. CORREGIR CONSTRAINT DE STATUS
--    Original tenía 'sent' — el frontend usa 'review'
-- ================================================================

-- Drop cualquier constraint de status existente
DO $$
DECLARE v_con text;
BEGIN
  SELECT conname INTO v_con
  FROM   pg_constraint
  WHERE  conrelid = 'public.quotes'::regclass
    AND  contype  = 'c'
    AND  pg_get_constraintdef(oid) ILIKE '%status%'
  LIMIT 1;

  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.quotes DROP CONSTRAINT %I', v_con);
    RAISE NOTICE 'Dropped status constraint: %', v_con;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'No status constraint to drop: %', SQLERRM;
END $$;

-- Recrear con valores correctos
DO $$
BEGIN
  ALTER TABLE public.quotes
    ADD CONSTRAINT quotes_status_check
    CHECK (status IN ('draft','review','approved','rejected'));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'quotes_status_check already exists with correct values';
END $$;

-- ================================================================
-- 3. QUOTE_PAYMENT_TERMS — crear si no existe
-- ================================================================

CREATE TABLE IF NOT EXISTS public.quote_payment_terms (
  id                 uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id           uuid    NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  concept            text    NOT NULL,
  percentage         numeric(5,2),
  amount             numeric(14,2),
  due_condition      text,
  due_date           date,
  sort_order         integer NOT NULL DEFAULT 0,
  created_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_payment_terms_quote_id_idx
  ON public.quote_payment_terms (quote_id);

ALTER TABLE public.quote_payment_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view quote payment terms"   ON public.quote_payment_terms;
CREATE POLICY "Authenticated users can view quote payment terms"
  ON public.quote_payment_terms FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage quote payment terms" ON public.quote_payment_terms;
CREATE POLICY "Authenticated users can manage quote payment terms"
  ON public.quote_payment_terms FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ================================================================
-- 4. INDEXES ÚTILES EN quotes
-- ================================================================

CREATE INDEX IF NOT EXISTS quotes_archived_at_idx ON public.quotes (archived_at);
CREATE INDEX IF NOT EXISTS quotes_created_at_idx  ON public.quotes (created_at DESC);

-- ================================================================
-- 5. RPC: create_quote_with_items
--    Crea quote + items + payment_terms en una transacción
-- ================================================================

CREATE OR REPLACE FUNCTION public.create_quote_with_items(
  quote_data jsonb,
  items_data jsonb,
  terms_data jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_quote_id uuid;
  v_item     jsonb;
  v_term     jsonb;
  v_sort     integer := 0;
BEGIN
  INSERT INTO public.quotes (
    client_id, title, status, issue_date, valid_until,
    subtotal, discount, tax, total,
    initial_payment_percentage, initial_payment_amount,
    final_payment_percentage,   final_payment_amount,
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
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(quote_data->'terms')),    ARRAY[]::text[]),
    quote_data->>'notes',
    quote_data->>'project_type',
    quote_data->>'responsible_architect_name',
    (quote_data->>'responsible_architect_id')::uuid,
    auth.uid()
  ) RETURNING id INTO v_quote_id;

  -- Insert items
  FOR v_item IN SELECT * FROM jsonb_array_elements(items_data) LOOP
    INSERT INTO public.quote_items (
      quote_id, description, height, width, depth, measurement_notes,
      quantity, unit_price, line_total, sort_order
    ) VALUES (
      v_quote_id,
      v_item->>'description',
      (v_item->>'height')::numeric,
      (v_item->>'width')::numeric,
      (v_item->>'depth')::numeric,
      v_item->>'measurement_notes',
      COALESCE((v_item->>'quantity')::integer, 1),
      COALESCE((v_item->>'unit_price')::numeric, 0),
      COALESCE((v_item->>'line_total')::numeric, 0),
      v_sort
    );
    v_sort := v_sort + 1;
  END LOOP;

  -- Insert payment terms
  v_sort := 0;
  FOR v_term IN SELECT * FROM jsonb_array_elements(terms_data) LOOP
    INSERT INTO public.quote_payment_terms (
      quote_id, installment_number, concept, percentage, amount,
      due_condition, due_date, sort_order
    ) VALUES (
      v_quote_id,
      COALESCE((v_term->>'installment_number')::integer, v_sort + 1),
      COALESCE(v_term->>'concept', 'Cuota'),
      (v_term->>'percentage')::numeric,
      (v_term->>'amount')::numeric,
      v_term->>'due_condition',
      (v_term->>'due_date')::date,
      v_sort
    );
    v_sort := v_sort + 1;
  END LOOP;

  -- Activity log
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', v_quote_id, 'created',
    jsonb_build_object('total', quote_data->>'total', 'client_id', quote_data->>'client_id'));

  RETURN v_quote_id;
END;
$$;

-- ================================================================
-- 6. RPC: update_quote_with_items
-- ================================================================

CREATE OR REPLACE FUNCTION public.update_quote_with_items(
  p_quote_id uuid,
  quote_data jsonb,
  items_data jsonb,
  terms_data jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_item jsonb;
  v_term jsonb;
  v_sort integer := 0;
BEGIN
  UPDATE public.quotes SET
    client_id                  = COALESCE((quote_data->>'client_id')::uuid, client_id),
    title                      = quote_data->>'title',
    issue_date                 = COALESCE((quote_data->>'issue_date')::date, issue_date),
    valid_until                = (quote_data->>'valid_until')::date,
    subtotal                   = COALESCE((quote_data->>'subtotal')::numeric,  subtotal),
    discount                   = COALESCE((quote_data->>'discount')::numeric,  discount),
    tax                        = COALESCE((quote_data->>'tax')::numeric,       tax),
    total                      = COALESCE((quote_data->>'total')::numeric,     total),
    initial_payment_percentage = COALESCE((quote_data->>'initial_payment_percentage')::numeric, initial_payment_percentage),
    initial_payment_amount     = COALESCE((quote_data->>'initial_payment_amount')::numeric,     initial_payment_amount),
    final_payment_percentage   = COALESCE((quote_data->>'final_payment_percentage')::numeric,   final_payment_percentage),
    final_payment_amount       = COALESCE((quote_data->>'final_payment_amount')::numeric,       final_payment_amount),
    includes = COALESCE(ARRAY(SELECT jsonb_array_elements_text(quote_data->'includes')), includes),
    excludes = COALESCE(ARRAY(SELECT jsonb_array_elements_text(quote_data->'excludes')), excludes),
    terms    = COALESCE(ARRAY(SELECT jsonb_array_elements_text(quote_data->'terms')),    terms),
    notes                      = quote_data->>'notes',
    project_type               = COALESCE(quote_data->>'project_type', project_type),
    responsible_architect_name = quote_data->>'responsible_architect_name',
    responsible_architect_id   = (quote_data->>'responsible_architect_id')::uuid,
    updated_at                 = now()
  WHERE id = p_quote_id;

  -- Replace items
  DELETE FROM public.quote_items WHERE quote_id = p_quote_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(items_data) LOOP
    INSERT INTO public.quote_items (
      quote_id, description, height, width, depth, measurement_notes,
      quantity, unit_price, line_total, sort_order
    ) VALUES (
      p_quote_id,
      v_item->>'description',
      (v_item->>'height')::numeric,
      (v_item->>'width')::numeric,
      (v_item->>'depth')::numeric,
      v_item->>'measurement_notes',
      COALESCE((v_item->>'quantity')::integer, 1),
      COALESCE((v_item->>'unit_price')::numeric, 0),
      COALESCE((v_item->>'line_total')::numeric, 0),
      v_sort
    );
    v_sort := v_sort + 1;
  END LOOP;

  -- Replace payment terms
  DELETE FROM public.quote_payment_terms WHERE quote_id = p_quote_id;
  v_sort := 0;
  FOR v_term IN SELECT * FROM jsonb_array_elements(terms_data) LOOP
    INSERT INTO public.quote_payment_terms (
      quote_id, installment_number, concept, percentage, amount,
      due_condition, due_date, sort_order
    ) VALUES (
      p_quote_id,
      COALESCE((v_term->>'installment_number')::integer, v_sort + 1),
      COALESCE(v_term->>'concept', 'Cuota'),
      (v_term->>'percentage')::numeric,
      (v_term->>'amount')::numeric,
      v_term->>'due_condition',
      (v_term->>'due_date')::date,
      v_sort
    );
    v_sort := v_sort + 1;
  END LOOP;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'updated',
    jsonb_build_object('total', quote_data->>'total'));

  RETURN p_quote_id;
END;
$$;

-- ================================================================
-- 7. RPC: send_quote_to_review
-- ================================================================

CREATE OR REPLACE FUNCTION public.send_quote_to_review(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.quotes WHERE id = p_quote_id AND status = 'draft') THEN
    RAISE EXCEPTION 'Solo se puede enviar a revisión un borrador.';
  END IF;
  UPDATE public.quotes SET
    status       = 'review',
    submitted_by = auth.uid(),
    submitted_at = now(),
    updated_at   = now()
  WHERE id = p_quote_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'review', jsonb_build_object('new_status', 'review'));
END;
$$;

-- ================================================================
-- 8. RPC: reject_quote
-- ================================================================

CREATE OR REPLACE FUNCTION public.reject_quote(
  p_quote_id         uuid,
  p_rejection_reason text DEFAULT NULL,
  p_rejection_notes  text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.quotes SET
    status           = 'rejected',
    rejected_by      = auth.uid(),
    rejected_at      = now(),
    rejection_reason = p_rejection_reason,
    rejection_notes  = p_rejection_notes,
    updated_at       = now()
  WHERE id = p_quote_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'rejected',
    jsonb_build_object('reason', p_rejection_reason, 'notes', p_rejection_notes));
END;
$$;

-- ================================================================
-- 9. RPC: update_quote_status (genérico)
-- ================================================================

CREATE OR REPLACE FUNCTION public.update_quote_status(
  p_quote_id         uuid,
  p_status           text,
  p_rejection_reason text DEFAULT NULL,
  p_rejection_notes  text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN ('draft','review','approved','rejected') THEN
    RAISE EXCEPTION 'Estado inválido: %', p_status;
  END IF;
  UPDATE public.quotes SET
    status           = p_status,
    approved_at      = CASE WHEN p_status = 'approved' THEN now() ELSE approved_at      END,
    approved_by      = CASE WHEN p_status = 'approved' THEN auth.uid() ELSE approved_by END,
    rejected_at      = CASE WHEN p_status = 'rejected' THEN now() ELSE rejected_at      END,
    rejected_by      = CASE WHEN p_status = 'rejected' THEN auth.uid() ELSE rejected_by END,
    rejection_reason = CASE WHEN p_status = 'rejected' THEN p_rejection_reason ELSE rejection_reason END,
    rejection_notes  = CASE WHEN p_status = 'rejected' THEN p_rejection_notes  ELSE rejection_notes  END,
    updated_at       = now()
  WHERE id = p_quote_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, p_status,
    jsonb_build_object('reason', p_rejection_reason));
END;
$$;

-- ================================================================
-- 10. RPC: archive_quote / restore_quote
-- ================================================================

CREATE OR REPLACE FUNCTION public.archive_quote(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.quotes SET
    archived_at = now(), archived_by = auth.uid(), updated_at = now()
  WHERE id = p_quote_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'archived', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_quote(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.quotes SET
    archived_at = NULL, archived_by = NULL, updated_at = now()
  WHERE id = p_quote_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'restored', '{}'::jsonb);
END;
$$;

-- ================================================================
-- 11. RPC: reopen_quote_to_draft (para rejected → draft)
-- ================================================================

CREATE OR REPLACE FUNCTION public.reopen_quote_to_draft(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.quotes SET
    status      = 'draft',
    updated_at  = now()
  WHERE id = p_quote_id AND status = 'rejected';
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'draft', jsonb_build_object('action', 'reopened_to_draft'));
END;
$$;

-- ================================================================
-- 12. RPC: duplicate_quote
-- ================================================================

CREATE OR REPLACE FUNCTION public.duplicate_quote(p_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_source  public.quotes%ROWTYPE;
  v_new_id  uuid;
  v_item    RECORD;
BEGIN
  SELECT * INTO v_source FROM public.quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;

  INSERT INTO public.quotes (
    client_id, title, status, issue_date,
    subtotal, discount, tax, total,
    initial_payment_percentage, initial_payment_amount,
    final_payment_percentage,   final_payment_amount,
    includes, excludes, terms, notes,
    project_type, responsible_architect_name, responsible_architect_id,
    created_by
  ) VALUES (
    v_source.client_id,
    COALESCE(v_source.title, '') || ' (copia)',
    'draft',
    CURRENT_DATE,
    v_source.subtotal, v_source.discount, v_source.tax, v_source.total,
    v_source.initial_payment_percentage, v_source.initial_payment_amount,
    v_source.final_payment_percentage,   v_source.final_payment_amount,
    v_source.includes, v_source.excludes, v_source.terms, v_source.notes,
    v_source.project_type, v_source.responsible_architect_name, v_source.responsible_architect_id,
    auth.uid()
  ) RETURNING id INTO v_new_id;

  -- Copy items
  FOR v_item IN SELECT * FROM public.quote_items WHERE quote_id = p_quote_id ORDER BY sort_order LOOP
    INSERT INTO public.quote_items (quote_id, description, height, width, depth, measurement_notes, quantity, unit_price, line_total, sort_order)
    VALUES (v_new_id, v_item.description, v_item.height, v_item.width, v_item.depth, v_item.measurement_notes, v_item.quantity, v_item.unit_price, v_item.line_total, v_item.sort_order);
  END LOOP;

  -- Copy payment terms
  FOR v_item IN SELECT * FROM public.quote_payment_terms WHERE quote_id = p_quote_id ORDER BY sort_order LOOP
    INSERT INTO public.quote_payment_terms (quote_id, installment_number, concept, percentage, amount, due_condition, sort_order)
    VALUES (v_new_id, v_item.installment_number, v_item.concept, v_item.percentage, v_item.amount, v_item.due_condition, v_item.sort_order);
  END LOOP;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', v_new_id, 'created', jsonb_build_object('duplicated_from', p_quote_id));

  RETURN v_new_id;
END;
$$;

-- ================================================================
-- 13. RPC: approve_quote
--    NOTA: Requiere tablas projects, contracts, receivables.
--    Si esas tablas NO existen, la aprobación fallará.
--    Incluida aquí para completitud — el fallo será informativo.
-- ================================================================

CREATE OR REPLACE FUNCTION public.approve_quote(p_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_quote           public.quotes%ROWTYPE;
  v_project_id      uuid;
  v_project_number  bigint;
  v_contract_id     uuid;
  v_contract_number bigint;
  v_term            RECORD;
  v_term_count      integer;
BEGIN
  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;
  IF v_quote.status <> 'review' THEN
    RAISE EXCEPTION 'Solo se puede aprobar una cotización en revisión (estado actual: %)', v_quote.status;
  END IF;

  -- Check if projects table exists before trying to use it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'projects'
  ) THEN
    RAISE EXCEPTION 'La tabla projects no existe. Ejecuta el bootstrap completo antes de aprobar cotizaciones.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.projects WHERE quote_id = p_quote_id) THEN
    RAISE EXCEPTION 'Ya existe un proyecto para esta cotización (already exists)';
  END IF;

  UPDATE public.quotes SET
    status      = 'approved',
    approved_by = auth.uid(),
    approved_at = now(),
    updated_at  = now()
  WHERE id = p_quote_id;

  INSERT INTO public.projects (
    client_id, quote_id, name, project_type, total_amount,
    responsible_architect_name, responsible_architect_id, status, created_by
  ) VALUES (
    v_quote.client_id, p_quote_id,
    COALESCE(v_quote.title, 'Proyecto'),
    v_quote.project_type, v_quote.total,
    v_quote.responsible_architect_name, v_quote.responsible_architect_id,
    'planning', auth.uid()
  ) RETURNING id, project_number INTO v_project_id, v_project_number;

  INSERT INTO public.contracts (
    project_id, client_id, quote_id, total_amount, terms, status, contract_date, created_by
  ) VALUES (
    v_project_id, v_quote.client_id, p_quote_id,
    v_quote.total, v_quote.terms, 'draft', CURRENT_DATE, auth.uid()
  ) RETURNING id, contract_number INTO v_contract_id, v_contract_number;

  SELECT COUNT(*) INTO v_term_count FROM public.quote_payment_terms WHERE quote_id = p_quote_id;

  IF v_term_count > 0 THEN
    FOR v_term IN SELECT * FROM public.quote_payment_terms WHERE quote_id = p_quote_id ORDER BY sort_order LOOP
      INSERT INTO public.receivables (
        project_id, client_id, quote_id, concept, installment_number,
        percentage, amount, due_date, status
      ) VALUES (
        v_project_id, v_quote.client_id, p_quote_id,
        v_term.concept, v_term.installment_number, v_term.percentage,
        COALESCE(v_term.amount, (v_term.percentage / 100.0) * v_quote.total),
        v_term.due_date, 'pending'
      );
    END LOOP;
  ELSE
    INSERT INTO public.receivables (
      project_id, client_id, quote_id, concept, installment_number, percentage, amount, status
    ) VALUES
    (v_project_id, v_quote.client_id, p_quote_id, 'Anticipo', 1,
     v_quote.initial_payment_percentage, v_quote.initial_payment_amount, 'pending'),
    (v_project_id, v_quote.client_id, p_quote_id, 'Saldo final', 2,
     v_quote.final_payment_percentage,   v_quote.final_payment_amount,   'pending');
  END IF;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES
    (auth.uid(), 'quote',    p_quote_id,    'approved', jsonb_build_object('project_id', v_project_id)),
    (auth.uid(), 'project',  v_project_id,  'created',  jsonb_build_object('project_number', v_project_number, 'quote_id', p_quote_id)),
    (auth.uid(), 'contract', v_contract_id, 'created',  jsonb_build_object('contract_number', v_contract_number));

  RETURN jsonb_build_object(
    'project_id',      v_project_id,
    'project_number',  v_project_number,
    'contract_id',     v_contract_id,
    'contract_number', v_contract_number
  );
END;
$$;

-- ================================================================
-- 14. POLÍTICAS RLS ADICIONALES (idempotentes)
-- ================================================================

-- Asegurar que authenticated users puedan UPDATE quotes
DROP POLICY IF EXISTS "Authenticated users can update quotes" ON public.quotes;
CREATE POLICY "Authenticated users can update quotes"
  ON public.quotes FOR UPDATE TO authenticated USING (true);

-- ================================================================
-- FIN
-- ================================================================

COMMIT;

-- ================================================================
-- VERIFICACIÓN (ejecutar después del COMMIT)
-- ================================================================
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'quotes' AND table_schema = 'public'
-- ORDER BY ordinal_position;
--
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name = 'quote_payment_terms';
--
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public' AND routine_name IN (
--   'create_quote_with_items','update_quote_with_items',
--   'send_quote_to_review','reject_quote','approve_quote',
--   'archive_quote','restore_quote','duplicate_quote','reopen_quote_to_draft'
-- ) ORDER BY routine_name;
