import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  errorMessage: string | null = null;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    // This logic is now handled by the publicGuard
  }

  async handleLogin(): Promise<void> {
    if (this.loginForm.invalid) {
      return;
    }
    this.isLoading = true;
    this.errorMessage = null;
    try {
      const { email, password } = this.loginForm.value;
      const { error } = await this.authService.signIn({ email, password });
      if (error) {
        this.errorMessage = error.message;
      } else {
        // The onAuthStateChange handler in AuthService will navigate to dashboard
      }
    } catch (err: any) {
      this.errorMessage = err.message || 'An unexpected error occurred.';
    } finally {
      this.isLoading = false;
    }
  }
}