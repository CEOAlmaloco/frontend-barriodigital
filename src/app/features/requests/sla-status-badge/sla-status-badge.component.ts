import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';

import { SlaStatus } from '../../../shared/models/report.model';
import { SLA_STATUS_VIEW } from '../requests.constants';

/**
 * Estado del plazo para el staff. `null` es una proyección parcial o un trámite que report no conoce
 * (EP3-07, sección 4): se distingue de "Sin plazo".
 */
@Component({
  selector: 'app-sla-status-badge',
  imports: [MatIcon, MatTooltip],
  template: `
    @if (view(); as view) {
      <span class="sla sla--{{ view.tone }}">
        @if (view.icon) {
          <mat-icon aria-hidden="true">{{ view.icon }}</mat-icon>
        }
        {{ view.label }}
      </span>
    } @else {
      <span
        class="sla sla--unknown"
        role="img"
        aria-label="Sin información de plazo"
        matTooltip="Sin información de plazo"
        >—</span
      >
    }
  `,
  styleUrl: './sla-status-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlaStatusBadgeComponent {
  readonly status = input.required<SlaStatus | null>();

  protected readonly view = computed(() => {
    const status = this.status();
    return status ? (SLA_STATUS_VIEW[status] ?? null) : null;
  });
}
