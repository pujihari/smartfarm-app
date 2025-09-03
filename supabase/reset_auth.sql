-- WARNING: This script will delete ALL users from your project.
-- This action is irreversible and will also delete related data in other tables.
-- Run this only if you want to start completely fresh.

-- Step 1: Create a temporary function with the necessary permissions.
-- The SECURITY DEFINER clause is crucial as it runs the function with the permissions of the creator (the postgres superuser).
CREATE OR REPLACE FUNCTION delete_all_auth_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
BEGIN
    -- Iterate over all users and delete them using the admin function.
    FOR r IN (SELECT id FROM auth.users) LOOP
        PERFORM auth.admin.delete_user(r.id);
    END LOOP;
END $$;

-- Step 2: Execute the function to delete all users.
SELECT delete_all_auth_users();

-- Step 3: Clean up by removing the temporary function.
DROP FUNCTION delete_all_auth_users();

-- Optional: If you also want to clear out old invites, you can uncomment and run this line.
-- TRUNCATE TABLE public.invites;