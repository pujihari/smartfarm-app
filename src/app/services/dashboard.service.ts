import { Injectable } from '@angular/core';
import { Observable, of, combineLatest, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { FarmService } from './farm.service';
import { ProductionService } from './production.service';

export interface DashboardKpis {
  totalFarms: number;
  totalPopulation: number;
  henDayRate: number;
  mortalityRate: number;
}

export interface ChartData {
  labels: string[];
  datasets: any[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(
    private farmService: FarmService,
    private productionService: ProductionService
  ) {}

  private handleError(error: any, context: string) {
    console.error(`Error in ${context}:`, error);
    return throwError(() => new Error(error.message || `Server error in ${context}`));
  }

  getDashboardKpis(): Observable<DashboardKpis> {
    const farms$ = this.farmService.getFarms();
    const production$ = this.productionService.getProductionDataWithDetails();

    return combineLatest([farms$, production$]).pipe(
      map(([farms, productionData]) => {
        const totalFarms = farms.length;
        const totalPopulation = farms.reduce((sum, farm) => sum + farm.population, 0);

        let henDayRate = 0;
        if (productionData.length > 0) {
          const latestDate = productionData[0].date;
          const latestProductionForDate = productionData.filter(p => p.date === latestDate);
          
          const totalEggsLatestDay = latestProductionForDate.reduce((sum, p) => sum + p.totalEggCount, 0);
          
          // Use a Set to get unique flock populations for the latest day
          const flockPopulations = new Map<number, number>();
          latestProductionForDate.forEach(p => {
            flockPopulations.set(p.flock_id, p.flockPopulation);
          });
          const populationForLatestDay = Array.from(flockPopulations.values()).reduce((sum, pop) => sum + pop, 0);

          if (populationForLatestDay > 0) {
            henDayRate = (totalEggsLatestDay / populationForLatestDay) * 100;
          }
        }

        const mortalityRate = 0.0;

        return {
          totalFarms,
          totalPopulation,
          henDayRate,
          mortalityRate
        };
      }),
      catchError(err => {
        this.handleError(err, 'getDashboardKpis');
        return of({ totalFarms: 0, totalPopulation: 0, henDayRate: 0, mortalityRate: 0 });
      })
    );
  }

  getProductionPerFarmChartData(): Observable<ChartData> {
    const farms$ = this.farmService.getFarms();
    const production$ = this.productionService.getProductionDataWithDetails();

    return combineLatest([farms$, production$]).pipe(
      map(([farms, productionData]) => {
        const farmProduction = new Map<string, number>();
        farms.forEach(farm => farmProduction.set(farm.name, 0));
        productionData.forEach(p => {
          const currentTotal = farmProduction.get(p.farmName) || 0;
          farmProduction.set(p.farmName, currentTotal + p.totalEggCount);
        });

        const labels = Array.from(farmProduction.keys());
        const data = Array.from(farmProduction.values());

        const datasets = [{
          data: data,
          label: 'Total Produksi Telur (butir)',
          backgroundColor: '#0A4D9D',
          borderColor: '#083a75',
          hoverBackgroundColor: '#F5A623'
        }];

        return { labels, datasets };
      }),
      catchError(err => {
        this.handleError(err, 'getProductionPerFarmChartData');
        return of({ labels: [], datasets: [] });
      })
    );
  }
}