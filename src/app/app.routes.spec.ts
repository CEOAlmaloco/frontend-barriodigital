import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MsalGuard } from '@azure/msal-angular';
import { of } from 'rxjs';

import { routes } from './app.routes';
import { authGuard, roleGuard } from './core/auth/auth.guard';
import { AuthService } from './core/auth/auth.service';
import { CatalogService } from './core/catalog/catalog.service';
import { AuthenticatedLayoutComponent } from './core/layout/authenticated-layout.component';
import { Role } from './shared/models/role';

describe.each([
  { path: 'admin', selector: 'app-admin', heading: 'Panel de administración' },
  { path: 'reports', selector: 'app-reports', heading: 'Reportes' },
])('Ruta /$path', ({ path, selector, heading }) => {
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

  it('configura la ruta con el layout autenticado, el guard de Admin y carga diferida', () => {
    const layout = routes.find((route) => route.component === AuthenticatedLayoutComponent);
    const route = layout?.children?.find((child) => child.path === path);

    expect(layout?.canActivate).toContain(authGuard);
    expect(route?.canActivate).toEqual([roleGuard]);
    expect(route?.data?.['roles']).toEqual([Role.Admin]);
    expect(route?.loadComponent).toBeTypeOf('function');
  });

  it('Admin accede a la pantalla con el header compartido', async () => {
    roles.set([Role.Admin]);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl(`/${path}`, AuthenticatedLayoutComponent);

    expect(TestBed.inject(Router).url).toBe(`/${path}`);
    expect(msalGuard.canActivate).toHaveBeenCalled();
    expect(harness.routeNativeElement?.querySelectorAll('app-header')).toHaveLength(1);
    expect(harness.routeNativeElement?.querySelector(`${selector} h1`)?.textContent).toBe(heading);
  });

  it.each([Role.Vecino, Role.Funcionario, Role.Auditor, undefined])(
    '%s sin rol Admin vuelve al inicio',
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
