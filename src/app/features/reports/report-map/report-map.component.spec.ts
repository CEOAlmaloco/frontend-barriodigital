import { LiveAnnouncer } from '@angular/cdk/a11y';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject } from 'rxjs';

import { CatalogService } from '../../../core/catalog/catalog.service';
import { ReportService } from '../../../core/report/report.service';
import { ProcedureType } from '../../../shared/models/procedure-type.model';
import { MapPoint, MapPointsQuery, ReportMapPoints } from '../../../shared/models/report.model';
import { RequestsMapComponent } from '../requests-map/requests-map.component';
import { MapPointView } from './map-point-view';
import { MAP_POLL_INTERVAL_MS, ReportMapComponent } from './report-map.component';

/** Leaflet no se dibuja en jsdom: el doble expone lo que recibe el mapa. */
@Component({
  selector: 'app-requests-map',
  template: `<ng-content />`,
  host: {
    '[attr.data-points]': 'points().length',
    '[attr.data-busy]': 'busy()',
    '[attr.data-fit-key]': 'fitKey()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class RequestsMapStubComponent {
  readonly points = input.required<readonly MapPointView[]>();
  readonly busy = input(false);
  readonly fitKey = input.required<string>();
  readonly visible = input(true);
}

interface Call {
  query: MapPointsQuery;
  subject: Subject<ReportMapPoints>;
}

const mapPoint = (index: number, overrides: Partial<MapPoint> = {}): MapPoint => ({
  requestId: `req-${index}`,
  folio: `BD-2026-${String(index).padStart(6, '0')}`,
  latitude: -37.9 - index / 1000,
  longitude: -71.3,
  status: 'EN_GESTION',
  procedureType: 'bache',
  procedureLabel: 'Bache en calle',
  sector: 'ralco',
  ...overrides,
});

const response = (overrides: Partial<ReportMapPoints> = {}): ReportMapPoints => {
  const items = overrides.items ?? Array.from({ length: 22 }, (_, i) => mapPoint(i + 1));
  return {
    range: 'last7d',
    items,
    locatedTotal: items.length,
    withoutLocation: 2,
    bySector: [
      { sector: 'ralco', count: 20 },
      { sector: 'pitril', count: 3 },
      { sector: null, count: 1 },
    ],
    lastEventAt: '2026-11-13T17:58:12Z',
    ...overrides,
  };
};

const catalog: ProcedureType[] = [
  {
    value: 'luminaria',
    label: 'Luminaria apagada',
    active: true,
    dailyQuota: null,
    remainingQuota: null,
    slaBusinessDays: null,
  },
  {
    value: 'bache',
    label: 'Bache en calle',
    active: true,
    dailyQuota: null,
    remainingQuota: null,
    slaBusinessDays: null,
  },
] as ProcedureType[];

describe('ReportMapComponent', () => {
  let harness: RouterTestingHarness;
  let calls: Call[];
  let catalogCalls: Subject<ProcedureType[]>[];
  let announce: ReturnType<typeof vi.fn>;

  const element = () => harness.routeNativeElement as HTMLElement;
  const text = (selector?: string) =>
    ((selector ? element().querySelector(selector) : element())?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  const render = () => TestBed.tick();
  const respond = (value = response(), call = calls.at(-1)) => {
    call!.subject.next(value);
    call!.subject.complete();
    render();
  };
  const fail = (status = 503, call = calls.at(-1)) => {
    call!.subject.error(new HttpErrorResponse({ status }));
    render();
  };
  const loadCatalog = (types = catalog) => {
    const subject = catalogCalls.at(-1)!;
    subject.next(types);
    subject.complete();
    render();
  };
  const failCatalog = () => {
    catalogCalls.at(-1)!.error(new HttpErrorResponse({ status: 503 }));
    render();
  };
  const tile = (label: string) => {
    const card = Array.from(element().querySelectorAll('.summary__tile')).find(
      (node) => node.querySelector('dt')?.textContent?.trim() === label,
    );
    return Array.from(card?.querySelectorAll('dd') ?? [], (dd) => dd.textContent?.trim()).join(
      ' | ',
    );
  };
  const button = (label: string) =>
    Array.from(element().querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.replace(/\s+/g, ' ').trim().endsWith(label),
    );
  const map = () => element().querySelector<HTMLElement>('app-requests-map')!;
  const url = () => TestBed.inject(Router).url;
  const fakeTimers = () =>
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
  /** La navegación del router se resuelve con timers reales, como en el spec de Indicadores. */
  const settle = async (action: () => void = () => {}) => {
    vi.useRealTimers();
    action();
    await harness.fixture.whenStable();
    fakeTimers();
    render();
  };
  const navigate = async (target: string) => {
    await harness.navigateByUrl(target);
    render();
  };

  async function open(target = '/reports/map') {
    calls = [];
    catalogCalls = [];
    announce = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'reports/map', component: ReportMapComponent },
          { path: 'tramites/:id', children: [] },
        ]),
        { provide: LiveAnnouncer, useValue: { announce } },
        {
          provide: ReportService,
          useValue: {
            getMapPoints: (query: MapPointsQuery) => {
              const subject = new Subject<ReportMapPoints>();
              calls.push({ query, subject });
              return subject;
            },
          },
        },
        {
          provide: CatalogService,
          useValue: {
            getProcedures: () => {
              const subject = new Subject<ProcedureType[]>();
              catalogCalls.push(subject);
              return subject;
            },
          },
        },
      ],
    });
    TestBed.overrideComponent(ReportMapComponent, {
      remove: { imports: [RequestsMapComponent] },
      add: { imports: [RequestsMapStubComponent] },
    });
    harness = await RouterTestingHarness.create(target);
    fakeTimers();
    render();
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('carga los últimos 7 días con siluetas y luego muestra totales, sectores y frescura', async () => {
    await open();

    expect(calls).toHaveLength(1);
    expect(calls[0].query).toEqual({ range: 'last7d', status: [], procedureType: null });
    expect(element().querySelector('[aria-busy="true"] app-report-map-summary')).not.toBeNull();
    expect(element().querySelectorAll('.summary__tile app-report-skeleton')).toHaveLength(3);

    respond();
    loadCatalog();

    expect(tile('Trámites')).toBe('24 | Últimos 7 días');
    expect(tile('Con ubicación')).toBe('22 | 91,7% del total');
    expect(tile('Sin ubicación')).toBe('2 | No aparecen en el mapa');
    expect(map().dataset['points']).toBe('22');
    expect(map().dataset['busy']).toBe('false');
    const sectors = Array.from(element().querySelectorAll('.ranking__label'), (label) =>
      label.textContent?.replace(/\s+/g, ' ').replace(':', '').trim(),
    );
    expect(sectors).toEqual(['Ralco', 'Pitril', 'Sin sector']);
    expect(text('.toolbar__freshness')).toContain('Datos al 13 nov 2026');
    expect(text('.toolbar__freshness')).toContain('Se actualiza cada 30 s');
    expect(text('app-report-map-legend')).toBe(
      'Otros abiertos En terreno Resuelto Rechazado o cancelado',
    );
  });

  it('consulta cada 30 s y una actualización del polling no reencuadra el mapa', async () => {
    await open();
    respond();
    const fitKey = map().dataset['fitKey'];

    vi.advanceTimersByTime(MAP_POLL_INTERVAL_MS - 1);
    expect(calls).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(calls).toHaveLength(2);
    respond(response({ items: [mapPoint(1)] }));

    expect(map().dataset['points']).toBe('1');
    expect(map().dataset['fitKey']).toBe(fitKey);
  });

  it('lee los filtros de la URL en orden canónico y descarta un tipo mal formado', async () => {
    await open('/reports/map?status=RESUELTO,INGRESADO&type=Bache%20X&range=last24h');

    expect(calls[0].query).toEqual({
      range: 'last24h',
      status: ['INGRESADO', 'RESUELTO'],
      procedureType: null,
    });
    await settle();
    expect(url()).toBe('/reports/map?status=INGRESADO,RESUELTO&range=last24h');
  });

  it('al cambiar el filtro atenúa los puntos anteriores, no muestra sus totales y reencuadra con los nuevos', async () => {
    await open();
    respond();
    const firstKey = map().dataset['fitKey'];

    await navigate('/reports/map?status=EN_TERRENO');

    expect(calls.at(-1)!.query.status).toEqual(['EN_TERRENO']);
    expect(map().dataset['busy']).toBe('true');
    expect(map().dataset['points']).toBe('22');
    expect(element().querySelectorAll('.summary__tile app-report-skeleton')).toHaveLength(3);

    respond(response({ items: [mapPoint(1, { status: 'EN_TERRENO' })], withoutLocation: 0 }));

    expect(map().dataset['busy']).toBe('false');
    expect(map().dataset['points']).toBe('1');
    expect(map().dataset['fitKey']).not.toBe(firstKey);
    expect(announce).toHaveBeenCalledWith('Mapa actualizado: 1 trámite con ubicación.');
  });

  it('avisa el recorte cuando report entrega menos puntos de los que tienen ubicación', async () => {
    await open();
    respond(
      response({ items: [mapPoint(1), mapPoint(2)], locatedTotal: 1234, withoutLocation: 6 }),
    );

    expect(text('.map-page__notice')).toContain(
      'El mapa muestra los 2 trámites más recientes de 1.234 con ubicación.',
    );
    expect(tile('Con ubicación')).toBe('1.234 | 99,5% del total · 2 en el mapa');
  });

  it('sin resultados lo dice sobre el mapa y, con filtros, ofrece limpiarlos', async () => {
    await open('/reports/map?type=bache');
    respond(response({ items: [], locatedTotal: 0, withoutLocation: 0, bySector: [] }));

    expect(text('.map-page__overlay')).toContain('No hay trámites para estos filtros');
    expect(tile('Trámites')).toBe('0 | Últimos 7 días');
    expect(tile('Sin ubicación')).toBe('0 | Sin trámites');
    expect(text('app-report-map-summary')).not.toContain('NaN');

    await settle(() =>
      element().querySelector<HTMLButtonElement>('.map-page__overlay button')!.click(),
    );

    expect(url()).toBe('/reports/map');
  });

  it('sin filtros y sin resultados nombra el período en vez de ofrecer limpiar', async () => {
    await open();
    respond(response({ items: [], locatedTotal: 0, withoutLocation: 0, bySector: [] }));

    expect(text('.map-page__overlay')).toContain('No ingresaron trámites en los últimos 7 días.');
    expect(element().querySelector('.map-page__overlay button')).toBeNull();
  });

  it.each([
    { without: 5, message: 'Ninguno de los 5 trámites tiene ubicación' },
    { without: 1, message: 'El trámite encontrado no tiene ubicación' },
  ])('sin puntos ubicables lo explica: $message', async ({ without, message }) => {
    await open();
    respond(
      response({
        items: [],
        locatedTotal: 0,
        withoutLocation: without,
        bySector: [{ sector: null, count: without }],
      }),
    );

    expect(text('.map-page__overlay')).toContain(message);
    expect(text('app-report-ranking')).toContain('Sin sector');
  });

  it('con report caído en la primera carga muestra un solo aviso con reintento', async () => {
    await open();
    fail(503);

    expect(text('.map-page__state')).toContain('El mapa no está disponible');
    expect(text('.map-page__state')).toContain('Se volverá a intentar automáticamente.');
    expect(element().querySelector('app-requests-map')).toBeNull();

    button('Reintentar')!.click();
    render();
    expect(calls).toHaveLength(2);
  });

  it('si falla una actualización conserva los datos del mismo filtro y avisa con su hora', async () => {
    await open();
    respond();
    vi.advanceTimersByTime(MAP_POLL_INTERVAL_MS);
    fail(503);

    expect(text('.map-page__notice')).toContain('No se pudo actualizar el mapa.');
    expect(map().dataset['points']).toBe('22');
    expect(announce).toHaveBeenCalledWith('No se pudo actualizar el mapa.');
  });

  it('con el catálogo caído conserva el tipo activo con su nombre y permite reintentar', async () => {
    await open('/reports/map?type=bache');
    respond();
    failCatalog();

    const typeField = element().querySelectorAll('mat-form-field')[1];
    expect(typeField.querySelector('.mat-mdc-select-value')?.textContent?.trim()).toBe(
      'Bache en calle',
    );
    expect(typeField.querySelector('mat-select')?.getAttribute('aria-disabled')).toBe('true');
    expect(typeField.textContent).toContain('No se pudieron cargar los tipos.');
    expect(button('Limpiar filtros')).toBeDefined();

    button('Reintentar')!.click();
    render();
    expect(catalogCalls).toHaveLength(2);
    loadCatalog();
    expect(element().querySelectorAll('mat-form-field')[1].textContent).not.toContain(
      'No se pudieron cargar',
    );
  });

  it('Actualizar también vuelve a pedir el catálogo si había fallado', async () => {
    await open();
    respond();
    failCatalog();

    button('Actualizar')!.click();
    render();

    expect(calls).toHaveLength(2);
    expect(catalogCalls).toHaveLength(2);
  });

  it('la vista Lista muestra los mismos trámites con enlace al detalle y conserva el mapa montado', async () => {
    await open('/reports/map?view=list');
    respond();
    loadCatalog();

    const rows = element().querySelectorAll('app-report-map-list tbody tr');
    expect(rows).toHaveLength(10);
    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe('/tramites/req-1');
    expect(rows[0].textContent).toContain('BD-2026-000001');
    expect(rows[0].textContent).toContain('En gestión');
    expect(map().hidden).toBe(true);
    expect(element().querySelector('mat-paginator')).not.toBeNull();
  });
});
