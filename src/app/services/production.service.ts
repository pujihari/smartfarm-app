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

  getProductionDataWithDetails(): Observable<(ProductionData & { flockName: string, farmName: string, totalEggCount: number, totalFeedConsumption: number, totalEggWeightKg: number, flockPopulation: number, totalDepletion: number })[]> {
    return from(supabase.from('production_data')
      .select('*, feed_consumption(*), flocks!inner(name, population, farms!inner(name)), mortality_data!left(mortality_count, culling_count)')
      .order('date', { ascending: false })
    ).pipe(
      map(response => {
        if (response.error) throw response.error;
        const dataWithDetails = (response.data || []).map((item: any) => {
          const totalEggCount = (item.normal_eggs || 0) + (item.white_eggs || 0) + (item.cracked_eggs || 0);
          const totalFeedConsumption = (item.feed_consumption || []).reduce((sum: number, feed: { quantity_kg: number }) => sum + (feed.quantity_kg || 0), 0);
          const totalEggWeightKg = (item.normal_eggs_weight_kg || 0) + (item.white_eggs_weight_kg || 0) + (item.cracked_eggs_weight_kg || 0);
          const mortality = item.mortality_data[0]?.mortality_count || 0;
          const culling = item.mortality_data[0]?.culling_count || 0;
          return {
            ...item,
            feedConsumption: item.feed_consumption,
            flockName: (item.flocks as any)?.name || 'N/A',
            farmName: (item.flocks as any)?.farms?.name || 'N/A',
            flockPopulation: (item.flocks as any)?.population || 0,
            totalEggCount,
            totalFeedConsumption,
            totalEggWeightKg,
            mortality_count: mortality,
            culling_count: culling,
            totalDepletion: mortality + culling
          };
        });
        return dataWithDetails;
      }),
      catchError(err => this.handleError(err, 'getProductionDataWithDetails'))
    );
  }

  addDailyLog(data: Omit<ProductionData, 'id'>): Observable<any> {
    const params = {
      p_flock_id: data.flock_id,
      p_date: data.date,
      p_normal_eggs: data.normal_eggs,
      p_white_eggs: data.white_eggs,
      p_cracked_eggs: data.cracked_eggs,
      p_normal_eggs_weight_kg: data.normal_eggs_weight_kg,
      p_white_eggs_weight_kg: data.white_eggs_weight_kg,
      p_cracked_eggs_weight_kg: data.cracked_eggs_weight_kg,
      p_feed_consumption: data.feed_consumption,
      p_mortality_count: data.mortality_count || 0,
      p_culling_count: data.culling_count || 0
    };
    return from(supabase.rpc('add_daily_log', params)).pipe(catchError(err => this.handleError(err, 'addDailyLog')));
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
    // Note: Update logic for mortality needs a separate RPC or direct table update if required.
    // For now, focusing on adding data.
    return from(supabase.rpc('update_production_data_with_feed', params)).pipe(catchError(err => this.handleError(err, 'updateProductionData')));
  }

  deleteProductionData(id: number): Observable<any> {
    return from(supabase.from('production_data').delete().eq('id', id)).pipe(catchError(err => this.handleError(err, 'deleteProductionData')));
  }
}