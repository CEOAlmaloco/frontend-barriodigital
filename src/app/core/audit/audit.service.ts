import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuditEvent } from '../../shared/models/audit.model';
import { Page } from '../../shared/models/page.model';

/** Lecturas de ms-barriodigital-audit a través del BFF, que exige Admin o Auditor (EP3-07). */
@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.bffBaseUrl}/api/audit`;

  /** Un parámetro vacío no se envía. */
  searchEvents(params: Record<string, string>): Observable<Page<AuditEvent>> {
    return this.http.get<Page<AuditEvent>>(`${this.url}/events`, { params: toHttpParams(params) });
  }

  /** Con `folio` o `requestId`, nunca los dos: audit responde 400. */
  getTimeline(params: Record<string, string>): Observable<Page<AuditEvent>> {
    return this.http.get<Page<AuditEvent>>(`${this.url}/timeline`, {
      params: toHttpParams(params),
    });
  }
}

function toHttpParams(params: Record<string, string>): HttpParams {
  let httpParams = new HttpParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      httpParams = httpParams.set(key, value);
    }
  }
  return httpParams;
}
