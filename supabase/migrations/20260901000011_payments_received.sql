CREATE TABLE IF NOT EXISTS public.payments_received (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_id   uuid NOT NULL REFERENCES public.receivables(id),
  project_id      uuid NOT NULL REFERENCES public.projects(id),
  client_id       uuid NOT NULL REFERENCES public.clients(id),
  amount          numeric(14,2) NOT NULL,
  payment_date    date NOT NULL DEFAULT CURRENT_DATE,
  payment_method  text,
  reference       text,
  notes           text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_received_project_id_idx ON public.payments_received (project_id);
CREATE INDEX IF NOT EXISTS payments_received_receivable_id_idx ON public.payments_received (receivable_id);
CREATE INDEX IF NOT EXISTS payments_received_payment_date_idx ON public.payments_received (payment_date);

ALTER TABLE public.payments_received ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view payments_received"
  ON public.payments_received FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create payments_received"
  ON public.payments_received FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
