import { OverlayContainer } from '@angular/cdk/overlay';
import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DEFAULT_OPTIONS, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';

import { CatalogService } from '../../../core/catalog/catalog.service';
import { ProcedureType } from '../../../shared/models/procedure-type.model';
import {
  ProcedureTypeDialogComponent,
  ProcedureTypeDialogData,
  ProcedureTypeDialogResult,
} from './procedure-type-dialog.component';

@Component({ template: '' })
class DialogHost {}

describe('ProcedureTypeDialogComponent', () => {
  const limited: ProcedureType = {
    value: 'semaforo',
    label: 'Semáforo',
    active: false,
    dailyQuota: 10,
    remainingQuota: 3,
  };
  let host: ComponentFixture<DialogHost>;
  let ref: MatDialogRef<ProcedureTypeDialogComponent, ProcedureTypeDialogResult>;
  let service: {
    createProcedure: ReturnType<typeof vi.fn>;
    updateProcedure: ReturnType<typeof vi.fn>;
  };
  const overlay = () => TestBed.inject(OverlayContainer).getContainerElement();
  const input = (name: string) =>
    overlay().querySelector<HTMLInputElement>(`input[formControlName="${name}"]`)!;
  const button = (label: string) =>
    Array.from(overlay().querySelectorAll<HTMLButtonElement>('button')).find(
      (item) => item.textContent?.trim() === label,
    )!;
  const write = (name: string, value: string) => {
    const field = input(name);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    return field;
  };
  const form = () => ref.componentInstance['form'];
  const submit = () => ref.componentInstance['submit']();
  const open = async (data: ProcedureTypeDialogData = { mode: 'create' }) => {
    ref = TestBed.inject(MatDialog).open(ProcedureTypeDialogComponent, { data });
    await host.whenStable();
  };

  beforeEach(async () => {
    service = {
      createProcedure: vi.fn(() => of(limited)),
      updateProcedure: vi.fn(() => of(limited)),
    };
    await TestBed.configureTestingModule({
      imports: [DialogHost, ProcedureTypeDialogComponent],
      providers: [
        { provide: CatalogService, useValue: service },
        {
          provide: MAT_DIALOG_DEFAULT_OPTIONS,
          useValue: { enterAnimationDuration: 0, exitAnimationDuration: 0 },
        },
      ],
    }).compileComponents();
    host = TestBed.createComponent(DialogHost);
    await host.whenStable();
  });

  afterEach(async () => {
    const dialog = TestBed.inject(MatDialog);
    const closed = dialog.openDialogs.map((ref) => firstValueFrom(ref.afterClosed()));
    dialog.closeAll();
    await Promise.all(closed);
    await host.whenStable();
  });

  it('crea inicialmente activo, sin campos de cupo y con ayuda asociada al código', async () => {
    await open();
    expect(form().controls.active.value).toBe(true);
    expect(input('value').readOnly).toBe(false);
    expect(input('value').disabled).toBe(false);
    expect(overlay().textContent).toContain('El tipo se creará sin límite diario.');
    expect(input('dailyQuota')).toBeNull();
    expect(overlay().querySelector('mat-checkbox[formControlName="unlimited"]')).toBeNull();
    const hint = overlay().querySelector('mat-hint')!;
    expect(hint.textContent).toContain('No podrás modificarlo después');
    expect(input('value').getAttribute('aria-describedby')).toContain(hint.id);
    button('Crear tipo').click();
    await host.whenStable();
    expect(overlay().textContent).toContain('Indica un código que no esté vacío.');
    expect(overlay().textContent).toContain('Indica un nombre que no esté vacío.');
    expect(service.createProcedure).not.toHaveBeenCalled();
  });

  it.each([
    ['', 'required'],
    ['   ', 'required'],
    ['Semaforo', 'pattern'],
    ['semáforo', 'pattern'],
    ['sema foro', 'pattern'],
    ['a'.repeat(41), 'maxlength'],
  ])('rechaza código %j al invocar submit directamente', async (value, error) => {
    await open();
    write('value', value);
    write('label', 'Nombre');
    submit();
    expect(form().controls.value.hasError(error)).toBe(true);
    expect(service.createProcedure).not.toHaveBeenCalled();
  });

  it('recorta código y nombre, conserva espacios internos y crea inactivo sin PUT', async () => {
    await open();
    write('value', `  ${'a'.repeat(40)}  `);
    write('label', `  ${'Á'.repeat(110)}  ¡Bien!  `);
    form().controls.active.setValue(false);
    const result = firstValueFrom(ref.afterClosed());
    button('Crear tipo').click();
    expect(await result).toEqual({ kind: 'saved', mode: 'create' });
    expect(service.createProcedure).toHaveBeenCalledWith({
      value: 'a'.repeat(40),
      label: `${'Á'.repeat(110)}  ¡Bien!`,
      active: false,
    });
    expect(service.updateProcedure).not.toHaveBeenCalled();
  });

  it.each(['   ', 'a'.repeat(121)])('rechaza nombre vacío o demasiado largo: %j', async (label) => {
    await open();
    write('value', 'semaforo');
    write('label', label);
    submit();
    expect(service.createProcedure).not.toHaveBeenCalled();
    expect(form().controls.label.invalid).toBe(true);
  });

  it('acepta 120 caracteres después de recortar los extremos', async () => {
    await open();
    write('value', 'semaforo');
    write('label', `   ${'Á'.repeat(120)}   `);
    submit();
    expect(service.createProcedure).toHaveBeenCalledWith({
      value: 'semaforo',
      label: 'Á'.repeat(120),
      active: true,
    });
  });

  it('edita con código de solo lectura enfocable y sin mutación del objeto de entrada, y exige cambio efectivo', async () => {
    const original = { ...limited };
    await open({ mode: 'edit', procedure: original });
    expect(input('value').value).toBe('semaforo');
    expect(input('value').readOnly).toBe(true);
    expect(input('value').disabled).toBe(false);
    expect(input('value').tabIndex).toBe(0);
    const codeField = input('value').closest('mat-form-field')!;
    expect(codeField.querySelector('mat-label')?.textContent).toBe('Código');
    const hint = codeField.querySelector('mat-hint')!;
    expect(hint.textContent).toBe('El código no se puede modificar');
    expect(input('value').getAttribute('aria-describedby')).toContain(hint.id);
    input('value').focus();
    input('value').select();
    expect(document.activeElement).toBe(input('value'));
    expect(input('value').selectionStart).toBe(0);
    expect(input('value').selectionEnd).toBe('semaforo'.length);
    expect(input('dailyQuota').value).toBe('10');
    expect(input('dailyQuota').disabled).toBe(false);
    expect(form().controls.active.value).toBe(false);
    expect(button('Guardar cambios').disabled).toBe(true);
    write('label', '  Semáforo  ');
    await host.whenStable();
    expect(button('Guardar cambios').disabled).toBe(true);
    submit();
    expect(service.updateProcedure).not.toHaveBeenCalled();
    write('label', 'Otro nombre');
    await host.whenStable();
    expect(button('Guardar cambios').disabled).toBe(false);
    expect(original).toEqual(limited);
    button('Cancelar').click();
    expect(service.updateProcedure).not.toHaveBeenCalled();
  });

  it.each(['label', 'active'] as const)(
    'edita solo %s con PUT completo y conserva el cupo',
    async (field) => {
      await open({ mode: 'edit', procedure: limited });
      if (field === 'label') write('label', '  Otro nombre  ');
      else form().controls.active.setValue(true);
      // Aunque se altere el control de solo lectura, la URL conserva el código original.
      form().controls.value.setValue('otro');
      const result = firstValueFrom(ref.afterClosed());
      submit();
      expect(await result).toEqual({ kind: 'saved', mode: 'edit' });
      expect(service.updateProcedure).toHaveBeenCalledWith('semaforo', {
        label: field === 'label' ? 'Otro nombre' : 'Semáforo',
        active: field === 'active',
        dailyQuota: 10,
      });
      expect(service.createProcedure).not.toHaveBeenCalled();
    },
  );

  it('alterna sin límite, vacía y deshabilita el campo, y restaura el último valor', async () => {
    await open({ mode: 'edit', procedure: limited });
    write('dailyQuota', '27');
    form().controls.unlimited.setValue(true);
    await host.whenStable();
    expect(input('dailyQuota').disabled).toBe(true);
    expect(input('dailyQuota').value).toBe('');
    expect(form().controls.active.value).toBe(false);
    form().controls.unlimited.setValue(false);
    await host.whenStable();
    expect(input('dailyQuota').disabled).toBe(false);
    expect(input('dailyQuota').value).toBe('27');
    form().controls.unlimited.setValue(true);
    submit();
    expect(service.updateProcedure).toHaveBeenCalledWith('semaforo', {
      label: 'Semáforo',
      active: false,
      dailyQuota: null,
    });
  });

  it('bloquea el código al guardar y tras error restaura solo lectura sin cambiar el destino del PUT', async () => {
    const response = new Subject<ProcedureType>();
    service.updateProcedure.mockReturnValueOnce(response);
    await open({ mode: 'edit', procedure: limited });
    form().controls.value.setValue('otro');
    write('label', 'Otro nombre');
    submit();
    await host.whenStable();
    expect(input('value').disabled).toBe(true);
    expect(input('value').readOnly).toBe(true);
    expect(service.updateProcedure).toHaveBeenCalledWith('semaforo', {
      label: 'Otro nombre',
      active: false,
      dailyQuota: 10,
    });
    response.error(new HttpErrorResponse({ status: 503 }));
    await host.whenStable();
    expect(input('value').disabled).toBe(false);
    expect(input('value').readOnly).toBe(true);
    expect(input('value').value).toBe('semaforo');
    expect(input('label').value).toBe('Otro nombre');
    expect(button('Guardar cambios').disabled).toBe(false);
    submit();
    expect(service.updateProcedure).toHaveBeenCalledTimes(2);
    expect(service.updateProcedure).toHaveBeenLastCalledWith('semaforo', {
      label: 'Otro nombre',
      active: false,
      dailyQuota: 10,
    });
    expect(service.updateProcedure.mock.calls[1][1]).not.toHaveProperty('remainingQuota');
  });

  it('inicia sin límite y al desmarcarlo exige un cupo sin inventar un valor', async () => {
    await open({ mode: 'edit', procedure: { ...limited, dailyQuota: null, remainingQuota: null } });
    expect(input('dailyQuota').disabled).toBe(true);
    expect(input('dailyQuota').value).toBe('');
    form().controls.unlimited.setValue(false);
    await host.whenStable();
    expect(input('dailyQuota').value).toBe('');
    expect(button('Guardar cambios').disabled).toBe(true);
    submit();
    expect(service.updateProcedure).not.toHaveBeenCalled();
  });

  it.each([null, 0, -1, 1.5, 2_147_483_648, Infinity, NaN])(
    'rechaza cupo %s también en TypeScript',
    async (quota) => {
      await open({ mode: 'edit', procedure: limited });
      form().controls.dailyQuota.setValue(quota);
      submit();
      expect(form().controls.dailyQuota.invalid).toBe(true);
      expect(service.updateProcedure).not.toHaveBeenCalled();
    },
  );

  it.each([1, 2_147_483_647])('acepta el extremo válido %s', async (quota) => {
    await open({ mode: 'edit', procedure: limited });
    write('dailyQuota', String(quota));
    submit();
    expect(service.updateProcedure).toHaveBeenCalledWith('semaforo', {
      label: 'Semáforo',
      active: false,
      dailyQuota: quota,
    });
  });

  it('bloquea formulario, acciones, Escape, clic fuera y doble envío mientras guarda', async () => {
    const response = new Subject<ProcedureType>();
    service.createProcedure.mockReturnValue(response);
    await open();
    write('value', 'semaforo');
    write('label', 'Nombre');
    button('Crear tipo').click();
    await host.whenStable();
    expect(form().disabled).toBe(true);
    expect(button('Cancelar').disabled).toBe(true);
    expect(button('Crear tipo').disabled).toBe(true);
    expect(ref.disableClose).toBe(true);
    expect(overlay().querySelector('.procedure-type-dialog__spinner')).not.toBeNull();
    overlay().querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
    overlay()
      .querySelector('mat-dialog-container')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    submit();
    ref.componentInstance['cancel']();
    await host.whenStable();
    expect(TestBed.inject(MatDialog).openDialogs).toContain(ref);
    expect(service.createProcedure).toHaveBeenCalledTimes(1);
  });

  it('permite corregir un código duplicado sin perder nombre ni actividad', async () => {
    service.createProcedure.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );
    await open();
    write('value', 'semaforo');
    write('label', 'Nombre');
    form().controls.active.setValue(false);
    button('Crear tipo').click();
    await host.whenStable();
    expect(overlay().textContent).toContain('El código ya existe. Introduce otro código.');
    expect(input('value').disabled).toBe(false);
    expect(input('label').value).toBe('Nombre');
    expect(form().controls.active.value).toBe(false);
    expect(ref.disableClose).toBe(false);
    write('value', 'nuevo');
    submit();
    expect(service.createProcedure).toHaveBeenLastCalledWith({
      value: 'nuevo',
      label: 'Nombre',
      active: false,
    });
  });

  it.each([false, true])(
    'tras un error restaura correctamente cupo sin límite=%s y conserva datos',
    async (unlimited) => {
      service.updateProcedure.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: { message: 'La etiqueta supera los 120 caracteres' },
            }),
        ),
      );
      await open({ mode: 'edit', procedure: limited });
      write('label', 'Otro nombre');
      form().controls.unlimited.setValue(unlimited);
      submit();
      await host.whenStable();
      expect(input('label').value).toBe('Otro nombre');
      expect(form().controls.value.enabled).toBe(true);
      expect(input('value').readOnly).toBe(true);
      expect(input('value').disabled).toBe(false);
      expect(input('value').value).toBe('semaforo');
      expect(form().controls.unlimited.enabled).toBe(true);
      expect(input('dailyQuota').disabled).toBe(unlimited);
      expect(input('dailyQuota').value).toBe(unlimited ? '' : '10');
      expect(overlay().querySelectorAll('.procedure-type-dialog__error')).toHaveLength(1);
      expect(overlay().textContent).toContain('La etiqueta supera los 120 caracteres');
    },
  );

  it.each([
    [0, 'Revisa tu conexión'],
    [400, 'Revisa el formulario'],
    [401, 'Inicia sesión nuevamente'],
    [403, 'No tienes permiso'],
    [500, 'Intenta nuevamente'],
  ])('HTTP %s con mensaje vacío conserva formulario y ofrece respaldo', async (status, message) => {
    service.createProcedure.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status, error: { message: '  ' } })),
    );
    await open();
    write('value', 'semaforo');
    write('label', 'Nombre');
    submit();
    await host.whenStable();
    expect(overlay().textContent).toContain(message);
    expect(input('label').value).toBe('Nombre');
    expect(ref.disableClose).toBe(false);
    expect(service.createProcedure).toHaveBeenCalledTimes(1);
  });

  it.each([400, 401, 403, 404, 409, 500, 502, 503])(
    'HTTP %s nunca muestra SQL, esquema ni trace aunque message tenga texto',
    async (status) => {
      const technical =
        'ORA-01407: BARRIODIGITAL.PROCEDURE_TYPES.DAILY_QUOTA; update procedure_types; org.hibernate.exception.ConstraintViolationException';
      service.updateProcedure.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status,
              error: { message: technical, trace: technical, exception: technical },
            }),
        ),
      );
      await open({ mode: 'edit', procedure: limited });
      write('label', 'Otro nombre');
      submit();
      await host.whenStable();
      expect(overlay().textContent).not.toContain('ORA-');
      expect(overlay().textContent).not.toContain('BARRIODIGITAL');
      expect(overlay().textContent).not.toContain('update procedure_types');
      expect(overlay().textContent).not.toContain('org.hibernate');
      expect(overlay().querySelectorAll('.procedure-type-dialog__error')).toHaveLength(1);
      expect(input('label').value).toBe('Otro nombre');
    },
  );

  it('404 del PUT impide reenviar y devuelve recarga al cerrar', async () => {
    service.updateProcedure.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );
    await open({ mode: 'edit', procedure: limited });
    write('label', 'Otro nombre');
    submit();
    await host.whenStable();
    expect(overlay().textContent).toContain('El tipo ya no está disponible.');
    expect(input('label').value).toBe('Otro nombre');
    expect(overlay().querySelector('button[type="submit"]')).toBeNull();
    submit();
    expect(service.updateProcedure).toHaveBeenCalledTimes(1);
    const result = firstValueFrom(ref.afterClosed());
    button('Cancelar').click();
    expect(await result).toEqual({ kind: 'reload' });
  });

  it('no envía un modo desconocido', async () => {
    await open({ mode: 'desconocido' } as unknown as ProcedureTypeDialogData);
    write('value', 'semaforo');
    write('label', 'Nombre');
    submit();
    expect(service.createProcedure).not.toHaveBeenCalled();
    expect(service.updateProcedure).not.toHaveBeenCalled();
  });

  it('cancela la suscripción al destruir el diálogo sin compensaciones', async () => {
    const response = new Subject<ProcedureType>();
    service.createProcedure.mockReturnValue(response);
    await open();
    write('value', 'semaforo');
    write('label', 'Nombre');
    submit();
    expect(response.observed).toBe(true);
    const closed = firstValueFrom(ref.afterClosed());
    ref.close();
    await closed;
    await host.whenStable();
    expect(response.observed).toBe(false);
    expect(service.updateProcedure).not.toHaveBeenCalled();
  });
});
