import { MapPointsQuery } from '../../../shared/models/report.model';
import { activeFilterCount, mapQueryKey, mapQueryParams, readMapQuery } from './report-map-query';

const read = (params: Record<string, string | null>) => readMapQuery((key) => params[key] ?? null);

describe('Filtros del mapa en la URL', () => {
  it('sin parámetros usa 7 días, todos los estados y todos los tipos, como report', () => {
    expect(read({})).toEqual({ range: 'last7d', status: [], procedureType: null });
  });

  it('ordena los estados según el flujo y descarta repetidos y desconocidos', () => {
    expect(read({ status: 'RESUELTO,INGRESADO,INGRESADO,ABIERTO,' }).status).toEqual([
      'INGRESADO',
      'RESUELTO',
    ]);
  });

  it.each(['Bache', 'bache en calle', 'a'.repeat(41), '../x'])(
    'descarta el tipo «%s», que report rechazaría con 400',
    (type) => {
      expect(read({ type }).procedureType).toBeNull();
    },
  );

  it('acepta un código con el formato del catálogo y corrige un período inválido', () => {
    expect(read({ range: 'last24h', type: 'agua-potable_2' })).toEqual({
      range: 'last24h',
      status: [],
      procedureType: 'agua-potable_2',
    });
    expect(read({ range: 'ayer' }).range).toBe('last7d');
  });

  it('no escribe los valores por defecto y vuelve a leer lo mismo que escribió', () => {
    const query: MapPointsQuery = {
      range: 'last24h',
      status: ['EN_TERRENO'],
      procedureType: 'bache',
    };

    expect(mapQueryParams(read({}))).toEqual({ range: null, status: null, type: null });
    expect(read(mapQueryParams(query))).toEqual(query);
  });

  it('dos consultas equivalentes tienen la misma clave; el período no cuenta como filtro activo', () => {
    expect(mapQueryKey(read({ status: 'RESUELTO,INGRESADO' }))).toBe(
      mapQueryKey(read({ status: 'INGRESADO,RESUELTO' })),
    );
    expect(activeFilterCount(read({}))).toBe(0);
    expect(activeFilterCount(read({ range: 'last24h' }))).toBe(0);
    expect(activeFilterCount(read({ status: 'ADMITIDO', type: 'bache' }))).toBe(2);
  });
});
