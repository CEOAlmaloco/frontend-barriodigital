import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

import { AuditEvent } from '../../../shared/models/audit.model';

/** El evento tal como lo guardó audit, para revisar lo que la vista no interpreta. */
@Component({
  selector: 'app-audit-raw-data',
  imports: [MatIcon],
  template: `
    <details class="raw">
      <summary class="raw__summary">
        <mat-icon aria-hidden="true">data_object</mat-icon>
        Datos originales
        <mat-icon class="raw__chevron" aria-hidden="true">expand_more</mat-icon>
      </summary>
      <pre class="raw__json" tabindex="0" aria-label="Datos originales del evento">{{
        json()
      }}</pre>
    </details>
  `,
  styleUrl: './audit-raw-data.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditRawDataComponent {
  readonly event = input.required<AuditEvent>();

  protected readonly json = computed(() => JSON.stringify(this.event(), null, 2));
}
