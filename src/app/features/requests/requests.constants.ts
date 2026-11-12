import { RequestStatus } from '../../shared/models/request.model';

export type StatusTone = 'neutral' | 'secondary' | 'success' | 'error';

/** Etiqueta visible y tono del badge de cada estado, en el orden del flujo del trámite. */
export const REQUEST_STATUS_VIEW: Record<RequestStatus, { label: string; tone: StatusTone }> = {
  INGRESADO: { label: 'Ingresado', tone: 'neutral' },
  ADMITIDO: { label: 'Admitido', tone: 'neutral' },
  EN_GESTION: { label: 'En gestión', tone: 'neutral' },
  EN_TERRENO: { label: 'En terreno', tone: 'secondary' },
  RESUELTO: { label: 'Resuelto', tone: 'success' },
  RECHAZADO: { label: 'Rechazado', tone: 'error' },
  CANCELADO: { label: 'Cancelado', tone: 'neutral' },
};

export const REQUEST_STATUSES = Object.keys(REQUEST_STATUS_VIEW) as RequestStatus[];

/** Camino normal de atención. RECHAZADO y CANCELADO lo cortan. */
export const REQUEST_FLOW: readonly RequestStatus[] = [
  'INGRESADO',
  'ADMITIDO',
  'EN_GESTION',
  'EN_TERRENO',
  'RESUELTO',
];

export const CLOSED_STATUSES: readonly RequestStatus[] = ['RESUELTO', 'RECHAZADO', 'CANCELADO'];

export function isClosedStatus(status: RequestStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

/** Etiquetas de acciones por destino; las transiciones permitidas vienen del backend. */
export const REQUEST_ACTION_LABELS: Record<
  Exclude<RequestStatus, 'INGRESADO' | 'CANCELADO'>,
  string
> = {
  ADMITIDO: 'Admitir',
  EN_GESTION: 'Pasar a gestión',
  EN_TERRENO: 'Enviar a terreno',
  RESUELTO: 'Resolver',
  RECHAZADO: 'Rechazar',
};

export const CONTACT_CHANNELS = [
  { value: 'LLAMADA', label: 'Llamada' },
  { value: 'CORREO', label: 'Correo' },
  { value: 'VISITA', label: 'Visita' },
  { value: 'MENSAJE', label: 'Mensaje' },
] as const;

export const CONTACT_RESULTS = [
  { value: 'CONTESTO', label: 'Contestó' },
  { value: 'NO_CONTESTA', label: 'No contesta' },
  { value: 'NUMERO_INCORRECTO', label: 'Número incorrecto' },
  { value: 'BUZON', label: 'Buzón de voz' },
  { value: 'CORREO', label: 'Contacto por correo' },
  { value: 'CONFIRMADO', label: 'Contacto confirmado' },
  { value: 'VISITA_FALLIDA', label: 'Visita fallida' },
] as const;

export const REJECTION_REASON_MAX_LENGTH = 500;
export const INTERVENTION_REASON_MAX_LENGTH = 500;

export function actionLabel(status: RequestStatus): string {
  return Object.hasOwn(REQUEST_ACTION_LABELS, status)
    ? REQUEST_ACTION_LABELS[status as keyof typeof REQUEST_ACTION_LABELS]
    : REQUEST_STATUS_VIEW[status].label;
}
