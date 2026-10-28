import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTimepickerModule } from '@angular/material/timepicker';

import {
  RequestActivity,
  RequestActivityEvent,
  RequestsService,
} from '../requests.service';

export interface RequestActivityDialogData {
  requestId: string;
  canRegister: boolean;
}

const CHANNELS = [
  { value: 'LLAMADA', label: 'Llamada' },
  { value: 'CORREO', label: 'Correo' },
  { value: 'VISITA', label: 'Visita' },
  { value: 'MENSAJE', label: 'Mensaje' },
] as const;

const RESULTS = [
  { value: 'CONTESTO', label: 'Contestó' },
  { value: 'NO_CONTESTA', label: 'No contesta' },
  { value: 'NUMERO_INCORRECTO', label: 'Número incorrecto' },
  { value: 'BUZON', label: 'Buzón de voz' },
  { value: 'CORREO', label: 'Contacto por correo' },
  { value: 'CONFIRMADO', label: 'Contacto confirmado' },
  { value: 'VISITA_FALLIDA', label: 'Visita fallida' },
] as const;

type ActivityFilter = 'TODOS' | RequestActivityEvent['kind'];

@Component({
  selector: 'app-request-activity-dialog',
  imports: [
    DatePipe,
    MatButton,
    MatDatepickerModule,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTimepickerModule,
    ReactiveFormsModule,
  ],
  providers: [provideNativeDateAdapter(), { provide: MAT_DATE_LOCALE, useValue: 'es-CL' }],
  templateUrl: './request-activity-dialog.component.html',
  styleUrl: './request-activity-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestActivityDialogComponent {
  private readonly requests = inject(RequestsService);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly data = inject<RequestActivityDialogData>(MAT_DIALOG_DATA);

  protected readonly channels = CHANNELS;
  protected readonly results = RESULTS;
  protected readonly filters: { id: ActivityFilter; label: string }[] = [
    { id: 'TODOS', label: 'Todos' },
    { id: 'ESTADO', label: 'Estado' },
    { id: 'GESTION', label: 'Contacto' },
    { id: 'CREADO', label: 'Creación' },
  ];

  protected readonly activity = signal<RequestActivity | null>(null);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly filter = signal<ActivityFilter>('TODOS');
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly today = new Date();

  protected readonly gestionForm = this.formBuilder.group(
    {
      channel: this.formBuilder.nonNullable.control('LLAMADA', Validators.required),
      result: this.formBuilder.nonNullable.control('NO_CONTESTA', Validators.required),
      note: this.formBuilder.nonNullable.control('', Validators.maxLength(500)),
      nextAttemptDate: this.formBuilder.control<Date | null>(null),
      nextAttemptTime: this.formBuilder.control<Date | null>(null),
    },
    {
      validators: (control) => {
        const date = control.get('nextAttemptDate')?.value;
        const time = control.get('nextAttemptTime')?.value;
        return (date && !time) || (!date && time) ? { nextAttemptIncomplete: true } : null;
      },
    },
  );

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.requests.getActividad(this.data.requestId).subscribe({
      next: (activity) => {
        this.activity.set(activity);
        this.state.set('ready');
      },
      error: () => this.state.set('error'),
    });
  }

  protected visibleEvents(): RequestActivityEvent[] {
    const events = this.activity()?.eventos ?? [];
    const filter = this.filter();
    return filter === 'TODOS' ? events : events.filter((event) => event.kind === filter);
  }

  protected hasEvents(): boolean {
    return (this.activity()?.eventos.length ?? 0) > 0;
  }

  protected hasSummary(activity: RequestActivity): boolean {
    const times = activity.tiempos;
    const contact = activity.contacto;
    return (
      times.desdeElIngresoSegundos != null ||
      times.totalResolucionSegundos != null ||
      times.primeraAtencionSegundos != null ||
      times.gestionMunicipalSegundos != null ||
      (contact?.intentos ?? 0) > 0
    );
  }

  protected emptyMessage(): string {
    return this.hasEvents()
      ? 'No hay marcas de este tipo.'
      : 'Este trámite no tiene historial guardado.';
  }

  private nextAttemptInstant(date: Date | null, time: Date | null): string | undefined {
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

  protected duration(seconds: number | null): string {
    if (seconds == null) {
      return '';
    }
    const total = Math.max(0, Math.floor(seconds));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (days > 0) {
      return `${days} d ${hours} h`;
    }
    if (hours > 0) {
      return `${hours} h ${minutes} min`;
    }
    if (minutes > 0) {
      return `${minutes} min`;
    }
    return `${total} s`;
  }

  protected register(): void {
    if (this.gestionForm.invalid || this.saving()) {
      this.gestionForm.markAllAsTouched();
      return;
    }
    const value = this.gestionForm.getRawValue();
    const nextAttemptAt = this.nextAttemptInstant(value.nextAttemptDate, value.nextAttemptTime);
    this.saving.set(true);
    this.saveError.set(null);
    this.requests
      .registerGestion(this.data.requestId, {
        channel: value.channel,
        result: value.result,
        note: value.note.trim() || undefined,
        nextAttemptAt,
      })
      .subscribe({
        next: (activity) => {
          this.activity.set(activity);
          this.saving.set(false);
          this.gestionForm.patchValue({ note: '', nextAttemptDate: null, nextAttemptTime: null });
        },
        error: (error: HttpErrorResponse) => {
          this.saving.set(false);
          this.saveError.set(
            error.status === 0
              ? 'No se pudo guardar la gestión. Revisa la conexión e inténtalo de nuevo.'
              : 'No se guardó la gestión. El trámite no cambió.',
          );
        },
      });
  }
}
