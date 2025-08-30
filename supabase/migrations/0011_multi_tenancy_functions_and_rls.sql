-- Drop all existing policies in public schema to ensure a clean slate.
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(policy_record.policyname) || ' ON public.' || quote_ident(policy_record.tablename);
  END LOOP;
END;
$$;

-- Create helper function to get the current user's company ID.
-- This function is STABLE, meaning it returns the same result for the same user within a transaction.
CREATE OR REPLACE FUNCTION public.get_current_company_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT company_id
  FROM public.employees
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- Note: get_user_role() is assumed to exist from a previous migration (0008).

-- Enable RLS and create new, correct policies for all tables.

-- Companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to company members" ON public.companies FOR SELECT USING (id = get_current_company_id());
CREATE POLICY "Allow admins to update company profile" ON public.companies FOR UPDATE USING (id = get_current_company_id() AND get_user_role() = 'Admin');

-- Farms
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to company members on farms" ON public.farms FOR SELECT USING (company_id = get_current_company_id());
CREATE POLICY "Allow manage access to admins and farm managers on farms" ON public.farms FOR ALL USING (company_id = get_current_company_id() AND (get_user_role() IN ('Admin', 'Manajer Farm')));

-- Flocks
ALTER TABLE public.flocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to company members on flocks" ON public.flocks FOR SELECT USING (get_current_company_id() = (SELECT company_id FROM farms WHERE id = farm_id));
CREATE POLICY "Allow manage access to admins and farm managers on flocks" ON public.flocks FOR ALL USING (get_current_company_id() = (SELECT company_id FROM farms WHERE id = farm_id) AND (get_user_role() IN ('Admin', 'Manajer Farm')));

-- Production Data
ALTER TABLE public.production_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to company members on production_data" ON public.production_data FOR SELECT USING (get_current_company_id() = (SELECT f.company_id FROM flocks fl JOIN farms f ON fl.farm_id = f.id WHERE fl.id = flock_id));
CREATE POLICY "Allow write access to all roles on production_data" ON public.production_data FOR ALL USING (get_current_company_id() = (SELECT f.company_id FROM flocks fl JOIN farms f ON fl.farm_id = f.id WHERE fl.id = flock_id) AND (get_user_role() IN ('Admin', 'Manajer Farm', 'Operator Kandang')));

-- Health Events
ALTER TABLE public.health_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to company members on health_events" ON public.health_events FOR SELECT USING (get_current_company_id() = (SELECT f.company_id FROM flocks fl JOIN farms f ON fl.farm_id = f.id WHERE fl.id = flock_id));
CREATE POLICY "Allow write access to all roles on health_events" ON public.health_events FOR ALL USING (get_current_company_id() = (SELECT f.company_id FROM flocks fl JOIN farms f ON fl.farm_id = f.id WHERE fl.id = flock_id) AND (get_user_role() IN ('Admin', 'Manajer Farm', 'Operator Kandang')));

-- Inventory Items
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to company members on inventory_items" ON public.inventory_items FOR SELECT USING (company_id = get_current_company_id());
CREATE POLICY "Allow manage access to admins and farm managers on inventory_items" ON public.inventory_items FOR ALL USING (company_id = get_current_company_id() AND (get_user_role() IN ('Admin', 'Manajer Farm')));

-- Employees
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow admins to manage employees" ON public.employees FOR ALL USING (company_id = get_current_company_id() AND get_user_role() = 'Admin');
CREATE POLICY "Allow employees to view others in the same company" ON public.employees FOR SELECT USING (company_id = get_current_company_id());