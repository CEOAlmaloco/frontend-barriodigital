import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  GuardResult,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { MsalGuard } from '@azure/msal-angular';
import { Observable, Subject, firstValueFrom, of } from 'rxjs';

import { Role, RoleAccess } from '../../shared/models/role';
import { accessGuard, authGuard, noAccessGuard, roleGuard } from './auth.guard';
import { AuthService } from './auth.service';

const granted = (role: Role): RoleAccess => ({ kind: 'granted', role });
const DENIED: readonly RoleAccess[] = [
  { kind: 'none' },
  { kind: 'multiple', roles: [Role.Admin, Role.Funcionario] },
  { kind: 'unavailable' },
];

const runAccessGuard = (
  guard: CanActivateFn,
  access$: Observable<RoleAccess>,
  route = {} as ActivatedRouteSnapshot,
) => {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { whenAccessResolved: () => access$ } },
    ],
  });

  return firstValueFrom(
    TestBed.runInInjectionContext(() =>
      guard(route, {} as RouterStateSnapshot),
    ) as Observable<GuardResult>,
  );
};

const urlOf = (result: GuardResult) => TestBed.inject(Router).serializeUrl(result as UrlTree);

describe('roleGuard', () => {
  const route = {
    data: { roles: [Role.Admin, Role.Auditor] },
  } as unknown as ActivatedRouteSnapshot;

  it.each([Role.Admin, Role.Auditor])('deja pasar a %s', async (role) => {
    expect(await runAccessGuard(roleGuard, of(granted(role)), route)).toBe(true);
  });

  it.each([Role.Vecino, Role.Funcionario])('%s vuelve al inicio', async (role) => {
    expect(urlOf(await runAccessGuard(roleGuard, of(granted(role)), route))).toBe('/inicio');
  });

  it.each(DENIED)('sin un rol válido ($kind) lleva a la pantalla sin acceso', async (access) => {
    expect(urlOf(await runAccessGuard(roleGuard, of(access), route))).toBe('/no-access');
  });

  it('espera a que se lea el token antes de decidir', async () => {
    const access$ = new Subject<RoleAccess>();
    const decision = runAccessGuard(roleGuard, access$, route);

    access$.next(granted(Role.Auditor));

    expect(await decision).toBe(true);
  });
});

describe('accessGuard', () => {
  it.each(Object.values(Role))('deja pasar a %s', async (role) => {
    expect(await runAccessGuard(accessGuard, of(granted(role)))).toBe(true);
  });

  it.each(DENIED)('$kind lleva a la pantalla sin acceso', async (access) => {
    expect(urlOf(await runAccessGuard(accessGuard, of(access)))).toBe('/no-access');
  });
});

describe('noAccessGuard', () => {
  it.each(DENIED)('$kind ve la pantalla sin acceso', async (access) => {
    expect(await runAccessGuard(noAccessGuard, of(access))).toBe(true);
  });

  it.each(Object.values(Role))('%s con su rol vuelve al inicio', async (role) => {
    expect(urlOf(await runAccessGuard(noAccessGuard, of(granted(role))))).toBe('/inicio');
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
