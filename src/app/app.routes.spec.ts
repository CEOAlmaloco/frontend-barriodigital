import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MsalGuard } from '@azure/msal-angular';
import { NEVER, of } from 'rxjs';

import { routes } from './app.routes';
import { accessGuard, authGuard, noAccessGuard, roleGuard } from './core/auth/auth.guard';
import { AuthService } from './core/auth/auth.service';
import { CatalogService } from './core/catalog/catalog.service';
import { AuthenticatedLayoutComponent } from './core/layout/authenticated-layout.component';
import { RequestsService } from './features/requests/requests.service';
import { Role, resolveAccess } from './shared/models/role';

/** AuthService con el modelo de acceso real sobre los roles del token; null es un token ilegible. */
const createAuth = () => {
  const tokenRoles = signal<string[] | null>([]);
  const access = computed(() => resolveAccess(tokenRoles()));
  const role = computed(() => {
    const current = access();
    return current.kind === 'granted' ? current.role : null;
  });
  return {
    tokenRoles,
    stub: {
      account: signal({
        name: 'Usuario de prueba',
        username: 'usuario@cloudproyecto.onmicrosoft.com',
      }),
      userId: signal('oid'),
      isAuthenticated: signal(true),
      isInteractionInProgress: signal(false),
      loginFailed: signal(false),
      hasSession: vi.fn(() => of(true)),
      access,
      role,
      hasRole: (value: Role) => role() === value,
      whenAccessResolved: () => of(access()),
      retryAccess: () => of(access()),
      logout: vi.fn(),
    },
  };
};

const ALL_ROLES: readonly Role[] = Object.values(Role);
const OVERSIGHT: readonly Role[] = [Role.Admin, Role.Auditor];
const ADMIN_ONLY: readonly Role[] = [Role.Admin];

const setup = () => {
  const auth = createAuth();
  const msalGuard = { canActivate: vi.fn(() => of(true)) };

  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      { provide: AuthService, useValue: auth.stub },
      { provide: MsalGuard, useValue: msalGuard },
      {
        provide: CatalogService,
        useValue: { getProcedures: () => of([]), labels: () => new Map(), loadLabels: () => {} },
      },
      {
        provide: RequestsService,
        useValue: {
          getRequests: () => NEVER,
          getRequest: () => NEVER,
          getActividad: () => NEVER,
          getTransitions: () => NEVER,
        },
      },
    ],
  });

  return { auth, msalGuard };
};

const layoutRoute = () => routes.find((route) => route.component === AuthenticatedLayoutComponent);
const childRoute = (path: string) => layoutRoute()?.children?.find((child) => child.path === path);

describe('Layout autenticado', () => {
  it('exige sesión y un rol válido antes de cualquier ruta hija', () => {
    expect(layoutRoute()?.canActivate).toEqual([authGuard]);
    expect(layoutRoute()?.canActivateChild).toEqual([accessGuard]);
  });
});

describe.each([
  { path: 'tramites', selector: 'app-requests', allowed: ALL_ROLES },
  { path: 'tramites/req-1', route: 'tramites/:id', selector: 'app-request-detail', allowed: ALL_ROLES },
  { path: 'admin', selector: 'app-admin', heading: 'Panel de administración', allowed: ADMIN_ONLY },
  { path: 'audit', selector: 'app-audit', heading: 'Auditoría', allowed: OVERSIGHT },
])('Ruta /$path', ({ path, route, selector, heading, allowed }) => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('configura el guard de roles con los roles de EP3-04 y carga diferida', () => {
    const config = childRoute(route ?? path);

    expect(config?.canActivate).toEqual([roleGuard]);
    expect([...(config?.data?.['roles'] ?? [])].sort()).toEqual([...allowed].sort());
    expect(config?.loadComponent).toBeTypeOf('function');
  });

  it.each(allowed)('%s accede con el header compartido', async (role) => {
    ctx.auth.tokenRoles.set([role]);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl(`/${path}`);

    expect(TestBed.inject(Router).url).toBe(`/${path}`);
    expect(ctx.msalGuard.canActivate).toHaveBeenCalled();
    expect(harness.routeNativeElement?.querySelectorAll('app-header')).toHaveLength(1);
    expect(harness.routeNativeElement?.querySelector(selector)).not.toBeNull();
    if (heading) {
      expect(harness.routeNativeElement?.querySelector(`${selector} h1`)?.textContent).toBe(heading);
    }
  });

  const denied = ALL_ROLES.filter((role) => !allowed.includes(role));
  if (denied.length > 0) {
    it.each(denied)('%s sin el rol requerido vuelve al inicio', async (role) => {
      ctx.auth.tokenRoles.set([role]);
      const harness = await RouterTestingHarness.create();

      await harness.navigateByUrl(`/${path}`);

      expect(TestBed.inject(Router).url).toBe('/inicio');
    });
  }

  it.each([
    { reason: 'sin rol', roles: [] },
    { reason: 'con más de un rol', roles: [Role.Admin, Role.Auditor] },
    { reason: 'con el token ilegible', roles: null },
  ])('$reason lleva a la pantalla sin acceso', async ({ roles }) => {
    ctx.auth.tokenRoles.set(roles);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl(`/${path}`);

    expect(TestBed.inject(Router).url).toBe('/no-access');
  });

  it('sin sesión vuelve al login', async () => {
    ctx.auth.stub.hasSession.mockReturnValue(of(false));
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl(`/${path}`);

    expect(TestBed.inject(Router).url).toBe('/');
    expect(ctx.msalGuard.canActivate).not.toHaveBeenCalled();
  });
});

