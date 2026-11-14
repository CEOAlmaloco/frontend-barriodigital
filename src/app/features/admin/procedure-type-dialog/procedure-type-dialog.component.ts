import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, ValidatorFn } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSlideToggle } from '@angular/material/slide-toggle';

import { CatalogService } from '../../../core/catalog/catalog.service';
import { InfoToggletipComponent } from '../../../shared/components/info-toggletip/info-toggletip.component';
import { ProcedureType, UpdateProcedureType } from '../../../shared/models/procedure-type.model';

export type ProcedureTypeDialogData =
  { mode: 'create' } | { mode: 'edit'; procedure: ProcedureType };

export type ProcedureTypeDialogResult =
  { kind: 'saved'; mode: 'create' | 'edit' } | { kind: 'reload' };

const MAX_QUOTA = 2_147_483_647;
/** Rango de catalog (EP3-06, sección 1.1). */
export const MIN_SLA_DAYS = 1;
export const MAX_SLA_DAYS = 120;
const SLA_RANGE_MESSAGE = 'El plazo debe ser un entero entre 1 y 120 dias habiles';

const codeValidator: ValidatorFn = (control) => {
  const value = typeof control.value === 'string' ? control.value.trim() : '';
  if (!value) return { required: true };
  if (value.length > 40) return { maxlength: true };
  return /^[a-z0-9_-]{1,40}$/.test(value) ? null : { pattern: true };
};

const nameValidator: ValidatorFn = (control) => {
  const value = typeof control.value === 'string' ? control.value.trim() : '';
  if (!value) return { required: true };
  return value.length <= 120 ? null : { maxlength: true };
};

const quotaValidator: ValidatorFn = (control) => {
  const value: unknown = control.value;
  if (value === null || value === '') return { required: true };
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    return { integer: true };
  }
  if (value < 1) return { min: true };
  return value <= MAX_QUOTA ? null : { max: true };
};

const slaValidator: ValidatorFn = (control) => {
  const value: unknown = control.value;
  if (value === null || value === '') return { required: true };
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    return { integer: true };
  }
  return value >= MIN_SLA_DAYS && value <= MAX_SLA_DAYS ? null : { range: true };
};

