-- =================================================================
--  Fungsi Database untuk Aplikasi Peternakan
-- =================================================================
--  Jalankan skrip ini di Supabase SQL Editor Anda.
--  Fungsi-fungsi ini memastikan integritas data saat melakukan operasi
--  yang melibatkan beberapa tabel (misalnya, data produksi dan konsumsi pakan).
-- =================================================================

-- =================================================================
--  Fungsi: add_production_data_with_feed
--  Menambahkan catatan produksi baru beserta data konsumsi pakannya dalam satu transaksi.
-- =================================================================
create or replace function public.add_production_data_with_feed(
  p_flock_id bigint,
  p_date date,
  p_normal_eggs integer,
  p_white_eggs integer,
  p_cracked_eggs integer,
  p_normal_eggs_weight_kg numeric,
  p_white_eggs_weight_kg numeric,
  p_cracked_eggs_weight_kg numeric,
  p_feed_consumption jsonb
)
returns bigint
language plpgsql
as $$
declare
  new_production_id bigint;
  feed_item jsonb;
begin
  -- Masukkan data produksi utama dan dapatkan ID-nya
  insert into public.production_data (
    flock_id, date, normal_eggs, white_eggs, cracked_eggs,
    normal_eggs_weight_kg, white_eggs_weight_kg, cracked_eggs_weight_kg
  ) values (
    p_flock_id, p_date, p_normal_eggs, p_white_eggs, p_cracked_eggs,
    p_normal_eggs_weight_kg, p_white_eggs_weight_kg, p_cracked_eggs_weight_kg
  ) returning id into new_production_id;

  -- Ulangi setiap item dalam array JSON konsumsi pakan
  for feed_item in select * from jsonb_array_elements(p_feed_consumption)
  loop
    insert into public.feed_consumption (
      production_data_id,
      feed_code,
      quantity_kg
    ) values (
      new_production_id,
      feed_item->>'feedCode',
      (feed_item->>'quantityKg')::numeric
    );
  end loop;

  return new_production_id;
end;
$$;


-- =================================================================
--  Fungsi: update_production_data_with_feed
--  Memperbarui catatan produksi beserta data konsumsi pakannya dalam satu transaksi.
-- =================================================================
create or replace function public.update_production_data_with_feed(
  p_production_id bigint,
  p_flock_id bigint,
  p_date date,
  p_normal_eggs integer,
  p_white_eggs integer,
  p_cracked_eggs integer,
  p_normal_eggs_weight_kg numeric,
  p_white_eggs_weight_kg numeric,
  p_cracked_eggs_weight_kg numeric,
  p_feed_consumption jsonb
)
returns void
language plpgsql
as $$
declare
  feed_item jsonb;
begin
  -- Perbarui data produksi utama
  update public.production_data
  set
    flock_id = p_flock_id,
    date = p_date,
    normal_eggs = p_normal_eggs,
    white_eggs = p_white_eggs,
    cracked_eggs = p_cracked_eggs,
    normal_eggs_weight_kg = p_normal_eggs_weight_kg,
    white_eggs_weight_kg = p_white_eggs_weight_kg,
    cracked_eggs_weight_kg = p_cracked_eggs_weight_kg
  where id = p_production_id;

  -- Hapus data konsumsi pakan yang lama
  delete from public.feed_consumption where production_data_id = p_production_id;

  -- Masukkan data konsumsi pakan yang baru
  for feed_item in select * from jsonb_array_elements(p_feed_consumption)
  loop
    insert into public.feed_consumption (
      production_data_id,
      feed_code,
      quantity_kg
    ) values (
      p_production_id,
      feed_item->>'feedCode',
      (feed_item->>'quantityKg')::numeric
    );
  end loop;
end;
$$;

-- =================================================================
--  Akhir dari skrip
-- =================================================================