export interface HealthEvent {
  id: number;
  flock_id: number;
  organization_id: string;
  event_type: 'Vaksinasi' | 'Pengobatan' | 'Penyakit';
  description: string;
  date: string; // ISO date string
  notes?: string;
}