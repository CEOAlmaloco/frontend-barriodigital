import { AuditEvent, AuditResourceType } from '../../shared/models/audit.model';
import { RequestStatus } from '../../shared/models/request.model';
import { ROLE_LABELS, Role } from '../../shared/models/role';
import { sectorLabel } from '../requests/request-location';
import {
  CONTACT_CHANNELS,
  CONTACT_RESULTS,
  REQUEST_STATUS_VIEW,
} from '../requests/requests.constants';
import { chileDateTime } from './audit-time';

export type AuditEventKind = 'request' | 'config';
export type AuditTone = 'primary' | 'secondary' | 'success' | 'error' | 'neutral';

export const RESOURCE_LABELS: Readonly<Record<AuditResourceType, string>> = {
  request: 'Trámites',
  'procedure-type': 'Tipos de trámite',
  queue: 'Colas de RabbitMQ',
  exchange: 'Exchanges de RabbitMQ',
  binding: 'Bindings de RabbitMQ',
  topic: 'Tópicos de Kafka',
  'consumer-group': 'Consumer groups de Kafka',
};

export const EVENT_TYPE_LABELS: Readonly<Record<string, string>> = {
  'request.created': 'Ingreso del trámite',
  'request.status-changed': 'Cambio de estado',
  'request.cancelled': 'Cancelación del vecino',
  'request.contact-logged': 'Gestión de contacto',
  'request.assigned': 'Asignación',
  'request.rated': 'Encuesta de satisfacción',
  'procedure-type.created': 'Alta del tipo de trámite',
  'procedure-type.updated': 'Edición del tipo de trámite',
  'queue.created': 'Alta de la cola',
  'queue.deleted': 'Eliminación de la cola',
  'queue.purged': 'Purga de la cola',
  'exchange.created': 'Alta del exchange',
  'exchange.deleted': 'Eliminación del exchange',
  'binding.created': 'Alta del binding',
  'binding.deleted': 'Eliminación del binding',
  'topic.created': 'Alta del tópico',
  'topic.updated': 'Edición del tópico',
  'topic.deleted': 'Eliminación del tópico',
  'topic.dlt-replayed': 'Reproceso de la DLT',
  'consumer-group.offsets-reset': 'Reinicio de offsets',
};

/** Nombres de los campos de configuración más comunes; uno desconocido se muestra con su nombre original. */
const FIELD_LABELS: Readonly<Record<string, string>> = {
  label: 'Nombre',
  value: 'Código',
  active: 'Activo',
  dailyQuota: 'Cupo diario',
  slaBusinessDays: 'Plazo (días hábiles)',
  messages: 'Mensajes en la cola',
  messagesRemoved: 'Mensajes eliminados',
  durable: 'Durable',
  type: 'Tipo',
  partitions: 'Particiones',
  replicationFactor: 'Réplicas',
  retentionMs: 'Retención (ms)',
  offsets: 'Offsets',
};

export interface AuditField {
  label: string;
  value: string;
}

export interface ChangeRow {
  field: string;
  before: string | null;
  after: string | null;
  changed: boolean;
}

/** Cómo leer `before` y `after` según la operación (EP3-01, sección 7). */
export type ChangeMode = 'update' | 'create' | 'delete' | 'result';

export interface AuditChange {
  mode: ChangeMode;
  rows: ChangeRow[];
}

export interface AuditEventView {
  event: AuditEvent;
  kind: AuditEventKind;
  title: string;
  /** Título con el cambio de estado incluido, para el timeline. */
  headline: string;
  /** Recurso de configuración afectado; en un trámite, su folio va aparte. */
  resource: string | null;
  folio: string | null;
  requestId: string | null;
  date: string;
  time: string;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  /** null cuando no hay IP; `ipNote` dice por qué. */
  ip: string | null;
  ipNote: string;
  icon: string;
  tone: AuditTone;
  transition: { from: RequestStatus | null; to: RequestStatus | null } | null;
  fields: AuditField[];
  interventionReason: string | null;
  change: AuditChange | null;
  /** Evento de un tipo que esta versión no conoce: se muestra el resumen de audit. */
  unknown: boolean;
}

