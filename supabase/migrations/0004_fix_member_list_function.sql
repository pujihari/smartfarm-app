-- Migrasi untuk memperbaiki kesalahan tipe data pada fungsi get_organization_members_with_invites.

-- Hapus fungsi lama yang salah
DROP FUNCTION IF EXISTS public.get_organization_members_with_invites();

-- Buat kembali fungsi dengan tipe data yang benar
create or replace function public.get_organization_members_with_invites()
returns table(id text, user_id uuid, role text, email text, status text) -- Mengubah tipe 'id' menjadi text
language sql
security definer
set search_path = public
as $$
  select
    om.id::text, -- Mengubah id menjadi text
    om.user_id,
    om.role,
    u.email,
    'active' as status
  from organization_members om
  join auth.users u on om.user_id = u.id
  where om.organization_id = get_my_organization_id()
  union all
  select
    i.id::text, -- Mengubah id menjadi text
    null as user_id,
    i.role,
    i.email,
    'invited' as status
  from invites i
  where i.organization_id = get_my_organization_id() and i.status = 'pending';
$$;