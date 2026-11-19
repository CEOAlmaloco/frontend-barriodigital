import { LiveAnnouncer } from '@angular/cdk/a11y';
import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject } from 'rxjs';

import { ReportService } from '../../core/report/report.service';
import {
  ReportKpis,
  ReportRange,
  ReportTopProcedures,
} from '../../shared/models/report.model';
import { formatClock } from './report-format';
import { ReportsComponent } from './reports.component';

@Component({ template: '' })
class OtherComponent {}

interface Call<T> {
  range: ReportRange;
  subject: Subject<T>;
}

const points = (bucket: 'HOUR' | 'DAY', counts: number[]) => ({
  bucket,
  points: counts.map((count, index) => ({
    bucketStart: new Date(Date.UTC(2026, 10, 12, 17 + index)).toISOString(),
    count,
  })),
});

const kpis = (overrides: Partial<ReportKpis> = {}): ReportKpis => ({
  range: 'last24h',
  requestsOverTime: points('HOUR', Array.from({ length: 24 }, (_, i) => (i === 18 ? 11 : 2))),
  activeByStatus: { INGRESADO: 12, ADMITIDO: 7, EN_GESTION: 5, EN_TERRENO: 2 },
  averageResolutionHours: 31.5,
  resolvedCount: 8,
  slaCompliance: { rate: 0.875, onTime: 7, late: 1 },
  lastEventAt: '2026-11-13T17:58:12Z',
  ...overrides,
});

const top = (overrides: Partial<ReportTopProcedures> = {}): ReportTopProcedures => ({
  range: 'last24h',
  items: [
    { procedureType: 'bache', procedureLabel: 'Bache en calle', count: 6 },
    { procedureType: 'alumbrado', procedureLabel: null, count: 4 },
  ],
  lastEventAt: '2026-11-13T17:58:12Z',
  ...overrides,
});

