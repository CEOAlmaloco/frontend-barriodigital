import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

import { activityText } from '../activity-summary';
import { RequestActivityEvent, RequestActivityKind } from '../requests.service';

type TimelineFilter = 'TODOS' | RequestActivityKind;

const FILTER_LABELS: Record<TimelineFilter, string> = {
  TODOS: 'Todo',
  ESTADO: 'Estado',
  GESTION: 'Contacto',
  ASIGNACION: 'Asignación',
  CREADO: 'Ingreso',
};

const CHANNEL_ICONS: Record<string, string> = {
  LLAMADA: 'call',
  CORREO: 'mail',
  VISITA: 'directions_walk',
  MENSAJE: 'sms',
};

@Component({
  selector: 'app-request-timeline',
  imports: [DatePipe, MatIcon],
  templateUrl: './request-timeline.component.html',
  styleUrl: './request-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestTimelineComponent {
  readonly events = input.required<readonly RequestActivityEvent[]>();
  /** El staff ve filtros, marcas internas, rol del actor y motivo de intervención. */
  readonly staff = input(false);

  protected readonly filter = signal<TimelineFilter>('TODOS');

  protected readonly filters = computed(() => {
    if (!this.staff()) {
      return [];
    }
    const kinds = new Set(this.events().map((event) => event.kind));
    const options = (['ESTADO', 'GESTION', 'ASIGNACION'] as const).filter((kind) =>
      kinds.has(kind),
    );
    if (options.length === 0 || kinds.size < 2) {
      return [];
    }
    return (['TODOS', ...options] as TimelineFilter[]).map((id) => ({
      id,
      label: FILTER_LABELS[id],
    }));
  });

  protected readonly visible = computed(() => {
    const filter = this.filter();
    return [...this.events()]
      .reverse()
      .filter((event) => filter === 'TODOS' || event.kind === filter)
      .map((event) => ({ event, text: activityText(event) }));
  });

  protected icon(event: RequestActivityEvent): string {
    switch (event.kind) {
      case 'CREADO':
        return 'add';
      case 'GESTION':
        return CHANNEL_ICONS[event.channel ?? ''] ?? 'support_agent';
      case 'ASIGNACION':
        return 'assignment_ind';
      default:
        if (event.toStatus === 'RECHAZADO') return 'block';
        if (event.toStatus === 'RESUELTO') return 'task_alt';
        if (event.toStatus === 'CANCELADO') return 'cancel';
        return 'arrow_forward';
    }
  }

  protected tone(event: RequestActivityEvent): string {
    if (event.kind === 'GESTION') return 'secondary';
    if (event.kind === 'ASIGNACION') return 'accent';
    if (event.toStatus === 'RECHAZADO') return 'error';
    if (event.toStatus === 'RESUELTO') return 'success';
    return 'primary';
  }

  protected actor(event: RequestActivityEvent): string {
    return event.actorName?.trim() || (this.staff() ? event.actorId : null) || 'Municipalidad';
  }

  protected showIntervention(event: RequestActivityEvent): boolean {
    return this.staff() && !!event.interventionReason?.trim();
  }
}
