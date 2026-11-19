import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { DuplicateCandidate, DuplicateSearch } from '../../../shared/models/request.model';
import { RequestsService } from '../requests.service';
import {
  DUPLICATE_SEARCH_DELAY_MS,
  RequestDuplicateWarningComponent,
  duplicateSearch,
} from './request-duplicate-warning.component';

const INSIDE = { latitude: -37.8742, longitude: -71.5915 };

const candidate = (overrides: Partial<DuplicateCandidate> = {}): DuplicateCandidate => ({
  id: null,
  folio: 'BD-2026-000123',
  procedureType: 'bache',
  procedureLabel: 'Bache en calle',
  status: 'EN_GESTION',
  sector: 'ralco',
  distanceMeters: 40,
  createdDate: '2026-11-11',
  hasAssignee: null,
  mine: false,
  ...overrides,
});

describe('duplicateSearch', () => {
  it('sin tipo no hay consulta', () => {
    expect(duplicateSearch('', { sector: 'ralco', ...INSIDE })).toBeNull();
    expect(duplicateSearch(null, { sector: 'ralco' })).toBeNull();
  });

  it('necesita un punto dentro de la comuna o un sector comparable', () => {
    expect(duplicateSearch('bache', {})).toBeNull();
    expect(duplicateSearch('bache', { sector: '' })).toBeNull();
    expect(duplicateSearch('bache', { sector: 'otro' })).toBeNull();
    expect(duplicateSearch('bache', { latitude: -33.45, longitude: -70.66 })).toBeNull();
    expect(duplicateSearch('bache', { latitude: -37.87, longitude: null })).toBeNull();
  });

  it('envía el punto redondeado y omite el sector no comparable', () => {
    expect(
      duplicateSearch('bache', { sector: 'otro', latitude: -37.87421234, longitude: -71.5915 }),
    ).toEqual({ procedureType: 'bache', latitude: -37.874212, longitude: -71.5915 });
  });

  it('con punto y sector envía ambos; con un punto fuera de la comuna, solo el sector', () => {
    expect(duplicateSearch('bache', { sector: 'ralco', ...INSIDE })).toEqual({
      procedureType: 'bache',
      ...INSIDE,
      sector: 'ralco',
    });
    expect(
      duplicateSearch('bache', { sector: 'ralco', latitude: -33.45, longitude: -70.66 }),
    ).toEqual({ procedureType: 'bache', sector: 'ralco' });
  });
});

describe('RequestDuplicateWarningComponent', () => {
  let fixture: ComponentFixture<RequestDuplicateWarningComponent>;
  let element: HTMLElement;
  let findDuplicates: ReturnType<typeof vi.fn>;

  const search: DuplicateSearch = { procedureType: 'bache', sector: 'ralco' };
  const text = () => element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const live = () => element.querySelector('[aria-live="polite"]')?.textContent?.trim();

  const render = (response: () => Observable<DuplicateCandidate[]>) => {
    findDuplicates = vi.fn(response);
    TestBed.configureTestingModule({
      imports: [RequestDuplicateWarningComponent],
      providers: [{ provide: RequestsService, useValue: { findDuplicates } }, provideRouter([])],
    });
    fixture = TestBed.createComponent(RequestDuplicateWarningComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  };

  const setSearch = async (value: DuplicateSearch | null) => {
    fixture.componentRef.setInput('search', value);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
  };

  const elapse = async (ms = DUPLICATE_SEARCH_DELAY_MS) => {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  };

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sin base de búsqueda no consulta ni muestra nada', async () => {
    render(() => of([]));
    await setSearch(null);
    await elapse();

    expect(findDuplicates).not.toHaveBeenCalled();
    expect(text()).toBe('');
  });

  it('espera a que el vecino deje de cambiar la ubicación y consulta una sola vez', async () => {
    render(() => of([candidate()]));
    await setSearch({ procedureType: 'bache', sector: 'pitril' });
    expect(text()).toContain('Buscando trámites parecidos');

    await elapse(DUPLICATE_SEARCH_DELAY_MS - 100);
    await setSearch(search);
    await elapse(DUPLICATE_SEARCH_DELAY_MS - 100);
    expect(findDuplicates).not.toHaveBeenCalled();

    await elapse(100);
    expect(findDuplicates).toHaveBeenCalledOnce();
    expect(findDuplicates).toHaveBeenCalledWith(search);
  });

  it('una búsqueda igual no se repite', async () => {
    render(() => of([]));
    await setSearch(search);
    await elapse();
    await setSearch({ ...search });
    await elapse();

    expect(findDuplicates).toHaveBeenCalledOnce();
  });

  it('un cambio cancela la respuesta pendiente y retira el aviso anterior', async () => {
    const first = new Subject<DuplicateCandidate[]>();
    let calls = 0;
    render(() => (calls++ === 0 ? first : of([candidate({ folio: 'BD-2026-000200' })])));
    await setSearch(search);
    await elapse();

    await setSearch({ ...search, sector: 'pitril' });
    first.next([candidate()]);
    fixture.detectChanges();
    expect(text()).not.toContain('BD-2026-000123');

    await elapse();
    expect(text()).toContain('BD-2026-000200');
    expect(first.observed).toBe(false);
  });

  it('con varios resultados usa plural y anuncia solo el resumen', async () => {
    render(() => of([candidate(), candidate({ folio: 'BD-2026-000098', distanceMeters: 120 })]));
    await setSearch(search);
    await elapse();

    expect(element.querySelector('h3')?.textContent?.trim()).toBe(
      'Hay 2 trámites abiertos que podrían estar relacionados',
    );
    expect(text()).toContain('Revisa si alguno corresponde al mismo problema.');
    expect(live()).toBe('Hay 2 trámites abiertos que podrían estar relacionados.');
    expect(element.querySelector('section')?.getAttribute('aria-labelledby')).toBe(
      element.querySelector('h3')?.id,
    );
  });

  it('con uno solo usa singular y no afirma que sea el mismo problema', async () => {
    render(() => of([candidate()]));
    await setSearch(search);
    await elapse();

    expect(element.querySelector('h3')?.textContent?.trim()).toBe(
      'Hay 1 trámite abierto que podría estar relacionado',
    );
    expect(text()).toContain('Revisa si corresponde al mismo problema.');
    expect(text()).not.toMatch(/ya lo est[áa] atendiendo/i);
  });

  it('sin coincidencias no muestra nada', async () => {
    render(() => of([]));
    await setSearch(search);
    await elapse();

    expect(element.querySelector('section')).toBeNull();
    expect(text()).toBe('');
  });

  it('si falla lo dice sin bloquear y Reintentar vuelve a consultar', async () => {
    let calls = 0;
    render(() => (calls++ === 0 ? throwError(() => new Error('sin red')) : of([candidate()])));
    await setSearch(search);
    await elapse();

    expect(text()).toContain('No se pudo revisar si hay trámites parecidos.');
    expect(text()).toContain('Puedes ingresar el tuyo igual.');
    expect(live()).toBe('No se pudo revisar si hay trámites parecidos.');

    [...element.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Reintentar'))!
      .click();
    fixture.detectChanges();
    await elapse();

    expect(findDuplicates).toHaveBeenCalledTimes(2);
    expect(element.querySelector('h3')).not.toBeNull();
  });

  it('un 403 oculta el aviso sin mensaje', async () => {
    render(() => throwError(() => new HttpErrorResponse({ status: 403 })));
    await setSearch(search);
    await elapse();

    expect(text()).toBe('');
  });
});
