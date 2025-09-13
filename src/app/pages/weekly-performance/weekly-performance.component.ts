import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray, FormControl } from '@angular/forms';
import { Observable, BehaviorSubject, switchMap, map, tap } from 'rxjs';
import { FlockService } from '../../services/flock.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { Flock } from '../../models/flock.model';
import { ConfirmationModalComponent } from '../../components/confirmation-modal/confirmation-modal.component';
import { BaseChartDirective } from 'ng2-charts';
import { ChartOptions, ChartConfiguration } from 'chart.js';

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
  // Form untuk filter atau input metrik performa (akan diisi nanti)
  performanceForm: FormGroup; 
  flocks$: Observable<FlockWithFarmInfo[]>;
  private allFlocks: FlockWithFarmInfo[] = [];
  
  private refresh$ = new BehaviorSubject<void>(undefined);
  // history$: Observable<any[]>; // Akan diganti dengan data performa umum

  isSaving = false; // Mungkin tidak relevan lagi untuk halaman ini
  isConfirmModalOpen = false;
  itemToDelete: any | null = null; // Akan diganti

  // Chart properties
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
          text: 'Nilai Metrik' // Akan dinamis sesuai metrik yang dipilih
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
    private datePipe: DatePipe
  ) {
    this.performanceForm = this.fb.group({
      // Akan diisi dengan kontrol untuk filter metrik performa
      flock_id: [null, Validators.required],
      metric_type: ['hen_day_production_percent', Validators.required], // Default ke Hen Day
      startDate: [this.datePipe.transform(new Date(new Date().setMonth(new Date().getMonth() - 3)), 'yyyy-MM-dd')],
      endDate: [this.datePipe.transform(new Date(), 'yyyy-MM-dd')]
    });

    this.flocks$ = this.flockService.getFlocksWithFarmInfo().pipe(
      tap(flocks => this.allFlocks = flocks)
    );
    
    // Logika untuk mengambil dan memproses data grafik akan ada di sini
    // this.history$ = this.refresh$.pipe(
    //   switchMap(() => this.respiratoryService.getRespiratoryHistory()),
    //   tap(history => this.processHistoryForChart(history))
    // );
  }

  ngOnInit(): void {
    this.performanceForm.valueChanges.pipe(
      switchMap(() => this.refresh$.pipe(map(() => this.performanceForm.value)))
    ).subscribe(filters => {
      this.loadPerformanceData(filters);
    });
    this.refresh$.next(); // Initial load
  }

  private loadPerformanceData(filters: any): void {
    this.isChartLoading = true;
    // Placeholder for actual data loading and processing
    // This will involve fetching production data and standard data
    this.lineChartData = { labels: [], datasets: [] };
    this.isChartLoading = false;
  }

  // Helper function to get week number (ISO week date)
  private getWeekNumber(d: Date): number {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
  }

  // Metode save, open/close delete modal akan dihapus atau diadaptasi
  saveData(): void {
    this.notificationService.showInfo('Fungsi simpan akan diadaptasi untuk halaman performa mingguan.');
  }

  openDeleteModal(item: any): void {
    this.notificationService.showInfo('Fungsi hapus akan diadaptasi untuk halaman performa mingguan.');
  }

  closeDeleteModal(): void {
    this.isConfirmModalOpen = false;
    this.itemToDelete = null;
  }

  confirmDelete(): void {
    this.notificationService.showInfo('Fungsi konfirmasi hapus akan diadaptasi untuk halaman performa mingguan.');
  }
}