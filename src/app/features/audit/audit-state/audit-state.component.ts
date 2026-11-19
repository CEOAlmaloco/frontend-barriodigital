import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/** Estado vacío o de error de una vista de auditoría. La acción, si hay, va como contenido. */
@Component({
  selector: 'app-audit-state',
  imports: [MatIcon],
  template: `
    <span class="state__icon" [class.state__icon--error]="error()" aria-hidden="true">
      <mat-icon>{{ icon() }}</mat-icon>
    </span>
    <p class="state__title" role="heading" [attr.aria-level]="level()">{{ heading() }}</p>
    <p class="state__text">{{ message() }}</p>
    <ng-content />
  `,
  styleUrl: './audit-state.component.scss',
  host: { '[attr.role]': "error() ? 'alert' : null" },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditStateComponent {
  readonly icon = input.required<string>();
  readonly heading = input.required<string>();
  readonly message = input.required<string>();
  readonly error = input(false);
  readonly level = input(3);
}
