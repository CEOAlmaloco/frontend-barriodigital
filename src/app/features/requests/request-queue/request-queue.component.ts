import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatIcon } from '@angular/material/icon';

import { RequestQueue } from '../request-list-query';

export interface RequestQueueOption {
  value: RequestQueue;
  label: string;
  icon: string;
}

/**
 * Filtros rápidos del staff: la bandeja por responsable (EP3-05, sección 8) y contacto pendiente
 * (EP3-66). Contacto pendiente va fuera del grupo para combinarse con cualquier bandeja.
 */
@Component({
  selector: 'app-request-queue',
  imports: [MatButtonToggle, MatButtonToggleGroup, MatIcon],
  template: `
    <mat-button-toggle-group
      class="queue"
      aria-label="Bandeja"
      [value]="value()"
      (change)="valueChange.emit($event.value)"
    >
      @for (queue of queues(); track queue.value) {
        <mat-button-toggle [value]="queue.value">
          <mat-icon aria-hidden="true">{{ queue.icon }}</mat-icon>
          {{ queue.label }}
        </mat-button-toggle>
      }
    </mat-button-toggle-group>

    <mat-button-toggle
      class="contact"
      [checked]="contactDue()"
      (change)="contactDueChange.emit($event.source.checked)"
    >
      <mat-icon aria-hidden="true">{{ contactDue() ? 'check' : 'phone_callback' }}</mat-icon>
      Contacto pendiente
    </mat-button-toggle>
  `,
  styleUrl: './request-queue.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestQueueComponent {
  readonly queues = input.required<readonly RequestQueueOption[]>();
  readonly value = input.required<RequestQueue>();
  readonly contactDue = input(false);

  readonly valueChange = output<RequestQueue>();
  readonly contactDueChange = output<boolean>();
}
