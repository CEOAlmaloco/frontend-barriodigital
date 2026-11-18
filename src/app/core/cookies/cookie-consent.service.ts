import { Injectable, signal } from '@angular/core';

import {
  DEFAULT_COOKIE_CONSENT,
  type CookieConsentPreferences,
} from './cookie-consent.model';

const STORAGE_KEY = 'bd.cookies';

/**
 * Guarda la aceptación de cookies en este navegador.
 * Las técnicas quedan siempre activas; el seguimiento es opcional.
 */
@Injectable({ providedIn: 'root' })
export class CookieConsentService {
  readonly preferences = signal<CookieConsentPreferences>(DEFAULT_COOKIE_CONSENT);
  /** Contador para pedir abrir el panel desde otras pantallas (footer, docs). */
  readonly openRequests = signal(0);

  constructor() {
    this.preferences.set(this.read());
  }

  needsDecision(): boolean {
    return !this.preferences().decided;
  }

  /** Abre el panel de configuración (lo escucha `app-cookie-consent`). */
  requestOpen(): void {
    this.openRequests.update((n) => n + 1);
  }

  acceptAll(): void {
    this.persist({ decided: true, technical: true, tracking: true });
  }

  rejectAll(): void {
    this.persist({ decided: true, technical: true, tracking: false });
  }

  save(tracking: boolean): void {
    this.persist({ decided: true, technical: true, tracking });
  }

  private persist(partial: Omit<CookieConsentPreferences, 'updatedAt'>): void {
    const next: CookieConsentPreferences = {
      ...partial,
      updatedAt: new Date().toISOString(),
    };
    this.preferences.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // modo privado o cuota llena: la sesión igual aplica la decisión
    }
  }

  private read(): CookieConsentPreferences {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { ...DEFAULT_COOKIE_CONSENT };
      }
      const parsed = JSON.parse(raw) as Partial<CookieConsentPreferences>;
      if (typeof parsed.decided !== 'boolean') {
        return { ...DEFAULT_COOKIE_CONSENT };
      }
      return {
        decided: parsed.decided,
        technical: true,
        tracking: Boolean(parsed.tracking),
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
      };
    } catch {
      return { ...DEFAULT_COOKIE_CONSENT };
    }
  }
}
