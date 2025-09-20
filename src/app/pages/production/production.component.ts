import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { ProductionService } from '../../services/production.service';
import { FlockService } from '../../services/flock.service';
import { NotificationService } from '../../services/notification.service';
import { Observable, BehaviorSubject, of, lastValueFrom, combineLatest } from 'rxjs';
import { switchMap, map, startWith } from 'rxjs/operators';
import { ProductionData, FeedConsumption } from '../../models/production-data.model';
import { Flock } from '../../models/flock.model';
import { ProductionModalComponent } from '../../components/production-modal/production-modal.component';
import { ConfirmationModalComponent } from '../../components/confirmation-modal/confirmation-modal.component';
import { AuthService } from '../../services/auth.service';
import { InventoryService, FeedOption } from '../../services/inventory.service';

type ProductionDataWithDetails = ProductionData & { flockName: string, farmName: string, totalEggCount: number, totalFeedConsumption: number, totalEggWeightKg: number };
type FlockWithFarmInfo = Flock & { farmName: string };

@Component({
  selector: 'app-production',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ProductionModalComponent, ConfirmationModalComponent],
  templateUrl: './production.component.html',
  styleUrl: './production.component.css'
})
export class ProductionComponent implements OnInit {
  isModalOpen = false;
  dataToEdit: ProductionData | null = null;
  private refresh$ = new BehaviorSubject<void>(undefined);
  productionData$: Observable<ProductionDataWithDetails[]>;
  flocks$: Observable<FlockWithFarmInfo[]>;
  isConfirmModalOpen = false;
  dataToDelete: ProductionData | null = null;

  batchProductionForm: FormGroup;
  stagedProductionData: Partial<ProductionDataWithDetails>[] = [];
  isSavingBatch = false;
  private allFlocks: FlockWithFarmInfo[] = [];
  feedOptions: FeedOption[] = [];

  currentFlockAgeInDays: number | null = null;
  showEggProductionFields = false;

