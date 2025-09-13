import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray, FormControl } from '@angular/forms';
import { Observable, BehaviorSubject, switchMap, map, tap } from 'rxjs';
import { RespiratoryService } from '../../services/respiratory.service';
import { FlockService } from '../../services/flock.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { RespiratoryData } from '../../models/respiratory-data.model';
import { Flock } from '../../models/flock.model';
import { ConfirmationModalComponent } from '../../components/confirmation-modal/confirmation-modal.component';
import { BaseChartDirective } from 'ng2-charts'; // Import BaseChartDirective
import { ChartOptions, ChartConfiguration } from 'chart.js'; // Import ChartOptions dan ChartConfiguration

type FlockWithFarmInfo = Flock & { farmName: string };
type RespiratoryHistory = RespiratoryData & { flockName: string, farmName: string };

@Component({
  selector: 'app-respiratory',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ConfirmationModalComponent, BaseChartDirective], // Tambahkan BaseChartDirective
  templateUrl: './respiratory.component.html',
  styleUrl: './respiratory.component.css',
  providers: [DatePipe]
})
export class RespiratoryComponent implements OnInit {
  respiratoryForm: FormGroup;
  flocks$: Observable<FlockWithFarmInfo[]>;
  private allFlocks: FlockWithFarmInfo[] = []; // Deklarasi properti allFlocks
  
  private refresh$ = new BehaviorSubject<void>(undefined);
  history$: Observable<RespiratoryHistory[]>;

  isSaving = false;
  isConfirmModalOpen = false;
  itemToDelete: RespiratoryHistory | null = null;

  availableSymptoms = ['Ngorok', 'Bersin', 'Batuk', 'Nafas Cepat', 'Lesu', 'Nafsu Makan Turun'];

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
        max: 5, // Respiratory score is 0-5
        title: {
          display: true,
          text: 'Skor Respirasi Rata-rata'
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
    private respiratoryService: RespiratoryService,
    private flockService: FlockService,
    public authService: AuthService,
    private notificationService: NotificationService,
    private datePipe: DatePipe
  ) {
    this.respiratoryForm = this.fb.group({
      flock_id: [null, Validators.required],
      check_date: [this.datePipe.transform(new Date(), 'yyyy-MM-dd'), Validators.required],
      respiratory_score: [0, [Validators.required, Validators.min(0), Validators.max(5)]],
      symptoms: this.fb.array(this.availableSymptoms.map(() => new FormControl(false))),
      notes: ['']
    });

    this.flocks$ = this.flockService.getFlocksWithFarmInfo().pipe( // Memperbarui pipe untuk menyimpan semua flok
      tap(flocks => this.allFlocks = flocks)
    );
    this.history$ = this.refresh$.pipe(
      switchMap(() => this.respiratoryService.getRespiratoryHistory()),
      tap(history => this.processHistoryForChart(history)) // Process data for chart
    );
  }

  ngOnInit(): void {}

  get symptoms(): FormArray {
    return this.respiratoryForm.get('symptoms') as FormArray;
  }

  private processHistoryForChart(history: RespiratoryHistory[]): void {
    this.isChartLoading = true;
    if (!history || history.length === 0) {
      this.lineChartData = { labels: [], datasets: [] };
      this.isChartLoading = false;
      return;
    }

    // Group data by week and flock
    const weeklyData = new Map<string, Map<number, { totalScore: number, count: number }>>(); // Key: 'YYYY-WW', Value: Map<flockId, {totalScore, count}>

    history.forEach(item => {
      const checkDate = new Date(item.check_date);
      const year = checkDate.getFullYear();
      const week = this.getWeekNumber(checkDate); // Helper to get week number
      const weekKey = `${year}-${week < 10 ? '0' + week : week}`; // Format YYYY-WW

      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, new Map());
      }
      const flockWeeklyData = weeklyData.get(weekKey)!;

      if (!flockWeeklyData.has(item.flock_id)) {
        flockWeeklyData.set(item.flock_id, { totalScore: 0, count: 0 });
      }
      const currentFlockData = flockWeeklyData.get(item.flock_id)!;
      currentFlockData.totalScore += item.respiratory_score;
      currentFlockData.count++;
    });

    const sortedWeekKeys = Array.from(weeklyData.keys()).sort();
    const labels = sortedWeekKeys.map(weekKey => `Minggu ${weekKey.split('-')[1]}, ${weekKey.split('-')[0]}`);

    // Prepare datasets for each flock
    const flockDatasets = new Map<number, { label: string, data: (number | null)[], borderColor: string, tension: number }>();
    const colors = ['#0A4D9D', '#F5A623', '#28a745', '#dc3545', '#17a2b8', '#ffc107']; // Define some colors

    // Initialize datasets with nulls for all weeks
    this.allFlocks.forEach((flock: FlockWithFarmInfo, index: number) => { // Menambahkan tipe eksplisit
      flockDatasets.set(flock.id, {
        label: flock.name,
        data: new Array(labels.length).fill(null),
        borderColor: colors[index % colors.length],
        tension: 0.2
      });
    });

    sortedWeekKeys.forEach((weekKey, weekIndex) => {
      const flocksInWeek = weeklyData.get(weekKey)!;
      flocksInWeek.forEach((data, flockId) => {
        const avgScore = data.totalScore / data.count;
        if (flockDatasets.has(flockId)) {
          flockDatasets.get(flockId)!.data[weekIndex] = avgScore;
        }
      });
    });

    this.lineChartData = {
      labels: labels,
      datasets: Array.from(flockDatasets.values())
    };
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

  saveData(): void {
    if (this.respiratoryForm.invalid) return;
    this.isSaving = true;

    const formValue = this.respiratoryForm.value;
    const selectedSymptoms = this.availableSymptoms.filter((_, i) => formValue.symptoms[i]);

    const dataToSave: Omit<RespiratoryData, 'id'> = {
      flock_id: formValue.flock_id,
      check_date: formValue.check_date,
      respiratory_score: formValue.respiratory_score,
      symptoms: selectedSymptoms,
      notes: formValue.notes
    };

    this.respiratoryService.saveRespiratoryData(dataToSave).subscribe({
      next: () => {
        this.notificationService.showSuccess('Data berhasil disimpan atau diperbarui!');
        this.isSaving = false;
        this.respiratoryForm.reset({
          flock_id: null,
          check_date: this.datePipe.transform(new Date(), 'yyyy-MM-dd'),
          respiratory_score: 0,
          symptoms: this.availableSymptoms.map(() => false),
          notes: ''
        });
        this.refresh$.next();
      },
      error: (err) => {
        this.isSaving = false;
        this.notificationService.showError(`Gagal menyimpan data: ${err.message}`);
      }
    });
  }

  openDeleteModal(item: RespiratoryHistory): void {
    this.itemToDelete = item;
    this.isConfirmModalOpen = true;
  }

  closeDeleteModal(): void {
    this.isConfirmModalOpen = false;
    this.itemToDelete = null;
  }

  confirmDelete(): void {
    if (!this.itemToDelete) return;
    this.respiratoryService.deleteRespiratoryData(this.itemToDelete.id).subscribe({
      next: () => {
        this.notificationService.showSuccess('Data berhasil dihapus.');
        this.closeDeleteModal();
        this.refresh$.next();
      },
      error: (err) => {
        this.notificationService.showError(`Gagal menghapus data: ${err.message}`);
        this.closeDeleteModal();
      }
    });
  }
}