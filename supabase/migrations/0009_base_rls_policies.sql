-- Enable RLS and add policies for the 'farms' table
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to manage farms" ON public.farms FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable RLS and add policies for the 'flocks' table
ALTER TABLE public.flocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to manage flocks" ON public.flocks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable RLS and add policies for the 'health_events' table
ALTER TABLE public.health_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to manage health_events" ON public.health_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable RLS and add policies for the 'production_data' table
ALTER TABLE public.production_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to manage production_data" ON public.production_data FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable RLS and add policies for the 'feed_consumption' table
ALTER TABLE public.feed_consumption ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to manage feed_consumption" ON public.feed_consumption FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable RLS and add policies for the 'inventory_items' table
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to manage inventory_items" ON public.inventory_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable RLS and add policies for the 'company_profile' table
ALTER TABLE public.company_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to manage company_profile" ON public.company_profile FOR ALL TO authenticated USING (true) WITH CHECK (true);