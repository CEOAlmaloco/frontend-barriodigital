import { bucketLabels, formatPercent, plural } from './report-format';

describe('report-format', () => {
  it('etiqueta las horas en hora de Chile', () => {
    const labels = bucketLabels({
      bucket: 'HOUR',
      points: [
        { bucketStart: '2026-11-13T16:00:00Z', count: 1 },
        { bucketStart: '2026-11-13T17:00:00Z', count: 2 },
      ],
    });
    expect(labels).toEqual([
      { axis: '13:00', full: '13 nov, 13:00' },
      { axis: '14:00', full: '13 nov, 14:00' },
    ]);
  });

  it('agrega el desplazamiento UTC solo a la hora que se repite al cambiar el horario', () => {
    // El 4 de abril de 2026 a las 24:00 Chile vuelve a las 23:00: la hora 23 ocurre dos veces.
    const labels = bucketLabels({
      bucket: 'HOUR',
      points: [
        { bucketStart: '2026-04-05T01:00:00Z', count: 0 },
        { bucketStart: '2026-04-05T02:00:00Z', count: 0 },
        { bucketStart: '2026-04-05T03:00:00Z', count: 0 },
        { bucketStart: '2026-04-05T04:00:00Z', count: 0 },
      ],
    }).map((label) => label.full);
    expect(labels).toEqual([
      '4 abr, 22:00',
      '4 abr, 23:00 (UTC−3)',
      '4 abr, 23:00 (UTC−4)',
      '5 abr, 00:00',
    ]);
  });

  it('etiqueta los días con el día de la semana', () => {
    const [label] = bucketLabels({
      bucket: 'DAY',
      points: [{ bucketStart: '2026-11-13T03:00:00Z', count: 4 }],
    });
    expect(label).toEqual({ axis: 'vie 13', full: 'vie 13 nov' });
  });

  it('formatea porcentajes y plurales en español de Chile', () => {
    // El espacio antes del signo depende de la versión de ICU del navegador.
    expect(formatPercent(0.875)).toMatch(/^87,5\s?%$/);
    expect(plural(1, 'trámite', 'trámites')).toBe('1 trámite');
    expect(plural(1200, 'trámite', 'trámites')).toBe('1.200 trámites');
  });
});
