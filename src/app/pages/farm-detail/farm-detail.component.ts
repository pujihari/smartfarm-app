import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FarmService } from '../../services/farm.service';
import { FlockService } from '../../services/flock.service';
import { NotificationService } from '../../services/notification.service';
import { Farm } from '../../models/farm.model';
import { Flock } from '../../models/flock.model';
import { Observable, BehaviorSubject } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { FlockListComponent } from '../../components/flock-list/flock-list.component';
import { FlockModalComponent } from '../../components/flock-modal/flock-modal.component';
import { ConfirmationModalComponent } from '../../components/confirmation-modal/confirmation-modal.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-farm-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FlockListComponent, FlockModalComponent, ConfirmationModalComponent],
  templateUrl: './farm-detail.component.html',
  styleUrl: './farm-detail.component.css'
})
export class FarmDetailComponent implements OnInit {
  farm$: Observable<Farm | undefined> | undefined;
  flocks$: Observable<Flock[]> | undefined;
  farms$: Observable<Farm[]>;
  
  private refreshFlocks$ = new BehaviorSubject<void>(undefined);

  isFlockModalOpen = false;
  flockToEdit: Flock | null = null;
  currentFarmId: number | null = null;

  isConfirmModalOpen = false;
  flockToDelete: Flock | null = null;

  constructor(
    private route: ActivatedRoute,
    private farmService: FarmService,
    private flockService: FlockService,
    private notificationService: NotificationService,
    public authService: AuthService
  ) {
    this.farms$ = this.farmService.getFarms();
  }

  ngOnInit(): void {
    const farmId = Number(this.route.snapshot.paramMap.get('id'));
    this.currentFarmId = farmId;
    if (farmId) {
      this.farm$ = this.farmService.getFarmById(farmId);
      this.flocks$ = this.refreshFlocks$.pipe(
        switchMap(() => this.flockService.getFlocksByFarmId(farmId))
      );
    }
  }

  openAddFlockModal(): void {
    this.flockToEdit = null;
    this.isFlockModalOpen = true;
  }

  openEditFlockModal(flock: Flock): void {
    this.flockToEdit = flock;
    this.isFlockModalOpen = true;
  }

  closeFlockModal(): void {
    this.isFlockModalOpen = false;
    this.flockToEdit = null;
  }

  saveFlock(flockData: Partial<Flock>): void {
    const saveObservable = flockData.id
      ? this.flockService.updateFlock(flockData)
      : this.flockService.addFlock(flockData as Omit<Flock, 'id' | 'organization_id'>);

    saveObservable.subscribe({
      next: () => {
        this.notificationService.showSuccess('Data flok berhasil disimpan.');
        this.closeFlockModal();
        this.refreshFlocks$.next();
      },
      error: (err) => {
        this.notificationService.showError(`Gagal menyimpan flok: ${err.message}`);
      }
    });
  }

  openDeleteFlockModal(flock: Flock): void {
    this.flockToDelete = flock;
    this.isConfirmModalOpen = true;
  }

  closeDeleteFlockModal(): void {
    this.isConfirmModalOpen = false;
    this.flockToDelete = null;
  }

  confirmDeleteFlock(): void {
    if (this.flockToDelete) {
      this.flockService.deleteFlock(this.flockToDelete.id).subscribe({
        next: () => {
          this.notificationService.showSuccess('Flok berhasil dihapus.');
          this.closeDeleteFlockModal();
          this.refreshFlocks$.next();
        },
        error: (err) => {
          this.notificationService.showError(`Gagal menghapus flok: ${err.message}`);
          this.closeDeleteFlockModal();
        }
      });
    }
  }
}