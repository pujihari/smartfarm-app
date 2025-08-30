export interface Farm {
  id: number;
  name: string;
  location: string;
  activeFlocks: number;
  population: number;
  status: 'Aktif' | 'Tidak Aktif';
}