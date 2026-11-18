import { TestBed } from '@angular/core/testing';

import { CookieConsentService } from './cookie-consent.service';

describe('CookieConsentService', () => {
  beforeEach(() => {
    localStorage.removeItem('bd.cookies');
    TestBed.configureTestingModule({});
  });

  it('pide decisión si no hay preferencia guardada', () => {
    const service = TestBed.inject(CookieConsentService);
    expect(service.needsDecision()).toBe(true);
  });

  it('aceptar todas marca seguimiento y deja de pedir decisión', () => {
    const service = TestBed.inject(CookieConsentService);
    service.acceptAll();
    expect(service.needsDecision()).toBe(false);
    expect(service.preferences().tracking).toBe(true);
    expect(service.preferences().technical).toBe(true);
  });

  it('rechazar todas deja seguimiento apagado', () => {
    const service = TestBed.inject(CookieConsentService);
    service.rejectAll();
    expect(service.needsDecision()).toBe(false);
    expect(service.preferences().tracking).toBe(false);
  });

  it('guardar respeta el seguimiento elegido', () => {
    const service = TestBed.inject(CookieConsentService);
    service.save(true);
    expect(service.preferences().tracking).toBe(true);
    expect(JSON.parse(localStorage.getItem('bd.cookies')!).tracking).toBe(true);
  });
});
