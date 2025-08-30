-- Allow organization owners to insert a new organization record where they are the owner.
-- This is necessary for the sign-up process where a new user creates their own organization.
CREATE POLICY "Owners can create their own organization."
ON public.organizations
FOR INSERT
WITH CHECK (owner_id = auth.uid());