import { OverlayContainer } from '@angular/cdk/overlay';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, Subject, firstValueFrom, of, throwError } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { Request, RequestStatus, RequestTransitions } from '../../shared/models/request.model';
import { Role } from '../../shared/models/role';
import {
  RequestStatusDialogComponent,
  RequestStatusDialogResult,
} from './request-status-dialog/request-status-dialog.component';
import { RequestsComponent } from './requests.component';
import { RequestsService } from './requests.service';

describe('RequestsComponent', () => {
  const mine: Request = {
    id: 'propio',
    description: 'Rama sobre el cable',
    procedureType: 'alumbrado',
    address: 'Calle 1',
    status: 'INGRESADO',
    rejectionReason: null,
    createdAt: '2026-09-01T12:00:00.000Z',
    solicitanteId: 'vecino-actual',
  };
  const other: Request = {
    ...mine,
    id: 'ajeno',
    description: 'Bache de otro vecino',
    solicitanteId: 'otro-vecino',
  };

  let service: {
    getRequests: ReturnType<typeof vi.fn>;
    createRequest: ReturnType<typeof vi.fn>;
    getTransitions: ReturnType<typeof vi.fn>;
    changeStatus: ReturnType<typeof vi.fn>;
  };
  let fixture: ComponentFixture<RequestsComponent>;
  let element: HTMLElement;

  const render = async (
    role: Role,
    getRequests: () => Observable<Request[]> = () => of([mine, other]),
    getTransitions: () => Observable<RequestTransitions> = () =>
      throwError(() => new Error('acciones no disponibles')),
  ) => {
    service = {
      getRequests: vi.fn(getRequests),
      createRequest: vi.fn(() => of(mine)),
      getTransitions: vi.fn(getTransitions),
      changeStatus: vi.fn(),
    };
    const auth = { hasRole: (userRole: string) => userRole === role };

    await TestBed.configureTestingModule({
      imports: [RequestsComponent],
      providers: [
        { provide: RequestsService, useValue: service },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RequestsComponent);
    element = fixture.nativeElement;
    await fixture.whenStable();
  };

  const text = () => element.textContent ?? '';
  const headers = () => Array.from(element.querySelectorAll('th'), (header) => header.textContent?.trim());
  const submitButton = () => element.querySelector<HTMLButtonElement>('.requests__submit');

  it('Vecino: ve el formulario, sin filtros, y lo que entrega el servidor sin volver a filtrarlo', async () => {
    await render(Role.Vecino);

    expect(element.querySelector('.requests__card')).not.toBeNull();
    expect(element.querySelector('#requests-list-title')?.textContent).toContain('Mis trámites');
    expect(element.querySelector('.requests__filters')).toBeNull();
    expect(service.getRequests).toHaveBeenCalledWith(undefined);
    expect(text()).toContain('Rama sobre el cable');
    expect(text()).toContain('Bache de otro vecino');
    expect(headers()).toEqual(['Tipo', 'Descripción', 'Estado', 'Fecha']);
  });

  it('Funcionario: sin formulario, con filtros, todos los trámites y sin columna Solicitante', async () => {
    await render(Role.Funcionario);

    expect(element.querySelector('.requests__card')).toBeNull();
    expect(element.querySelector('#requests-list-title')?.textContent).toContain('Todos los trámites');
    expect(element.querySelector('.requests__filters')).not.toBeNull();
    expect(text()).toContain('Bache de otro vecino');
    expect(headers()).toEqual(['Tipo', 'Descripción', 'Estado', 'Fecha', 'Acciones']);
    expect(text()).not.toContain('otro-vecino');
  });

  it('Funcionario: pide el listado con los filtros elegidos', async () => {
    await render(Role.Funcionario);

    fixture.componentInstance['filters'].setValue({ status: 'RESUELTO', from: new Date(2026, 8, 1), to: null });
    await fixture.whenStable();

    expect(service.getRequests).toHaveBeenLastCalledWith({ status: 'RESUELTO', from: '2026-09-01' });
  });

  it('muestra la etiqueta del tipo y, si el código no está en la lista, el código crudo', async () => {
    await render(Role.Vecino, () => of([mine, { ...other, procedureType: 'desconocido' }]));

    expect(text()).toContain('Alumbrado público');
    expect(text()).toContain('desconocido');
  });

  it('no envía el formulario vacío y muestra el error de cada campo obligatorio', async () => {
    await render(Role.Vecino);

    submitButton()?.click();
    await fixture.whenStable();

    expect(service.createRequest).not.toHaveBeenCalled();
    expect(element.querySelectorAll('mat-error').length).toBe(3);
  });

  it('crea el trámite, avisa con un snackbar y recarga el listado', async () => {
    await render(Role.Vecino);
    const openSnackBar = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
    const payload = { procedureType: 'otro', description: 'Poste caído', address: 'Calle 2' };

    fixture.componentInstance['createForm'].setValue(payload);
    submitButton()?.click();
    await fixture.whenStable();

    expect(service.createRequest).toHaveBeenCalledWith(payload);
    expect(openSnackBar).toHaveBeenCalledWith('Trámite ingresado.', undefined, { duration: 3000 });
    expect(service.getRequests).toHaveBeenCalledTimes(2);
  });

  it('si falla la carga ofrece Reintentar y vuelve a pedir el listado', async () => {
    let attempts = 0;
    await render(Role.Vecino, () => (attempts++ === 0 ? throwError(() => new Error('sin red')) : of([])));

    expect(text()).toContain('No se pudieron cargar los trámites.');

    Array.from(element.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Reintentar'))
      ?.click();
    await fixture.whenStable();

    expect(service.getRequests).toHaveBeenCalledTimes(2);
    expect(text()).toContain('Aún no has ingresado trámites.');
  });

  it.each([
    ['INGRESADO', 'ADMITIDO', 'Admitir'],
    ['ADMITIDO', 'EN_GESTION', 'Pasar a gestión'],
    ['EN_GESTION', 'EN_TERRENO', 'Enviar a terreno'],
    ['EN_TERRENO', 'RESUELTO', 'Resolver'],
  ] as const)(
    '%s: muestra la acción principal y el menú en tabla y tarjetas',
    async (status, next, label) => {
      const transitions: RequestTransitions = {
        INGRESADO: [],
        ADMITIDO: [],
        EN_GESTION: [],
        EN_TERRENO: [],
        RESUELTO: [],
        RECHAZADO: [],
        [status]: [next, 'RECHAZADO'],
      };
      await render(
        Role.Funcionario,
        () => of([{ ...mine, status }]),
        () => of(transitions),
      );

      for (const container of ['.requests__table', '.requests__cards']) {
        expect(
          element.querySelector(`${container} .request-actions__primary`)?.textContent?.trim(),
        ).toBe(label);
        expect(element.querySelector(`${container} .request-actions__menu-trigger`)).not.toBeNull();
      }
    },
  );

  it.each(['loading', 'error'] as const)(
    'transiciones en %s: solo los estados terminales muestran Flujo finalizado',
    async (state) => {
      await render(
        Role.Funcionario,
        () =>
          of([
            mine,
            { ...other, status: 'RESUELTO' },
            { ...mine, id: 'rechazado', status: 'RECHAZADO' },
          ]),
        () =>
          state === 'loading'
            ? new Subject<RequestTransitions>()
            : throwError(() => new Error('sin red')),
      );

      for (const container of ['.requests__table', '.requests__cards']) {
        expect(element.querySelectorAll(`${container} .request-actions__finished`)).toHaveLength(2);
        expect(element.querySelector(`${container} .request-actions__primary`)).toBeNull();
        expect(element.querySelector(`${container} .request-actions__menu-trigger`)).toBeNull();
      }
    },
  );

  it.each([Role.Funcionario, Role.Vecino])(
    '%s: abre el motivo completo sin peticiones y devuelve el foco al cerrar',
    async (role) => {
      const reason = 'Primera línea.\n' + 'TextoSinEspacios'.repeat(30);
      await render(role, () =>
        of([
          { ...mine, status: 'RECHAZADO', rejectionReason: reason },
          { ...other, status: 'RECHAZADO', rejectionReason: '   ' },
          { ...mine, id: 'no-rechazado', rejectionReason: 'Motivo de otro estado' },
        ]),
      );
      const overlay = TestBed.inject(OverlayContainer).getContainerElement();

      for (const container of ['.requests__table', '.requests__cards']) {
        const triggers = element.querySelectorAll<HTMLButtonElement>(
          `${container} .requests__rejection-reason`,
        );
        expect(triggers).toHaveLength(1);
        const trigger = triggers[0];
        expect(trigger.textContent?.trim()).toBe('Ver motivo');
        expect(trigger.tagName).toBe('BUTTON');
        expect(trigger.parentElement?.classList.contains('requests__state')).toBe(true);
        expect(trigger.previousElementSibling?.classList.contains('badge')).toBe(true);
        expect(trigger.getAttribute('aria-label')).toContain(mine.id);
        expect(trigger.getAttribute('aria-label')).toContain('Ver motivo del rechazo');
        expect(element.textContent).not.toContain(reason);
        vi.spyOn(trigger, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
        trigger.click();
        await fixture.whenStable();

        const dialogRef = TestBed.inject(MatDialog).openDialogs[0];
        expect(dialogRef.disableClose).toBe(false);
        expect(
          overlay.querySelector('.cdk-overlay-pane')?.classList.contains('request-dialog'),
        ).toBe(true);
        expect(overlay.textContent).toContain('Motivo del rechazo');
        expect(overlay.textContent).toContain('Alumbrado público');
        expect(overlay.textContent).toContain(mine.address);
        expect(
          Array.from(overlay.querySelectorAll('dt'), (label) => label.textContent?.trim()),
        ).toEqual([
          'Tipo de trámite',
          'Dirección o ubicación',
          'Motivo',
        ]);
        expect(overlay.querySelector('dd.rejection-reason-dialog__reason')).not.toBeNull();
        expect(overlay.querySelector('.rejection-reason-dialog__reason')?.textContent).toBe(reason);
        const closed = firstValueFrom(dialogRef.afterClosed());
        overlay.querySelector<HTMLButtonElement>('button')!.click();
        await closed;
        await fixture.whenStable();

        expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
        expect(document.activeElement).toBe(trigger);
      }

      expect(service.getRequests).toHaveBeenCalledTimes(1);
      expect(service.changeStatus).not.toHaveBeenCalled();
      if (role === Role.Vecino) {
        expect(element.querySelector('app-request-actions')).toBeNull();
      }
    },
  );

  it.each(['Escape', 'backdrop'] as const)(
    'el diálogo de lectura permite cerrar con %s sin recargar',
    async (closeWith) => {
      await render(Role.Vecino, () =>
        of([{ ...mine, status: 'RECHAZADO', rejectionReason: 'Antecedentes incompletos.' }]),
      );
      element.querySelector<HTMLButtonElement>('.requests__rejection-reason')!.click();
      await fixture.whenStable();
      const overlay = TestBed.inject(OverlayContainer).getContainerElement();
      const closed = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0].afterClosed());

      if (closeWith === 'Escape') {
        overlay
          .querySelector('mat-dialog-container')!
          .dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
          );
      } else {
        overlay.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
      }
      await closed;
      await fixture.whenStable();

      expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
      expect(service.getRequests).toHaveBeenCalledTimes(1);
      expect(service.changeStatus).not.toHaveBeenCalled();
    },
  );

  describe('diálogo de cambio de estado', () => {
    const reason = '  Antecedentes incompletos.  ';
    const transitions: RequestTransitions = {
      INGRESADO: ['ADMITIDO', 'RECHAZADO'],
      ADMITIDO: ['EN_GESTION', 'RECHAZADO'],
      EN_GESTION: ['EN_TERRENO', 'RECHAZADO'],
      EN_TERRENO: ['RESUELTO', 'RECHAZADO'],
      RESUELTO: [],
      RECHAZADO: [],
    };
    const overlay = () => TestBed.inject(OverlayContainer).getContainerElement();
    const dialogButton = (label: string) =>
      Array.from(overlay().querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.trim() === label,
      )!;
    const openDialog = async (status: RequestStatus = 'RECHAZADO') => {
      const trigger = element.querySelector<HTMLButtonElement>('app-request-actions button')!;
      fixture.componentInstance['openStatusDialog'](mine, { status, trigger });
      await fixture.whenStable();
      return TestBed.inject(MatDialog).openDialogs[0] as MatDialogRef<
        RequestStatusDialogComponent,
        RequestStatusDialogResult
      >;
    };
    const writeReason = () => {
      const textarea = overlay().querySelector<HTMLTextAreaElement>('textarea')!;
      textarea.value = reason;
      textarea.dispatchEvent(new Event('input'));
      return textarea;
    };

    beforeEach(async () => {
      await render(
        Role.Funcionario,
        () => of([mine, other]),
        () => of(transitions),
      );
    });

    it('mantiene el contador asociado al campo y visible cuando hay errores', async () => {
      const dialogRef = await openDialog();
      const textarea = overlay().querySelector<HTMLTextAreaElement>('textarea')!;
      const counter = overlay().querySelector<HTMLElement>('.status-dialog__counter')!;

      expect(overlay().querySelector('mat-error')).toBeNull();
      expect(counter.textContent?.trim()).toBe('0 / 500');
      expect(textarea.getAttribute('aria-describedby')).toContain(counter.id);
      expect(textarea.maxLength).toBe(500);

      textarea.value = '   ';
      textarea.dispatchEvent(new Event('input'));
      dialogButton('Confirmar rechazo').click();
      await fixture.whenStable();

      const error = overlay().querySelector<HTMLElement>('mat-error')!;
      expect(error.textContent).toContain('Indica un motivo de rechazo que no esté vacío.');
      expect(counter.textContent?.trim()).toBe('3 / 500');
      expect(textarea.getAttribute('aria-describedby')).toContain(counter.id);
      expect(textarea.getAttribute('aria-describedby')).toContain(error.id);
      expect(overlay().querySelector('mat-hint')).toBeNull();
      expect(service.changeStatus).not.toHaveBeenCalled();
      dialogRef.close();
      await fixture.whenStable();
    });

    it('conserva la variante de rechazo y bloquea campo, controles y cierre durante el envío', async () => {
      service.changeStatus.mockReturnValue(new Subject<Request>());
      const dialogRef = await openDialog();
      const textarea = writeReason();
      const confirm = dialogButton('Confirmar rechazo');
      confirm.click();
      await fixture.whenStable();

      expect(confirm.classList.contains('status-dialog__confirm--reject')).toBe(true);
      expect(confirm.disabled).toBe(true);
      expect(textarea.disabled).toBe(true);
      expect(dialogButton('Cancelar').disabled).toBe(true);
      expect(overlay().querySelector('.status-dialog__spinner')).not.toBeNull();
      expect(dialogRef.disableClose).toBe(true);
      overlay().querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
      overlay()
        .querySelector('mat-dialog-container')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
      await fixture.whenStable();
      expect(TestBed.inject(MatDialog).openDialogs).toContain(dialogRef);
      expect(service.changeStatus).toHaveBeenCalledTimes(1);
      dialogRef.close();
      await fixture.whenStable();
    });

    it.each([404, 409])(
      'HTTP %s: bloquea el reenvío y permite recargar con los filtros actuales',
      async (status) => {
        fixture.componentInstance['filters'].setValue({
          status: 'INGRESADO',
          from: new Date(2026, 8, 1),
          to: new Date(2026, 8, 30),
        });
        await fixture.whenStable();
        const callsBeforeDialog = service.getRequests.mock.calls.length;
        const response = new Subject<Request>();
        service.changeStatus.mockReturnValue(response);
        const openSnackBar = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
        const dialogRef = await openDialog();
        const textarea = writeReason();

        dialogButton('Confirmar rechazo').click();
        await fixture.whenStable();
        expect(dialogRef.disableClose).toBe(true);
        expect(dialogButton('Cancelar').disabled).toBe(true);
        expect(service.changeStatus).toHaveBeenCalledWith(mine.id, {
          status: 'RECHAZADO',
          rejectionReason: reason.trim(),
        });

        response.error(
          new HttpErrorResponse({
            status,
            error: { message: 'No se puede pasar de RESUELTO a RECHAZADO' },
          }),
        );
        await fixture.whenStable();

        expect(TestBed.inject(MatDialog).openDialogs).toContain(dialogRef);
        expect(overlay().textContent).toContain(
          status === 404
            ? 'El trámite ya no está disponible. Actualiza la lista.'
            : 'No se puede pasar de Resuelto a Rechazado. Actualiza la lista.',
        );
        expect(textarea.value).toBe(reason);
        expect(dialogRef.disableClose).toBe(false);
        expect(dialogButton('Cancelar').disabled).toBe(false);
        expect(overlay().querySelector('button[type="submit"]')).toBeNull();
        const reloadButton = dialogButton('Cerrar y actualizar lista');
        expect(reloadButton.type).toBe('button');
        expect(reloadButton.classList.contains('status-dialog__confirm--reject')).toBe(false);

        textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        overlay()
          .querySelector('form')!
          .dispatchEvent(
            new Event('submit', {
              bubbles: true,
              cancelable: true,
            }),
          );
        dialogRef.componentInstance['submit']();
        await fixture.whenStable();
        expect(service.changeStatus).toHaveBeenCalledTimes(1);
        expect(service.getRequests).toHaveBeenCalledTimes(callsBeforeDialog);

        const result = firstValueFrom(dialogRef.afterClosed());
        service.getRequests.mockReturnValueOnce(throwError(() => new Error('sin red')));
        reloadButton.click();
        expect(await result).toEqual({ kind: 'reload' });
        await fixture.whenStable();

        expect(service.getRequests).toHaveBeenCalledTimes(callsBeforeDialog + 1);
        expect(service.getRequests).toHaveBeenLastCalledWith({
          status: 'INGRESADO',
          from: '2026-09-01',
          to: '2026-09-30',
        });
        expect(service.changeStatus).toHaveBeenCalledTimes(1);
        expect(openSnackBar).not.toHaveBeenCalled();
        expect(text()).toContain('No se pudieron cargar los trámites.');
        expect(text()).not.toContain('El cambio se guardó, pero no pudimos actualizar la lista.');
        expect(document.activeElement).toBe(element.querySelector('#requests-list-title'));
      },
    );

    it.each([
      [404, 'Cancelar'],
      [404, 'Escape'],
      [404, 'backdrop'],
      [409, 'Cancelar'],
      [409, 'Escape'],
      [409, 'backdrop'],
    ] as const)('HTTP %s: cerrar con %s cancela sin recargar', async (status, closeWith) => {
      service.changeStatus.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
      const openSnackBar = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
      const dialogRef = await openDialog();
      writeReason();
      dialogButton('Confirmar rechazo').click();
      await fixture.whenStable();
      const result = firstValueFrom(dialogRef.afterClosed());

      if (closeWith === 'Cancelar') {
        dialogButton('Cancelar').click();
      } else if (closeWith === 'Escape') {
        overlay()
          .querySelector('mat-dialog-container')!
          .dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'Escape',
              keyCode: 27,
              bubbles: true,
            }),
          );
      } else {
        overlay().querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
      }
      expect(await result).toBeUndefined();
      await fixture.whenStable();

      expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
      expect(service.getRequests).toHaveBeenCalledTimes(1);
      expect(service.changeStatus).toHaveBeenCalledTimes(1);
      expect(openSnackBar).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(element.querySelector('#requests-list-title'));
    });

    it.each([0, 500])(
      'HTTP %s: conserva el motivo y permite reintentar el cambio',
      async (status) => {
        const saved: Request = { ...mine, status: 'RECHAZADO', rejectionReason: reason.trim() };
        service.changeStatus
          .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status })))
          .mockReturnValueOnce(of(saved));
        const openSnackBar = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
        const dialogRef = await openDialog();
        const textarea = writeReason();
        dialogButton('Confirmar rechazo').click();
        await fixture.whenStable();

        expect(textarea.value).toBe(reason);
        expect(overlay().textContent).toContain('No pudimos confirmar el cambio.');
        expect(overlay().textContent).not.toContain('Cerrar y actualizar lista');
        expect(dialogRef.disableClose).toBe(false);
        expect(dialogButton('Confirmar rechazo').disabled).toBe(false);

        const result = firstValueFrom(dialogRef.afterClosed());
        service.getRequests.mockReturnValueOnce(throwError(() => new Error('sin red')));
        dialogButton('Confirmar rechazo').click();
        expect(await result).toEqual({ kind: 'saved', request: saved });
        await fixture.whenStable();

        expect(service.changeStatus).toHaveBeenCalledTimes(2);
        expect(service.getRequests).toHaveBeenCalledTimes(2);
        expect(openSnackBar).toHaveBeenCalledWith('Estado del trámite actualizado.', undefined, {
          duration: 3000,
        });
        expect(text()).toContain('El cambio se guardó, pero no pudimos actualizar la lista.');
      },
    );
  });
});
