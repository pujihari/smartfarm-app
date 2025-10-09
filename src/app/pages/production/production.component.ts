import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ProductionService } from '../../services/production.service';
import { FlockService } from '../../services/flock.service';
import { NotificationService } from '../../services/notification.service';
import { Observable, BehaviorSubject, of, combineLatest, Subject } from 'rxjs';
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
type FlockWithFarmInfo = Flock & { farmName: string, farmType: 'Grower' | 'Layer' };
type FarmWithDetails = Farm & { activeFlocks: number, population: number, status: 'Aktif' | 'Tidak Aktif' };

@Component({
  selector: 'app-production',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ConfirmationModalComponent],
  templateUrl: './production.component.html',
  styleUrl: './production.component.css'
})
export class ProductionComponent implements OnInit, OnDestroy {
  private refresh$ = new Subject<void>();
  private suppressFormChanges = false;
  private destroy$ = new Subject<void>();
  productionData$: Observable<ProductionDataWithDetails[]>;
  
  filteredFarms$: Observable<FarmWithDetails[]>;
  filteredFlocks$: Observable<FlockWithFarmInfo[]>;
  
  private allFarms: FarmWithDetails[] = [];
  private allFlocks: FlockWithFarmInfo[] = [];

  isConfirmModalOpen = false;
  dataToDelete: ProductionData | null = null;

  dailyProductionForm: FormGroup;
  isSaving = false;
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

  // New observables for total egg counts and weights from dynamic rows
  totalNormalEggsCount$: Observable<number>;
  totalNormalEggsWeightKg$: Observable<number>;
  totalWhiteEggsCount$: Observable<number>;
  totalWhiteEggsWeightKg$: Observable<number>;
  totalCrackedEggsCount$: Observable<number>;
  totalCrackedEggsWeightKg$: Observable<number>;

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
    
    this.dailyProductionForm = this.fb.group({
      id: [null],
      farm_filter: [null],
      flock_id: [null, Validators.required],
      date: [new Date().toISOString().split('T')[0], Validators.required],
      mortality_count: [0, [Validators.required, Validators.min(0)]],
      culling_count: [0, [Validators.required, Validators.min(0)]],
      feed_consumption: this.createFeedGroup(), // Refactored to single FormGroup
      egg_production_entries: this.createEggProductionGroup(), // Refactored to single FormGroup
      notes: ['']
    });

    // --- Filtering Farms and Flocks based on productionType ---
    const currentProductionType$ = this.route.paramMap.pipe(
      map(params => (params.get('type') === 'grower' ? 'Grower' : 'Layer') as 'Grower' | 'Layer'),
      startWith(this.productionType === 'grower' ? 'Grower' : 'Layer'),
      distinctUntilChanged(),
      tap(type => this.productionType = type.toLowerCase() as 'grower' | 'layer')
    );

    const allFarms$ = this.farmService.getFarms().pipe(
      tap(farms => this.allFarms = farms)
    );

    this.filteredFarms$ = combineLatest([allFarms$, currentProductionType$]).pipe(
      map(([allFarms, typeFilter]) => {
        return allFarms.filter(farm => farm.type === typeFilter);
      })
    );

    const allFlocks$ = this.flockService.getFlocksWithFarmInfo().pipe(
      tap(flocks => this.allFlocks = flocks)
    );

    const farmFilterChanges$ = this.dailyProductionForm.get('farm_filter')!.valueChanges.pipe(startWith(null));

    this.filteredFlocks$ = combineLatest([
      allFlocks$,
      farmFilterChanges$,
      currentProductionType$
    ]).pipe(
      map(([allFlocks, selectedFarmId, typeFilter]) => {
        let filtered = allFlocks.filter(flock => flock.farmType === typeFilter);
        if (selectedFarmId) {
          filtered = filtered.filter(flock => flock.farm_id === Number(selectedFarmId));
        }
        return filtered;
      }),
      // Set default flock_id if available and not already set
      tap(flocks => {
        if (flocks.length > 0 && !this.dailyProductionForm.get('flock_id')?.value) {
          this.dailyProductionForm.get('flock_id')?.setValue(flocks[0].id, { emitEvent: true });
        }
      })
    );
    // --- End Filtering Farms and Flocks ---

