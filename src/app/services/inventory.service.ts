import { Injectable } from '@angular/core';
import { from, Observable, throwError } from 'rxjs';
import { map, catchError, switchMap, take } from 'rxjs/operators';
import { InventoryItem, ItemType } from '../models/inventory-item.model';
import { supabase } from '../supabase.client';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  constructor(private authService: AuthService) {}

  private handleError(error: any, context: string) {
    console.error(`Supabase error in ${context}:`, error);
    return throwError(() => new Error(error.message || `Server error in ${context}`));
  }

  getInventoryItems(farmId: number | null = null, itemType: ItemType | null = null, searchTerm: string = ''): Observable<InventoryItem[]> {
    let query = supabase.from('inventory_items').select('*, farms!left(name)').order('name');

    if (farmId) {
      query = query.eq('farm_id', farmId);
    } else {
      // If no specific farm is selected, also include items with null farm_id (global items)
      // This is handled by RLS, but explicitly stating it here for clarity if needed for future complex queries
      // For now, the RLS policy 'Akses inventori organisasi sendiri' handles this by checking organization_id
    }

    if (itemType) {
      query = query.eq('item_type', itemType);
    }

    if (searchTerm) {
      // Perform a case-insensitive search on item name or item code
      query = query.or(`name.ilike.%${searchTerm}%,item_code.ilike.%${searchTerm}%`);
    }

    return from(query).pipe(
      map(response => {
        if (response.error) throw response.error;
        return (response.data || []).map((item: any) => ({
          ...item,
          farmName: (item.farms as any)?.name || 'Global' // 'Global' if farm_id is null
        })) as InventoryItem[];
      }),
      catchError(err => this.handleError(err, 'getInventoryItems'))
    );
  }

  addInventoryItem(itemData: Omit<InventoryItem, 'id' | 'farmName'>): Observable<any> {
    return this.authService.organizationId$.pipe(
      take(1),
      switchMap(organizationId => {
        if (!organizationId) {
          return throwError(() => new Error('ID Organisasi tidak ditemukan.'));
        }
        const dataToInsert = { ...itemData, organization_id: organizationId };
        return from(supabase.from('inventory_items').insert([dataToInsert]));
      }),
      catchError(err => this.handleError(err, 'addInventoryItem'))
    );
  }

  updateInventoryItem(itemData: Partial<InventoryItem>): Observable<any> {
    const { id, farmName, ...updateData } = itemData; // Remove farmName before updating
    return from(supabase.from('inventory_items').update(updateData).eq('id', id!)).pipe(catchError(err => this.handleError(err, 'updateInventoryItem')));
  }

  deleteInventoryItem(itemId: number): Observable<any> {
    return from(supabase.from('inventory_items').delete().eq('id', itemId)).pipe(catchError(err => this.handleError(err, 'deleteInventoryItem')));
  }
}