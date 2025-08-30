-- This migration seeds the "HyLine Max Pro" standard data for the FIRST company (id=1).
-- It assumes the first company registered will have id=1.
-- In a real multi-tenant production environment, this data should be seeded
-- via an admin interface or a function triggered for a specific company.

-- 1. Insert the standard definition, assuming company_id = 1
INSERT INTO public.production_standards (company_id, name, breed)
VALUES (1, 'HyLine Max Pro', 'Hy-Line Brown')
ON CONFLICT (company_id, name) DO NOTHING;

-- 2. Get the id of the standard we just inserted/found
DO $$
DECLARE
  standard_id_val BIGINT;
BEGIN
  SELECT id INTO standard_id_val FROM public.production_standards WHERE name = 'HyLine Max Pro' AND company_id = 1;

  -- 3. Insert the data points if the standard was found
  IF standard_id_val IS NOT NULL THEN
    INSERT INTO public.production_standard_data (standard_id, age_weeks, hen_day_production_percent, cumulative_eggs_per_hen, egg_weight_g, daily_feed_intake_g, body_weight_g, cumulative_feed_intake_kg)
    VALUES
      (standard_id_val, 18, 5.0, 1.8, 51.5, 82, 1450, 0.1),
      (standard_id_val, 19, 25.0, 10.5, 53.0, 88, 1500, 0.7),
      (standard_id_val, 20, 65.0, 33.3, 54.5, 95, 1550, 1.4),
      (standard_id_val, 21, 85.0, 62.8, 56.0, 102, 1600, 2.1),
      (standard_id_val, 22, 92.0, 97.1, 57.5, 108, 1650, 2.9),
      (standard_id_val, 23, 95.0, 133.6, 58.5, 112, 1700, 3.7),
      (standard_id_val, 24, 96.0, 170.8, 59.5, 115, 1750, 4.5),
      (standard_id_val, 25, 96.5, 208.4, 60.5, 117, 1800, 5.3),
      (standard_id_val, 26, 96.5, 246.2, 61.0, 118, 1825, 6.1),
      (standard_id_val, 27, 96.0, 283.4, 61.5, 119, 1850, 6.9),
      (standard_id_val, 28, 95.5, 320.3, 62.0, 120, 1875, 7.8),
      (standard_id_val, 29, 95.0, 357.3, 62.5, 120, 1900, 8.6),
      (standard_id_val, 30, 94.5, 393.6, 63.0, 120, 1925, 9.4),
      (standard_id_val, 31, 94.0, 429.4, 63.2, 120, 1950, 10.3),
      (standard_id_val, 32, 93.5, 464.9, 63.4, 120, 1975, 11.1),
      (standard_id_val, 33, 93.0, 499.9, 63.6, 120, 1980, 12.0),
      (standard_id_val, 34, 92.5, 534.4, 63.8, 120, 1985, 12.8),
      (standard_id_val, 35, 92.0, 568.4, 64.0, 120, 1990, 13.6),
      (standard_id_val, 36, 91.5, 602.0, 64.2, 120, 1995, 14.5),
      (standard_id_val, 37, 91.0, 635.2, 64.4, 120, 2000, 15.3),
      (standard_id_val, 38, 90.5, 668.0, 64.6, 120, 2005, 16.1),
      (standard_id_val, 39, 90.0, 700.3, 64.8, 120, 2010, 17.0),
      (standard_id_val, 40, 89.5, 732.1, 65.0, 120, 2015, 17.8)
    ON CONFLICT (standard_id, age_weeks) DO NOTHING;
  END IF;
END $$;