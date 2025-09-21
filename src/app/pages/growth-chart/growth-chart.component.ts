import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, combineLatest, of } from 'rxjs';
import { switchMap, map, startWith, tap, catchError } from 'rxjs/operators';
import { FlockService } from '../../services/flock.service';
import { BodyWeightService } from '../../services/body-weight.service';
import { ReportService, ProductionStandardData } from '../../services/report.service';
import { NotificationService } from '../../services/notification.service';
import { Flock } from '../../models/flock.model';
import { BaseChartDirective } from 'ng2-charts';
import { ChartOptions, ChartConfiguration } from 'chart.js';

type FlockWithFarmInfo = Flock & { farmName: string };

@Component({
  selector: 'app-growth-chart',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BaseChartDirective],
  templateUrl: './growth-chart.component.html',
  styleUrl: './growth-chart.component.css',
  providers: [DatePipe]
})
export class GrowthChartComponent implements OnInit {
  filterForm: FormGroup;
  flocks$: Observable<FlockWithFarmInfo[]>;
  private allFlocks: FlockWithFarmInfo[] = [];
  isChartLoading = false;

  public lineChartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { title: { display: true, text: 'Umur (Minggu)' } },
      y: { beginAtZero: true, title: { display: true, text: 'Berat Badan (g)' } }
    }
  };
  public lineChartLegend = true;

  constructor(
    private fb: FormBuilder,
    private flockService: FlockService,
    private bodyWeightService: BodyWeightService,
    private reportService: ReportService,
    private notificationService: NotificationService,
    private datePipe: DatePipe
  ) {
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    this.filterForm = this.fb.group({
      flock_id: [null, Validators.required],
      startDate: [this.datePipe.transform(oneYearAgo, 'yyyy-MM-dd')],
      endDate: [this.datePipe.transform(today, 'yyyy-MM-dd')]
    });

    this.flocks$ = this.flockService.getFlocksWithFarmInfo().pipe(
      tap(flocks => this.allFlocks = flocks)
    );
  }

  ngOnInit(): void {
    this.filterForm.valueChanges.pipe(
      startWith(this.filterForm.value),
      tap(() => this.isChartLoading = true),
      switchMap(filters => this.loadChartData(filters))
    ).subscribe({
      next: () => this.isChartLoading = false,
      error: (err) => {
        this.notificationService.showError(`Gagal memuat data grafik: ${err.message}`);
        this.isChartLoading = false;
      }
    });
  }

  private loadChartData(filters: any): Observable<void> {
    const { flock_id, startDate, endDate } = filters;
    if (!flock_id) {
      this.lineChartData = { labels: [], datasets: [] };
      return of(undefined);
    }

    const selectedFlock = this.allFlocks.find(f => f.id === Number(flock_id));
    if (!selectedFlock) return of(undefined);

    const actualData$ = this.bodyWeightService.getBodyWeightHistoryByFlockId(selectedFlock.id, startDate, endDate);
    const standardData$ = this.reportService.getStandardByBreed(selectedFlock.breed).pipe(
      switchMap(standard => standard ? this.reportService.getStandardData(standard.id) : of([]))
    );

    return combineLatest([actualData$, standardData$]).pipe(
      map(([actualHistory, standardHistory]) => {
        const weeklyActual = new Map<number, { totalWeight: number; count: number }>();
        actualHistory.forEach(item => {
          const ageWeeks = Math.floor(item.age_days / 7);
          if (!weeklyActual.has(ageWeeks)) {
            weeklyActual.set(ageWeeks, { totalWeight: 0, count: 0 });
          }
          const entry = weeklyActual.get(ageWeeks)!;
          entry.totalWeight += item.avg_body_weight_actual;
          entry.count++;
        });

        const maxWeek = 90;
        const labels = Array.from({ length: maxWeek + 1 }, (_, i) => `Minggu ${i}`);
        
        const actualDataPoints = Array.from({ length: maxWeek + 1 }, (_, i) => {
          const entry = weeklyActual.get(i);
          return entry ? entry.totalWeight / entry.count : null;
        });

        const standardDataPoints = Array.from({ length: maxWeek + 1 }, (_, i) => {
          const standard = standardHistory.find(s => s.age_weeks === i);
          return standard?.body_weight_g ?? null;
        });

        this.lineChartData = {
          labels,
          datasets: [
            { data: actualDataPoints, label: 'Berat Badan Aktual (g)', borderColor: '#0A4D9D', tension: 0.2, fill: false },
            { data: standardDataPoints, label: 'Berat Badan Standar (g)', borderColor: '#F5A623', tension: 0.2, borderDash: [5, 5], fill: false }
          ]
        };
        return undefined;
      }),
      catchError(err => {
        this.notificationService.showError(`Gagal memproses data grafik: ${err.message}`);
        return of(undefined);
      })
    );
  }
}