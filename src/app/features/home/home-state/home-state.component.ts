import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

export type HomeStateTone = 'neutral' | 'success' | 'error';

/** Estado vacío o de error dentro de un bloque de /inicio. La acción, si hay, va como contenido. */
@Component({
  selector: 'app-home-state',
  imports: [MatIcon],
  template: `
    <span class="state__icon state__icon--{{ tone() }}" aria-hidden="true">
      <mat-icon>{{ icon() }}</mat-icon>
    </span>
    <div class="state__body">
      <p class="state__title">{{ heading() }}</p>
      @if (message()) {
        <p class="state__text">{{ message() }}</p>
      }
      <ng-content />
    </div>
  `,
  styleUrl: './home-state.component.scss',
  host: { '[attr.role]': "tone() === 'error' ? 'alert' : null" },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeStateComponent {
  readonly icon = input.required<string>();
  readonly heading = input.required<string>();
  readonly message = input('');
  readonly tone = input<HomeStateTone>('neutral');
}
