import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { SiteFooterComponent } from './site-footer.component';

describe('SiteFooterComponent', () => {
  let element: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(SiteFooterComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    element = fixture.nativeElement;
  });

  const link = (text: string) =>
    [...element.querySelectorAll('a')].find((anchor) => anchor.textContent?.trim() === text);

  it('es el pie del sitio, con su navegación nombrada', () => {
    expect(element.querySelector('footer')).not.toBeNull();
    expect(element.querySelector('nav')?.getAttribute('aria-label')).toBe('Información del sitio');
  });

  it('enlaza la privacidad, la accesibilidad, las condiciones de uso y el soporte', () => {
    expect(link('Privacidad')?.getAttribute('href')).toBe('/legal/privacidad');
    expect(link('Accesibilidad')?.getAttribute('href')).toBe('/legal/accesibilidad');
    expect(link('Condiciones de uso')?.getAttribute('href')).toBe('/legal/condiciones-de-uso');
    expect(link('Soporte')?.getAttribute('href')).toBe(`mailto:${environment.supportEmail}`);
  });

  it('no ofrece configurar cookies: el sitio no usa cookies opcionales', () => {
    expect(element.textContent).not.toMatch(/cookies/i);
    expect(element.querySelectorAll('button')).toHaveLength(0);
  });
});
