-- Sequence para contract_number
CREATE SEQUENCE IF NOT EXISTS public.contract_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.contracts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number  bigint UNIQUE NOT NULL DEFAULT nextval('public.contract_number_seq'),
  project_id       uuid NOT NULL UNIQUE REFERENCES public.projects(id),  -- UNIQUE: un proyecto = un contrato
  client_id        uuid NOT NULL REFERENCES public.clients(id),
  quote_id         uuid REFERENCES public.quotes(id),
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','pending_signature','signed','completed','cancelled')),
  contract_date    date DEFAULT CURRENT_DATE,
  signed_at        timestamptz,
  total_amount     numeric(14,2),
  terms            text[] DEFAULT ARRAY[]::text[],
  notes            text,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contracts_client_id_idx ON public.contracts (client_id);
CREATE INDEX IF NOT EXISTS contracts_status_idx ON public.contracts (status);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view contracts"
  ON public.contracts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create contracts"
  ON public.contracts FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update contracts"
  ON public.contracts FOR UPDATE TO authenticated USING (true);

CREATE OR REPLACE TRIGGER contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
