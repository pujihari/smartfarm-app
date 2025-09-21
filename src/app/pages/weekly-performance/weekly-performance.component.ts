import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray, FormControl } from '@angular/forms';
import { Observable, BehaviorSubject, switchMap, map, tap, combineLatest, startWith, of, catchError } from 'rxjs';
import { FlockService } from '../../services/flock.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { Flock } from '../../models/flock.model';
import { ConfirmationModalComponent } from '../../components/confirmation-modal/confirmation-modal.component';
import { BaseChartDirective } from 'ng2-charts';
import { ChartOptions, ChartConfiguration } from 'chart.js';
import { ReportService, ProductionStandardData } from '../../services/report.service';
import { ProductionService } from '../../services/production.service';
import { ProductionData } from '../../models/production-data.model';

type FlockWithFarmInfo = Flock & { farmName: string };

@Component({
  selector: 'app-weekly-performance',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ConfirmationModalComponent, BaseChartDirective],
  templateUrl: './weekly-performance.component.html',
  styleUrl: './weekly-performance.component.css',
  providers: [DatePipe]
})
export class WeeklyPerformanceComponent implements OnInit {
  performanceForm: FormGroup; 
  flocks$: Observable<FlockWithFarmInfo[]>;
  private allFlocks: FlockWithFarmInfo[] = [];
  
