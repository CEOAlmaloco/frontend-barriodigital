import { HttpErrorResponse } from '@angular/common/http';

import { failureKind } from './http-failure';

describe('failureKind', () => {
  it('distingue servicio no disponible, sin permiso y otros errores', () => {
    expect(failureKind(new HttpErrorResponse({ status: 503 }))).toBe('unavailable');
    expect(failureKind(new HttpErrorResponse({ status: 403 }))).toBe('forbidden');
    expect(failureKind(new HttpErrorResponse({ status: 0 }))).toBe('generic');
    expect(failureKind(new Error('x'))).toBe('generic');
  });
});
