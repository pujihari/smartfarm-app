import { Injectable } from '@angular/core';
import { from, Observable, of, combineLatest, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { supabase } from '../supabase.client';

export interface ProductionStandard {
  id: number;
  name: string;
  breed: string;
}
export interface ProductionStandardData {
  age_weeks: number;
  hen_day_production_percent?: number; // Optional, as it might not always be present
  hen_day_production_percent_min?: number; // New: Min value for HD%
  hen_day_production_percent_max?: number; // New: Max value for HD%
  body_weight_g?: number; // Optional, as it might not always be present
  body_weight_g_min?: number; // New: Min value for Body Weight
  body_weight_g_max?: number; // New: Max value for Body Weight
  feed_consumption_g_per_day?: number; // New: for Feed Intake
  feed_consumption_g_per_day_min?: number; // New: Min value for Feed Consumption
  feed_consumption_g_per_day_max?: number; // New: Max value for Feed Consumption
  egg_weight_g?: number; // New: for Average Egg Weight
  egg_weight_g_min?: number; // New: Min value for Egg Weight
  egg_weight_g_max?: number; // New: Max value for Egg Weight
  feed_conversion_ratio?: number; // New: for FCR
  mortality_percent?: number; // New: for Mortality
  mortality_percent_min?: number; // New: Min value for Mortality
  mortality_percent_max?: number; // New: Max value for Mortality
  uniformity_percent?: number; // New: for Uniformity
  uniformity_percent_min?: number; // New: Min value for Uniformity
  uniformity_percent_max?: number; // New: Max value for Uniformity
}

export interface ReportFilters {
  startDate: string;
  endDate: string;
  farmId?: number;
  standardId?: number;
}

export interface ReportData {
  kpis: {
    totalEggCount: number;
    totalEggWeightKg: number;
    totalFeedConsumption: number;
    fcr: number;
  };
  chartData: {
    labels: string[];
    datasets: { data: (number | null)[], label: string, borderColor: string, tension: number, borderDash?: number[], fill?: string | boolean, backgroundColor?: string }[];
  };
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  constructor() {}

  private handleError(error: any, context: string) {
    console.error(`Supabase error in ${context}:`, error);
    return throwError(() => new Error(error.message || `Server error in ${context}`));
  }

  getProductionStandards(): Observable<ProductionStandard[]> {
    return from(supabase.from('production_standards').select('id, name, breed')).pipe(
      map(response => {
        if (response.error) throw response.error;
        return response.data || [];
      }),
      catchError(err => this.handleError(err, 'getProductionStandards'))
    );
  }

  getStandardData(standardId: number): Observable<ProductionStandardData[]> {
    return from(
      supabase
        .from('production_standard_data')
        .select('age_weeks, hen_day_production_percent, hen_day_production_percent_min, hen_day_production_percent_max, body_weight_g, body_weight_g_min, body_weight_g_max, feed_consumption_g_per_day, feed_consumption_g_per_day_min, feed_consumption_g_per_day_max, egg_weight_g, egg_weight_g_min, egg_weight_g_max, feed_conversion_ratio, mortality_percent, mortality_percent_min, mortality_percent_max, uniformity_percent, uniformity_percent_min, uniformity_percent_max')
        .eq('standard_id', standardId)
        .order('age_weeks')
    ).pipe(
      map(response => {
        if (response.error) throw response.error;
        return response.data || [];
      }),
      catchError(err => this.handleError(err, 'getStandardData'))
    );
  }

  getStandardByBreed(breed: string): Observable<{ id: number } | null> {
    return from(
      supabase
        .from('production_standards')
        .select('id')
        .eq('breed', breed)
        .limit(1)
        .single()
    ).pipe(
      map(response => {
        if (response.error && response.error.code !== 'PGRST116') throw response.error;
        return response.data;
      }),
      catchError(err => this.handleError(err, 'getStandardByBreed'))
    );
  }

  getStandardBodyWeight(standardId: number, ageWeeks: number): Observable<number | null> {
    // This method still returns a single value, as it's used by the BodyWeightComponent for a single standard line.
    // For charts, we will use the min/max values directly from getStandardData.
    return from(
      supabase
        .from('production_standard_data')
        .select('body_weight_g')
        .eq('standard_id', standardId)
        .eq('age_weeks', ageWeeks)
        .single()
    ).pipe(
      map(response => {
        if (response.error && response.error.code !== 'PGRST116') throw response.error;
        return response.data?.body_weight_g || null;
      }),
      catchError(err => this.handleError(err, 'getStandardBodyWeight'))
    );
  }

  getReportData(filters: ReportFilters): Observable<ReportData> {
    let query = supabase.from('production_data').select('*, feed_consumption(*), flocks!inner(farm_id, start_date, population)');
    
    if (filters.startDate) query = query.gte('date', filters.startDate);
    if (filters.endDate) query = query.lte('date', filters.endDate);
    if (filters.farmId) query = query.eq('flocks.farm_id', filters.farmId);

    const actualData$ = from(query).pipe(
      map(response => {
        if (response.error) throw response.error;
        return response.data || [];
      })
    );

    const standardData$ = filters.standardId 
      ? this.getStandardData(filters.standardId) 
      : of([]);

    return combineLatest([actualData$, standardData$]).pipe(
      map(([actualData, standardData]) => {
        const kpis = actualData.reduce((acc: { totalEggCount: number; totalEggWeightKg: number; totalFeedConsumption: number; fcr: number; }, item: any) => {
          acc.totalEggCount += (item.normal_eggs || 0) + (item.white_eggs || 0) + (item.cracked_eggs || 0);
          const weight = (item.normal_eggs_weight_kg || 0) + (item.white_eggs_weight_kg || 0) + (item.cracked_eggs_weight_kg || 0);
          acc.totalEggWeightKg += weight;
          acc.totalFeedConsumption += (item.feed_consumption || []).reduce((sum: number, feed: { quantity_kg: number }) => sum + (feed.quantity_kg || 0), 0);
          return acc;
        }, { totalEggCount: 0, totalEggWeightKg: 0, totalFeedConsumption: 0, fcr: 0 });
        
        if (kpis.totalEggWeightKg > 0) {
          kpis.fcr = kpis.totalFeedConsumption / kpis.totalEggWeightKg;
        }

        const dailyData = new Map<string, { totalEggs: number, population: number }>();
        const flockPopulations = new Map<number, number>();

        actualData.forEach((item: any) => {
          const flock = item.flocks;
          if (!flockPopulations.has(item.flock_id)) {
            flockPopulations.set(item.flock_id, flock.population || 0);
          }
        });

        actualData.forEach((item: any) => {
          const dateStr = new Date(item.date).toLocaleDateString('en-CA');
          const day = dailyData.get(dateStr) || { totalEggs: 0, population: 0 };
          day.totalEggs += (item.normal_eggs || 0) + (item.white_eggs || 0) + (item.cracked_eggs || 0);
          day.population += flockPopulations.get(item.flock_id) || 0;
          dailyData.set(dateStr, day);
        });

        const sortedDates = Array.from(dailyData.keys()).sort();
        
        const actualHdData = sortedDates.map(date => {
          const day = dailyData.get(date)!;
          return day.population > 0 ? (day.totalEggs / day.population) * 100 : 0;
        });

        const chartData: ReportData['chartData'] = {
          labels: sortedDates.map(d => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })),
          datasets: [
            { data: actualHdData, label: 'HD% Aktual', borderColor: '#0A4D9D', tension: 0.2, borderDash: [], fill: false },
          ]
        };

        if (standardData.length > 0 && actualData.length > 0) {
            const firstFlockStartDate = new Date( (actualData[0] as any).flocks.start_date );
            
            const standardHdDataMin = sortedDates.map(dateStr => {
                const currentDate = new Date(dateStr);
                const diffTime = Math.abs(currentDate.getTime() - firstFlockStartDate.getTime());
                const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
                const standardPoint = standardData.find(d => d.age_weeks === diffWeeks);
                return standardPoint?.hen_day_production_percent_min ?? null;
            });
            const standardHdDataMax = sortedDates.map(dateStr => {
                const currentDate = new Date(dateStr);
                const diffTime = Math.abs(currentDate.getTime() - firstFlockStartDate.getTime());
                const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
                const standardPoint = standardData.find(d => d.age_weeks === diffWeeks);
                return standardPoint?.hen_day_production_percent_max ?? null;
            });

            chartData.datasets.push(
                {
                    data: standardHdDataMin,
                    label: 'HD% Standar (Min)',
                    borderColor: '#F5A623',
                    backgroundColor: 'rgba(245, 166, 35, 0.2)', // Light orange fill
                    tension: 0.2,
                    borderDash: [5, 5],
                    fill: '+1' // Fill to the next dataset (max)
                },
                {
                    data: standardHdDataMax,
                    label: 'HD% Standar (Max)',
                    borderColor: '#F5A623',
                    tension: 0.2,
                    borderDash: [5, 5],
                    fill: false // Do not fill above this line
                }
            );
        }

        return { kpis, chartData };
      }),
      catchError(err => this.handleError(err, 'getReportData'))
    );
  }
}