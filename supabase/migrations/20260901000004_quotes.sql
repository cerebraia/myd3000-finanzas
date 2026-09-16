-- Sequence for quote numbers
CREATE SEQUENCE IF NOT EXISTS public.quotes_number_seq START 1;

-- New quotes table (different from quotations which already exists)
CREATE TABLE IF NOT EXISTS public.quotes (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number                bigint UNIQUE NOT NULL DEFAULT nextval('public.quotes_number_seq'),
  client_id                   uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  title                       text,
  status                      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected')),
  issue_date                  date NOT NULL DEFAULT CURRENT_DATE,
  valid_until                 date,
  subtotal                    numeric(14,2) DEFAULT 0,
  discount                    numeric(14,2) DEFAULT 0,
  tax                         numeric(14,2) DEFAULT 0,
  total                       numeric(14,2) DEFAULT 0,
  initial_payment_percentage  numeric(5,2) DEFAULT 80,
  initial_payment_amount      numeric(14,2) DEFAULT 0,
  final_payment_percentage    numeric(5,2) DEFAULT 20,
  final_payment_amount        numeric(14,2) DEFAULT 0,
  includes                    text[] DEFAULT ARRAY[]::text[],
  excludes                    text[] DEFAULT ARRAY[]::text[],
  terms                       text[] DEFAULT ARRAY[]::text[],
  notes                       text,
  approved_at                 timestamptz,
  rejected_at                 timestamptz,
  rejection_reason            text,
  rejection_notes             text,
  created_by                  uuid REFERENCES auth.users(id),
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quotes_client_id_idx ON public.quotes (client_id);
CREATE INDEX IF NOT EXISTS quotes_status_idx ON public.quotes (status);

-- Enable RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view quotes"
  ON public.quotes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create quotes"
  ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update quotes"
  ON public.quotes FOR UPDATE TO authenticated USING (true);

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
