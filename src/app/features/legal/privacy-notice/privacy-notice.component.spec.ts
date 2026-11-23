import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { PRIVACY_SECTIONS, PrivacyNoticeComponent } from './privacy-notice.component';

describe('PrivacyNoticeComponent', () => {
  let element: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(PrivacyNoticeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    element = fixture.nativeElement;
  });

  const words = () => element.textContent?.replace(/\s+/g, ' ') ?? '';

  it('cada entrada del índice lleva a un título que puede recibir el foco', () => {
    const entries = [...element.querySelectorAll('.legal-document__toc-list a')];
    expect(entries).toHaveLength(PRIVACY_SECTIONS.length);

    for (const section of PRIVACY_SECTIONS) {
      const heading = element.querySelector(`h2#${section.id}`);
      expect(heading?.textContent?.trim()).toBe(section.label);
      expect(heading?.getAttribute('tabindex')).toBe('-1');
    }
  });

  it('informa y no pide aceptación', () => {
    expect(element.querySelectorAll('input, button')).toHaveLength(0);
    expect(words()).toContain('No necesitas aceptar este aviso para usar el servicio.');
    expect(words()).toContain('No usamos cookies de publicidad ni de medición');
  });

  it('explica cómo ejercer los derechos y a quién escribir', () => {
    const contact = element.querySelector('#derechos')?.closest('section');
    expect(contact?.querySelector('a')?.getAttribute('href')).toBe(
      `mailto:${environment.supportEmail}`,
    );
    expect(words()).toContain('Eliminarlos o bloquearlos');
  });

  it('declara a los proveedores y dónde operan', () => {
    expect(words()).toContain('Amazon Web Services, en Estados Unidos');
    expect(words()).toContain('Oracle, en Chile');
  });
});
