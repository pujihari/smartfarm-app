import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray, FormControl } from '@angular/forms';
import { Observable, BehaviorSubject, switchMap } from 'rxjs';
import { RespiratoryService } from '../../services/respiratory.service';
import { FlockService } from '../../services/flock.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { RespiratoryData } from '../../models/respiratory-data.model';
import { Flock } from '../../models/flock.model';
import { ConfirmationModalComponent } from '../../components/confirmation-modal/confirmation-modal.component';

type FlockWithFarmInfo = Flock & { farmName: string };
type RespiratoryHistory = RespiratoryData & { flockName: string, farmName: string };

@Component({
  selector: 'app-respiratory',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ConfirmationModalComponent],
  templateUrl: './respiratory.component.html',
  styleUrl: './respiratory.component.css',
  providers: [DatePipe]
})
export class RespiratoryComponent implements OnInit {
  respiratoryForm: FormGroup;
  flocks$: Observable<FlockWithFarmInfo[]>;
  
  private refresh$ = new BehaviorSubject<void>(undefined);
  history$: Observable<RespiratoryHistory[]>;

  isSaving = false;
  isConfirmModalOpen = false;
  itemToDelete: RespiratoryHistory | null = null;

  availableSymptoms = ['Ngorok', 'Bersin', 'Batuk', 'Nafas Cepat', 'Lesu', 'Nafsu Makan Turun'];

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

    this.flocks$ = this.flockService.getFlocksWithFarmInfo();
    this.history$ = this.refresh$.pipe(
      switchMap(() => this.respiratoryService.getRespiratoryHistory())
    );
  }

  ngOnInit(): void {}

  get symptoms(): FormArray {
    return this.respiratoryForm.get('symptoms') as FormArray;
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