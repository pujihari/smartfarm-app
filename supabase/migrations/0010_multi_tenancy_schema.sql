-- Rename company_profile to companies to align with application code
ALTER TABLE IF EXISTS public.company_profile RENAME TO companies;

-- Add necessary columns to tables for multi-tenancy
DO $$
BEGIN
  -- Add owner_id to companies
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'owner_id') THEN
    ALTER TABLE public.companies ADD COLUMN owner_id UUID REFERENCES auth.users(id);
  END IF;
  -- Add company_id to farms
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'farms' AND column_name = 'company_id') THEN
    ALTER TABLE public.farms ADD COLUMN company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
  -- Add company_id to inventory_items
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'company_id') THEN
    ALTER TABLE public.inventory_items ADD COLUMN company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
  -- Add company_id to employees
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'company_id') THEN
    ALTER TABLE public.employees ADD COLUMN company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
END $$;