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
        // Pengguna sudah login. Sekarang periksa apakah mereka adalah pengguna undangan yang perlu mengatur kata sandi.
        const isInvitedUser = user.identities?.length === 0;
        const isTryingToUpdatePassword = state.url === '/update-password';

        if (isInvitedUser && !isTryingToUpdatePassword) {
          // Jika mereka adalah pengguna undangan dan TIDAK berada di halaman update-password, arahkan mereka ke sana.
          router.navigate(['/update-password']);
          return false; // Blokir navigasi saat ini
        }

        if (!isInvitedUser && isTryingToUpdatePassword) {
          // Jika pengguna biasa mencoba mengakses halaman update-password, arahkan mereka pergi.
          router.navigate(['/dashboard']);
          return false;
        }

        return true; // Izinkan akses
      } else {
        // Pengguna tidak login, arahkan ke halaman login
        router.navigate(['/login']);
        return false;
      }
    })
  );
};