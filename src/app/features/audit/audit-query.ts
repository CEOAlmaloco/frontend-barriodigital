import {
  AUDIT_EVENT_TYPES,
  AUDIT_RESOURCE_TYPES,
  AuditResourceType,
} from '../../shared/models/audit.model';
import { Role } from '../../shared/models/role';
import { chileDateKey, chileDayEnd, chileDayStart, isDateKey, shiftDateKey } from './audit-time';

export type AuditView = 'events' | 'timeline';

/**
 * `recent` son los últimos 7 días en curso, el período con que abre la búsqueda. Como es el valor por omisión
 * no va en la URL; quitarlo deja `period=all`, para que recargar no lo vuelva a aplicar.
 */
export type AuditPeriod = 'recent' | 'all' | 'custom';

export const RECENT_DAYS = 7;
export const AUDIT_PAGE_SIZES: readonly number[] = [10, 20, 50];
export const ACTOR_ROLES: readonly Role[] = [
  Role.Admin,
  Role.Funcionario,
  Role.Vecino,
  Role.Auditor,
];
export const FOLIO_PATTERN = /^BD-\d{4}-\d{6}$/;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** `oid` o `sub` del token: sin espacios y acotado, para no reenviar texto arbitrario desde la URL. */
const ACTOR_ID_PATTERN = /^[\w.@:-]{1,128}$/;

export interface AuditEventsQuery {
  period: AuditPeriod;
  /** Días civiles YYYY-MM-DD, solo con `period` custom. */
  from: string;
  to: string;
  actorId: string;
  actorRole: Role | '';
  resourceType: AuditResourceType | '';
  eventTypes: readonly string[];
  page: number;
  size: number;
}

export const DEFAULT_EVENTS_QUERY: AuditEventsQuery = {
  period: 'recent',
  from: '',
  to: '',
  actorId: '',
  actorRole: '',
  resourceType: '',
  eventTypes: [],
  page: 0,
  size: 20,
};

export interface AuditTimelineQuery {
  /** Uno solo de los dos: el detalle de un trámite sin folio enlaza por `requestId`. */
  folio: string;
  requestId: string;
  page: number;
  size: number;
}

/** El historial de un trámite se lee completo: por omisión, la página más grande que acepta audit. */
export const DEFAULT_TIMELINE_QUERY: AuditTimelineQuery = {
  folio: '',
  requestId: '',
  page: 0,
  size: 50,
};

type Getter = (key: string) => string | null;

export function readView(get: Getter): AuditView {
  return get('view') === 'timeline' ? 'timeline' : 'events';
}

export function eventTypesFor(resourceType: AuditResourceType | ''): readonly string[] {
  return resourceType ? AUDIT_EVENT_TYPES[resourceType] : Object.values(AUDIT_EVENT_TYPES).flat();
}

export function normalizeFolio(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Lee la URL sin confiar en ella: un valor inválido o manipulado vuelve al valor por omisión en vez de
 * terminar en un 400 de audit.
 */
export function parseEventsParams(get: Getter): AuditEventsQuery {
  const query: AuditEventsQuery = { ...DEFAULT_EVENTS_QUERY };

  const from = get('from');
  const to = get('to');
  if (isDateKey(from)) query.from = from;
  if (isDateKey(to) && (!query.from || to >= query.from)) query.to = to;
  if (query.from || query.to) {
    query.period = 'custom';
  } else if (get('period') === 'all') {
    query.period = 'all';
  }

  const actorId = get('actorId')?.trim() ?? '';
  if (ACTOR_ID_PATTERN.test(actorId)) query.actorId = actorId;

  const actorRole = get('actorRole');
  if (actorRole && (ACTOR_ROLES as readonly string[]).includes(actorRole)) {
    query.actorRole = actorRole as Role;
  }

  const resourceType = get('resourceType');
  if (resourceType && (AUDIT_RESOURCE_TYPES as readonly string[]).includes(resourceType)) {
    query.resourceType = resourceType as AuditResourceType;
  }

  const allowed = eventTypesFor(query.resourceType);
  const eventTypes = (get('eventType') ?? '').split(',').filter((type) => allowed.includes(type));
  query.eventTypes = [...new Set(eventTypes)];

  return { ...query, ...readPaging(get, DEFAULT_EVENTS_QUERY.size) };
}

/** Solo lo que difiere del valor por omisión, para una URL corta. */
export function toEventsUrlParams(query: AuditEventsQuery): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.period === 'all') params['period'] = 'all';
  if (query.period === 'custom') {
    if (query.from) params['from'] = query.from;
    if (query.to) params['to'] = query.to;
  }
  if (query.actorId) params['actorId'] = query.actorId;
  if (query.actorRole) params['actorRole'] = query.actorRole;
  if (query.resourceType) params['resourceType'] = query.resourceType;
  if (query.eventTypes.length) params['eventType'] = query.eventTypes.join(',');
  return { ...params, ...pagingParams(query, DEFAULT_EVENTS_QUERY.size) };
}

