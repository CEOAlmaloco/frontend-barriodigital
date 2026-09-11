import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MsalGuard } from '@azure/msal-angular';
import { map, of, switchMap } from 'rxjs';

import { Role } from '../../shared/models/role';
import { AuthService } from './auth.service';

/**
 * Protege rutas privadas delegando en MsalGuard. Sin sesión lleva al login ('/') en vez de dejar
 * que MsalGuard redirija directo a Microsoft, porque el login es el punto de entrada único.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const msalGuard = inject(MsalGuard);
  const router = inject(Router);

  return inject(AuthService)
    .hasSession()
    .pipe(
      switchMap((hasSession) =>
        hasSession ? msalGuard.canActivate(route, state) : of(router.createUrlTree(['/'])),
      ),
    );
};

/** Deja pasar solo a los roles de data.roles de la ruta; el resto vuelve al inicio. Va después de authGuard. */
export const roleGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const allowedRoles = (route.data['roles'] ?? []) as readonly Role[];

  return inject(AuthService)
    .whenRolesLoaded()
    .pipe(
      map((roles) => allowedRoles.some((role) => roles.includes(role)) || router.createUrlTree(['/inicio'])),
    );
};

/** Si ya hay sesión activa, salta el login y lleva directo al inicio. */
export const redirectAuthenticatedGuard: CanActivateFn = () => {
  const router = inject(Router);

  return inject(AuthService)
    .hasSession()
    .pipe(map((hasSession) => (hasSession ? router.createUrlTree(['/inicio']) : true)));
};
