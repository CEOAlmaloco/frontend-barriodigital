import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreateProcedureType,
  ProcedureType,
  UpdateProcedureType,
} from '../../shared/models/procedure-type.model';

/** Catálogo completo a través del BFF. MSAL adjunta el token de la API. */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.bffBaseUrl}/api/catalog/procedures`;

  getProcedures(): Observable<ProcedureType[]> {
    return this.http.get<ProcedureType[]>(this.url).pipe(
      map((procedures) =>
        procedures.map(({ value, label, active, dailyQuota, remainingQuota }) => ({
          value,
          label,
          active,
          dailyQuota,
          remainingQuota,
        })),
      ),
    );
  }

  createProcedure({ value, label, active }: CreateProcedureType): Observable<ProcedureType> {
    return this.http.post<ProcedureType>(this.url, { value, label, active });
  }

  updateProcedure(
    value: string,
    { label, active, dailyQuota }: UpdateProcedureType,
  ): Observable<ProcedureType> {
    return this.http.put<ProcedureType>(`${this.url}/${encodeURIComponent(value)}`, {
      label,
      active,
      dailyQuota,
    });
  }
}
