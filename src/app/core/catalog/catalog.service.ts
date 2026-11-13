import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, Subscription, map, tap } from 'rxjs';

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
  private readonly labelMap = signal<ReadonlyMap<string, string>>(new Map());
  private labelsLoaded = false;
  private labelsRequest: Subscription | null = null;

  /**
   * Nombre actual de cada tipo, incluidos los inactivos. Se actualiza con cualquier consulta del catálogo
   * (listado, alta o administración), así que las vistas que solo necesitan nombres reutilizan esa carga.
   */
  readonly labels = this.labelMap.asReadonly();

  /**
   * Consulta el catálogo solo si nadie lo cargó en la sesión. No bloquea a quien lo pide: mientras tanto, o si
   * falla, los nombres se resuelven con el dato guardado en el trámite. Una falla deja reintentar la próxima vez.
   */
  loadLabels(): void {
    if (this.labelsLoaded || this.labelsRequest) {
      return;
    }
    this.labelsRequest = this.getProcedures().subscribe({
      error: () => (this.labelsRequest = null),
      complete: () => (this.labelsRequest = null),
    });
  }

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
      tap((procedures) => {
        this.labelsLoaded = true;
        this.labelMap.set(new Map(procedures.map((type) => [type.value, type.label])));
      }),
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
