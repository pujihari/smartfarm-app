import { Injectable } from '@angular/core';
import { from, Observable, throwError } from 'rxjs';
import { map, catchError, switchMap, take } from 'rxjs/operators';
import { RespiratoryData } from '../models/respiratory-data.model';
import { supabase } from '../supabase.client';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class RespiratoryService {
  constructor(private authService: AuthService) {}

  private handleError(error: any, context: string) {
    console.error(`Supabase error in ${context}:`, error);
    return throwError(() => new Error(error.message || `Server error in ${context}`));
  }

  getRespiratoryHistory(): Observable<(RespiratoryData & { flockName: string, farmName: string })[]> {
    return from(supabase.from('respiratory_data').select('*, flocks!inner(name, farms!inner(name))').order('check_date', { ascending: false })).pipe(
      map(response => {
        if (response.error) throw response.error;
        return (response.data || []).map((item: any) => ({
          ...item,
          flockName: (item.flocks as any)?.name || 'N/A',
          farmName: (item.flocks as any)?.farms?.name || 'N/A'
        })) as (RespiratoryData & { flockName: string, farmName: string })[];
      }),
      catchError(err => this.handleError(err, 'getRespiratoryHistory'))
    );
  }

  saveRespiratoryData(data: Omit<RespiratoryData, 'id'>): Observable<any> {
    return this.authService.organizationId$.pipe(
      take(1),
      switchMap(organizationId => {
        if (!organizationId) {
          return throwError(() => new Error('ID Organisasi tidak ditemukan.'));
        }
        const dataToInsert = { ...data, organization_id: organizationId };
        // Using upsert to handle unique constraint on (flock_id, check_date)
        return from(supabase.from('respiratory_data').upsert(dataToInsert, { onConflict: 'flock_id,check_date' }));
      }),
      catchError(err => this.handleError(err, 'saveRespiratoryData'))
    );
  }

  deleteRespiratoryData(id: number): Observable<any> {
    return from(supabase.from('respiratory_data').delete().eq('id', id)).pipe(
      catchError(err => this.handleError(err, 'deleteRespiratoryData'))
    );
  }
}