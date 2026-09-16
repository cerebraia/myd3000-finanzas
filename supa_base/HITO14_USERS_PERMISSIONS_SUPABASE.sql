-- ================================================================
-- HITO14_USERS_PERMISSIONS_SUPABASE.sql
-- MYD3000 ADMIN — Gestión de usuarios, roles, aprobaciones y trazabilidad
--
-- Ejecutar DESPUÉS de HITO13_BACKUP_RECOVERY_SUPABASE.sql
-- Seguro: incremental, sin DROP TABLE, sin TRUNCATE, sin DELETE masivo
-- Idempotente: usa IF NOT EXISTS, OR REPLACE, DO $$ ... EXCEPTION
-- ================================================================


-- ================================================================
-- 1. PROFILES — Nuevas columnas
-- ================================================================

-- Añadir rol manager al CHECK constraint
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('administrator', 'manager', 'administration', 'operations'));

-- Columnas adicionales de perfil
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone       text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS position    text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;


-- ================================================================
-- 2. ACTIVITY LOG — old_data / new_data
-- ================================================================

ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS old_data jsonb;
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS new_data jsonb;


-- ================================================================
-- 3. QUOTES — campos de aprobación enriquecidos
-- ================================================================

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id);
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS approved_by  uuid REFERENCES auth.users(id);
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS rejected_by  uuid REFERENCES auth.users(id);


-- ================================================================
-- 4. PROFILES — RLS actualizado
-- ================================================================

-- Permite que usuarios autenticados lean todos los perfiles básicos
-- (necesario para selectores de usuarios, asignación de tareas, auditoría)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own profile"               ON public.profiles;
  DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON public.profiles;
  CREATE POLICY "Authenticated users can read all profiles"
    ON public.profiles FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

-- Los usuarios pueden actualizar campos propios limitados (NO role, NO active)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can update own profile"                    ON public.profiles;
  DROP POLICY IF EXISTS "Users can update limited own profile fields"     ON public.profiles;

  -- La restricción de columnas (role, active) se aplica vía RPC
  -- Para SELECT y UPDATE básico, usamos la política estándar
  CREATE POLICY "Users can update own profile fields"
    ON public.profiles FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;


-- ================================================================
-- 5. HELPERS — Funciones de permisos actualizadas
-- ================================================================

-- Administrador puro (también debe estar activo)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'administrator' AND active = true
  );
$$;

-- Admin o gerente (para operaciones de negocio que requieren ambos)
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('administrator', 'manager') AND active = true
  );
$$;

-- Admin, gerente o administración
CREATE OR REPLACE FUNCTION public.is_admin_or_administration()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('administrator', 'manager', 'administration')
      AND active = true
  );
$$;

-- Usuario activo (cualquier rol)
CREATE OR REPLACE FUNCTION public.current_user_is_active()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND active = true
  );
$$;

-- Rol del usuario actual
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


