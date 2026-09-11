import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  GuardResult,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { MsalGuard } from '@azure/msal-angular';
import { Observable, firstValueFrom, of } from 'rxjs';

import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/inicio' } as RouterStateSnapshot;
  const msalGuard = { canActivate: vi.fn(() => of(true)) };
  const auth = { hasSession: vi.fn<() => Observable<boolean>>() };

  const runGuard = () =>
    firstValueFrom(
      TestBed.runInInjectionContext(() => authGuard(route, state)) as Observable<GuardResult>,
    );

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: MsalGuard, useValue: msalGuard },
        { provide: AuthService, useValue: auth },
      ],
    });
  });

  it('sin sesión lleva al login sin pasar por MsalGuard', async () => {
    auth.hasSession.mockReturnValue(of(false));

    const result = await runGuard();

    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
    expect(msalGuard.canActivate).not.toHaveBeenCalled();
  });

  it('con sesión delega la decisión en MsalGuard', async () => {
    auth.hasSession.mockReturnValue(of(true));

    expect(await runGuard()).toBe(true);
    expect(msalGuard.canActivate).toHaveBeenCalledWith(route, state);
  });
});
