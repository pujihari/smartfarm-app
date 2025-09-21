ALTER TABLE public.production_standard_data
ADD COLUMN hen_day_production_percent_min NUMERIC,
ADD COLUMN hen_day_production_percent_max NUMERIC,
ADD COLUMN body_weight_g_min NUMERIC,
ADD COLUMN body_weight_g_max NUMERIC,
ADD COLUMN feed_consumption_g_per_day_min NUMERIC,
ADD COLUMN feed_consumption_g_per_day_max NUMERIC,
ADD COLUMN uniformity_percent_min NUMERIC,
ADD COLUMN uniformity_percent_max NUMERIC,
ADD COLUMN mortality_percent_min NUMERIC,
ADD COLUMN mortality_percent_max NUMERIC,
ADD COLUMN egg_weight_g_min NUMERIC,
ADD COLUMN egg_weight_g_max NUMERIC;