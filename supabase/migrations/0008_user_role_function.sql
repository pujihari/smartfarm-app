-- Fungsi ini mengambil peran (role) pengguna yang sedang login dari tabel employees.
-- Ini akan digunakan dalam Aturan Keamanan (RLS Policies).
create or replace function public.get_user_role()
returns text
language sql
security definer
as $$
  select role from public.employees where user_id = auth.uid()
$$;