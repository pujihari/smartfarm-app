import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { map, filter, switchMap } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.isInitialized$.pipe(
    filter(isInitialized => isInitialized), // Tunggu hingga pengecekan auth awal selesai
    switchMap(() => authService.currentUser$), // Kemudian, dapatkan nilai pengguna terbaru
    map(user => {
      if (user) {
        return true; // Jika pengguna ada, izinkan akses
      } else {
        router.navigate(['/login']); // Jika tidak, arahkan ke halaman login
        return false;
      }
    })
  );
};