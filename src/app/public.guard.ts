import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { map, filter, switchMap } from 'rxjs/operators';

export const publicGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.isInitialized$.pipe(
    filter(isInitialized => isInitialized),
    switchMap(() => authService.currentUser$),
    map(user => {
      if (user) {
        router.navigate(['/dashboard']);
        return false;
      } else {
        return true;
      }
    })
  );
};