import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BrandLogoVerticalComponent } from './brand-logo-vertical.component';
import { BrandLogoComponent, BrandLogoVariant } from './brand-logo.component';
import { BRAND_WORDMARK } from './brand-logo.paths';

type Variant = BrandLogoVariant | 'vertical';

@Component({
  imports: [BrandLogoComponent, BrandLogoVerticalComponent],
  template: `
    @if (variant() === 'vertical') {
      <app-brand-logo-vertical [decorative]="decorative()" />
    } @else {
      <app-brand-logo [variant]="$any(variant())" [decorative]="decorative()" />
    }
  `,
})
class HostComponent {
  readonly variant = signal<Variant>('symbol');
  readonly decorative = signal(false);
}

describe('Logo de marca', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const svg = () => fixture.nativeElement.querySelector('svg') as SVGSVGElement;
  const render = async (variant: Variant, decorative = false) => {
    host.variant.set(variant);
    host.decorative.set(decorative);
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
  });

  it.each([
    ['vertical', '76 212 1106 804', true],
    ['horizontal', '-138 798 1319 217', true],
    ['symbol', '330 206 600 600', false],
  ] as const)(
    '%s dibuja su versión y el nombre solo si lo lleva',
    async (variant, viewBox, named) => {
      await render(variant);

      expect(svg().getAttribute('viewBox')).toBe(viewBox);
      const paths = Array.from(svg().querySelectorAll('path'), (path) => path.getAttribute('d'));
      expect(paths.includes(BRAND_WORDMARK.barrio)).toBe(named);
      expect(paths.includes(BRAND_WORDMARK.digital)).toBe(named);
    },
  );

  it.each(['vertical', 'horizontal', 'symbol'] as const)(
    '%s por defecto es una imagen con el nombre de la marca',
    async (variant) => {
      await render(variant);

      expect(svg().getAttribute('role')).toBe('img');
      expect(svg().getAttribute('aria-label')).toBe('BarrioDigital');
      expect(svg().hasAttribute('aria-hidden')).toBe(false);
      expect(svg().getAttribute('focusable')).toBe('false');
    },
  );

  it.each(['vertical', 'horizontal', 'symbol'] as const)(
    '%s decorativo queda fuera del árbol de accesibilidad',
    async (variant) => {
      await render(variant, true);

      expect(svg().getAttribute('aria-hidden')).toBe('true');
      expect(svg().hasAttribute('role')).toBe(false);
      expect(svg().hasAttribute('aria-label')).toBe(false);
    },
  );

  it.each(['vertical', 'horizontal', 'symbol'] as const)(
    '%s toma los colores de clases, sin colores escritos en el dibujo',
    async (variant) => {
      await render(variant);

      const shapes = Array.from(svg().querySelectorAll('path, rect, circle'));
      expect(shapes.length).toBeGreaterThan(0);
      for (const shape of shapes) {
        expect(shape.getAttribute('class')).toMatch(/\bbl-/);
        expect(shape.hasAttribute('fill')).toBe(false);
        expect(shape.hasAttribute('stroke')).toBe(false);
      }
    },
  );
});