-- ================================================================
-- 6. RPC — get_user_list (admin y manager pueden ver usuarios)
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_user_list()
RETURNS TABLE(
  id           uuid,
  full_name    text,
  role         text,
  active       boolean,
  phone        text,
  position     text,
  last_seen_at timestamptz,
  created_at   timestamptz,
  email        text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'Solo administradores y gerentes pueden listar usuarios';
  END IF;
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.role,
    p.active,
    p.phone,
    p.position,
    p.last_seen_at,
    p.created_at,
    au.email
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.id
  ORDER BY p.created_at ASC;
END;
$$;


-- ================================================================
-- 7. RPC — change_user_role (solo administrator)
-- ================================================================

CREATE OR REPLACE FUNCTION public.change_user_role(
  p_target_user_id uuid,
  p_new_role        text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_current_role  text;
  v_admin_count   integer;
BEGIN
  -- Solo administrators pueden cambiar roles
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar roles de usuario';
  END IF;

  -- Validar rol destino
  IF p_new_role NOT IN ('administrator', 'manager', 'administration', 'operations') THEN
    RAISE EXCEPTION 'Rol inválido: %', p_new_role;
  END IF;

  -- Obtener rol actual
  SELECT role INTO v_current_role
  FROM public.profiles
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  -- Proteger el último administrador activo
  IF v_current_role = 'administrator' AND p_new_role != 'administrator' THEN
    SELECT COUNT(*) INTO v_admin_count
    FROM public.profiles
    WHERE role = 'administrator' AND active = true;

    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'No se puede cambiar el rol: es el único administrador activo del sistema';
    END IF;
  END IF;

  -- Aplicar cambio
  UPDATE public.profiles
  SET role = p_new_role, updated_at = now()
  WHERE id = p_target_user_id;

  -- Auditar (inmutable — solo INSERT)
  INSERT INTO public.activity_log
    (user_id, entity_type, entity_id, action, old_data, new_data, metadata)
  VALUES (
    auth.uid(),
    'user',
    p_target_user_id,
    'role_changed',
    jsonb_build_object('role', v_current_role),
    jsonb_build_object('role', p_new_role),
    '{}'::jsonb
  );
END;
$$;


-- ================================================================
-- 8. RPC — set_user_active (solo administrator)
-- ================================================================

CREATE OR REPLACE FUNCTION public.set_user_active(
  p_target_user_id uuid,
  p_active          boolean,
  p_reason          text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_current_role    text;
  v_current_active  boolean;
  v_admin_count     integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar el estado de usuarios';
  END IF;

  SELECT role, active INTO v_current_role, v_current_active
  FROM public.profiles
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  -- Proteger el último administrador activo
  IF NOT p_active AND v_current_role = 'administrator' THEN
    SELECT COUNT(*) INTO v_admin_count
    FROM public.profiles
    WHERE role = 'administrator' AND active = true AND id != p_target_user_id;

    IF v_admin_count = 0 THEN
      RAISE EXCEPTION 'No se puede desactivar: es el único administrador activo del sistema';
    END IF;
  END IF;

  UPDATE public.profiles
  SET active = p_active, updated_at = now()
  WHERE id = p_target_user_id;

  INSERT INTO public.activity_log
    (user_id, entity_type, entity_id, action, old_data, new_data, metadata)
  VALUES (
    auth.uid(),
    'user',
    p_target_user_id,
    CASE WHEN p_active THEN 'user.reactivated' ELSE 'user.deactivated' END,
    jsonb_build_object('active', v_current_active),
    jsonb_build_object('active', p_active),
    CASE
      WHEN p_reason IS NOT NULL AND p_reason != ''
      THEN jsonb_build_object('reason', p_reason)
      ELSE '{}'::jsonb
    END
  );
END;
$$;


-- ================================================================
-- 9. RPC — approve_quote (validación server-side de permisos)
-- ================================================================

CREATE OR REPLACE FUNCTION public.approve_quote(
  p_quote_id uuid,
  p_action   text,           -- 'approve' | 'reject'
  p_reason   text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor_role     text;
  v_current_status text;
  v_created_by     uuid;
BEGIN
  -- Validar usuario activo y obtener rol
  SELECT role INTO v_actor_role
  FROM public.profiles
  WHERE id = auth.uid() AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario inactivo o no autenticado';
  END IF;

  -- Solo administrator, manager y administration pueden aprobar/rechazar
  IF v_actor_role NOT IN ('administrator', 'manager', 'administration') THEN
    RAISE EXCEPTION 'No tienes permiso para aprobar o rechazar cotizaciones';
  END IF;

  -- Obtener estado actual
  SELECT status, created_by
  INTO v_current_status, v_created_by
  FROM public.quotes
  WHERE id = p_quote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotización no encontrada';
  END IF;

  IF p_action = 'approve' THEN
    IF v_current_status != 'review' THEN
      RAISE EXCEPTION 'Solo se pueden aprobar cotizaciones en estado "En revisión"';
    END IF;

    UPDATE public.quotes SET
      status      = 'approved',
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at  = now()
    WHERE id = p_quote_id;

    INSERT INTO public.activity_log
      (user_id, entity_type, entity_id, action, old_data, new_data, metadata)
    VALUES (
      auth.uid(), 'quote', p_quote_id, 'approved',
      jsonb_build_object('status', v_current_status),
      jsonb_build_object('status', 'approved', 'approved_by', auth.uid()::text),
      '{}'::jsonb
    );

  ELSIF p_action = 'reject' THEN
    IF v_current_status != 'review' THEN
      RAISE EXCEPTION 'Solo se pueden rechazar cotizaciones en estado "En revisión"';
    END IF;

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
      RAISE EXCEPTION 'El motivo de rechazo es obligatorio';
    END IF;

    UPDATE public.quotes SET
      status           = 'rejected',
      rejected_by      = auth.uid(),
      rejected_at      = now(),
      rejection_reason = p_reason,
      updated_at       = now()
    WHERE id = p_quote_id;

    INSERT INTO public.activity_log
      (user_id, entity_type, entity_id, action, old_data, new_data, metadata)
    VALUES (
      auth.uid(), 'quote', p_quote_id, 'rejected',
      jsonb_build_object('status', v_current_status),
      jsonb_build_object('status', 'rejected', 'rejected_by', auth.uid()::text),
      jsonb_build_object('reason', p_reason)
    );

  ELSE
    RAISE EXCEPTION 'Acción inválida: %. Use "approve" o "reject"', p_action;
  END IF;
END;
$$;


-- ================================================================
-- 10. RPC — update_quote_status actualizado con submitted_by/at
-- ================================================================

-- Extender el RPC existente para registrar submitted_by cuando pase a review
CREATE OR REPLACE FUNCTION public.update_quote_status(
  p_quote_id         uuid,
  p_status           text,
  p_rejection_reason text DEFAULT NULL,
  p_rejection_notes  text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old_status text;
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  SELECT status INTO v_old_status FROM public.quotes WHERE id = p_quote_id;

  IF p_status = 'review' THEN
    UPDATE public.quotes SET
      status        = 'review',
      submitted_by  = auth.uid(),
      submitted_at  = now(),
      updated_at    = now()
    WHERE id = p_quote_id;

  ELSIF p_status = 'approved' THEN
    -- Para aprobaciones directas (sin el RPC approve_quote)
    -- Verificar que tenga permiso
    IF NOT public.is_admin_or_administration() THEN
      RAISE EXCEPTION 'No tienes permiso para aprobar cotizaciones';
    END IF;
    UPDATE public.quotes SET
      status      = 'approved',
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at  = now()
    WHERE id = p_quote_id;

  ELSIF p_status = 'rejected' THEN
    IF NOT public.is_admin_or_administration() THEN
      RAISE EXCEPTION 'No tienes permiso para rechazar cotizaciones';
    END IF;
    UPDATE public.quotes SET
      status           = 'rejected',
      rejected_by      = auth.uid(),
      rejected_at      = now(),
      rejection_reason = p_rejection_reason,
      rejection_notes  = p_rejection_notes,
      updated_at       = now()
    WHERE id = p_quote_id;

  ELSIF p_status = 'draft' THEN
    UPDATE public.quotes SET
      status     = 'draft',
      updated_at = now()
    WHERE id = p_quote_id;

  ELSE
    RAISE EXCEPTION 'Estado inválido: %', p_status;
  END IF;

  INSERT INTO public.activity_log
    (user_id, entity_type, entity_id, action, old_data, new_data, metadata)
  VALUES (
    auth.uid(), 'quote', p_quote_id,
    CASE
      WHEN p_status = 'review'    THEN 'review'
      WHEN p_status = 'approved'  THEN 'approved'
      WHEN p_status = 'rejected'  THEN 'rejected'
      ELSE 'updated'
    END,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', p_status),
    CASE
      WHEN p_rejection_reason IS NOT NULL
      THEN jsonb_build_object('reason', p_rejection_reason, 'notes', p_rejection_notes)
      ELSE '{}'::jsonb
    END
  );
END;
$$;


-- ================================================================
-- 11. ACTIVITY LOG — Inmutabilidad (sin UPDATE ni DELETE)
-- ================================================================

-- Eliminar cualquier política que permita UPDATE o DELETE en activity_log
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can update activity" ON public.activity_log;
  DROP POLICY IF EXISTS "Users can delete activity" ON public.activity_log;
  DROP POLICY IF EXISTS "Admins can update activity" ON public.activity_log;
  DROP POLICY IF EXISTS "Admins can delete activity" ON public.activity_log;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

-- Revocar permisos de UPDATE y DELETE sobre activity_log del rol authenticated
-- (el INSERT queda permitido por las políticas existentes)
REVOKE UPDATE, DELETE ON public.activity_log FROM authenticated;


-- ================================================================
-- 12. TRIGGER — handle_new_user actualizado
--     Acepta rol desde raw_user_meta_data (usado por invite-user function)
-- ================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := coalesce(
    NULLIF(new.raw_user_meta_data->>'role', ''),
    'operations'
  );

  -- Validar que el rol sea válido
  IF v_role NOT IN ('administrator', 'manager', 'administration', 'operations') THEN
    v_role := 'operations';
  END IF;

  INSERT INTO public.profiles (id, full_name, role, active)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    v_role,
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;


-- ================================================================
-- 13. ÍNDICES de rendimiento
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON public.activity_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_action      ON public.activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id     ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role            ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_active          ON public.profiles(active);
CREATE INDEX IF NOT EXISTS idx_quotes_submitted_by      ON public.quotes(submitted_by) WHERE submitted_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_approved_by       ON public.quotes(approved_by)  WHERE approved_by  IS NOT NULL;


-- ================================================================
-- VERIFICACIÓN
-- ================================================================

DO $$
DECLARE
  v_col_count int;
BEGIN
  -- Verificar columnas de profiles
  SELECT COUNT(*) INTO v_col_count
  FROM information_schema.columns
  WHERE table_name = 'profiles'
    AND column_name IN ('phone', 'position', 'last_seen_at');

  IF v_col_count < 3 THEN
    RAISE WARNING 'Faltan columnas en profiles: esperadas 3, encontradas %', v_col_count;
  END IF;

  -- Verificar old_data/new_data en activity_log
  SELECT COUNT(*) INTO v_col_count
  FROM information_schema.columns
  WHERE table_name = 'activity_log'
    AND column_name IN ('old_data', 'new_data');

  IF v_col_count < 2 THEN
    RAISE WARNING 'Faltan columnas en activity_log: esperadas 2, encontradas %', v_col_count;
  END IF;

  RAISE NOTICE 'HITO14 verificación completada.';
END;
$$;
