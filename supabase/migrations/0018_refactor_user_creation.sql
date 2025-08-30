-- Step 1: Drop the old trigger and function that called the edge function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.trigger_on_user_created_webhook();

-- Step 2: Create the new, consolidated function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_invite record;
  v_org_name text;
  v_display_name text;
  v_existing_org_id uuid;
BEGIN
  -- Check for a pending invite for the new user's email
  SELECT * INTO v_invite
  FROM public.invites
  WHERE email = new.email AND status = 'pending'
  LIMIT 1;

  -- Extract metadata
  v_org_name := new.raw_user_meta_data ->> 'organization_name';
  v_display_name := new.raw_user_meta_data ->> 'display_name';

  -- === Invited User Flow ===
  IF v_invite IS NOT NULL THEN
    -- Add the user to the organization from the invite
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_invite.organization_id, new.id, v_invite.role);

    -- Delete the used invite
    DELETE FROM public.invites WHERE id = v_invite.id;

  -- === New Organic User Flow ===
  ELSE
    -- For new registrations, organization_name is required
    IF v_org_name IS NULL OR v_org_name = '' THEN
      RAISE EXCEPTION 'Nama organisasi wajib diisi untuk pendaftaran baru.';
    END IF;

    -- Check for duplicate organization name
    SELECT id INTO v_existing_org_id FROM public.organizations WHERE name = v_org_name;
    IF v_existing_org_id IS NOT NULL THEN
      RAISE EXCEPTION 'Nama organisasi "%" sudah digunakan. Silakan pilih nama lain.', v_org_name;
    END IF;

    -- Create the new organization, the add_owner_membership trigger will handle the rest
    INSERT INTO public.organizations (name, owner_id)
    VALUES (v_org_name, new.id);
  END IF;

  -- === Common Step for All New Users ===
  -- Create a profile for the new user
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, COALESCE(v_display_name, new.email));

  RETURN new;
END;
$$;

-- Step 3: Create the new trigger on the auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();