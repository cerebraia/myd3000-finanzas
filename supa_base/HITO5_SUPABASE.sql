-- =============================================================
-- HITO #5 — MYD3000 ADMIN
-- Seguridad + Roles + Auditoría + Versionado + Notificaciones
-- Ejecutar en: Supabase SQL Editor
-- Seguro: sin DROP TABLE, sin TRUNCATE, idempotente con IF NOT EXISTS
-- =============================================================

-- ─── HELPER: obtener rol del usuario actual ────────────────────
-- Evita exponer lógica de roles en el frontend
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ─── HELPER: verificar si el usuario es administrador ─────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'administrator'
  );
$$;

-- ─── HELPER: verificar si el usuario es admin o administration ─
CREATE OR REPLACE FUNCTION public.is_admin_or_administration()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('administrator', 'administration')
  );
$$;


-- ─── 1. CAMPO ACTIVE EN PROFILES ──────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;


-- ─── 2. VERSIONES DE COTIZACIÓN ───────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.quote_version_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.quote_versions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id       uuid NOT NULL REFERENCES public.quotes(id),
  version_number integer NOT NULL DEFAULT nextval('public.quote_version_number_seq'),
  snapshot       jsonb NOT NULL,
  change_reason  text,
  created_by     uuid REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_versions_quote_id_idx ON public.quote_versions (quote_id);
CREATE INDEX IF NOT EXISTS quote_versions_created_at_idx ON public.quote_versions (created_at);

ALTER TABLE public.quote_versions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='quote_versions' AND policyname='Authenticated can read quote_versions'
  ) THEN
    CREATE POLICY "Authenticated can read quote_versions"
      ON public.quote_versions FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='quote_versions' AND policyname='Authenticated can create quote_versions'
  ) THEN
    CREATE POLICY "Authenticated can create quote_versions"
      ON public.quote_versions FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
  END IF;
END $$;


-- ─── RPC: Crear versión de cotización ─────────────────────────
-- Se llama desde el backend/RPC de aprobación.
-- Usar también manualmente si se edita una cotización aprobada.
CREATE OR REPLACE FUNCTION public.create_quote_version(
  p_quote_id     uuid,
  p_reason       text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_snapshot jsonb;
  v_version_id uuid;
BEGIN
  SELECT to_jsonb(q.*) INTO v_snapshot FROM public.quotes q WHERE id = p_quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found: %', p_quote_id;
  END IF;

  INSERT INTO public.quote_versions (quote_id, snapshot, change_reason, created_by)
  VALUES (p_quote_id, v_snapshot, p_reason, auth.uid())
  RETURNING id INTO v_version_id;

  RETURN v_version_id;
END;
$$;


-- ─── 3. NOTIFICACIONES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id),
  role_target text,
  type        text NOT NULL,
  title       text NOT NULL,
  message     text,
  entity_type text,
  entity_id   uuid,
  priority    text NOT NULL DEFAULT 'normal'
              CHECK (priority IN ('low','normal','high')),
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx   ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_read_at_idx   ON public.notifications (read_at);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_role_target_idx ON public.notifications (role_target);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='Users can read own notifications'
  ) THEN
    CREATE POLICY "Users can read own notifications"
      ON public.notifications FOR SELECT TO authenticated
      USING (
        user_id = auth.uid()
        OR role_target = public.current_user_role()
        OR (user_id IS NULL AND role_target IS NULL)
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='Users can update own notifications'
  ) THEN
    CREATE POLICY "Users can update own notifications"
      ON public.notifications FOR UPDATE TO authenticated
      USING (
        user_id = auth.uid()
        OR role_target = public.current_user_role()
        OR (user_id IS NULL AND role_target IS NULL)
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='Authenticated can create notifications'
  ) THEN
    CREATE POLICY "Authenticated can create notifications"
      ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;


-- ─── 4. AUDITORÍA — Ampliar activity_log ─────────────────────
-- Agregar old_data y new_data si la tabla existe pero no tiene esas columnas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='activity_log' AND column_name='old_data'
  ) THEN
    ALTER TABLE public.activity_log ADD COLUMN old_data jsonb;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='activity_log' AND column_name='new_data'
  ) THEN
    ALTER TABLE public.activity_log ADD COLUMN new_data jsonb;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='activity_log' AND column_name='source'
  ) THEN
    ALTER TABLE public.activity_log ADD COLUMN source text;
  END IF;
END $$;

-- Índices de auditoría
CREATE INDEX IF NOT EXISTS activity_log_entity_id_idx   ON public.activity_log (entity_id);
CREATE INDEX IF NOT EXISTS activity_log_created_at_idx  ON public.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_user_id_idx     ON public.activity_log (user_id);
CREATE INDEX IF NOT EXISTS activity_log_entity_type_idx ON public.activity_log (entity_type);

-- RLS: Auditoría solo para administradores
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='activity_log' AND policyname='Admins can read all activity'
  ) THEN
    CREATE POLICY "Admins can read all activity"
      ON public.activity_log FOR SELECT TO authenticated
      USING (public.is_admin());
  END IF;
END $$;


-- ─── 5. SOFT DELETE EN CLIENTS ────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='clients' AND column_name='archived_at'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN archived_at timestamptz;
    ALTER TABLE public.clients ADD COLUMN archived_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS clients_archived_at_idx ON public.clients (archived_at);


-- ─── 6. ÍNDICES ADICIONALES PARA RENDIMIENTO ─────────────────

