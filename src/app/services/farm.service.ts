import { Injectable } from '@angular/core';
import { from, Observable, combineLatest, throwError, of } from 'rxjs';
import { map, catchError, switchMap, take, filter } from 'rxjs/operators';
import { Farm } from '../models/farm.model';
import { supabase } from '../supabase.client';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class FarmService {
  constructor(private authService: AuthService) {}

  private handleError(error: any, context: string) {
    console.error(`Supabase error in ${context}:`, error);
    return throwError(() => new Error(error.message || `Server error in ${context}`));
  }

  addFarm(farmData: { name: string, location: string, type: 'Grower' | 'Layer' }): Observable<any> {
    return this.authService.organizationId$.pipe(
      filter(organizationId => !!organizationId), // Ensure organizationId is not null
      take(1), // Keep take(1) for single-shot operations
      switchMap(organizationId => {
        if (!organizationId) {
          return throwError(() => new Error('ID Organisasi tidak ditemukan.'));
        }
        const dataToInsert = { ...farmData, organization_id: organizationId };
        return from(supabase.from('farms').insert([dataToInsert]));
      }),
      catchError(err => this.handleError(err, 'addFarm'))
    );
  }
  
  getFarms(typeFilter?: 'Grower' | 'Layer'): Observable<Farm[]> { // Added typeFilter parameter
    return this.authService.organizationId$.pipe(
      filter(organizationId => !!organizationId),
      switchMap(organizationId => {
        let query = supabase.from('farms').select('*').eq('organization_id', organizationId).order('name');
        if (typeFilter) {
          query = query.eq('type', typeFilter); // Apply type filter
        }

        const farms$ = from(query).pipe(
          map(response => {
            if (response.error) throw response.error;
            return response.data || [];
          }),
          catchError(err => this.handleError(err, 'getFarms'))
        );

        const activeFlocks$ = from(supabase.from('flocks').select('farm_id, population').eq('organization_id', organizationId).eq('status', 'Aktif')).pipe(
          map(response => {
            if (response.error) throw response.error;
            return response.data || [];
          }),
          catchError(err => this.handleError(err, 'getFarms (activeFlocks)'))
        );

        return combineLatest([farms$, activeFlocks$]).pipe(
          map(([farms, activeFlocks]) => {
            return farms.map((farm: any) => {
              const farmFlocks = activeFlocks.filter((flock: any) => flock.farm_id === farm.id);
              const population = farmFlocks.reduce((sum: number, flock: any) => sum + flock.population, 0);
              const activeFlocksCount = farmFlocks.length;
              return {
                ...farm,
                activeFlocks: activeFlocksCount,
                population: population,
                status: activeFlocksCount > 0 ? 'Aktif' : 'Tidak Aktif'
              } as Farm;
            });
          })
        );
      })
    );
  }

  getFarmById(id: number): Observable<Farm | undefined> {
    return this.authService.organizationId$.pipe(
      filter(organizationId => !!organizationId),
      switchMap(organizationId => {
        const farm$ = from(supabase.from('farms').select('*').eq('id', id).eq('organization_id', organizationId).single()).pipe(
          map(response => {
            if (response.error && response.error.code !== 'PGRST116') throw response.error;
            return response.data;
          }),
          catchError(err => this.handleError(err, 'getFarmById'))
        );

        const activeFlocks$ = from(supabase.from('flocks').select('farm_id, population').eq('status', 'Aktif').eq('farm_id', id).eq('organization_id', organizationId)).pipe(
          map(response => {
            if (response.error) throw response.error;
            return response.data || [];
          }),
          catchError(err => this.handleError(err, 'getFarmById (activeFlocks)'))
        );

        return combineLatest([farm$, activeFlocks$]).pipe(
          map(([farm, activeFlocks]) => {
            if (!farm) return undefined;
            const population = activeFlocks.reduce((sum: number, flock: any) => sum + flock.population, 0);
            const activeFlocksCount = activeFlocks.length;
            return {
              ...farm,
              activeFlocks: activeFlocksCount,
              population: population,
              status: activeFlocksCount > 0 ? 'Aktif' : 'Tidak Aktif'
            } as Farm;
          })
        );
      })
    );
  }

  updateFarm(farmData: Partial<Farm>): Observable<any> {
    const { id, name, location, type } = farmData; // Include type in update
    return from(supabase.from('farms').update({ name, location, type }).eq('id', id!)).pipe(catchError(err => this.handleError(err, 'updateFarm')));
  }

  deleteFarm(farmId: number): Observable<any> {
    return from(supabase.from('farms').delete().eq('id', farmId)).pipe(catchError(err => this.handleError(err, 'deleteFarm')));
  }
}