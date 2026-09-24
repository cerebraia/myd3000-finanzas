-- ================================================================
-- MYD3000 — CRUD CREATE FIX  (v2 — seguridad anon corregida)
-- ================================================================
-- Propósito : Corregir tres problemas en producción:
--
--   1. GRANT FALTANTE — tablas creadas por CRUD_COMPLETION.sql
--      vía SQL Editor (rol postgres) no heredan automáticamente
--      privilegios de tabla para authenticated. Los CREATEs fallaban
--      con código 42501 oculto por toasts genéricos.
--
--   2. ANON CON WRITE ACCESS — Supabase inicializa proyectos con
--      GRANT ALL ON ALL TABLES TO anon, authenticated. Para una app
--      privada es necesario REVOCAR escritura de anon a nivel de
--      privilegio, no solo confiar en RLS.
--
--   3. contracts.project_id NOT NULL — create_contract_manual acepta
--      null project_id pero la tabla lo exige. Error 23502.
--
-- Seguridad aplicada:
--   • authenticated: SELECT + INSERT + UPDATE + DELETE en tablas de negocio.
--   • anon: solo SELECT (Supabase puede necesitarlo internamente para
--     generar schema OpenAPI). Sin INSERT / UPDATE / DELETE.
--   • activity_log: authenticated conserva SELECT; se revocan
--     INSERT/UPDATE/DELETE. Solo RPCs SECURITY DEFINER (corriendo como
--     postgres) pueden escribir en ella.
--   • Funciones: auditadas — se GRANT EXECUTE solo a authenticated.
--     anon NO recibe EXECUTE en funciones del schema public.
--
-- Aclaraciones sobre DEFAULT PRIVILEGES:
--   ALTER DEFAULT PRIVILEGES solo afecta objetos FUTUROS creados
--   por el rol especificado en esa sesión. Este SQL se ejecuta desde
--   el SQL Editor de Supabase (rol postgres). Por tanto se configura
--   FOR ROLE postgres. Objetos creados por otros roles (supabase_admin,
--   supabase_storage_admin) no quedan cubiertos por esta declaración.
--   Para esos roles el cambio de DEFAULT PRIVILEGES no es necesario
--   ya que sus objetos de negocio pertenecen al schema public solo
--   cuando los creamos explícitamente nosotros.
--
-- Tipo  : Incremental, seguro.
--         Sin DROP TABLE / TRUNCATE / DELETE masivo /
--         DISABLE ROW LEVEL SECURITY.
-- ================================================================

BEGIN;

-- ================================================================
-- BLOQUE A — REVOCAR escritura de anon en schema public
-- ================================================================
-- Supabase otorga ALL por defecto a anon. MYD3000 requiere login;
-- anon nunca debe poder crear ni modificar registros de negocio.
-- Limitamos a solo SELECT (suficiente para generación de schema OpenAPI).
-- Alcance: solo schema public — Supabase Auth/Storage usan auth/storage.

REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;

-- Secuencias: anon no necesita consumir sequences (no puede insertar).
REVOKE USAGE ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Funciones: anon no debe ejecutar RPCs administrativas.
-- Seguro: Supabase Auth usa schema auth, no public.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;


-- ================================================================
-- BLOQUE B — GRANT completo a authenticated
-- ================================================================
-- Otorga privilegios de tabla a authenticated en todos los objetos
-- existentes. Idempotente: GRANT no falla si ya existía el privilegio.

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Funciones — auditoría del schema public:
--
--   Trigger functions  (RETURNS trigger, 2):
--     set_updated_at, handle_new_user
--     → GRANT EXECUTE es inofensivo: PostgreSQL rechaza llamadas directas
--       a funciones que retornan TRIGGER fuera de un contexto de trigger.
--
--   Helpers SECURITY DEFINER (5):
--     is_admin, is_admin_or_administration, is_admin_or_manager,
--     current_user_is_active, current_user_role
--     → Pueden llamarse desde el frontend; retornan boolean/text sobre
--       el perfil del llamador.
--
--   Business RPCs SECURITY DEFINER (36) y SECURITY INVOKER (7):
--     create_project_manual, update_project_fields, approve_quote,
--     register_receivable_payment, archive_*/restore_*, get_dashboard_summary,
--     get_user_list, change_user_role, set_user_active, y demás.
--     → Deben ser ejecutables por authenticated.
--
--   Total funciones en public: 48. Todas deben ser alcanzables por
--   authenticated. Ninguna por anon.
--
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;


