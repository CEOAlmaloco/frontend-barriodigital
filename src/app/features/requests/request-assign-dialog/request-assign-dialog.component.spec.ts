import { OverlayContainer } from '@angular/cdk/overlay';
import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable, Subject, firstValueFrom, of, throwError } from 'rxjs';

import { Assignee, Request } from '../../../shared/models/request.model';
import { RequestsService } from '../requests.service';
import {
  RequestAssignDialogComponent,
  RequestAssignDialogData,
  RequestAssignDialogResult,
} from './request-assign-dialog.component';

describe('RequestAssignDialogComponent', () => {
  const staff: Assignee[] = [
    { id: 'oid-ana', name: 'Ana Huenchullán Rivas' },
    { id: 'oid-camila', name: 'Camila Sandoval Ñanco' },
    { id: 'oid-pedro', name: 'Pedro Levi Manquepi' },
  ];
  const unassigned: Request = {
    id: 'req-1',
    folio: 'BD-2026-000401',
    description: 'Ramas sobre el tendido',
    procedureType: 'poda',
    address: 'Cauñicú',
    status: 'INGRESADO',
    rejectionReason: null,
    createdAt: '2026-11-10T12:00:00Z',
    solicitanteId: 'vecino',
    hasAssignee: false,
    assigneeId: null,
    assigneeName: null,
  };
  const assigned: Request = {
    ...unassigned,
    hasAssignee: true,
    assigneeId: 'oid-pedro',
    assigneeName: 'Pedro Levi Manquepi',
  };

  let service: {
    getAssignees: ReturnType<typeof vi.fn>;
    assign: ReturnType<typeof vi.fn>;
    getRequest: ReturnType<typeof vi.fn>;
  };
  let ref: MatDialogRef<RequestAssignDialogComponent, RequestAssignDialogResult>;
  let overlay: HTMLElement;

  const open = async (
    request: Request,
    getAssignees: () => Observable<Assignee[]> = () => of(staff),
  ) => {
    service = {
      getAssignees: vi.fn(getAssignees),
      assign: vi.fn(),
      getRequest: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: RequestsService, useValue: service }],
    });
    ref = TestBed.inject(MatDialog).open<
      RequestAssignDialogComponent,
      RequestAssignDialogData,
      RequestAssignDialogResult
    >(RequestAssignDialogComponent, {
      data: { request, procedureTypeLabel: 'Poda de árboles', currentUserId: 'oid-pedro' },
    });
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
    await settle();
  };
  const settle = async () => {
    TestBed.inject(ApplicationRef).tick();
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.inject(ApplicationRef).tick();
  };
  const form = () => ref.componentInstance['form'];
  const submit = async () => {
    overlay.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await settle();
  };
  const text = () => overlay.textContent ?? '';

  afterEach(() => TestBed.inject(MatDialog).closeAll());

  it('primera asignación: sin motivo, y envía solo el funcionario elegido', async () => {
    await open(unassigned);
    service.assign.mockReturnValue(
      of({ ...assigned, assigneeId: 'oid-ana', assigneeName: 'Ana Huenchullán Rivas' }),
    );
    const closed = firstValueFrom(ref.afterClosed());

    expect(text()).toContain('Asignar trámite');
    expect(text()).toContain('BD-2026-000401');
    expect(overlay.querySelector('textarea')).toBeNull();

    form().controls.assignee.setValue(staff[0]);
    await submit();

    expect(service.assign).toHaveBeenCalledWith('req-1', { assigneeId: 'oid-ana' });
    expect(await closed).toMatchObject({ kind: 'saved', reassigned: false });
  });

  it.each([
    [unassigned, 'Asignar trámite'],
    [assigned, 'Reasignar trámite'],
  ])('el título no tiene espacios alrededor', async (request, title) => {
    await open(request);

    expect(overlay.querySelector('[mat-dialog-title]')?.textContent).toBe(title);
  });

  it('reasignación: muestra el responsable actual y exige un motivo no vacío', async () => {
    await open(assigned);
    service.assign.mockReturnValue(of({ ...assigned, assigneeId: 'oid-ana' }));

    expect(text()).toContain('Reasignar trámite');
    expect(text()).toContain('Responsable actual');
    form().controls.assignee.setValue(staff[0]);
    form().controls.reason.setValue('   ');
    await submit();
    expect(service.assign).not.toHaveBeenCalled();
    expect(text()).toContain('Indica el motivo de la reasignación.');

    form().controls.reason.setValue('  Cambio de turno  ');
    await submit();
    expect(service.assign).toHaveBeenCalledWith('req-1', {
      assigneeId: 'oid-ana',
      reason: 'Cambio de turno',
    });
  });

  it('no envía si se elige al responsable actual', async () => {
    await open(assigned);

    form().controls.assignee.setValue(staff[2]);
    form().controls.reason.setValue('Motivo');
    await submit();

    expect(service.assign).not.toHaveBeenCalled();
    expect(text()).toContain('Esa persona ya es la responsable del trámite. Elige a otra.');
  });

  it('un texto que no es una opción de la lista no se envía', async () => {
    await open(unassigned);

    form().controls.assignee.setValue('Ana');
    await submit();

    expect(service.assign).not.toHaveBeenCalled();
    expect(text()).toContain('Elige un funcionario de la lista.');
  });

  it('carrera: si alguien tomó el trámite, muestra al nuevo responsable y pide el motivo', async () => {
    await open(unassigned);
    service.assign.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { message: 'reason es obligatorio al reasignar' },
          }),
      ),
    );
    service.getRequest.mockReturnValue(
      of({ ...assigned, assigneeName: 'Luisa Painemal Soto', assigneeId: 'oid-luisa' }),
    );

    form().controls.assignee.setValue(staff[0]);
    await submit();

    expect(service.getRequest).toHaveBeenCalledWith('req-1');
    expect(text()).toContain('Otra persona tomó el trámite mientras lo asignabas');
    expect(text()).toContain('Luisa Painemal Soto');
    expect(overlay.querySelector('textarea')).not.toBeNull();
    expect(text()).toContain('Reasignar trámite');
  });

  it('409 por trámite cerrado cierra el diálogo pidiendo recargar', async () => {
    await open(unassigned);
    service.assign.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { message: 'No se puede asignar un tramite cerrado' },
          }),
      ),
    );
    const closed = firstValueFrom(ref.afterClosed());

    form().controls.assignee.setValue(staff[0]);
    await submit();

    expect(await closed).toEqual({ kind: 'reload', message: 'El trámite ya está cerrado.' });
  });

  it('sin red conserva el diálogo y lo que se escribió', async () => {
    await open(assigned);
    service.assign.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));

    form().controls.assignee.setValue(staff[0]);
    form().controls.reason.setValue('Cambio de turno');
    await submit();

    expect(ref.getState()).toBe(0);
    expect(text()).toContain('Revisa tu conexión');
    expect(form().controls.reason.value).toBe('Cambio de turno');
  });

  it('bloquea el cierre y los controles mientras guarda', async () => {
    await open(unassigned);
    const response = new Subject<Request>();
    service.assign.mockReturnValue(response);

    form().controls.assignee.setValue(staff[0]);
    await submit();

    expect(ref.disableClose).toBe(true);
    expect(overlay.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    response.next(assigned);
    response.complete();
    await settle();
    expect(ref.disableClose).toBe(false);
  });

  it('busca sin distinguir tildes ni mayúsculas', async () => {
    await open(unassigned);

    form().controls.assignee.setValue('nanco');
    await settle();

    expect(ref.componentInstance['options']()).toEqual([staff[1]]);
  });

  it('si la lista de funcionarios falla ofrece reintentar', async () => {
    let attempts = 0;
    await open(unassigned, () =>
      attempts++ === 0 ? throwError(() => new Error('sin red')) : of(staff),
    );

    expect(text()).toContain('No se pudo cargar la lista de funcionarios.');
    [...overlay.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Reintentar'))!
      .click();
    await settle();

    expect(service.getAssignees).toHaveBeenCalledTimes(2);
    expect(text()).not.toContain('No se pudo cargar la lista de funcionarios.');
  });

  it('sin funcionarios registrados explica cuándo aparecen', async () => {
    await open(unassigned, () => of([]));

    expect(text()).toContain(
      'Un funcionario aparece después de su primer ingreso a BarrioDigital.',
    );
  });
});
