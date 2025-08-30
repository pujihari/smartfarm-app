-- Migrasi untuk menerapkan Row Level Security (RLS) dan fungsi bantuan.

-- 1. Fungsi Bantuan

-- Fungsi untuk mendapatkan organization_id pengguna saat ini.
create or replace function get_my_organization_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select organization_id from organization_members where user_id = auth.uid() limit 1;
$$;

-- Fungsi untuk mendapatkan peran pengguna saat ini dalam organisasinya.
create or replace function get_my_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role from organization_members where user_id = auth.uid() limit 1;
$$;


-- 2. Kebijakan Keamanan (RLS Policies)

-- Tabel: organizations
alter table organizations enable row level security;
create policy "Users can view their own organization" on organizations for select using (id = get_my_organization_id());
create policy "Owners can update their own organization" on organizations for update using (id = get_my_organization_id() and get_my_role() = 'owner');

-- Tabel: profiles
alter table profiles enable row level security;
create policy "Users can view their own profile" on profiles for select using (id = auth.uid());
create policy "Users can update their own profile" on profiles for update using (id = auth.uid());

-- Tabel: organization_members
alter table organization_members enable row level security;
create policy "Members can view other members of their organization" on organization_members for select using (organization_id = get_my_organization_id());
create policy "Owners can manage members in their organization" on organization_members for all using (organization_id = get_my_organization_id() and get_my_role() = 'owner');

-- Tabel: invites
alter table invites enable row level security;
create policy "Members can view invites for their organization" on invites for select using (organization_id = get_my_organization_id());
create policy "Owners can manage invites for their organization" on invites for all using (organization_id = get_my_organization_id() and get_my_role() = 'owner');

-- Tabel: farms
alter table farms enable row level security;
create policy "Members can view farms in their organization" on farms for select using (organization_id = get_my_organization_id());
create policy "Owners can manage farms in their organization" on farms for all using (organization_id = get_my_organization_id() and get_my_role() = 'owner');

-- Tabel: flocks
alter table flocks enable row level security;
create policy "Members can view flocks in their organization" on flocks for select using (organization_id = get_my_organization_id());
create policy "Owners can manage flocks in their organization" on flocks for all using (organization_id = get_my_organization_id() and get_my_role() = 'owner');

-- Tabel: production_data
alter table production_data enable row level security;
create policy "Members can manage production data in their organization" on production_data for all using (organization_id = get_my_organization_id());

-- Tabel: feed_consumption
alter table feed_consumption enable row level security;
create policy "Members can manage feed consumption data in their organization" on feed_consumption for all using (organization_id = get_my_organization_id());

-- Tabel: health_events
alter table health_events enable row level security;
create policy "Members can manage health events in their organization" on health_events for all using (organization_id = get_my_organization_id());

-- Tabel: body_weight_data
alter table body_weight_data enable row level security;
create policy "Members can manage body weight data in their organization" on body_weight_data for all using (organization_id = get_my_organization_id());

-- Tabel: respiratory_data
alter table respiratory_data enable row level security;
create policy "Members can manage respiratory data in their organization" on respiratory_data for all using (organization_id = get_my_organization_id());

-- Tabel: inventory_items
alter table inventory_items enable row level security;
create policy "Members can view inventory in their organization" on inventory_items for select using (organization_id = get_my_organization_id());
create policy "Owners can manage inventory in their organization" on inventory_items for all using (organization_id = get_my_organization_id() and get_my_role() = 'owner');