  constructor(
    private fb: FormBuilder,
    private productionService: ProductionService,
    private flockService: FlockService,
    private notificationService: NotificationService,
    public authService: AuthService,
    private inventoryService: InventoryService
  ) {
    this.productionData$ = this.refresh$.pipe(
      switchMap(() => this.productionService.getProductionDataWithDetails())
    );
    this.flocks$ = this.flockService.getFlocksWithFarmInfo().pipe(
      map(flocks => {
        this.allFlocks = flocks;
        return flocks;
      })
    );

    this.batchProductionForm = this.fb.group({
      flock_id: [null, Validators.required],
      date: [new Date().toISOString().split('T')[0], Validators.required],
      normal_eggs: [null],
      white_eggs: [null],
      cracked_eggs: [null],
      normal_eggs_weight_kg: [null],
      white_eggs_weight_kg: [null],
      cracked_eggs_weight_kg: [null],
      feed_consumption: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.addFeedToBatchForm();

    this.inventoryService.getFeedOptions().subscribe({
      next: (options) => this.feedOptions = options,
      error: (err) => console.error('Error loading feed options for batch form:', err)
    });

    combineLatest([
      this.batchProductionForm.get('flock_id')!.valueChanges.pipe(startWith(this.batchProductionForm.get('flock_id')!.value)),
      this.batchProductionForm.get('date')!.valueChanges.pipe(startWith(this.batchProductionForm.get('date')!.value))
    ]).subscribe(([flockId, date]) => {
      this.calculateFlockAge(flockId, date);
    });
  }

  private calculateFlockAge(flockId: number | null, date: string | null): void {
    if (!flockId || !date) {
      this.currentFlockAgeInDays = null;
      this.updateEggFieldsVisibility(false);
      return;
    }

    const selectedFlock = this.allFlocks.find(f => f.id === Number(flockId));
    if (!selectedFlock) {
      this.currentFlockAgeInDays = null;
      this.updateEggFieldsVisibility(false);
      return;
    }

    const startDate = new Date(selectedFlock.start_date);
    const recordingDate = new Date(date);
    const timeDiff = recordingDate.getTime() - startDate.getTime();
    const dayDiff = Math.round(timeDiff / (1000 * 60 * 60 * 24));
    
    const age = dayDiff + selectedFlock.entry_age_days;
    this.currentFlockAgeInDays = age;

    this.updateEggFieldsVisibility(age > 126);
  }

  private updateEggFieldsVisibility(show: boolean): void {
    this.showEggProductionFields = show;
    const eggControls = [
      'normal_eggs', 'white_eggs', 'cracked_eggs',
      'normal_eggs_weight_kg', 'white_eggs_weight_kg', 'cracked_eggs_weight_kg'
    ];

    eggControls.forEach(controlName => {
      const control = this.batchProductionForm.get(controlName);
      if (control) {
        if (show) {
          control.setValidators([Validators.required, Validators.min(0)]);
          if (control.value === null) {
            control.setValue(0);
          }
        } else {
          control.clearValidators();
          control.setValue(null);
        }
        control.updateValueAndValidity();
      }
    });
  }

  get batch_feed_consumption(): FormArray {
    return this.batchProductionForm.get('feed_consumption') as FormArray;
  }

  createFeedGroup(feed?: FeedConsumption): FormGroup {
    return this.fb.group({
      feed_code: [feed?.feed_code || '', Validators.required],
      quantity_kg: [feed?.quantity_kg || null, [Validators.required, Validators.min(0.1)]]
    });
  }

  addFeedToBatchForm(feed?: FeedConsumption): void {
    this.batch_feed_consumption.push(this.createFeedGroup(feed));
  }

  removeFeedFromBatchForm(index: number): void {
    this.batch_feed_consumption.removeAt(index);
  }

  addToStage(): void {
    this.batchProductionForm.markAllAsTouched();
    if (this.batchProductionForm.invalid) {
      this.notificationService.showWarning('Harap isi semua field yang wajib diisi.');
      return;
    }

    const newEntry = this.batchProductionForm.getRawValue();
    newEntry.flock_id = Number(newEntry.flock_id);

    if (!this.showEggProductionFields) {
      newEntry.normal_eggs = 0;
      newEntry.white_eggs = 0;
      newEntry.cracked_eggs = 0;
      newEntry.normal_eggs_weight_kg = 0;
      newEntry.white_eggs_weight_kg = 0;
      newEntry.cracked_eggs_weight_kg = 0;
    }

    const existingIndex = this.stagedProductionData.findIndex(
      item => item.flock_id === newEntry.flock_id && item.date === newEntry.date
    );

    if (existingIndex > -1) {
      const existingEntry = this.stagedProductionData[existingIndex];
      existingEntry.normal_eggs = (existingEntry.normal_eggs || 0) + newEntry.normal_eggs;
      existingEntry.white_eggs = (existingEntry.white_eggs || 0) + newEntry.white_eggs;
      existingEntry.cracked_eggs = (existingEntry.cracked_eggs || 0) + newEntry.cracked_eggs;
      existingEntry.normal_eggs_weight_kg = (existingEntry.normal_eggs_weight_kg || 0) + newEntry.normal_eggs_weight_kg;
      existingEntry.white_eggs_weight_kg = (existingEntry.white_eggs_weight_kg || 0) + newEntry.white_eggs_weight_kg;
      existingEntry.cracked_eggs_weight_kg = (existingEntry.cracked_eggs_weight_kg || 0) + newEntry.cracked_eggs_weight_kg;
      
      const feedMap = new Map<string, number>();
      (existingEntry.feed_consumption || []).forEach(feed => feedMap.set(feed.feed_code, feed.quantity_kg));
      
      newEntry.feed_consumption.forEach((newFeed: FeedConsumption) => {
        const currentQty = feedMap.get(newFeed.feed_code) || 0;
        feedMap.set(newFeed.feed_code, currentQty + newFeed.quantity_kg);
      });

      existingEntry.feed_consumption = Array.from(feedMap.entries()).map(([feed_code, quantity_kg]) => ({ feed_code, quantity_kg }));

    } else {
      const flockInfo = this.allFlocks.find(f => f.id === newEntry.flock_id);
      newEntry.flockName = flockInfo?.name || 'N/A';
      this.stagedProductionData.push(newEntry);
    }

    this.batchProductionForm.patchValue({
      normal_eggs: this.showEggProductionFields ? 0 : null,
      white_eggs: this.showEggProductionFields ? 0 : null,
      cracked_eggs: this.showEggProductionFields ? 0 : null,
      normal_eggs_weight_kg: this.showEggProductionFields ? 0 : null,
      white_eggs_weight_kg: this.showEggProductionFields ? 0 : null,
      cracked_eggs_weight_kg: this.showEggProductionFields ? 0 : null,
    });
    this.batch_feed_consumption.clear();
    this.addFeedToBatchForm();
    this.batchProductionForm.markAsPristine();
    this.batchProductionForm.markAsUntouched();
  }

  removeFromStage(index: number): void {
    this.stagedProductionData.splice(index, 1);
  }

  async saveStagedData(): Promise<void> {
    if (this.stagedProductionData.length === 0) return;
    this.isSavingBatch = true;

    const successfullySaved: Partial<ProductionDataWithDetails>[] = [];
    const failedSaves: { data: Partial<ProductionDataWithDetails>; error: string }[] = [];

    for (const data of this.stagedProductionData) {
      try {
        await lastValueFrom(this.productionService.addProductionData(data as Omit<ProductionData, 'id'>));
        successfullySaved.push(data);
      } catch (error: any) {
        const errorMessage = error?.message || 'An unknown error occurred.';
        failedSaves.push({ data, error: errorMessage });
      }
    }

    this.isSavingBatch = false;
    this.stagedProductionData = failedSaves.map(f => f.data);

    if (successfullySaved.length > 0) {
      this.notificationService.showSuccess(`${successfullySaved.length} data berhasil disimpan.`);
    }
    if (failedSaves.length > 0) {
      const errorDetails = failedSaves.map(f => ` - ${f.data.flockName} (${f.data.date})`).join('\n');
      this.notificationService.showError(`${failedSaves.length} data gagal disimpan (mungkin sudah ada):\n${errorDetails}`, 'Error Batch Save');
    }

    if (successfullySaved.length > 0) {
      this.refresh$.next();
    }
  }

  openAddModal(): void {
    this.dataToEdit = null;
    this.isModalOpen = true;
  }

  openEditModal(data: ProductionData): void {
    this.dataToEdit = data;
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.dataToEdit = null;
  }

  saveData(data: Partial<ProductionData>): void {
    const saveObservable = data.id
      ? this.productionService.updateProductionData(data)
      : this.productionService.addProductionData(data as Omit<ProductionData, 'id'>);

    saveObservable.subscribe({
      next: () => {
        this.notificationService.showSuccess('Data produksi berhasil disimpan.');
        this.closeModal();
        this.refresh$.next();
      },
      error: (err) => {
        this.notificationService.showError(`Gagal menyimpan data produksi: ${err.message}`);
      }
    });
  }

  openDeleteModal(data: ProductionData): void {
    this.dataToDelete = data;
    this.isConfirmModalOpen = true;
  }

  closeDeleteModal(): void {
    this.isConfirmModalOpen = false;
    this.dataToDelete = null;
  }

  confirmDelete(): void {
    if (this.dataToDelete) {
      this.productionService.deleteProductionData(this.dataToDelete.id).subscribe({
        next: () => {
          this.notificationService.showSuccess('Data produksi berhasil dihapus.');
          this.closeDeleteModal();
          this.refresh$.next();
        },
        error: (err) => {
          this.notificationService.showError(`Gagal menghapus data produksi: ${err.message}`);
          this.closeDeleteModal();
        }
      });
    }
  }
}