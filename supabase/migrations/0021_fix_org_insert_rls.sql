CREATE POLICY "Allow authenticated users to create their own organization"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());