describe('ReportsComponent', () => {
  let harness: RouterTestingHarness;
  let kpiCalls: Call<ReportKpis>[];
  let topCalls: Call<ReportTopProcedures>[];
  let announce: ReturnType<typeof vi.fn>;
  let visibility: DocumentVisibilityState;

  const element = () => harness.routeNativeElement as HTMLElement;
  const text = (selector?: string) =>
    ((selector ? element().querySelector(selector) : element())?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  /** «valor | detalle» del indicador, leído por su término como lo recorre un lector de pantalla. */
  const tile = (label: string) => {
    const card = Array.from(element().querySelectorAll('.kpi-tile')).find(
      (node) => node.querySelector('dt')?.textContent?.trim() === label,
    );
    return Array.from(card?.querySelectorAll('dd') ?? [])
      .map((dd) => dd.textContent?.trim())
      .join(' | ');
  };
  const render = () => {
    TestBed.tick();
  };
  const respond = <T>(call: Call<T> | undefined, value: T) => {
    call!.subject.next(value);
    call!.subject.complete();
    render();
  };
  const fail = <T>(call: Call<T> | undefined, status = 503) => {
    call!.subject.error(new HttpErrorResponse({ status }));
    render();
  };
  const loadBoth = (k = kpis(), t = top()) => {
    respond(kpiCalls.at(-1), k);
    respond(topCalls.at(-1), t);
  };
  const button = (label: string) =>
    Array.from(element().querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.replace(/\s+/g, ' ').trim().endsWith(label),
    )!;
  const setVisibility = (value: DocumentVisibilityState) => {
    visibility = value;
    document.dispatchEvent(new Event('visibilitychange'));
    render();
  };

  async function open(url = '/reports') {
    kpiCalls = [];
    topCalls = [];
    announce = vi.fn();
    visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'reports', component: ReportsComponent },
          { path: 'otra', component: OtherComponent },
        ]),
        { provide: LiveAnnouncer, useValue: { announce } },
        {
          provide: ReportService,
          useValue: {
            getKpis: (range: ReportRange) => {
              const subject = new Subject<ReportKpis>();
              kpiCalls.push({ range, subject });
              return subject;
            },
            getTopProcedures: (range: ReportRange) => {
              const subject = new Subject<ReportTopProcedures>();
              topCalls.push({ range, subject });
              return subject;
            },
          },
        },
      ],
    });
    harness = await RouterTestingHarness.create(url);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    render();
  }

  afterEach(() => {
    vi.useRealTimers();
    delete (document as { visibilityState?: unknown }).visibilityState;
  });

  it('reemplaza el placeholder: carga con silueta y muestra los cuatro indicadores', async () => {
    await open();
    expect(kpiCalls.map((c) => c.range)).toEqual(['last24h']);
    expect(topCalls.map((c) => c.range)).toEqual(['last24h']);
    expect(element().querySelector('[aria-busy="true"] app-report-skeleton')).not.toBeNull();
    expect(text()).not.toContain('Kafka');

    loadBoth();

    expect(element().querySelector('dl.kpi-tiles')).not.toBeNull();
    expect(tile('Trámites abiertos')).toBe('26 | Ahora');
    expect(tile('Ingresados')).toBe('57 | Últimas 24 horas');
    expect(tile('Tiempo medio de resolución')).toBe('1 d 7 h | 8 trámites resueltos');
    expect(tile('Cumplimiento de plazo')).toMatch(/^87,5\s?% \| 7 de 8 cierres dentro de plazo$/);
    expect(element().querySelector('.trend__plot')?.getAttribute('aria-label')).toContain(
      '57 trámites ingresados en las últimas 24 horas. Máximo: 11',
    );
    expect(text()).toContain('Estados activos');
    expect(text('ol')).toContain('Bache en calle');
    expect(text('ol')).toContain('alumbrado');
    expect(element().querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('muestra "datos al" con lastEventAt y la hora de la consulta', async () => {
    await open();
    loadBoth();
    const freshness = text('.toolbar__freshness');
    expect(freshness).toContain('Datos al 13 nov 2026');
    expect(freshness).toContain(`Consultado ${formatClock(new Date())}`);
    expect(freshness).toContain('Se actualiza cada 5 s');
  });

  it('consulta cada 5 s después de cada respuesta y se detiene al salir de la pantalla', async () => {
    await open();
    loadBoth();
    vi.advanceTimersByTime(4_999);
    expect(kpiCalls).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(kpiCalls).toHaveLength(2);
    expect(topCalls).toHaveLength(2);

    loadBoth();
    vi.useRealTimers();
    await harness.navigateByUrl('/otra');
    vi.useFakeTimers();
    vi.advanceTimersByTime(60_000);
    expect(kpiCalls).toHaveLength(2);
  });

  it('no consulta con la pestaña oculta y actualiza de inmediato al volver', async () => {
    await open();
    loadBoth();
    setVisibility('hidden');
    vi.advanceTimersByTime(60_000);
    expect(kpiCalls).toHaveLength(1);

    setVisibility('visible');
    expect(kpiCalls).toHaveLength(2);
    expect(topCalls).toHaveLength(2);
  });

  it('una respuesta de más de 5 s no se cancela ni se pide de nuevo mientras llega', async () => {
    await open();
    vi.advanceTimersByTime(12_000);
    expect(kpiCalls).toHaveLength(1);
    expect(kpiCalls[0].subject.observed).toBe(true);

    loadBoth();
    expect(tile('Trámites abiertos')).toBe('26 | Ahora');
    vi.advanceTimersByTime(5_000);
    expect(kpiCalls).toHaveLength(2);
  });

  it('en pausa, Actualizar consulta una vez y no reactiva el polling', async () => {
    await open();
    loadBoth();
    button('Pausar').click();
    render();
    expect(text('.toolbar__freshness')).toContain('Actualización automática en pausa');
    expect(announce).toHaveBeenCalledWith('Actualización automática en pausa.');
    vi.advanceTimersByTime(60_000);
    expect(kpiCalls).toHaveLength(1);

    button('Actualizar').click();
    expect(kpiCalls).toHaveLength(2);
    expect(topCalls).toHaveLength(2);
    loadBoth();
    expect(announce).toHaveBeenCalledWith('Reportes actualizados.');
    vi.advanceTimersByTime(60_000);
    expect(kpiCalls).toHaveLength(2);
    expect(button('Reanudar')).toBeTruthy();
  });

  it('cambiar de período lo guarda en la URL, lo carga y conserva la pausa', async () => {
    await open();
    loadBoth();
    button('Pausar').click();
    render();

    vi.useRealTimers();
    button('Últimos 7 días').click();
    await harness.fixture.whenStable();
    vi.useFakeTimers();
    render();

    expect(TestBed.inject(Router).url).toBe('/reports?range=last7d');
    expect(kpiCalls.at(-1)?.range).toBe('last7d');
    expect(topCalls.at(-1)?.range).toBe('last7d');
    loadBoth(
      kpis({ range: 'last7d', requestsOverTime: points('DAY', [3, 4, 5, 6, 7, 8, 9]) }),
      top({ range: 'last7d' }),
    );
    expect(text()).toContain('Trámites ingresados por día');
    expect(announce).toHaveBeenCalledWith('Reportes de los últimos 7 días cargados.');
    vi.advanceTimersByTime(60_000);
    expect(kpiCalls).toHaveLength(2);
    expect(button('Reanudar')).toBeTruthy();
  });

  it('lee el período de la URL y corrige un valor inválido', async () => {
    await open('/reports?range=last7d');
    expect(kpiCalls[0].range).toBe('last7d');
    expect(
      element().querySelector('.mat-button-toggle-checked')?.textContent?.trim(),
    ).toBe('Últimos 7 días');

    vi.useRealTimers();
    await harness.navigateByUrl('/reports?range=ayer');
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/reports');
  });

  it('si falla el período nuevo no muestra los datos del anterior como propios', async () => {
    await open();
    loadBoth();
    vi.useRealTimers();
    button('Últimos 7 días').click();
    await harness.fixture.whenStable();
    vi.useFakeTimers();
    render();

    fail(kpiCalls.at(-1), 500);
    respond(topCalls.at(-1), top({ range: 'last7d', items: [] }));

    expect(element().querySelector('.kpi-tiles')).toBeNull();
    expect(element().querySelector('app-report-trend-chart')).toBeNull();
    expect(text()).toContain('No se pudieron cargar los indicadores');
    expect(text()).toContain('Sin datos de los últimos 7 días');
    expect(text()).toContain('No ingresaron trámites en los últimos 7 días');
  });

  it('un fallo parcial conserva los datos de esa fuente y su hora, sin ocultarlo tras el éxito de la otra', async () => {
    await open();
    loadBoth();
    const firstConsult = formatClock(new Date());

    vi.advanceTimersByTime(5_000);
    respond(kpiCalls.at(-1), kpis());
    fail(topCalls.at(-1));

    const topCard = text('section[aria-labelledby="reports-top-title"]');
    expect(topCard).toContain('No se pudieron actualizar');
    expect(topCard).toContain(`Datos consultados a las ${firstConsult}`);
    expect(topCard).toContain('Bache en calle');
    expect(text('.toolbar__freshness')).toContain(`Consultado ${firstConsult}`);
    expect(element().querySelector('.reports__kpis .reports__notice')).toBeNull();
    expect(announce).toHaveBeenCalledWith('No se pudieron actualizar los tipos más demandados.');

    // Espera creciente por fuente: indicadores siguen a 5 s, tipos esperan 10 s.
    vi.advanceTimersByTime(5_000);
    expect(kpiCalls).toHaveLength(3);
    expect(topCalls).toHaveLength(2);
    vi.advanceTimersByTime(5_000);
    expect(topCalls).toHaveLength(3);
  });

  it('con report caído informa que los reportes no están disponibles, centrado y sin afirmar nada más', async () => {
    await open();
    fail(kpiCalls.at(-1));
    fail(topCalls.at(-1));

    const state = element().querySelector('.reports__state');
    expect(state?.getAttribute('role')).toBe('alert');
    expect(text('.reports__state')).toContain('Los reportes no están disponibles');
    expect(text('.reports__state')).toContain('Se volverá a intentar automáticamente.');
    expect(text('.reports__state')).not.toMatch(/funcion|normalidad/i);
    expect(element().querySelector('app-report-toolbar')).not.toBeNull();
  });

  it('un error distinto de 503 en la primera carga ofrece reintentar', async () => {
    await open();
    fail(kpiCalls.at(-1), 0);
    fail(topCalls.at(-1), 500);
    expect(text('.reports__state')).toContain('No pudimos cargar los reportes');

    button('Reintentar').click();
    expect(kpiCalls).toHaveLength(2);
    expect(topCalls).toHaveLength(2);
  });

  it('sin eventos muestra estados vacíos y no ceros como datos', async () => {
    await open();
    loadBoth(
      kpis({
        requestsOverTime: points('HOUR', Array(24).fill(0)),
        activeByStatus: { INGRESADO: 0, ADMITIDO: 0, EN_GESTION: 0, EN_TERRENO: 0 },
        averageResolutionHours: null,
        resolvedCount: 0,
        slaCompliance: { rate: null, onTime: 0, late: 0 },
        lastEventAt: null,
      }),
      top({ items: [], lastEventAt: null }),
    );
    expect(text('.toolbar__freshness')).toContain('Aún no hay eventos registrados');
    expect(tile('Trámites abiertos')).toBe('0 | Ahora');
    expect(tile('Tiempo medio de resolución')).toBe('Sin resueltos | Ninguno en las últimas 24 horas');
    expect(text()).toContain('Sin trámites ingresados');
    expect(text()).toContain('No hay trámites abiertos en este momento.');
  });

  it('distingue "sin cierres evaluables" de "sin resueltos"', async () => {
    await open();
    loadBoth(kpis({ slaCompliance: { rate: null, onTime: 0, late: 0 } }));
    expect(tile('Tiempo medio de resolución')).toBe('1 d 7 h | 8 trámites resueltos');
    expect(tile('Cumplimiento de plazo')).toBe(
      'Sin cierres evaluables | Ningún cierre con plazo en las últimas 24 horas',
    );
  });

  it('usa el denominador de report en el cumplimiento', async () => {
    await open();
    loadBoth(kpis({ resolvedCount: 8, slaCompliance: { rate: 0.5, onTime: 1, late: 1 } }));
    expect(tile('Cumplimiento de plazo')).toMatch(/^50,0\s?% \| 1 de 2 cierres dentro de plazo$/);
  });
});