describe('Rutas /reports y /reports/map', () => {
  let ctx: ReturnType<typeof setup>;
  const reportsChild = (path: string) =>
    childRoute('reports')?.children?.find((child) => child.path === path);

  beforeEach(() => {
    ctx = setup();
  });

  const open = async (role: Role, url: string) => {
    ctx.auth.tokenRoles.set([role]);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  };

  it('el Funcionario entra a reportería solo por el mapa (EP3-04, sección 2)', () => {
    const parent = childRoute('reports');
    const indicators = reportsChild('');

    expect(parent?.canActivate).toEqual([roleGuard]);
    expect([...(parent?.data?.['roles'] ?? [])].sort()).toEqual(
      [Role.Admin, Role.Auditor, Role.Funcionario].sort(),
    );
    expect(indicators?.canActivate).toEqual([roleGuard]);
    expect([...(indicators?.data?.['roles'] ?? [])].sort()).toEqual([...OVERSIGHT].sort());
    expect(indicators?.data?.['deniedRedirect']).toBe('/reports/map');
    expect(reportsChild('map')?.loadComponent).toBeTypeOf('function');
    expect(reportsChild('map')?.title).toBe('Mapa de trámites | BarrioDigital');
  });

  it.each(OVERSIGHT)('%s ve Indicadores con las dos pestañas', async (role) => {
    const element = await open(role, '/reports');

    expect(TestBed.inject(Router).url).toBe('/reports');
    expect(element.querySelector('app-reports-layout h1')?.textContent).toBe('Reportes');
    expect(element.querySelector('app-reports')).not.toBeNull();
    const tabs = Array.from(element.querySelectorAll('[mat-tab-link]'), (tab) =>
      tab.textContent?.replace(/\s+/g, ' ').replace(/^\s*\S+\s/, '').trim(),
    );
    expect(tabs).toEqual(['Indicadores', 'Mapa de trámites']);
  });

  it.each(OVERSIGHT)('%s abre el mapa desde su pestaña', async (role) => {
    const element = await open(role, '/reports/map');

    expect(TestBed.inject(Router).url).toBe('/reports/map');
    expect(element.querySelector('app-report-map')).not.toBeNull();
    const active = Array.from(element.querySelectorAll('[mat-tab-link]')).filter(
      (tab) => tab.getAttribute('aria-selected') === 'true',
    );
    expect(active.map((tab) => tab.textContent)).toEqual([expect.stringContaining('Mapa de trámites')]);
  });

  it('el Funcionario que entra a /reports va al mapa, sin pestañas ni indicadores', async () => {
    const element = await open(Role.Funcionario, '/reports');

    expect(TestBed.inject(Router).url).toBe('/reports/map');
    expect(element.querySelector('app-reports-layout h1')?.textContent).toBe('Mapa de trámites');
    expect(element.querySelector('app-report-map')).not.toBeNull();
    expect(element.querySelector('app-reports')).toBeNull();
    expect(element.querySelector('[mat-tab-nav-bar]')).toBeNull();
  });

  it.each(['/reports', '/reports/map'])('el Vecino que entra a %s vuelve al inicio', async (url) => {
    await open(Role.Vecino, url);

    expect(TestBed.inject(Router).url).toBe('/inicio');
  });

  it('sin rol lleva a la pantalla sin acceso', async () => {
    ctx.auth.tokenRoles.set([]);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/reports/map');

    expect(TestBed.inject(Router).url).toBe('/no-access');
  });
});

describe('Ruta /inicio', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it.each(ALL_ROLES)('%s entra al inicio', async (role) => {
    ctx.auth.tokenRoles.set([role]);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/inicio');

    expect(TestBed.inject(Router).url).toBe('/inicio');
  });

  it('con más de un rol tampoco hay inicio: va a la pantalla sin acceso', async () => {
    ctx.auth.tokenRoles.set([Role.Vecino, Role.Funcionario]);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/inicio');

    expect(TestBed.inject(Router).url).toBe('/no-access');
  });

  it('sin rol no llega al layout vacío: va a la pantalla sin acceso', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/inicio');

    expect(TestBed.inject(Router).url).toBe('/no-access');
    expect(harness.routeNativeElement?.querySelector('app-header')).toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('No puedes ingresar a BarrioDigital');
  });
});

describe('Ruta /no-access', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('queda fuera del layout, con sesión obligatoria y solo para quien no tiene un rol válido', () => {
    const config = routes.find((route) => route.path === 'no-access');

    expect(config?.canActivate).toEqual([authGuard, noAccessGuard]);
    expect(config?.title).toBe('Sin acceso | BarrioDigital');
    expect(layoutRoute()?.children?.some((child) => child.path === 'no-access')).toBe(false);
  });

  it('muestra el motivo sin el header de navegación', async () => {
    ctx.auth.tokenRoles.set([Role.Vecino, Role.Funcionario]);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/no-access');

    expect(TestBed.inject(Router).url).toBe('/no-access');
    expect(harness.routeNativeElement?.querySelector('app-header')).toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('Funcionario y Vecino');
  });

  it.each(ALL_ROLES)('%s con un rol válido vuelve al inicio', async (role) => {
    ctx.auth.tokenRoles.set([role]);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/no-access');

    expect(TestBed.inject(Router).url).toBe('/inicio');
  });

  it('sin sesión vuelve al login', async () => {
    ctx.auth.stub.hasSession.mockReturnValue(of(false));
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/no-access');

    expect(TestBed.inject(Router).url).toBe('/');
  });
});
