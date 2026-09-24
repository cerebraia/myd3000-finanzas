-- ================================================================
-- MYD3000 — USERS MODULE
-- ================================================================
-- Propósito : Habilitar gestión de usuarios (listado, roles,
--             activar/desactivar) y soporte a Edge Function invite-user.
-- Tipo      : INCREMENTAL — sin DROP TABLE, sin TRUNCATE, sin DELETE
-- Requiere  : profiles, activity_log (ya existen)
--             profiles.active (añadida por MYD3000_CORE_FUNCTIONAL_FINAL.sql)
-- IMPORTANTE: NO modifica approve_quote ni update_quote_status.
-- ================================================================

BEGIN;

-- ================================================================
-- 1. PROFILES — columnas adicionales y constraint de rol
-- ================================================================

-- Ampliar rol para incluir 'manager'
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('administrator', 'manager', 'administration', 'operations'));

-- Columnas de perfil extendido
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "position"  text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;


-- ================================================================
-- 2. ACTIVITY LOG — columnas de auditoría enriquecida
-- ================================================================

ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS old_data jsonb;
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS new_data jsonb;


-- ================================================================
-- 3. PROFILES — RLS actualizado
-- ================================================================

DROP POLICY IF EXISTS "Users can view own profile"                 ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can read all profiles"  ON public.profiles;
CREATE POLICY "Authenticated users can read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile"               ON public.profiles;
DROP POLICY IF EXISTS "Users can update limited own profile fields" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile fields"        ON public.profiles;
CREATE POLICY "Users can update own profile fields"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ================================================================
-- 4. HELPER FUNCTIONS
-- ================================================================

CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('administrator', 'manager') AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


-- ================================================================
-- 5. RPC — get_user_list
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_user_list()
RETURNS TABLE(
  id           uuid,
  full_name    text,
  role         text,
  active       boolean,
  phone        text,
  "position"   text,
  last_seen_at timestamptz,
  created_at   timestamptz,
  email        text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
-- 6. RPC — change_user_role
-- ================================================================

CREATE OR REPLACE FUNCTION public.change_user_role(
  p_target_user_id uuid,
  p_new_role        text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current_role text;
  v_admin_count  integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar roles de usuario';
  END IF;
  IF p_new_role NOT IN ('administrator', 'manager', 'administration', 'operations') THEN
    RAISE EXCEPTION 'Rol inválido: %', p_new_role;
  END IF;
  SELECT role INTO v_current_role FROM public.profiles WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;
  IF v_current_role = 'administrator' AND p_new_role != 'administrator' THEN
    SELECT COUNT(*) INTO v_admin_count
    FROM public.profiles WHERE role = 'administrator' AND active = true;
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'No se puede cambiar el rol: es el único administrador activo';
    END IF;
  END IF;
  UPDATE public.profiles SET role = p_new_role, updated_at = now() WHERE id = p_target_user_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, old_data, new_data, metadata)
  VALUES (auth.uid(), 'user', p_target_user_id, 'role_changed',
    jsonb_build_object('role', v_current_role),
    jsonb_build_object('role', p_new_role),
    '{}'::jsonb);
END;
$$;


-- ================================================================
-- 7. RPC — set_user_active
-- ================================================================

CREATE OR REPLACE FUNCTION public.set_user_active(
  p_target_user_id uuid,
  p_active          boolean,
  p_reason          text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current_role   text;
  v_current_active boolean;
  v_admin_count    integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar el estado de usuarios';
  END IF;
  SELECT role, active INTO v_current_role, v_current_active
  FROM public.profiles WHERE id = p_target_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuario no encontrado'; END IF;
  IF NOT p_active AND v_current_role = 'administrator' THEN
    SELECT COUNT(*) INTO v_admin_count
    FROM public.profiles WHERE role = 'administrator' AND active = true AND id != p_target_user_id;
    IF v_admin_count = 0 THEN
      RAISE EXCEPTION 'No se puede desactivar: es el único administrador activo';
    END IF;
  END IF;
  UPDATE public.profiles SET active = p_active, updated_at = now() WHERE id = p_target_user_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, old_data, new_data, metadata)
  VALUES (auth.uid(), 'user', p_target_user_id,
    CASE WHEN p_active THEN 'user.reactivated' ELSE 'user.deactivated' END,
    jsonb_build_object('active', v_current_active),
    jsonb_build_object('active', p_active),
    CASE WHEN p_reason IS NOT NULL AND p_reason != ''
         THEN jsonb_build_object('reason', p_reason)
         ELSE '{}'::jsonb END);
END;
$$;


-- ================================================================
-- 8. TRIGGER — handle_new_user actualizado
--    Acepta rol desde raw_user_meta_data (usado por invite-user)
-- ================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_role text;
BEGIN
  v_role := coalesce(NULLIF(new.raw_user_meta_data->>'role', ''), 'operations');
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
-- 9. ÍNDICES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_role   ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(active);


-- ================================================================
-- VERIFICACIÓN FINAL (read-only)
-- ================================================================

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND column_name IN ('active','phone','position','last_seen_at','role')
ORDER BY column_name;

SELECT proname
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN ('get_user_list','change_user_role','set_user_active',
                  'is_admin_or_manager','current_user_role','handle_new_user')
ORDER BY proname;

COMMIT;