const RESULT_ACTIONS = ['purged', 'offsets-reset', 'dlt-replayed'];
const numberFormat = new Intl.NumberFormat('es-CL');

export function toAuditEventView(event: AuditEvent): AuditEventView {
  const kind = eventKind(event);
  const details = asRecord(event.details);
  const known = event.eventType in EVENT_TYPE_LABELS;
  const title = known
    ? EVENT_TYPE_LABELS[event.eventType]
    : (text(event.summary) ?? event.eventType);
  const when = chileDateTime(event.occurredAt);
  const actor = event.actor ?? null;
  const transition = kind === 'request' ? statusTransition(event.eventType, details) : null;
  const ip = text(actor?.sourceIp);

  const view: AuditEventView = {
    event,
    kind,
    title,
    headline: title,
    resource: kind === 'config' ? text(event.resourceId) : null,
    folio: text(event.folio),
    requestId: text(event.requestId),
    date: when?.date ?? 'Fecha no registrada',
    time: when?.time ?? '',
    actorId: text(actor?.id),
    actorName: text(actor?.name) ?? text(actor?.id) ?? 'Sin nombre',
    actorRole: roleLabel(actor?.role),
    ip,
    ipNote: ip ? '' : kind === 'request' ? 'No aplica' : 'No registrada',
    icon: 'history',
    tone: 'neutral',
    transition,
    fields: [],
    interventionReason: kind === 'request' ? text(details?.['interventionReason']) : null,
    change: kind === 'config' && known ? configChange(event.eventType, details) : null,
    unknown: !known,
  };

  if (kind === 'request' && known) {
    Object.assign(view, requestPresentation(event.eventType, details, transition));
  } else if (kind === 'config') {
    Object.assign(view, configPresentation(event.eventType));
  }
  return view;
}

function eventKind(event: AuditEvent): AuditEventKind {
  if (event.resourceType) {
    return event.resourceType === 'request' ? 'request' : 'config';
  }
  return event.eventType.startsWith('request.') || event.requestId ? 'request' : 'config';
}

function roleLabel(role: string | null | undefined): string {
  if (!role) return 'Rol no registrado';
  return ROLE_LABELS[role as Role] ?? role;
}

function statusTransition(
  eventType: string,
  details: Record<string, unknown> | null,
): AuditEventView['transition'] {
  if (eventType !== 'request.status-changed' && eventType !== 'request.cancelled') {
    return null;
  }
  return { from: status(details?.['fromStatus']), to: status(details?.['toStatus']) };
}

