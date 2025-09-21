import { Injectable } from '@angular/core';
import { from, Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { supabase } from '../supabase.client';

export interface MortalityData {
  id: number;
  flock_id: number;
  organization_id: string;
  date: string; // ISO date string
  mortality_count: number;
  culling_count: number;
  notes?: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class MortalityService {
  constructor() {}

  private handleError(error: any, context: string) {
    console.error(`Supabase error in ${context}:`, error);
    return throwError(() => new Error(error.message || `Server error in ${context}`));
  }

  getMortalityDataByFlockId(flockId: number, startDate?: string, endDate?: string): Observable<MortalityData[]> {
    let query = supabase.from('mortality_data').select('*').eq('flock_id', flockId).order('date', { ascending: true });

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
      catchError(err => this.handleError(err, 'getMortalityDataByFlockId'))
    );
  }

  // Add, update, delete methods can be added here if needed for direct mortality management
  // For now, mortality is primarily handled via add_daily_log RPC
}