@Component({
  selector: 'app-procedure-type-dialog',
  imports: [
    InfoToggletipComponent,
    MatButton,
    MatCheckbox,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinner,
    MatSlideToggle,
    ReactiveFormsModule,
  ],
  templateUrl: './procedure-type-dialog.component.html',
  styleUrl: './procedure-type-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcedureTypeDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<ProcedureTypeDialogComponent, ProcedureTypeDialogResult>,
  );
  private readonly catalogService = inject(CatalogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  protected readonly data = inject<ProcedureTypeDialogData>(MAT_DIALOG_DATA);
  protected readonly isEdit = this.data.mode === 'edit';
  protected readonly title = this.isEdit ? 'Editar tipo de trámite' : 'Nuevo tipo de trámite';
  protected readonly initial = this.data.mode === 'edit' ? { ...this.data.procedure } : null;
  private previousQuota: number | null = this.initial?.dailyQuota ?? null;
  private previousSla: number | null = this.initial?.slaBusinessDays ?? null;
  protected readonly minSla = MIN_SLA_DAYS;
  protected readonly maxSla = MAX_SLA_DAYS;

  protected readonly isSubmitting = signal(false);
  // La pantalla también lo consulta si el cierre después de un 404 fue con Escape o clic fuera.
  readonly requiresReload = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly form = this.formBuilder.group({
    value: [this.initial?.value ?? '', codeValidator],
    label: [this.initial?.label ?? '', nameValidator],
    active: [this.initial?.active ?? true],
    unlimited: [this.initial?.dailyQuota == null],
    dailyQuota: this.formBuilder.control<number | null>(this.previousQuota, quotaValidator),
    // Igual que el cupo: quitar el plazo es una decisión explícita, no un campo que quedó vacío
    noSla: [this.initial?.slaBusinessDays == null],
    slaBusinessDays: this.formBuilder.control<number | null>(this.previousSla, slaValidator),
  });

  constructor() {
    this.restoreControls();
    this.form.controls.unlimited.valueChanges.pipe(takeUntilDestroyed()).subscribe((unlimited) => {
      const quota = this.form.controls.dailyQuota;
      if (unlimited) {
        this.previousQuota = quota.value;
        quota.setValue(null, { emitEvent: false });
        quota.disable({ emitEvent: false });
      } else {
        quota.setValue(this.previousQuota, { emitEvent: false });
        quota.enable({ emitEvent: false });
      }
    });
    this.form.controls.noSla.valueChanges.pipe(takeUntilDestroyed()).subscribe((noSla) => {
      const sla = this.form.controls.slaBusinessDays;
      if (noSla) {
        this.previousSla = sla.value;
        sla.setValue(null, { emitEvent: false });
        sla.disable({ emitEvent: false });
      } else {
        sla.setValue(this.previousSla, { emitEvent: false });
        sla.enable({ emitEvent: false });
      }
    });
  }

  protected hasChanges(): boolean {
    if (!this.initial) return true;
    const { label, active, unlimited, dailyQuota, noSla, slaBusinessDays } =
      this.form.getRawValue();
    return (
      label.trim() !== this.initial.label.trim() ||
      active !== this.initial.active ||
      (unlimited ? null : dailyQuota) !== this.initial.dailyQuota ||
      (noSla ? null : slaBusinessDays) !== this.initial.slaBusinessDays
    );
  }

  protected cancel(): void {
    if (!this.isSubmitting()) {
      this.dialogRef.close(this.requiresReload() ? { kind: 'reload' } : undefined);
    }
  }

  protected submit(): void {
    if (
      (this.data.mode !== 'create' && this.data.mode !== 'edit') ||
      this.isSubmitting() ||
      this.requiresReload()
    ) {
      return;
    }
    const { value, label, active, unlimited, dailyQuota, noSla, slaBusinessDays } =
      this.form.getRawValue();
    // También valida los valores crudos: deshabilitar un control no debe permitir un envío inválido.
    if (
      nameValidator(this.form.controls.label) ||
      typeof active !== 'boolean' ||
      typeof noSla !== 'boolean' ||
      (!noSla && slaValidator(this.form.controls.slaBusinessDays)) ||
      (this.data.mode === 'create' && codeValidator(this.form.controls.value)) ||
      (this.data.mode === 'edit' &&
        (typeof unlimited !== 'boolean' ||
          (!unlimited && quotaValidator(this.form.controls.dailyQuota))))
    ) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.data.mode === 'edit' && (!this.initial?.value || !this.hasChanges())) return;

    // El PUT reemplaza el plazo completo: se envía siempre, y null es sin plazo (EP3-06, sección 1.1)
    const update: UpdateProcedureType = {
      label: label.trim(),
      active,
      dailyQuota: unlimited ? null : dailyQuota,
      slaBusinessDays: noSla ? null : slaBusinessDays,
    };
    const request =
      this.data.mode === 'create'
        ? this.catalogService.createProcedure({
            value: value.trim(),
            label: update.label,
            active,
            slaBusinessDays: update.slaBusinessDays,
          })
        : this.catalogService.updateProcedure(this.initial!.value, update);

    this.isSubmitting.set(true);
    this.submitError.set(null);
    this.dialogRef.disableClose = true;
    this.form.disable({ emitEvent: false });
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.dialogRef.close({ kind: 'saved', mode: this.data.mode }),
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        this.requiresReload.set(
          this.isEdit && error instanceof HttpErrorResponse && error.status === 404,
        );
        this.dialogRef.disableClose = false;
        this.restoreControls();
        this.submitError.set(this.errorMessage(error));
      },
    });
  }

  private restoreControls(): void {
    if (this.requiresReload()) return;
    const { value, label, active, unlimited, dailyQuota, noSla, slaBusinessDays } =
      this.form.controls;
    label.enable({ emitEvent: false });
    active.enable({ emitEvent: false });
    value.enable({ emitEvent: false });
    noSla.enable({ emitEvent: false });
    if (noSla.value) {
      slaBusinessDays.disable({ emitEvent: false });
    } else {
      slaBusinessDays.enable({ emitEvent: false });
    }
    if (this.isEdit) {
      value.setValue(this.initial!.value, { emitEvent: false });
      unlimited.enable({ emitEvent: false });
    } else {
      unlimited.disable({ emitEvent: false });
    }
    if (!this.isEdit || this.form.controls.unlimited.value) {
      dailyQuota.disable({ emitEvent: false });
    } else {
      dailyQuota.enable({ emitEvent: false });
    }
  }

  private errorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'No pudimos guardar el tipo de trámite. Intenta nuevamente.';
    }
    const message = typeof error.error?.message === 'string' ? error.error.message : '';
    if (error.status === 400 && message === SLA_RANGE_MESSAGE) {
      return 'El plazo debe ser un número entero entre 1 y 120 días hábiles.';
    }
    // Solo textos de validación conocidos: un mensaje no vacío puede contener SQL o una excepción.
    const validationMessages = [
      'El codigo value es obligatorio',
      'El codigo value debe ser minusculas, numeros, guion o guion bajo',
      'La etiqueta es obligatoria',
      'La etiqueta supera los 120 caracteres',
      'El campo active es obligatorio',
      'El cupo diario debe ser al menos 1',
      'No se puede cambiar el codigo value',
    ];
    if (error.status === 400 && validationMessages.includes(message)) return message;
    switch (error.status) {
      case 0:
        return 'No pudimos guardar el tipo de trámite. Revisa tu conexión e intenta nuevamente.';
      case 400:
        return 'No se pudieron validar los datos. Revisa el formulario e intenta nuevamente.';
      case 401:
        return 'Tu sesión ya no permite guardar cambios. Inicia sesión nuevamente.';
      case 403:
        return 'No tienes permiso para administrar los tipos de trámite.';
      case 404:
        return this.isEdit
          ? 'El tipo ya no está disponible. Cierra y actualiza el catálogo.'
          : 'No pudimos crear el tipo de trámite. Intenta nuevamente.';
      case 409:
        if (!this.isEdit) return 'El código ya existe. Introduce otro código.';
    }
    return 'No pudimos guardar el tipo de trámite. Intenta nuevamente.';
  }
}
