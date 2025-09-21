import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable, combineLatest, of, BehaviorSubject } from 'rxjs';
import { switchMap, map, catchError, filter } from 'rxjs/operators';
import { FlockService } from '../../services/flock.service';
import { ProductionService } from '../../services/production.service';
import { BodyWeightService } from '../../services/body-weight.service';
import { HealthService } from '../../services/health.service';
import { MortalityService, MortalityData } from '../../services/mortality.service';
import { ReportService, ProductionStandardData } from '../../services/report.service';
import { NotificationService } from '../../services/notification.service';
import { Flock } from '../../models/flock.model';
import { ProductionData } from '../../models/production-data.model';
import { BodyWeightData } from '../../models/body-weight.model';
import { HealthEvent } from '../../models/health-event.model';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions, TooltipItem } from 'chart.js';

interface FlockDetailData {
  flock: (Flock & { farmName: string });
  currentAgeDays: number;
  kpis: {
    currentPopulation: number;
    totalEggs: number;
    avgHenDayProduction: number;
    totalFeedConsumption: number;
    fcr: number;
    totalMortality: number;
    totalCulling: number;
    totalDepletionRate: number;
  };
  productionHistory: (ProductionData & { totalEggCount: number, totalFeedConsumption: number, totalEggWeightKg: number, totalDepletion: number })[];
  bodyWeightHistory: BodyWeightData[];
  healthEvents: HealthEvent[];
  mortalityHistory: MortalityData[];
}

@Component({
  selector: 'app-flock-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, BaseChartDirective],
  templateUrl: './flock-detail.component.html',
  styleUrl: './flock-detail.component.css',
  providers: [DatePipe]
})
export class FlockDetailComponent implements OnInit {
  flockDetail$: Observable<FlockDetailData | undefined> | undefined;
  flockId: number | null = null;
  private refreshData$ = new BehaviorSubject<void>(undefined);

