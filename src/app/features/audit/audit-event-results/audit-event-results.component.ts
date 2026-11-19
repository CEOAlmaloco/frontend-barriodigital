import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';

import {
  ActorFilter,
  AuditEventDetailComponent,
} from '../audit-event-detail/audit-event-detail.component';
import { AuditEventTagsComponent } from '../audit-event-tags/audit-event-tags.component';
import { AuditEventView } from '../audit-event-view';

/** Resultados de la búsqueda: tabla desde md y lista en móvil, con el detalle desplegable de cada evento. */
@Component({
  selector: 'app-audit-event-results',
  imports: [
    AuditEventDetailComponent,
    AuditEventTagsComponent,
    MatIcon,
    MatIconButton,
    MatTableModule,
    NgTemplateOutlet,
    RouterLink,
  ],
  templateUrl: './audit-event-results.component.html',
  styleUrl: './audit-event-results.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditEventResultsComponent {
  readonly views = input.required<AuditEventView[]>();
  readonly wide = input(true);
  readonly expanded = input<string | null>(null);
  readonly filteredActorId = input('');
  readonly toggle = output<AuditEventView>();
  readonly filterActor = output<ActorFilter>();

  protected readonly columns = ['when', 'event', 'actor', 'ip', 'expand'];

  protected trackEvent = (_: number, view: AuditEventView) => view.event.eventId;

  /** La fila completa abre el detalle, salvo cuando el clic fue en un enlace o un botón propio. */
  protected rowClick(event: MouseEvent, view: AuditEventView): void {
    if (!(event.target as HTMLElement).closest('a, button')) {
      this.toggle.emit(view);
    }
  }
}
