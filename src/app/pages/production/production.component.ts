import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { ProductionService } from '../../services/production.service';
import { FlockService } from '../../services/flock.service';
import { NotificationService } from '../../services/notification.service';
import { Observable, BehaviorSubject, of, lastValueFrom } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { ProductionData, FeedConsumption } from '../../models/production-data.model';
import { Flock } from '../../models/flock.model';
import { ProductionModalComponent } from '../../components/production-modal/production-modal.component';
import { ConfirmationModalComponent } from '../../components/confirmation-modal/confirmation-modal.component';
import { AuthService } from '../../services/auth.service';

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
  // Existing properties for modal and main table
  isModalOpen = false;
  dataToEdit: ProductionData | null = null;
  private refresh$ = new BehaviorSubject<void>(undefined);
  productionData$: Observable<ProductionDataWithDetails[]>;
  flocks$: Observable<FlockWithFarmInfo[]>;
  isConfirmModalOpen = false;
  dataToDelete: ProductionData | null = null;

  // New properties for batch input
  batchProductionForm: FormGroup;
  stagedProductionData: Partial<ProductionDataWithDetails>[] = [];
  isSavingBatch = false;
  private allFlocks: FlockWithFarmInfo[] = [];

  constructor(
    private fb: FormBuilder,
    private productionService: ProductionService,
    private flockService: FlockService,
    private notificationService: NotificationService,
    public authService: AuthService
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

    // Initialize form for batch input
    this.batchProductionForm = this.fb.group({
      flock_id: [null, Validators.required],
      date: [new Date().toISOString().split('T')[0], Validators.required],
      normal_eggs: [null, [Validators.required, Validators.min(0)]],
      white_eggs: [null, [Validators.required, Validators.min(0)]],
      cracked_eggs: [null, [Validators.required, Validators.min(0)]],
      normal_eggs_weight_kg: [null, [Validators.required, Validators.min(0)]],
      white_eggs_weight_kg: [null, [Validators.required, Validators.min(0)]],
      cracked_eggs_weight_kg: [null, [Validators.required, Validators.min(0)]],
      feed_consumption: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.addFeedToBatchForm(); // Add one empty feed row by default
  }

  // --- Batch Input Methods ---

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
    if (this.batchProductionForm.invalid) return;

    const newEntry = this.batchProductionForm.getRawValue();
    newEntry.flock_id = Number(newEntry.flock_id);

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
      normal_eggs: null,
      white_eggs: null,
      cracked_eggs: null,
      normal_eggs_weight_kg: null,
      white_eggs_weight_kg: null,
      cracked_eggs_weight_kg: null,
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

  // --- Existing Methods for Modal ---

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