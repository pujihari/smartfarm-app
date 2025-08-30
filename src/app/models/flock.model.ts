export interface Flock {
  id: number;
  farm_id: number;
  organization_id: string;
  name: string;
  breed: string;
  population: number;
  start_date: string; // ISO date string
  entry_age_days: number;
  status: 'Aktif' | 'Selesai';
}