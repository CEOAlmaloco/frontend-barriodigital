import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MapPoint } from '../../../shared/models/report.model';
import { MapPointView, toPointView } from '../report-map/map-point-view';
import { RequestsMapComponent } from './requests-map.component';

const view = (index: number, overrides: Partial<MapPoint> = {}): MapPointView =>
  toPointView(
    {
      requestId: `req-${index}`,
      folio: `BD-2026-${String(index).padStart(6, '0')}`,
      latitude: -37.93,
      longitude: -71.31,
      status: 'INGRESADO',
      procedureType: 'bache',
      procedureLabel: 'Bache en calle',
      sector: 'ralco',
      ...overrides,
    },
    undefined,
  );

describe('RequestsMapComponent', () => {
  let fixture: ComponentFixture<RequestsMapComponent>;

  const host = () => fixture.nativeElement as HTMLElement;
  const markers = () => host().querySelectorAll('.map-marker');
  const clusters = () => host().querySelectorAll('.map-cluster');
  const setPoints = async (points: MapPointView[]) => {
    fixture.componentRef.setInput('points', points);
    await fixture.whenStable();
  };

  // jsdom no calcula layout: sin tamaño, markercluster no dibuja nada fuera del área visible
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(480);
  });

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(RequestsMapComponent);
    fixture.componentRef.setInput('fitKey', 'last7d||');
    fixture.componentRef.setInput('points', []);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
  });

  it('agrupa los trámites con la misma coordenada en un grupo que anuncia cuántos son', async () => {
    await setPoints([view(1), view(2), view(3)]);

    expect(clusters()).toHaveLength(1);
    expect(clusters()[0].textContent).toContain('3 trámites agrupados. Acercar');
    expect(clusters()[0].getAttribute('role')).toBe('button');
    expect(clusters()[0].getAttribute('tabindex')).toBe('0');
  });

  it('un punto aislado es un botón con folio, tipo y estado', async () => {
    await setPoints([view(1, { latitude: -37.9, longitude: -71.28, status: 'RESUELTO' })]);

    expect(markers()).toHaveLength(1);
    expect(markers()[0].getAttribute('role')).toBe('button');
    expect(markers()[0].textContent).toBe('BD-2026-000001, Bache en calle, Resuelto');
    expect(markers()[0].querySelector('.map-symbol--resolved')).not.toBeNull();
  });

  it('una actualización cambia el marcador que cambió y quita los que ya no vienen', async () => {
    const far = { latitude: -37.9, longitude: -71.28 };
    await setPoints([view(1, far), view(2, { latitude: -37.96, longitude: -71.35 })]);
    expect(markers()).toHaveLength(2);
    const kept = Array.from(markers()).find((marker) =>
      marker.textContent?.startsWith('BD-2026-000001'),
    );

    await setPoints([view(1, { ...far, status: 'EN_TERRENO' })]);

    expect(markers()).toHaveLength(1);
    expect(markers()[0]).toBe(kept);
    expect(markers()[0].textContent).toContain('En terreno');
    expect(markers()[0].querySelector('.map-symbol--field')).not.toBeNull();
  });

  it('ofrece «Ver todos» solo cuando hay puntos y atenúa los puntos mientras carga', async () => {
    expect(host().querySelector('.requests-map__fit')).toBeNull();

    await setPoints([view(1)]);
    fixture.componentRef.setInput('busy', true);
    await fixture.whenStable();

    expect(host().querySelector('.requests-map__fit')?.textContent).toContain('Ver todos');
    expect(host().querySelector('.bd-map--busy')?.getAttribute('aria-busy')).toBe('true');
    expect(host().querySelector('mat-progress-bar')).not.toBeNull();
  });

  it('nombra los controles de zoom en español', () => {
    expect(host().querySelector('.leaflet-control-zoom-in')?.getAttribute('title')).toBe('Acercar');
    expect(host().querySelector('.leaflet-control-zoom-out')?.getAttribute('title')).toBe('Alejar');
  });
});