    // Initialize observables for calculated totals (existing depletion and feed)
    this.totalDepletion$ = combineLatest([
      this.dailyProductionForm.get('mortality_count')!.valueChanges.pipe(startWith(this.dailyProductionForm.get('mortality_count')!.value)),
      this.dailyProductionForm.get('culling_count')!.valueChanges.pipe(startWith(this.dailyProductionForm.get('culling_count')!.value))
    ]).pipe(
      map(([mortality, culling]) => this.parseNumber(mortality) + this.parseNumber(culling))
    );

    this.totalFeedConsumption$ = this.dailyProductionForm.get('feed_consumption')!.valueChanges.pipe(
      startWith(this.dailyProductionForm.get('feed_consumption')!.value),
      map((feedItem: FeedConsumption) => {
        return feedItem ? this.parseNumber(feedItem.quantity_kg) : 0;
      })
    );

    // New observables for total egg counts and weights from dynamic rows
    const eggProductionEntryValueChanges$ = this.dailyProductionForm.get('egg_production_entries')!.valueChanges.pipe(
      startWith(this.dailyProductionForm.get('egg_production_entries')!.value)
    );

    this.totalNormalEggsCount$ = eggProductionEntryValueChanges$.pipe(
      map(entry => this.parseNumber(entry.normal_count))
    );
    this.totalNormalEggsWeightKg$ = eggProductionEntryValueChanges$.pipe(
      map(entry => this.parseNumber(entry.normal_weight))
    );
    this.totalWhiteEggsCount$ = eggProductionEntryValueChanges$.pipe(
      map(entry => this.parseNumber(entry.white_count))
    );
    this.totalWhiteEggsWeightKg$ = eggProductionEntryValueChanges$.pipe(
      map(entry => this.parseNumber(entry.white_weight))
    );
    this.totalCrackedEggsCount$ = eggProductionEntryValueChanges$.pipe(
      map(entry => this.parseNumber(entry.cracked_count))
    );
    this.totalCrackedEggsWeightKg$ = eggProductionEntryValueChanges$.pipe(
      map(entry => this.parseNumber(entry.cracked_weight))
    );

    // Inisialisasi totalEggCount$ dan totalEggWeightKg$ dengan menggabungkan total granular
    this.totalEggCount$ = combineLatest([
      this.totalNormalEggsCount$,
      this.totalWhiteEggsCount$,
      this.totalCrackedEggsCount$
    ]).pipe(
      map(([normal, white, cracked]) => normal + white + cracked)
    );

