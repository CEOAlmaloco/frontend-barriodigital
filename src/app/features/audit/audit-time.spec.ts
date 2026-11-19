import {
  chileDateKey,
  chileDateTime,
  chileDayEnd,
  chileDayStart,
  isDateKey,
  shiftDateKey,
} from './audit-time';

describe('audit-time', () => {
  it('calcula el inicio del día en Chile con horario de verano y de invierno', () => {
    expect(chileDayStart('2026-11-13').toISOString()).toBe('2026-11-13T03:00:00.000Z');
    expect(chileDayStart('2026-07-01').toISOString()).toBe('2026-07-01T04:00:00.000Z');
  });

  it('el día en que empieza el horario de verano parte a la 01:00, porque la medianoche no existe', () => {
    expect(chileDayStart('2026-09-06').toISOString()).toBe('2026-09-06T04:00:00.000Z');
    expect(chileDateKey(new Date('2026-09-06T03:59:59.999Z'))).toBe('2026-09-05');
  });

  it('el día en que termina el horario de verano empieza después de la hora repetida del sábado', () => {
    expect(chileDayStart('2026-04-05').toISOString()).toBe('2026-04-05T04:00:00.000Z');
    expect(chileDayEnd('2026-04-04').toISOString()).toBe('2026-04-05T03:59:59.999Z');
  });

  it('el fin del día es inclusivo y llega al último milisegundo', () => {
    expect(chileDayEnd('2026-11-13').toISOString()).toBe('2026-11-14T02:59:59.999Z');
  });

  it('obtiene el día civil de Chile aunque en UTC ya sea el siguiente', () => {
    expect(chileDateKey(new Date('2026-11-14T02:30:00Z'))).toBe('2026-11-13');
  });

  it('suma días cruzando meses y años', () => {
    expect(shiftDateKey('2026-11-13', -6)).toBe('2026-11-07');
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('valida días civiles y rechaza fechas imposibles', () => {
    expect(isDateKey('2026-11-13')).toBe(true);
    expect(isDateKey('2026-02-31')).toBe(false);
    expect(isDateKey('13-11-2026')).toBe(false);
    expect(isDateKey(null)).toBe(false);
  });

  it('formatea fecha y hora en Chile, y rechaza un instante inválido', () => {
    expect(chileDateTime('2026-11-13T19:42:08Z')).toEqual({ date: '13/11/2026', time: '16:42:08' });
    expect(chileDateTime('no es fecha')).toBeNull();
  });
});
