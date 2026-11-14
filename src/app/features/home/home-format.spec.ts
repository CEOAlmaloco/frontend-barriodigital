import { eventMoment } from './home-format';

describe('home-format', () => {
  // 13 nov 2026, 15:00 en Chile (UTC−3)
  const now = new Date('2026-11-13T18:00:00Z');

  it('un evento de hoy muestra solo la hora y uno anterior lleva su fecha', () => {
    expect(eventMoment('2026-11-13T14:05:09Z', now)).toBe('11:05');
    expect(eventMoment('2026-11-12T20:41:00Z', now)).toBe('12/11/2026 17:41');
    expect(eventMoment('sin fecha', now)).toBe('');
  });
});