-- ================================================================
-- BLOQUE C — Proteger activity_log (inmutabilidad desde frontend)
-- ================================================================
-- El GRANT masivo del bloque B otorgó INSERT/UPDATE/DELETE en
-- activity_log a authenticated. Se revocan de inmediato.
-- Las funciones SECURITY DEFINER (que corren como postgres) siguen
-- pudiendo insertar; el frontend no puede hacerlo directamente.
-- authenticated conserva SELECT para la página de auditoría.

REVOKE INSERT, UPDATE, DELETE ON public.activity_log FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.activity_log FROM anon;


-- ================================================================
-- BLOQUE D — DEFAULT PRIVILEGES para objetos futuros (rol postgres)
-- ================================================================
-- Aplica automáticamente los privilegios correctos a tablas,
-- sequences y funciones creadas en futuras sesiones del SQL Editor
-- (que corre como postgres). No afecta objetos creados por otros roles.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE ON SEQUENCES FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon;


-- ================================================================
-- BLOQUE E — contracts.project_id: eliminar NOT NULL
-- ================================================================
-- Un contrato manual puede existir sin proyecto en estado borrador.
-- La constraint UNIQUE se conserva: en PostgreSQL múltiples NULL
-- no violan un índice UNIQUE, por lo que coexisten borrados sin proyecto.

ALTER TABLE public.contracts ALTER COLUMN project_id DROP NOT NULL;


-- ================================================================
-- BLOQUE F — Recargar schema de PostgREST
-- ================================================================
-- Fuerza actualización del caché de schema para que tablas y
-- funciones nuevas sean visibles vía API inmediatamente.

NOTIFY pgrst, 'reload schema';


-- ================================================================
-- VERIFICACIÓN FINAL (read-only — dentro de la transacción)
-- ================================================================

-- A) authenticated tiene INSERT en tablas de negocio clave
SELECT table_name, privilege_type, grantee
FROM information_schema.role_table_grants
WHERE grantee      = 'authenticated'
  AND privilege_type = 'INSERT'
  AND table_schema   = 'public'
  AND table_name IN (
    'employees','payables','recurring_obligations',
    'suppliers','documents','tasks'
  )
ORDER BY table_name;
-- Esperado: 6 filas (una por tabla)

-- B) authenticated NO tiene INSERT/UPDATE/DELETE en activity_log
SELECT privilege_type, grantee
FROM information_schema.role_table_grants
WHERE grantee    IN ('authenticated','anon')
  AND table_schema = 'public'
  AND table_name   = 'activity_log'
  AND privilege_type IN ('INSERT','UPDATE','DELETE')
ORDER BY grantee, privilege_type;
-- Esperado: 0 filas

-- C) anon tiene 0 INSERT/UPDATE/DELETE en tablas public
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee      = 'anon'
  AND table_schema   = 'public'
  AND privilege_type IN ('INSERT','UPDATE','DELETE')
ORDER BY table_name, privilege_type;
-- Esperado: 0 filas

-- D) contracts.project_id es nullable
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'contracts'
  AND column_name  = 'project_id';
-- Esperado: is_nullable = YES

-- E) RLS habilitado en tablas de negocio
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'employees','payables','recurring_obligations',
    'suppliers','documents','tasks',
    'projects','contracts','receivables','clients','quotes'
  )
ORDER BY tablename;
-- Esperado: rowsecurity = true en todas

COMMIT;
