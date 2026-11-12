import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTimepickerModule } from '@angular/material/timepicker';

import {
  CONTACT_CHANNELS,
  CONTACT_RESULTS,
  INTERVENTION_REASON_MAX_LENGTH,
} from '../requests.constants';
import { RequestActivity, RequestsService } from '../requests.service';

/** Error que cambia lo que el trámite permite: quien lo muestra debe recargarlo. */
export interface GestionFailure {
  message: string;
  requiresReload: boolean;
}

@Component({
  selector: 'app-request-gestion-form',
  imports: [
    MatButton,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTimepickerModule,
    ReactiveFormsModule,
  ],
  providers: [provideNativeDateAdapter(), { provide: MAT_DATE_LOCALE, useValue: 'es-CL' }],
  templateUrl: './request-gestion-form.component.html',
  styleUrl: './request-gestion-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestGestionFormComponent {
  private readonly requests = inject(RequestsService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly requestId = input.required<string>();
  /** El Admin registra como intervención y debe explicar por qué (EP3-04, sección 3). */
  readonly requireInterventionReason = input(false);
  readonly showTitle = input(true);
  readonly showCancel = input(false);
  readonly registered = output<RequestActivity>();
  readonly failed = output<GestionFailure>();
  readonly cancelled = output<void>();

  protected readonly channels = CONTACT_CHANNELS;
  protected readonly results = CONTACT_RESULTS;
  protected readonly interventionMaxLength = INTERVENTION_REASON_MAX_LENGTH;
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly today = new Date();

  protected readonly form = this.formBuilder.group(
    {
      channel: this.formBuilder.nonNullable.control('LLAMADA', Validators.required),
      result: this.formBuilder.nonNullable.control('NO_CONTESTA', Validators.required),
      note: this.formBuilder.nonNullable.control('', Validators.maxLength(500)),
      nextAttemptDate: this.formBuilder.control<Date | null>(null),
      nextAttemptTime: this.formBuilder.control<Date | null>(null),
      interventionReason: this.formBuilder.nonNullable.control('', [
        Validators.maxLength(INTERVENTION_REASON_MAX_LENGTH),
      ]),
    },
    {
      validators: (control) => {
        const date = control.get('nextAttemptDate')?.value;
        const time = control.get('nextAttemptTime')?.value;
        return (date && !time) || (!date && time) ? { nextAttemptIncomplete: true } : null;
      },
    },
  );

  protected interventionMissing(): boolean {
    return this.requireInterventionReason() && !this.form.controls.interventionReason.value.trim();
  }

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    if (this.form.invalid || this.interventionMissing()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.saveError.set(null);
    this.requests
      .registerGestion(this.requestId(), {
        channel: value.channel,
        result: value.result,
        note: value.note.trim() || undefined,
        nextAttemptAt: nextAttemptInstant(value.nextAttemptDate, value.nextAttemptTime),
        ...(this.requireInterventionReason()
          ? { interventionReason: value.interventionReason.trim() }
          : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (activity) => {
          this.saving.set(false);
          this.form.patchValue({
            note: '',
            nextAttemptDate: null,
            nextAttemptTime: null,
            interventionReason: '',
          });
          this.form.markAsUntouched();
          this.registered.emit(activity);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          const failure = gestionFailure(error);
          this.saveError.set(failure.message);
          this.failed.emit(failure);
        },
      });
  }
}

function nextAttemptInstant(date: Date | null, time: Date | null): string | undefined {
  if (!date || !time) {
    return undefined;
  }
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    time.getHours(),
    time.getMinutes(),
    0,
  ).toISOString();
}

function gestionFailure(error: unknown): GestionFailure {
  if (!(error instanceof HttpErrorResponse)) {
    return { message: 'No se guardó la gestión. El trámite no cambió.', requiresReload: false };
  }
  const message = typeof error.error?.message === 'string' ? error.error.message : '';
  if (error.status === 0) {
    return {
      message: 'No se pudo guardar la gestión. Revisa la conexión e inténtalo de nuevo.',
      requiresReload: false,
    };
  }
  if (error.status === 400 && message === 'interventionReason es obligatorio para el Admin') {
    return { message: 'Indica el motivo de intervención.', requiresReload: false };
  }
  if (error.status === 400 && message === 'nextAttemptAt debe ser una fecha futura') {
    return { message: 'El próximo intento debe quedar en el futuro.', requiresReload: false };
  }
  if (error.status === 403 && message === 'Solo el responsable del tramite puede operarlo') {
    return {
      message:
        'Solo el responsable del trámite puede registrar gestiones. El trámite cambió de responsable.',
      requiresReload: true,
    };
  }
  if (error.status === 404) {
    return { message: 'El trámite ya no está disponible.', requiresReload: true };
  }
  if (error.status === 409) {
    return {
      message: 'El trámite ya está cerrado y no admite gestiones.',
      requiresReload: true,
    };
  }
  return { message: 'No se guardó la gestión. El trámite no cambió.', requiresReload: false };
}
