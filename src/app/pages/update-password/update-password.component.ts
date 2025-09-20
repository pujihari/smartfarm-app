import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-update-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './update-password.component.html',
  styleUrl: './update-password.component.css'
})
export class UpdatePasswordComponent implements OnInit {
  updateForm: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;
  userEmail: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService
  ) {
    this.updateForm = this.fb.group({
      displayName: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validator: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.userEmail = user?.email || 'Pengguna';
    });
  }

  passwordMatchValidator(form: FormGroup) {
    return form.get('password')?.value === form.get('confirmPassword')?.value
      ? null : { 'mismatch': true };
  }

  async handleUpdate(): Promise<void> {
    if (this.updateForm.invalid) {
      if (this.updateForm.errors?.['mismatch']) {
        this.errorMessage = 'Konfirmasi kata sandi tidak cocok.';
      }
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    const { displayName, password } = this.updateForm.value;

    try {
      const { error } = await this.authService.updateUser({
        password: password,
        data: { display_name: displayName }
      });

      if (error) {
        throw error;
      }

      this.notificationService.showSuccess('Akun Anda berhasil diperbarui! Anda akan diarahkan ke dashboard.');
      // Navigasi akan ditangani oleh auth state change di AuthService
    } catch (err: any) {
      const errorMessage = err.message || 'Terjadi kesalahan saat memperbarui akun Anda.';
      this.errorMessage = errorMessage;
      this.notificationService.showError(errorMessage);
    } finally {
      this.isLoading = false;
    }
  }
}