    this.totalEggWeightKg$ = combineLatest([
      this.totalNormalEggsWeightKg$,
      this.totalWhiteEggsWeightKg$,
      this.totalCrackedEggsWeightKg$
    ]).pipe(
      map(([normalWeight, whiteWeight, crackedWeight]) => normalWeight + whiteWeight + crackedWeight)
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

    this.inventoryService.getFeedOptions().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (options: FeedOption[]) => this.feedOptions = options,
      error: (err: any) => console.error('Error loading feed options for daily form:', err)
    });

    this.dailyProductionForm.get('farm_filter')!.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.dailyProductionForm.get('flock_id')!.reset(null, { emitEvent: true });
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
          this.dailyProductionForm.get('id')?.setValue(data.id, { emitEvent: false });

          // Populate egg production entries with aggregated data into a single row
          this.eggProductionEntry.patchValue({
            normal_count: data.normal_eggs,
            normal_weight: data.normal_eggs_weight_kg,
            white_count: data.white_eggs,
            white_weight: data.white_eggs_weight_kg,
            cracked_count: data.cracked_eggs,
            cracked_weight: data.cracked_eggs_weight_kg,
          }, { emitEvent: false });

          // Populate feed consumption
          this.feedConsumptionGroup.patchValue({
            feed_code: data.feed_consumption && data.feed_consumption.length > 0 ? data.feed_consumption[0].feed_code : null,
            quantity_kg: data.feed_consumption && data.feed_consumption.length > 0 ? data.feed_consumption[0].quantity_kg : 0
          }, { emitEvent: false });

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

    // Add logging for form validity
    this.dailyProductionForm.statusChanges.pipe(takeUntil(this.destroy$)).subscribe(status => {
      console.log('Daily Production Form Status:', status);
      if (status === 'INVALID') {
        this.logFormValidationErrors(this.dailyProductionForm);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public parseNumber(value: string | number | null): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    if (typeof value === 'number') {
      return value;
    }
    // Replace comma with dot for decimal parsing
    const parsed = parseFloat(value.replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  }

  onMortalityInputChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const value = this.parseNumber(inputElement.value);
    this.dailyProductionForm.get('mortality_count')?.setValue(value, { emitEvent: true });
  }

  onCullingInputChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const value = this.parseNumber(inputElement.value);
    this.dailyProductionForm.get('culling_count')?.setValue(value, { emitEvent: true });
  }

  private calculateFlockAge(flockId: number | null, date: string | null): void {
    console.log('calculateFlockAge called with flockId:', flockId, 'date:', date);
    if (!flockId || !date) {
      this.currentFlockAgeInDays = null;
      this.updateEggFieldsVisibility(false);
      console.log('Flock ID or date missing, age set to null, egg fields visibility false.');
      return;
    }

    const selectedFlock = this.allFlocks.find(f => f.id === Number(flockId));
    if (!selectedFlock) {
      this.currentFlockAgeInDays = null;
      this.updateEggFieldsVisibility(false);
      console.log('Selected flock not found, age set to null, egg fields visibility false.');
      return;
    }

    const startDate = new Date(selectedFlock.start_date);
    const recordingDate = new Date(date);
    const timeDiff = recordingDate.getTime() - startDate.getTime();
    const dayDiff = Math.round(timeDiff / (1000 * 60 * 60 * 24));
    
    const age = dayDiff + selectedFlock.entry_age_days;
    this.currentFlockAgeInDays = age;
    console.log('Calculated flock age:', age, 'days');

    this.updateEggFieldsVisibility(age > 126);
  }

  private updateEggFieldsVisibility(ageConditionMet: boolean): void {
    console.log('updateEggFieldsVisibility called with ageConditionMet:', ageConditionMet);
    if (this.productionType === 'grower') {
      this.showEggProductionFields = false;
      console.log('Production type is grower, showEggProductionFields set to false.');
    } else { // 'layer'
      this.showEggProductionFields = ageConditionMet;
      console.log('Production type is layer, showEggProductionFields set to:', this.showEggProductionFields);
    }
    
    const eggControls = [
      'normal_count', 'normal_weight', 'white_count', 'white_weight', 'cracked_count', 'cracked_weight'
    ];
    eggControls.forEach((controlName: string) => {
      const control = this.eggProductionEntry.get(controlName);
      if (control) {
        if (this.showEggProductionFields) {
          control.setValidators([Validators.min(0)]);
        } else {
          control.clearValidators();
          control.setValue(0, { emitEvent: false }); // Set to 0 when hidden
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
      notes: ''
    }, { emitEvent: false });

    // Reset feed consumption group
    this.feedConsumptionGroup.patchValue({
      feed_code: null,
      quantity_kg: 0
    }, { emitEvent: false });
    this.feedConsumptionGroup.setValidators(this.feedItemValidator());
    this.feedConsumptionGroup.updateValueAndValidity({ emitEvent: false });

    // Reset egg production group
    this.eggProductionEntry.patchValue({
      normal_count: 0,
      normal_weight: 0,
      white_count: 0,
      white_weight: 0,
      cracked_count: 0,
      cracked_weight: 0,
    }, { emitEvent: false });
    // Re-apply validators based on visibility
    this.updateEggFieldsVisibility(this.currentFlockAgeInDays !== null && this.currentFlockAgeInDays > 126);

    this.isEditingExistingEntry = false;
  }

  get feedConsumptionGroup(): FormGroup {
    return this.dailyProductionForm.get('feed_consumption') as FormGroup;
  }

  private feedItemValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const feedCode = control.get('feed_code')?.value;
      const quantityKg = this.parseNumber(control.get('quantity_kg')?.value);

      // If both are empty/zero, it's valid (optional empty row)
      if (!feedCode && quantityKg === 0) {
        return null;
      }

      // If feedCode is present, quantityKg must be > 0
      if (feedCode && quantityKg <= 0) {
        return { invalidFeedQuantity: true };
      }

      // If quantityKg is > 0, feedCode must be present
      if (!feedCode && quantityKg > 0) {
        return { missingFeedCode: true };
      }
      return null;
    };
  }

  createFeedGroup(feed?: FeedConsumption): FormGroup {
    const group = this.fb.group({
      feed_code: [feed?.feed_code || ''],
      quantity_kg: [feed?.quantity_kg || 0, [Validators.min(0)]]
    });
    group.setValidators(this.feedItemValidator());
    return group;
  }

  onFeedQuantityChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const value = this.parseNumber(inputElement.value);
    const control = this.feedConsumptionGroup.get('quantity_kg');
    if (control) {
      control.setValue(value, { emitEvent: true });
    }
  }

  get eggProductionEntry(): FormGroup {
    return this.dailyProductionForm.get('egg_production_entries') as FormGroup;
  }

  createEggProductionGroup(entry?: any): FormGroup {
    return this.fb.group({
      normal_count: [entry?.normal_count ?? 0, [Validators.min(0)]],
      normal_weight: [entry?.normal_weight ?? 0, [Validators.min(0)]],
      white_count: [entry?.white_count ?? 0, [Validators.min(0)]],
      cracked_count: [entry?.cracked_count ?? 0, [Validators.min(0)]],
      cracked_weight: [entry?.cracked_weight ?? 0, [Validators.min(0)]],
      white_weight: [entry?.white_weight ?? 0, [Validators.min(0)]],
    });
  }

  onEggInputChange(event: Event, controlName: string): void {
    const inputElement = event.target as HTMLInputElement;
    const value = inputElement.value;
    const parsedValue = this.parseNumber(value);
    const control = this.eggProductionEntry.get(controlName);
    if (control) {
      control.setValue(parsedValue, { emitEvent: true });
    }
  }

  onSubmit(): void {
    console.log('onSubmit called. Form valid:', this.dailyProductionForm.valid);
    console.log('onSubmit form value:', this.dailyProductionForm.getRawValue());
    this.logFormValidationErrors(this.dailyProductionForm); // Log errors before saving attempt
    this.saveDailyLog();
  }

  get formDebug() {
    if (!this.dailyProductionForm) {
      return null;
    }
    const invalidControls: string[] = [];
    this.findInvalidControlsRecursive(this.dailyProductionForm, '', invalidControls);
    return {
      status: this.dailyProductionForm.status,
      valid: this.dailyProductionForm.valid,
      invalidControls,
      errors: this.dailyProductionForm.errors
    };
  }

  private findInvalidControlsRecursive(control: AbstractControl, path: string, invalidControls: string[]): void {
    if (control instanceof FormGroup) {
      Object.keys(control.controls).forEach(key => {
        const childControl = control.get(key);
        if (childControl) {
          this.findInvalidControlsRecursive(childControl, path ? `${path}.${key}` : key, invalidControls);
        }
      });
    } else if (control instanceof FormArray) {
      control.controls.forEach((childControl, index) => {
        this.findInvalidControlsRecursive(childControl, `${path}[${index}]`, invalidControls);
      });
    } else {
      if (control.invalid) {
        invalidControls.push(path);
      }
    }
  }

  saveDailyLog(): void {
    this.dailyProductionForm.markAllAsTouched();

    if (this.dailyProductionForm.invalid) {
      this.notificationService.showWarning('Harap isi semua field yang wajib diisi dengan benar.');
      return;
    }

    const rawEntry = this.dailyProductionForm.getRawValue();
    
    const validFeedConsumption: FeedConsumption[] = [];
    const feedItem = rawEntry.feed_consumption;
    if (feedItem.feed_code && this.parseNumber(feedItem.quantity_kg) > 0) {
      validFeedConsumption.push({ feed_code: feedItem.feed_code, quantity_kg: this.parseNumber(feedItem.quantity_kg) });
    }

    let aggregatedNormalEggs = 0;
    let aggregatedNormalEggsWeightKg = 0;
    let aggregatedWhiteEggs = 0;
    let aggregatedWhiteEggsWeightKg = 0;
    let aggregatedCrackedEggs = 0;
    let aggregatedCrackedEggsWeightKg = 0;

    if (this.showEggProductionFields) {
      const singleEggEntry = rawEntry.egg_production_entries;
      aggregatedNormalEggs += this.parseNumber(singleEggEntry.normal_count);
      aggregatedNormalEggsWeightKg += this.parseNumber(singleEggEntry.normal_weight);
      aggregatedWhiteEggs += this.parseNumber(singleEggEntry.white_count);
      aggregatedWhiteEggsWeightKg += this.parseNumber(singleEggEntry.white_weight);
      aggregatedCrackedEggs += this.parseNumber(singleEggEntry.cracked_count);
      aggregatedCrackedEggsWeightKg += this.parseNumber(singleEggEntry.cracked_weight);
    }

    const dataToSave: Partial<ProductionData> = {
      id: rawEntry.id,
      flock_id: Number(rawEntry.flock_id),
      date: rawEntry.date,
      mortality_count: this.parseNumber(rawEntry.mortality_count),
      culling_count: this.parseNumber(rawEntry.culling_count),
      normal_eggs: aggregatedNormalEggs,
      white_eggs: aggregatedWhiteEggs,
      cracked_eggs: aggregatedCrackedEggs,
      normal_eggs_weight_kg: aggregatedNormalEggsWeightKg,
      white_eggs_weight_kg: aggregatedWhiteEggsWeightKg,
      cracked_eggs_weight_kg: aggregatedCrackedEggsWeightKg,
      notes: rawEntry.notes || null,
      feed_consumption: validFeedConsumption
    };

    console.log('Data to save in ProductionComponent:', dataToSave);

    this.isSaving = true;

    if (dataToSave.id) {
      this.productionService.updateProductionData(dataToSave).subscribe({
        next: () => {
          this.notificationService.showSuccess('Data produksi berhasil diperbarui.');
          this.isSaving = false;
          this.refresh$.next();
          this.resetDailyFormForNewEntry();
        },
        error: (err: any) => {
          this.isSaving = false;
          console.error('Error updating production data:', err);
          this.notificationService.showError(`Gagal memperbarui data produksi: ${err?.message ?? err}`);
        }
      });
    } else {
      const { id, ...dataForAdd } = dataToSave;
      this.productionService.addDailyLog(dataForAdd as Omit<ProductionData, 'id'>).subscribe({
        next: () => {
          this.notificationService.showSuccess('Data produksi berhasil disimpan.');
          this.isSaving = false;
          this.refresh$.next();
          this.resetDailyFormForNewEntry();
        },
        error: (err: any) => {
          this.isSaving = false;
          console.error('Error saving new production data:', err);
          this.notificationService.showError(`Gagal menyimpan data produksi: ${err?.message ?? err}`);
        }
      });
    }
  }

  editDailyEntry(data: ProductionDataWithDetails): void {
    this.isEditingExistingEntry = true;
    
    const formattedData = {
      ...data,
      date: data.date.split('T')[0]
    };
    this.dailyProductionForm.patchValue(formattedData, { emitEvent: false });
    this.dailyProductionForm.get('id')?.setValue(data.id, { emitEvent: false });

    // Populate feed consumption
    this.feedConsumptionGroup.patchValue({
      feed_code: data.feed_consumption && data.feed_consumption.length > 0 ? data.feed_consumption[0].feed_code : null,
      quantity_kg: data.feed_consumption && data.feed_consumption.length > 0 ? data.feed_consumption[0].quantity_kg : 0
    }, { emitEvent: false });

    // Populate egg production entries with aggregated data into a single row
    this.eggProductionEntry.patchValue({
      normal_count: data.normal_eggs,
      normal_weight: data.normal_eggs_weight_kg,
      white_count: data.white_eggs,
      white_weight: data.white_eggs_weight_kg,
      cracked_count: data.cracked_eggs,
      cracked_weight: data.cracked_eggs_weight_kg,
    }, { emitEvent: false });

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

  private logFormValidationErrors(form: FormGroup | FormArray): void {
    Object.keys(form.controls).forEach(key => {
      const control = form.get(key);
      if (control instanceof FormGroup || control instanceof FormArray) {
        this.logFormValidationErrors(control);
      } else if (control instanceof AbstractControl) {
        if (control.invalid) {
          console.log(`Control: ${key}, Value: ${control.value}, Errors:`, control.errors);
        }
      }
    });
  }
}