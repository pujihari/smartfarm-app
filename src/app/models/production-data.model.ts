export interface FeedConsumption {
  feed_code: string;
  quantity_kg: number;
}

export interface ProductionData {
  id: number;
  flock_id: number;
  date: string; // ISO date string
  normal_eggs: number;
  white_eggs: number;
  cracked_eggs: number;
  normal_eggs_weight_kg: number;
  white_eggs_weight_kg: number;
  cracked_eggs_weight_kg: number;
  feed_consumption: FeedConsumption[];
  mortality_count?: number; // New optional field
  culling_count?: number; // New optional field
}