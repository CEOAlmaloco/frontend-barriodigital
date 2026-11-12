import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MsalGuard } from '@azure/msal-angular';
import { NEVER, of } from 'rxjs';

import { routes } from './app.routes';
import { authGuard, roleGuard } from './core/auth/auth.guard';
import { AuthService } from './core/auth/auth.service';
import { CatalogService } from './core/catalog/catalog.service';
import { AuthenticatedLayoutComponent } from './core/layout/authenticated-layout.component';
import { RequestsService } from './features/requests/requests.service';
import { Role } from './shared/models/role';

describe.each([
  {
    path: 'admin',
    selector: 'app-admin',
    heading: 'Panel de administración',
    allowedRole: Role.Admin,
  },
  { path: 'reports', selector: 'app-reports', heading: 'Reportes', allowedRole: Role.Admin },
  { path: 'audit', selector: 'app-audit', heading: 'Auditoría', allowedRole: Role.Auditor },
])('Ruta /$path', ({ path, selector, heading, allowedRole }) => {
  const roles = signal<Role[]>([]);
  const auth = {
    account: signal({
      name: 'Usuario de prueba',
      username: 'usuario@cloudproyecto.onmicrosoft.com',
    }),
    isAuthenticated: signal(false),
    isInteractionInProgress: signal(false),
    loginFailed: signal(false),
    hasSession: vi.fn(() => of(true)),
    whenRolesLoaded: () => of(roles()),
    hasRole: (role: Role) => roles().includes(role),
  };
  const msalGuard = { canActivate: vi.fn(() => of(true)) };

  beforeEach(() => {
    roles.set([]);
    auth.hasSession.mockReturnValue(of(true));
    msalGuard.canActivate.mockClear();

    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: AuthService, useValue: auth },
        { provide: MsalGuard, useValue: msalGuard },
        { provide: CatalogService, useValue: { getProcedures: () => of([]) } },
      ],
    });
  });

  it('configura la ruta con el layout autenticado, el guard de roles y carga diferida', () => {
    const layout = routes.find((route) => route.component === AuthenticatedLayoutComponent);
    const route = layout?.children?.find((child) => child.path === path);

    expect(layout?.canActivate).toContain(authGuard);
    expect(route?.canActivate).toEqual([roleGuard]);
    expect(route?.data?.['roles']).toEqual([allowedRole]);
    expect(route?.loadComponent).toBeTypeOf('function');
  });

  it.each([{ userRoles: [allowedRole] }, { userRoles: Object.values(Role) }])(
    'los roles $userRoles acceden a la pantalla con el header compartido',
    async ({ userRoles }) => {
      roles.set(userRoles);
      const harness = await RouterTestingHarness.create();

      await harness.navigateByUrl(`/${path}`, AuthenticatedLayoutComponent);

      expect(TestBed.inject(Router).url).toBe(`/${path}`);
      expect(msalGuard.canActivate).toHaveBeenCalled();
      expect(harness.routeNativeElement?.querySelectorAll('app-header')).toHaveLength(1);
      expect(harness.routeNativeElement?.querySelector(`${selector} h1`)?.textContent).toBe(
        heading,
      );
    },
  );

  it.each([...Object.values(Role).filter((role) => role !== allowedRole), undefined])(
    '%s sin el rol requerido vuelve al inicio',
    async (role) => {
      roles.set(role ? [role] : []);
      const harness = await RouterTestingHarness.create();

      await harness.navigateByUrl(`/${path}`);

      expect(TestBed.inject(Router).url).toBe('/inicio');
    },
  );

  it('sin sesión vuelve al login', async () => {
    auth.hasSession.mockReturnValue(of(false));
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl(`/${path}`);

    expect(TestBed.inject(Router).url).toBe('/');
    expect(msalGuard.canActivate).not.toHaveBeenCalled();
  });
});

describe('Ruta /tramites/:id', () => {
  const roles = signal<Role[]>([]);
  const auth = {
    account: signal({
      name: 'Usuario de prueba',
      username: 'usuario@cloudproyecto.onmicrosoft.com',
    }),
    userId: signal('oid'),
    isAuthenticated: signal(true),
    isInteractionInProgress: signal(false),
    loginFailed: signal(false),
    hasSession: () => of(true),
    whenRolesLoaded: () => of(roles()),
    hasRole: (role: Role) => roles().includes(role),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: AuthService, useValue: auth },
        { provide: MsalGuard, useValue: { canActivate: () => of(true) } },
        {
          provide: RequestsService,
          useValue: { getRequest: () => NEVER, getActividad: () => NEVER },
        },
      ],
    });
  });

  it('admite a los cuatro roles, sin ampliar el listado', () => {
    const layout = routes.find((route) => route.component === AuthenticatedLayoutComponent);
    const detail = layout?.children?.find((child) => child.path === 'tramites/:id');
    const list = layout?.children?.find((child) => child.path === 'tramites');

    expect(detail?.canActivate).toEqual([roleGuard]);
    expect([...(detail?.data?.['roles'] ?? [])].sort()).toEqual(Object.values(Role).sort());
    expect(list?.data?.['roles']).toEqual([Role.Vecino, Role.Funcionario]);
  });

  it.each(Object.values(Role))('%s entra por enlace directo al detalle', async (role) => {
    roles.set([role]);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/tramites/req-1');

    expect(TestBed.inject(Router).url).toBe('/tramites/req-1');
    expect(harness.routeNativeElement?.querySelector('app-request-detail')).not.toBeNull();
  });

  it('sin rol vuelve al inicio', async () => {
    roles.set([]);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/tramites/req-1');

    expect(TestBed.inject(Router).url).toBe('/inicio');
  });
});
