export type RequestStatus =
  'INGRESADO' | 'ADMITIDO' | 'EN_GESTION' | 'EN_TERRENO' | 'RESUELTO' | 'RECHAZADO' | 'CANCELADO';

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
  /** Código de sector de la comuna. Puede faltar. */
  sector?: string | null;
  /** Referencia para encontrar el lugar. Puede faltar. */
  locationReference?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationPrecision?: 'EXACTO' | 'APROXIMADO' | null;
  hasAttachment?: boolean;
  folio?: string | null;
  procedureLabel?: string | null;
  /** null para el Auditor (EP3-04, sección 6.1). */
  solicitanteEmail?: string | null;
  hasAssignee?: boolean;
  /** Solo llegan al staff; el Vecino recibe null. */
  assigneeId?: string | null;
  assigneeName?: string | null;
  slaBusinessDays?: number | null;
  /** Encuesta del titular (EP3-74). null si aún no calificó. */
  satisfactionScore?: number | null;
  satisfactionComment?: string | null;
}

/** Body de POST /api/requests/{id}/rating. */
export interface RateRequestPayload {
  score: number;
  comment?: string;
}

/** Base de GET /api/requests/duplicates: el tipo y al menos un punto o un sector comparable. */
export interface DuplicateSearch {
  procedureType: string;
  latitude?: number;
  longitude?: number;
  sector?: string;
}

/**
 * Posible duplicado (EP3-75). Al Vecino no le llegan id ni hasAssignee, y mine dice si es suyo; al personal
 * le llegan id y hasAssignee, y mine es null.
 */
export interface DuplicateCandidate {
  id: string | null;
  folio: string;
  procedureType: string;
  procedureLabel: string | null;
  status: RequestStatus;
  sector: string | null;
  /** Redondeada a 10 m; null si coincidió por sector. */
  distanceMeters: number | null;
  /** Día de ingreso en America/Santiago, YYYY-MM-DD. */
  createdDate: string;
  hasAssignee: boolean | null;
  mine: boolean | null;
}

/** Body del POST. title y solicitanteId no van: el backend los arma solo. */
export interface CreateRequestPayload {
  procedureType: string;
  description: string;
  address: string;
  sector?: string;
  locationReference?: string;
  latitude?: number;
  longitude?: number;
  locationPrecision?: 'EXACTO' | 'APROXIMADO';
}

export type RequestTransitions = Partial<Record<RequestStatus, readonly RequestStatus[]>>;

/** Funcionario de la lista de GET /api/requests/assignees (EP3-05, sección 5.2). */
export interface Assignee {
  id: string;
  name: string;
}

/** Body de PUT /assignee. reason solo se envía al reasignar; en una primera asignación se ignora. */
export interface AssignRequestPayload {
  assigneeId: string;
  reason?: string;
}

/** Body del PUT de estado. El motivo solo se envía al rechazar y el de intervención solo lo envía el Admin. */
export interface ChangeRequestStatusPayload {
  status: RequestStatus;
  rejectionReason?: string;
  interventionReason?: string;
}
