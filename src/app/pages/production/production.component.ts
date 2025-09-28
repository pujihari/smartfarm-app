import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { ProductionService } from '../../services/production.service';
import { FlockService } from '../../services/flock.service';
import { NotificationService } from '../../services/notification.service';
import { Observable, BehaviorSubject, of, lastValueFrom, combineLatest, Subject } from 'rxjs';
import { switchMap, map, startWith, debounceTime, distinctUntilChanged, takeUntil, filter, catchError, tap } from 'rxjs/operators';
import { ProductionData, FeedConsumption } from '../../models/production-data.model';
import { Flock } from '../../models/flock.model';
import { ConfirmationModalComponent } from '../../components/confirmation-modal/confirmation-modal.component';
import { AuthService } from '../../services/auth.service';
import { InventoryService, FeedOption } from '../../services/inventory.service';
import { FarmService } from '../../services/farm.service';
import { Farm } from '../../models/farm.model';
import { ActivatedRoute } from '@angular/router';

type ProductionDataWithDetails = ProductionData & { flockName: string, farmName: string, totalEggCount: number, totalFeedConsumption: number, totalEggWeightKg: number, flockPopulation: number, totalDepletion: number };
type FlockWithFarmInfo = Flock & { farmName: string };

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
  farms$: Observable<Farm[]>;
  isConfirmModalOpen = false;
  dataToDelete: ProductionData | null = null;

  dailyProductionForm: FormGroup;
  isSaving = false;
  private allFlocks: FlockWithFarmInfo[] = [];
  feedOptions: FeedOption[] = [];

  currentFlockAgeInDays: number | null = null;
  showEggProductionFields = false;
  isEditingExistingEntry = false;
  productionType: 'grower' | 'layer' = 'layer';

  // Observables for calculated totals
  totalDepletion$: Observable<number>;
  totalEggCount$: Observable<number>;
  totalEggWeightKg$: Observable<number>;
  totalFeedConsumption$: Observable<number>;

  constructor(
    private fb: FormBuilder,
    private productionService: ProductionService,
    private flockService: FlockService,
    private notificationService: NotificationService,
    public authService: AuthService,
    private inventoryService: InventoryService,
    private farmService: FarmService,
    private route: ActivatedRoute
  ) {
    this.productionData$ = this.refresh$.pipe(
      switchMap(() => this.productionService.getProductionDataWithDetails())
    );
    
    this.farms$ = this.farmService.getFarms();

    this.dailyProductionForm = this.fb.group({
      id: [null],
      farm_filter: [null],
      flock_id: [null, Validators.required],
      date: [new Date().toISOString().split('T')[0], Validators.required],
      mortality_count: [0, [Validators.required, Validators.min(0)]],
      culling_count: [0, [Validators.required, Validators.min(0)]],
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
      tap((flocks: FlockWithFarmInfo[]) => this.allFlocks = flocks)
    );

    const farmFilterChanges$ = this.dailyProductionForm.get('farm_filter')!.valueChanges.pipe(startWith(null));

    this.flocks$ = combineLatest([
      allFlocks$,
      farmFilterChanges$
    ]).pipe(
      map(([allFlocks, selectedFarmId]) => {
        if (selectedFarmId) {
          return allFlocks.filter((flock: FlockWithFarmInfo) => flock.farm_id === Number(selectedFarmId));
        }
        return allFlocks;
      })
    );

    // Initialize observables for calculated totals
    this.totalDepletion$ = combineLatest([
      this.dailyProductionForm.get('mortality_count')!.valueChanges.pipe(startWith(this.dailyProductionForm.get('mortality_count')!.value)),
      this.dailyProductionForm.get('culling_count')!.valueChanges.pipe(startWith(this.dailyProductionForm.get('culling_count')!.value))
    ]).pipe(
      map(([mortality, culling]) => this.parseNumber(mortality) + this.parseNumber(culling))
    );

    this.totalEggCount$ = combineLatest([
      this.dailyProductionForm.get('normal_eggs')!.valueChanges.pipe(startWith(this.dailyProductionForm.get('normal_eggs')!.value)),
      this.dailyProductionForm.get('white_eggs')!.valueChanges.pipe(startWith(this.dailyProductionForm.get('white_eggs')!.value)),
      this.dailyProductionForm.get('cracked_eggs')!.valueChanges.pipe(startWith(this.dailyProductionForm.get('cracked_eggs')!.value))
    ]).pipe(
      map(([normal, white, cracked]) => this.parseNumber(normal) + this.parseNumber(white) + this.parseNumber(cracked))
    );

    this.totalEggWeightKg$ = combineLatest([
      this.dailyProductionForm.get('normal_eggs_weight_kg')!.valueChanges.pipe(startWith(this.dailyProductionForm.get('normal_eggs_weight_kg')!.value)),
      this.dailyProductionForm.get('white_eggs_weight_kg')!.valueChanges.pipe(startWith(this.dailyProductionForm.get('white_eggs_weight_kg')!.value)),
      this.dailyProductionForm.get('cracked_eggs_weight_kg')!.valueChanges.pipe(startWith(this.dailyProductionForm.get('cracked_eggs_weight_kg')!.value))
    ]).pipe(
      map(([normal, white, cracked]) => this.parseNumber(normal) + this.parseNumber(white) + this.parseNumber(cracked))
    );

    this.totalFeedConsumption$ = this.dailyProductionForm.get('feed_consumption')!.valueChanges.pipe(
      startWith(this.dailyProductionForm.get('feed_consumption')!.value),
      map((feedItems: FeedConsumption[]) => {
        return feedItems.reduce((sum, item) => sum + this.parseNumber(item.quantity_kg), 0);
      })
    );
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const type = params.get('type');
      if (type === 'grower' || type === 'layer') {
        this.productionType = type;
        this.updateEggFieldsVisibility(this.currentFlockAgeInDays !== null && this.currentFlockAgeInDays > 126);
      } else {
        this.productionType = 'layer';
      }
    });

    if (this.daily_feed_consumption.length === 0) {
      this.addFeedToDailyForm(undefined, { emitEvent: false });
    }

    this.inventoryService.getFeedOptions().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (options: FeedOption[]) => this.feedOptions = options,
      error: (err: any) => console.error('Error loading feed options for daily form:', err)
    });

    this.dailyProductionForm.get('farm_filter')!.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.dailyProductionForm.get('flock_id')!.reset(null, { emitEvent: false });
    });

    const formValueChanges$ = combineLatest([
      this.dailyProductionForm.get('flock_id')!.valueChanges.pipe(startWith(this.dailyProductionForm.get('flock_id')!.value)),
      this.dailyProductionForm.get('date')!.valueChanges.pipe(startWith(this.dailyProductionForm.get('date')!.value))
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
          setTimeout(() => this.resetDailyFormForNewEntry(), 0);
          return of(null as (ProductionData & { mortality_count: number, culling_count: number }) | null);
        }
        this.calculateFlockAge(flockId, date);
        return this.productionService.getProductionDataForDay(Number(flockId), date).pipe(
          catchError((err: any) => {
            this.notificationService.showError(`Gagal memuat data produksi harian: ${err?.message ?? err}`);
            setTimeout(() => this.resetDailyFormForNewEntry(), 0);
            return of(null as (ProductionData & { mortality_count: number, culling_count: number }) | null);
          })
        );
      })
    ).subscribe({
      next: (data: (ProductionData & { mortality_count: number, culling_count: number }) | null) => {
        if (data) {
          this.isEditingExistingEntry = true;
          const formattedData = { ...data, date: data.date.split('T')[0] };
          this.dailyProductionForm.patchValue(formattedData, { emitEvent: false });
          this.daily_feed_consumption.clear({ emitEvent: false });
          data.feed_consumption.forEach((feed: FeedConsumption) => this.addFeedToDailyForm(feed, { emitEvent: false }));
          this.dailyProductionForm.get('id')?.setValue(data.id, { emitEvent: false });
          this.updateEggFieldsVisibility(this.currentFlockAgeInDays !== null && this.currentFlockAgeInDays > 126);
        } else {
          setTimeout(() => this.resetDailyFormForNewEntry(), 0);
        }
        this.suppressFormChanges = false;
      },
      error: (err: any) => {
        this.notificationService.showError(`Gagal memproses data: ${err?.message ?? err}`);
        setTimeout(() => this.resetDailyFormForNewEntry(), 0);
        this.suppressFormChanges = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private parseNumber(value: string | number | null): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    if (typeof value === 'number') {
      return value;
    }
    const parsed = parseFloat(value.replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
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

  private updateEggFieldsVisibility(ageConditionMet: boolean): void {
    if (this.productionType === 'grower') {
      this.showEggProductionFields = false;
    } else { // 'layer'
      this.showEggProductionFields = ageConditionMet;
    }
    
    const eggControls = [
      'normal_eggs', 'white_eggs', 'cracked_eggs',
      'normal_eggs_weight_kg', 'white_eggs_weight_kg', 'cracked_eggs_weight_kg'
    ];

    eggControls.forEach((controlName: string) => {
      const control = this.dailyProductionForm.get(controlName);
      if (control) {
        if (this.showEggProductionFields) {
          control.setValidators([Validators.required, Validators.min(0)]);
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

  private resetDailyFormForNewEntry(): void {
    const currentFlockId = this.dailyProductionForm.get('flock_id')?.value;
    const currentDate = this.dailyProductionForm.get('date')?.value;
    const currentFarmFilter = this.dailyProductionForm.get('farm_filter')?.value;

    this.dailyProductionForm.patchValue({
      id: null,
      farm_filter: currentFarmFilter,
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

    while (this.daily_feed_consumption.length !== 0) {
      this.daily_feed_consumption.removeAt(0, { emitEvent: false });
    }
    this.addFeedToDailyForm(undefined, { emitEvent: false });
    this.isEditingExistingEntry = false;
  }

  get daily_feed_consumption(): FormArray {
    return this.dailyProductionForm.get('feed_consumption') as FormArray;
  }

  createFeedGroup(feed?: FeedConsumption): FormGroup {
    return this.fb.group({
      feed_code: [feed?.feed_code || null],
      quantity_kg: [feed?.quantity_kg || null, Validators.min(0)]
    });
  }

  addFeedToDailyForm(feed?: FeedConsumption, options?: { emitEvent?: boolean }): void {
    const pushOptions = options || { emitEvent: true }; 
    this.daily_feed_consumption.push(this.createFeedGroup(feed), pushOptions);
  }

  removeFeedFromDailyForm(index: number): void {
    this.daily_feed_consumption.removeAt(index);
  }

  saveDailyLog(): void {
    this.dailyProductionForm.markAllAsTouched();
    
    let hasInvalidFeedEntry = false;
    const validFeedConsumption: FeedConsumption[] = [];

    this.daily_feed_consumption.controls.forEach(control => {
      const feedCode = control.get('feed_code')?.value;
      const quantityKg = this.parseNumber(control.get('quantity_kg')?.value);

      if (feedCode && quantityKg > 0) {
        validFeedConsumption.push({ feed_code: feedCode, quantity_kg: quantityKg });
      } else if (feedCode || (quantityKg > 0)) {
        hasInvalidFeedEntry = true;
      }
    });

    if (hasInvalidFeedEntry) {
      this.notificationService.showWarning('Harap lengkapi semua detail pakan atau hapus baris yang tidak lengkap.');
      return;
    }

    if (this.dailyProductionForm.invalid) {
      this.notificationService.showWarning('Harap isi semua field yang wajib diisi.');
      return;
    }

    const rawEntry = this.dailyProductionForm.getRawValue();
    
    const dataToSave: Partial<ProductionData> = {
      id: rawEntry.id,
      flock_id: Number(rawEntry.flock_id),
      date: rawEntry.date,
      mortality_count: rawEntry.mortality_count === null ? 0 : Number(rawEntry.mortality_count),
      culling_count: rawEntry.culling_count === null ? 0 : Number(rawEntry.culling_count),
      normal_eggs: rawEntry.normal_eggs === null ? 0 : Number(rawEntry.normal_eggs),
      white_eggs: rawEntry.white_eggs === null ? 0 : Number(rawEntry.white_eggs),
      cracked_eggs: rawEntry.cracked_eggs === null ? 0 : Number(rawEntry.cracked_eggs),
      normal_eggs_weight_kg: this.parseNumber(rawEntry.normal_eggs_weight_kg),
      white_eggs_weight_kg: this.parseNumber(rawEntry.white_eggs_weight_kg),
      cracked_eggs_weight_kg: this.parseNumber(rawEntry.cracked_eggs_weight_kg),
      notes: rawEntry.notes || null,
      feed_consumption: validFeedConsumption
    };

    this.isSaving = true;

    const saveObservable = dataToSave.id
      ? this.productionService.updateProductionData(dataToSave)
      : this.productionService.addDailyLog(dataToSave as Omit<ProductionData, 'id'>);

    saveObservable.subscribe({
      next: () => {
        this.notificationService.showSuccess('Data produksi berhasil disimpan.');
        this.isSaving = false;
        this.refresh$.next();
        this.resetDailyFormForNewEntry();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.notificationService.showError(`Gagal menyimpan data produksi: ${err?.message ?? err}`);
      }
    });
  }

  editDailyEntry(data: ProductionDataWithDetails): void {
    this.isEditingExistingEntry = true;
    
    const formattedData = {
      ...data,
      date: data.date.split('T')[0]
    };
    this.dailyProductionForm.patchValue(formattedData, { emitEvent: false });
    this.dailyProductionForm.get('id')?.setValue(data.id, { emitEvent: false });

    this.daily_feed_consumption.clear({ emitEvent: false });
    data.feed_consumption.forEach((feed: FeedConsumption) => this.addFeedToDailyForm(feed, { emitEvent: false }));
    if (this.daily_feed_consumption.length === 0) {
      this.addFeedToDailyForm(undefined, { emitEvent: false });
    }

    this.calculateFlockAge(data.flock_id, data.date.split('T')[0]);
    this.notificationService.showInfo(`Memuat data untuk ${data.flockName} pada ${formattedData.date} untuk diedit.`);
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