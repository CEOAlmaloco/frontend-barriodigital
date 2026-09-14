import { Location } from '@angular/common';
import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import {
  MSAL_GUARD_CONFIG,
  MSAL_INSTANCE,
  MsalBroadcastService,
  MsalGuard,
  MsalGuardConfiguration,
  MsalInterceptorConfiguration,
  MsalService,
} from '@azure/msal-angular';
import {
  BrowserCacheLocation,
  IPublicClientApplication,
  InteractionType,
  PublicClientApplication,
  RedirectRequest,
} from '@azure/msal-browser';

import { environment } from '../../../environments/environment';

/** Scope custom de la API. Su accessToken lleva audience api://<clientId> y el claim roles. */
export const apiScope = `api://${environment.entraId.clientId}/${environment.entraId.apiScopeName}`;

export const loginRequest: RedirectRequest = {
  scopes: ['openid', 'profile', apiScope],
};

function createMsalInstance(): IPublicClientApplication {
  const { clientId, authority, redirectUri, postLogoutRedirectUri } = environment.entraId;

  return new PublicClientApplication({
    auth: { clientId, authority, redirectUri, postLogoutRedirectUri },
    // Compartida entre pestañas y ventanas. MSAL cifra los tokens con una cookie que expira al cerrar el navegador
    cache: { cacheLocation: BrowserCacheLocation.LocalStorage },
  });
}

function createMsalGuardConfig(): MsalGuardConfiguration {
  return {
    interactionType: InteractionType.Redirect,
    authRequest: loginRequest,
    loginFailedRoute: '/',
  };
}

/** Adjunta el accessToken del scope de la API a toda llamada al BFF. Las demás URLs salen sin token. */
export function MSALInterceptorConfigFactory(): MsalInterceptorConfiguration {
  return {
    interactionType: InteractionType.Redirect,
    protectedResourceMap: new Map([[`${environment.bffBaseUrl}/*`, [apiScope]]]),
    strictMatching: true,
  };
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

/** Registra MSAL contra la app de Microsoft Entra ID. El interceptor HTTP se registra en app.config.ts. */
export function provideMsal(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(removeLogoutStateFromUrl),
    { provide: MSAL_INSTANCE, useFactory: createMsalInstance },
    { provide: MSAL_GUARD_CONFIG, useFactory: createMsalGuardConfig },
    MsalService,
    MsalBroadcastService,
    MsalGuard,
  ]);
}
