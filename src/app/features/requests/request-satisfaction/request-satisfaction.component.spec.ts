import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { Request } from '../../../shared/models/request.model';
import { RequestsService } from '../requests.service';
import { RequestSatisfactionComponent } from './request-satisfaction.component';

describe('RequestSatisfactionComponent', () => {
  let fixture: ComponentFixture<RequestSatisfactionComponent>;
  let element: HTMLElement;
  let rate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    rate = vi.fn();
    await TestBed.configureTestingModule({
      imports: [RequestSatisfactionComponent],
      providers: [{ provide: RequestsService, useValue: { rate } }],
    }).compileComponents();
    fixture = TestBed.createComponent(RequestSatisfactionComponent);
    fixture.componentRef.setInput('requestId', 'req-1');
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  const button = (label: string) => {
    const found = [...element.querySelectorAll<HTMLButtonElement>('button')].find((item) =>
      item.textContent?.trim().includes(label),
    );
    if (!found) throw new Error(`No está el botón ${label}`);
    return found;
  };

  const scoreButton = (value: number) =>
    element.querySelector<HTMLButtonElement>(`[aria-label^="Nota ${value} de 5"]`)!;

  it('sin nota el envío queda deshabilitado', () => {
    expect(button('Enviar calificación').disabled).toBe(true);
    expect(rate).not.toHaveBeenCalled();
  });

  it('nota alta envía score y comentario opcional', async () => {
    const rated: Request = {
      id: 'req-1',
      description: 'd',
      procedureType: 'bache',
      address: 'a',
      status: 'RESUELTO',
      rejectionReason: null,
      createdAt: '2026-11-13T12:00:00.000Z',
      solicitanteId: 'oid',
      satisfactionScore: 4,
      satisfactionComment: 'Ok',
    };
    rate.mockReturnValue(of(rated));
    const emitted = vi.fn();
    fixture.componentInstance.rated.subscribe(emitted);

    scoreButton(4).click();
    fixture.componentInstance['comment'].set('Ok');
    fixture.detectChanges();
    button('Enviar calificación').click();
    await fixture.whenStable();

    expect(rate).toHaveBeenCalledWith('req-1', { score: 4, comment: 'Ok' });
    expect(emitted).toHaveBeenCalledWith(rated);
  });

  it('nota baja exige razones y las junta en comment', async () => {
    rate.mockReturnValue(
      of({
        id: 'req-1',
        description: 'd',
        procedureType: 'bache',
        address: 'a',
        status: 'RESUELTO',
        rejectionReason: null,
        createdAt: '2026-11-13T12:00:00.000Z',
        solicitanteId: 'oid',
        satisfactionScore: 1,
        satisfactionComment: 'Demoró demasiado; Otros: Nunca llamaron',
      }),
    );

    scoreButton(1).click();
    await fixture.whenStable();
    expect(element.textContent).toContain('¿Por qué no quedaste conforme?');
    expect(button('Enviar calificación').disabled).toBe(true);

    button('Demoró demasiado').click();
    button('Otros').click();
    fixture.componentInstance['otherText'].set('Nunca llamaron');
    fixture.detectChanges();
    button('Enviar calificación').click();
    await fixture.whenStable();

    expect(rate).toHaveBeenCalledWith('req-1', {
      score: 1,
      comment: 'Demoró demasiado; Otros: Nunca llamaron',
    });
  });

  it('muestra el mensaje de conflicto del BFF', async () => {
    rate.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { message: 'El tramite ya fue calificado' },
          }),
      ),
    );
    scoreButton(5).click();
    await fixture.whenStable();
    button('Enviar calificación').click();
    await fixture.whenStable();

    expect(element.textContent).toContain('El tramite ya fue calificado');
  });
});
