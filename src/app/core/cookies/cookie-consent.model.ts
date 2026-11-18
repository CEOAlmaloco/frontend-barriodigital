/** Preferencias de cookies guardadas en este navegador. */
export interface CookieConsentPreferences {
  /** Decisión tomada: si falta, se muestra el aviso. */
  decided: boolean;
  /** Cookies técnicas de sesión (siempre activas). */
  technical: true;
  /** Cookies de análisis y seguimiento. */
  tracking: boolean;
  updatedAt: string;
}

export const DEFAULT_COOKIE_CONSENT: CookieConsentPreferences = {
  decided: false,
  technical: true,
  tracking: false,
  updatedAt: '',
};
