-- Add client_number sequence and new fields to existing clients table
CREATE SEQUENCE IF NOT EXISTS public.client_number_seq START 1;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_number bigint DEFAULT nextval('public.client_number_seq'),
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS full_name text;

-- Backfill full_name from name if it exists
UPDATE public.clients SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL;

-- Add unique constraint on client_number
ALTER TABLE public.clients
  ADD CONSTRAINT clients_client_number_key UNIQUE (client_number);
