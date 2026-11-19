import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DuplicateCandidate } from '../../../shared/models/request.model';
import {
  RequestDuplicateListComponent,
  duplicateDate,
  duplicateProximity,
} from './request-duplicate-list.component';

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

const many = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    candidate({ folio: `BD-2026-00010${index}`, distanceMeters: (index + 1) * 20 }),
  );

describe('duplicateProximity', () => {
  it.each([
    [0, 'a menos de 10 m'],
    [40, 'a 40 m'],
    [990, 'a 990 m'],
    [1200, 'a 1,2 km'],
  ])('%s m se lee «%s»', (meters, expected) => {
    expect(duplicateProximity(candidate({ distanceMeters: meters }))).toBe(expected);
  });

  it('sin distancia coincidió por sector', () => {
    expect(duplicateProximity(candidate({ distanceMeters: null }))).toBe('en el sector Ralco');
    expect(duplicateProximity(candidate({ distanceMeters: null, sector: null }))).toBe(
      'en el mismo sector',
    );
  });
});

describe('duplicateDate', () => {
  it('formatea el día civil tal cual, sin correrlo de zona', () => {
    expect(duplicateDate('2026-11-01')).toBe('1 nov 2026');
    expect(duplicateDate('2026-03-31')).toBe('31 mar 2026');
  });
});

describe('RequestDuplicateListComponent', () => {
  let fixture: ComponentFixture<RequestDuplicateListComponent>;
  let element: HTMLElement;

  const items = () => element.querySelectorAll('li');
  const toggle = () => element.querySelector<HTMLButtonElement>('.duplicate-list__toggle');
  const render = (candidates: DuplicateCandidate[]) => {
    TestBed.configureTestingModule({
      imports: [RequestDuplicateListComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(RequestDuplicateListComponent);
    fixture.componentRef.setInput('candidates', candidates);
    element = fixture.nativeElement;
    fixture.detectChanges();
  };

  it('muestra tipo, estado, folio, cercanía y fecha, sin enlace en un trámite ajeno', () => {
    render([candidate()]);
    const text = items()[0].textContent?.replace(/\s+/g, ' ') ?? '';

    expect(text).toContain('Bache en calle');
    expect(items()[0].querySelector('app-request-status-badge')?.textContent).toContain(
      'En gestión',
    );
    expect(text).toContain('BD-2026-000123');
    expect(text).toContain('a 40 m');
    expect(text).toContain('Ingresado el 11 nov 2026');
    expect(element.querySelector('a')).toBeNull();
    expect(text).not.toContain('Tuyo');
  });

  it('sin nombre guardado del tipo usa el código', () => {
    render([candidate({ procedureLabel: null })]);
    expect(items()[0].textContent).toContain('bache');
  });

  it('el propio se marca y se abre en otra pestaña filtrado por folio, sin tocar el formulario', () => {
    render([candidate({ mine: true })]);
    const link = element.querySelector<HTMLAnchorElement>('a')!;

    expect(items()[0].textContent).toContain('Tuyo');
    expect(link.getAttribute('href')).toBe('/tramites?q=BD-2026-000123');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener');
    expect(link.textContent).toContain('(se abre en otra pestaña)');
  });

  it('al personal le muestra si tiene responsable y abre el detalle en la misma pestaña', () => {
    render([
      candidate({ id: 'req-2', hasAssignee: false, mine: null }),
      candidate({ id: 'req-3', folio: 'BD-2026-000124', hasAssignee: true, mine: null }),
    ]);
    const link = items()[0].querySelector<HTMLAnchorElement>('a')!;

    expect(items()[0].textContent).toContain('Sin responsable');
    expect(items()[1].textContent).toContain('Con responsable');
    expect(link.getAttribute('href')).toBe('/tramites/req-2');
    expect(link.target).toBe('');
    expect(link.textContent?.replace(/\s+/g, ' ')).toContain('Ver trámite BD-2026-000123');
    expect(items()[0].textContent).not.toContain('Tuyo');
  });

  it('al Vecino no le muestra el responsable', () => {
    render([candidate()]);
    expect(items()[0].textContent).not.toMatch(/responsable/);
  });

  it('hasta 3 se muestran todos y no hay botón para desplegar', () => {
    render(many(3));
    expect(items()).toHaveLength(3);
    expect(toggle()).toBeNull();
  });

  it('con más de 3 parte con 2 y se despliega con un botón que informa su estado', () => {
    render(many(5));
    const list = element.querySelector('ul')!;

    expect(items()).toHaveLength(2);
    expect(toggle()?.textContent).toContain('Ver 3 más');
    expect(toggle()?.getAttribute('aria-expanded')).toBe('false');
    expect(toggle()?.getAttribute('aria-controls')).toBe(list.id);

    toggle()!.click();
    fixture.detectChanges();
    expect(items()).toHaveLength(5);
    expect(toggle()?.textContent).toContain('Ver menos');
    expect(toggle()?.getAttribute('aria-expanded')).toBe('true');

    toggle()!.click();
    fixture.detectChanges();
    expect(items()).toHaveLength(2);
  });

  it('una lista nueva vuelve a partir plegada', () => {
    render(many(4));
    toggle()!.click();
    fixture.detectChanges();

    fixture.componentRef.setInput('candidates', many(5));
    fixture.detectChanges();
    expect(items()).toHaveLength(2);
    expect(toggle()?.textContent).toContain('Ver 3 más');
  });
});
