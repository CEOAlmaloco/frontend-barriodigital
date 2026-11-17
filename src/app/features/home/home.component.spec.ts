import { LiveAnnouncer } from '@angular/cdk/a11y';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { AuditEvent } from '../../shared/models/audit.model';
import { Page } from '../../shared/models/page.model';
import { ReportKpis, SlaAlert, SlaAlertPage } from '../../shared/models/report.model';
import { Request } from '../../shared/models/request.model';
import { Role } from '../../shared/models/role';
import { SpanishPaginatorIntl } from '../../shared/i18n/spanish-paginator-intl';
import { HomeComponent } from './home.component';

@Component({ template: '' })
class OtherComponent {}

const API = environment.bffBaseUrl;

const page = <T>(content: T[], totalElements = content.length, number = 0): Page<T> => ({
  content,
  page: number,
  size: 5,
  totalElements,
  totalPages: Math.ceil(totalElements / 5),
});

const request = (overrides: Partial<Request> = {}): Request => ({
  id: 'r-1',
  description: 'Hoyo profundo',
  procedureType: 'bache',
  procedureLabel: 'Bache en calzada',
  address: 'Los Aromos 123',
  status: 'EN_GESTION',
  rejectionReason: null,
  createdAt: '2026-11-10T12:00:00Z',
  solicitanteId: 'oid-vecina',
  folio: 'BD-2026-000128',
  hasAssignee: true,
  ...overrides,
});

const alert = (overrides: Partial<SlaAlert> = {}): SlaAlert => ({
  requestId: 'r-9',
  folio: 'BD-2026-000097',
  procedureType: 'alumbrado',
  procedureLabel: 'Luminaria apagada',
  assigneeId: 'oid-pedro',
  assigneeName: 'Pedro Soto',
  dueDate: '2026-11-10',
  slaStatus: 'VENCIDO',
  ...overrides,
});

const slaPage = (content: SlaAlert[], total = content.length, number = 0): SlaAlertPage => ({
  ...page(content, total, number),
  lastEventAt: '2026-11-13T17:58:12Z',
});

const kpis = (): ReportKpis => ({
  range: 'last24h',
  requestsOverTime: {
    bucket: 'HOUR',
    points: [{ bucketStart: '2026-11-13T17:00:00Z', count: 14 }],
  },
  activeByStatus: { INGRESADO: 12, ADMITIDO: 7, EN_GESTION: 5, EN_TERRENO: 2 },
  averageResolutionHours: 31.5,
  resolvedCount: 8,
  slaCompliance: { rate: 0.875, onTime: 7, late: 1 },
  lastEventAt: '2026-11-13T17:58:12Z',
});

const intervention = (): AuditEvent => ({
  eventId: 'e-1',
  eventType: 'request.status-changed',
  occurredAt: '2026-11-13T14:42:00Z',
  actor: { id: 'oid-andrea', name: 'Andrea Pizarro', role: 'Admin', sourceIp: null },
  resourceType: 'request',
  requestId: 'r-9',
  folio: 'BD-2026-000097',
  details: {
    fromStatus: 'EN_GESTION',
    toStatus: 'EN_TERRENO',
    interventionReason: 'Funcionario con licencia médica',
  },
});

