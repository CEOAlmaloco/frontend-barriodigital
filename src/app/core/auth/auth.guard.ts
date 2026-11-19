import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MsalGuard } from '@azure/msal-angular';
import { map, of, switchMap } from 'rxjs';

import { Role } from '../../shared/models/role';
import { AuthService } from './auth.service';

export const NO_ACCESS_PATH = '/no-access';

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

/** Sin rol, con más de uno o con el token sin leer, la sesión no entra al layout (EP3-04, sección 4). */
export const accessGuard: CanActivateFn = () => {
  const router = inject(Router);

  return inject(AuthService)
    .whenAccessResolved()
    .pipe(map((access) => access.kind === 'granted' || router.createUrlTree([NO_ACCESS_PATH])));
};

/** La pantalla "sin acceso" es solo para quien no tiene un rol válido; el resto vuelve al inicio. */
export const noAccessGuard: CanActivateFn = () => {
  const router = inject(Router);

  return inject(AuthService)
    .whenAccessResolved()
    .pipe(map((access) => access.kind !== 'granted' || router.createUrlTree(['/inicio'])));
};

/**
 * Deja pasar solo al rol de data.roles de la ruta; el resto va a data.deniedRedirect o, sin ella, al inicio.
 * Va después de accessGuard.
 */
export const roleGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const allowedRoles = (route.data['roles'] ?? []) as readonly Role[];
  const deniedRedirect = (route.data['deniedRedirect'] as string | undefined) ?? '/inicio';

  return inject(AuthService)
    .whenAccessResolved()
    .pipe(
      map((access) => {
        if (access.kind !== 'granted') {
          return router.createUrlTree([NO_ACCESS_PATH]);
        }
        return allowedRoles.includes(access.role) || router.parseUrl(deniedRedirect);
      }),
    );
};

/** Si ya hay sesión activa, salta el login y lleva directo al inicio. */
export const redirectAuthenticatedGuard: CanActivateFn = () => {
  const router = inject(Router);

  return inject(AuthService)
    .hasSession()
    .pipe(map((hasSession) => (hasSession ? router.createUrlTree(['/inicio']) : true)));
};