  isSaving = false; 
  isConfirmModalOpen = false;
  itemToDelete: any | null = null; 

  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: []
  };
  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        title: {
          display: true,
          text: 'Umur Flok (Minggu)'
        }
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Nilai Metrik'
        },
        ticks: {
          callback: function(value) {
            if (typeof value === 'number') {
              return value.toLocaleString('id-ID');
            }
            return value;
          }
        }
      }
    },
    plugins: {
      legend: {
        display: true
      },
      tooltip: {
        callbacks: {
          title: function(context) {
            // Display the week number as the title
            return context[0].label;
          },
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y.toFixed(2);
            }
            return label;
          }
        }
      }
    }
  };
  public lineChartLegend = true;
  isChartLoading = true;

  constructor(
    private fb: FormBuilder,
    private flockService: FlockService,
    public authService: AuthService,
    private notificationService: NotificationService,
    private datePipe: DatePipe,
    private reportService: ReportService,
    private productionService: ProductionService
  ) {
    const today = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(today.getMonth() - 3);

    this.performanceForm = this.fb.group({
      flock_id: [null, Validators.required],
      metric_type: ['hen_day_production_percent', Validators.required],
      startDate: [this.datePipe.transform(threeMonthsAgo, 'yyyy-MM-dd')],
      endDate: [this.datePipe.transform(today, 'yyyy-MM-dd')]
    });

    this.flocks$ = this.flockService.getFlocksWithFarmInfo().pipe(
      tap(flocks => this.allFlocks = flocks)
    );
  }

  ngOnInit(): void {
    this.performanceForm.valueChanges.pipe(
      startWith(this.performanceForm.value),
      tap(() => this.isChartLoading = true),
      switchMap(filters => this.loadPerformanceData(filters))
    ).subscribe(
      () => this.isChartLoading = false,
      (error: any) => {
        this.notificationService.showError(`Gagal memuat data performa: ${error.message}`);
        this.isChartLoading = false;
      }
    );
  }

  private loadPerformanceData(filters: any): Observable<void> {
    const selectedFlockId = Number(filters.flock_id);
    const metricType = filters.metric_type;
    const startDate = filters.startDate;
    const endDate = filters.endDate;

    if (!selectedFlockId) {
      this.lineChartData = { labels: [], datasets: [] };
      return of(undefined);
    }

    const selectedFlock = this.allFlocks.find(f => f.id === selectedFlockId);
    if (!selectedFlock) {
      this.lineChartData = { labels: [], datasets: [] };
      return of(undefined);
    }

    // Fetch standard data first
    const standardData$: Observable<ProductionStandardData[]> = this.reportService.getStandardByBreed(selectedFlock.breed).pipe(
      switchMap(standard => {
        if (standard) {
          return this.reportService.getStandardData(standard.id);
        }
        return of<ProductionStandardData[]>([]);
      })
    );

    // Fetch actual data
    const actualData$ = this.productionService.getProductionDataWithDetails().pipe(
      map(data => data.filter(item => 
        item.flock_id === selectedFlockId &&
        new Date(item.date) >= new Date(startDate) &&
        new Date(item.date) <= new Date(endDate)
      ))
    );

    return combineLatest([actualData$, standardData$]).pipe(
      map(([actualProductionData, standardPerformanceData]) => {
        const minWeek = 18; // Default start week for standard
        const maxWeek = 90; // Default end week for standard
        const allWeeks: number[] = Array.from({ length: maxWeek - minWeek + 1 }, (_, i) => minWeek + i); // Explicitly typed

        const labels = allWeeks.map((week: number) => `${week}`); // Added type to 'week'
        
        const weeklyActualDataMap = new Map<number, {
          totalEggs: number;
          totalEggWeight: number;
          totalFeed: number;
          population: number;
          count: number;
        }>();

        actualProductionData.forEach(item => {
          const itemDate = new Date(item.date);
          const flockStartDate = new Date(selectedFlock.start_date);
          
          const diffTime = Math.abs(itemDate.getTime() - flockStartDate.getTime());
          const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
          const ageWeeks = diffWeeks + Math.floor(selectedFlock.entry_age_days / 7);

          if (!weeklyActualDataMap.has(ageWeeks)) {
            weeklyActualDataMap.set(ageWeeks, {
              totalEggs: 0,
              totalEggWeight: 0,
              totalFeed: 0,
              population: selectedFlock.population, // Assuming population is constant for the week or using latest
              count: 0,
            });
          }
          const weekEntry = weeklyActualDataMap.get(ageWeeks)!;
          weekEntry.totalEggs += item.totalEggCount;
          weekEntry.totalEggWeight += item.totalEggWeightKg;
          weekEntry.totalFeed += item.totalFeedConsumption;
          weekEntry.count++;
        });

        const actualMetricData = allWeeks.map((ageWeeks: number) => { // Added type to 'ageWeeks'
          const entry = weeklyActualDataMap.get(ageWeeks);
          if (!entry) return null;

          const avgPopulation = entry.population;
          const avgFeedPerDay = entry.totalFeed / entry.count;

          switch (metricType) {
            case 'hen_day_production_percent':
              return avgPopulation > 0 ? (entry.totalEggs / avgPopulation) * 100 : 0;
            case 'avg_egg_weight_g':
              return entry.totalEggs > 0 ? (entry.totalEggWeight * 1000) / entry.totalEggs : 0;
            case 'avg_feed_intake_g_per_day':
              return avgPopulation > 0 ? (avgFeedPerDay * 1000) / avgPopulation : 0;
            case 'fcr':
              return entry.totalEggWeight > 0 ? entry.totalFeed / entry.totalEggWeight : 0;
            default:
              return null; // Changed from 0 to null for consistency with standard data
          }
        });

        const standardMetricData = allWeeks.map((ageWeeks: number) => { // Added type to 'ageWeeks'
          const standardPoint = standardPerformanceData.find((d: ProductionStandardData) => d.age_weeks === ageWeeks);
          if (!standardPoint) return null;

          switch (metricType) {
            case 'hen_day_production_percent':
              return standardPoint.hen_day_production_percent;
            case 'avg_egg_weight_g':
              return standardPoint.egg_weight_g ?? null;
            case 'avg_feed_intake_g_per_day':
              return standardPoint.feed_consumption_g_per_day ?? null;
            case 'fcr':
              return standardPoint.feed_conversion_ratio ?? null;
            default:
              return null;
          }
        });

        const datasets: ChartConfiguration<'line'>['data']['datasets'] = [
          { data: standardMetricData, label: 'Standar', borderColor: '#F5A623', tension: 0.2, borderDash: [5, 5], fill: false }
        ];

        // Only add actual data if there is any actual production data
        if (actualProductionData.length > 0) {
          datasets.push({ data: actualMetricData, label: 'Aktual', borderColor: '#0A4D9D', tension: 0.2, fill: false });
        }

        this.lineChartData = {
          labels: labels,
          datasets: datasets
        };

        let yAxisTitle = 'Nilai Metrik';
        switch (metricType) {
          case 'hen_day_production_percent': yAxisTitle = 'Hen Day Production (%)'; break;
          case 'avg_egg_weight_g': yAxisTitle = 'Berat Telur Rata-rata (g)'; break;
          case 'avg_feed_intake_g_per_day': yAxisTitle = 'Konsumsi Pakan Rata-rata (g/ekor/hari)'; break;
          case 'fcr': yAxisTitle = 'FCR (Pakan/Produksi)'; break;
        }
        if (this.lineChartOptions.scales && this.lineChartOptions.scales['y']) {
          (this.lineChartOptions.scales['y'] as any).title.text = yAxisTitle;
        }
        
        return undefined;
      }),
      catchError((err: any) => {
        console.error('Error processing performance data:', err);
        this.notificationService.showError(`Gagal memproses data performa: ${err.message}`);
        this.lineChartData = { labels: [], datasets: [] };
        return of(undefined);
      })
    );
  }

  // Helper function to get week number (ISO week date) - Not used for labels anymore, but kept for reference if needed
  private getWeekNumber(d: Date): number {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
  }

  saveData(): void {
    this.notificationService.showInfo('Fungsi simpan tidak tersedia di halaman performa mingguan.');
  }

  openDeleteModal(item: any): void {
    this.notificationService.showInfo('Fungsi hapus tidak tersedia di halaman performa mingguan.');
  }

  closeDeleteModal(): void {
    this.isConfirmModalOpen = false;
    this.itemToDelete = null;
  }

  confirmDelete(): void {
    this.notificationService.showInfo('Fungsi konfirmasi hapus tidak tersedia di halaman performa mingguan.');
  }
}