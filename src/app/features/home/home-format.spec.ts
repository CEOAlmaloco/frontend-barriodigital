import { dueDateLabel, eventMoment } from './home-format';

describe('home-format', () => {
  // 13 nov 2026, 15:00 en Chile (UTC−3)
  const now = new Date('2026-11-13T18:00:00Z');

  it.each([
    ['2026-11-13', 'Vence hoy'],
    ['2026-11-14', 'Vence mañana'],
    ['2026-11-17', 'Vence el 17 nov'],
    ['2026-11-12', 'Venció ayer'],
    ['2026-11-10', 'Venció el 10 nov'],
    ['2027-01-04', 'Vence el 4 ene 2027'],
  ])('dueDate %s se lee «%s»', (dueDate, label) => {
    expect(dueDateLabel(dueDate, now)).toBe(label);
  });

  it('el día de vencimiento se cuenta en Chile y no en UTC', () => {
    // 00:30 del 14 nov en UTC sigue siendo 13 nov en Chile
    expect(dueDateLabel('2026-11-13', new Date('2026-11-14T00:30:00Z'))).toBe('Vence hoy');
  });

  it('una fecha ausente o mal formada no inventa un vencimiento', () => {
    expect(dueDateLabel(null, now)).toBe('');
    expect(dueDateLabel('2026-02-31', now)).toBe('');
  });

  it('un evento de hoy muestra solo la hora y uno anterior lleva su fecha', () => {
    expect(eventMoment('2026-11-13T14:05:09Z', now)).toBe('11:05');
    expect(eventMoment('2026-11-12T20:41:00Z', now)).toBe('12/11/2026 17:41');
    expect(eventMoment('sin fecha', now)).toBe('');
  });
});
