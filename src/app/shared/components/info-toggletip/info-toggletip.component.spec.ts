import { OverlayContainer } from '@angular/cdk/overlay';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InfoToggletipComponent } from './info-toggletip.component';

@Component({
  imports: [InfoToggletipComponent],
  template: `
    <app-info-toggletip topic="plazo" text="Se cuentan días hábiles." />
    <app-info-toggletip topic="cupo" text="Máximo por día." />
    <p class="outside">Fuera</p>
  `,
})
class HostComponent {}

describe('InfoToggletipComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let overlay: HTMLElement;

  const buttons = () =>
    Array.from(
      fixture.nativeElement.querySelectorAll('app-info-toggletip button'),
    ) as HTMLButtonElement[];
  const bubbles = () => Array.from(overlay.querySelectorAll('.toggletip__bubble'));
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
    await settle();
  });

  afterEach(() => overlay.replaceChildren());

  it('nombra el botón con el tema y parte cerrado', () => {
    const [button] = buttons();
    expect(button.getAttribute('aria-label')).toBe('Más información: plazo');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.hasAttribute('aria-controls')).toBe(false);
    expect(bubbles()).toHaveLength(0);
  });

  it('se abre con clic y se anuncia, con el globo asociado al botón', async () => {
    const [button] = buttons();
    button.click();
    await settle();

    const [bubble] = bubbles();
    expect(bubble.textContent).toBe('Se cuentan días hábiles.');
    expect(bubble.getAttribute('role')).toBe('status');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBe(bubble.id);

    button.click();
    await settle();
    expect(bubbles()).toHaveLength(0);
  });

  it('Escape lo cierra y deja el foco en el botón', async () => {
    const [button] = buttons();
    button.focus();
    button.click();
    await settle();

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(bubbles()).toHaveLength(0);
    expect(document.activeElement).toBe(button);
  });

  it('un clic fuera lo cierra, y abrir otro cierra el anterior', async () => {
    const [first, second] = buttons();
    first.click();
    await settle();
    fixture.nativeElement.querySelector('.outside').click();
    await settle();
    expect(bubbles()).toHaveLength(0);

    first.click();
    await settle();
    second.click();
    await settle();
    expect(bubbles().map((bubble) => bubble.textContent)).toEqual(['Máximo por día.']);
    expect(first.getAttribute('aria-expanded')).toBe('false');
  });
});
