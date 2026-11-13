import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { RequestStatusBadgeComponent } from '../../requests/request-status-badge/request-status-badge.component';
import { AuditChangeTableComponent } from '../audit-change-table/audit-change-table.component';
import { AuditEventView } from '../audit-event-view';
import { AuditInterventionComponent } from '../audit-intervention/audit-intervention.component';
import { AuditRawDataComponent } from '../audit-raw-data/audit-raw-data.component';

export interface ActorFilter {
  id: string;
  name: string;
}

/** Contenido de un evento desplegado en la búsqueda. Solo navega: no modifica nada. */
@Component({
  selector: 'app-audit-event-detail',
  imports: [
    AuditChangeTableComponent,
    AuditInterventionComponent,
    AuditRawDataComponent,
    MatButton,
    MatIcon,
    RequestStatusBadgeComponent,
    RouterLink,
  ],
  templateUrl: './audit-event-detail.component.html',
  styleUrl: './audit-event-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditEventDetailComponent {
  readonly view = input.required<AuditEventView>();
  readonly actorFiltered = input(false);
  readonly filterActor = output<ActorFilter>();

  protected readonly timelineParams = computed(() => {
    const { folio, requestId } = this.view();
    if (folio) return { view: 'timeline', folio };
    return requestId ? { view: 'timeline', requestId } : null;
  });

  protected selectActor(): void {
    const { actorId, actorName } = this.view();
    if (actorId) {
      this.filterActor.emit({ id: actorId, name: actorName });
    }
  }
}
