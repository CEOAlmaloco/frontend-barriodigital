import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CreateRequestPayload, Request } from '../../shared/models/request.model';

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
}

function toRequest({
  id,
  description,
  procedureType,
  address,
  status,
  createdAt,
  solicitanteId,
}: RequestResponse): Request {
  return { id, description, procedureType, address, status, createdAt, solicitanteId };
}
