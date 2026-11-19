import { HttpErrorResponse } from '@angular/common/http';

export type FailureKind = 'unavailable' | 'forbidden' | 'generic';

/** 503 lo responde el BFF cuando el servicio de destino no contesta (EP3-44); 403, cuando el rol no alcanza. */
export function failureKind(error: unknown): FailureKind {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 503) return 'unavailable';
    if (error.status === 403) return 'forbidden';
  }
  return 'generic';
}
