import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SlaStatus } from '../../../shared/models/report.model';
import { SlaIndicatorComponent, SlaIndicatorState } from './sla-indicator.component';

describe('SlaIndicatorComponent', () => {
  let fixture: ComponentFixture<SlaIndicatorComponent>;
  const now = new Date('2026-11-13T18:00:00Z');

  const render = async (
    inputs: { state?: SlaIndicatorState; status?: SlaStatus | null; dueDate?: string | null } = {},
  ) => {
    fixture = TestBed.createComponent(SlaIndicatorComponent);
    fixture.componentRef.setInput('now', now);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    await fixture.whenStable();
    const copy = (fixture.nativeElement as HTMLElement).cloneNode(true) as HTMLElement;
    copy.querySelectorAll('mat-icon').forEach((icon) => icon.remove());
    return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
  };

  it('un abierto muestra el estado y el vencimiento con el tono de su urgencia', async () => {
    expect(await render({ status: 'VENCIDO', dueDate: '2026-11-10' })).toBe(
      'Vencido Venció el 10 nov',
    );
    expect(fixture.nativeElement.querySelector('.sla-indicator__due--late')).not.toBeNull();
    expect(await render({ status: 'POR_VENCER', dueDate: '2026-11-14' })).toBe(
      'Por vencer Vence mañana',
    );
    expect(fixture.nativeElement.querySelector('.sla-indicator__due--soon')).not.toBeNull();
  });

  it('un cerrado evaluado muestra la fecha comprometida', async () => {
    expect(await render({ status: 'FUERA_DE_PLAZO', dueDate: '2026-11-06' })).toBe(
      'Fuera de plazo Plazo al 6 nov',
    );
  });

  it('"Sin plazo" es texto neutro y "No aplica" va sin ícono ni fecha', async () => {
    expect(await render({ status: 'SIN_PLAZO' })).toBe('Sin plazo');
    expect(fixture.nativeElement.querySelector('.sla--plain')).not.toBeNull();
    expect(await render({ status: 'NO_APLICA', dueDate: '2026-11-06' })).toBe('No aplica');
    expect(fixture.nativeElement.querySelector('mat-icon')).toBeNull();
  });

  it('sin información de report muestra "—" con nombre accesible, distinto de "Sin plazo"', async () => {
    expect(await render({ status: null })).toBe('—');
    expect(fixture.nativeElement.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(
      'Sin información de plazo',
    );
  });

  it('carga con silueta oculta y un texto para el lector de pantalla', async () => {
    expect(await render({ state: 'loading' })).toBe('Cargando el estado del plazo');
    expect(
      fixture.nativeElement.querySelector('.sla-indicator__bone')?.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('report no disponible se distingue de un trámite sin plazo', async () => {
    expect(await render({ state: 'unavailable' })).toBe('No disponible');
  });
});
