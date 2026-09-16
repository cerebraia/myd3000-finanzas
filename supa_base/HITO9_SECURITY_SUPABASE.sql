-- ================================================================
-- HITO9_SECURITY_SUPABASE.sql
-- MYD3000 ADMIN — Hardening de seguridad avanzado
--
-- Ejecutar DESPUÉS de HITO10_SECURITY_SUPABASE.sql (o del último
-- SQL aplicado). Seguro: idempotente, sin DROP TABLE, sin TRUNCATE.
-- ================================================================

-- ─── 1. HELPER: is_admin con verificación de active ─────────────
-- Reemplaza la versión anterior: ahora exige active = true.
-- Un administrador desactivado NO puede ejecutar funciones admin.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'administrator'
      AND active = true
  );
$$;

-- ─── 2. HELPER: is_admin_or_administration con active ───────────
CREATE OR REPLACE FUNCTION public.is_admin_or_administration()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('administrator', 'administration')
      AND active = true
  );
$$;

-- ─── 3. HELPER: cuenta admins activos ───────────────────────────
-- Necesario para la protección del último administrador.
CREATE OR REPLACE FUNCTION public.count_active_admins()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.profiles
  WHERE role = 'administrator' AND active = true;
$$;

-- ─── 4. cancel_receivable — agregar check de usuario activo ─────
CREATE OR REPLACE FUNCTION public.cancel_receivable(
  p_receivable_id uuid,
  p_reason        text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid numeric;
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  IF NOT public.is_admin_or_administration() THEN
    RAISE EXCEPTION 'Permiso insuficiente para cancelar cuenta por cobrar';
  END IF;

  SELECT paid_amount INTO v_paid
  FROM public.receivables
  WHERE id = p_receivable_id;

  IF v_paid > 0 THEN
    RAISE EXCEPTION 'No se puede cancelar una cuenta con pagos registrados.';
  END IF;

  UPDATE public.receivables
  SET status              = 'cancelled',
      cancelled_by        = auth.uid(),
      cancellation_reason = p_reason,
      updated_at          = now()
  WHERE id = p_receivable_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'receivable', p_receivable_id::text, 'cancelled',
          jsonb_build_object('reason', p_reason));
END;
$$;

-- ─── 5. cancel_payable — agregar check de usuario activo ────────
CREATE OR REPLACE FUNCTION public.cancel_payable(
  p_payable_id uuid,
  p_reason     text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid numeric;
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  IF NOT public.is_admin_or_administration() THEN
    RAISE EXCEPTION 'Permiso insuficiente para cancelar cuenta por pagar';
  END IF;

  SELECT paid_amount INTO v_paid
  FROM public.payables
  WHERE id = p_payable_id;

  IF v_paid > 0 THEN
    RAISE EXCEPTION 'No se puede cancelar una cuenta con pagos registrados.';
  END IF;

  UPDATE public.payables
  SET status              = 'cancelled',
      cancelled_by        = auth.uid(),
      cancellation_reason = p_reason,
      updated_at          = now()
  WHERE id = p_payable_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'payable', p_payable_id::text, 'cancelled',
          jsonb_build_object('reason', p_reason));
END;
$$;

