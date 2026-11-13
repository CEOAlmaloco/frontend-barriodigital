import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ReportKpis,
  ReportRange,
  ReportTopProcedures,
  SlaAlertPage,
  SlaAlertQuery,
} from '../../shared/models/report.model';

/** Lecturas de ms-barriodigital-report a través del BFF. Los plazos también los lee el Funcionario (EP3-07). */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.bffBaseUrl}/api/report`;

  getKpis(range: ReportRange): Observable<ReportKpis> {
    return this.http.get<ReportKpis>(`${this.url}/kpis`, {
      params: new HttpParams().set('range', range),
    });
  }

  getTopProcedures(range: ReportRange, limit = 5): Observable<ReportTopProcedures> {
    return this.http.get<ReportTopProcedures>(`${this.url}/top-procedures`, {
      params: new HttpParams().set('range', range).set('limit', limit),
    });
  }

  /** Vencidos y por vencer, ordenados por `dueDate` ascendente: los vencidos quedan primero. */
  getSlaAlerts(query: SlaAlertQuery): Observable<SlaAlertPage> {
    let params = new HttpParams().set('page', query.page).set('size', query.size);
    if (query.status?.length) {
      params = params.set('status', query.status.join(','));
    }
    if (query.assignee) {
      params = params.set('assignee', query.assignee);
    }
    return this.http.get<SlaAlertPage>(`${this.url}/sla`, { params });
  }
}
