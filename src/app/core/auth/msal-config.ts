import { Location } from '@angular/common';
import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { MSAL_INSTANCE, MsalBroadcastService, MsalService } from '@azure/msal-angular';
import {
  IPublicClientApplication,
  PublicClientApplication,
  RedirectRequest,
} from '@azure/msal-browser';

import { environment } from '../../../environments/environment';

export const loginRequest: RedirectRequest = {
  scopes: ['openid', 'profile'],
};

function createMsalInstance(): IPublicClientApplication {
  const { clientId, authority, redirectUri, postLogoutRedirectUri } = environment.entraId;

  return new PublicClientApplication({
    auth: { clientId, authority, redirectUri, postLogoutRedirectUri },
  });
}

/**
 * Quita el ?state= que Entra ID agrega a postLogoutRedirectUri. Corre antes de crear MsalService,
 * que tomaría esa query como respuesta de login y fallaría con state_mismatch.
 */
export function removeLogoutStateFromUrl(): void {
  const location = inject(Location);
  const router = inject(Router);
  const url = router.parseUrl(location.path(true));

  if (!('state' in url.queryParams)) {
    return;
  }

  const queryParams = { ...url.queryParams };
  delete queryParams['state'];
  location.replaceState(router.serializeUrl(new UrlTree(url.root, queryParams, url.fragment)));
}

/** Registra MSAL contra la app de Microsoft Entra ID. MsalGuard y MsalInterceptor llegan en EP1-06. */
export function provideMsal(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(removeLogoutStateFromUrl),
    { provide: MSAL_INSTANCE, useFactory: createMsalInstance },
    MsalService,
    MsalBroadcastService,
  ]);
}
