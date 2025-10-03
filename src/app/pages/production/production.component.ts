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
type FlockWithFarmInfo = Flock & { farmName: string, farmType: 'Grower' | 'Layer' }; // Updated type
type FarmWithDetails = Farm & { activeFlocks: number, population: number, status: 'Aktif' | 'Tidak Aktif' }; // Ensure Farm type is correct

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
  
  filteredFarms$: Observable<FarmWithDetails[]>; // New observable for filtered farms
  filteredFlocks$: Observable<FlockWithFarmInfo[]>; // New observable for filtered flocks
  
  private allFarms: FarmWithDetails[] = []; // Cache all farms
  private allFlocks: FlockWithFarmInfo[] = []; // Cache all flocks

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
      feed_consumption: this.fb.array([]),
      egg_production_entries: this.fb.array([this.createEggProductionGroup()]),
      notes: ['']
    });

    // --- Filtering Farms and Flocks based on productionType ---
    const currentProductionType$ = this.route.paramMap.pipe(
      map(params => (params.get('type') === 'grower' ? 'Grower' : 'Layer') as 'Grower' | 'Layer'),
      startWith(this.productionType === 'grower' ? 'Grower' : 'Layer'), // Initial value
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
      map((feedItems: FeedConsumption[]) => {
        return feedItems.reduce((sum, item) => sum + this.parseNumber(item.quantity_kg), 0);
      })
    );

    // New observables for total egg counts and weights from dynamic rows
    const eggProductionEntriesChanges$ = this.eggProductionEntries.valueChanges.pipe(
      startWith(this.eggProductionEntries.value),
      tap(entries => console.log('eggProductionEntriesChanges$ emitted:', entries)) // Debug log
    );

    this.totalNormalEggsCount$ = eggProductionEntriesChanges$.pipe(
      map(entries => {
        const total = entries.reduce((sum: number, entry: any) => sum + this.parseNumber(entry.normal_count), 0);
        console.log('totalNormalEggsCount$ calculated:', total); // Debug log
        return total;
      })
    );
    this.totalNormalEggsWeightKg$ = eggProductionEntriesChanges$.pipe(
      map(entries => {
        const total = entries.reduce((sum: number, entry: any) => sum + this.parseNumber(entry.normal_weight), 0);
        console.log('totalNormalEggsWeightKg$ calculated:', total); // Debug log
        return total;
      })
    );
    this.totalWhiteEggsCount$ = eggProductionEntriesChanges$.pipe(
      map(entries => {
        const total = entries.reduce((sum: number, entry: any) => sum + this.parseNumber(entry.white_count), 0);
        console.log('totalWhiteEggsCount$ calculated:', total); // Debug log
        return total;
      })
    );
    this.totalWhiteEggsWeightKg$ = eggProductionEntriesChanges$.pipe(
      map(entries => {
        const total = entries.reduce((sum: number, entry: any) => sum + this.parseNumber(entry.white_weight), 0);
        console.log('totalWhiteEggsWeightKg$ calculated:', total); // Debug log
        return total;
      })
    );
    this.totalCrackedEggsCount$ = eggProductionEntriesChanges$.pipe(
      map(entries => {
        const total = entries.reduce((sum: number, entry: any) => sum + this.parseNumber(entry.cracked_count), 0);
        console.log('totalCrackedEggsCount$ calculated:', total); // Debug log
        return total;
      })
    );
    this.totalCrackedEggsWeightKg$ = eggProductionEntriesChanges$.pipe(
      map(entries => {
        const total = entries.reduce((sum: number, entry: any) => sum + this.parseNumber(entry.cracked_weight), 0);
        console.log('totalCrackedEggsWeightKg$ calculated:', total); // Debug log
        return total;
      })
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
        // Recalculate visibility based on new productionType and current age
        this.updateEggFieldsVisibility(this.currentFlockAgeInDays !== null && this.currentFlockAgeInDays > 126);
      } else {
        this.productionType = 'layer';
      }
    });

    if (this.daily_feed_consumption.length === 0) {
      this.addFeedToDailyForm(undefined, { emitEvent: false });
    }
    // Ensure at least one egg production row is present initially
    if (this.eggProductionEntries.length === 0) {
      this.addEggProductionRow(undefined, { emitEvent: false });
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

          // Populate egg production entries with aggregated data into a single row
          this.eggProductionEntries.clear({ emitEvent: false });
          this.addEggProductionRow({
            normal_count: data.normal_eggs,
            normal_weight: data.normal_eggs_weight_kg,
            white_count: data.white_eggs,
            white_weight: data.white_eggs_weight_kg,
            cracked_count: data.cracked_eggs,
            cracked_weight: data.cracked_eggs_weight_kg,
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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private parseNumber(value: string | number | null): number {
    console.log('parseNumber input:', value, 'type:', typeof value); // Debug log
    if (value === null || value === undefined || value === '') {
      console.log('parseNumber output: 0 (null/undefined/empty)');
      return 0;
    }
    if (typeof value === 'number') {
      console.log('parseNumber output:', value, '(number type)');
      return value;
    }
    const parsed = parseFloat(value.replace(',', '.'));
    console.log('parseNumber output:', parsed, '(parsed from string)');
    return isNaN(parsed) ? 0 : parsed;
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
    
    this.eggProductionEntries.controls.forEach((group, index) => {
      const eggControls = [
        'normal_count', 'normal_weight', 'white_count', 'white_weight', 'cracked_count', 'cracked_weight'
      ];
      eggControls.forEach((controlName: string) => {
        const control = group.get(controlName);
        if (control) {
          if (this.showEggProductionFields) {
            control.setValidators([Validators.min(0)]);
          } else {
            control.clearValidators();
            control.setValue(null, { emitEvent: false });
          }
          control.updateValueAndValidity({ emitEvent: false });
          console.log(`Control ${controlName} in row ${index} updated. Value: ${control.value}, Valid: ${control.valid}`);
        }
      });
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

    while (this.daily_feed_consumption.length !== 0) {
      this.daily_feed_consumption.removeAt(0, { emitEvent: false });
    }
    this.addFeedToDailyForm(undefined, { emitEvent: false });

    // Reset egg production entries
    while (this.eggProductionEntries.length !== 0) {
      this.eggProductionEntries.removeAt(0, { emitEvent: false });
    }
    this.addEggProductionRow(undefined, { emitEvent: false }); // Add one default row

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

  // Getter for egg production entries FormArray
  get eggProductionEntries(): FormArray {
    return this.dailyProductionForm.get('egg_production_entries') as FormArray;
  }

  // Method to create a FormGroup for an egg production row
  createEggProductionGroup(entry?: any): FormGroup {
    return this.fb.group({
      normal_count: [entry?.normal_count ?? null, [Validators.min(0)]],
      normal_weight: [entry?.normal_weight ?? null, [Validators.min(0)]],
      white_count: [entry?.white_count ?? null, [Validators.min(0)]],
      white_weight: [entry?.white_weight ?? null, [Validators.min(0)]],
      cracked_count: [entry?.cracked_count ?? null, [Validators.min(0)]],
      cracked_weight: [entry?.cracked_weight ?? null, [Validators.min(0)]],
    });
  }

  // Method to add an egg production row
  addEggProductionRow(entry?: any, options?: { emitEvent?: boolean }): void {
    const pushOptions = options || { emitEvent: true };
    this.eggProductionEntries.push(this.createEggProductionGroup(entry), pushOptions);
  }

  // Method to remove an egg production row
  removeEggProductionRow(index: number): void {
    this.eggProductionEntries.removeAt(index);
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

    // Validate egg production entries
    let hasInvalidEggEntry = false;
    if (this.showEggProductionFields) {
      this.eggProductionEntries.controls.forEach(group => {
        if (group.invalid) {
          hasInvalidEggEntry = true;
        }
      });
    }

    if (hasInvalidEggEntry) {
      this.notificationService.showWarning('Harap lengkapi semua detail produksi telur atau hapus baris yang tidak lengkap.');
      return;
    }

    if (this.dailyProductionForm.invalid) {
      this.notificationService.showWarning('Harap isi semua field yang wajib diisi.');
      return;
    }

    const rawEntry = this.dailyProductionForm.getRawValue();
    
    // Aggregate egg production data from FormArray
    let aggregatedNormalEggs = 0;
    let aggregatedNormalEggsWeightKg = 0;
    let aggregatedWhiteEggs = 0;
    let aggregatedWhiteEggsWeightKg = 0;
    let aggregatedCrackedEggs = 0;
    let aggregatedCrackedEggsWeightKg = 0;

    if (this.showEggProductionFields) {
      rawEntry.egg_production_entries.forEach((entry: any) => {
        aggregatedNormalEggs += this.parseNumber(entry.normal_count);
        aggregatedNormalEggsWeightKg += this.parseNumber(entry.normal_weight);
        aggregatedWhiteEggs += this.parseNumber(entry.white_count);
        aggregatedWhiteEggsWeightKg += this.parseNumber(entry.white_weight);
        aggregatedCrackedEggs += this.parseNumber(entry.cracked_count);
        aggregatedCrackedEggsWeightKg += this.parseNumber(entry.cracked_weight);
      });
    }

    const dataToSave: Partial<ProductionData> = {
      id: rawEntry.id,
      flock_id: Number(rawEntry.flock_id),
      date: rawEntry.date,
      mortality_count: rawEntry.mortality_count === null ? 0 : Number(rawEntry.mortality_count),
      culling_count: rawEntry.culling_count === null ? 0 : Number(rawEntry.culling_count),
      normal_eggs: aggregatedNormalEggs,
      white_eggs: aggregatedWhiteEggs,
      cracked_eggs: aggregatedCrackedEggs,
      normal_eggs_weight_kg: aggregatedNormalEggsWeightKg,
      white_eggs_weight_kg: aggregatedWhiteEggsWeightKg,
      cracked_eggs_weight_kg: aggregatedCrackedEggsWeightKg,
      notes: rawEntry.notes || null,
      feed_consumption: validFeedConsumption
    };

    // console.log('Data to save in ProductionComponent:', dataToSave); // Debugging log

    this.isSaving = true;

    if (dataToSave.id) {
      // Call update for existing entry
      this.productionService.updateProductionData(dataToSave).subscribe({
        next: () => {
          this.notificationService.showSuccess('Data produksi berhasil diperbarui.');
          this.isSaving = false;
          this.refresh$.next();
          this.resetDailyFormForNewEntry();
        },
        error: (err: any) => {
          this.isSaving = false;
          this.notificationService.showError(`Gagal memperbarui data produksi: ${err?.message ?? err}`);
        }
      });
    } else {
      // Call add for new entry, explicitly omitting 'id'
      const { id, ...dataForAdd } = dataToSave; // Destructure to omit 'id'
      this.productionService.addDailyLog(dataForAdd as Omit<ProductionData, 'id'>).subscribe({
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

    // Populate egg production entries with aggregated data into a single row
    this.eggProductionEntries.clear({ emitEvent: false });
    this.addEggProductionRow({
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
}