-- Clientes
CREATE INDEX IF NOT EXISTS clients_full_name_idx ON public.clients USING gin(to_tsvector('spanish', full_name));
CREATE INDEX IF NOT EXISTS clients_document_number_idx ON public.clients (document_number);

-- Cotizaciones
CREATE INDEX IF NOT EXISTS quotes_status_idx      ON public.quotes (status);
CREATE INDEX IF NOT EXISTS quotes_client_id_idx   ON public.quotes (client_id);
CREATE INDEX IF NOT EXISTS quotes_created_at_idx  ON public.quotes (created_at DESC);

-- Proyectos
CREATE INDEX IF NOT EXISTS projects_status_idx    ON public.projects (status);
CREATE INDEX IF NOT EXISTS projects_client_id_idx ON public.projects (client_id);

-- Documentos
CREATE INDEX IF NOT EXISTS documents_expiration_date_idx ON public.documents (expiration_date);

-- Empleados
CREATE INDEX IF NOT EXISTS employees_employee_type_idx ON public.employees (employee_type);

-- Notificaciones
-- (ya creados arriba)

-- ─── 7. RLS MEJORADO — PROTEGER ACCIONES FINANCIERAS ─────────
-- Solo admin y administration pueden crear/modificar pagos
-- Nota: actualizar policies existentes primero si ya existen

-- payments_received: solo admin/administration
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='payments_received' AND policyname='Finance roles can create payments_received'
  ) THEN
    CREATE POLICY "Finance roles can create payments_received"
      ON public.payments_received FOR INSERT TO authenticated
      WITH CHECK (public.is_admin_or_administration());
  END IF;
END $$;

-- payments_made: solo admin/administration
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='payments_made' AND policyname='Finance roles can create payments_made'
  ) THEN
    CREATE POLICY "Finance roles can create payments_made"
      ON public.payments_made FOR INSERT TO authenticated
      WITH CHECK (public.is_admin_or_administration());
  END IF;
END $$;

-- payables: modificar solo admin/administration
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='payables' AND policyname='Finance roles can modify payables'
  ) THEN
    CREATE POLICY "Finance roles can modify payables"
      ON public.payables FOR UPDATE TO authenticated
      USING (public.is_admin_or_administration());
  END IF;
END $$;

-- quote_versions: aprobación de cotización genera versión
-- El RPC update_quote_status / approve_quote corre con SECURITY INVOKER
-- El usuario debe tener permisos de admin/administration para aprobar

-- ─── 8. FUNCIÓN: aprobar cotización y crear versión ───────────
-- Actualiza el update_quote_status para crear versión automática
-- cuando la cotización se aprueba o rechaza

CREATE OR REPLACE FUNCTION public.update_quote_status(
  p_quote_id       uuid,
  p_status         text,
  p_rejection_reason text DEFAULT NULL,
  p_rejection_notes  text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_old_status text;
BEGIN
  IF p_status NOT IN ('draft','review','approved','rejected') THEN
    RAISE EXCEPTION 'Invalid quote status: %', p_status;
  END IF;

  -- Solo admin/administration pueden aprobar o rechazar
  IF p_status IN ('approved','rejected') AND NOT public.is_admin_or_administration() THEN
    RAISE EXCEPTION 'insufficient_privilege: Only administrators and administration can approve or reject quotes';
  END IF;

  SELECT status INTO v_old_status FROM public.quotes WHERE id = p_quote_id;

  -- Crear versión antes de cambiar estado (en transición a review o approved)
  IF p_status IN ('review', 'approved') THEN
    PERFORM public.create_quote_version(
      p_quote_id,
      CASE p_status
        WHEN 'review' THEN 'Enviada a revisión'
        WHEN 'approved' THEN 'Aprobación'
        ELSE p_status
      END
    );
  END IF;

  UPDATE public.quotes SET
    status            = p_status,
    approved_at       = CASE WHEN p_status = 'approved' THEN now() ELSE approved_at END,
    rejected_at       = CASE WHEN p_status = 'rejected' THEN now() ELSE rejected_at END,
    rejection_reason  = COALESCE(p_rejection_reason, rejection_reason),
    rejection_notes   = COALESCE(p_rejection_notes, rejection_notes),
    updated_at        = now()
  WHERE id = p_quote_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    auth.uid(), 'quote', p_quote_id, p_status,
    jsonb_build_object(
      'old_status', v_old_status,
      'new_status', p_status,
      'rejection_reason', p_rejection_reason
    )
  );
END;
$$;


-- =============================================================
-- GESTIÓN DE USUARIOS
-- =============================================================
-- IMPORTANTE: La creación de usuarios NO se hace desde frontend.
-- Usar Supabase Dashboard → Authentication → Users → Invite User
-- O implementar Edge Function con service_role.
--
-- Para desactivar un usuario:
-- UPDATE public.profiles SET active = false WHERE id = '<user-uuid>';
-- Nota: el usuario seguirá autenticado hasta que el session expire.
-- Para bloqueo inmediato: Supabase Dashboard → Authentication → Users → Block User
-- =============================================================

-- =============================================================
-- VERIFICACIÓN
-- =============================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('quote_versions','notifications')
-- ORDER BY table_name;
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'activity_log'
-- AND column_name IN ('old_data','new_data','source');
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'profiles' AND column_name = 'active';
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'clients' AND column_name IN ('archived_at','archived_by');
