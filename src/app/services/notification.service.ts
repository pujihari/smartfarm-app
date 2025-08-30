import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  constructor(private toastr: ToastrService) { }

  showSuccess(message: string, title?: string) {
    this.toastr.success(message, title || 'Berhasil');
  }

  showError(message: string, title?: string) {
    this.toastr.error(message, title || 'Error');
  }

  showInfo(message: string, title?: string) {
    this.toastr.info(message, title || 'Info');
  }

  showWarning(message: string, title?: string) {
    this.toastr.warning(message, title || 'Peringatan');
  }
}