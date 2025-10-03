export interface Farm {
  id: number;
  name: string;
  location: string;
  type: 'Grower' | 'Layer'; // New: Type of farm
  activeFlocks: number;
  population: number;
  status: 'Aktif' | 'Tidak Aktif';
}