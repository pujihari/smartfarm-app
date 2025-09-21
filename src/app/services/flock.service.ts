import { Injectable } from '@angular/core';
import { from, Observable, throwError } from 'rxjs';
import { map, catchError, switchMap, take } from 'rxjs/operators';
import { Flock } from '../models/flock.model';
import { supabase } from '../supabase.client';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class FlockService {
  constructor(private authService: AuthService) {}

  private handleError(error: any, context: string) {
    console.error(`Supabase error in ${context}:`, error);
    return throwError(() => new Error(error.message || `Server error in ${context}`));
  }

  getFlocksByFarmId(farmId: number): Observable<Flock[]> {
    return from(supabase.from('flocks').select('*').eq('farm_id', farmId)).pipe(
      map(response => {
        if (response.error) throw response.error;
        return (response.data as Flock[]) || [];
      }),
      catchError(err => this.handleError(err, 'getFlocksByFarmId'))
    );
  }

  getFlocksWithFarmInfo(): Observable<(Flock & { farmName: string })[]> {
    console.log('Fetching flocks with farm info...');
    return from(supabase.from('flocks').select('*, farms ( name )')).pipe(
      map(response => {
        if (response.error) {
          console.error('Supabase error in getFlocksWithFarmInfo:', response.error);
          throw response.error;
        }
        console.log('Flocks data received:', response.data);
        return (response.data || []).map((flock: any) => ({
          ...flock,
          farmName: (flock.farms as any)?.name || 'N/A'
        })) as (Flock & { farmName: string })[];
      }),
      catchError(err => {
        console.error('Caught error in getFlocksWithFarmInfo pipe:', err);
        return this.handleError(err, 'getFlocksWithFarmInfo');
      })
    );
  }

  getFlockById(id: number): Observable<Flock & { farmName: string } | undefined> {
    return from(supabase.from('flocks').select('*, farms ( name )').eq('id', id).single()).pipe(
      map(response => {
        if (response.error && response.error.code !== 'PGRST116') throw response.error;
        if (!response.data) return undefined;
        return {
          ...response.data,
          farmName: (response.data.farms as any)?.name || 'N/A'
        } as Flock & { farmName: string };
      }),
      catchError(err => this.handleError(err, 'getFlockById'))
    );
  }

  addFlock(flockData: Omit<Flock, 'id' | 'organization_id'>): Observable<any> {
    return this.authService.organizationId$.pipe(
      take(1),
      switchMap(organizationId => {
        if (!organizationId) {
          return throwError(() => new Error('ID Organisasi tidak ditemukan.'));
        }
        const dataToInsert = { ...flockData, organization_id: organizationId };
        return from(supabase.from('flocks').insert([dataToInsert]));
      }),
      catchError(err => this.handleError(err, 'addFlock'))
    );
  }

  updateFlock(flockData: Partial<Flock>): Observable<any> {
    const { id, ...updateData } = flockData;
    return from(supabase.from('flocks').update(updateData).eq('id', id!)).pipe(catchError(err => this.handleError(err, 'updateFlock')));
  }

  deleteFlock(flockId: number): Observable<any> {
    return from(supabase.from('flocks').delete().eq('id', flockId)).pipe(catchError(err => this.handleError(err, 'deleteFlock')));
  }
}