export type ItemType = 'PAKAN' | 'VITAMIN' | 'OBAT' | 'VAKSIN';

export interface InventoryItem {
  id: number;
  item_type: ItemType;
  item_code?: string;
  name: string;
  quantity: number;
  unit: string;
  farm_id?: number; // New: Optional farm ID
  farmName?: string; // New: For display purposes
}