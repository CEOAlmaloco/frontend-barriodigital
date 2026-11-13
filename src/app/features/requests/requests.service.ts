import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Page } from '../../shared/models/page.model';
import {
  AssignRequestPayload,
  Assignee,
  ChangeRequestStatusPayload,
  CreateRequestPayload,
  Request,
  RequestStatus,
  RequestTransitions,
} from '../../shared/models/request.model';

/** Trámite tal como lo devuelve el BFF: el modelo de la UI más title y updatedAt, que la UI no usa. */
interface RequestResponse extends Request {
  title: string;
  updatedAt: string;
}

/**
 * Trámites de ms-barriodigital-requests a través del BFF. El Bearer lo adjunta MsalInterceptor
 * (protectedResourceMap sobre bffBaseUrl) y el BFF saca el solicitante del token, nunca del body.
 */
@Injectable({ providedIn: 'root' })
export class RequestsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.bffBaseUrl}/api/requests`;

  /**
   * Página de trámites (EP3-30). Al Vecino el servidor le devuelve solo los suyos, también al
   * buscar y filtrar. Un parámetro vacío no se envía.
   */
  getRequests(params: Record<string, string> = {}): Observable<Page<Request>> {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        httpParams = httpParams.set(key, value);
      }
    }

    return this.http
      .get<Page<RequestResponse>>(this.url, { params: httpParams })
      .pipe(map((page) => ({ ...page, content: page.content.map(toRequest) })));
  }

  /** Un trámite ajeno para el Vecino responde 404, igual que uno inexistente. */
  getRequest(id: string): Observable<Request> {
    return this.http
      .get<RequestResponse>(`${this.url}/${encodeURIComponent(id)}`)
      .pipe(map(toRequest));
  }

  createRequest(payload: CreateRequestPayload): Observable<Request> {
    return this.http.post<RequestResponse>(this.url, payload).pipe(map(toRequest));
  }

  createRequestWithAttachment(
    payload: CreateRequestPayload,
    attachment: File,
  ): Observable<Request> {
    const formData = new FormData();
    formData.append('request', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    formData.append('attachment', attachment, 'evidencia');
    return this.http.post<RequestResponse>(this.url, formData).pipe(map(toRequest));
  }

  getAttachment(id: string): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/attachment`, { responseType: 'blob' });
  }

  getTransitions(): Observable<RequestTransitions> {
    return this.http.get<RequestTransitions>(`${this.url}/meta/transitions`);
  }

  changeStatus(id: string, payload: ChangeRequestStatusPayload): Observable<Request> {
    return this.http.put<RequestResponse>(`${this.url}/${id}/status`, payload).pipe(map(toRequest));
  }

  /** El Funcionario se asigna un trámite sin responsable. */
  take(id: string): Observable<Request> {
    return this.http.post<RequestResponse>(`${this.url}/${id}/take`, null).pipe(map(toRequest));
  }

  /** Primera asignación (Admin) o reasignación (Admin o el Funcionario responsable). */
  assign(id: string, payload: AssignRequestPayload): Observable<Request> {
    return this.http
      .put<RequestResponse>(`${this.url}/${id}/assignee`, payload)
      .pipe(map(toRequest));
  }

  /** Funcionarios que pueden ser responsables, ordenados por nombre. */
  getAssignees(): Observable<Assignee[]> {
    return this.http.get<Assignee[]>(`${this.url}/assignees`);
  }

  getActividad(id: string): Observable<RequestActivity> {
    return this.http.get<RequestActivity>(`${this.url}/${id}/actividad`);
  }

  registerGestion(id: string, payload: RegisterGestionPayload): Observable<RequestActivity> {
    return this.http.post<RequestActivity>(`${this.url}/${id}/gestiones`, payload);
  }
}

export interface RequestActivity {
  requestId: string;
  eventos: RequestActivityEvent[];
  tiempos: RequestActivityTimes;
  contacto: RequestActivityContact | null;
  limites: string[];
}

export type RequestActivityKind = 'CREADO' | 'ESTADO' | 'GESTION' | 'ASIGNACION';

/** Al Vecino, requests le entrega el actor de staff como "Municipalidad" y nunca el motivo de intervención. */
export interface RequestActivityEvent {
  id: string;
  occurredAt: string;
  kind: RequestActivityKind;
  visibility: 'PUBLICO' | 'INTERNO';
  actorId: string | null;
  actorName: string | null;
  actorRole?: string | null;
  summary: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus | null;
  reason: string | null;
  channel: string | null;
  result: string | null;
  note: string | null;
  nextAttemptAt: string | null;
  interventionReason?: string | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
  previousAssigneeId?: string | null;
  previousAssigneeName?: string | null;
}

export interface RequestActivityTimes {
  primeraAtencionSegundos: number | null;
  primeraAsignacionSegundos?: number | null;
  gestionMunicipalSegundos: number | null;
  desdeElIngresoSegundos: number | null;
  totalResolucionSegundos: number | null;
  etapas: { estado: RequestStatus; desde: string; hasta: string | null; segundos: number }[];
  noCalculado: string[];
}

export interface RequestActivityContact {
  intentos: number;
  ultimoIntento: string | null;
  siguienteIntento: string | null;
  siguienteAccion: string | null;
}

export interface RegisterGestionPayload {
  channel: string;
  result: string;
  note?: string;
  nextAttemptAt?: string;
  interventionReason?: string;
}

function toRequest({
  id,
  description,
  procedureType,
  address,
  status,
  rejectionReason,
  createdAt,
  solicitanteId,
  solicitanteNombre,
  sector,
  locationReference,
  latitude,
  longitude,
  locationPrecision,
  hasAttachment,
  folio,
  procedureLabel,
  solicitanteEmail,
  hasAssignee,
  assigneeId,
  assigneeName,
  slaBusinessDays,
}: RequestResponse): Request {
  return {
    id,
    description,
    procedureType,
    address,
    status,
    rejectionReason,
    createdAt,
    solicitanteId,
    solicitanteNombre,
    sector,
    locationReference,
    latitude,
    longitude,
    locationPrecision,
    ...(hasAttachment === true ? { hasAttachment: true } : {}),
    ...(folio !== undefined ? { folio } : {}),
    ...(procedureLabel !== undefined ? { procedureLabel } : {}),
    ...(solicitanteEmail !== undefined ? { solicitanteEmail } : {}),
    ...(hasAssignee !== undefined ? { hasAssignee } : {}),
    ...(assigneeId !== undefined ? { assigneeId } : {}),
    ...(assigneeName !== undefined ? { assigneeName } : {}),
    ...(slaBusinessDays !== undefined ? { slaBusinessDays } : {}),
  };
}
