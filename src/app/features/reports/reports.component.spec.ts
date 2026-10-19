import { TestBed } from '@angular/core/testing';

import { ReportsComponent } from './reports.component';

describe('ReportsComponent', () => {
  it('muestra el título y el mensaje provisional dentro del contenido principal', async () => {
    await TestBed.configureTestingModule({
      imports: [ReportsComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(ReportsComponent);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('main h1')?.textContent).toBe('Reportes');
    expect(element.querySelector('main p')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Los indicadores comunales estarán disponibles cuando se implemente el procesamiento de eventos con Kafka.',
    );
  });
});
