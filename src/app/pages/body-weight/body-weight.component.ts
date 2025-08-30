import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, BehaviorSubject, switchMap, map, of, combineLatest, startWith, tap } from 'rxjs';
import { BodyWeightService } from '../../services/body-weight.service';
import { FlockService } from '../../services/flock.service';
import { FarmService } from '../../services/farm.service';
import { ReportService } from '../../services/report.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { BodyWeightData } from '../../models/body-weight.model';
import { Flock } from '../../models/flock.model';
import { Farm } from '../../models/farm.model';
import { ConfirmationModalComponent } from '../../components/confirmation-modal/confirmation-modal.component';

type FlockWithFarmInfo = Flock & { farmName: string };
type BodyWeightHistory = BodyWeightData & { flockName: string, farmName: string };

interface CalculationResult {
  flock_id: number;
  flockName: string;
  weighing_date: string;
  age_days: number;
  sampleSize: number;
  avg_body_weight_actual: number;
  stdDev: number;
  uniformity_percentage: number;
  avg_body_weight_standard: number | null;
}

@Component({
  selector: 'app-body-weight',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ConfirmationModalComponent],
  templateUrl: './body-weight.component.html',
  styleUrl: './body-weight.component.css',
  providers: [DatePipe]
})
export class BodyWeightComponent implements OnInit {
  calculatorForm: FormGroup;
  farms$: Observable<Farm[]>;
  flocks$: Observable<FlockWithFarmInfo[]>;
  private allFlocks: FlockWithFarmInfo[] = [];
  
  private refresh$ = new BehaviorSubject<void>(undefined);
  history$: Observable<BodyWeightHistory[]>;

  calculationResult: CalculationResult | null = null;
  isSaving = false;

  isConfirmModalOpen = false;
  itemToDelete: BodyWeightHistory | null = null;

  constructor(
    private fb: FormBuilder,
    private bodyWeightService: BodyWeightService,
    private flockService: FlockService,
    private farmService: FarmService,
    private reportService: ReportService,
    public authService: AuthService,
    private notificationService: NotificationService,
    private datePipe: DatePipe
  ) {
    this.calculatorForm = this.fb.group({
      farm_id: [null], // Farm filter
      flock_id: [null, Validators.required],
      weighing_date: [this.datePipe.transform(new Date(), 'yyyy-MM-dd'), Validators.required],
      weights: ['', Validators.required]
    });

    this.farms$ = this.farmService.getFarms();

    const allFlocks$ = this.flockService.getFlocksWithFarmInfo().pipe(
      tap(flocks => this.allFlocks = flocks)
    );

    const selectedFarmId$ = this.calculatorForm.get('farm_id')!.valueChanges.pipe(startWith(null));

    this.flocks$ = combineLatest([allFlocks$, selectedFarmId$]).pipe(
      map(([allFlocks, selectedFarmId]) => {
        if (selectedFarmId) {
          return allFlocks.filter(flock => flock.farm_id === Number(selectedFarmId));
        }
        return allFlocks;
      })
    );

    this.history$ = this.refresh$.pipe(
      switchMap(() => this.bodyWeightService.getBodyWeightHistory())
    );
  }

  ngOnInit(): void {
    // Reset flock selection when farm filter changes
    this.calculatorForm.get('farm_id')!.valueChanges.subscribe(() => {
      this.calculatorForm.get('flock_id')!.reset();
    });
  }

  calculate(): void {
    if (this.calculatorForm.invalid) return;

    const formValue = this.calculatorForm.value;
    const weightsStr = formValue.weights.trim().split(/[\s,;\n]+/);
    const weights = weightsStr.map(Number).filter((w: number) => !isNaN(w) && w > 0);

    if (weights.length < 2) {
      this.notificationService.showWarning('Mohon masukkan minimal 2 data berat badan yang valid.');
      return;
    }

    const sampleSize = weights.length;
    const sum = weights.reduce((a: number, b: number) => a + b, 0);
    const avg = sum / sampleSize;
    
    const stdDev = Math.sqrt(weights.map((x: number) => Math.pow(x - avg, 2)).reduce((a: number, b: number) => a + b, 0) / (sampleSize - 1));
    
    const lowerBound = avg * 0.9;
    const upperBound = avg * 1.1;
    const uniformCount = weights.filter((w: number) => w >= lowerBound && w <= upperBound).length;
    const uniformity = (uniformCount / sampleSize) * 100;

    const selectedFlock = this.allFlocks.find(f => f.id === Number(formValue.flock_id));
    if (!selectedFlock) return;

    const startDate = new Date(selectedFlock.start_date);
    const weighingDate = new Date(formValue.weighing_date);
    const age_days = Math.round((weighingDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + selectedFlock.entry_age_days;
    const age_weeks = Math.floor(age_days / 7);

    this.reportService.getStandardByBreed(selectedFlock.breed).pipe(
      switchMap(standard => {
        if (standard) {
          return this.reportService.getStandardBodyWeight(standard.id, age_weeks);
        }
        return of(null);
      })
    ).subscribe(standardWeight => {
      this.calculationResult = {
        flock_id: selectedFlock.id,
        flockName: selectedFlock.name,
        weighing_date: formValue.weighing_date,
        age_days: age_days,
        sampleSize: sampleSize,
        avg_body_weight_actual: avg,
        stdDev: stdDev,
        uniformity_percentage: uniformity,
        avg_body_weight_standard: standardWeight
      };
    });
  }

  saveResult(): void {
    if (!this.calculationResult) return;
    this.isSaving = true;

    const dataToSave: Omit<BodyWeightData, 'id'> = {
      flock_id: this.calculationResult.flock_id,
      weighing_date: this.calculationResult.weighing_date,
      age_days: this.calculationResult.age_days,
      avg_body_weight_actual: this.calculationResult.avg_body_weight_actual,
      avg_body_weight_standard: this.calculationResult.avg_body_weight_standard ?? undefined,
      uniformity_percentage: this.calculationResult.uniformity_percentage
    };

    this.bodyWeightService.saveBodyWeightData(dataToSave).subscribe({
      next: () => {
        this.notificationService.showSuccess('Data berhasil disimpan atau diperbarui!');
        this.isSaving = false;
        this.calculationResult = null;
        this.calculatorForm.reset({
          farm_id: this.calculatorForm.get('farm_id')?.value, // Keep farm filter
          flock_id: null,
          weighing_date: this.datePipe.transform(new Date(), 'yyyy-MM-dd'),
          weights: ''
        });
        this.refresh$.next();
      },
      error: (err) => {
        this.isSaving = false;
        this.notificationService.showError(`Gagal menyimpan data: ${err.message}`);
      }
    });
  }

  openDeleteModal(item: BodyWeightHistory): void {
    this.itemToDelete = item;
    this.isConfirmModalOpen = true;
  }

  closeDeleteModal(): void {
    this.isConfirmModalOpen = false;
    this.itemToDelete = null;
  }

  confirmDelete(): void {
    if (!this.itemToDelete) return;
    this.bodyWeightService.deleteBodyWeightData(this.itemToDelete.id).subscribe({
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