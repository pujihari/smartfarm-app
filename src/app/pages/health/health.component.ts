import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HealthService } from '../../services/health.service';
import { FlockService } from '../../services/flock.service';
import { NotificationService } from '../../services/notification.service';
import { Observable, BehaviorSubject } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { HealthEvent } from '../../models/health-event.model';
import { Flock } from '../../models/flock.model';
import { HealthEventModalComponent } from '../../components/health-event-modal/health-event-modal.component';
import { ConfirmationModalComponent } from '../../components/confirmation-modal/confirmation-modal.component';
import { AuthService } from '../../services/auth.service';

type HealthEventWithDetails = HealthEvent & { flockName: string, farmName: string };
type FlockWithFarmInfo = Flock & { farmName: string };

@Component({
  selector: 'app-health',
  standalone: true,
  imports: [CommonModule, HealthEventModalComponent, ConfirmationModalComponent],
  templateUrl: './health.component.html',
  styleUrl: './health.component.css'
})
export class HealthComponent implements OnInit {
  isModalOpen = false;
  eventToEdit: HealthEvent | null = null;
  
  private refresh$ = new BehaviorSubject<void>(undefined);
  healthEvents$: Observable<HealthEventWithDetails[]>;
  flocks$: Observable<FlockWithFarmInfo[]>;

  isConfirmModalOpen = false;
  eventToDelete: HealthEvent | null = null;

  constructor(
    private healthService: HealthService,
    private flockService: FlockService,
    private notificationService: NotificationService,
    public authService: AuthService
  ) {
    this.healthEvents$ = this.refresh$.pipe(
      switchMap(() => this.healthService.getHealthEventsWithDetails())
    );
    this.flocks$ = this.flockService.getFlocksWithFarmInfo();
  }

  ngOnInit(): void {}

  openAddModal(): void {
    this.eventToEdit = null;
    this.isModalOpen = true;
  }

  openEditModal(event: HealthEvent): void {
    this.eventToEdit = event;
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.eventToEdit = null;
  }

  saveEvent(eventData: Partial<HealthEvent>): void {
    const saveObservable = eventData.id
      ? this.healthService.updateHealthEvent(eventData)
      : this.healthService.addHealthEvent(eventData as Omit<HealthEvent, 'id' | 'organization_id'>);

    saveObservable.subscribe({
      next: () => {
        this.notificationService.showSuccess('Catatan kesehatan berhasil disimpan.');
        this.closeModal();
        this.refresh$.next();
      },
      error: (err) => {
        this.notificationService.showError(`Gagal menyimpan catatan kesehatan: ${err.message}`);
      }
    });
  }

  openDeleteModal(event: HealthEvent): void {
    this.eventToDelete = event;
    this.isConfirmModalOpen = true;
  }

  closeDeleteModal(): void {
    this.isConfirmModalOpen = false;
    this.eventToDelete = null;
  }

  confirmDelete(): void {
    if (this.eventToDelete) {
      this.healthService.deleteHealthEvent(this.eventToDelete.id).subscribe({
        next: () => {
          this.notificationService.showSuccess('Catatan kesehatan berhasil dihapus.');
          this.closeDeleteModal();
          this.refresh$.next();
        },
        error: (err) => {
          this.notificationService.showError(`Gagal menghapus catatan kesehatan: ${err.message}`);
          this.closeDeleteModal();
        }
      });
    }
  }
}