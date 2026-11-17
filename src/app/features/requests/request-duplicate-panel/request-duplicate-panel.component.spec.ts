import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { DuplicateCandidate } from '../../../shared/models/request.model';
import { RequestsService } from '../requests.service';
import { RequestDuplicatePanelComponent } from './request-duplicate-panel.component';

const candidate = (overrides: Partial<DuplicateCandidate> = {}): DuplicateCandidate => ({
  id: 'req-2',
  folio: 'BD-2026-000151',
  procedureType: 'bache',
  procedureLabel: 'Bache en calle',
  status: 'EN_GESTION',
  sector: 'ralco',
  distanceMeters: 40,
  createdDate: '2026-11-11',
  hasAssignee: true,
  mine: null,
  ...overrides,
});

describe('RequestDuplicatePanelComponent', () => {
  let fixture: ComponentFixture<RequestDuplicatePanelComponent>;
  let element: HTMLElement;
  let findRequestDuplicates: ReturnType<typeof vi.fn>;

  const text = () => element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const live = () => element.querySelector('[aria-live="polite"]')?.textContent?.trim();
  const card = () => element.querySelector('section');
  const line = () => element.querySelector<HTMLElement>('.duplicate-panel__line');
  const retryButton = () =>
    [...element.querySelectorAll('button')].find((b) => b.textContent?.includes('Reintentar'));

  const render = async (
    response: (id: string) => Observable<DuplicateCandidate[]>,
    searchable = true,
  ) => {
    findRequestDuplicates = vi.fn(response);
    TestBed.configureTestingModule({
      imports: [RequestDuplicatePanelComponent],
      providers: [
        { provide: RequestsService, useValue: { findRequestDuplicates } },
        provideRouter([]),
      ],
    });
    fixture = TestBed.createComponent(RequestDuplicatePanelComponent);
    fixture.componentRef.setInput('requestId', 'req-1');
    fixture.componentRef.setInput('searchable', searchable);
    element = fixture.nativeElement;
    document.body.appendChild(element);
    await fixture.whenStable();
  };

  afterEach(() => element?.remove());

  it('con coincidencias es una tarjeta con título, contador y acceso a cada trámite', async () => {
    await render(() => of([candidate(), candidate({ id: 'req-3', folio: 'BD-2026-000163' })]));

    const title = card()?.querySelector('h2');
    expect(findRequestDuplicates).toHaveBeenCalledWith('req-1');
    expect(title?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Posibles duplicados (2)');
    expect(card()?.getAttribute('aria-labelledby')).toBe(title?.id);
    expect(card()?.classList).toContain('request-detail__card');
    expect(text()).toContain('Trámites abiertos del mismo tipo, cercanos o del mismo sector.');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/tramites/req-2');
    expect(line()).toBeNull();
    expect(live()).toBe('Hay 2 posibles duplicados.');
  });

  it('con uno solo anuncia en singular', async () => {
    await render(() => of([candidate()]));
    expect(live()).toBe('Hay 1 posible duplicado.');
  });

  it('mientras carga muestra una línea, sin tarjeta', async () => {
    const pending = new Subject<DuplicateCandidate[]>();
    await render(() => pending);

    expect(card()).toBeNull();
    expect(line()?.textContent).toContain('Buscando posibles duplicados…');
  });

  it('sin coincidencias confirma la búsqueda en una línea, sin tarjeta ni anuncio', async () => {
    await render(() => of([]));

    expect(card()).toBeNull();
    expect(line()?.textContent).toContain('No se encontraron trámites abiertos parecidos.');
    expect(line()?.classList).not.toContain('duplicate-panel__line--error');
    expect(live()).toBe('');
  });

  it('sin base para comparar lo dice y no consulta', async () => {
    await render(() => of([]), false);

    expect(findRequestDuplicates).not.toHaveBeenCalled();
    expect(line()?.textContent).toContain(
      'Sin punto en el mapa ni sector específico para buscar posibles duplicados.',
    );
  });

  it('si falla lo distingue del vacío y Reintentar vuelve a consultar sin perder el foco', async () => {
    let calls = 0;
    const second = new Subject<DuplicateCandidate[]>();
    await render(() => (calls++ === 0 ? throwError(() => new Error('sin red')) : second));

    expect(line()?.classList).toContain('duplicate-panel__line--error');
    expect(text()).toContain('No se pudo buscar posibles duplicados.');
    expect(live()).toBe('No se pudo buscar posibles duplicados.');

    const errorLine = line();
    retryButton()!.click();
    await fixture.whenStable();
    expect(findRequestDuplicates).toHaveBeenCalledTimes(2);
    expect(line()).toBe(errorLine);
    expect(document.activeElement).toBe(errorLine);
    expect(text()).toContain('Buscando posibles duplicados…');

    second.next([candidate()]);
    await fixture.whenStable();
    expect(document.activeElement).toBe(card()?.querySelector('h2'));
  });

  it.each([403, 404])('un %s oculta el panel', async (status) => {
    await render(() => throwError(() => new HttpErrorResponse({ status })));

    expect(element.classList).toContain('duplicate-panel--hidden');
    expect(text()).toBe('');
  });

  it('al cambiar de trámite descarta la respuesta pendiente y consulta el nuevo', async () => {
    const first = new Subject<DuplicateCandidate[]>();
    await render((id) => (id === 'req-1' ? first : of([candidate({ folio: 'BD-2026-000200' })])));

    fixture.componentRef.setInput('requestId', 'req-9');
    await fixture.whenStable();
    first.next([candidate()]);
    await fixture.whenStable();

    expect(first.observed).toBe(false);
    expect(findRequestDuplicates).toHaveBeenLastCalledWith('req-9');
    expect(text()).toContain('BD-2026-000200');
    expect(text()).not.toContain('BD-2026-000151');
  });
});
