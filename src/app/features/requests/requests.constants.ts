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
};

export const REQUEST_STATUSES = Object.keys(REQUEST_STATUS_VIEW) as RequestStatus[];

/** Etiquetas de acciones por destino; las transiciones permitidas vienen del backend. */
export const REQUEST_ACTION_LABELS: Record<Exclude<RequestStatus, 'INGRESADO'>, string> = {
  ADMITIDO: 'Admitir',
  EN_GESTION: 'Pasar a gestión',
  EN_TERRENO: 'Enviar a terreno',
  RESUELTO: 'Resolver',
  RECHAZADO: 'Rechazar',
};

export const REJECTION_REASON_MAX_LENGTH = 500;
