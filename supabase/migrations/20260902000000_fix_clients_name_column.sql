-- Fix: migration 001 created `name text NOT NULL` but the service only sends `full_name`.
-- This migration makes `name` nullable and ensures `full_name` is NOT NULL.

-- Step 1: backfill full_name from name where missing (safe even if column doesn't exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'name'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'full_name'
  ) THEN
    UPDATE public.clients SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL;
  END IF;
END $$;

-- Step 2: drop NOT NULL from `name` (if the column exists with that constraint)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'name'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.clients ALTER COLUMN name DROP NOT NULL;
  END IF;
END $$;

-- Step 3: set full_name NOT NULL (if column exists and is currently nullable)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'full_name'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.clients ALTER COLUMN full_name SET NOT NULL;
  END IF;
END $$;

-- Step 4: replace INSERT policy to avoid requiring created_by = auth.uid()
-- (old policy: with check (auth.uid() = created_by) fails when created_by is null)
DROP POLICY IF EXISTS "Authenticated users can create clients" ON public.clients;
CREATE POLICY "Authenticated users can create clients"
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
