-- Quote items table (for the new quotes table)
CREATE TABLE IF NOT EXISTS public.quote_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id            uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description         text NOT NULL,
  height              numeric,
  width               numeric,
  depth               numeric,
  measurement_notes   text,
  quantity            integer NOT NULL DEFAULT 1,
  unit_price          numeric(14,2) NOT NULL DEFAULT 0,
  line_total          numeric(14,2) NOT NULL DEFAULT 0,
  sort_order          integer DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_items_quote_id_idx ON public.quote_items (quote_id);

-- Enable RLS
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can do everything
CREATE POLICY "Authenticated users can view quote items"
  ON public.quote_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert quote items"
  ON public.quote_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update quote items"
  ON public.quote_items FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete quote items"
  ON public.quote_items FOR DELETE TO authenticated USING (true);

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER quote_items_updated_at
  BEFORE UPDATE ON public.quote_items
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
