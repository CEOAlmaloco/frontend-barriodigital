import { HttpErrorResponse } from '@angular/common/http';

import { REQUEST_EXPORT_MAX_ROWS } from '../request-list-query';

export interface ExportFailure {
  message: string;
  /** Solo una falla temporal se resuelve repitiendo la descarga. */
  retry: boolean;
}

export const EXPORT_MAX_ROWS_LABEL = new Intl.NumberFormat('es-CL').format(REQUEST_EXPORT_MAX_ROWS);

const chileDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santiago',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * El mismo nombre que arma requests. Se calcula aquí porque el CORS del BFF y del Gateway no expone
 * Content-Disposition.
 */
export function exportFileName(now: Date): string {
  return `tramites-${chileDate.format(now)}.csv`;
}

/**
 * Un 401 que llega hasta aquí ya pasó por MsalInterceptor, que renueva el token o redirige al login:
 * repetir la descarga no lo resuelve, igual que un 403.
 */
export function exportFailure(error: unknown): ExportFailure {
  const generic = { message: 'No se pudo generar el archivo. Intenta nuevamente.', retry: false };
  if (!(error instanceof HttpErrorResponse)) {
    return generic;
  }
  if (error.status === 0) {
    return {
      message: 'No se pudo generar el archivo. Revisa tu conexión e intenta nuevamente.',
      retry: true,
    };
  }
  if (error.status >= 500) {
    return { ...generic, retry: true };
  }
  switch (error.status) {
    case 400:
      return {
        message: `No se pudo exportar con estos filtros. Si son más de ${EXPORT_MAX_ROWS_LABEL} trámites, filtra por fecha o estado.`,
        retry: false,
      };
    case 401:
      return {
        message: 'Tu sesión ya no permite exportar. Inicia sesión nuevamente.',
        retry: false,
      };
    case 403:
      return { message: 'Tu cuenta no tiene permiso para exportar trámites.', retry: false };
    default:
      return generic;
  }
}
