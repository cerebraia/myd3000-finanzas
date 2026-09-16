-- Sequence para project_number
CREATE SEQUENCE IF NOT EXISTS public.project_number_seq START 1;

-- Tabla projects
CREATE TABLE IF NOT EXISTS public.projects (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_number          bigint UNIQUE NOT NULL DEFAULT nextval('public.project_number_seq'),
  client_id               uuid NOT NULL REFERENCES public.clients(id),
  quote_id                uuid UNIQUE REFERENCES public.quotes(id),  -- UNIQUE: una cotización = un proyecto
  name                    text NOT NULL,
  description             text,
  status                  text NOT NULL DEFAULT 'planning'
                          CHECK (status IN ('planning','measurement','production','installation','completed','cancelled')),
  total_amount            numeric(14,2) NOT NULL DEFAULT 0,
  start_date              date,
  estimated_delivery_date date,
  actual_delivery_date    date,
  notes                   text,
  created_by              uuid REFERENCES auth.users(id),
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_client_id_idx ON public.projects (client_id);
CREATE INDEX IF NOT EXISTS projects_status_idx ON public.projects (status);
CREATE INDEX IF NOT EXISTS projects_quote_id_idx ON public.projects (quote_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view projects"
  ON public.projects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create projects"
  ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update projects"
  ON public.projects FOR UPDATE TO authenticated USING (true);

CREATE OR REPLACE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
