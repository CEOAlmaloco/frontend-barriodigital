import { RequestStatus } from '../../shared/models/request.model';
import { MUNICIPALITY_SINCE, toDateKey } from './date-key';
import { COMMUNE_SECTORS } from './request-location';
import { REQUEST_STATUSES } from './requests.constants';

export type RequestSortField = 'createdAt' | 'status' | 'folio';
export type RequestSortDirection = 'asc' | 'desc';

/** Estado del listado. Es la misma forma para la URL de /tramites y para el GET del BFF (EP3-30). */
export interface RequestListQuery {
  q: string;
  status: RequestStatus | '';
  procedureType: string;
  sector: string;
  from: string;
  to: string;
  sort: RequestSortField;
  direction: RequestSortDirection;
  page: number;
  size: number;
}

export const REQUEST_PAGE_SIZES: readonly number[] = [10, 20, 50];
export const SEARCH_MAX_LENGTH = 100;
export const SEARCH_DEBOUNCE_MS = 350;

/** Coincide con los valores por omisión de requests, así un parámetro por omisión no se envía. */
export const DEFAULT_REQUEST_QUERY: RequestListQuery = {
  q: '',
  status: '',
  procedureType: '',
  sector: '',
  from: '',
  to: '',
  sort: 'createdAt',
  direction: 'desc',
  page: 0,
  size: 20,
};

export const REQUEST_SORT_OPTIONS: readonly {
  sort: RequestSortField;
  direction: RequestSortDirection;
  label: string;
}[] = [
  { sort: 'createdAt', direction: 'desc', label: 'Más recientes primero' },
  { sort: 'createdAt', direction: 'asc', label: 'Más antiguos primero' },
  { sort: 'folio', direction: 'desc', label: 'Folio, de mayor a menor' },
  { sort: 'folio', direction: 'asc', label: 'Folio, de menor a mayor' },
  { sort: 'status', direction: 'asc', label: 'Estado, según el avance' },
  { sort: 'status', direction: 'desc', label: 'Estado, cerrados primero' },
];

const SORT_FIELDS: readonly RequestSortField[] = ['createdAt', 'status', 'folio'];
const PROCEDURE_TYPE_PATTERN = /^[a-z0-9_-]{1,40}$/;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Solo los parámetros que difieren del valor por omisión, para una URL corta y un GET mínimo. */
export function toRequestListParams(query: RequestListQuery): Record<string, string> {
  const params: Record<string, string> = {};
  const q = query.q.trim();
  if (q) params['q'] = q;
  if (query.status) params['status'] = query.status;
  if (query.procedureType) params['procedureType'] = query.procedureType;
  if (query.sector) params['sector'] = query.sector;
  if (query.from) params['from'] = query.from;
  if (query.to) params['to'] = query.to;
  if (
    query.sort !== DEFAULT_REQUEST_QUERY.sort ||
    query.direction !== DEFAULT_REQUEST_QUERY.direction
  ) {
    params['sort'] = `${query.sort},${query.direction}`;
  }
  if (query.page > 0) params['page'] = String(query.page);
  if (query.size !== DEFAULT_REQUEST_QUERY.size) params['size'] = String(query.size);
  return params;
}

/**
 * Lee la URL sin confiar en ella: un valor inválido o manipulado vuelve al valor por omisión
 * en vez de terminar en un 400 del backend.
 */
export function parseRequestListParams(get: (key: string) => string | null): RequestListQuery {
  const query: RequestListQuery = { ...DEFAULT_REQUEST_QUERY };

  query.q = (get('q') ?? '').trim().slice(0, SEARCH_MAX_LENGTH);

  const status = get('status');
  if (status && (REQUEST_STATUSES as readonly string[]).includes(status)) {
    query.status = status as RequestStatus;
  }

  const procedureType = get('procedureType')?.toLowerCase();
  if (procedureType && PROCEDURE_TYPE_PATTERN.test(procedureType)) {
    query.procedureType = procedureType;
  }

  const sector = get('sector');
  if (sector && COMMUNE_SECTORS.some((item) => item.value === sector)) {
    query.sector = sector;
  }

  const from = parseDateKey(get('from'));
  if (from && from >= MUNICIPALITY_SINCE) {
    query.from = toDateKey(from);
  }
  const to = parseDateKey(get('to'));
  if (to && to >= (from && query.from ? from : MUNICIPALITY_SINCE)) {
    query.to = toDateKey(to);
  }

  const [sortField, sortDirection = 'asc'] = (get('sort') ?? '').split(',');
  if (
    (SORT_FIELDS as readonly string[]).includes(sortField) &&
    (sortDirection === 'asc' || sortDirection === 'desc')
  ) {
    query.sort = sortField as RequestSortField;
    query.direction = sortDirection;
  }

  const page = Number(get('page'));
  if (Number.isInteger(page) && page > 0) {
    query.page = page;
  }
  const size = Number(get('size'));
  if (REQUEST_PAGE_SIZES.includes(size)) {
    query.size = size;
  }

  return query;
}

export function sameRequestListQuery(a: RequestListQuery, b: RequestListQuery): boolean {
  return serializeRequestListQuery(a) === serializeRequestListQuery(b);
}

export function serializeRequestListQuery(query: RequestListQuery): string {
  return new URLSearchParams(Object.entries(toRequestListParams(query)).sort()).toString();
}

/** Filtros que el usuario eligió; la búsqueda, el orden y la página no cuentan. */
export function activeFilterCount(query: RequestListQuery): number {
  return [query.status, query.procedureType, query.sector, query.from, query.to].filter(Boolean)
    .length;
}

/** Día civil local; rechaza fechas imposibles como 2026-02-31. */
export function parseDateKey(value: string | null | undefined): Date | null {
  const match = value ? DATE_KEY_PATTERN.exec(value) : null;
  if (!match) {
    return null;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}
