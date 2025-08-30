import { Injectable } from '@angular/core';
import { from, Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ProductionData } from '../models/production-data.model';
import { supabase } from '../supabase.client';

@Injectable({ providedIn: 'root' })
export class ProductionService {
  constructor() {}

  private handleError(error: any, context: string) {
    console.error(`Supabase error in ${context}:`, error);
    return throwError(() => new Error(error.message || `Server error in ${context}`));
  }

  getProductionDataWithDetails(): Observable<(ProductionData & { flockName: string, farmName: string, totalEggCount: number, totalFeedConsumption: number, totalEggWeightKg: number, flockPopulation: number })[]> {
    return from(supabase.from('production_data').select('*, feed_consumption(*), flocks!inner(name, population, farms!inner(name))')).pipe(
      map(response => {
        if (response.error) throw response.error;
        const dataWithDetails = (response.data || []).map((item: any) => {
          const totalEggCount = (item.normal_eggs || 0) + (item.white_eggs || 0) + (item.cracked_eggs || 0);
          const totalFeedConsumption = (item.feed_consumption || []).reduce((sum: number, feed: { quantity_kg: number }) => sum + (feed.quantity_kg || 0), 0);
          const totalEggWeightKg = (item.normal_eggs_weight_kg || 0) + (item.white_eggs_weight_kg || 0) + (item.cracked_eggs_weight_kg || 0);
          return {
            ...item,
            feedConsumption: item.feed_consumption,
            flockName: (item.flocks as any)?.name || 'N/A',
            farmName: (item.flocks as any)?.farms?.name || 'N/A',
            flockPopulation: (item.flocks as any)?.population || 0,
            totalEggCount,
            totalFeedConsumption,
            totalEggWeightKg
          };
        });
        return dataWithDetails.sort((a: { date: string }, b: { date: string }) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }),
      catchError(err => this.handleError(err, 'getProductionDataWithDetails'))
    );
  }

  addProductionData(data: Omit<ProductionData, 'id'>): Observable<any> {
    const params = {
      p_flock_id: data.flock_id,
      p_date: data.date,
      p_normal_eggs: data.normal_eggs,
      p_white_eggs: data.white_eggs,
      p_cracked_eggs: data.cracked_eggs,
      p_normal_eggs_weight_kg: data.normal_eggs_weight_kg,
      p_white_eggs_weight_kg: data.white_eggs_weight_kg,
      p_cracked_eggs_weight_kg: data.cracked_eggs_weight_kg,
      p_feed_consumption: data.feed_consumption
    };
    return from(supabase.rpc('add_production_data_with_feed', params)).pipe(catchError(err => this.handleError(err, 'addProductionData')));
  }

  updateProductionData(data: Partial<ProductionData>): Observable<any> {
    const params = {
      p_production_id: data.id,
      p_flock_id: data.flock_id,
      p_date: data.date,
      p_normal_eggs: data.normal_eggs,
      p_white_eggs: data.white_eggs,
      p_cracked_eggs: data.cracked_eggs,
      p_normal_eggs_weight_kg: data.normal_eggs_weight_kg,
      p_white_eggs_weight_kg: data.white_eggs_weight_kg,
      p_cracked_eggs_weight_kg: data.cracked_eggs_weight_kg,
      p_feed_consumption: data.feed_consumption
    };
    return from(supabase.rpc('update_production_data_with_feed', params)).pipe(catchError(err => this.handleError(err, 'updateProductionData')));
  }

  deleteProductionData(id: number): Observable<any> {
    return from(supabase.from('production_data').delete().eq('id', id)).pipe(catchError(err => this.handleError(err, 'deleteProductionData')));
  }
}