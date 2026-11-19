import {
  DEFAULT_EVENTS_QUERY,
  activeEventsFilterCount,
  normalizeFolio,
  paramsKey,
  parseEventsParams,
  parseTimelineParams,
  readView,
  toEventsApiParams,
  toEventsUrlParams,
  toTimelineApiParams,
  toTimelineUrlParams,
} from './audit-query';

const getter = (params: Record<string, string>) => (key: string) => params[key] ?? null;

describe('audit-query', () => {
  const now = new Date('2026-11-13T19:00:00Z');

  describe('búsqueda de eventos', () => {
    it('sin parámetros abre con los últimos 7 días, que no se escriben en la URL', () => {
      const query = parseEventsParams(getter({}));
      expect(query).toEqual(DEFAULT_EVENTS_QUERY);
      expect(toEventsUrlParams(query)).toEqual({});
      expect(activeEventsFilterCount(query)).toBe(1);
    });

    it('el período reciente parte al inicio del día en Chile, seis días antes de hoy', () => {
      const params = toEventsApiParams(DEFAULT_EVENTS_QUERY, now);
      expect(params['from']).toBe('2026-11-07T03:00:00.000Z');
      expect(params['to']).toBeUndefined();
      expect(params['page']).toBe('0');
      expect(params['size']).toBe('20');
    });

    it('quitar el período deja period=all, para que al recargar no vuelva', () => {
      const query = { ...DEFAULT_EVENTS_QUERY, period: 'all' as const };
      expect(toEventsUrlParams(query)).toEqual({ period: 'all' });
      expect(parseEventsParams(getter({ period: 'all' })).period).toBe('all');
      expect(toEventsApiParams(query, now)['from']).toBeUndefined();
      expect(activeEventsFilterCount(query)).toBe(0);
    });

    it('un rango de fechas reemplaza al período y se envía en hora de Chile con el fin inclusivo', () => {
      const query = parseEventsParams(
        getter({ from: '2026-11-01', to: '2026-11-10', period: 'all' }),
      );
      expect(query.period).toBe('custom');
      expect(toEventsUrlParams(query)).toEqual({ from: '2026-11-01', to: '2026-11-10' });
      const params = toEventsApiParams(query, now);
      expect(params['from']).toBe('2026-11-01T03:00:00.000Z');
      expect(params['to']).toBe('2026-11-11T02:59:59.999Z');
    });

    it('descarta valores manipulados en la URL en vez de provocar un 400', () => {
      const query = parseEventsParams(
        getter({
          from: '2026-02-31',
          to: '2026-11-10',
          actorRole: 'Superusuario',
          resourceType: 'tabla',
          actorId: 'a b; drop',
          page: '-3',
          size: '500',
        }),
      );
      expect(query.from).toBe('');
      expect(query.to).toBe('2026-11-10');
      expect(query.actorRole).toBe('');
      expect(query.resourceType).toBe('');
      expect(query.actorId).toBe('');
      expect(query.page).toBe(0);
      expect(query.size).toBe(20);
    });

    it('ignora un "hasta" anterior a "desde"', () => {
      const query = parseEventsParams(getter({ from: '2026-11-10', to: '2026-11-01' }));
      expect(query.from).toBe('2026-11-10');
      expect(query.to).toBe('');
    });

    it('acepta varios tipos de evento sin repetir y solo los del recurso elegido', () => {
      const query = parseEventsParams(
        getter({
          resourceType: 'queue',
          eventType: 'queue.purged,queue.purged,request.created,queue.deleted,otro',
        }),
      );
      expect(query.eventTypes).toEqual(['queue.purged', 'queue.deleted']);
      expect(toEventsApiParams(query, now)['eventType']).toBe('queue.purged,queue.deleted');
    });

    it('cuenta cada filtro activo una vez', () => {
      const query = parseEventsParams(
        getter({
          actorId: 'a1f0c2d4-0000-4000-8000-000000000001',
          actorRole: 'Admin',
          resourceType: 'request',
          eventType: 'request.created,request.assigned',
        }),
      );
      expect(activeEventsFilterCount(query)).toBe(5);
    });
  });

  describe('timeline', () => {
    it('normaliza el folio a mayúsculas y sin espacios', () => {
      expect(normalizeFolio('  bd-2026-000412 ')).toBe('BD-2026-000412');
      expect(parseTimelineParams(getter({ folio: 'bd-2026-000412' })).folio).toBe('BD-2026-000412');
    });

    it('usa el folio antes que el requestId, y nunca envía los dos', () => {
      const query = parseTimelineParams(
        getter({ folio: 'BD-2026-000412', requestId: '7b6e1d44-2a18-4c90-9f01-88aa11bb22cc' }),
      );
      expect(query.requestId).toBe('');
      expect(toTimelineApiParams(query)).toEqual({
        folio: 'BD-2026-000412',
        page: '0',
        size: '50',
      });
    });

    it('acepta un requestId para los trámites sin folio', () => {
      const query = parseTimelineParams(
        getter({ requestId: '7B6E1D44-2A18-4C90-9F01-88AA11BB22CC' }),
      );
      expect(query.requestId).toBe('7b6e1d44-2a18-4c90-9f01-88aa11bb22cc');
      expect(toTimelineUrlParams(query)).toEqual({ view: 'timeline', requestId: query.requestId });
    });

    it('descarta un folio con otro formato', () => {
      expect(parseTimelineParams(getter({ folio: 'BD-26-412' })).folio).toBe('');
    });

    it('lee el historial completo en páginas de 50 por omisión', () => {
      const query = parseTimelineParams(getter({ folio: 'BD-2026-000412', page: '2' }));
      expect(toTimelineUrlParams(query)).toEqual({
        view: 'timeline',
        folio: 'BD-2026-000412',
        page: '2',
      });
    });
  });

  it('distingue la vista y compara parámetros sin depender del orden', () => {
    expect(readView(getter({ view: 'timeline' }))).toBe('timeline');
    expect(readView(getter({ view: 'otra' }))).toBe('events');
    expect(paramsKey({ b: '2', a: '1' })).toBe(paramsKey({ a: '1', b: '2' }));
  });
});