describe('HomeComponent', () => {
  let harness: RouterTestingHarness;
  let backend: HttpTestingController;
  let announce: ReturnType<typeof vi.fn>;

  const element = () => harness.routeNativeElement as HTMLElement;
  const text = (root: Element | null = element()) =>
    (root?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const render = () => {
    TestBed.tick();
    harness.fixture.detectChanges();
  };
  const block = (heading: string) =>
    Array.from(element().querySelectorAll('section')).find((section) =>
      section.querySelector('h2')?.textContent?.includes(heading),
    ) ?? null;
  const pending = (path: string, params: Record<string, string> = {}) =>
    backend.match(
      (req) =>
        req.url === `${API}${path}` &&
        Object.entries(params).every(([key, value]) => req.params.get(key) === value),
    );
  const one = (path: string, params: Record<string, string> = {}): TestRequest => {
    const found = pending(path, params);
    expect(found, `${path} ${JSON.stringify(params)}`).toHaveLength(1);
    return found[0];
  };
  const flush = (req: TestRequest, body: object) => {
    req.flush(body);
    render();
  };
  const catalogType = (value: string, label: string) => ({
    value,
    label,
    active: true,
    dailyQuota: null,
    remainingQuota: null,
  });
  const unavailable = (req: TestRequest) => {
    req.flush({ message: 'No disponible' }, { status: 503, statusText: 'Service Unavailable' });
    render();
  };

  async function open(role: Role | null, account = { name: 'Usuario de prueba' }) {
    announce = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'inicio', component: HomeComponent },
          { path: 'otra', component: OtherComponent },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LiveAnnouncer, useValue: { announce } },
        { provide: MatPaginatorIntl, useClass: SpanishPaginatorIntl },
        {
          provide: AuthService,
          useValue: { account: signal(account), role: signal(role) },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create('/inicio');
    render();
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reemplaza la demostración: título, saludo y ningún bloque ni consulta sin rol', async () => {
    await open(null);

    expect(element().querySelector('h1')?.textContent).toContain('Inicio');
    expect(text()).toContain('Hola, Usuario de prueba.');
    expect(text()).not.toContain('Visible solo para');
    expect(element().querySelectorAll('section')).toHaveLength(0);
    backend.verify();
  });

  describe('Vecino', () => {
    it('ofrece Nuevo trámite, lista sus abiertos más recientes y cuenta abiertos y cerrados', async () => {
      await open(Role.Vecino);
      const recent = one('/api/requests', { open: 'true', size: '5' });
      expect(recent.request.params.has('sort')).toBe(false);
      flush(
        recent,
        page(
          [
            request(),
            request({
              id: 'r-2',
              folio: 'BD-2026-000131',
              hasAssignee: false,
              status: 'INGRESADO',
            }),
          ],
          3,
        ),
      );
      flush(one('/api/requests', { open: 'false', size: '1' }), page([request()], 12));

      const cta = element().querySelector<HTMLAnchorElement>('.cta a')!;
      expect(cta.textContent).toContain('Nuevo trámite');
      expect(cta.getAttribute('href')).toBe('/tramites#nuevo-tramite');

      const list = block('Mis trámites abiertos')!;
      expect(text(list)).toContain('Bache en calzada');
      expect(text(list)).toContain('BD-2026-000128');
      expect(list.querySelectorAll('.list__attention')).toHaveLength(1);
      expect(text(list.querySelector('h2'))).toContain('3');
      expect(list.querySelector<HTMLAnchorElement>('.list__row')!.getAttribute('href')).toBe(
        '/tramites/r-1',
      );
      expect(list.querySelector<HTMLAnchorElement>('.home-link')!.getAttribute('href')).toBe(
        '/tramites?open=true',
      );

      const stats = Array.from(element().querySelectorAll<HTMLAnchorElement>('.stat'));
      expect(stats.map((stat) => text(stat.querySelector('.stat__value')))).toEqual(['3', '12']);
      expect(stats[1].getAttribute('href')).toBe('/tramites?open=false');
      // Ni plazos ni auditoría: el Vecino no los ve (EP3-04, sección 2). Solo el catálogo, para los nombres
      one('/api/catalog/procedures').flush([]);
      backend.verify();
    });

    it('distingue la primera vez de no tener abiertos', async () => {
      await open(Role.Vecino);
      flush(one('/api/requests', { open: 'true' }), page([]));
      flush(one('/api/requests', { open: 'false' }), page([]));
      expect(text(block('Mis trámites abiertos'))).toContain('Aún no tienes trámites');

      element().querySelector<HTMLButtonElement>('.block__refresh')!.click();
      render();
      flush(one('/api/requests', { open: 'true' }), page([]));
      flush(one('/api/requests', { open: 'false' }), page([request()], 4));
      expect(text(block('Mis trámites abiertos'))).toContain('No tienes trámites abiertos');
      expect(text(block('Mis trámites abiertos'))).not.toContain('Aún no tienes');
    });

    it('requests caído: los bloques quedan "No disponible" y Nuevo trámite sigue a mano', async () => {
      await open(Role.Vecino);
      unavailable(one('/api/requests', { open: 'true' }));
      unavailable(one('/api/requests', { open: 'false' }));

      expect(text(block('Mis trámites abiertos'))).toContain('No disponible');
      expect(text(block('Mis trámites abiertos'))).toContain(
        'El servicio de trámites no responde.',
      );
      expect(text(element().querySelector('.stats'))).toContain('No disponible');
      expect(element().querySelector('.cta a')).not.toBeNull();
    });
  });

  describe('nombre del tipo', () => {
    it('usa el nombre actual del catálogo, también para trámites antiguos y en los plazos', async () => {
      await open(Role.Funcionario);
      const catalog = one('/api/catalog/procedures');
      flush(
        one('/api/report/sla'),
        slaPage([alert({ procedureType: 'alumbrado', procedureLabel: 'Alumbrado público' })]),
      );
      flush(
        one('/api/requests', { assignee: 'me' }),
        page([request({ procedureType: 'bache', procedureLabel: null })]),
      );
      flush(one('/api/requests', { assignee: 'none' }), page([]));

      // Antes del catálogo: nombre guardado y, sin él, el código. Los bloques no lo esperan
      expect(text(block('Mis asignados'))).toContain('bache');
      expect(text(block('Plazos por vencer y vencidos'))).toContain('Alumbrado público');

      flush(catalog, [
        catalogType('bache', 'Bache en calzada'),
        catalogType('alumbrado', 'Luminaria apagada'),
      ]);
      expect(text(block('Mis asignados'))).toContain('Bache en calzada');
      expect(text(block('Plazos por vencer y vencidos'))).toContain('Luminaria apagada');
    });

    it('catálogo no disponible: los bloques siguen con el nombre guardado y sin error', async () => {
      await open(Role.Vecino);
      unavailable(one('/api/catalog/procedures'));
      flush(one('/api/requests', { open: 'true' }), page([request()]));
      flush(one('/api/requests', { open: 'false' }), page([]));

      const list = block('Mis trámites abiertos')!;
      expect(text(list)).toContain('Bache en calzada');
      expect(text(list)).not.toContain('No disponible');
    });

    it('un tipo que el catálogo no tiene conserva el nombre guardado', async () => {
      await open(Role.Admin);
      flush(one('/api/catalog/procedures'), [catalogType('poda', 'Poda de árboles')]);
      flush(one('/api/report/kpis'), kpis());
      flush(one('/api/report/sla'), slaPage([alert()]));
      flush(one('/api/requests'), page([]));

      expect(text(block('Plazos vencidos'))).toContain('Luminaria apagada');
    });

    it('el Auditor no pide el catálogo: la auditoría conserva el nombre histórico', async () => {
      await open(Role.Auditor);
      expect(pending('/api/catalog/procedures')).toHaveLength(0);
    });
  });

  describe('Funcionario', () => {
    const loadQueues = (mine: Request[] = [request()], none: Request[] = []) => {
      flush(one('/api/requests', { assignee: 'me' }), page(mine));
      flush(one('/api/requests', { assignee: 'none' }), page(none));
    };

    it('pide plazos de sus asignados y las dos bandejas abiertas, de la más antigua a la más nueva', async () => {
      await open(Role.Funcionario);

      const sla = one('/api/report/sla', { assignee: 'me', page: '0', size: '5' });
      expect(sla.request.params.has('status')).toBe(false);
      const [mineQueue, noneQueue] = ['me', 'none'].map((assignee) =>
        one('/api/requests', { assignee, open: 'true', sort: 'createdAt,asc', size: '5' }),
      );
      flush(
        sla,
        slaPage([
          alert(),
          alert({ requestId: 'r-10', slaStatus: 'POR_VENCER', dueDate: '2099-01-05' }),
        ]),
      );
      flush(mineQueue, page([request()]));
      flush(noneQueue, page([]));

      const plazos = block('Plazos por vencer y vencidos')!;
      expect(text(plazos)).toContain('De los trámites a mi cargo');
      expect(text(plazos)).toContain('Vencido');
      expect(text(plazos)).toContain('Venció el 10 nov');
      expect(text(plazos)).toContain('Por vencer');
      expect(text(plazos)).toContain('Datos al');
      // Solo ve sus trámites: el responsable no se repite en cada fila
      expect(plazos.querySelector('app-request-assignee')).toBeNull();
      expect(text(plazos)).not.toContain('Hora de Chile');

      const mine = block('Mis asignados')!;
      expect(text(mine)).toContain('Abiertos · Más antiguos primero');
      expect(text(mine)).toContain('Consultado');
      expect(text(mine)).not.toContain('Datos al');
      expect(mine.querySelector<HTMLAnchorElement>('.home-link')!.getAttribute('href')).toBe(
        '/tramites?assignee=me&open=true&sort=createdAt,asc',
      );
      expect(text(block('Sin asignar'))).toContain('No hay trámites sin asignar');
      expect(text(block('Sin asignar'))).not.toContain('Ver trámites sin asignar');
    });

    it('report caído no bloquea la bandeja: solo el bloque de plazos queda "No disponible"', async () => {
      await open(Role.Funcionario);
      unavailable(one('/api/report/sla'));
      loadQueues([], [request({ hasAssignee: false })]);

      expect(text(block('Plazos por vencer y vencidos'))).toContain(
        'El servicio de reportes no responde.',
      );
      expect(text(block('Mis asignados'))).toContain('No tienes trámites asignados');
      expect(text(block('Mis asignados'))).not.toContain('No disponible');
      expect(text(block('Sin asignar'))).toContain('Bache en calzada');

      const retry = Array.from(
        block('Plazos por vencer y vencidos')!.querySelectorAll<HTMLButtonElement>('button'),
      ).find((button) => text(button).includes('Reintentar'))!;
      retry.click();
      render();
      flush(one('/api/report/sla'), slaPage([]));
      expect(text(block('Plazos por vencer y vencidos'))).toContain(
        'Ningún trámite a tu cargo está por vencer ni vencido',
      );
    });

    it('pagina los plazos en el bloque, con primera y última página', async () => {
      await open(Role.Funcionario);
      flush(one('/api/report/sla'), slaPage([alert()], 12));
      loadQueues();

      const plazos = block('Plazos por vencer y vencidos')!;
      expect(plazos.querySelector('.mat-mdc-paginator-navigation-first')).not.toBeNull();
      plazos.querySelector<HTMLButtonElement>('.mat-mdc-paginator-navigation-last')!.click();
      render();

      const last = one('/api/report/sla', { page: '2' });
      // La página anterior queda atenuada mientras llega la nueva, sin saltar a la silueta
      expect(plazos.querySelector('.block__content--loading')).not.toBeNull();
      flush(last, slaPage([alert({ requestId: 'r-20', folio: 'BD-2026-000140' })], 12, 2));
      expect(text(block('Plazos por vencer y vencidos'))).toContain('BD-2026-000140');
      expect(text(block('Plazos por vencer y vencidos'))).toContain('11 – 12 de 12');
    });

    it('actualizar solo vuelve a consultar su bloque y anuncia el resultado', async () => {
      await open(Role.Funcionario);
      flush(one('/api/report/sla'), slaPage([]));
      loadQueues();

      block('Mis asignados')!.querySelector<HTMLButtonElement>('.block__refresh')!.click();
      render();
      expect(pending('/api/report/sla')).toHaveLength(0);
      expect(pending('/api/requests', { assignee: 'none' })).toHaveLength(0);
      flush(one('/api/requests', { assignee: 'me' }), page([request()]));
      expect(announce).toHaveBeenCalledWith('Mis asignados: actualizado.');

      block('Mis asignados')!.querySelector<HTMLButtonElement>('.block__refresh')!.click();
      render();
      unavailable(one('/api/requests', { assignee: 'me' }));
      expect(announce).toHaveBeenCalledWith('No se pudo actualizar Mis asignados.');
      // Conserva lo que tenía, con aviso: una falla al actualizar no borra la bandeja
      expect(text(block('Mis asignados'))).toContain('No se pudo actualizar.');
      expect(text(block('Mis asignados'))).toContain('Bache en calzada');
    });
  });

  describe('Admin', () => {
    it('KPIs con polling cada 5 s, vencidos de la comuna con responsable y sin asignar', async () => {
      await open(Role.Admin);
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });

      flush(one('/api/report/kpis', { range: 'last24h' }), kpis());
      const overdue = one('/api/report/sla', { status: 'VENCIDO', page: '0', size: '5' });
      expect(overdue.request.params.has('assignee')).toBe(false);
      flush(
        overdue,
        slaPage([alert(), alert({ requestId: 'r-11', assigneeId: null, assigneeName: null })]),
      );
      flush(
        one('/api/requests', { assignee: 'none', open: 'true', sort: 'createdAt,asc' }),
        page([]),
      );

      const openTile = Array.from(element().querySelectorAll('.kpi-tile')).find(
        (tile) => tile.querySelector('dt')?.textContent === 'Trámites abiertos',
      )!;
      expect(text(openTile.querySelector('.kpi-tile__value'))).toBe('26');
      expect(text(element().querySelector('.kpis'))).toContain('Se actualiza cada 5 s');
      expect(
        element().querySelector<HTMLAnchorElement>('.kpis .home-link')!.getAttribute('href'),
      ).toBe('/reports');
      const vencidos = block('Plazos vencidos')!;
      expect(text(vencidos)).toContain('Toda la comuna');
      expect(text(vencidos)).toContain('Pedro Soto');
      expect(text(vencidos)).toContain('Sin asignar');

      vi.advanceTimersByTime(5_000);
      render();
      flush(one('/api/report/kpis'), kpis());
      // El polling es solo de los KPIs (K8)
      expect(pending('/api/report/sla')).toHaveLength(0);
      expect(pending('/api/requests')).toHaveLength(0);
    });

    it('Pausar detiene el polling y salir de /inicio también', async () => {
      await open(Role.Admin);
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
      flush(one('/api/report/kpis'), kpis());
      flush(one('/api/report/sla'), slaPage([]));
      flush(one('/api/requests'), page([]));

      const pause = element().querySelector<HTMLButtonElement>('.kpis__actions button')!;
      pause.click();
      render();
      expect(text(element().querySelector('.kpis'))).toContain('Actualización automática en pausa');
      expect(announce).toHaveBeenCalledWith('Actualización automática en pausa.');
      vi.advanceTimersByTime(30_000);
      expect(pending('/api/report/kpis')).toHaveLength(0);

      pause.click();
      render();
      flush(one('/api/report/kpis'), kpis());
      await TestBed.inject(Router).navigateByUrl('/otra');
      vi.advanceTimersByTime(30_000);
      expect(pending('/api/report/kpis')).toHaveLength(0);
    });

    it('report caído: KPIs y vencidos sin datos, y espera más entre intentos', async () => {
      await open(Role.Admin);
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
      unavailable(one('/api/report/kpis'));
      unavailable(one('/api/report/sla'));
      flush(one('/api/requests'), page([request({ hasAssignee: false })]));

      expect(text(element().querySelector('.kpis'))).toContain('Indicadores no disponibles');
      expect(text(element().querySelector('.kpis'))).toContain(
        'Se volverá a intentar automáticamente.',
      );
      expect(text(block('Plazos vencidos'))).toContain('No disponible');
      expect(text(block('Sin asignar'))).toContain('Bache en calzada');
      expect(announce).toHaveBeenCalledWith('No se pudieron actualizar los indicadores.');

      vi.advanceTimersByTime(9_999);
      expect(pending('/api/report/kpis')).toHaveLength(0);
      vi.advanceTimersByTime(1);
      flush(one('/api/report/kpis'), kpis());
      expect(announce).toHaveBeenCalledWith('Los indicadores se actualizaron nuevamente.');
    });
  });

  describe('Auditor', () => {
    it('busca las intervenciones del Admin de 7 días y los últimos eventos sin período', async () => {
      await open(Role.Auditor);

      const interventions = one('/api/audit/events', {
        actorRole: 'Admin',
        eventType: 'request.status-changed,request.contact-logged',
        page: '0',
        size: '5',
      });
      expect(interventions.request.params.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      const recent = backend.match(
        (req) => req.url === `${API}/api/audit/events` && !req.params.has('actorRole'),
      )[0];
      expect(recent.request.params.has('from')).toBe(false);
      expect(recent.request.params.get('size')).toBe('5');

      flush(interventions, page([intervention()], 3));
      flush(recent, page([intervention()]));

      const list = block('Intervenciones del Administrador')!;
      expect(text(list)).toContain('Últimos 7 días');
      expect(text(list)).not.toContain('Hora de Chile');
      expect(text(list)).toContain('Cambio de estado: En gestión → En terreno');
      expect(text(list)).toContain('Funcionario con licencia médica');
      expect(text(list)).toContain('BD-2026-000097');
      expect(list.querySelector<HTMLAnchorElement>('.list__row')!.getAttribute('href')).toBe(
        '/audit?view=timeline&folio=BD-2026-000097',
      );
      expect(
        decodeURIComponent(
          list.querySelector<HTMLAnchorElement>('.home-link')!.getAttribute('href')!,
        ),
      ).toBe('/audit?actorRole=Admin&eventType=request.status-changed,request.contact-logged');

      const last = block('Últimos eventos')!;
      expect(text(last)).not.toContain('Hoy');
      expect(last.querySelector('.list__attention, .event__reason')).toBeNull();
      expect(last.querySelector<HTMLAnchorElement>('.home-link')!.getAttribute('href')).toBe(
        '/audit?period=all',
      );
      // Solo lectura: ninguna acción sobre trámites
      expect(text(element())).not.toMatch(/Tomar|Asignar|Rechazar/);
    });

    it('distingue el vacío del servicio caído en cada bloque', async () => {
      await open(Role.Auditor);
      const [interventions, recent] = pending('/api/audit/events');
      flush(interventions, page([]));
      unavailable(recent);

      expect(text(block('Intervenciones del Administrador'))).toContain(
        'Sin intervenciones en los últimos 7 días',
      );
      expect(text(block('Últimos eventos'))).toContain('El servicio de auditoría no responde.');
    });
  });
});
