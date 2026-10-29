import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ChangeRequestStatusPayload,
  CreateRequestPayload,
  Request,
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

  /** Al Vecino el servidor le devuelve solo sus trámites, ordenados por fecha de creación descendente. */
  getRequests(filters?: { status?: string; from?: string; to?: string }): Observable<Request[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters ?? {})) {
      if (value) {
        params = params.set(key, value);
      }
    }

    return this.http
      .get<RequestResponse[]>(this.url, { params })
      .pipe(map((requests) => requests.map(toRequest)));
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

export interface RequestActivityEvent {
  id: string;
  occurredAt: string;
  kind: 'CREADO' | 'ESTADO' | 'GESTION';
  visibility: 'PUBLICO' | 'INTERNO';
  actorId: string;
  actorName: string | null;
  summary: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  channel: string | null;
  result: string | null;
  note: string | null;
  nextAttemptAt: string | null;
}

export interface RequestActivityTimes {
  primeraAtencionSegundos: number | null;
  gestionMunicipalSegundos: number | null;
  desdeElIngresoSegundos: number | null;
  totalResolucionSegundos: number | null;
  etapas: { estado: string; desde: string; hasta: string; segundos: number }[];
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
  };
}
