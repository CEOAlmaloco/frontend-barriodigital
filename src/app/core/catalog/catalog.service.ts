import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ProcedureType } from '../../shared/models/procedure-type.model';

/** Catálogo completo a través del BFF. MSAL adjunta el token de la API. */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.bffBaseUrl}/api/catalog/procedures`;

  getProcedures(): Observable<ProcedureType[]> {
    return this.http
      .get<ProcedureType[]>(this.url)
      .pipe(
        map((procedures) =>
          procedures.map(({ value, label, active }) => ({ value, label, active })),
        ),
      );
  }
}
