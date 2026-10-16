import { TestBed } from '@angular/core/testing';

import { AuditComponent } from './audit.component';

describe('AuditComponent', () => {
  it('muestra el título y el mensaje provisional dentro del contenido principal', async () => {
    await TestBed.configureTestingModule({
      imports: [AuditComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(AuditComponent);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('main h1')?.textContent).toBe('Auditoría');
    expect(element.querySelector('main p')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'El historial de eventos de los trámites estará disponible cuando se implemente la integración con Kafka.',
    );
  });
});
