-- ============================================================
-- MYD3000 ADMIN — BOOTSTRAP DEMO
-- Proyecto Supabase: bxmuuphzcruyewbergqd
-- Ejecutar manualmente en: Supabase SQL Editor
--
-- Alcance: profiles, clients, quotes, quote_items,
--          activity_log, RPC de cotizaciones, perfil admin.
--
-- Seguridad:
--   - NO usa DROP TABLE ni TRUNCATE
--   - NO elimina datos existentes
--   - Usa CREATE TABLE IF NOT EXISTS
--   - Usa CREATE SEQUENCE IF NOT EXISTS
--   - Usa DROP POLICY IF EXISTS + CREATE POLICY
--   - Usa CREATE OR REPLACE FUNCTION
--   - Usa INSERT ... ON CONFLICT para datos semilla
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- BLOQUE 1: FUNCIONES UTILITARIAS
-- ──────────────────────────────────────────────────────────

-- Función compartida que actualiza updated_at antes de cada UPDATE.
-- Usada por todos los triggers de la aplicación.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Función que crea automáticamente un profile cuando se registra
-- un nuevo usuario en auth.users.
-- SECURITY DEFINER: corre con permisos del owner, no del usuario.
-- search_path = '' evita inyección de esquemas.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'operations')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


-- ──────────────────────────────────────────────────────────
-- BLOQUE 2: TABLA profiles
-- ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  role        text        NOT NULL DEFAULT 'operations'
              CHECK (role IN ('administrator', 'administration', 'operations')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Trigger: auto-actualiza updated_at
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Trigger: crea profile al registrar nuevo usuario
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ──────────────────────────────────────────────────────────
-- BLOQUE 3: PERFIL DEL ADMINISTRADOR
-- UID del usuario existente en Supabase Auth.
-- ON CONFLICT garantiza que si el perfil ya existe,
-- solo se actualizan full_name y role (no elimina datos).
-- ──────────────────────────────────────────────────────────

INSERT INTO public.profiles (id, full_name, role)
VALUES (
  '90263f6e-9444-49ca-9086-ad2c1c289bd4',
  'Administrador MYD3000',
  'administrator'
)
ON CONFLICT (id) DO UPDATE
  SET full_name  = EXCLUDED.full_name,
      role       = EXCLUDED.role,
      updated_at = now();


-- ──────────────────────────────────────────────────────────
-- BLOQUE 4: TABLA clients
-- Schema limpio: usa full_name, SIN columna legacy "name".
-- client_number generado desde secuencia PostgreSQL.
-- ──────────────────────────────────────────────────────────

-- Secuencia para CLI-XXXX
CREATE SEQUENCE IF NOT EXISTS public.client_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.clients (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_number   bigint      UNIQUE NOT NULL DEFAULT nextval('public.client_number_seq'),
  full_name       text        NOT NULL,
  document_type   text,
  document_number text,
  phone           text,
  email           text,
  address         text,
  notes           text,
  created_by      uuid        REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_full_name_idx ON public.clients (full_name);

-- RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view clients"   ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can create clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;

CREATE POLICY "Authenticated users can view clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (true);

-- WITH CHECK usa auth.uid() IS NOT NULL para ser compatible
-- con el service actual (created_by: user?.id ?? null).
CREATE POLICY "Authenticated users can create clients"
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update clients"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (true);

-- Trigger: auto-actualiza updated_at
DROP TRIGGER IF EXISTS clients_updated_at ON public.clients;
CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ──────────────────────────────────────────────────────────
-- BLOQUE 5: TABLA quotes
-- Estructura exacta que espera el frontend actual.
-- Verificado contra: src/services/quotes.ts,
-- src/types/index.ts, src/pages/Quotes/QuoteForm.tsx
-- ──────────────────────────────────────────────────────────

-- Secuencia para COT-YYYY-XXXX
CREATE SEQUENCE IF NOT EXISTS public.quotes_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.quotes (
  id                          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number                bigint       UNIQUE NOT NULL DEFAULT nextval('public.quotes_number_seq'),
  client_id                   uuid         NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  title                       text,
  status                      text         NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'sent', 'approved', 'rejected')),
  issue_date                  date         NOT NULL DEFAULT CURRENT_DATE,
  valid_until                 date,
  subtotal                    numeric(14,2) DEFAULT 0,
  discount                    numeric(14,2) DEFAULT 0,
  tax                         numeric(14,2) DEFAULT 0,
  total                       numeric(14,2) DEFAULT 0,
  initial_payment_percentage  numeric(5,2)  DEFAULT 80,
  initial_payment_amount      numeric(14,2) DEFAULT 0,
  final_payment_percentage    numeric(5,2)  DEFAULT 20,
  final_payment_amount        numeric(14,2) DEFAULT 0,
  includes                    text[]        DEFAULT ARRAY[]::text[],
  excludes                    text[]        DEFAULT ARRAY[]::text[],
  terms                       text[]        DEFAULT ARRAY[]::text[],
  notes                       text,
  approved_at                 timestamptz,
  rejected_at                 timestamptz,
  rejection_reason            text,
  rejection_notes             text,
  created_by                  uuid          REFERENCES auth.users(id),
  created_at                  timestamptz   DEFAULT now(),
  updated_at                  timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quotes_client_id_idx ON public.quotes (client_id);
CREATE INDEX IF NOT EXISTS quotes_status_idx    ON public.quotes (status);

-- RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view quotes"   ON public.quotes;
DROP POLICY IF EXISTS "Authenticated users can create quotes" ON public.quotes;
DROP POLICY IF EXISTS "Authenticated users can update quotes" ON public.quotes;

CREATE POLICY "Authenticated users can view quotes"
  ON public.quotes
  FOR SELECT
  TO authenticated
  USING (true);

-- El RPC create_quote_with_items (SECURITY INVOKER) inserta
-- created_by = auth.uid(), por lo que esta policy es compatible.
CREATE POLICY "Authenticated users can create quotes"
  ON public.quotes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update quotes"
  ON public.quotes
  FOR UPDATE
  TO authenticated
  USING (true);

-- Trigger: auto-actualiza updated_at
DROP TRIGGER IF EXISTS quotes_updated_at ON public.quotes;
CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ──────────────────────────────────────────────────────────
-- BLOQUE 6: TABLA quote_items
-- Verificado contra: src/services/quotes.ts (QuoteItemInput),
-- src/pages/Quotes/QuoteForm.tsx (itemsPayload).
-- Campos utilizados: description, height, width, depth,
-- measurement_notes, quantity, unit_price, line_total, sort_order.
-- ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.quote_items (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id            uuid          NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description         text          NOT NULL,
  height              numeric,
  width               numeric,
  depth               numeric,
  measurement_notes   text,
  quantity            integer       NOT NULL DEFAULT 1,
  unit_price          numeric(14,2) NOT NULL DEFAULT 0,
  line_total          numeric(14,2) NOT NULL DEFAULT 0,
  sort_order          integer       DEFAULT 0,
  created_at          timestamptz   DEFAULT now(),
  updated_at          timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_items_quote_id_idx ON public.quote_items (quote_id);

-- RLS
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view quote items"   ON public.quote_items;
DROP POLICY IF EXISTS "Authenticated users can insert quote items" ON public.quote_items;
DROP POLICY IF EXISTS "Authenticated users can update quote items" ON public.quote_items;
DROP POLICY IF EXISTS "Authenticated users can delete quote items" ON public.quote_items;
-- Alias usado en myd3000_setup_complete.sql
DROP POLICY IF EXISTS "Authenticated users can manage quote items" ON public.quote_items;

CREATE POLICY "Authenticated users can view quote items"
  ON public.quote_items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert quote items"
  ON public.quote_items
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update quote items"
  ON public.quote_items
  FOR UPDATE
  TO authenticated
  USING (true);

-- El RPC update_quote_with_items hace DELETE + re-INSERT de items.
CREATE POLICY "Authenticated users can delete quote items"
  ON public.quote_items
  FOR DELETE
  TO authenticated
  USING (true);

-- Trigger: auto-actualiza updated_at
DROP TRIGGER IF EXISTS quote_items_updated_at ON public.quote_items;
CREATE TRIGGER quote_items_updated_at
  BEFORE UPDATE ON public.quote_items
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ──────────────────────────────────────────────────────────
-- BLOQUE 7: TABLA activity_log
-- Requerida por los tres RPC de cotizaciones.
-- Sin ella, create_quote_with_items falla en su último INSERT.
-- ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.activity_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        REFERENCES auth.users(id),
  entity_type  text        NOT NULL,
  entity_id    uuid,
  action       text        NOT NULL,
  metadata     jsonb       DEFAULT '{}',
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_entity_idx    ON public.activity_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON public.activity_log (created_at DESC);

-- RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view activity log"   ON public.activity_log;
DROP POLICY IF EXISTS "Authenticated users can insert activity log" ON public.activity_log;

CREATE POLICY "Authenticated users can view activity log"
  ON public.activity_log
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert activity log"
  ON public.activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- ──────────────────────────────────────────────────────────
-- BLOQUE 8: RPC DE COTIZACIONES
-- Verificado contra: src/services/quotes.ts
--   createQuoteWithItems  → supabase.rpc('create_quote_with_items', ...)
--   updateQuoteWithItems  → supabase.rpc('update_quote_with_items', ...)
--   updateQuoteStatus     → supabase.rpc('update_quote_status', ...)
--
-- SECURITY INVOKER: la RPC corre como el usuario autenticado.
-- Las políticas RLS de quotes / quote_items / activity_log aplican.
-- ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_quote_with_items(
  quote_data jsonb,
  items_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_quote_id   uuid;
  v_item       jsonb;
  v_sort       integer := 0;
BEGIN
  INSERT INTO public.quotes (
    client_id,
    title,
    status,
    issue_date,
    valid_until,
    subtotal,
    discount,
    tax,
    total,
    initial_payment_percentage,
    initial_payment_amount,
    final_payment_percentage,
    final_payment_amount,
    includes,
    excludes,
    terms,
    notes,
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
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(quote_data->'includes')),
      ARRAY[]::text[]
    ),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(quote_data->'excludes')),
      ARRAY[]::text[]
    ),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(quote_data->'terms')),
      ARRAY[]::text[]
    ),
    quote_data->>'notes',
    auth.uid()
  )
  RETURNING id INTO v_quote_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(items_data) LOOP
    INSERT INTO public.quote_items (
      quote_id,
      description,
      height,
      width,
      depth,
      measurement_notes,
      quantity,
      unit_price,
      line_total,
      sort_order
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

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', v_quote_id, 'created', quote_data);

  RETURN v_quote_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.update_quote_with_items(
  p_quote_id  uuid,
  quote_data  jsonb,
  items_data  jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_sort integer := 0;
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
    updated_at = now()
  WHERE id = p_quote_id;

  DELETE FROM public.quote_items WHERE quote_id = p_quote_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(items_data) LOOP
    INSERT INTO public.quote_items (
      quote_id,
      description,
      height,
      width,
      depth,
      measurement_notes,
      quantity,
      unit_price,
      line_total,
      sort_order
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

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'updated', quote_data);

  RETURN p_quote_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.update_quote_status(
  p_quote_id         uuid,
  p_status           text,
  p_rejection_reason text DEFAULT NULL,
  p_rejection_notes  text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('draft', 'sent', 'approved', 'rejected') THEN
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
  VALUES (
    auth.uid(),
    'quote',
    p_quote_id,
    p_status,
    jsonb_build_object('reason', p_rejection_reason, 'notes', p_rejection_notes)
  );
END;
$$;


-- ──────────────────────────────────────────────────────────
-- FIN DEL BOOTSTRAP
-- ──────────────────────────────────────────────────────────
-- Tablas creadas (si no existían):
--   public.profiles
--   public.clients
--   public.quotes
--   public.quote_items
--   public.activity_log
--
-- Secuencias creadas (si no existían):
--   public.client_number_seq
--   public.quotes_number_seq
--
-- Funciones creadas/reemplazadas:
--   public.set_updated_at()
--   public.handle_new_user()
--   public.create_quote_with_items(jsonb, jsonb)
--   public.update_quote_with_items(uuid, jsonb, jsonb)
--   public.update_quote_status(uuid, text, text, text)
--
-- Datos insertados:
--   Profile administrador (ON CONFLICT DO UPDATE)
-- ============================================================
