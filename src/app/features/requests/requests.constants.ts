import { RequestStatus } from '../../shared/models/request.model';

// DEUDA TECNICA (EP1-08): lista fija provisional. El catalogo dinamico de
// tipos de tramite (ms-barriodigital-catalog) todavia no esta disponible.
// Los "value" deben coincidir exactamente con los codigos que espera el
// backend (ms-barriodigital-requests, campo procedureType).
// Cuando el catalogo exista, reemplazar por un CatalogService.getTiposTramite()
// analogo a RequestsService.
export interface TipoTramiteOption {
  value: string;
  label: string;
}

export const TIPOS_TRAMITE_PROVISIONAL: TipoTramiteOption[] = [
  { value: 'bache', label: 'Bache en calle' },
  { value: 'alumbrado', label: 'Alumbrado público' },
  { value: 'basura', label: 'Recolección de escombros' },
  { value: 'agua', label: 'Agua o alcantarillado' },
  { value: 'ruido', label: 'Ruidos molestos' },
  { value: 'otro', label: 'Otro' },
];

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
