import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService } from '../../services/inventory.service';
import { NotificationService } from '../../services/notification.service';
import { InventoryItem, ItemType } from '../../models/inventory-item.model';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { switchMap, map, startWith } from 'rxjs/operators';
import { InventoryModalComponent } from '../../components/inventory-modal/inventory-modal.component';
import { ConfirmationModalComponent } from '../../components/confirmation-modal/confirmation-modal.component';
import { AuthService } from '../../services/auth.service';
import { FarmService } from '../../services/farm.service'; // Import FarmService
import { Farm } from '../../models/farm.model'; // Import Farm model
import { FormsModule } from '@angular/forms'; // Import FormsModule for ngModel

interface GroupedInventory {
  type: ItemType;
  items: InventoryItem[];
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, InventoryModalComponent, ConfirmationModalComponent], // Add FormsModule
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.css'
})
export class InventoryComponent implements OnInit {
  private refresh$ = new BehaviorSubject<void>(undefined);
  inventoryGroups$: Observable<GroupedInventory[]>;
  farms$: Observable<Farm[]>; // New: Observable for farms
  selectedFarmId: number | null = null; // New: For farm filter

  isModalOpen = false;
  itemToEdit: InventoryItem | null = null;

  isConfirmModalOpen = false;
  itemToDelete: InventoryItem | null = null;

  constructor(
    private inventoryService: InventoryService,
    private notificationService: NotificationService,
    public authService: AuthService,
    private farmService: FarmService // Inject FarmService
  ) {
    this.farms$ = this.farmService.getFarms(); // Fetch all farms

    // Combine refresh$ and selectedFarmId to trigger data reload
    this.inventoryGroups$ = combineLatest([
      this.refresh$,
      this.authService.organizationId$.pipe(startWith(null)) // Ensure organizationId is available
    ]).pipe(
      switchMap(([_, organizationId]) => {
        if (!organizationId) return []; // Don't fetch if no organization
        return this.inventoryService.getInventoryItems(this.selectedFarmId);
      }),
      map(items => this.groupItems(items))
    );
  }

  ngOnInit(): void {}

  private groupItems(items: InventoryItem[]): GroupedInventory[] {
    const groups = new Map<ItemType, InventoryItem[]>();
    const itemTypes: ItemType[] = ['PAKAN', 'VITAMIN', 'OBAT', 'VAKSIN'];

    itemTypes.forEach(type => groups.set(type, []));
    items.forEach(item => {
      groups.get(item.item_type)?.push(item);
    });

    return Array.from(groups.entries()).map(([type, items]) => ({ type, items }));
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