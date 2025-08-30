import { Injectable } from '@angular/core';
import { from, Observable, throwError } from 'rxjs';
import { map, catchError, switchMap, take } from 'rxjs/operators';
import { InventoryItem } from '../models/inventory-item.model';
import { supabase } from '../supabase.client';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  constructor(private authService: AuthService) {}

  private handleError(error: any, context: string) {
    console.error(`Supabase error in ${context}:`, error);
    return throwError(() => new Error(error.message || `Server error in ${context}`));
  }

  getInventoryItems(): Observable<InventoryItem[]> {
    return from(supabase.from('inventory_items').select('*').order('name')).pipe(
      map(response => {
        if (response.error) throw response.error;
        return (response.data as InventoryItem[]) || [];
      }),
      catchError(err => this.handleError(err, 'getInventoryItems'))
    );
  }

  addInventoryItem(itemData: Omit<InventoryItem, 'id'>): Observable<any> {
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
    const { id, ...updateData } = itemData;
    return from(supabase.from('inventory_items').update(updateData).eq('id', id!)).pipe(catchError(err => this.handleError(err, 'updateInventoryItem')));
  }

  deleteInventoryItem(itemId: number): Observable<any> {
    return from(supabase.from('inventory_items').delete().eq('id', itemId)).pipe(catchError(err => this.handleError(err, 'deleteInventoryItem')));
  }
}