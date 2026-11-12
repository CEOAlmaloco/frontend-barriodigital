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
import { RequestStatusBadgeComponent } from '../request-status-badge/request-status-badge.component';
import {
  INTERVENTION_REASON_MAX_LENGTH,
  REJECTION_REASON_MAX_LENGTH,
  REQUEST_STATUS_VIEW,
} from '../requests.constants';
import { RequestsService } from '../requests.service';

export interface RequestStatusDialogData {
  request: Request;
  status: RequestStatus;
  procedureTypeLabel: string;
  /** El Admin opera como intervención y debe explicar por qué (EP3-04, sección 3). */
  requireInterventionReason?: boolean;
  /** Desde el detalle se recarga el trámite, no el listado. */
  context?: 'list' | 'detail';
}

export type RequestStatusDialogResult = { kind: 'saved'; request: Request } | { kind: 'reload' };

function admissionErrors(
  target: string,
): Record<string, { message: string; requiresReload: boolean }> {
  return {
    QUOTA_EXHAUSTED: {
      message: 'No queda cupo disponible para este tipo de trámite.',
      requiresReload: true,
    },
    PROCEDURE_TYPE_UNAVAILABLE: {
      message: 'El tipo de trámite asociado ya no está disponible en el catálogo.',
      requiresReload: true,
    },
    ADMISSION_DEPENDENCY_INVALID_RESPONSE: {
      message: 'No pudimos obtener información válida del trámite.',
      requiresReload: false,
    },
    ADMISSION_DEPENDENCY_UNAVAILABLE: {
      message: `No pudimos consultar el trámite. Intenta consultar ${target} más tarde.`,
      requiresReload: false,
    },
    QUOTA_RESERVATION_UNCONFIRMED: {
      message: `No pudimos confirmar la reserva de cupo. Cierra y consulta ${target}; la operación requiere revisión.`,
      requiresReload: true,
    },
    ADMISSION_RESULT_UNCONFIRMED: {
      message: `No pudimos confirmar si el cambio se guardó. Cierra y consulta ${target} antes de realizar otra operación.`,
      requiresReload: true,
    },
    ADMISSION_RESPONSE_UNAVAILABLE: {
      message: `El cambio se guardó, pero no pudimos obtener su respuesta completa. Cierra y actualiza ${target}.`,
      requiresReload: true,
    },
    QUOTA_COMPENSATION_UNCONFIRMED: {
      message:
        'El cambio fue rechazado y no pudimos confirmar la devolución del cupo. La operación requiere revisión.',
      requiresReload: true,
    },
  };
}

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
    RequestStatusBadgeComponent,
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
  protected readonly maxInterventionLength = INTERVENTION_REASON_MAX_LENGTH;
  protected readonly requiresIntervention = this.data.requireInterventionReason === true;
  private readonly inDetail = this.data.context === 'detail';
  private readonly admissionMessages = admissionErrors(this.inDetail ? 'el trámite' : 'el listado');
  private readonly refreshHint = this.inDetail ? 'Actualiza el trámite.' : 'Actualiza la lista.';
  protected readonly reloadLabel = this.inDetail
    ? 'Cerrar y actualizar'
    : 'Cerrar y actualizar lista';
  protected readonly isRejection = this.data.status === 'RECHAZADO';
  protected readonly isAdmission = this.data.status === 'ADMITIDO';
  protected readonly title = this.isRejection
    ? 'Rechazar trámite'
    : this.isAdmission
      ? 'Admitir trámite'
      : 'Confirmar cambio de estado';
  protected readonly lead = this.isRejection
    ? 'El trámite quedará cerrado y el vecino recibirá el motivo por correo.'
    : this.isAdmission
      ? 'Una vez admitido, no podrá volver a Ingresado.'
      : 'Este cambio no se puede deshacer.';
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
    interventionReason: [
      '',
      [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(INTERVENTION_REASON_MAX_LENGTH),
      ],
    ],
  });

  constructor() {
    if (!this.isRejection) {
      this.rejectionForm.controls.rejectionReason.disable({ emitEvent: false });
    }
    if (!this.requiresIntervention) {
      this.rejectionForm.controls.interventionReason.disable({ emitEvent: false });
    }
  }

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
    if (this.rejectionForm.invalid) {
      this.rejectionForm.markAllAsTouched();
      return;
    }

    const rejectionReason = this.rejectionForm.controls.rejectionReason.value.trim();
    const interventionReason = this.rejectionForm.controls.interventionReason.value.trim();
    this.isSubmitting.set(true);
    this.submitError.set(null);
    this.dialogRef.disableClose = true;
    this.rejectionForm.disable({ emitEvent: false });

    this.requestsService
      .changeStatus(this.data.request.id, {
        status: this.data.status,
        ...(this.isRejection ? { rejectionReason } : {}),
        ...(this.requiresIntervention ? { interventionReason } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (request) => this.dialogRef.close({ kind: 'saved', request }),
        error: (error: unknown) => {
          this.isSubmitting.set(false);
          this.requiresReload.set(
            this.admissionError(error)?.requiresReload === true ||
              (error instanceof HttpErrorResponse &&
                (error.status === 404 ||
                  error.status === 409 ||
                  isResponsibleRejection(error) ||
                  (this.isAdmission && error.status === 0))),
          );
          this.dialogRef.disableClose = false;
          this.enableReasons();
          this.submitError.set(this.errorMessage(error));
        },
      });
  }

  private enableReasons(): void {
    if (this.isRejection) {
      this.rejectionForm.controls.rejectionReason.enable({ emitEvent: false });
    }
    if (this.requiresIntervention) {
      this.rejectionForm.controls.interventionReason.enable({ emitEvent: false });
    }
  }

  private errorMessage(error: unknown): string {
    const admission = this.admissionError(error);
    if (admission) {
      return admission.message;
    }
    if (!(error instanceof HttpErrorResponse)) {
      return 'No pudimos confirmar el cambio. Inténtalo nuevamente.';
    }

    const message = typeof error.error?.message === 'string' ? error.error.message : '';
    switch (error.status) {
      case 0:
        if (this.isAdmission) {
          return this.admissionMessages['ADMISSION_RESULT_UNCONFIRMED'].message;
        }
        return 'No pudimos confirmar el cambio. Revisa tu conexión e inténtalo nuevamente.';
      case 400:
        if (message === 'rejectionReason es obligatorio cuando el estado es RECHAZADO') {
          return 'Indica un motivo de rechazo que no esté vacío.';
        }
        if (message === 'rejectionReason no puede superar 500 caracteres') {
          return 'El motivo de rechazo no puede superar 500 caracteres.';
        }
        if (message === 'interventionReason es obligatorio para el Admin') {
          return 'Indica el motivo de intervención.';
        }
        if (message === 'interventionReason no puede superar 500 caracteres') {
          return 'El motivo de intervención no puede superar 500 caracteres.';
        }
        return 'No se pudo validar el cambio de estado. Revisa los datos e inténtalo nuevamente.';
      case 401:
        return 'Tu sesión ya no permite confirmar el cambio. Inicia sesión nuevamente.';
      case 403:
        if (message === 'Solo el responsable del tramite puede operarlo') {
          return `Solo el responsable del trámite puede operarlo. ${this.refreshHint}`;
        }
        return message === 'No tienes el rol necesario para este recurso' ||
          message === 'Solo un Funcionario puede cambiar el estado'
          ? message
          : 'No tienes permiso para cambiar el estado de este trámite.';
      case 404:
        return this.inDetail
          ? 'El trámite ya no está disponible.'
          : 'El trámite ya no está disponible. Actualiza la lista.';
      case 409:
        const transition = /^No se puede pasar de (\w+) a (\w+)$/.exec(message);
        if (
          transition &&
          Object.hasOwn(REQUEST_STATUS_VIEW, transition[1]) &&
          Object.hasOwn(REQUEST_STATUS_VIEW, transition[2])
        ) {
          const current = REQUEST_STATUS_VIEW[transition[1] as RequestStatus].label;
          const next = REQUEST_STATUS_VIEW[transition[2] as RequestStatus].label;
          return `No se puede pasar de ${current} a ${next}. ${this.refreshHint}`;
        }
        return `El estado del trámite cambió o esta transición ya no está permitida. ${this.refreshHint}`;
      default:
        return 'No pudimos confirmar el cambio. Inténtalo nuevamente.';
    }
  }

  private admissionError(error: unknown): { message: string; requiresReload: boolean } | null {
    if (!(error instanceof HttpErrorResponse)) return null;
    const code: unknown = error.error?.code;
    return typeof code === 'string' && Object.hasOwn(this.admissionMessages, code)
      ? this.admissionMessages[code]
      : null;
  }
}

function isResponsibleRejection(error: HttpErrorResponse): boolean {
  return (
    error.status === 403 &&
    error.error?.message === 'Solo el responsable del tramite puede operarlo'
  );
}
