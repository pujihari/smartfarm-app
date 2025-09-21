-- Menambahkan batasan unik pada kombinasi standard_id dan age_weeks
-- Ini diperlukan agar klausa ON CONFLICT dapat berfungsi dengan benar.
ALTER TABLE public.production_standard_data
ADD CONSTRAINT unique_standard_age UNIQUE (standard_id, age_weeks);