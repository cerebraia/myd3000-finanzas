CREATE TABLE IF NOT EXISTS public.receivables (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES public.projects(id),
  client_id           uuid NOT NULL REFERENCES public.clients(id),
  quote_id            uuid REFERENCES public.quotes(id),
  concept             text NOT NULL,
  installment_number  integer,
  percentage          numeric(5,2),
  amount              numeric(14,2) NOT NULL,
  due_date            date,
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','partial','paid','overdue','cancelled')),
  paid_amount         numeric(14,2) NOT NULL DEFAULT 0,
  paid_at             timestamptz,
  notes               text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS receivables_project_id_idx ON public.receivables (project_id);
CREATE INDEX IF NOT EXISTS receivables_status_idx ON public.receivables (status);
CREATE INDEX IF NOT EXISTS receivables_due_date_idx ON public.receivables (due_date);

ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view receivables"
  ON public.receivables FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create receivables"
  ON public.receivables FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update receivables"
  ON public.receivables FOR UPDATE TO authenticated USING (true);

CREATE OR REPLACE TRIGGER receivables_updated_at
  BEFORE UPDATE ON public.receivables
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