/**
 * Parámetros del GET. Los días se convierten a instantes en hora de Chile; el período reciente se calcula con
 * `now` en cada consulta, así una pestaña abierta de un día para otro no queda con el rango viejo.
 */
export function toEventsApiParams(query: AuditEventsQuery, now: Date): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.period === 'recent') {
    params['from'] = chileDayStart(shiftDateKey(chileDateKey(now), 1 - RECENT_DAYS)).toISOString();
  }
  if (query.period === 'custom') {
    if (query.from) params['from'] = chileDayStart(query.from).toISOString();
    if (query.to) params['to'] = chileDayEnd(query.to).toISOString();
  }
  if (query.actorId) params['actorId'] = query.actorId;
  if (query.actorRole) params['actorRole'] = query.actorRole;
  if (query.resourceType) params['resourceType'] = query.resourceType;
  if (query.eventTypes.length) params['eventType'] = query.eventTypes.join(',');
  params['page'] = String(query.page);
  params['size'] = String(query.size);
  return params;
}

/** Filtros que limitan la búsqueda; el período reciente cuenta, porque se puede quitar. */
export function activeEventsFilterCount(query: AuditEventsQuery): number {
  return [
    query.period !== 'all',
    query.actorId,
    query.actorRole,
    query.resourceType,
    query.eventTypes.length > 0,
  ].filter(Boolean).length;
}

export function parseTimelineParams(get: Getter): AuditTimelineQuery {
  const query: AuditTimelineQuery = { ...DEFAULT_TIMELINE_QUERY };
  const folio = normalizeFolio(get('folio') ?? '');
  const requestId = (get('requestId') ?? '').trim().toLowerCase();
  if (FOLIO_PATTERN.test(folio)) {
    query.folio = folio;
  } else if (UUID_PATTERN.test(requestId)) {
    query.requestId = requestId;
  }
  return { ...query, ...readPaging(get, DEFAULT_TIMELINE_QUERY.size) };
}

export function toTimelineUrlParams(query: AuditTimelineQuery): Record<string, string> {
  const params: Record<string, string> = { view: 'timeline' };
  if (query.folio) params['folio'] = query.folio;
  else if (query.requestId) params['requestId'] = query.requestId;
  return { ...params, ...pagingParams(query, DEFAULT_TIMELINE_QUERY.size) };
}

export function toTimelineApiParams(query: AuditTimelineQuery): Record<string, string> {
  const params: Record<string, string> = query.folio
    ? { folio: query.folio }
    : { requestId: query.requestId };
  params['page'] = String(query.page);
  params['size'] = String(query.size);
  return params;
}

/** Clave estable de unos parámetros, para comparar consultas sin depender del orden. */
export function paramsKey(params: Record<string, string>): string {
  return new URLSearchParams(Object.entries(params).sort()).toString();
}

function readPaging(get: Getter, defaultSize: number): { page: number; size: number } {
  const page = Number(get('page'));
  const size = Number(get('size'));
  return {
    page: Number.isInteger(page) && page > 0 ? page : 0,
    size: AUDIT_PAGE_SIZES.includes(size) ? size : defaultSize,
  };
}

function pagingParams(
  query: { page: number; size: number },
  defaultSize: number,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.page > 0) params['page'] = String(query.page);
  if (query.size !== defaultSize) params['size'] = String(query.size);
  return params;
}
