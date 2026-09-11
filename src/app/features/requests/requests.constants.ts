import { RequestStatus } from '../../shared/models/request.model';

// DEUDA TECNICA (EP1-08): lista fija provisional. El catalogo dinamico de
// tipos de tramite (ms-barriodigital-catalog) todavia no esta disponible.
// Cuando exista, reemplazar este arreglo por una llamada al catalogo real
// (probablemente un CatalogService.getTiposTramite() analogo a RequestsService)
// y actualizar el select del formulario de creacion para consumirlo desde ahi.
export const TIPOS_TRAMITE_PROVISIONAL: string[] = [
  'Poda de árbol',
  'Bache en calle',
  'Alumbrado público',
  'Recolección de escombros',
  'Ruidos molestos',
  'Otro',
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
