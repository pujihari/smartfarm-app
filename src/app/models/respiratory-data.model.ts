export interface RespiratoryData {
  id: number;
  flock_id: number;
  check_date: string; // ISO date string
  respiratory_score: number;
  symptoms: string[];
  notes?: string;
}