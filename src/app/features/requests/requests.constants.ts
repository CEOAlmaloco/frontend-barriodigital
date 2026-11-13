import { SlaStatus } from '../../shared/models/report.model';
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

export type SlaTone = 'neutral' | 'secondary' | 'success' | 'warning' | 'error';

/** Texto de EP3-06, sección 4.1, y tono del indicador de plazo. */
export const SLA_STATUS_VIEW: Record<SlaStatus, { label: string; tone: SlaTone; icon: string }> = {
  DENTRO_DE_PLAZO: { label: 'Dentro de plazo', tone: 'secondary', icon: 'schedule' },
  POR_VENCER: { label: 'Por vencer', tone: 'warning', icon: 'hourglass_bottom' },
  VENCIDO: { label: 'Vencido', tone: 'error', icon: 'error' },
  CUMPLIDO: { label: 'Cumplido', tone: 'success', icon: 'task_alt' },
  FUERA_DE_PLAZO: { label: 'Fuera de plazo', tone: 'error', icon: 'event_busy' },
  NO_APLICA: { label: 'No aplica', tone: 'neutral', icon: 'remove' },
  SIN_PLAZO: { label: 'Sin plazo', tone: 'neutral', icon: 'remove' },
};

/** Camino normal de atención. RECHAZADO y CANCELADO lo cortan. */
export const REQUEST_FLOW: readonly RequestStatus[] = [
  'INGRESADO',
  'ADMITIDO',
  'EN_GESTION',
  'EN_TERRENO',
  'RESUELTO',
];

export const CLOSED_STATUSES: readonly RequestStatus[] = ['RESUELTO', 'RECHAZADO', 'CANCELADO'];
export const OPEN_STATUSES: readonly RequestStatus[] = REQUEST_STATUSES.filter(
  (status) => !CLOSED_STATUSES.includes(status),
);

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

/** Ancla del formulario de alta en /tramites, enlazada desde el inicio del Vecino. */
export const NEW_REQUEST_FRAGMENT = 'nuevo-tramite';

export const REJECTION_REASON_MAX_LENGTH = 500;
export const INTERVENTION_REASON_MAX_LENGTH = 500;
export const ASSIGNMENT_REASON_MAX_LENGTH = 500;

/** Textos frecuentes del funcionario; se copian al campo y se pueden editar (EP3-82). */
export interface ReplyTemplate {
  label: string;
  text: string;
}

export const REJECTION_REPLY_TEMPLATES: readonly ReplyTemplate[] = [
  {
    label: 'Fuera de la comuna',
    text: 'La dirección indicada está fuera del límite comunal.',
  },
  {
    label: 'Antecedentes incompletos',
    text: 'Faltan antecedentes necesarios para tramitar la solicitud. Puedes ingresar una nueva con la información completa.',
  },
  {
    label: 'Duplicado',
    text: 'Ya existe un trámite abierto por el mismo motivo en esa ubicación.',
  },
  {
    label: 'No corresponde al municipio',
    text: 'La solicitud no es competencia de esta municipalidad.',
  },
];

export const GESTION_NOTE_TEMPLATES: readonly ReplyTemplate[] = [
  {
    label: 'No contesta',
    text: 'Se llamó al teléfono registrado. No hubo respuesta.',
  },
  {
    label: 'Buzón de voz',
    text: 'Se dejó mensaje en el buzón de voz solicitando contacto.',
  },
  {
    label: 'Reagendar contacto',
    text: 'Se acordó reintentar el contacto en la fecha indicada.',
  },
  {
    label: 'Datos de contacto incorrectos',
    text: 'El número o correo registrado no permite contactar al vecino.',
  },
];

export function actionLabel(status: RequestStatus): string {
  return Object.hasOwn(REQUEST_ACTION_LABELS, status)
    ? REQUEST_ACTION_LABELS[status as keyof typeof REQUEST_ACTION_LABELS]
    : REQUEST_STATUS_VIEW[status].label;
}
