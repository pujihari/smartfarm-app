import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from './services/auth.service';
import { map, filter, switchMap, take } from 'rxjs/operators';
import { MemberRole } from './models/member.model';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const expectedRoles = route.data['roles'] as MemberRole[]; // Dapatkan peran yang diharapkan dari data rute

  return authService.isInitialized$.pipe(
    filter(isInitialized => isInitialized),
    switchMap(() => authService.memberRole$),
    take(1), // Ambil nilai peran saat ini dan selesaikan observable
    map(userRole => {
      if (userRole && expectedRoles.includes(userRole)) {
        return true; // Pengguna memiliki peran yang diizinkan
      } else {
        // Jika tidak diizinkan, arahkan ke dashboard atau halaman akses ditolak
        router.navigate(['/dashboard']); 
        return false;
      }
    })
  );
};