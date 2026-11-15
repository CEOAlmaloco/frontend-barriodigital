import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { Request } from '../../../shared/models/request.model';
import {
  RequestRejectionReasonDialogComponent,
  RequestRejectionReasonDialogData,
} from './request-rejection-reason-dialog.component';

describe('RequestRejectionReasonDialogComponent', () => {
  const render = async (request: Partial<Request>) => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            request: {
              address: 'Av. Los Aromos 1450',
              rejectionReason: 'Fuera de la comuna.',
              ...request,
            },
            procedureTypeLabel: 'Bache en la calzada',
          } as RequestRejectionReasonDialogData,
        },
      ],
    });
    const fixture = TestBed.createComponent(RequestRejectionReasonDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('el enlace al mapa avisa que abre otra pestaña y no expone la página de origen', async () => {
    const element = await render({ latitude: -33.45, longitude: -70.66 });

    const link = element.querySelector('a')!;
    expect(link.textContent).toContain('Ver en el mapa');
    expect(link.querySelector('.cdk-visually-hidden')?.textContent).toBe(
      '(se abre en otra pestaña)',
    );
    expect(link.querySelector('mat-icon')?.getAttribute('aria-hidden')).toBe('true');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
  });

  it('sin punto no muestra el lugar ni el enlace', async () => {
    const element = await render({ latitude: null, longitude: null });

    expect(element.querySelector('a')).toBeNull();
    expect(Array.from(element.querySelectorAll('dt'), (term) => term.textContent?.trim())).toEqual([
      'Tipo de trámite',
      'Dirección o ubicación',
      'Motivo',
    ]);
  });
});
