import { TestBed } from '@angular/core/testing';

import { RequestPrivacyNoticeComponent } from './request-privacy-notice.component';

describe('RequestPrivacyNoticeComponent', () => {
  let element: HTMLElement;

  beforeEach(async () => {
    const fixture = TestBed.createComponent(RequestPrivacyNoticeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    element = fixture.nativeElement;
  });

  const words = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('muestra el uso de los datos y deja el detalle plegado', () => {
    expect(words(element.querySelector('.privacy-notice__lead span'))).toBe(
      'Usamos los datos que ingresas para gestionar y dar seguimiento a tu trámite.',
    );
    const details = element.querySelector('details')!;
    expect(details.open).toBe(false);
    expect(words(details.querySelector('summary'))).toContain('Cómo usamos tus datos');
  });

  it('detalla qué se guarda, para qué y quién accede, sin promesas absolutas', () => {
    const groups = [...element.querySelectorAll('dt')].map((term) => words(term));
    expect(groups).toEqual(['Qué datos guardamos', 'Para qué', 'Quién accede']);

    const text = words(element);
    expect(text).toContain('Tu nombre y correo, desde tu cuenta.');
    expect(text).toContain('sin los datos internos del archivo, como la ubicación GPS');
    expect(text).toContain('Elaborar reportes de la gestión municipal');
    expect(text).toContain('para la auditoría interna');
    expect(text).toContain('La auditoría interna, sin ver tu correo.');
    expect(text).toContain('Otros vecinos no ven tus datos, tu descripción ni tu dirección.');
    expect(text).toContain(
      'Al buscar posibles duplicados, otros vecinos pueden ver el tipo, el estado, el sector, el folio',
    );
    expect(text).toContain('Ley N° 19.628');
    expect(text).not.toMatch(/\bsolo\b/i);
  });

  it('no pide aceptación: no hay controles fuera del desplegable', () => {
    expect(element.querySelectorAll('input, button')).toHaveLength(0);
  });
});
