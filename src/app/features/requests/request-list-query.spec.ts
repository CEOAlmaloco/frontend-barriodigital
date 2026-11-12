import {
  DEFAULT_REQUEST_QUERY,
  activeFilterCount,
  parseDateKey,
  parseRequestListParams,
  sameRequestListQuery,
  toRequestListParams,
} from './request-list-query';

const fromRecord = (params: Record<string, string>) => (key: string) => params[key] ?? null;

describe('request-list-query', () => {
  it('omite los valores por omisión: la vista inicial no lleva parámetros', () => {
    expect(toRequestListParams(DEFAULT_REQUEST_QUERY)).toEqual({});
  });

  it('serializa búsqueda, filtros, orden y página con los nombres del GET de EP3-30', () => {
    expect(
      toRequestListParams({
        ...DEFAULT_REQUEST_QUERY,
        q: '  BD-2026-000123 ',
        status: 'EN_GESTION',
        procedureType: 'alumbrado',
        sector: 'villa-ralco',
        from: '2026-11-01',
        to: '2026-11-12',
        sort: 'folio',
        direction: 'asc',
        page: 2,
        size: 50,
      }),
    ).toEqual({
      q: 'BD-2026-000123',
      status: 'EN_GESTION',
      procedureType: 'alumbrado',
      sector: 'villa-ralco',
      from: '2026-11-01',
      to: '2026-11-12',
      sort: 'folio,asc',
      page: '2',
      size: '50',
    });
  });

  it('lee la URL y vuelve a serializarla igual', () => {
    const params = {
      q: 'luminaria',
      status: 'RESUELTO',
      sector: 'ralco',
      from: '2026-10-01',
      sort: 'status,desc',
      page: '3',
      size: '10',
    };
    expect(toRequestListParams(parseRequestListParams(fromRecord(params)))).toEqual(params);
  });

  it('un orden sin dirección es ascendente, como en el backend', () => {
    expect(parseRequestListParams(fromRecord({ sort: 'folio' }))).toMatchObject({
      sort: 'folio',
      direction: 'asc',
    });
  });

  it.each([
    ['status', 'ARCHIVADO'],
    ['sector', 'santiago'],
    ['procedureType', 'tipo con espacios'],
    ['sort', 'solicitante,asc'],
    ['sort', 'folio,arriba'],
    ['page', '-1'],
    ['page', '1.5'],
    ['size', '500'],
    ['from', '2026-02-31'],
    ['from', '1990-01-01'],
    ['to', 'ayer'],
  ])('descarta %s=%s manipulado en la URL', (key, value) => {
    expect(parseRequestListParams(fromRecord({ [key]: value }))).toEqual(DEFAULT_REQUEST_QUERY);
  });

  it('descarta un Hasta anterior al Desde y recorta la búsqueda a 100 caracteres', () => {
    const query = parseRequestListParams(
      fromRecord({ from: '2026-11-10', to: '2026-11-01', q: 'x'.repeat(140) }),
    );
    expect(query.from).toBe('2026-11-10');
    expect(query.to).toBe('');
    expect(query.q).toHaveLength(100);
  });

  it('cuenta solo los filtros, no la búsqueda ni el orden', () => {
    expect(
      activeFilterCount({
        ...DEFAULT_REQUEST_QUERY,
        q: 'bache',
        status: 'INGRESADO',
        from: '2026-11-01',
        sort: 'folio',
      }),
    ).toBe(2);
  });

  it('compara consultas por su forma en la URL', () => {
    expect(
      sameRequestListQuery(DEFAULT_REQUEST_QUERY, { ...DEFAULT_REQUEST_QUERY, q: '   ' }),
    ).toBe(true);
    expect(sameRequestListQuery(DEFAULT_REQUEST_QUERY, { ...DEFAULT_REQUEST_QUERY, page: 1 })).toBe(
      false,
    );
  });

  it('parseDateKey usa el día civil local y rechaza fechas imposibles', () => {
    expect(parseDateKey('2026-12-31')).toEqual(new Date(2026, 11, 31));
    expect(parseDateKey('2026-13-01')).toBeNull();
    expect(parseDateKey('')).toBeNull();
  });
});
