import { Location } from '@angular/common';
import {
  HTTP_INTERCEPTORS,
  HttpClient,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  MSAL_INSTANCE,
  MSAL_INTERCEPTOR_CONFIG,
  MsalBroadcastService,
  MsalInterceptor,
  MsalService,
} from '@azure/msal-angular';
import { BrowserCacheLocation, InteractionStatus, InteractionType } from '@azure/msal-browser';
import { of } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  MSALInterceptorConfigFactory,
  apiScope,
  loginRequest,
  provideMsal,
  removeLogoutStateFromUrl,
} from './msal-config';

describe('provideMsal', () => {
  it('guarda la sesión en localStorage para compartirla entre pestañas y ventanas', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideMsal()] });

    const { cache } = TestBed.inject(MSAL_INSTANCE).getConfiguration();

    expect(cache.cacheLocation).toBe(BrowserCacheLocation.LocalStorage);
  });
});

describe('MSALInterceptorConfigFactory', () => {
  const bffEndpoint = `${environment.bffBaseUrl}/api/requests`;

  it('protege el BFF con el scope custom de la API y el mismo que pide el login', () => {
    const config = MSALInterceptorConfigFactory();

    expect(apiScope).toBe(`api://${environment.entraId.clientId}/access_as_user`);
    expect(config.interactionType).toBe(InteractionType.Redirect);
    expect(config.protectedResourceMap.get(`${environment.bffBaseUrl}/*`)).toEqual([apiScope]);
    expect(loginRequest.scopes).toContain(apiScope);
  });

  it('adjunta el accessToken, no el idToken, solo en las llamadas al BFF', () => {
    const logger = { verbose: vi.fn(), info: vi.fn(), infoPii: vi.fn(), warning: vi.fn(), error: vi.fn() };
    const msal = {
      getLogger: () => logger,
      instance: { getActiveAccount: () => ({ username: 'vecino.test' }), getAllAccounts: () => [] },
      acquireTokenSilent: vi.fn(() => of({ accessToken: 'access-token', idToken: 'id-token' })),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: MsalService, useValue: msal },
        { provide: MsalBroadcastService, useValue: { inProgress$: of(InteractionStatus.None) } },
        { provide: MSAL_INTERCEPTOR_CONFIG, useFactory: MSALInterceptorConfigFactory },
        { provide: HTTP_INTERCEPTORS, useClass: MsalInterceptor, multi: true },
      ],
    });
    const http = TestBed.inject(HttpClient);
    const backend = TestBed.inject(HttpTestingController);

    http.get(bffEndpoint).subscribe();
    http.get('https://graph.microsoft.com/v1.0/me').subscribe();

    const bffRequest = backend.expectOne(bffEndpoint).request;
    const externalRequest = backend.expectOne('https://graph.microsoft.com/v1.0/me').request;

    expect(bffRequest.headers.get('Authorization')).toBe('Bearer access-token');
    expect(externalRequest.headers.has('Authorization')).toBe(false);
    expect(msal.acquireTokenSilent).toHaveBeenCalledWith(expect.objectContaining({ scopes: [apiScope] }));
    backend.verify();
  });
});

describe('removeLogoutStateFromUrl', () => {
  const location = {
    path: vi.fn<(includeHash?: boolean) => string>(),
    replaceState: vi.fn(),
    go: vi.fn(),
  };

  const runAt = (url: string) => {
    location.path.mockReturnValue(url);
    TestBed.runInInjectionContext(removeLogoutStateFromUrl);
  };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Location, useValue: location }],
    });
  });

  it('quita el state que Entra ID agrega al volver del logout sin crear historial', () => {
    runAt('/?state=eyJpZCI6ImxvZ291dCJ9');

    expect(location.replaceState).toHaveBeenCalledWith('/');
    expect(location.go).not.toHaveBeenCalled();
  });

  it('conserva la ruta, los demás parámetros y el fragmento', () => {
    runAt('/inicio?origen=correo&state=abc#seccion');

    expect(location.replaceState).toHaveBeenCalledWith('/inicio?origen=correo#seccion');
  });

  it('no toca la URL cuando no hay state', () => {
    runAt('/inicio?origen=correo');

    expect(location.replaceState).not.toHaveBeenCalled();
  });
});
