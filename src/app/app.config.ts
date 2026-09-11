import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { MSAL_INTERCEPTOR_CONFIG, MsalInterceptor } from '@azure/msal-angular';

import { routes } from './app.routes';
import { MSALInterceptorConfigFactory, provideMsal } from './core/auth/msal-config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    provideMsal(),
    { provide: MSAL_INTERCEPTOR_CONFIG, useFactory: MSALInterceptorConfigFactory },
    { provide: HTTP_INTERCEPTORS, useClass: MsalInterceptor, multi: true },
  ]
};
