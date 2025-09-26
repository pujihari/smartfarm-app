import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { ProductionService } from '../../services/production.service';
import { FlockService } from '../../services/flock.service';
import { NotificationService } from '../../services/notification.service';
import { Observable, BehaviorSubject, of, lastValueFrom, combineLatest, Subject } from 'rxjs';
import { switchMap, map, startWith, debounceTime, distinctUntilChanged, takeUntil, filter, catchError, tap } from 'rxjs/operators'; // Import 'tap'
import { ProductionData, FeedConsumption } from '../../models/production-data.model';
import { Flock } from '../../models/flock.model';
import { ConfirmationModalComponent } from '../../components/confirmation-modal/confirmation-modal.component';
import { AuthService } from '../../services/auth.service';
import { InventoryService, FeedOption } from '../../services/inventory.service';
import { FarmService } from '../../services/farm.service'; // Import FarmService
import { Farm } from '../../models/farm.model'; // Import Farm model

type ProductionDataWithDetails = ProductionData & { flockName: string, farmName: string, totalEggCount: number, totalFeedConsumption: number, totalEggWeightKg: number, flockPopulation: number, totalDepletion: number };
type FlockWithFarmInfo = Flock & { farmName: string };

interface StagedProductionItem extends Partial<ProductionData> {
  id?: number;
  flockName: string;
  farmName: string;
  totalEggCount: number;
  totalFeedConsumption: number;
  totalDepletion: number;
}

@Component({
  selector: 'app-production',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ConfirmationModalComponent],
  templateUrl: './production.component.html',
  styleUrl: './production.component.css'
})
export class ProductionComponent implements OnInit, OnDestroy {
  private refresh$ = new BehaviorSubject<void>(undefined);
  private suppressFormChanges = false;
  private destroy$ = new Subject<void>();
  productionData$: Observable<ProductionDataWithDetails[]>;
  flocks$: Observable<FlockWithFarmInfo[]>;
  farms$: Observable<Farm[]>; // Declare farms$
  isConfirmModalOpen = false;
  dataToDelete: ProductionData | null = null;

  batchProductionForm: FormGroup;
  stagedProductionData: StagedProductionItem[] = [];
  isSavingBatch = false;
  private allFlocks: FlockWithFarmInfo[] = []; // Explicitly type allFlocks
  feedOptions: FeedOption[] = [];

  currentFlockAgeInDays: number | null = null;
  showEggProductionFields = false; // Default to false
  isEditingExistingEntry = false;

  constructor(
    private fb: FormBuilder,
    private productionService: ProductionService,
    private flockService: FlockService,
    private notificationService: NotificationService,
    public authService: AuthService,
    private inventoryService: InventoryService,
    private farmService: FarmService // Inject FarmService
  ) {
    this.productionData$ = this.refresh$.pipe(
      switchMap(() => this.productionService.getProductionDataWithDetails())
    );
    
    this.farms$ = this.farmService.getFarms(); // Initialize farms$

    this.batchProductionForm = this.fb.group({
      id: [null],
      farm_filter: [null], // New form control for farm filter
      flock_id: [null, Validators.required],
      date: [new Date().toISOString().split('T')[0], Validators.required],
      mortality_count: [0, Validators.min(0)], // Removed Validators.required
      culling_count: [0, Validators.min(0)], // Removed Validators.required
      normal_eggs: [0],
      white_eggs: [0],
      cracked_eggs: [0],
      normal_eggs_weight_kg: [0],
      white_eggs_weight_kg: [0],
      cracked_eggs_weight_kg: [0],
      feed_consumption: this.fb.array([]),
      notes: ['']
    });

    const allFlocks$ = this.flockService.getFlocksWithFarmInfo().pipe(
      tap((flocks: FlockWithFarmInfo[]) => this.allFlocks = flocks) // Type 'flocks'
    );

    const farmFilterChanges$ = this.batchProductionForm.get('farm_filter')!.valueChanges.pipe(startWith(null));

    this.flocks$ = combineLatest([
      allFlocks$,
      farmFilterChanges$
    ]).pipe(
      map(([allFlocks, selectedFarmId]) => {
        if (selectedFarmId) {
          return allFlocks.filter((flock: FlockWithFarmInfo) => flock.farm_id === Number(selectedFarmId)); // Type 'flock'
        }
        return allFlocks;
      })
    );
  }

