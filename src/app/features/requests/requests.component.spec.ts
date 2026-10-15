import { OverlayContainer } from '@angular/cdk/overlay';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroupDirective } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSelect } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { By } from '@angular/platform-browser';
import { Observable, Subject, Subscriber, firstValueFrom, of, throwError } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { CatalogService } from '../../core/catalog/catalog.service';
import { ProcedureType } from '../../shared/models/procedure-type.model';
import { Request, RequestStatus, RequestTransitions } from '../../shared/models/request.model';
import { Role } from '../../shared/models/role';
import {
  RequestStatusDialogComponent,
  RequestStatusDialogResult,
} from './request-status-dialog/request-status-dialog.component';
import { RequestsComponent } from './requests.component';
import { RequestsService } from './requests.service';

describe('RequestsComponent', () => {
  const catalog: ProcedureType[] = [
    {
      value: 'alumbrado',
      label: 'Iluminación municipal',
      active: true,
      dailyQuota: 10,
      remainingQuota: 4,
    },
    {
      value: 'otro',
      label: 'Otro servicio municipal',
      active: true,
      dailyQuota: null,
      remainingQuota: null,
    },
    {
      value: 'historico',
      label: 'Servicio anterior',
      active: false,
      dailyQuota: 5,
      remainingQuota: 0,
    },
  ];
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
  let catalogService: { getProcedures: ReturnType<typeof vi.fn> };

  const render = async (
    role: Role,
    getRequests: () => Observable<Request[]> = () => of([mine, other]),
    getTransitions: () => Observable<RequestTransitions> = () =>
      throwError(() => new Error('acciones no disponibles')),
    getProcedures: () => Observable<ProcedureType[]> = () => of(catalog),
  ) => {
    catalogService = { getProcedures: vi.fn(getProcedures) };
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
        { provide: CatalogService, useValue: catalogService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RequestsComponent);
    element = fixture.nativeElement;
    await fixture.whenStable();
  };

  const text = () => element.textContent ?? '';
  const headers = () =>
    Array.from(element.querySelectorAll('th'), (header) => header.textContent?.trim());
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
    expect(element.querySelector('#requests-list-title')?.textContent).toContain(
      'Todos los trámites',
    );
    expect(element.querySelector('.requests__filters')).not.toBeNull();
    expect(text()).toContain('Bache de otro vecino');
    expect(headers()).toEqual(['Tipo', 'Descripción', 'Estado', 'Fecha', 'Acciones']);
    expect(text()).not.toContain('otro-vecino');
  });

  it('Funcionario: pide el listado con los filtros elegidos', async () => {
    await render(Role.Funcionario);

    fixture.componentInstance['filters'].setValue({
      status: 'RESUELTO',
      from: new Date(2026, 8, 1),
      to: null,
    });
    await fixture.whenStable();

    expect(service.getRequests).toHaveBeenLastCalledWith({
      status: 'RESUELTO',
      from: '2026-09-01',
    });
  });

  it('muestra la etiqueta del tipo y, si el código no está en la lista, el código crudo', async () => {
    await render(Role.Vecino, () => of([mine, { ...other, procedureType: 'desconocido' }]));

    for (const container of ['.requests__table', '.requests__cards']) {
      expect(element.querySelector(container)?.textContent).toContain('Iluminación municipal');
      expect(element.querySelector(container)?.textContent).toContain('desconocido');
    }
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
    await render(Role.Vecino, () =>
      attempts++ === 0 ? throwError(() => new Error('sin red')) : of([]),
    );

    expect(text()).toContain('No pudimos cargar la información de trámites. Intenta nuevamente.');

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
        expect(overlay.textContent).toContain('Iluminación municipal');
        expect(overlay.textContent).toContain(mine.address);
        expect(
          Array.from(overlay.querySelectorAll('dt'), (label) => label.textContent?.trim()),
        ).toEqual(['Tipo de trámite', 'Dirección o ubicación', 'Motivo']);
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

  describe('catálogo real', () => {
    const payload = { procedureType: 'alumbrado', description: 'Poste caído', address: 'Calle 2' };
    const fillForm = () => fixture.componentInstance['createForm'].setValue(payload);
    const submitDirectly = () =>
      fixture.componentInstance['submit'](
        fixture.debugElement
          .query(By.directive(FormGroupDirective))
          .injector.get(FormGroupDirective),
      );
    const reloadCatalog = () => fixture.componentInstance['loadCatalog']();
    const controls = () => fixture.componentInstance['createForm'].controls;

    it('ofrece solo activos, conserva labels históricos y no selecciona el primer tipo', async () => {
      await render(Role.Vecino, () => of([{ ...mine, procedureType: 'historico' }]));
      const select = fixture.debugElement.query(By.directive(MatSelect))
        .componentInstance as MatSelect;
      expect(select.options.map((option) => option.value)).toEqual(['alumbrado', 'otro']);
      expect(select.options.map((option) => option.viewValue)).toEqual([
        'Iluminación municipal',
        'Otro servicio municipal',
      ]);
      expect(controls().procedureType.value).toBe('');
      for (const container of ['.requests__table', '.requests__cards']) {
        expect(element.querySelector(container)?.textContent).toContain('Servicio anterior');
      }
    });

    it.each(['loading', 'error', 'empty', 'inactive'] as const)(
      '%s: bloquea select, botón y submit directo, conservando los textos editables',
      async (state) => {
        const getProcedures = () =>
          state === 'loading'
            ? new Subject<ProcedureType[]>()
            : state === 'error'
              ? throwError(() => new Error('sin red'))
              : of(state === 'empty' ? [] : [catalog[2]]);
        await render(Role.Vecino, () => of([mine]), undefined, getProcedures);
        fillForm();
        submitDirectly();
        expect(controls().procedureType.disabled).toBe(true);
        expect(submitButton()!.disabled).toBe(true);
        expect(controls().description.enabled).toBe(true);
        expect(controls().address.enabled).toBe(true);
        expect(fixture.componentInstance['createForm'].getRawValue()).toEqual(payload);
        expect(service.createRequest).not.toHaveBeenCalled();
        expect(element.querySelector('.requests__table')?.textContent).toContain('alumbrado');
        if (state === 'empty' || state === 'inactive') {
          expect(text()).toContain('No hay tipos de trámite disponibles');
        }
      },
    );

    it.each(['desconocido', 'historico'])(
      'submit directo rechaza el código %s',
      async (procedureType) => {
        await render(Role.Vecino);
        fixture.componentInstance['createForm'].setValue({ ...payload, procedureType });
        submitDirectly();
        expect(service.createRequest).not.toHaveBeenCalled();
      },
    );

    it('el error de catálogo usa el mensaje común y permite reintentar conservando campos', async () => {
      const message = 'Mensaje del BFF';
      await render(Role.Vecino, undefined, undefined, () =>
        throwError(() => new HttpErrorResponse({ status: 500, error: { message } })),
      );
      fillForm();
      expect(text()).toContain('No pudimos cargar la información de trámites. Intenta nuevamente.');
      expect(text()).not.toContain(message);
      catalogService.getProcedures.mockReturnValue(of(catalog));
      Array.from(element.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'Reintentar')!
        .click();
      await fixture.whenStable();
      expect(fixture.componentInstance['createForm'].getRawValue()).toEqual(payload);
      expect(controls().procedureType.enabled).toBe(true);
      expect(catalogService.getProcedures).toHaveBeenCalledTimes(2);
      expect(service.getRequests).toHaveBeenCalledTimes(1);
    });

    it.each(['removed', 'inactive'] as const)(
      'al recargar con tipo %s limpia solo la selección e informa',
      async (state) => {
        await render(Role.Vecino);
        fillForm();
        catalogService.getProcedures.mockReturnValue(
          of(state === 'removed' ? [catalog[1]] : [{ ...catalog[0], active: false }, catalog[1]]),
        );
        reloadCatalog();
        await fixture.whenStable();
        expect(fixture.componentInstance['createForm'].getRawValue()).toEqual({
          ...payload,
          procedureType: '',
        });
        expect(text()).toContain(
          'El tipo seleccionado ya no está disponible. Selecciona otro tipo de trámite.',
        );
        controls().procedureType.setValue('otro');
        await fixture.whenStable();
        expect(text()).not.toContain('El tipo seleccionado ya no está disponible.');
      },
    );

    it('conserva selección y labels anteriores tras fallo; una nueva carga válida actualiza el label', async () => {
      await render(Role.Vecino);
      fillForm();
      catalogService.getProcedures
        .mockReturnValueOnce(throwError(() => new Error('sin red')))
        .mockReturnValueOnce(of([{ ...catalog[0], label: 'Etiqueta actualizada' }]));
      reloadCatalog();
      await fixture.whenStable();
      expect(fixture.componentInstance['createForm'].getRawValue()).toEqual(payload);
      expect(text()).toContain('Iluminación municipal');
      expect(submitButton()!.disabled).toBe(true);
      submitDirectly();
      expect(service.createRequest).not.toHaveBeenCalled();
      reloadCatalog();
      await fixture.whenStable();
      expect(controls().procedureType.value).toBe('alumbrado');
      expect(text()).toContain('Etiqueta actualizada');
      expect(submitButton()!.disabled).toBe(false);
    });

    it('Funcionario: el catálogo fallido no bloquea filtros, transiciones ni diálogos y ofrece reintento', async () => {
      const transitions: RequestTransitions = {
        INGRESADO: ['ADMITIDO'],
        ADMITIDO: [],
        EN_GESTION: [],
        EN_TERRENO: [],
        RESUELTO: [],
        RECHAZADO: [],
      };
      await render(
        Role.Funcionario,
        () => of([mine]),
        () => of(transitions),
        () => throwError(() => new Error('sin red')),
      );
      fixture.componentInstance['filters'].patchValue({ status: 'INGRESADO' });
      await fixture.whenStable();
      element.querySelector<HTMLButtonElement>('.request-actions__primary')!.click();
      await fixture.whenStable();
      const dialog = TestBed.inject(MatDialog).openDialogs[0];
      expect(TestBed.inject(OverlayContainer).getContainerElement().textContent).toContain(
        'alumbrado',
      );
      dialog.close();
      await fixture.whenStable();
      const listCalls = service.getRequests.mock.calls.length;
      catalogService.getProcedures.mockReturnValue(of(catalog));
      Array.from(element.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'Reintentar')!
        .click();
      await fixture.whenStable();
      expect(service.getRequests).toHaveBeenCalledTimes(listCalls);
      expect(service.getTransitions).toHaveBeenCalledTimes(1);
      expect(text()).toContain('Iluminación municipal');
    });

    it('un fallo del listado no impide cargar el catálogo ni habilitar el formulario', async () => {
      await render(Role.Vecino, () => throwError(() => new Error('sin listado')));
      expect(fixture.componentInstance['catalogState']()).toBe('ready');
      expect(controls().procedureType.enabled).toBe(true);
      expect(text()).toContain('No pudimos cargar la información de trámites. Intenta nuevamente.');
    });

    it('los dos diálogos reciben el label inactivo al abrirse y lo conservan durante una recarga', async () => {
      const request = {
        ...mine,
        id: 'historico-rechazado',
        procedureType: 'historico',
        status: 'RECHAZADO' as const,
        rejectionReason: 'Motivo',
      };
      const transitions: RequestTransitions = {
        INGRESADO: ['ADMITIDO'],
        ADMITIDO: [],
        EN_GESTION: [],
        EN_TERRENO: [],
        RESUELTO: [],
        RECHAZADO: [],
      };
      await render(
        Role.Funcionario,
        () => of([mine, request]),
        () => of(transitions),
      );
      const trigger = element.querySelector<HTMLButtonElement>('.request-actions__primary')!;
      fixture.componentInstance['openStatusDialog'](
        { ...request, status: 'INGRESADO' },
        { status: 'ADMITIDO', trigger },
      );
      await fixture.whenStable();
      const overlay = TestBed.inject(OverlayContainer).getContainerElement();
      expect(overlay.textContent).toContain('Servicio anterior');
      catalogService.getProcedures.mockReturnValue(
        of([{ ...catalog[2], label: 'Nuevo label histórico' }]),
      );
      reloadCatalog();
      await fixture.whenStable();
      expect(overlay.textContent).toContain('Servicio anterior');
      const statusDialog = TestBed.inject(MatDialog).openDialogs[0];
      const statusClosed = firstValueFrom(statusDialog.afterClosed());
      statusDialog.close();
      await statusClosed;
      await fixture.whenStable();
      element.querySelector<HTMLButtonElement>('.requests__rejection-reason')!.click();
      await fixture.whenStable();
      expect(overlay.textContent).toContain('Nuevo label histórico');
      const reasonDialog = TestBed.inject(MatDialog).openDialogs[0];
      const reasonClosed = firstValueFrom(reasonDialog.afterClosed());
      reasonDialog.close();
      await reasonClosed;
      await fixture.whenStable();
    });

    it.each([
      [400, 'El tipo de tramite no esta disponible', true],
      [400, 'procedureType invalido', true],
      [400, 'Otro error de validación', false],
      [503, 'Servicio no disponible', false],
      [500, '  ', false],
      [500, 'ORA-01407: BARRIODIGITAL.PROCEDURE_TYPES.DAILY_QUOTA; update procedure_types', false],
      [400, 'ORA-01407: BARRIODIGITAL.PROCEDURE_TYPES.DAILY_QUOTA', false],
    ] as const)(
      'POST %s (%s): conserva campos y ofrece actualizar solo para el rechazo de tipo',
      async (status, message, refresh) => {
        await render(Role.Vecino);
        fillForm();
        service.createRequest.mockReturnValue(
          throwError(() => new HttpErrorResponse({ status, error: { message } })),
        );
        submitButton()!.click();
        await fixture.whenStable();
        expect(fixture.componentInstance['createForm'].getRawValue()).toEqual(payload);
        expect(text()).toContain(
          refresh ? message : 'No se pudo ingresar el trámite. Intenta nuevamente.',
        );
        if (!refresh && message.trim()) expect(text()).not.toContain(message);
        const button = Array.from(element.querySelectorAll('button')).find(
          (button) => button.textContent?.trim() === 'Actualizar tipos de trámite',
        );
        expect(!!button).toBe(refresh);
        if (button) {
          catalogService.getProcedures.mockReturnValue(of([{ ...catalog[0], active: false }]));
          button.click();
          await fixture.whenStable();
          expect(controls().procedureType.value).toBe('');
          expect(controls().description.value).toBe(payload.description);
          expect(controls().address.value).toBe(payload.address);
        }
        expect(service.createRequest).toHaveBeenCalledTimes(1);
      },
    );

    it('una recarga no habilita controles durante el POST y un fallo posterior mantiene bloqueado el tipo', async () => {
      await render(Role.Vecino);
      fillForm();
      const response = new Subject<Request>();
      service.createRequest.mockReturnValue(response);
      submitButton()!.click();
      reloadCatalog();
      await fixture.whenStable();
      expect(fixture.componentInstance['createForm'].disabled).toBe(true);
      submitDirectly();
      expect(service.createRequest).toHaveBeenCalledTimes(1);
      catalogService.getProcedures.mockReturnValue(throwError(() => new Error('sin red')));
      reloadCatalog();
      response.error(new Error('sin red'));
      await fixture.whenStable();
      expect(controls().description.enabled).toBe(true);
      expect(controls().address.enabled).toBe(true);
      expect(controls().procedureType.disabled).toBe(true);
    });

    it('cancela consultas anteriores y al destruir, sin aceptar respuestas antiguas', async () => {
      const responses: Subscriber<ProcedureType[]>[] = [];
      const cancelled = vi.fn();
      await render(
        Role.Vecino,
        undefined,
        undefined,
        () =>
          new Observable<ProcedureType[]>((subscriber) => {
            responses.push(subscriber);
            return cancelled;
          }),
      );
      reloadCatalog();
      expect(responses[0].closed).toBe(true);
      responses[1].next(catalog);
      responses[0].next([{ ...catalog[0], label: 'Respuesta antigua' }]);
      await fixture.whenStable();
      expect(text()).toContain('Iluminación municipal');
      expect(text()).not.toContain('Respuesta antigua');
      fixture.destroy();
      expect(responses[1].closed).toBe(true);
      expect(cancelled).toHaveBeenCalledTimes(2);
    });

    it('cancela el POST pendiente al destruir la vista', async () => {
      await render(Role.Vecino);
      fillForm();
      const cancelled = vi.fn();
      service.createRequest.mockReturnValue(new Observable<Request>(() => cancelled));
      submitButton()!.click();
      await fixture.whenStable();
      fixture.destroy();
      expect(cancelled).toHaveBeenCalledTimes(1);
      expect(service.getRequests).toHaveBeenCalledTimes(1);
    });
  });

  describe('recuperación común', () => {
    const message = 'No pudimos cargar la información de trámites. Intenta nuevamente.';
    const savedMessage = 'El cambio se guardó, pero no pudimos actualizar la lista.';
    const transitions: RequestTransitions = {
      INGRESADO: ['ADMITIDO'],
      ADMITIDO: [],
      EN_GESTION: [],
      EN_TERRENO: [],
      RESUELTO: [],
      RECHAZADO: [],
    };
    const fail = () => throwError(() => new Error('sin red'));
    const recovery = () => element.querySelector<HTMLElement>('.requests__recovery')!;
    const retry = () => recovery().querySelector<HTMLButtonElement>('button')!.click();
    const retryButtons = () =>
      Array.from(element.querySelectorAll('button')).filter(
        (button) => button.textContent?.trim() === 'Reintentar',
      );
    const spinner = () => recovery().querySelector('mat-progress-spinner');
    const complete = <T>(subject: Subject<T>, value: T) => {
      subject.next(value);
      subject.complete();
    };

    it('unifica tres errores; pasa de centrado a compacto y espera toda la recuperación antes del siguiente intento', async () => {
      await render(Role.Funcionario, fail, fail, fail);
      expect(element.querySelectorAll('.requests__recovery')).toHaveLength(1);
      expect(retryButtons()).toHaveLength(1);
      expect(text().split(message)).toHaveLength(2);
      expect(recovery().classList.contains('requests__status')).toBe(true);
      expect(element.querySelector('.requests__table')).toBeNull();
      const requestsResponse = new Subject<Request[]>();
      const catalogResponse = new Subject<ProcedureType[]>();
      const transitionsResponse = new Subject<RequestTransitions>();
      service.getRequests.mockReturnValue(requestsResponse);
      catalogService.getProcedures.mockReturnValue(catalogResponse);
      service.getTransitions.mockReturnValue(transitionsResponse);
      retry();
      fixture.componentInstance['retryFailedLoads']();
      await fixture.whenStable();
      expect(service.getRequests).toHaveBeenCalledTimes(2);
      expect(catalogService.getProcedures).toHaveBeenCalledTimes(2);
      expect(service.getTransitions).toHaveBeenCalledTimes(2);
      expect(spinner()?.getAttribute('aria-label')).toBe('Cargando información de trámites');
      expect(recovery().querySelector('button')).toBeNull();
      expect(text()).not.toContain(message);
      complete(requestsResponse, [mine]);
      await fixture.whenStable();
      expect(recovery().classList.contains('requests__recovery--compact')).toBe(true);
      expect(element.querySelector('.requests__table')?.textContent).toContain(mine.description);
      catalogResponse.error(new Error('sin red'));
      await fixture.whenStable();
      expect(spinner()).not.toBeNull();
      expect(recovery().querySelector('button')).toBeNull();
      complete(transitionsResponse, transitions);
      await fixture.whenStable();
      expect(spinner()).toBeNull();
      expect(recovery().textContent).toContain(message);
      catalogService.getProcedures.mockReturnValue(of(catalog));
      retry();
      await fixture.whenStable();
      expect(catalogService.getProcedures).toHaveBeenCalledTimes(3);
      expect(service.getRequests).toHaveBeenCalledTimes(2);
      expect(service.getTransitions).toHaveBeenCalledTimes(2);
      expect(recovery().hidden).toBe(true);
      expect(service.createRequest).not.toHaveBeenCalled();
      expect(service.changeStatus).not.toHaveBeenCalled();
    });

    it.each(['catalog', 'transitions'] as const)(
      '%s fallido: muestra la variante compacta y reintenta solo esa consulta',
      async (query) => {
        await render(
          Role.Funcionario,
          () => of([mine]),
          query === 'transitions' ? fail : () => of(transitions),
          query === 'catalog' ? fail : () => of(catalog),
        );
        expect(recovery().classList.contains('requests__recovery--compact')).toBe(true);
        expect(element.querySelector('.requests__table')).not.toBeNull();
        catalogService.getProcedures.mockReturnValue(of(catalog));
        service.getTransitions.mockReturnValue(of(transitions));
        retry();
        await fixture.whenStable();
        expect(catalogService.getProcedures).toHaveBeenCalledTimes(query === 'catalog' ? 2 : 1);
        expect(service.getTransitions).toHaveBeenCalledTimes(query === 'transitions' ? 2 : 1);
        expect(service.getRequests).toHaveBeenCalledTimes(1);
        expect(recovery().hidden).toBe(true);
      },
    );

    it('conserva campos y labels; Vecino nunca consulta transiciones y las asociaciones accesibles siguen presentes', async () => {
      await render(Role.Vecino);
      const payload = { procedureType: 'alumbrado', description: 'Poste', address: 'Calle 2' };
      fixture.componentInstance['createForm'].setValue(payload);
      catalogService.getProcedures.mockReturnValue(fail());
      service.getRequests.mockReturnValue(fail());
      fixture.componentInstance['loadCatalog']();
      fixture.componentInstance['loadRequests']();
      await fixture.whenStable();
      expect(fixture.componentInstance['getTipoLabel']('alumbrado')).toBe('Iluminación municipal');
      expect(fixture.componentInstance['createForm'].getRawValue()).toEqual(payload);
      const checkDescriptions = () => {
        const select = element.querySelector('[formControlName="procedureType"]')!;
        for (const id of (select.getAttribute('aria-describedby') ?? '')
          .split(/\s+/)
          .filter(Boolean)) {
          expect(element.querySelector(`[id="${id}"]`)).not.toBeNull();
        }
        expect(element.querySelector('#catalog-form-feedback')).not.toBeNull();
        expect(element.querySelector('#catalog-feedback')).toBeNull();
      };
      checkDescriptions();
      catalogService.getProcedures.mockReturnValue(of(catalog));
      service.getRequests.mockReturnValue(of([mine]));
      retry();
      await fixture.whenStable();
      expect(fixture.componentInstance['createForm'].getRawValue()).toEqual(payload);
      expect(service.getTransitions).not.toHaveBeenCalled();
      expect(service.createRequest).not.toHaveBeenCalled();
      expect(service.changeStatus).not.toHaveBeenCalled();
      fixture.componentInstance['createForm'].controls.procedureType.setValue('');
      submitButton()!.click();
      await fixture.whenStable();
      checkDescriptions();
    });

    it('conserva filtros y el aviso de cambio guardado hasta que se recupere el listado', async () => {
      await render(Role.Funcionario, () => of([mine]), fail);
      const filters = { status: 'INGRESADO', from: new Date(2026, 8, 1), to: null };
      fixture.componentInstance['filters'].setValue(filters);
      service.getRequests.mockReturnValue(fail());
      fixture.componentInstance['loadRequests'](true);
      catalogService.getProcedures.mockReturnValue(fail());
      fixture.componentInstance['loadCatalog']();
      await fixture.whenStable();
      expect(text()).toContain(savedMessage);
      catalogService.getProcedures.mockReturnValue(of(catalog));
      service.getTransitions.mockReturnValue(of(transitions));
      retry();
      await fixture.whenStable();
      expect(text()).toContain(savedMessage);
      expect(fixture.componentInstance['statusChangeReloadFailed']()).toBe(true);
      expect(fixture.componentInstance['filters'].getRawValue()).toEqual(filters);
      service.getRequests.mockReturnValue(of([]));
      retry();
      await fixture.whenStable();
      expect(service.getRequests).toHaveBeenLastCalledWith({
        status: 'INGRESADO',
        from: '2026-09-01',
      });
      expect(catalogService.getProcedures).toHaveBeenCalledTimes(3);
      expect(service.getTransitions).toHaveBeenCalledTimes(2);
      expect(fixture.componentInstance['statusChangeReloadFailed']()).toBe(false);
      expect(text()).not.toContain(savedMessage);
      expect(recovery().hidden).toBe(true);
      expect(service.changeStatus).not.toHaveBeenCalled();
    });

    it('mantiene un único spinner inicial de 40 y luego uno compacto de 20 sin ocultar el listado', async () => {
      const requestsResponse = new Subject<Request[]>();
      const catalogResponse = new Subject<ProcedureType[]>();
      const transitionsResponse = new Subject<RequestTransitions>();
      await render(
        Role.Funcionario,
        () => requestsResponse,
        () => transitionsResponse,
        () => catalogResponse,
      );
      const diameter = () =>
        fixture.debugElement.query(By.css('.requests__recovery mat-progress-spinner'))
          .componentInstance.diameter;
      expect(element.querySelectorAll('mat-progress-spinner')).toHaveLength(1);
      expect(diameter()).toBe(40);
      expect(text()).not.toContain('Cargando');
      complete(requestsResponse, []);
      await fixture.whenStable();
      expect(diameter()).toBe(20);
      expect(text()).toContain('No hay trámites que coincidan con el filtro seleccionado.');
      complete(catalogResponse, catalog);
      complete(transitionsResponse, transitions);
      await fixture.whenStable();
      expect(recovery().hidden).toBe(true);
      expect(spinner()).toBeNull();
    });

    it('reintenta fallos sin cancelar otra consulta en curso', async () => {
      const requestsResponse = new Subject<Request[]>();
      await render(Role.Vecino, () => requestsResponse, undefined, fail);
      catalogService.getProcedures.mockReturnValue(of(catalog));
      fixture.componentInstance['retryFailedLoads']();
      await fixture.whenStable();
      expect(requestsResponse.observed).toBe(true);
      expect(service.getRequests).toHaveBeenCalledTimes(1);
      expect(catalogService.getProcedures).toHaveBeenCalledTimes(2);
      complete(requestsResponse, [mine]);
      await fixture.whenStable();
      expect(recovery().hidden).toBe(true);
      expect(service.getTransitions).not.toHaveBeenCalled();
    });

    it('conserva el diálogo abierto y su label al recuperar el catálogo sin reenviar operaciones', async () => {
      await render(
        Role.Funcionario,
        () => of([{ ...mine, status: 'RECHAZADO', rejectionReason: 'Motivo' }]),
        () => of(transitions),
        fail,
      );
      element.querySelector<HTMLButtonElement>('.requests__rejection-reason')!.click();
      await fixture.whenStable();
      const dialog = TestBed.inject(MatDialog).openDialogs[0];
      const focused = document.activeElement;
      catalogService.getProcedures.mockReturnValue(of(catalog));
      retry();
      await fixture.whenStable();
      expect(TestBed.inject(MatDialog).openDialogs).toContain(dialog);
      expect(document.activeElement).toBe(focused);
      expect(TestBed.inject(OverlayContainer).getContainerElement().textContent).toContain(
        'alumbrado',
      );
      expect(service.createRequest).not.toHaveBeenCalled();
      expect(service.changeStatus).not.toHaveBeenCalled();
      const closed = firstValueFrom(dialog.afterClosed());
      dialog.close();
      await closed;
    });

    it.each([Role.Vecino, Role.Funcionario])(
      '%s: los estados vacíos no activan recuperación y el aviso de creación solo pertenece a Vecino',
      async (role) => {
        await render(
          role,
          () => of([]),
          () => of(transitions),
          () => of([]),
        );
        expect(recovery().hidden).toBe(true);
        expect(text().includes('No hay tipos de trámite disponibles')).toBe(role === Role.Vecino);
        expect(retryButtons()).toHaveLength(0);
        if (role === Role.Vecino) expect(submitButton()!.disabled).toBe(true);
        fixture.componentInstance['retryFailedLoads']();
        expect(catalogService.getProcedures).toHaveBeenCalledTimes(1);
        expect(service.getRequests).toHaveBeenCalledTimes(1);
      },
    );

    it('cancelar la recarga por filtros no termina el indicador de las otras consultas; destruir cancela el resto', async () => {
      await render(Role.Funcionario, fail, fail, fail);
      const requestsResponse = new Subject<Request[]>();
      const replacement = new Subject<Request[]>();
      const catalogResponse = new Subject<ProcedureType[]>();
      const transitionsResponse = new Subject<RequestTransitions>();
      service.getRequests.mockReturnValueOnce(requestsResponse).mockReturnValueOnce(replacement);
      catalogService.getProcedures.mockReturnValue(catalogResponse);
      service.getTransitions.mockReturnValue(transitionsResponse);
      retry();
      fixture.componentInstance['filters'].patchValue({ status: 'INGRESADO' });
      expect(requestsResponse.observed).toBe(false);
      complete(replacement, [mine]);
      await fixture.whenStable();
      expect(fixture.componentInstance['isRecovering']()).toBe(true);
      expect(spinner()).not.toBeNull();
      fixture.destroy();
      expect(catalogResponse.observed).toBe(false);
      expect(transitionsResponse.observed).toBe(false);
      expect(fixture.componentInstance['isRecovering']()).toBe(false);
    });
  });

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

    it.each([
      ['QUOTA_EXHAUSTED', 409, 'No queda cupo disponible para este tipo de trámite.'],
      [
        'PROCEDURE_TYPE_UNAVAILABLE',
        409,
        'El tipo de trámite asociado ya no está disponible en el catálogo.',
      ],
      ['QUOTA_RESERVATION_UNCONFIRMED', 502, 'No pudimos confirmar la reserva de cupo.'],
      ['ADMISSION_RESULT_UNCONFIRMED', 502, 'No pudimos confirmar si el cambio se guardó.'],
      [
        'ADMISSION_RESPONSE_UNAVAILABLE',
        502,
        'El cambio se guardó, pero no pudimos obtener su respuesta completa.',
      ],
      [
        'QUOTA_COMPENSATION_UNCONFIRMED',
        502,
        'El cambio fue rechazado y no pudimos confirmar la devolución del cupo.',
      ],
    ])(
      '%s: explica el resultado, conserva el diálogo y solo permite consultar',
      async (code, status, message) => {
        fixture.componentInstance['filters'].patchValue({ status: 'INGRESADO' });
        await fixture.whenStable();
        service.changeStatus.mockReturnValue(
          throwError(
            () =>
              new HttpErrorResponse({
                status: Number(status),
                error: { code, message: 'mensaje que no debe usarse' },
              }),
          ),
        );
        const dialogRef = await openDialog('ADMITIDO');
        const callsBefore = service.getRequests.mock.calls.length;
        dialogButton('Confirmar admisión').click();
        await fixture.whenStable();
        expect(overlay().textContent).toContain(message);
        expect(overlay().textContent).not.toContain('El estado del trámite cambió');
        expect(TestBed.inject(MatDialog).openDialogs).toContain(dialogRef);
        expect(dialogRef.disableClose).toBe(false);
        expect(overlay().querySelector('.status-dialog__summary')).not.toBeNull();
        expect(dialogButton('Confirmar admisión')).toBeUndefined();
        dialogRef.componentInstance['submit']();
        expect(service.changeStatus).toHaveBeenCalledTimes(1);
        expect(service.getRequests).toHaveBeenCalledTimes(callsBefore);
        const closed = firstValueFrom(dialogRef.afterClosed());
        dialogButton('Cerrar y actualizar lista').click();
        expect(await closed).toEqual({ kind: 'reload' });
        await fixture.whenStable();
        expect(service.getRequests).toHaveBeenCalledTimes(callsBefore + 1);
        expect(service.getRequests).toHaveBeenLastCalledWith({ status: 'INGRESADO' });
        expect(service.changeStatus).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(element.querySelector('#requests-list-title'));
      },
    );

    it('admisión sin respuesta de red bloquea el reenvío aunque no llegue code', async () => {
      service.changeStatus.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
      const dialogRef = await openDialog('ADMITIDO');
      dialogButton('Confirmar admisión').click();
      await fixture.whenStable();
      expect(overlay().textContent).toContain('No pudimos confirmar si el cambio se guardó.');
      dialogRef.componentInstance['submit']();
      expect(service.changeStatus).toHaveBeenCalledTimes(1);
      dialogButton('Cancelar').click();
      await fixture.whenStable();
    });

    it.each([
      [
        400,
        'rejectionReason es obligatorio cuando el estado es RECHAZADO',
        'Indica un motivo de rechazo que no esté vacío.',
      ],
      [
        400,
        'rejectionReason no puede superar 500 caracteres',
        'El motivo de rechazo no puede superar 500 caracteres.',
      ],
      [401, '', 'Tu sesión ya no permite confirmar el cambio. Inicia sesión nuevamente.'],
      [
        403,
        'Solo un Funcionario puede cambiar el estado',
        'Solo un Funcionario puede cambiar el estado',
      ],
    ])(
      'HTTP %s: conserva los errores anteriores y el motivo',
      async (status, message, expected) => {
        service.changeStatus.mockReturnValue(
          throwError(
            () =>
              new HttpErrorResponse({
                status: Number(status),
                error: { message },
              }),
          ),
        );
        const dialogRef = await openDialog();
        const textarea = writeReason();
        dialogButton('Confirmar rechazo').click();
        await fixture.whenStable();
        expect(overlay().textContent).toContain(expected);
        expect(textarea.value).toBe(reason);
        expect(service.changeStatus).toHaveBeenCalledTimes(1);
        dialogRef.close();
        await fixture.whenStable();
      },
    );

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
        expect(text()).toContain(
          'No pudimos cargar la información de trámites. Intenta nuevamente.',
        );
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
