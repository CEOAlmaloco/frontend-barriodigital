import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatIcon } from '@angular/material/icon';

import { RequestQueue } from '../request-list-query';

export interface RequestQueueOption {
  value: RequestQueue;
  label: string;
  icon: string;
}

/** Bandeja del staff: filtros rápidos por responsable (EP3-05, sección 8). */
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
  `,
  styleUrl: './request-queue.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestQueueComponent {
  readonly queues = input.required<readonly RequestQueueOption[]>();
  readonly value = input.required<RequestQueue>();

  readonly valueChange = output<RequestQueue>();
}
