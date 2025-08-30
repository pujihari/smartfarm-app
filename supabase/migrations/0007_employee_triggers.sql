-- This function handles new user creation.
-- It now correctly handles two scenarios:
-- 1. A user who was invited accepts the invitation.
-- 2. A brand new user registers, creating a new company and becoming its Admin.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  employee_record public.employees%ROWTYPE;
  new_company_id BIGINT;
BEGIN
  -- Check if an invitation exists for the new user's email
  SELECT * INTO employee_record FROM public.employees WHERE email = NEW.email AND status = 'INVITED';

  IF FOUND THEN
    -- Case 1: User was invited. Update the existing employee record.
    UPDATE public.employees
    SET
      user_id = NEW.id,
      status = 'ACTIVE',
      full_name = NEW.raw_user_meta_data->>'full_name'
    WHERE email = NEW.email;
  ELSE
    -- Case 2: This is a new company registration. Create a company and an admin employee.
    -- Step 2a: Create a new company record.
    INSERT INTO public.companies (name, owner_id)
    VALUES (
      NEW.raw_user_meta_data->>'company_name',
      NEW.id
    )
    RETURNING id INTO new_company_id;

    -- Step 2b: Create a new employee record for the admin.
    INSERT INTO public.employees (user_id, email, role, status, full_name, company_id)
    VALUES (
      NEW.id,
      NEW.email,
      'Admin', -- Assign 'Admin' role
      'ACTIVE',
      NEW.raw_user_meta_data->>'full_name',
      new_company_id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger that executes the function after a new user is created in the auth schema.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();