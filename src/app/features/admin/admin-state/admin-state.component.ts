import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/** Tarjeta centrada de error o de vacío de una sección de Administración. La acción va como contenido. */
@Component({
  selector: 'app-admin-state',
  imports: [MatIcon],
  template: `
    <span class="state__icon" aria-hidden="true">
      <mat-icon>{{ icon() }}</mat-icon>
    </span>
    <h3>{{ heading() }}</h3>
    @if (message()) {
      <p>{{ message() }}</p>
    }
    <ng-content />
  `,
  styleUrl: './admin-state.component.scss',
  host: {
    '[class.state--error]': "tone() === 'error'",
    '[attr.role]': "tone() === 'error' ? 'alert' : null",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminStateComponent {
  readonly icon = input.required<string>();
  readonly heading = input.required<string>();
  readonly message = input('');
  readonly tone = input<'error' | 'neutral'>('neutral');
}
