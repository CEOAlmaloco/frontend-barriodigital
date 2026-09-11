import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
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

/** Registra MSAL contra la app de Microsoft Entra ID. MsalGuard y MsalInterceptor llegan en EP1-06. */
export function provideMsal(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: MSAL_INSTANCE, useFactory: createMsalInstance },
    MsalService,
    MsalBroadcastService,
  ]);
}