  // Chart configurations
  public productionChartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  public productionChartOptions: ChartOptions<'line'> = { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'Jumlah' } } } };
  public bodyWeightChartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  public bodyWeightChartOptions: ChartOptions<'line'> = { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'Berat Badan (g)' } } } };
  public depletionChartData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
  public depletionChartOptions: ChartOptions<'bar'> = { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'Jumlah Ekor' } } } };

  constructor(
    private route: ActivatedRoute,
    private flockService: FlockService,
    private productionService: ProductionService,
    private bodyWeightService: BodyWeightService,
    private healthService: HealthService,
    private mortalityService: MortalityService,
    private reportService: ReportService,
    private notificationService: NotificationService,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.flockId = Number(params.get('id'));
      if (this.flockId) {
        this.loadFlockData();
      }
    });
  }

  loadFlockData(): void {
    if (!this.flockId) return;

    const flock$ = this.flockService.getFlockById(this.flockId).pipe(
      filter((flock): flock is Flock & { farmName: string } => !!flock),
      catchError(err => {
        this.notificationService.showError(`Gagal memuat detail flok: ${err.message}`);
        return of(undefined);
      })
    );

    this.flockDetail$ = this.refreshData$.pipe(
      switchMap(() => flock$),
      switchMap(flock => {
        if (!flock) return of(undefined);

        const today = new Date();
        const startDate = new Date(flock.start_date);
        const currentAgeDays = Math.round((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + flock.entry_age_days;

        const productionHistory$ = this.productionService.getProductionDataByFlockId(flock.id);
        const bodyWeightHistory$ = this.bodyWeightService.getBodyWeightHistoryByFlockId(flock.id);
        const healthEvents$ = this.healthService.getHealthEventsByFlockId(flock.id);
        const mortalityHistory$ = this.mortalityService.getMortalityDataByFlockId(flock.id);
        const standardData$ = this.reportService.getStandardByBreed(flock.breed).pipe(
          switchMap(standard => standard ? this.reportService.getStandardData(standard.id) : of([] as ProductionStandardData[]))
        );

        return combineLatest([
          productionHistory$,
          bodyWeightHistory$,
          healthEvents$,
          mortalityHistory$,
          standardData$
        ]).pipe(
          map(([productionHistory, bodyWeightHistory, healthEvents, mortalityHistory, standardData]) => {
            const kpis = this.calculateKpis(flock, productionHistory, mortalityHistory);
            this.updateProductionChart(productionHistory, flock, standardData);
            this.updateBodyWeightChart(bodyWeightHistory, flock, standardData);
            this.updateDepletionChart(mortalityHistory);

            return {
              flock,
              currentAgeDays,
              kpis,
              productionHistory,
              bodyWeightHistory,
              healthEvents,
              mortalityHistory
            };
          }),
          catchError(err => {
            this.notificationService.showError(`Gagal memuat data terkait flok: ${err.message}`);
            return of(undefined);
          })
        );
      })
    );
  }

  calculateKpis(flock: Flock, productionHistory: (ProductionData & { totalEggCount: number, totalFeedConsumption: number, totalEggWeightKg: number, totalDepletion: number })[], mortalityHistory: MortalityData[]): FlockDetailData['kpis'] {
    const totalEggs = productionHistory.reduce((sum, item) => sum + item.totalEggCount, 0);
    const totalFeedConsumption = productionHistory.reduce((sum, item) => sum + item.totalFeedConsumption, 0);
    const totalMortality = mortalityHistory.reduce((sum, item) => sum + item.mortality_count, 0);
    const totalCulling = mortalityHistory.reduce((sum, item) => sum + item.culling_count, 0);
    const totalDepletion = totalMortality + totalCulling;

    let avgHenDayProduction = 0;
    let fcr = 0;

    if (productionHistory.length > 0) {
      const latestProduction = productionHistory[0]; // Assuming sorted by date descending
      if (flock.population > 0) {
        avgHenDayProduction = (latestProduction.totalEggCount / flock.population) * 100;
      }
      if (totalFeedConsumption > 0 && totalEggs > 0) {
        fcr = totalFeedConsumption / (totalEggs / 1000); // Assuming 1000 eggs = 1kg for FCR calculation if needed, or use totalEggWeightKg
      }
      // More accurate FCR: total feed / total egg weight
      const totalEggWeightKg = productionHistory.reduce((sum, item) => sum + item.totalEggWeightKg, 0);
      if (totalFeedConsumption > 0 && totalEggWeightKg > 0) {
        fcr = totalFeedConsumption / totalEggWeightKg;
      }
    }

    const initialPopulation = flock.population + totalDepletion; // Reconstruct initial population for depletion rate
    const totalDepletionRate = initialPopulation > 0 ? (totalDepletion / initialPopulation) * 100 : 0;

    return {
      currentPopulation: flock.population,
      totalEggs,
      avgHenDayProduction,
      totalFeedConsumption,
      fcr,
      totalMortality,
      totalCulling,
      totalDepletionRate
    };
  }

  updateProductionChart(productionHistory: (ProductionData & { totalEggCount: number, totalFeedConsumption: number, totalEggWeightKg: number, totalDepletion: number })[], flock: Flock, standardData: ProductionStandardData[]): void {
    const labels = productionHistory.map(p => this.datePipe.transform(p.date, 'shortDate') || '');
    const henDayData = productionHistory.map(p => flock.population > 0 ? (p.totalEggCount / flock.population) * 100 : 0);
    const feedConsumptionData = productionHistory.map(p => p.totalFeedConsumption);

    const standardHenDayData = productionHistory.map(p => {
      const ageWeeks = Math.floor((new Date(p.date).getTime() - new Date(flock.start_date).getTime()) / (1000 * 60 * 60 * 24 * 7)) + Math.floor(flock.entry_age_days / 7);
      const standardPoint = standardData.find(s => s.age_weeks === ageWeeks);
      return standardPoint?.hen_day_production_percent || null;
    });

    this.productionChartData = {
      labels: labels,
      datasets: [
        { data: henDayData, label: 'HD% Aktual', borderColor: '#0A4D9D', tension: 0.2, fill: false },
        { data: standardHenDayData, label: 'HD% Standar', borderColor: '#F5A623', tension: 0.2, borderDash: [5, 5], fill: false },
        { data: feedConsumptionData, label: 'Konsumsi Pakan (kg)', borderColor: '#28a745', tension: 0.2, fill: false, yAxisID: 'y1' }
      ]
    };
    this.productionChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'HD% / Jumlah (kg)' },
          position: 'left',
          ticks: {
            callback: function(value: number | string) {
              if (typeof value === 'number') {
                return value.toLocaleString('id-ID');
              }
              return value;
            }
          }
        },
        y1: {
          beginAtZero: true,
          title: { display: true, text: 'Konsumsi Pakan (kg)' },
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: {
            callback: function(value: number | string) {
              if (typeof value === 'number') {
                return value.toLocaleString('id-ID');
              }
              return value;
            }
          }
        }
      },
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: function(context: TooltipItem<'line'>) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += context.parsed.y.toFixed(2);
                if (label.includes('HD%')) label += '%';
                else if (label.includes('Pakan')) label += ' kg';
              }
              return label;
            }
          }
        }
      }
    };
  }

  updateBodyWeightChart(bodyWeightHistory: BodyWeightData[], flock: Flock, standardData: ProductionStandardData[]): void {
    const labels = bodyWeightHistory.map(b => this.datePipe.transform(b.weighing_date, 'shortDate') || '');
    const actualWeightData = bodyWeightHistory.map(b => b.avg_body_weight_actual);

    const standardWeightData = bodyWeightHistory.map(b => {
      const ageWeeks = Math.floor(b.age_days / 7);
      const standardPoint = standardData.find(s => s.age_weeks === ageWeeks);
      return standardPoint?.body_weight_g || null;
    });

    this.bodyWeightChartData = {
      labels: labels,
      datasets: [
        { data: actualWeightData, label: 'BB Aktual (g)', borderColor: '#0A4D9D', tension: 0.2, fill: false },
        { data: standardWeightData, label: 'BB Standar (g)', borderColor: '#F5A623', tension: 0.2, borderDash: [5, 5], fill: false }
      ]
    };
    this.bodyWeightChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Berat Badan (g)' },
          ticks: {
            callback: function(value: number | string) {
              if (typeof value === 'number') {
                return value.toLocaleString('id-ID');
              }
              return value;
            }
          }
        }
      },
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: function(context: TooltipItem<'line'>) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += context.parsed.y.toFixed(2) + ' g';
              }
              return label;
            }
          }
        }
      }
    };
  }

  updateDepletionChart(mortalityHistory: MortalityData[]): void {
    const labels = mortalityHistory.map(m => this.datePipe.transform(m.date, 'shortDate') || '');
    const mortalityData = mortalityHistory.map(m => m.mortality_count);
    const cullingData = mortalityHistory.map(m => m.culling_count);

    this.depletionChartData = {
      labels: labels,
      datasets: [
        { data: mortalityData, label: 'Kematian', backgroundColor: '#dc3545', hoverBackgroundColor: '#c82333' },
        { data: cullingData, label: 'Culling', backgroundColor: '#ffc107', hoverBackgroundColor: '#e0a800' }
      ]
    };
    this.depletionChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true },
        y: {
          stacked: true,
          beginAtZero: true,
          title: { display: true, text: 'Jumlah Ekor' },
          ticks: {
            callback: function(value: number | string) {
              if (typeof value === 'number') {
                return value.toLocaleString('id-ID');
              }
              return value;
            }
          }
        }
      },
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: function(context: TooltipItem<'bar'>) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += context.parsed.y.toLocaleString('id-ID') + ' ekor';
              }
              return label;
            }
          }
        }
      }
    };
  }

  refresh(): void {
    this.refreshData$.next(undefined);
  }
}