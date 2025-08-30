export interface BodyWeightData {
  id: number;
  flock_id: number;
  weighing_date: string; // ISO date string
  age_days: number;
  avg_body_weight_actual: number;
  avg_body_weight_standard?: number;
  uniformity_percentage: number;
}