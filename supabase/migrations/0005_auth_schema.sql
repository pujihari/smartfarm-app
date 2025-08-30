-- =================================================================
--  Skema Otentikasi untuk Aplikasi Peternakan
-- =================================================================
--  Jalankan skrip ini di Supabase SQL Editor Anda.
-- =================================================================

-- =================================================================
--  Tabel: profiles
--  Menyimpan data publik untuk pengguna, ditautkan ke auth.users.
-- =================================================================
create table if not exists public.profiles (
  id uuid not null primary key references auth.users(id) on delete cascade,
  username text,
  role text default 'user'
);

-- Mengaktifkan RLS
alter table public.profiles enable row level security;

-- Kebijakan: Pengguna dapat melihat semua profil (untuk saat ini).
create policy "Allow users to view profiles"
on public.profiles for select
to authenticated
using (true);

-- Kebijakan: Pengguna dapat memperbarui profil mereka sendiri.
create policy "Allow users to update their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id);

-- =================================================================
--  Fungsi & Pemicu: handle_new_user
--  Secara otomatis membuat baris profil saat pengguna baru mendaftar.
-- =================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.email);
  return new;
end;
$$;

-- Pemicu: pemicu_setelah_pengguna_dibuat
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =================================================================
--  Memperbarui Kebijakan Keamanan (RLS)
--  Mengganti kebijakan 'anon' menjadi 'authenticated' untuk keamanan.
-- =================================================================

-- Hapus kebijakan lama yang terlalu permisif
drop policy if exists "Allow anon users to manage company profile" on public.company_profile;
drop policy if exists "Allow anon users to manage farms" on public.farms;
drop policy if exists "Allow anon users to manage flocks" on public.flocks;
drop policy if exists "Allow anon users to manage health events" on public.health_events;
drop policy if exists "Allow anon users to manage production data" on public.production_data;
drop policy if exists "Allow anon users to manage feed consumption" on public.feed_consumption;
drop policy if exists "Allow anon users to manage inventory" on public.inventory_items;

-- Buat kebijakan baru yang aman
create policy "Allow authenticated users to manage company profile" on public.company_profile for all to authenticated using (true) with check (true);
create policy "Allow authenticated users to manage farms" on public.farms for all to authenticated using (true) with check (true);
create policy "Allow authenticated users to manage flocks" on public.flocks for all to authenticated using (true) with check (true);
create policy "Allow authenticated users to manage health events" on public.health_events for all to authenticated using (true) with check (true);
create policy "Allow authenticated users to manage production data" on public.production_data for all to authenticated using (true) with check (true);
create policy "Allow authenticated users to manage feed consumption" on public.feed_consumption for all to authenticated using (true) with check (true);
create policy "Allow authenticated users to manage inventory" on public.inventory_items for all to authenticated using (true) with check (true);

-- =================================================================
--  Akhir dari skrip
-- =================================================================