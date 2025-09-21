import { Injectable } from '@angular/core';
import { from, Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { BodyWeightData } from '../models/body-weight.model';
import { supabase } from '../supabase.client';

@Injectable({ providedIn: 'root' })
export class BodyWeightService {
  constructor() {}

  private handleError(error: any, context: string) {
    console.error(`Supabase error in ${context}:`, error);
    return throwError(() => new Error(error.message || `Server error in ${context}`));
  }

  getBodyWeightHistory(): Observable<(BodyWeightData & { flockName: string, farmName: string })[]> {
    return from(supabase.from('body_weight_data').select('*, flocks!inner(name, farms!inner(name))').order('weighing_date', { ascending: false })).pipe(
      map(response => {
        if (response.error) throw response.error;
        return (response.data || []).map((item: any) => ({
          ...item,
          flockName: (item.flocks as any)?.name || 'N/A',
          farmName: (item.flocks as any)?.farms?.name || 'N/A'
        })) as (BodyWeightData & { flockName: string, farmName: string })[];
      }),
      catchError(err => this.handleError(err, 'getBodyWeightHistory'))
    );
  }

  getBodyWeightHistoryByFlockId(flockId: number, startDate?: string, endDate?: string): Observable<BodyWeightData[]> {
    let query = supabase.from('body_weight_data').select('*').eq('flock_id', flockId).order('weighing_date', { ascending: true });

    if (startDate) {
      query = query.gte('weighing_date', startDate);
    }
    if (endDate) {
      query = query.lte('weighing_date', endDate);
    }

    return from(query).pipe(
      map(response => {
        if (response.error) throw response.error;
        return response.data || [];
      }),
      catchError(err => this.handleError(err, 'getBodyWeightHistoryByFlockId'))
    );
  }

  saveBodyWeightData(data: Omit<BodyWeightData, 'id'>): Observable<any> {
    const params = {
      p_flock_id: data.flock_id,
      p_weighing_date: data.weighing_date,
      p_age_days: data.age_days,
      p_avg_body_weight_actual: data.avg_body_weight_actual,
      p_avg_body_weight_standard: data.avg_body_weight_standard ?? null,
      p_uniformity_percentage: data.uniformity_percentage
    };
    return from(supabase.rpc('upsert_body_weight_data', params)).pipe(
      catchError(err => this.handleError(err, 'saveBodyWeightData'))
    );
  }

  deleteBodyWeightData(id: number): Observable<any> {
    return from(supabase.from('body_weight_data').delete().eq('id', id)).pipe(
      catchError(err => this.handleError(err, 'deleteBodyWeightData'))
    );
  }
}