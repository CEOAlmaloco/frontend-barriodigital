import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

import { Request, RequestStatus } from '../../../shared/models/request.model';
import { REJECTION_REASON_MAX_LENGTH, REQUEST_STATUS_VIEW } from '../requests.constants';
import { RequestsService } from '../requests.service';

export interface RequestStatusDialogData {
  request: Request;
  status: RequestStatus;
  procedureTypeLabel: string;
}

export type RequestStatusDialogResult = { kind: 'saved'; request: Request } | { kind: 'reload' };

@Component({
  selector: 'app-request-status-dialog',
  imports: [
    MatButton,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
    MatFormFieldModule,
    MatIcon,
    MatInputModule,
    MatProgressSpinner,
    ReactiveFormsModule,
  ],
  templateUrl: './request-status-dialog.component.html',
  styleUrl: './request-status-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestStatusDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<RequestStatusDialogComponent, RequestStatusDialogResult>,
  );
  private readonly requestsService = inject(RequestsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly data = inject<RequestStatusDialogData>(MAT_DIALOG_DATA);
  protected readonly statusView = REQUEST_STATUS_VIEW;
  protected readonly maxReasonLength = REJECTION_REASON_MAX_LENGTH;
  protected readonly isRejection = this.data.status === 'RECHAZADO';
  protected readonly isAdmission = this.data.status === 'ADMITIDO';
  protected readonly title = this.isRejection
    ? 'Rechazar trámite'
    : this.isAdmission
      ? 'Admitir trámite'
      : 'Confirmar cambio de estado';
  protected readonly confirmLabel = this.isRejection
    ? 'Confirmar rechazo'
    : this.isAdmission
      ? 'Confirmar admisión'
      : 'Confirmar cambio';

  protected readonly isSubmitting = signal(false);
  protected readonly requiresReload = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly rejectionForm = this.formBuilder.group({
    rejectionReason: [
      '',
      [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(REJECTION_REASON_MAX_LENGTH),
      ],
    ],
  });

  protected cancel(): void {
    if (!this.isSubmitting()) {
      this.dialogRef.close();
    }
  }

  protected closeAndReload(): void {
    if (this.requiresReload() && !this.isSubmitting()) {
      this.dialogRef.close({ kind: 'reload' });
    }
  }

  protected submit(): void {
    if (this.isSubmitting() || this.requiresReload()) {
      return;
    }
    if (this.isRejection && this.rejectionForm.invalid) {
      this.rejectionForm.markAllAsTouched();
      return;
    }

    const rejectionReason = this.rejectionForm.controls.rejectionReason.value.trim();
    this.isSubmitting.set(true);
    this.submitError.set(null);
    this.dialogRef.disableClose = true;
    this.rejectionForm.disable({ emitEvent: false });

    this.requestsService
      .changeStatus(this.data.request.id, {
        status: this.data.status,
        ...(this.isRejection ? { rejectionReason } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (request) => this.dialogRef.close({ kind: 'saved', request }),
        error: (error: unknown) => {
          this.isSubmitting.set(false);
          this.requiresReload.set(
            error instanceof HttpErrorResponse && (error.status === 404 || error.status === 409),
          );
          this.dialogRef.disableClose = false;
          this.rejectionForm.enable({ emitEvent: false });
          this.submitError.set(this.errorMessage(error));
        },
      });
  }

  private errorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'No pudimos confirmar el cambio. Inténtalo nuevamente.';
    }

    const message = typeof error.error?.message === 'string' ? error.error.message : '';
    switch (error.status) {
      case 0:
        return 'No pudimos confirmar el cambio. Revisa tu conexión e inténtalo nuevamente.';
      case 400:
        if (message === 'rejectionReason es obligatorio cuando el estado es RECHAZADO') {
          return 'Indica un motivo de rechazo que no esté vacío.';
        }
        if (message === 'rejectionReason no puede superar 500 caracteres') {
          return 'El motivo de rechazo no puede superar 500 caracteres.';
        }
        return 'No se pudo validar el cambio de estado. Revisa los datos e inténtalo nuevamente.';
      case 401:
        return 'Tu sesión ya no permite confirmar el cambio. Inicia sesión nuevamente.';
      case 403:
        return message === 'No tienes el rol necesario para este recurso' ||
          message === 'Solo un Funcionario puede cambiar el estado'
          ? message
          : 'No tienes permiso para cambiar el estado de este trámite.';
      case 404:
        return 'El trámite ya no está disponible. Actualiza la lista.';
      case 409:
        const transition = /^No se puede pasar de (\w+) a (\w+)$/.exec(message);
        if (
          transition &&
          Object.hasOwn(REQUEST_STATUS_VIEW, transition[1]) &&
          Object.hasOwn(REQUEST_STATUS_VIEW, transition[2])
        ) {
          const current = REQUEST_STATUS_VIEW[transition[1] as RequestStatus].label;
          const next = REQUEST_STATUS_VIEW[transition[2] as RequestStatus].label;
          return `No se puede pasar de ${current} a ${next}. Actualiza la lista.`;
        }
        return 'El estado del trámite cambió o esta transición ya no está permitida. Actualiza la lista.';
      default:
        return 'No pudimos confirmar el cambio. Inténtalo nuevamente.';
    }
  }
}