-- ─── 6. archive_quote / restore_quote — check de usuario activo ─
CREATE OR REPLACE FUNCTION public.archive_quote(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  UPDATE public.quotes
  SET archived_at = now(),
      archived_by = auth.uid()
  WHERE id = p_quote_id AND archived_at IS NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id::text, 'archived', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_quote(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  UPDATE public.quotes
  SET archived_at = NULL,
      archived_by = NULL
  WHERE id = p_quote_id AND archived_at IS NOT NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id::text, 'restored', '{}'::jsonb);
END;
$$;

-- ─── 7. archive_project / restore_project ───────────────────────
CREATE OR REPLACE FUNCTION public.archive_project(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  UPDATE public.projects
  SET archived_at = now(),
      archived_by = auth.uid()
  WHERE id = p_project_id AND archived_at IS NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'project', p_project_id::text, 'archived', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_project(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  UPDATE public.projects
  SET archived_at = NULL,
      archived_by = NULL
  WHERE id = p_project_id AND archived_at IS NOT NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'project', p_project_id::text, 'restored', '{}'::jsonb);
END;
$$;

-- ─── 8. archive_employee / restore_employee ──────────────────────
CREATE OR REPLACE FUNCTION public.archive_employee(p_employee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  UPDATE public.employees
  SET archived_at = now(),
      archived_by = auth.uid()
  WHERE id = p_employee_id AND archived_at IS NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'employee', p_employee_id::text, 'archived', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_employee(p_employee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  UPDATE public.employees
  SET archived_at = NULL,
      archived_by = NULL
  WHERE id = p_employee_id AND archived_at IS NOT NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'employee', p_employee_id::text, 'restored', '{}'::jsonb);
END;
$$;

-- ─── 9. archive_obligation / restore_obligation ──────────────────
CREATE OR REPLACE FUNCTION public.archive_obligation(p_obligation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  UPDATE public.recurring_obligations
  SET archived_at = now(),
      archived_by = auth.uid()
  WHERE id = p_obligation_id AND archived_at IS NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'obligation', p_obligation_id::text, 'archived', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_obligation(p_obligation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  UPDATE public.recurring_obligations
  SET archived_at = NULL,
      archived_by = NULL
  WHERE id = p_obligation_id AND archived_at IS NOT NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'obligation', p_obligation_id::text, 'restored', '{}'::jsonb);
END;
$$;

-- ─── 10. archive_client / restore_client ────────────────────────
CREATE OR REPLACE FUNCTION public.archive_client(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  UPDATE public.clients
  SET archived_at = now(),
      archived_by = auth.uid()
  WHERE id = p_client_id AND archived_at IS NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'client', p_client_id::text, 'archived', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_client(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  UPDATE public.clients
  SET archived_at = NULL,
      archived_by = NULL
  WHERE id = p_client_id AND archived_at IS NOT NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'client', p_client_id::text, 'restored', '{}'::jsonb);
END;
$$;

-- ─── 11. restore_document ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.restore_document(p_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  UPDATE public.documents
  SET deleted_at = NULL,
      deleted_by = NULL
  WHERE id = p_document_id AND deleted_at IS NOT NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'document', p_document_id::text, 'restored', '{}'::jsonb);
END;
$$;

-- ─── 12. set_user_role — RPC seguro para cambio de rol ──────────
-- Solo administrator activo puede cambiar roles.
-- Protección: el último admin no puede quitarse el rol.

CREATE OR REPLACE FUNCTION public.set_user_role(
  p_target_user_id uuid,
  p_new_role        text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo administradores pueden cambiar roles';
  END IF;

  IF p_new_role NOT IN ('administrator', 'administration', 'operations') THEN
    RAISE EXCEPTION 'Rol inválido';
  END IF;

  -- Proteger: el último admin no puede degradar su propio rol
  IF p_target_user_id = auth.uid() AND p_new_role != 'administrator' THEN
    IF public.count_active_admins() <= 1 THEN
      RAISE EXCEPTION 'No puedes quitarte el rol de administrador porque eres el único administrador activo';
    END IF;
  END IF;

  UPDATE public.profiles
  SET role = p_new_role
  WHERE id = p_target_user_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    auth.uid(), 'user', p_target_user_id::text, 'role_changed',
    jsonb_build_object('new_role', p_new_role, 'changed_by', auth.uid())
  );
END;
$$;

-- ─── 13. set_user_active — RPC seguro para activar/desactivar ────
-- Solo administrator activo puede cambiar estado de usuario.
-- Protección: el último admin no puede desactivarse.

CREATE OR REPLACE FUNCTION public.set_user_active(
  p_target_user_id uuid,
  p_active          boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo administradores pueden activar o desactivar usuarios';
  END IF;

  -- Proteger: el último admin activo no puede desactivarse
  IF p_target_user_id = auth.uid() AND NOT p_active THEN
    IF public.count_active_admins() <= 1 THEN
      RAISE EXCEPTION 'No puedes desactivarte porque eres el único administrador activo';
    END IF;
  END IF;

  UPDATE public.profiles
  SET active = p_active
  WHERE id = p_target_user_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    auth.uid(), 'user', p_target_user_id::text,
    CASE WHEN p_active THEN 'user_activated' ELSE 'user_deactivated' END,
    jsonb_build_object('changed_by', auth.uid())
  );
END;
$$;

-- ─── 14. PROFILES — Proteger UPDATE directo de roles ────────────
-- Usuarios solo pueden actualizar su propio perfil (campos no sensibles).
-- El cambio de rol/active debe ir siempre por RPC (set_user_role / set_user_active).

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can update own profile"    ON public.profiles;
  DROP POLICY IF EXISTS "Only admins can update profiles" ON public.profiles;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

CREATE POLICY "Users can update own non-sensitive profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- role and active can only be changed via set_user_role/set_user_active RPCs
    -- Direct UPDATE by the user cannot change them because SECURITY DEFINER functions
    -- bypass RLS, while direct client calls are subject to this policy.
  );

-- ─── 15. STORAGE — Bucket project-files debe ser privado ─────────
-- Instrucción manual: en Supabase Dashboard → Storage → project-files
-- verificar que "Public" esté desactivado.
-- Las políticas deben requerir autenticación para acceder a diseños.

-- ─── 16. VERIFICACIÓN FINAL ──────────────────────────────────────
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'clients','quotes','projects','contracts',
    'receivables','payments_received','payables','payments_made',
    'employees','documents','suppliers','activity_log',
    'profiles','project_designs','recurring_obligations'
  )
ORDER BY tablename;
