import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

import { AuditEventView } from '../audit-event-view';

/** Etiquetas de un evento: si es de un trámite o de configuración, y si fue una intervención del Admin. */
@Component({
  selector: 'app-audit-event-tags',
  imports: [MatIcon],
  template: `
    @if (kind()) {
      <span class="tag" [class.tag--accent]="view().kind === 'config'">
        {{ view().kind === 'config' ? 'Configuración' : 'Trámite' }}
      </span>
    }
    @if (view().interventionReason) {
      <span class="tag tag--accent">
        <mat-icon aria-hidden="true">shield</mat-icon>
        Intervención
      </span>
    }
  `,
  styleUrl: './audit-event-tags.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditEventTagsComponent {
  readonly view = input.required<AuditEventView>();
  /** En el timeline todos los eventos son del mismo trámite: solo se marca la intervención. */
  readonly kind = input(true);
}
