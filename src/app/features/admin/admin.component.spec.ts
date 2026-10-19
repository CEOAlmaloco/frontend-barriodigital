import { OverlayContainer } from '@angular/cdk/overlay';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DEFAULT_OPTIONS, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { Observable, Subject, Subscriber, firstValueFrom, of, throwError } from 'rxjs';

import { CatalogService } from '../../core/catalog/catalog.service';
import { ProcedureType } from '../../shared/models/procedure-type.model';
import { AdminComponent } from './admin.component';
import {
  ProcedureTypeDialogComponent,
  ProcedureTypeDialogResult,
} from './procedure-type-dialog/procedure-type-dialog.component';

describe('AdminComponent', () => {
  const catalog: ProcedureType[] = [
    { value: 'bache', label: 'Bache en calle', active: true, dailyQuota: 10, remainingQuota: 3 },
    {
      value: 'historico',
      label: 'Servicio histórico',
      active: false,
      dailyQuota: null,
      remainingQuota: null,
    },
  ];
  let fixture: ComponentFixture<AdminComponent>;
  let element: HTMLElement;
  let service: {
    getProcedures: ReturnType<typeof vi.fn>;
    createProcedure: ReturnType<typeof vi.fn>;
    updateProcedure: ReturnType<typeof vi.fn>;
  };
  const render = async (getProcedures: () => Observable<ProcedureType[]> = () => of(catalog)) => {
    service = {
      getProcedures: vi.fn(getProcedures),
      createProcedure: vi.fn(() => of(catalog[0])),
      updateProcedure: vi.fn(() => of(catalog[0])),
    };
    await TestBed.configureTestingModule({
      imports: [AdminComponent],
      providers: [
        { provide: CatalogService, useValue: service },
        {
          provide: MAT_DIALOG_DEFAULT_OPTIONS,
          useValue: { enterAnimationDuration: 0, exitAnimationDuration: 0 },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminComponent);
    element = fixture.nativeElement;
    await fixture.whenStable();
  };
  const text = () => element.textContent ?? '';
  const refreshButton = () =>
    element.querySelector<HTMLButtonElement>('button[aria-label="Actualizar catálogo"]');
  const quotas = (selector: string) =>
    Array.from(element.querySelectorAll(selector), (cell) => cell.textContent?.trim());
  const button = (label: string) =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
      (item) => item.textContent?.trim() === label,
    )!;
  const dialogRef = () =>
    TestBed.inject(MatDialog).openDialogs[0] as MatDialogRef<
      ProcedureTypeDialogComponent,
      ProcedureTypeDialogResult
    >;
  const open = async (mode: 'create' | 'edit') => {
    button(mode === 'create' ? 'Nuevo tipo' : 'Editar').click();
    await fixture.whenStable();
    return dialogRef();
  };

  afterEach(async () => {
    const dialog = TestBed.inject(MatDialog);
    const closed = dialog.openDialogs.map((ref) => firstValueFrom(ref.afterClosed()));
    dialog.closeAll();
    await Promise.all(closed);
  });

  it('mantiene encabezado y creación disponibles durante una única carga inicial', async () => {
    await render(() => new Subject<ProcedureType[]>());
    expect(text()).toContain('Panel de administración');
    expect(text()).toContain('Gestiona los tipos de trámite disponibles para la atención vecinal.');
    expect(button('Nuevo tipo').disabled).toBe(false);
    expect(refreshButton()?.disabled).toBe(true);
    expect(element.querySelector('.admin__refresh-icon--spinning')).toBeNull();
    fixture.componentInstance['refresh']();
    expect(element.querySelector('mat-progress-spinner')?.getAttribute('aria-label')).toBe(
      'Cargando tipos de trámite',
    );
    expect(element.querySelector('.admin__table')).toBeNull();
    expect(service.getProcedures).toHaveBeenCalledTimes(1);
    await open('create');
    expect(dialogRef().componentInstance['data']).toEqual({ mode: 'create' });
    const closed = firstValueFrom(dialogRef().afterClosed());
    dialogRef().close();
    await closed;
    await fixture.whenStable();
    expect(service.getProcedures).toHaveBeenCalledTimes(1);
  });

  it('ofrece reintento explícito, reemplaza el error por spinner y evita consultas duplicadas', async () => {
    await render(() => throwError(() => new Error('sin red')));
    expect(text()).toContain('No pudimos cargar los tipos de trámite. Intenta nuevamente.');
    expect(refreshButton()).toBeNull();
    expect(element.querySelectorAll('button')).toHaveLength(2);
    const response = new Subject<ProcedureType[]>();
    service.getProcedures.mockReturnValue(response);
    button('Reintentar').click();
    fixture.componentInstance['retry']();
    await fixture.whenStable();
    expect(element.querySelector('mat-progress-spinner')).not.toBeNull();
    expect(refreshButton()?.disabled).toBe(true);
    expect(element.querySelector('.admin__refresh-icon--spinning')).toBeNull();
    expect(text()).not.toContain('No pudimos cargar');
    expect(service.getProcedures).toHaveBeenCalledTimes(2);
    response.next(catalog);
    response.complete();
    await fixture.whenStable();
    expect(text()).toContain('Bache en calle');
    expect(refreshButton()?.disabled).toBe(false);
  });

  it('muestra vacío sin duplicar la acción de creación', async () => {
    await render(() => of([]));
    expect(text()).toContain('Todavía no hay tipos de trámite registrados.');
    expect(element.querySelectorAll('button')).toHaveLength(2);
    expect(button('Nuevo tipo').disabled).toBe(false);
  });

  it('presenta tabla y tarjetas con código, nombre, estado y cupo en el orden recibido', async () => {
    await render();
    expect(Array.from(element.querySelectorAll('th'), (cell) => cell.textContent?.trim())).toEqual([
      'Código',
      'Nombre',
      'Estado',
      'Cupo diario',
      'Cupo disponible hoy',
      'Acciones',
    ]);
    for (const selector of ['.admin__table', '.admin__cards']) {
      const container = element.querySelector(selector)!;
      expect(container.textContent).toContain('Bache en calle');
      expect(container.textContent).toContain('Servicio histórico');
      expect(container.textContent).toContain('Activo');
      expect(container.textContent).toContain('Inactivo');
      expect(container.textContent).toContain('Sin límite');
      expect(container.textContent).toContain('10');
      expect(
        Array.from(container.querySelectorAll('.admin__code'), (code) => code.textContent?.trim()),
      ).toEqual(['bache', 'historico']);
      expect(
        Array.from(container.querySelectorAll('button'), (edit) => edit.getAttribute('aria-label')),
      ).toEqual(['Editar Bache en calle (bache)', 'Editar Servicio histórico (historico)']);
    }
    expect(quotas('td.mat-column-disponible')).toEqual(['3', 'Sin límite']);
    expect(quotas('.admin__fields > div:last-child dd')).toEqual(['3', 'Sin límite']);
    expect(element.querySelector('mat-checkbox')).toBeNull();
  });

  it('presenta cupos válidos, agotados e inconsistentes igual en tabla y tarjetas, incluso inactivos', async () => {
    const cases: [unknown, unknown, string][] = [
      [10, 3, '3'],
      [1, 1, '1'],
      [10, 10, '10'],
      [10, 0, 'Agotado'],
      [null, null, 'Sin límite'],
      [undefined, undefined, 'No disponible'],
      [null, undefined, 'No disponible'],
      [undefined, null, 'No disponible'],
      [undefined, 2, 'No disponible'],
      [10, undefined, 'No disponible'],
      [10, null, 'No disponible'],
      [null, 2, 'No disponible'],
      [null, 0, 'No disponible'],
      [0, 0, 'No disponible'],
      [-1, 0, 'No disponible'],
      [1.5, 1, 'No disponible'],
      [10, -1, 'No disponible'],
      [10, 1.5, 'No disponible'],
      [10, 11, 'No disponible'],
      [10, Infinity, 'No disponible'],
      [10, -Infinity, 'No disponible'],
      [10, NaN, 'No disponible'],
      [Infinity, 2, 'No disponible'],
      [-Infinity, 2, 'No disponible'],
      [NaN, 2, 'No disponible'],
      ['10', 2, 'No disponible'],
      [10, '2', 'No disponible'],
      [10, '0', 'No disponible'],
      [true, 0, 'No disponible'],
      [10, false, 'No disponible'],
    ];
    const received = cases.map(([dailyQuota, remainingQuota], index) => ({
      value: `tipo-${index}`,
      label: `Tipo ${index}`,
      active: false,
      ...(dailyQuota === undefined ? {} : { dailyQuota }),
      ...(remainingQuota === undefined ? {} : { remainingQuota }),
    })) as unknown as ProcedureType[];
    await render(() => of(received));
    const expected = cases.map(([, , label]) => label);
    expect(quotas('td.mat-column-disponible')).toEqual(expected);
    expect(quotas('.admin__fields > div:last-child dd')).toEqual(expected);
    expect(quotas('.admin__badge').every((label) => label === 'Inactivo')).toBe(true);
    expect(
      Array.from(element.querySelectorAll<HTMLButtonElement>('button[aria-label^="Editar"]')).every(
        (edit) => !edit.disabled,
      ),
    ).toBe(true);
  });

  it('actualiza solo el catálogo, conserva datos y foco durante carga e impide activaciones duplicadas', async () => {
    await render();
    const snack = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
    const response = new Subject<ProcedureType[]>();
    service.getProcedures.mockReturnValue(response);
    const trigger = refreshButton()!;
    expect(trigger.hasAttribute('mat-icon-button')).toBe(true);
    expect(trigger.textContent?.trim()).toBe('refresh');
    expect(
      fixture.debugElement.query(By.directive(MatTooltip)).injector.get(MatTooltip).message,
    ).toBe('Actualizar catálogo');
    expect(trigger.querySelector('mat-icon')?.textContent).toBe('refresh');
    expect(trigger.querySelector('mat-icon')?.getAttribute('aria-hidden')).toBe('true');
    trigger.focus();
    trigger.click();
    trigger.click();
    fixture.componentInstance['refresh']();
    await fixture.whenStable();
    expect(refreshButton()?.disabled).toBe(true);
    expect(trigger.querySelector('.admin__refresh-icon--spinning')).not.toBeNull();
    expect(service.getProcedures).toHaveBeenCalledTimes(2);
    expect(element.querySelectorAll('mat-progress-spinner')).toHaveLength(1);
    expect(quotas('td.mat-column-disponible')).toEqual(['3', 'Sin límite']);
    expect(quotas('.admin__fields > div:last-child dd')).toEqual(['3', 'Sin límite']);
    response.next([{ ...catalog[0], remainingQuota: 0 }]);
    response.complete();
    await fixture.whenStable();
    expect(quotas('td.mat-column-disponible')).toEqual(['Agotado']);
    expect(quotas('.admin__fields > div:last-child dd')).toEqual(['Agotado']);
    expect(refreshButton()?.disabled).toBe(false);
    expect(trigger.querySelector('.admin__refresh-icon--spinning')).toBeNull();
    expect(element.querySelector('mat-progress-spinner')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(service.createProcedure).not.toHaveBeenCalled();
    expect(service.updateProcedure).not.toHaveBeenCalled();
    expect(snack).not.toHaveBeenCalled();
  });

  it('conserva los cupos tras error manual, ofrece solo Reintentar y se recupera con catálogo vacío', async () => {
    await render();
    const failedResponse = new Subject<ProcedureType[]>();
    service.getProcedures.mockReturnValue(failedResponse);
    refreshButton()!.click();
    await fixture.whenStable();
    expect(element.querySelector('.admin__refresh-icon--spinning')).not.toBeNull();
    failedResponse.error(new Error('sin red'));
    await fixture.whenStable();
    expect(text()).toContain(
      'No pudimos actualizar el catálogo. Se muestran los últimos datos disponibles.',
    );
    expect(refreshButton()).toBeNull();
    expect(fixture.componentInstance['isRefreshing']()).toBe(false);
    expect(element.querySelectorAll('.admin__error')).toHaveLength(1);
    expect(
      Array.from(element.querySelectorAll('button')).filter(
        (item) => item.textContent?.trim() === 'Reintentar',
      ),
    ).toHaveLength(1);
    expect(quotas('td.mat-column-disponible')).toEqual(['3', 'Sin límite']);
    expect(quotas('.admin__fields > div:last-child dd')).toEqual(['3', 'Sin límite']);
    fixture.componentInstance['refresh']();
    expect(service.getProcedures).toHaveBeenCalledTimes(2);
    const response = new Subject<ProcedureType[]>();
    service.getProcedures.mockReturnValue(response);
    button('Reintentar').click();
    fixture.componentInstance['retry']();
    fixture.componentInstance['refresh']();
    await fixture.whenStable();
    expect(refreshButton()?.disabled).toBe(true);
    expect(text()).not.toContain('Reintentar');
    expect(service.getProcedures).toHaveBeenCalledTimes(3);
    response.next([]);
    response.complete();
    await fixture.whenStable();
    expect(text()).toContain('Todavía no hay tipos de trámite registrados.');
    expect(element.querySelector('.admin__table')).toBeNull();
    expect(element.querySelector('.admin__cards')).toBeNull();
    expect(element.querySelector('.admin__error')).toBeNull();
    expect(refreshButton()?.disabled).toBe(false);
    expect(service.createProcedure).not.toHaveBeenCalled();
    expect(service.updateProcedure).not.toHaveBeenCalled();
  });

  it('abre edición con una copia, impide diálogos simultáneos y cancelar no escribe ni recarga', async () => {
    await render();
    const ref = await open('edit');
    const data = ref.componentInstance['data'];
    expect(data).toEqual({ mode: 'edit', procedure: catalog[0] });
    if (data.mode === 'edit') expect(data.procedure).not.toBe(catalog[0]);
    button('Nuevo tipo').click();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(1);
    const fallback = element.querySelector<HTMLElement>('#procedure-types-title')!;
    const closed = firstValueFrom(ref.afterClosed());
    ref.close();
    await closed;
    await fixture.whenStable();
    expect(service.getProcedures).toHaveBeenCalledTimes(1);
    expect(service.createProcedure).not.toHaveBeenCalled();
    expect(service.updateProcedure).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(fallback);
  });

  it('restaura foco al origen si sigue visible', async () => {
    await render();
    const trigger = button('Nuevo tipo');
    vi.spyOn(trigger, 'getClientRects').mockReturnValue([{ width: 100 }] as unknown as DOMRectList);
    const ref = await open('create');
    const closed = firstValueFrom(ref.afterClosed());
    ref.close();
    await closed;
    await fixture.whenStable();
    expect(document.activeElement).toBe(trigger);
  });

  it.each(['create', 'edit'] as const)(
    '%s correcto cierra, avisa y conserva contexto si falla el GET, sin repetir escritura',
    async (mode) => {
      await render();
      const snack = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
      const ref = await open(mode);
      const form = ref.componentInstance['form'];
      if (mode === 'create') form.controls.value.setValue('nuevo');
      form.controls.label.setValue('Nuevo nombre');
      const reload = new Subject<ProcedureType[]>();
      service.getProcedures.mockReturnValue(reload);
      const closed = firstValueFrom(ref.afterClosed());
      ref.componentInstance['submit']();
      await closed;
      await fixture.whenStable();
      expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
      expect(snack).toHaveBeenCalledWith(
        mode === 'create' ? 'Tipo de trámite creado.' : 'Tipo de trámite actualizado.',
        undefined,
        { duration: 3000 },
      );
      expect(element.querySelector('.admin__table')?.textContent).toContain('Bache en calle');
      expect(
        element.querySelector('.admin__feedback--compact mat-progress-spinner'),
      ).not.toBeNull();
      reload.error(new Error('falló GET'));
      await fixture.whenStable();
      const message =
        mode === 'create'
          ? 'El tipo se creó, pero no pudimos actualizar el catálogo.'
          : 'Los cambios se guardaron, pero no pudimos actualizar el catálogo.';
      expect(text()).toContain(message);
      expect(element.querySelectorAll('.admin__error')).toHaveLength(1);
      expect(refreshButton()).toBeNull();
      expect(element.querySelector('.admin__cards')?.textContent).toContain('Servicio histórico');
      service.getProcedures
        .mockReturnValueOnce(throwError(() => new Error('todavía sin red')))
        .mockReturnValue(of([]));
      button('Reintentar').click();
      await fixture.whenStable();
      expect(text()).toContain(message);
      button('Reintentar').click();
      await fixture.whenStable();
      expect(text()).not.toContain(message);
      expect(text()).toContain('Todavía no hay tipos');
      expect(refreshButton()?.disabled).toBe(false);
      expect(service.getProcedures).toHaveBeenCalledTimes(4);
      expect(
        mode === 'create' ? service.createProcedure : service.updateProcedure,
      ).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(element.querySelector('#procedure-types-title'));
    },
  );

  it('escritura fallida conserva el diálogo y no inicia recarga ni snackbar', async () => {
    await render();
    service.createProcedure.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );
    const snack = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
    const ref = await open('create');
    ref.componentInstance['form'].patchValue({ value: 'bache', label: 'Nuevo nombre' });
    ref.componentInstance['submit']();
    await fixture.whenStable();
    expect(TestBed.inject(MatDialog).openDialogs).toContain(ref);
    expect(service.getProcedures).toHaveBeenCalledTimes(1);
    expect(snack).not.toHaveBeenCalled();
  });

  it.each(['Cancelar', 'Escape', 'backdrop'])(
    '404 de edición: cerrar con %s recarga sin repetir PUT',
    async (closeWith) => {
      await render();
      service.updateProcedure.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 404 })),
      );
      const ref = await open('edit');
      ref.componentInstance['form'].controls.label.setValue('Otro nombre');
      ref.componentInstance['submit']();
      await fixture.whenStable();
      const overlay = TestBed.inject(OverlayContainer).getContainerElement();
      const closed = firstValueFrom(ref.afterClosed());
      if (closeWith === 'Cancelar') ref.componentInstance['cancel']();
      else if (closeWith === 'Escape')
        overlay
          .querySelector('mat-dialog-container')!
          .dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
          );
      else overlay.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
      await closed;
      await fixture.whenStable();
      expect(service.getProcedures).toHaveBeenCalledTimes(2);
      expect(service.updateProcedure).toHaveBeenCalledTimes(1);
    },
  );

  it('guardar sustituye una actualización manual, detiene su giro y descarta respuestas anteriores; destruir cancela', async () => {
    const responses: Subscriber<ProcedureType[]>[] = [];
    await render(
      () =>
        new Observable<ProcedureType[]>((subscriber) => {
          responses.push(subscriber);
        }),
    );
    responses[0].next(catalog);
    responses[0].complete();
    await fixture.whenStable();
    refreshButton()!.click();
    await fixture.whenStable();
    expect(element.querySelector('.admin__refresh-icon--spinning')).not.toBeNull();
    const ref = await open('create');
    const closed = firstValueFrom(ref.afterClosed());
    ref.close({ kind: 'saved', mode: 'create' });
    await closed;
    await fixture.whenStable();
    expect(responses[1].closed).toBe(true);
    expect(element.querySelector('.admin__refresh-icon--spinning')).toBeNull();
    expect(refreshButton()?.disabled).toBe(true);
    responses[2].next(catalog);
    responses[1].next([]);
    await fixture.whenStable();
    expect(element.querySelector('.admin__table')?.textContent).toContain('Bache en calle');
    await open('edit');
    fixture.destroy();
    expect(responses[2].closed).toBe(true);
    expect(service.createProcedure).not.toHaveBeenCalled();
    expect(service.updateProcedure).not.toHaveBeenCalled();
  });
});
