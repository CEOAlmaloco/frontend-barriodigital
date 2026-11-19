import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';

import { activityText } from '../activity-summary';
import { formatDuration } from '../duration';
import { RequestGestionFormComponent } from '../request-gestion-form/request-gestion-form.component';
import { RequestActivity, RequestActivityEvent, RequestsService } from '../requests.service';

export interface RequestActivityDialogData {
  requestId: string;
  canRegister: boolean;
}

type ActivityFilter = 'TODOS' | RequestActivityEvent['kind'];

@Component({
  selector: 'app-request-activity-dialog',
  imports: [
    DatePipe,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    RequestGestionFormComponent,
  ],
  templateUrl: './request-activity-dialog.component.html',
  styleUrl: './request-activity-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestActivityDialogComponent {
  private readonly requests = inject(RequestsService);
  protected readonly data = inject<RequestActivityDialogData>(MAT_DIALOG_DATA);

  protected readonly filters: { id: ActivityFilter; label: string }[] = [
    { id: 'TODOS', label: 'Todos' },
    { id: 'ESTADO', label: 'Estado' },
    { id: 'GESTION', label: 'Contacto' },
    { id: 'CREADO', label: 'Creación' },
  ];

  protected readonly activity = signal<RequestActivity | null>(null);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly filter = signal<ActivityFilter>('TODOS');
  protected readonly duration = formatDuration;

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

  protected titleOf(event: RequestActivityEvent): string {
    return activityText(event).title;
  }

  protected replaceActivity(activity: RequestActivity): void {
    this.activity.set(activity);
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
}
