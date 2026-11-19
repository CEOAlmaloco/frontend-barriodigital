import { Role } from './role';

/** `resourceType` de audit: `request` es la normalización de los eventos de trámite (EP3-07, sección 5.1). */
export type AuditResourceType =
  'request' | 'procedure-type' | 'queue' | 'exchange' | 'binding' | 'topic' | 'consumer-group';

export const AUDIT_RESOURCE_TYPES: readonly AuditResourceType[] = [
  'request',
  'procedure-type',
  'queue',
  'exchange',
  'binding',
  'topic',
  'consumer-group',
];

/** `eventType` válidos por recurso, en el orden en que se ofrecen en el filtro (EP3-01, secciones 6 y 7). */
export const AUDIT_EVENT_TYPES: Readonly<Record<AuditResourceType, readonly string[]>> = {
  request: [
    'request.created',
    'request.status-changed',
    'request.cancelled',
    'request.contact-logged',
    'request.assigned',
    'request.rated',
  ],
  'procedure-type': ['procedure-type.created', 'procedure-type.updated'],
  queue: ['queue.created', 'queue.deleted', 'queue.purged'],
  exchange: ['exchange.created', 'exchange.deleted'],
  binding: ['binding.created', 'binding.deleted'],
  topic: ['topic.created', 'topic.updated', 'topic.deleted', 'topic.dlt-replayed'],
  'consumer-group': ['consumer-group.offsets-reset'],
};

export interface AuditActor {
  id: string | null;
  name: string | null;
  role: Role | string | null;
  /** Solo en operaciones de configuración (EP3-01, sección 9). */
  sourceIp: string | null;
}

/**
 * Ítem de `GET /api/audit/events` y `/timeline` (EP3-07, sección 5.2). Los campos se tratan como opcionales:
 * un evento guardado antes de un cambio de esquema puede no traerlos.
 */
export interface AuditEvent {
  eventId: string;
  eventType: string;
  occurredAt: string;
  producer?: string | null;
  actor?: AuditActor | null;
  resourceType?: string | null;
  resourceId?: string | null;
  requestId?: string | null;
  folio?: string | null;
  sequence?: number | null;
  summary?: string | null;
  /** Payload del trámite, o `before` y `after` de una operación de configuración. */
  details?: unknown;
}
