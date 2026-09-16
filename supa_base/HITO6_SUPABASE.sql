-- ================================================================
-- HITO6_SUPABASE.sql
-- MYD3000 ADMIN — Configuración de empresa y ajustes de producción
--
-- Ejecutar DESPUÉS de SUPABASE_BASE_PRE_HITO5_V3.sql y HITO5_SUPABASE.sql
-- Seguro: sin DROP TABLE, sin TRUNCATE, idempotente
-- ================================================================

-- ─── COMPANY SETTINGS ─────────────────────────────────────────
-- Una sola fila activa. El frontend hace upsert por id.

CREATE TABLE IF NOT EXISTS public.company_settings (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name              text NOT NULL DEFAULT 'Muebles y Decoraciones 3000 C.A.',
  tax_id                    text,
  phone                     text,
  email                     text,
  address                   text,
  logo_storage_path         text,
  authorized_signer_name    text,
  authorized_signer_position text,
  signature_storage_path    text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS company_settings_updated_at ON public.company_settings;
CREATE TRIGGER company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read company_settings"   ON public.company_settings;
CREATE POLICY "Authenticated users can read company_settings"
  ON public.company_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage company_settings" ON public.company_settings;
CREATE POLICY "Authenticated users can manage company_settings"
  ON public.company_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fila inicial (empresa por defecto, editable desde Configuración → Empresa)
INSERT INTO public.company_settings (company_name)
VALUES ('Muebles y Decoraciones 3000 C.A.')
ON CONFLICT DO NOTHING;

-- ─── VERIFICACIÓN ─────────────────────────────────────────────
SELECT 'company_settings' AS tabla,
       COUNT(*) AS filas
FROM public.company_settings;
