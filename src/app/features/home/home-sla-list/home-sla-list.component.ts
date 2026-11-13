import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SlaAlert } from '../../../shared/models/report.model';
import { RequestAssigneeComponent } from '../../requests/request-assignee/request-assignee.component';
import { SlaStatusBadgeComponent } from '../../requests/sla-status-badge/sla-status-badge.component';
import { dueDateLabel } from '../home-format';

interface SlaRow {
  alert: SlaAlert;
  label: string;
  due: string;
  late: boolean;
}

/** Vencidos y por vencer de report, con el vencimiento en palabras y enlace al detalle del trámite. */
@Component({
  selector: 'app-home-sla-list',
  imports: [RequestAssigneeComponent, RouterLink, SlaStatusBadgeComponent],
  template: `
    <ul class="list">
      @for (row of rows(); track row.alert.requestId) {
        <li>
          <a class="list__row" [routerLink]="['/tramites', row.alert.requestId]">
            <span class="list__main">
              <span class="list__folio">{{ row.alert.folio || 'Sin folio' }}</span>
              <span class="list__label">{{ row.label }}</span>
              @if (showAssignee()) {
                <app-request-assignee
                  class="list__assignee"
                  [assigned]="!!row.alert.assigneeId"
                  [name]="row.alert.assigneeName"
                />
              }
            </span>
            <span class="list__end">
              <app-sla-status-badge [status]="row.alert.slaStatus" />
              @if (row.due) {
                <span class="list__due" [class.list__due--late]="row.late">{{ row.due }}</span>
              }
            </span>
          </a>
        </li>
      }
    </ul>
  `,
  styleUrl: '../home-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeSlaListComponent {
  readonly alerts = input.required<readonly SlaAlert[]>();
  /** El Admin ve el responsable; el Funcionario solo ve los suyos. */
  readonly showAssignee = input(false);
  readonly now = input<Date>(new Date());

  protected readonly rows = computed<SlaRow[]>(() =>
    this.alerts().map((alert) => ({
      alert,
      label: alert.procedureLabel?.trim() || alert.procedureType,
      due: dueDateLabel(alert.dueDate, this.now()),
      late: alert.slaStatus === 'VENCIDO',
    })),
  );
}
