import { Params } from '@angular/router';

import {
  DEFAULT_MAP_RANGE,
  MapPointsQuery,
  isReportRange,
} from '../../../shared/models/report.model';
import { RequestStatus } from '../../../shared/models/request.model';
import { REQUEST_STATUSES } from '../../requests/requests.constants';

/** Mismo formato que valida report para `procedureType` (EP3-07, sección 3.8). */
const PROCEDURE_TYPE_PATTERN = /^[a-z0-9_-]{1,40}$/;

export const EMPTY_MAP_QUERY: MapPointsQuery = {
  range: DEFAULT_MAP_RANGE,
  status: [],
  procedureType: null,
};

/**
 * Filtros del mapa desde la URL. Un valor que report rechazaría con 400 se descarta en vez de enviarse, y los
 * estados quedan sin repetir y en el orden del flujo, así dos URL equivalentes piden lo mismo.
 */
export function readMapQuery(get: (key: string) => string | null): MapPointsQuery {
  const range = get('range');
  const statuses = new Set((get('status') ?? '').split(','));
  const type = get('type');
  return {
    range: isReportRange(range) ? range : DEFAULT_MAP_RANGE,
    status: REQUEST_STATUSES.filter((status) => statuses.has(status)),
    procedureType: type && PROCEDURE_TYPE_PATTERN.test(type) ? type : null,
  };
}

/** Parámetros de la URL; los valores por defecto no se escriben. */
export function mapQueryParams(query: MapPointsQuery): Params {
  return {
    range: query.range === DEFAULT_MAP_RANGE ? null : query.range,
    status: query.status.length ? query.status.join(',') : null,
    type: query.procedureType,
  };
}

/** Clave estable de una consulta, para saber si dos filtros piden lo mismo. */
export function mapQueryKey(query: MapPointsQuery): string {
  return [query.range, query.status.join(','), query.procedureType ?? ''].join('|');
}

export function activeFilterCount(query: MapPointsQuery): number {
  return (query.status.length ? 1 : 0) + (query.procedureType ? 1 : 0);
}

/** Estados en el orden del flujo, para que el filtro no dependa del orden en que se marcaron. */
export function sortStatuses(statuses: readonly RequestStatus[]): RequestStatus[] {
  return REQUEST_STATUSES.filter((status) => statuses.includes(status));
}