function requestPresentation(
  eventType: string,
  details: Record<string, unknown> | null,
  transition: AuditEventView['transition'],
): Partial<AuditEventView> {
  const fields: AuditField[] = [];
  const add = (label: string, value: string | null) => {
    if (value) fields.push({ label, value });
  };
  const has = (key: string) => details !== null && key in details;

  switch (eventType) {
    case 'request.created': {
      add('Tipo', text(details?.['procedureLabel']) ?? text(details?.['procedureType']));
      const sector = text(details?.['sector']);
      add('Sector', sector ? (sectorLabel(sector) ?? sector) : null);
      // Ausente en un evento antiguo: no se afirma "sin plazo" si el dato no venía
      if (has('slaBusinessDays')) {
        const days = details?.['slaBusinessDays'];
        add('Plazo', typeof days === 'number' ? businessDays(days) : 'Sin plazo');
      }
      return { fields, icon: 'add_circle', tone: 'primary' };
    }
    case 'request.status-changed':
    case 'request.cancelled': {
      add('Tipo', text(details?.['procedureLabel']) ?? text(details?.['procedureType']));
      add('Motivo de rechazo', text(details?.['reason']));
      const to = transition?.to;
      const headline = transitionHeadline(EVENT_TYPE_LABELS[eventType], transition);
      if (eventType === 'request.cancelled' || to === 'CANCELADO') {
        return { fields, headline, icon: 'cancel', tone: 'neutral' };
      }
      if (to === 'RECHAZADO') return { fields, headline, icon: 'block', tone: 'error' };
      if (to === 'RESUELTO') return { fields, headline, icon: 'task_alt', tone: 'success' };
      return { fields, headline, icon: 'sync_alt', tone: 'secondary' };
    }
    case 'request.contact-logged': {
      add('Canal', optionLabel(CONTACT_CHANNELS, details?.['channel']));
      add('Resultado', optionLabel(CONTACT_RESULTS, details?.['result']));
      const next = chileDateTime(text(details?.['nextAttemptAt']) ?? '');
      add('Próximo intento', next ? `${next.date} ${next.time.slice(0, 5)}` : null);
      return { fields, icon: 'call', tone: 'neutral' };
    }
    case 'request.assigned': {
      const reassigned = Boolean(text(details?.['previousAssigneeId']));
      add('Responsable', text(details?.['assigneeName']) ?? text(details?.['assigneeId']));
      add('Motivo', text(details?.['reason']));
      const title = reassigned ? 'Reasignación' : EVENT_TYPE_LABELS[eventType];
      return { fields, title, headline: title, icon: 'assignment_ind', tone: 'secondary' };
    }
    case 'request.rated': {
      const score = details?.['score'];
      add('Calificación', typeof score === 'number' ? `${score} de 5` : null);
      add('Comentario', text(details?.['comment']));
      return { fields, icon: 'star', tone: 'neutral' };
    }
  }
  return { fields };
}

function configPresentation(eventType: string): Partial<AuditEventView> {
  const action = eventType.slice(eventType.indexOf('.') + 1);
  if (action === 'deleted') return { icon: 'delete', tone: 'error' };
  if (action === 'created') return { icon: 'add_circle', tone: 'primary' };
  if (RESULT_ACTIONS.includes(action)) return { icon: 'build', tone: 'secondary' };
  return { icon: 'edit', tone: 'secondary' };
}

function transitionHeadline(base: string, transition: AuditEventView['transition']): string {
  if (!transition?.from || !transition.to) {
    return base;
  }
  return `${base}: ${statusLabel(transition.from)} → ${statusLabel(transition.to)}`;
}

/** Filas de `before` y `after`. Un `before` o `after` que no es objeto se trata como ausente. */
export function configChange(
  eventType: string,
  details: Record<string, unknown> | null,
): AuditChange | null {
  const before = asRecord(details?.['before']);
  const after = asRecord(details?.['after']);
  if (!before && !after) {
    return null;
  }
  const action = eventType.slice(eventType.indexOf('.') + 1);
  const mode: ChangeMode = RESULT_ACTIONS.includes(action)
    ? 'result'
    : !before
      ? 'create'
      : !after
        ? 'delete'
        : 'update';
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  const rows = keys.map((key) => {
    const old = before && key in before ? formatValue(before[key]) : null;
    const next = after && key in after ? formatValue(after[key]) : null;
    return {
      field: FIELD_LABELS[key] ?? key,
      before: old,
      after: next,
      changed: mode === 'update' && old !== next,
    };
  });
  return { mode, rows };
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'Sin valor';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return numberFormat.format(value);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export function statusLabel(value: RequestStatus): string {
  return REQUEST_STATUS_VIEW[value]?.label ?? value;
}

function businessDays(days: number): string {
  return days === 1 ? '1 día hábil' : `${days} días hábiles`;
}

function optionLabel(
  options: readonly { value: string; label: string }[],
  value: unknown,
): string | null {
  const code = text(value);
  return code ? (options.find((option) => option.value === code)?.label ?? code) : null;
}

function status(value: unknown): RequestStatus | null {
  const code = text(value);
  return code ? (code as RequestStatus) : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
