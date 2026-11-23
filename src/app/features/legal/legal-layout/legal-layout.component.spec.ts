import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { PrivacyNoticeComponent } from '../privacy-notice/privacy-notice.component';
import { TermsOfUseComponent } from '../terms-of-use/terms-of-use.component';
import { LegalLayoutComponent } from './legal-layout.component';

describe('LegalLayoutComponent', () => {
  const isAuthenticated = signal(false);

  const open = async (url: string) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'legal',
            component: LegalLayoutComponent,
            children: [
              { path: 'privacidad', component: PrivacyNoticeComponent },
              { path: 'condiciones-de-uso', component: TermsOfUseComponent },
            ],
          },
        ]),
        { provide: AuthService, useValue: { isAuthenticated } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  };

  const text = (node: Element | null | undefined) => node?.textContent?.replace(/\s+/g, ' ').trim();

  it('sin sesión ofrece iniciar sesión', async () => {
    isAuthenticated.set(false);
    const element = await open('/legal/privacidad');

    const action = element.querySelector('.legal-layout__header a[matButton]');
    expect(text(action)).toBe('Iniciar sesión');
    expect(action?.getAttribute('href')).toBe('/');
  });

  it('con sesión ofrece volver al inicio', async () => {
    isAuthenticated.set(true);
    const element = await open('/legal/privacidad');

    const action = element.querySelector('.legal-layout__header a[matButton]');
    expect(text(action)).toBe('Ir al inicio');
    expect(action?.getAttribute('href')).toBe('/inicio');
  });

  it('marca el documento abierto en la navegación', async () => {
    const element = await open('/legal/condiciones-de-uso');

    const tabs = [...element.querySelectorAll('.legal-layout__tabs a[role="tab"]')];
    const selected = tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true');
    expect(tabs).toHaveLength(3);
    expect(selected).toHaveLength(1);
    expect(text(selected[0])).toContain('Condiciones de uso');
    expect(selected[0].getAttribute('aria-controls')).toBe(
      element.querySelector('mat-tab-nav-panel')?.id,
    );
  });

  it('tiene un solo contenido principal', async () => {
    const element = await open('/legal/privacidad');

    expect(element.querySelectorAll('main')).toHaveLength(1);
    expect(element.querySelector('main h1')).not.toBeNull();
  });
});
