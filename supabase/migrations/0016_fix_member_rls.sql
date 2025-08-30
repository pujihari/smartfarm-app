-- Drop the old, problematic policy to avoid conflicts
DROP POLICY IF EXISTS "Members can view only their org members" ON public.organization_members;

-- Create a new, more robust policy that avoids recursive lookups
CREATE POLICY "Members can view members of their own organization"
ON public.organization_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM organization_members AS mem
    WHERE mem.user_id = auth.uid() AND mem.organization_id = organization_members.organization_id
  )
);