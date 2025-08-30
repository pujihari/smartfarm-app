export interface Organization {
  id: string; // UUID
  name: string;
  logo_url?: string;
  owner_id: string; // UUID
  created_at: string;
}