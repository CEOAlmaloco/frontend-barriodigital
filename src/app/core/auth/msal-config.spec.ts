import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MSAL_INSTANCE } from '@azure/msal-angular';
import { BrowserCacheLocation } from '@azure/msal-browser';

import { provideMsal, removeLogoutStateFromUrl } from './msal-config';

describe('provideMsal', () => {
  it('guarda la sesión en localStorage para compartirla entre pestañas y ventanas', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideMsal()] });

    const { cache } = TestBed.inject(MSAL_INSTANCE).getConfiguration();

    expect(cache.cacheLocation).toBe(BrowserCacheLocation.LocalStorage);
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
