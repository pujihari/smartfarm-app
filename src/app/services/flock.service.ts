import { Injectable } from '@angular/core';
import { from, Observable, throwError } from 'rxjs';
import { map, catchError, switchMap, take, filter } from 'rxjs/operators';
import { Flock } from '../models/flock.model';
import { supabase } from '../supabase.client';
import { AuthService } from './auth.service';
import { Farm } from '../models/farm.model'; // Import Farm model

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

  getFlocksWithFarmInfo(farmTypeFilter?: 'Grower' | 'Layer'): Observable<(Flock & { farmName: string, farmType: 'Grower' | 'Layer' })[]> {
    console.log('Fetching flocks with farm info...');
    let query = supabase.from('flocks').select('*, farms!inner(name, type)'); // Select farm type
    
    if (farmTypeFilter) {
      query = query.eq('farms.type', farmTypeFilter); // Filter by farm type
    }

    return from(query).pipe(
      map(response => {
        if (response.error) {
          console.error('Supabase error in getFlocksWithFarmInfo:', response.error);
          throw response.error;
        }
        console.log('Flocks data received:', response.data);
        return (response.data || []).map((flock: any) => ({
          ...flock,
          farmName: (flock.farms as any)?.name || 'N/A',
          farmType: (flock.farms as any)?.type || 'Layer' // Default to 'Layer' if not set
        })) as (Flock & { farmName: string, farmType: 'Grower' | 'Layer' })[];
      }),
      catchError(err => {
        console.error('Caught error in getFlocksWithFarmInfo pipe:', err);
        return this.handleError(err, 'getFlocksWithFarmInfo');
      })
    );
  }

  getFlockById(id: number): Observable<Flock & { farmName: string, farmType: 'Grower' | 'Layer' } | undefined> {
    return from(supabase.from('flocks').select('*, farms!inner(name, type)').eq('id', id).single()).pipe(
      map(response => {
        if (response.error && response.error.code !== 'PGRST116') throw response.error;
        if (!response.data) return undefined;
        return {
          ...response.data,
          farmName: (response.data.farms as any)?.name || 'N/A',
          farmType: (response.data.farms as any)?.type || 'Layer'
        } as Flock & { farmName: string, farmType: 'Grower' | 'Layer' };
      }),
      catchError(err => this.handleError(err, 'getFlockById'))
    );
  }

  addFlock(flockData: Omit<Flock, 'id' | 'organization_id'>): Observable<any> {
    return this.authService.organizationId$.pipe(
      filter(organizationId => !!organizationId), // Ensure organizationId is not null
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