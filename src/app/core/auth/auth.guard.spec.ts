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
import { Observable, Subject, firstValueFrom, of } from 'rxjs';

import { Role } from '../../shared/models/role';
import { authGuard, roleGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('roleGuard', () => {
  const route = { data: { roles: [Role.Vecino, Role.Funcionario] } } as unknown as ActivatedRouteSnapshot;

  const runGuard = (roles$: Observable<string[]>) => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { whenRolesLoaded: () => roles$ } }],
    });

    return firstValueFrom(
      TestBed.runInInjectionContext(() => roleGuard(route, {} as RouterStateSnapshot)) as Observable<GuardResult>,
    );
  };

  it.each([Role.Vecino, Role.Funcionario])('deja pasar a %s', async (role) => {
    expect(await runGuard(of([role]))).toBe(true);
  });

  it.each([Role.Admin, Role.Auditor])('%s vuelve al inicio', async (role) => {
    const result = await runGuard(of([role]));

    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/inicio');
  });

  it('espera a que lleguen los roles del token antes de decidir', async () => {
    const roles$ = new Subject<string[]>();
    const decision = runGuard(roles$);

    roles$.next([Role.Vecino]);

    expect(await decision).toBe(true);
  });
});

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
