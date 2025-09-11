import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService } from '../../services/inventory.service';
import { NotificationService } from '../../services/notification.service';
import { InventoryItem, ItemType } from '../../models/inventory-item.model';
import { Observable, BehaviorSubject, combineLatest, ReplaySubject } from 'rxjs';
import { switchMap, map, startWith, tap } from 'rxjs/operators';
import { InventoryModalComponent } from '../../components/inventory-modal/inventory-modal.component';
import { ConfirmationModalComponent } from '../../components/confirmation-modal/confirmation-modal.component';
import { AuthService } from '../../services/auth.service';
import { FarmService } from '../../services/farm.service';
import { Farm } from '../../models/farm.model';
import { FormsModule } from '@angular/forms';

interface GroupedInventory {
  type: ItemType;
  items: InventoryItem[];
}

interface GlobalSummaryItem {
  item_type: ItemType;
  item_code?: string;
  name: string;
  total_quantity: number;
  unit: string;
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, InventoryModalComponent, ConfirmationModalComponent],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.css'
})
export class InventoryComponent implements OnInit {
  private refresh$ = new BehaviorSubject<void>(undefined);
  private allInventoryItems$ = new ReplaySubject<InventoryItem[]>(1); // Cache fetched items

  inventoryGroups$: Observable<GroupedInventory[]>;
  globalSummaryData$: Observable<GlobalSummaryItem[]>; // New: Observable for global summary
  farms$: Observable<Farm[]>;
  selectedFarmId: number | null = null;

  isModalOpen = false;
  itemToEdit: InventoryItem | null = null;

  isConfirmModalOpen = false;
  itemToDelete: InventoryItem | null = null;

  constructor(
    private inventoryService: InventoryService,
    private notificationService: NotificationService,
    public authService: AuthService,
    private farmService: FarmService
  ) {
    this.farms$ = this.farmService.getFarms();

    // Fetch all items (or filtered by farm) and push to ReplaySubject
    combineLatest([
      this.refresh$,
      this.authService.organizationId$.pipe(startWith(null))
    ]).pipe(
      switchMap(([_, organizationId]) => {
        if (!organizationId) return [];
        return this.inventoryService.getInventoryItems(this.selectedFarmId);
      }),
      tap(items => this.allInventoryItems$.next(items)) // Cache the items
    ).subscribe();

    // Grouped items for display
    this.inventoryGroups$ = this.allInventoryItems$.pipe(
      map(items => this.groupItems(items))
    );

    // Global summary data (only when selectedFarmId is null)
    this.globalSummaryData$ = this.allInventoryItems$.pipe(
      map(items => {
        if (this.selectedFarmId !== null) {
          return []; // Only show summary for global view
        }
        return this.calculateGlobalSummary(items);
      })
    );
  }

  ngOnInit(): void {
    this.refresh$.next(); // Initial load
  }

  private groupItems(items: InventoryItem[]): GroupedInventory[] {
    const groups = new Map<ItemType, InventoryItem[]>();
    const itemTypes: ItemType[] = ['PAKAN', 'VITAMIN', 'OBAT', 'VAKSIN'];

    itemTypes.forEach(type => groups.set(type, []));
    items.forEach(item => {
      groups.get(item.item_type)?.push(item);
    });

    return Array.from(groups.entries()).map(([type, items]) => ({ type, items }));
  }

  private calculateGlobalSummary(items: InventoryItem[]): GlobalSummaryItem[] {
    const summaryMap = new Map<string, GlobalSummaryItem>();

    items.forEach(item => {
      // Use a unique key for each item based on type, code (if exists), and name
      const key = `${item.item_type}-${item.item_code || ''}-${item.name}-${item.unit}`;
      
      if (summaryMap.has(key)) {
        const existing = summaryMap.get(key)!;
        existing.total_quantity += item.quantity;
      } else {
        summaryMap.set(key, {
          item_type: item.item_type,
          item_code: item.item_code,
          name: item.name,
          total_quantity: item.quantity,
          unit: item.unit
        });
      }
    });

    // Sort by item type and then by name
    return Array.from(summaryMap.values()).sort((a, b) => {
      if (a.item_type < b.item_type) return -1;
      if (a.item_type > b.item_type) return 1;
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    });
  }

  onFarmFilterChange(): void {
    this.refresh$.next(); // Trigger data refresh when filter changes
  }

  openAddModal(): void {
    this.itemToEdit = null;
    this.isModalOpen = true;
  }

  openEditModal(item: InventoryItem): void {
    this.itemToEdit = item;
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.itemToEdit = null;
  }

  saveItem(itemData: Partial<InventoryItem>): void {
    const saveObservable = itemData.id
      ? this.inventoryService.updateInventoryItem(itemData)
      : this.inventoryService.addInventoryItem(itemData as Omit<InventoryItem, 'id' | 'farmName'>);

    saveObservable.subscribe({
      next: () => {
        this.notificationService.showSuccess('Item inventori berhasil disimpan.');
        this.closeModal();
        this.refresh$.next();
      },
      error: (err) => {
        this.notificationService.showError(`Gagal menyimpan item inventori: ${err.message}`);
      }
    });
  }

  openDeleteModal(item: InventoryItem): void {
    this.itemToDelete = item;
    this.isConfirmModalOpen = true;
  }

  closeDeleteModal(): void {
    this.isConfirmModalOpen = false;
    this.itemToDelete = null;
  }

  confirmDelete(): void {
    if (this.itemToDelete) {
      this.inventoryService.deleteInventoryItem(this.itemToDelete.id).subscribe({
        next: () => {
          this.notificationService.showSuccess('Item inventori berhasil dihapus.');
          this.closeDeleteModal();
          this.refresh$.next();
        },
        error: (err) => {
          this.notificationService.showError(`Gagal menghapus item inventori: ${err.message}`);
          this.closeDeleteModal();
        }
      });
    }
  }
}