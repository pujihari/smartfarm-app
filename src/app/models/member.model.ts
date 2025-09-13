export type MemberRole = 'owner' | 'manager' | 'supervisor' | 'staff_gudang' | 'operator_kandang';

export interface Member {
  id: string; // UUID
  organization_id: string; // UUID
  user_id: string; // UUID
  role: MemberRole;
  created_at: string;
  // We can join with auth.users to get email/name if needed
}