import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FarmService } from '../../services/farm.service';
import { FlockService } from '../../services/flock.service';
import { NotificationService } from '../../services/notification.service';
import { Observable, BehaviorSubject } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Farm } from '../../models/farm.model';
import { Flock } from '../../models/flock.model';
import { FlockModalComponent } from '../../components/flock-modal/flock-modal.component';
import { ConfirmationModalComponent } from '../../components/confirmation-modal/confirmation-modal.component';
import { AuthService } from '../../services/auth.service';

type FlockWithFarmInfo = Flock & { farmName: string };

@Component({
  selector: 'app-flocks',
  standalone: true,
  imports: [CommonModule, RouterModule, FlockModalComponent, ConfirmationModalComponent],
  templateUrl: './flocks.component.html',
  styleUrl: './flocks.component.css'
})
export class FlocksComponent implements OnInit {
  isModalOpen = false;
  flockToEdit: Flock | null = null;
  
  private refresh$ = new BehaviorSubject<void>(undefined);
  flocks$: Observable<FlockWithFarmInfo[]>;
  farms$: Observable<Farm[]>;

  isConfirmModalOpen = false;
  flockToDelete: Flock | null = null;

  constructor(
    private farmService: FarmService,
    private flockService: FlockService,
    private notificationService: NotificationService,
    public authService: AuthService
  ) {
    this.flocks$ = this.refresh$.pipe(
      switchMap(() => this.flockService.getFlocksWithFarmInfo())
    );
    this.farms$ = this.farmService.getFarms();
  }

  ngOnInit(): void {}

  openAddModal(): void {
    this.flockToEdit = null;
    this.isModalOpen = true;
  }

  openEditModal(flock: Flock): void {
    this.flockToEdit = flock;
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.flockToEdit = null;
  }

  saveFlock(flockData: Partial<Flock>): void {
    const saveObservable = flockData.id
      ? this.flockService.updateFlock(flockData)
      : this.flockService.addFlock(flockData as Omit<Flock, 'id' | 'organization_id'>);
    
    saveObservable.subscribe({
      next: () => {
        this.notificationService.showSuccess('Data flok berhasil disimpan.');
        this.closeModal();
        this.refresh$.next();
      },
      error: (err) => {
        this.notificationService.showError(`Gagal menyimpan flok: ${err.message}`);
      }
    });
  }

  openDeleteModal(flock: Flock): void {
    this.flockToDelete = flock;
    this.isConfirmModalOpen = true;
  }

  closeDeleteModal(): void {
    this.isConfirmModalOpen = false;
    this.flockToDelete = null;
  }

  confirmDelete(): void {
    if (this.flockToDelete) {
      this.flockService.deleteFlock(this.flockToDelete.id).subscribe({
        next: () => {
          this.notificationService.showSuccess('Flok berhasil dihapus.');
          this.closeDeleteModal();
          this.refresh$.next();
        },
        error: (err) => {
          this.notificationService.showError(`Gagal menghapus flok: ${err.message}`);
          this.closeDeleteModal();
        }
      });
    }
  }
}