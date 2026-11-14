import { businessDaysLabel, dueDateLabel, slaDue } from './sla-format';

describe('sla-format', () => {
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

  it('en un abierto avisa el vencimiento con el tono de su urgencia', () => {
    expect(slaDue('VENCIDO', '2026-11-10', now)).toEqual({
      text: 'Venció el 10 nov',
      tone: 'late',
    });
    expect(slaDue('POR_VENCER', '2026-11-14', now)).toEqual({ text: 'Vence mañana', tone: 'soon' });
    expect(slaDue('DENTRO_DE_PLAZO', '2026-11-24', now)).toEqual({
      text: 'Vence el 24 nov',
      tone: 'neutral',
    });
  });

  it('en un cerrado evaluado muestra la fecha comprometida, y nada sin evaluación', () => {
    expect(slaDue('CUMPLIDO', '2026-11-06', now)).toEqual({
      text: 'Plazo al 6 nov',
      tone: 'neutral',
    });
    expect(slaDue('FUERA_DE_PLAZO', '2025-12-30', now)?.text).toBe('Plazo al 30 dic 2025');
    expect(slaDue('NO_APLICA', '2026-11-06', now)).toBeNull();
    expect(slaDue('SIN_PLAZO', null, now)).toBeNull();
    expect(slaDue(null, null, now)).toBeNull();
  });

  it('pluraliza los días hábiles', () => {
    expect(businessDaysLabel(1)).toBe('1 día hábil');
    expect(businessDaysLabel(10)).toBe('10 días hábiles');
  });
});
