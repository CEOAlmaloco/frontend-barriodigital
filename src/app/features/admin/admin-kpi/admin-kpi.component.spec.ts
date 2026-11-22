import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AdminKpiComponent, AdminKpiTone } from './admin-kpi.component';

@Component({
  imports: [AdminKpiComponent],
  template: `
    <dl>
      <div
        app-admin-kpi
        icon="report"
        label="Mensajes en DLQ"
        [value]="value()"
        [tone]="tone()"
        placeholder="Consultando…"
      ></div>
    </dl>
  `,
})
class HostComponent {
  readonly value = signal<number | null>(3);
  readonly tone = signal<AdminKpiTone>('error');
}

describe('AdminKpiComponent', () => {
  const render = async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const tile = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[app-admin-kpi]',
    )!;
    return { fixture, tile };
  };

  it('es un div con dt y dd dentro del dl, con el ícono oculto a lectores de pantalla', async () => {
    const { tile } = await render();
    expect(tile.tagName).toBe('DIV');
    expect(Array.from(tile.children, (child) => child.tagName)).toEqual(['DT', 'DD']);
    expect(tile.querySelector('dt .kpi__icon')?.getAttribute('aria-hidden')).toBe('true');
    expect(tile.querySelector('dt')?.lastChild?.textContent?.trim()).toBe('Mensajes en DLQ');
    expect(tile.querySelector('dd')?.textContent?.trim()).toBe('3');
  });

  it('aplica el tono solo con valor mayor que 0; en 0 queda neutro', async () => {
    const { fixture, tile } = await render();
    expect(tile.getAttribute('data-tone')).toBe('error');
    fixture.componentInstance.value.set(0);
    await fixture.whenStable();
    expect(tile.hasAttribute('data-tone')).toBe(false);
    expect(tile.querySelector('dd')?.textContent?.trim()).toBe('0');
  });

  it('sin dato muestra el texto de reemplazo y queda neutro', async () => {
    const { fixture, tile } = await render();
    fixture.componentInstance.value.set(null);
    await fixture.whenStable();
    expect(tile.hasAttribute('data-tone')).toBe(false);
    expect(tile.querySelector('dd')?.classList).toContain('kpi__placeholder');
    expect(tile.querySelector('dd')?.textContent?.trim()).toBe('Consultando…');
  });
});
