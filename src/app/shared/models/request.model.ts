export type RequestStatus =
  'INGRESADO' | 'ADMITIDO' | 'EN_GESTION' | 'EN_TERRENO' | 'RESUELTO' | 'RECHAZADO';

/** Trámite con los mismos nombres de campo que expone ms-barriodigital-requests vía el BFF. */
export interface Request {
  id: string;
  description: string;
  procedureType: string;
  address: string;
  status: RequestStatus;
  rejectionReason: string | null;
  createdAt: string; // ISO 8601 en UTC
  /** Object ID (oid) de Entra ID del solicitante. Lo asigna el BFF desde el token. */
  solicitanteId: string;
  /** Nombre persistido al crear. Puede faltar en trámites antiguos. */
  solicitanteNombre?: string | null;
}

/** Body del POST. title y solicitanteId no van: el backend los arma solo. */
export interface CreateRequestPayload {
  procedureType: string;
  description: string;
  address: string;
}

export type RequestTransitions = Record<RequestStatus, readonly RequestStatus[]>;

/** Body del PUT de estado. El motivo solo se envía al rechazar. */
export interface ChangeRequestStatusPayload {
  status: RequestStatus;
  rejectionReason?: string;
}
