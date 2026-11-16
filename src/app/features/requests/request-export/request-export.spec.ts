import { HttpErrorResponse } from '@angular/common/http';

import { exportFailure, exportFileName } from './request-export';

const httpError = (status: number) => new HttpErrorResponse({ status });

describe('request-export', () => {
  it('nombra el archivo con el día de Chile, con y sin horario de verano', () => {
    expect(exportFileName(new Date('2026-11-16T02:30:00Z'))).toBe('tramites-2026-11-15.csv');
    expect(exportFileName(new Date('2026-11-16T03:00:00Z'))).toBe('tramites-2026-11-16.csv');
    expect(exportFileName(new Date('2026-07-01T03:30:00Z'))).toBe('tramites-2026-06-30.csv');
    expect(exportFileName(new Date('2026-07-01T04:00:00Z'))).toBe('tramites-2026-07-01.csv');
  });

  it.each([0, 500, 502, 503])('ofrece reintentar ante una falla temporal (%i)', (status) => {
    expect(exportFailure(httpError(status)).retry).toBe(true);
  });

  it('sin conexión pide revisarla', () => {
    expect(exportFailure(httpError(0)).message).toBe(
      'No se pudo generar el archivo. Revisa tu conexión e intenta nuevamente.',
    );
  });

  it('el 400 explica el tope y la salida, sin reintentar', () => {
    expect(exportFailure(httpError(400))).toEqual({
      message:
        'No se pudo exportar con estos filtros. Si son más de 5.000 trámites, filtra por fecha o estado.',
      retry: false,
    });
  });

  it('sesión y permisos no se resuelven repitiendo la descarga', () => {
    expect(exportFailure(httpError(401))).toEqual({
      message: 'Tu sesión ya no permite exportar. Inicia sesión nuevamente.',
      retry: false,
    });
    expect(exportFailure(httpError(403))).toEqual({
      message: 'Tu cuenta no tiene permiso para exportar trámites.',
      retry: false,
    });
  });

  it('otro error queda con el mensaje general, sin reintentar', () => {
    expect(exportFailure(httpError(404))).toEqual({
      message: 'No se pudo generar el archivo. Intenta nuevamente.',
      retry: false,
    });
    expect(exportFailure(new Error('interaction_in_progress')).retry).toBe(false);
  });
});
