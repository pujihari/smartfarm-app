import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MemberService, MemberDetails } from '../../services/member.service';
import { NotificationService } from '../../services/notification.service';
import { Observable, BehaviorSubject } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { MemberModalComponent } from '../../components/member-modal/member-modal.component';
import { ConfirmationModalComponent } from '../../components/confirmation-modal/confirmation-modal.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [CommonModule, MemberModalComponent, ConfirmationModalComponent],
  templateUrl: './members.component.html',
  styleUrl: './members.component.css'
})
export class MembersComponent implements OnInit {
  private refresh$ = new BehaviorSubject<void>(undefined);
  members$: Observable<MemberDetails[]>;

  isModalOpen = false;
  isCancelModalOpen = false;
  isDeleteModalOpen = false;
  
  itemToCancel: MemberDetails | null = null;
  itemToDelete: MemberDetails | null = null;

  constructor(
    private memberService: MemberService,
    private notificationService: NotificationService,
    public authService: AuthService
  ) {
    this.members$ = this.refresh$.pipe(
      switchMap(() => this.memberService.getMembers())
    );
  }

  ngOnInit(): void {}

  openInviteModal(): void {
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  async inviteMember(data: { email: string }): Promise<void> {
    const { error } = await this.memberService.inviteMember(data.email);
    
    if (error) {
      this.notificationService.showError(error, 'Gagal Mengirim Undangan');
    } else {
      this.notificationService.showSuccess('Undangan berhasil dikirim!');
      this.closeModal();
      this.refresh$.next();
    }
  }

  openCancelModal(member: MemberDetails): void {
    if (member.status === 'invited') {
      this.itemToCancel = member;
      this.isCancelModalOpen = true;
    }
  }

  closeCancelModal(): void {
    this.isCancelModalOpen = false;
    this.itemToCancel = null;
  }

  confirmCancel(): void {
    if (this.itemToCancel) {
      this.memberService.cancelInvitation(this.itemToCancel.id).subscribe({
        next: () => {
          this.notificationService.showSuccess('Undangan berhasil dibatalkan.');
          this.closeCancelModal();
          this.refresh$.next();
        },
        error: (err: any) => {
          this.notificationService.showError(err.message, 'Gagal Membatalkan Undangan');
          this.closeCancelModal();
        }
      });
    }
  }

  openDeleteModal(member: MemberDetails): void {
    this.itemToDelete = member;
    this.isDeleteModalOpen = true;
  }

  closeDeleteModal(): void {
    this.isDeleteModalOpen = false;
    this.itemToDelete = null;
  }

  confirmDelete(): void {
    if (this.itemToDelete) {
      this.memberService.removeMember(this.itemToDelete.user_id).subscribe({
        next: () => {
          this.notificationService.showSuccess('Anggota berhasil dihapus.');
          this.closeDeleteModal();
          this.refresh$.next();
        },
        error: (err: any) => {
          this.notificationService.showError(err.message, 'Gagal Menghapus Anggota');
          this.closeDeleteModal();
        }
      });
    }
  }
}