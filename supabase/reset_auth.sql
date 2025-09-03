-- WARNING: This script will delete ALL users from your project.
-- This action is irreversible and will also delete related data in other tables.
-- Run this only if you want to start completely fresh.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Iterate over all users and delete them one by one
    -- This is the recommended way to ensure all related data and hooks are handled correctly.
    FOR r IN (SELECT id FROM auth.users) LOOP
        PERFORM auth.admin.delete_user(r.id);
    END LOOP;
END $$;

-- Optional: If you also want to clear out old invites, you can run this line too.
-- TRUNCATE TABLE public.invites;