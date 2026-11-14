import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

import { SlaStatus } from '../../../shared/models/report.model';
import { SlaStatusBadgeComponent } from '../sla-status-badge/sla-status-badge.component';
import { slaDue } from '../sla-format';

/** De dónde viene el dato: la consulta a report puede estar en curso o haber fallado sin que falle el trámite. */
export type SlaIndicatorState = 'loading' | 'unavailable' | 'ready';

/**
 * Estado del plazo de un trámite para el staff: el estado de report y, debajo o al lado, la fecha (EP3-07,
 * sección 4). Las tres situaciones del contrato se distinguen: "Sin plazo", "—" sin información y "No disponible".
 */
@Component({
  selector: 'app-sla-indicator',
  imports: [MatIcon, SlaStatusBadgeComponent],
  template: `
    @switch (state()) {
      @case ('loading') {
        <span class="sla-indicator__bone" aria-hidden="true"></span>
        <span class="cdk-visually-hidden">Cargando el estado del plazo</span>
      }
      @case ('unavailable') {
        <span class="sla-indicator__down">
          <mat-icon aria-hidden="true">cloud_off</mat-icon>{{ unavailableLabel() }}
        </span>
      }
      @default {
        <app-sla-status-badge [status]="status()" />
        @if (due(); as due) {
          <span class="sla-indicator__due sla-indicator__due--{{ due.tone }}">{{ due.text }}</span>
        }
      }
    }
  `,
  styleUrl: './sla-indicator.component.scss',
  host: { '[class.sla-indicator--row]': "layout() === 'row'" },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlaIndicatorComponent {
  readonly state = input<SlaIndicatorState>('ready');
  readonly status = input<SlaStatus | null>(null);
  readonly dueDate = input<string | null>(null);
  /** `stack` en la celda del listado; `row` reparte estado y fecha a los extremos en el detalle. */
  readonly layout = input<'stack' | 'row'>('stack');
  readonly unavailableLabel = input('No disponible');
  /** Fijo por carga, para que todas las filas se lean contra el mismo día. */
  readonly now = input<Date>(new Date());

  protected readonly due = computed(() => slaDue(this.status(), this.dueDate(), this.now()));
}
