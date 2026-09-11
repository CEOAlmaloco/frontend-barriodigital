import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { AuthService } from './auth.service';

/** Si ya hay sesión activa, salta el login y lleva directo al inicio. */
export const redirectAuthenticatedGuard: CanActivateFn = () => {
  const router = inject(Router);

  return inject(AuthService)
    .hasSession()
    .pipe(map((hasSession) => (hasSession ? router.createUrlTree(['/inicio']) : true)));
};
