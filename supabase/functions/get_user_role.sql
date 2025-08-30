create or replace function public.get_user_role()
returns text
language sql
security definer
as $$
  select role from public.employees where user_id = auth.uid()
$$;