import { Injectable } from '@angular/core';
import { from, Observable, throwError } from 'rxjs';
import { map, catchError, switchMap, take, filter } from 'rxjs/operators';
import { HealthEvent } from '../models/health-event.model';
import { supabase } from '../supabase.client';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class HealthService {
  constructor(private authService: AuthService) {}

  private handleError(error: any, context: string) {
    console.error(`Supabase error in ${context}:`, error);
    return throwError(() => new Error(error.message || `Server error in ${context}`));
  }

  getHealthEventsWithDetails(): Observable<(HealthEvent & { flockName: string, farmName: string })[]> {
    return from(supabase.from('health_events').select('*, flocks!inner(name, farms!inner(name))')).pipe(
      map(response => {
        if (response.error) throw response.error;
        return (response.data || []).map((event: any) => ({
          ...event,
          flockName: (event.flocks as any)?.name || 'N/A',
          farmName: (event.flocks as any)?.farms?.name || 'N/A'
        })) as (HealthEvent & { flockName: string, farmName: string })[];
      }),
      catchError(err => this.handleError(err, 'getHealthEventsWithDetails'))
    );
  }

  getHealthEventsByFlockId(flockId: number, startDate?: string, endDate?: string): Observable<HealthEvent[]> {
    let query = supabase.from('health_events').select('*').eq('flock_id', flockId).order('date', { ascending: true });

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    return from(query).pipe(
      map(response => {
        if (response.error) throw response.error;
        return response.data || [];
      }),
      catchError(err => this.handleError(err, 'getHealthEventsByFlockId'))
    );
  }

  addHealthEvent(eventData: Omit<HealthEvent, 'id' | 'organization_id'>): Observable<any> {
    return this.authService.organizationId$.pipe(
      filter(organizationId => !!organizationId), // Ensure organizationId is not null
      take(1),
      switchMap(organizationId => {
        if (!organizationId) {
          return throwError(() => new Error('ID Organisasi tidak ditemukan.'));
        }
        const dataToInsert = { ...eventData, organization_id: organizationId };
        return from(supabase.from('health_events').insert([dataToInsert]));
      }),
      catchError(err => this.handleError(err, 'addHealthEvent'))
    );
  }

  updateHealthEvent(eventData: Partial<HealthEvent>): Observable<any> {
    const { id, ...updateData } = eventData;
    return from(supabase.from('health_events').update(updateData).eq('id', id!)).pipe(catchError(err => this.handleError(err, 'updateHealthEvent')));
  }

  deleteHealthEvent(eventId: number): Observable<any> {
    return from(supabase.from('health_events').delete().eq('id', eventId)).pipe(catchError(err => this.handleError(err, 'deleteHealthEvent')));
  }
}