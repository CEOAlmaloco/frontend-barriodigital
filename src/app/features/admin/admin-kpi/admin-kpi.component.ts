import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

export type AdminKpiTone = 'primary' | 'secondary' | 'success' | 'accent' | 'error';

/**
 * Indicador de una sección de Administración, con el mismo orden y criterio de color que los del mapa de
 * trámites: el tono se aplica solo con valor mayor que 0; en 0 o sin dato queda neutro.
 * Va sobre un div dentro de un dl para que la lista de definiciones siga siendo válida.
 */
@Component({
  selector: 'div[app-admin-kpi]',
  imports: [MatIcon],
  template: `
    <dt class="kpi__label">
      <span class="kpi__icon" aria-hidden="true"
        ><mat-icon>{{ icon() }}</mat-icon></span
      >
      {{ label() }}
    </dt>
    @if (value() === null) {
      <dd class="kpi__placeholder">{{ placeholder() }}</dd>
    } @else {
      <dd class="kpi__value">{{ value() }}</dd>
    }
  `,
  styleUrl: './admin-kpi.component.scss',
  host: { '[attr.data-tone]': 'activeTone()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminKpiComponent {
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  /** null cuando el dato todavía no llega o la fuente no lo entrega. */
  readonly value = input.required<number | null>();
  readonly tone = input<AdminKpiTone>('secondary');
  readonly placeholder = input('No disponible');

  protected readonly activeTone = computed(() => ((this.value() ?? 0) > 0 ? this.tone() : null));
}
