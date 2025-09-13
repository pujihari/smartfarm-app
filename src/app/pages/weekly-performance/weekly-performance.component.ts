import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray, FormControl } from '@angular/forms';
import { Observable, BehaviorSubject, switchMap, map, tap, combineLatest, startWith, of, catchError } from 'rxjs'; // Menambahkan 'of' dan 'catchError'
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
    private reportService: ReportService, // Inject ReportService
    private productionService: ProductionService // Inject ProductionService
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
    // Trigger data load whenever form values change
    this.performanceForm.valueChanges.pipe(
      startWith(this.performanceForm.value), // Initial load
      tap(() => this.isChartLoading = true), // Set loading state
      switchMap(filters => this.loadPerformanceData(filters))
    ).subscribe(
      () => this.isChartLoading = false, // Clear loading state on success
      (error: any) => { // Menambahkan tipe 'any' untuk error
        this.notificationService.showError(`Gagal memuat data performa: ${error.message}`);
        this.isChartLoading = false; // Clear loading state on error
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

    const actualData$ = this.productionService.getProductionDataWithDetails().pipe(
      map(data => data.filter(item => 
        item.flock_id === selectedFlockId &&
        new Date(item.date) >= new Date(startDate) &&
        new Date(item.date) <= new Date(endDate)
      ))
    );

    const standardData$: Observable<ProductionStandardData[]> = this.reportService.getStandardByBreed(selectedFlock.breed).pipe(
      switchMap(standard => {
        if (standard) {
          return this.reportService.getStandardData(standard.id);
        }
        return of<ProductionStandardData[]>([]); // Memberikan tipe eksplisit
      })
    );

    return combineLatest([actualData$, standardData$]).pipe(
      map(([actualProductionData, standardPerformanceData]) => {
        const weeklyDataMap = new Map<string, {
          totalEggs: number;
          totalEggWeight: number;
          totalFeed: number;
          population: number;
          count: number;
          dates: Date[];
        }>();

        actualProductionData.forEach(item => {
          const itemDate = new Date(item.date);
          const weekNumber = this.getWeekNumber(itemDate);
          const year = itemDate.getFullYear();
          const weekKey = `${year}-W${weekNumber.toString().padStart(2, '0')}`;

          if (!weeklyDataMap.has(weekKey)) {
            weeklyDataMap.set(weekKey, {
              totalEggs: 0,
              totalEggWeight: 0,
              totalFeed: 0,
              population: selectedFlock.population, // Assuming population is constant for the flock
              count: 0,
              dates: []
            });
          }
          const weekEntry = weeklyDataMap.get(weekKey)!;
          weekEntry.totalEggs += item.totalEggCount;
          weekEntry.totalEggWeight += item.totalEggWeightKg;
          weekEntry.totalFeed += item.totalFeedConsumption;
          weekEntry.count++;
          weekEntry.dates.push(itemDate);
        });

        const sortedWeekKeys = Array.from(weeklyDataMap.keys()).sort();
        const labels = sortedWeekKeys.map(key => {
          const datesInWeek = weeklyDataMap.get(key)?.dates || [];
          if (datesInWeek.length > 0) {
            const firstDay = new Date(Math.min(...datesInWeek.map(d => d.getTime())));
            const lastDay = new Date(Math.max(...datesInWeek.map(d => d.getTime())));
            return `${this.datePipe.transform(firstDay, 'dd/MM')} - ${this.datePipe.transform(lastDay, 'dd/MM')}`;
          }
          return key;
        });

        const actualMetricData = sortedWeekKeys.map(key => {
          const entry = weeklyDataMap.get(key)!;
          const avgPopulation = entry.population; // Use flock's population
          const avgFeedPerDay = entry.totalFeed / entry.count; // Total feed for the week / number of days with data

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
              return 0;
          }
        });

        const standardMetricData = sortedWeekKeys.map(key => {
          const datesInWeek = weeklyDataMap.get(key)?.dates || [];
          if (datesInWeek.length === 0) return null;

          const firstDayOfWeek = new Date(Math.min(...datesInWeek.map(d => d.getTime())));
          const diffTime = Math.abs(firstDayOfWeek.getTime() - new Date(selectedFlock.start_date).getTime());
          const ageDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + selectedFlock.entry_age_days;
          const ageWeeks = Math.floor(ageDays / 7);

          const standardPoint = (standardPerformanceData as ProductionStandardData[]).find((d: ProductionStandardData) => d.age_weeks === ageWeeks); // Memberikan tipe eksplisit
          if (!standardPoint) return null;

          switch (metricType) {
            case 'hen_day_production_percent':
              return standardPoint.hen_day_production_percent;
            case 'avg_egg_weight_g':
              return standardPoint.egg_weight_g ?? null; // Mengubah undefined menjadi null
            case 'avg_feed_intake_g_per_day':
              return standardPoint.feed_consumption_g_per_day ?? null; // Mengubah undefined menjadi null
            case 'fcr':
              return standardPoint.feed_conversion_ratio ?? null; // Mengubah undefined menjadi null
            default:
              return null;
          }
        });

        this.lineChartData = {
          labels: labels,
          datasets: [
            { data: actualMetricData, label: 'Aktual', borderColor: '#0A4D9D', tension: 0.2, fill: false },
            { data: standardMetricData, label: 'Standar', borderColor: '#F5A623', tension: 0.2, borderDash: [5, 5], fill: false }
          ]
        };

        // Update Y-axis title based on selected metric
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
      catchError((err: any) => { // Memberikan tipe 'any' untuk error
        console.error('Error processing performance data:', err);
        this.notificationService.showError(`Gagal memproses data performa: ${err.message}`);
        this.lineChartData = { labels: [], datasets: [] };
        return of(undefined);
      })
    );
  }

  // Helper function to get week number (ISO week date)
  private getWeekNumber(d: Date): number {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
  }

  // Metode save, open/close delete modal tidak lagi relevan untuk halaman ini
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