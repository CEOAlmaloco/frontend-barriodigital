export type RequestStatus =
  | 'INGRESADO'
  | 'ADMITIDO'
  | 'EN_GESTION'
  | 'EN_TERRENO'
  | 'RESUELTO'
  | 'RECHAZADO';

export interface Request {
  id: string;
  tipo: string;
  descripcion: string;
  direccion: string;
  estado: RequestStatus;
  fechaCreacion: string; // ISO 8601
  solicitanteId: string;
  /** Nombre o correo para mostrar. solicitanteId sigue siendo el que identifica al solicitante. */
  solicitanteNombre: string;
}

export interface CreateRequestPayload {
  tipo: string;
  descripcion: string;
  direccion: string;
}
