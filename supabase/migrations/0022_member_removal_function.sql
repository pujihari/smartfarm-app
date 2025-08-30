-- Function to allow an owner to remove a member from their organization
create or replace function remove_organization_member(p_user_id_to_remove uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_caller_user_id uuid := auth.uid();
  v_caller_org_id uuid;
  v_caller_role text;
  v_member_org_id uuid;
begin
  -- Ensure the caller is not trying to remove themselves
  if v_caller_user_id = p_user_id_to_remove then
    raise exception 'Owners cannot remove themselves from the organization.';
  end if;

  -- Get the caller's organization and role
  select organization_id, role into v_caller_org_id, v_caller_role
  from organization_members
  where user_id = v_caller_user_id;

  -- Check if the caller is an owner
  if v_caller_role is null or v_caller_role <> 'owner' then
    raise exception 'Only organization owners can remove members.';
  end if;

  -- Get the organization of the member to be removed
  select organization_id into v_member_org_id
  from organization_members
  where user_id = p_user_id_to_remove;

  -- Check if the member exists and is in the same organization as the owner
  if v_member_org_id is null then
    raise exception 'Member not found.';
  end if;
  
  if v_member_org_id <> v_caller_org_id then
    raise exception 'You can only remove members from your own organization.';
  end if;

  -- If all checks pass, delete the member
  delete from organization_members
  where user_id = p_user_id_to_remove and organization_id = v_caller_org_id;

end;
$$;

-- Grant execute permission to authenticated users
grant execute on function remove_organization_member(uuid) to authenticated;