  ngOnInit(): void {
    this.inventoryService.getFeedOptions().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (options: FeedOption[]) => this.feedOptions = options,
      error: (err: any) => console.error('Error loading feed options for batch form:', err)
    });

    // Subscribe to farm_filter changes to reset flock_id
    this.batchProductionForm.get('farm_filter')!.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.batchProductionForm.get('flock_id')!.reset(null, { emitEvent: false });
    });

    const formValueChanges$ = combineLatest([
      this.batchProductionForm.get('flock_id')!.valueChanges.pipe(startWith(this.batchProductionForm.get('flock_id')!.value)),
      this.batchProductionForm.get('date')!.valueChanges.pipe(startWith(this.batchProductionForm.get('date')!.value))
    ]).pipe(
      debounceTime(100),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      filter(() => !this.suppressFormChanges),
      takeUntil(this.destroy$)
    );

    formValueChanges$.pipe(
      switchMap(([flockId, date]: [number | null, string | null]) => {
        this.suppressFormChanges = true;
        if (!flockId || !date) {
          setTimeout(() => this.resetBatchFormForNewEntry(), 0); // Ditunda
          return of(null as (ProductionData & { mortality_count: number, culling_count: number }) | null);
        }
        this.calculateFlockAge(flockId, date);
        return this.productionService.getProductionDataForDay(Number(flockId), date).pipe(
          catchError((err: any) => {
            this.notificationService.showError(`Gagal memuat data produksi harian: ${err?.message ?? err}`);
            setTimeout(() => this.resetBatchFormForNewEntry(), 0); // Ditunda
            return of(null as (ProductionData & { mortality_count: number, culling_count: number }) | null);
          })
        );
      })
    ).subscribe({
      next: (data: (ProductionData & { mortality_count: number, culling_count: number }) | null) => {
        if (data) {
          this.isEditingExistingEntry = true;
          const formattedData = { ...data, date: data.date.split('T')[0] };
          this.batchProductionForm.patchValue(formattedData, { emitEvent: false });
          this.batch_feed_consumption.clear({ emitEvent: false });
          data.feed_consumption.forEach((feed: FeedConsumption) => this.addFeedToBatchForm(feed, { emitEvent: false }));
          this.batchProductionForm.get('id')?.setValue(data.id, { emitEvent: false });
          this.updateEggFieldsVisibility(this.currentFlockAgeInDays !== null && this.currentFlockAgeInDays > 126);
        } else {
          setTimeout(() => this.resetBatchFormForNewEntry(), 0); // Ditunda
        }
        this.suppressFormChanges = false;
      },
      error: (err: any) => {
        this.notificationService.showError(`Gagal memproses data: ${err?.message ?? err}`);
        setTimeout(() => this.resetBatchFormForNewEntry(), 0); // Ditunda
        this.suppressFormChanges = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

    eggControls.forEach((controlName: string) => {
      const control = this.batchProductionForm.get(controlName);
      if (control) {
        if (show) {
          control.setValidators([Validators.min(0)]); // Removed Validators.required
          if (control.value === null) {
            control.setValue(0, { emitEvent: false });
          }
        } else {
          control.clearValidators();
          control.setValue(0, { emitEvent: false });
        }
        control.updateValueAndValidity({ emitEvent: false });
      }
    });
  }

  private resetBatchFormForNewEntry(): void {
    const currentFlockId = this.batchProductionForm.get('flock_id')?.value;
    const currentDate = this.batchProductionForm.get('date')?.value;
    const currentFarmFilter = this.batchProductionForm.get('farm_filter')?.value; // Keep farm filter

    this.batchProductionForm.patchValue({
      id: null,
      farm_filter: currentFarmFilter, // Retain farm filter value
      flock_id: currentFlockId,
      date: currentDate,
      mortality_count: 0,
      culling_count: 0,
      normal_eggs: 0,
      white_eggs: 0,
      cracked_eggs: 0,
      normal_eggs_weight_kg: 0,
      white_eggs_weight_kg: 0,
      cracked_eggs_weight_kg: 0,
      notes: ''
    }, { emitEvent: false });

    while (this.batch_feed_consumption.length !== 0) {
      this.batch_feed_consumption.removeAt(0, { emitEvent: false });
    }
    this.isEditingExistingEntry = false;
  }

  get batch_feed_consumption(): FormArray {
    return this.batchProductionForm.get('feed_consumption') as FormArray;
  }

  createFeedGroup(feed?: FeedConsumption): FormGroup {
    return this.fb.group({
      feed_code: [feed?.feed_code || ''], // Removed Validators.required
      quantity_kg: [feed?.quantity_kg || null, Validators.min(0)] // Removed Validators.required, changed min to 0
    });
  }

  addFeedToBatchForm(feed?: FeedConsumption, options?: { emitEvent?: boolean }): void {
    const pushOptions = options || { emitEvent: true }; 
    this.batch_feed_consumption.push(this.createFeedGroup(feed), pushOptions);
  }

  removeFeedFromBatchForm(index: number): void {
    this.batch_feed_consumption.removeAt(index);
  }

  addToStage(): void {
    // Mark only required fields as touched to show validation for them
    this.batchProductionForm.get('flock_id')?.markAsTouched();
    this.batchProductionForm.get('date')?.markAsTouched();

    if (this.batchProductionForm.get('flock_id')?.invalid || this.batchProductionForm.get('date')?.invalid) {
      this.notificationService.showWarning('Harap pilih Flok dan Tanggal.');
      return;
    }

    const rawEntry = this.batchProductionForm.getRawValue();
    
    // Apply defaults for numeric fields if null/empty
    const newEntry: Partial<ProductionData> = {
      id: rawEntry.id,
      flock_id: Number(rawEntry.flock_id),
      date: rawEntry.date,
      mortality_count: rawEntry.mortality_count === null ? 0 : Number(rawEntry.mortality_count),
      culling_count: rawEntry.culling_count === null ? 0 : Number(rawEntry.culling_count),
      normal_eggs: rawEntry.normal_eggs === null ? 0 : Number(rawEntry.normal_eggs),
      white_eggs: rawEntry.white_eggs === null ? 0 : Number(rawEntry.white_eggs),
      cracked_eggs: rawEntry.cracked_eggs === null ? 0 : Number(rawEntry.cracked_eggs),
      normal_eggs_weight_kg: rawEntry.normal_eggs_weight_kg === null ? 0 : Number(rawEntry.normal_eggs_weight_kg),
      white_eggs_weight_kg: rawEntry.white_eggs_weight_kg === null ? 0 : Number(rawEntry.white_eggs_weight_kg),
      cracked_eggs_weight_kg: rawEntry.cracked_eggs_weight_kg === null ? 0 : Number(rawEntry.cracked_eggs_weight_kg),
      notes: rawEntry.notes || null,
      // Filter valid feed consumption entries
      feed_consumption: (rawEntry.feed_consumption || []).filter((feed: FeedConsumption) => 
        feed.feed_code && feed.quantity_kg !== null && feed.quantity_kg > 0
      )
    };

    const flockInfo = this.allFlocks.find((f: FlockWithFarmInfo) => f.id === newEntry.flock_id);
    
    const stagedItem: StagedProductionItem = {
      ...newEntry,
      flockName: flockInfo?.name || 'N/A',
      farmName: flockInfo?.farmName || 'N/A',
      totalEggCount: (newEntry.normal_eggs || 0) + (newEntry.white_eggs || 0) + (newEntry.cracked_eggs || 0),
      totalFeedConsumption: (newEntry.feed_consumption || []).reduce((sum: number, feed: FeedConsumption) => sum + (feed.quantity_kg || 0), 0),
      totalDepletion: (newEntry.mortality_count || 0) + (newEntry.culling_count || 0),
    };

    if (this.isEditingExistingEntry && stagedItem.id) {
      this.saveData(stagedItem as ProductionData);
    } else {
      const existingIndexInStaging = this.stagedProductionData.findIndex(
        (item: StagedProductionItem) => item.flock_id === stagedItem.flock_id && item.date === stagedItem.date
      );

      if (existingIndexInStaging > -1) {
        this.stagedProductionData[existingIndexInStaging] = stagedItem;
        this.notificationService.showInfo('Data untuk flok dan tanggal ini diperbarui di daftar.');
      } else {
        this.stagedProductionData.push(stagedItem);
        this.notificationService.showSuccess('Data ditambahkan ke daftar.');
      }
    }

    this.resetBatchFormForNewEntry();
  }

  removeFromStage(index: number): void {
    this.stagedProductionData.splice(index, 1);
    this.notificationService.showInfo('Data dihapus dari daftar.');
  }

  async saveStagedData(): Promise<void> {
    if (this.stagedProductionData.length === 0) {
      this.notificationService.showWarning('Tidak ada data di daftar untuk disimpan.');
      return;
    }
    this.isSavingBatch = true;

    for (const data of this.stagedProductionData) {
      try {
        await lastValueFrom(this.productionService.addDailyLog(data as Omit<ProductionData, 'id'>));
      } catch (error: any) {
        this.notificationService.showError(`Gagal menyimpan data untuk ${data.flockName} (${data.date}): ${error.message}`);
      }
    }

    this.isSavingBatch = false;
    this.stagedProductionData = [];
    this.notificationService.showSuccess('Semua data dalam daftar berhasil diproses.');
    this.refresh$.next();
    this.resetBatchFormForNewEntry();
  }

  editDailyEntry(data: ProductionDataWithDetails): void {
    this.isEditingExistingEntry = true;
    
    const formattedData = {
      ...data,
      date: data.date.split('T')[0]
    };
    this.batchProductionForm.patchValue(formattedData, { emitEvent: false });
    this.batchProductionForm.get('id')?.setValue(data.id, { emitEvent: false });

    this.batch_feed_consumption.clear({ emitEvent: false });
    data.feed_consumption.forEach((feed: FeedConsumption) => this.addFeedToBatchForm(feed, { emitEvent: false }));

    this.calculateFlockAge(data.flock_id, data.date.split('T')[0]);
    this.notificationService.showInfo(`Memuat data untuk ${data.flockName} pada ${formattedData.date} untuk diedit.`);
  }

  saveData(data: Partial<ProductionData>): void {
    const saveObservable = data.id
      ? this.productionService.updateProductionData(data)
      : this.productionService.addDailyLog(data as Omit<ProductionData, 'id'>);

    saveObservable.subscribe({
      next: () => {
        this.notificationService.showSuccess('Data produksi berhasil disimpan.');
        this.refresh$.next();
        this.resetBatchFormForNewEntry();
      },
      error: (err: any) => {
        this.notificationService.showError(`Gagal menyimpan data produksi: ${err?.message ?? err}`);
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