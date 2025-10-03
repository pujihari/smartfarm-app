import { Injectable } from '@angular/core';
import { from, Observable, throwError, combineLatest } from 'rxjs';
import { map, catchError, switchMap, take, filter } from 'rxjs/operators';
import { ProductionData } from '../models/production-data.model';
import { supabase } from '../supabase.client';
import { AuthService } from './auth.service'; // Import AuthService
import { MortalityData } from './mortality.service'; // Import MortalityData

@Injectable({ providedIn: 'root' })
export class ProductionService {
  constructor(private authService: AuthService) {} // Inject AuthService

  private handleError(error: any, context: string) {
    console.error(`Supabase error in ${context}:`, error);
    return throwError(() => new Error(error.message || `Server error in ${context}`));
  }

  getProductionDataWithDetails(): Observable<(ProductionData & { flockName: string, farmName: string, totalEggCount: number, totalFeedConsumption: number, totalEggWeightKg: number, flockPopulation: number, totalDepletion: number })[]> {
    return this.authService.organizationId$.pipe(
      filter(organizationId => !!organizationId), // Ensure organizationId is not null
      take(1),
      switchMap(organizationId => {
        if (!organizationId) {
          return throwError(() => new Error('ID Organisasi tidak ditemukan.'));
        }

        const productionQuery = supabase.from('production_data')
          .select('*, feed_consumption(*), flocks!inner(id, name, population, farms!inner(name))')
          .eq('organization_id', organizationId) // Filter by organization_id
          .order('date', { ascending: false });

        const mortalityQuery = supabase.from('mortality_data')
          .select('flock_id, date, mortality_count, culling_count')
          .eq('organization_id', organizationId); // Filter by organization_id

        return combineLatest([
          from(productionQuery),
          from(mortalityQuery)
        ]).pipe(
          map(([productionResponse, mortalityResponse]) => {
            if (productionResponse.error) throw productionResponse.error;
            if (mortalityResponse.error) throw mortalityResponse.error;

            const mortalityMap = new Map<string, { mortality_count: number, culling_count: number }>();
            (mortalityResponse.data || []).forEach(m => {
              const key = `${m.flock_id}-${m.date}`;
              mortalityMap.set(key, { mortality_count: m.mortality_count, culling_count: m.culling_count });
            });

            const dataWithDetails = (productionResponse.data || []).map((item: any) => {
              const totalEggCount = (item.normal_eggs || 0) + (item.white_eggs || 0) + (item.cracked_eggs || 0);
              const totalFeedConsumption = (item.feed_consumption || []).reduce((sum: number, feed: { quantity_kg: number }) => sum + (feed.quantity_kg || 0), 0);
              const totalEggWeightKg = (item.normal_eggs_weight_kg || 0) + (item.white_eggs_weight_kg || 0) + (item.cracked_eggs_weight_kg || 0);

              const mortalityKey = `${item.flock_id}-${item.date}`;
              const matchingMortality = mortalityMap.get(mortalityKey);
              const mortality = matchingMortality?.mortality_count || 0;
              const culling = matchingMortality?.culling_count || 0;

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
      })
    );
  }

  getProductionDataByFlockId(flockId: number, startDate?: string, endDate?: string): Observable<(ProductionData & { totalEggCount: number, totalFeedConsumption: number, totalEggWeightKg: number, totalDepletion: number })[]> {
    return this.authService.organizationId$.pipe(
      filter(organizationId => !!organizationId), // Ensure organizationId is not null
      take(1),
      switchMap(organizationId => {
        if (!organizationId) {
          return throwError(() => new Error('ID Organisasi tidak ditemukan.'));
        }

        let productionQuery = supabase.from('production_data')
          .select('*, feed_consumption(*)')
          .eq('flock_id', flockId)
          .eq('organization_id', organizationId)
          .order('date', { ascending: true });

        if (startDate) {
          productionQuery = productionQuery.gte('date', startDate);
        }
        if (endDate) {
          productionQuery = productionQuery.lte('date', endDate);
        }

        let mortalityQuery = supabase.from('mortality_data')
          .select('flock_id, date, mortality_count, culling_count')
          .eq('flock_id', flockId)
          .eq('organization_id', organizationId);

        if (startDate) {
          mortalityQuery = mortalityQuery.gte('date', startDate);
        }
        if (endDate) {
          mortalityQuery = mortalityQuery.lte('date', endDate);
        }

        return combineLatest([
          from(productionQuery),
          from(mortalityQuery)
        ]).pipe(
          map(([productionResponse, mortalityResponse]) => {
            if (productionResponse.error) throw productionResponse.error;
            if (mortalityResponse.error) throw mortalityResponse.error;

            const mortalityMap = new Map<string, { mortality_count: number, culling_count: number }>();
            (mortalityResponse.data || []).forEach(m => {
              const key = `${m.flock_id}-${m.date}`;
              mortalityMap.set(key, { mortality_count: m.mortality_count, culling_count: m.culling_count });
            });

            return (productionResponse.data || []).map((item: any) => {
              const totalEggCount = (item.normal_eggs || 0) + (item.white_eggs || 0) + (item.cracked_eggs || 0);
              const totalFeedConsumption = (item.feed_consumption || []).reduce((sum: number, feed: { quantity_kg: number }) => sum + (feed.quantity_kg || 0), 0);
              const totalEggWeightKg = (item.normal_eggs_weight_kg || 0) + (item.white_eggs_weight_kg || 0) + (item.cracked_eggs_weight_kg || 0);

              const mortalityKey = `${item.flock_id}-${item.date}`;
              const matchingMortality = mortalityMap.get(mortalityKey);
              const mortality = matchingMortality?.mortality_count || 0;
              const culling = matchingMortality?.culling_count || 0;

              return {
                ...item,
                feedConsumption: item.feed_consumption,
                totalEggCount,
                totalFeedConsumption,
                totalEggWeightKg,
                mortality_count: mortality,
                culling_count: culling,
                totalDepletion: mortality + culling
              };
            });
          }),
          catchError(err => this.handleError(err, 'getProductionDataByFlockId'))
        );
      })
    );
  }

  // New method to get a single day's production data for a specific flock
  getProductionDataForDay(flockId: number, date: string): Observable<(ProductionData & { mortality_count: number, culling_count: number }) | null> {
    return this.authService.organizationId$.pipe(
      filter(organizationId => !!organizationId), // Ensure organizationId is not null
      take(1),
      switchMap(organizationId => {
        if (!organizationId) {
          return throwError(() => new Error('ID Organisasi tidak ditemukan.'));
        }

        const productionQuery = supabase.from('production_data')
          .select('*, feed_consumption(*)')
          .eq('flock_id', flockId)
          .eq('date', date)
          .eq('organization_id', organizationId)
          .limit(1);

        const mortalityQuery = supabase.from('mortality_data')
          .select('mortality_count, culling_count')
          .eq('flock_id', flockId)
          .eq('date', date)
          .eq('organization_id', organizationId)
          .limit(1);

        return combineLatest([
          from(productionQuery),
          from(mortalityQuery)
        ]).pipe(
          map(([productionResponse, mortalityResponse]) => {
            if (productionResponse.error) throw productionResponse.error;
            if (mortalityResponse.error) throw mortalityResponse.error;

            if (productionResponse.data && productionResponse.data.length > 0) {
              const item = productionResponse.data[0];
              const mortality = mortalityResponse.data?.[0]?.mortality_count || 0;
              const culling = mortalityResponse.data?.[0]?.culling_count || 0;
              return {
                ...item,
                feed_consumption: item.feed_consumption || [],
                mortality_count: mortality,
                culling_count: culling
              } as ProductionData & { mortality_count: number, culling_count: number };
            }
            return null;
          }),
          catchError(err => this.handleError(err, 'getProductionDataForDay'))
        );
      })
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
      p_culling_count: data.culling_count || 0,
      p_notes: data.notes || null // Include notes
    };
    console.log('RPC params in ProductionService:', params); // Debugging log
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
      p_feed_consumption: data.feed_consumption,
      p_notes: data.notes || null // Include notes
    };
    console.log('RPC params for updateProductionData:', params); // Debugging log
    return from(supabase.rpc('update_production_data_with_feed', params)).pipe(catchError(err => this.handleError(err, 'updateProductionData')));
  }

  deleteProductionData(id: number): Observable<any> {
    return from(supabase.from('production_data').delete().eq('id', id)).pipe(catchError(err => this.handleError(err, 'deleteProductionData')));
  }
}