import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService } from '../../services/inventory.service';
import { NotificationService } from '../../services/notification.service';
import { InventoryItem, ItemType } from '../../models/inventory-item.model';
import { Observable, BehaviorSubject } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { InventoryModalComponent } from '../../components/inventory-modal/inventory-modal.component';
import { ConfirmationModalComponent } from '../../components/confirmation-modal/confirmation-modal.component';
import { AuthService } from '../../services/auth.service';

interface GroupedInventory {
  type: ItemType;
  items: InventoryItem[];
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, InventoryModalComponent, ConfirmationModalComponent],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.css'
})
export class InventoryComponent implements OnInit {
  private refresh$ = new BehaviorSubject<void>(undefined);
  inventoryGroups$: Observable<GroupedInventory[]>;

  isModalOpen = false;
  itemToEdit: InventoryItem | null = null;

  isConfirmModalOpen = false;
  itemToDelete: InventoryItem | null = null;

  constructor(
    private inventoryService: InventoryService,
    private notificationService: NotificationService,
    public authService: AuthService
  ) {
    this.inventoryGroups$ = this.refresh$.pipe(
      switchMap(() => this.inventoryService.getInventoryItems()),
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
      : this.inventoryService.addInventoryItem(itemData as Omit<InventoryItem, 'id'>);

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