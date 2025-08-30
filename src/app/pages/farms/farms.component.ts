import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FarmModalComponent } from '../../components/farm-modal/farm-modal.component';
import { ConfirmationModalComponent } from '../../components/confirmation-modal/confirmation-modal.component';
import { FarmService } from '../../services/farm.service';
import { NotificationService } from '../../services/notification.service';
import { Observable, BehaviorSubject } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Farm } from '../../models/farm.model';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-farms',
  standalone: true,
  imports: [CommonModule, RouterModule, FarmModalComponent, ConfirmationModalComponent],
  templateUrl: './farms.component.html',
  styleUrl: './farms.component.css'
})
export class FarmsComponent implements OnInit {
  isModalOpen = false;
  farmToEdit: Farm | null = null;
  
  private refresh$ = new BehaviorSubject<void>(undefined);
  farms$: Observable<Farm[]>;

  isConfirmModalOpen = false;
  farmToDelete: Farm | null = null;

  constructor(
    private farmService: FarmService,
    private notificationService: NotificationService,
    public authService: AuthService
  ) {
    this.farms$ = this.refresh$.pipe(
      switchMap(() => this.farmService.getFarms())
    );
  }

  ngOnInit(): void {}

  openAddModal(): void {
    this.farmToEdit = null;
    this.isModalOpen = true;
  }

  openEditModal(farm: Farm): void {
    this.farmToEdit = farm;
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.farmToEdit = null;
  }

  saveFarm(farmData: Partial<Farm>): void {
    const saveObservable = farmData.id
      ? this.farmService.updateFarm(farmData)
      : this.farmService.addFarm(farmData as { name: string, location: string });

    saveObservable.subscribe({
      next: () => {
        this.notificationService.showSuccess('Data farm berhasil disimpan.');
        this.closeModal();
        this.refresh$.next();
      },
      error: (err) => {
        this.notificationService.showError(`Gagal menyimpan farm: ${err.message}`);
      }
    });
  }

  openDeleteModal(farm: Farm): void {
    this.farmToDelete = farm;
    this.isConfirmModalOpen = true;
  }

  closeDeleteModal(): void {
    this.isConfirmModalOpen = false;
    this.farmToDelete = null;
  }

  confirmDelete(): void {
    if (this.farmToDelete) {
      this.farmService.deleteFarm(this.farmToDelete.id).subscribe({
        next: () => {
          this.notificationService.showSuccess('Farm berhasil dihapus.');
          this.closeDeleteModal();
          this.refresh$.next();
        },
        error: (err) => {
          this.notificationService.showError(`Gagal menghapus farm: ${err.message}`);
          this.closeDeleteModal();
        }
      });
    }
  }
}