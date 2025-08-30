-- Function to check if a user is already a member or invited
CREATE OR REPLACE FUNCTION public.get_member_status_by_email(p_email text, p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_status jsonb;
BEGIN
  -- Check for active members
  SELECT jsonb_build_object('status', 'active')
  INTO member_status
  FROM public.organization_members om
  JOIN auth.users u ON om.user_id = u.id
  WHERE u.email = p_email AND om.organization_id = p_org_id;

  IF member_status IS NOT NULL THEN
    RETURN member_status;
  END IF;

  -- Check for pending invites
  SELECT jsonb_build_object('status', 'invited')
  INTO member_status
  FROM public.invites i
  WHERE i.email = p_email AND i.organization_id = p_org_id AND i.status = 'pending';

  RETURN member_status;
END;
$$;

-- Function to get all members and pending invites for an organization
CREATE OR REPLACE FUNCTION public.get_organization_members_with_invites()
RETURNS TABLE(id uuid, user_id uuid, role text, email text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get the organization_id of the currently authenticated user
  SELECT organization_id INTO v_org_id
  FROM public.organization_members
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  -- Return a union of active members and pending invites
  RETURN QUERY
  -- Active members
  SELECT
    om.id,
    om.user_id,
    om.role,
    u.email,
    'active' AS status
  FROM
    public.organization_members om
  JOIN
    auth.users u ON om.user_id = u.id
  WHERE
    om.organization_id = v_org_id
  
  UNION ALL
  
  -- Pending invites
  SELECT
    i.id,
    NULL AS user_id,
    i.role,
    i.email,
    'invited' AS status
  FROM
    public.invites i
  WHERE
    i.organization_id = v_org_id
    AND i.status = 'pending';
END;
$$;