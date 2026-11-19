import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { Params, RouterLink } from '@angular/router';

import { AuditEvent } from '../../../shared/models/audit.model';
import { AuditEventView, toAuditEventView } from '../../audit/audit-event-view';
import { eventMoment } from '../home-format';

interface AuditRow {
  view: AuditEventView;
  moment: string;
  reference: string | null;
  /** Historial del trámite en /audit; los eventos de configuración no tienen uno propio. */
  timeline: Params | null;
}

/**
 * Eventos de audit resumidos. En las intervenciones se muestra el motivo, que es lo que el Auditor fiscaliza
 * (EP3-07, sección 5.2); el texto completo queda en /audit.
 */
@Component({
  selector: 'app-home-audit-list',
  imports: [MatIcon, NgTemplateOutlet, RouterLink],
  template: `
    <ul class="list">
      @for (row of rows(); track row.view.event.eventId) {
        <li>
          <ng-template #content>
            <span class="event__icon event__icon--{{ row.view.tone }}" aria-hidden="true">
              <mat-icon>{{ interventions() ? 'shield_person' : row.view.icon }}</mat-icon>
            </span>
            <span class="list__main">
              <span class="event__top">
                <span class="list__label">{{ row.view.headline }}</span>
                <time class="event__time" [attr.datetime]="row.view.event.occurredAt">{{
                  row.moment
                }}</time>
              </span>
              <span class="list__sub">{{ row.view.actorName }} · {{ row.view.actorRole }}</span>
              @if (row.reference) {
                <span class="list__folio">{{ row.reference }}</span>
              }
              @if (interventions() && row.view.interventionReason) {
                <span class="event__reason">
                  <mat-icon aria-hidden="true">format_quote</mat-icon>
                  <span class="event__reason-text"
                    ><span class="cdk-visually-hidden">Motivo de la intervención: </span
                    >{{ row.view.interventionReason }}</span
                  >
                </span>
              }
            </span>
          </ng-template>
          @if (row.timeline) {
            <a class="list__row list__row--event" routerLink="/audit" [queryParams]="row.timeline">
              <ng-container [ngTemplateOutlet]="content" />
            </a>
          } @else {
            <div class="list__row list__row--event list__row--static">
              <ng-container [ngTemplateOutlet]="content" />
            </div>
          }
        </li>
      }
    </ul>
  `,
  styleUrl: '../home-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeAuditListComponent {
  readonly events = input.required<readonly AuditEvent[]>();
  readonly interventions = input(false);
  readonly now = input<Date>(new Date());

  protected readonly rows = computed<AuditRow[]>(() =>
    this.events().map((event) => {
      const view = toAuditEventView(event);
      const reference =
        view.kind === 'request'
          ? view.folio
          : [view.resource, view.ip].filter(Boolean).join(' · ') || null;
      return {
        view,
        moment: eventMoment(event.occurredAt, this.now()),
        reference,
        timeline: view.folio
          ? { view: 'timeline', folio: view.folio }
          : view.requestId
            ? { view: 'timeline', requestId: view.requestId }
            : null,
      };
    }),
  );
}
