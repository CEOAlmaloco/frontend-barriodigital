import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

import { Request, RequestStatus } from '../../../shared/models/request.model';
import { Role } from '../../../shared/models/role';
import { personInitials } from '../../../shared/utils/person-initials';
import { RequestStatusBadgeComponent } from '../request-status-badge/request-status-badge.component';
import { formatElapsed } from '../duration';
import { actionLabel, isClosedStatus } from '../requests.constants';

export interface AttentionAction {
  status: RequestStatus;
  trigger: HTMLButtonElement;
}

@Component({
  selector: 'app-request-attention-panel',
  imports: [MatButton, MatIcon, MatProgressSpinner, RequestStatusBadgeComponent],
  templateUrl: './request-attention-panel.component.html',
  styleUrl: './request-attention-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestAttentionPanelComponent {
  readonly request = input.required<Request>();
  readonly viewer = input.required<Role>();
  readonly isResponsible = input(false);
  readonly allowedStatuses = input<readonly RequestStatus[]>([]);
  readonly transitionsState = input<'loading' | 'ready' | 'error'>('ready');
  readonly taking = input(false);

  readonly take = output<void>();
  readonly assign = output<HTMLButtonElement>();
  readonly changeStatus = output<AttentionAction>();
  readonly registerGestion = output<HTMLButtonElement>();
  readonly retryTransitions = output<void>();

  protected readonly actionLabel = actionLabel;
  protected readonly isVecino = computed(() => this.viewer() === Role.Vecino);
  protected readonly isAuditor = computed(() => this.viewer() === Role.Auditor);
  protected readonly isAdmin = computed(() => this.viewer() === Role.Admin);
  protected readonly isClosed = computed(() => isClosedStatus(this.request().status));
  protected readonly hasAssignee = computed(() => this.request().hasAssignee === true);
  protected readonly assigneeName = computed(
    () => this.request().assigneeName?.trim() || 'Funcionario asignado',
  );
  protected readonly initials = computed(() => personInitials(this.assigneeName()));
  protected readonly canTake = computed(
    () => this.viewer() === Role.Funcionario && !this.isClosed() && !this.hasAssignee(),
  );
  protected readonly readsOnly = computed(
    () =>
      this.viewer() === Role.Funcionario &&
      !this.isClosed() &&
      this.hasAssignee() &&
      !this.isResponsible(),
  );
  /** El Admin deriva un trámite sin responsable; el Funcionario lo toma (EP3-05, sección 3). */
  protected readonly canAssign = computed(
    () => this.isAdmin() && !this.isClosed() && !this.hasAssignee(),
  );
  protected readonly canReassign = computed(
    () =>
      !this.isClosed() &&
      this.hasAssignee() &&
      (this.isAdmin() || (this.viewer() === Role.Funcionario && this.isResponsible())),
  );
  protected readonly canOperate = computed(
    () =>
      !this.isClosed() &&
      (this.isAdmin() || (this.viewer() === Role.Funcionario && this.isResponsible())),
  );
  protected readonly nextStatus = computed(() =>
    this.allowedStatuses().find(
      (status) => status !== 'RECHAZADO' && status !== 'INGRESADO' && status !== 'CANCELADO',
    ),
  );
  protected readonly canReject = computed(() => this.allowedStatuses().includes('RECHAZADO'));
  protected readonly elapsed = computed(() => formatElapsed(this.request().createdAt));
  protected readonly deadline = computed(() => {
    const days = this.request().slaBusinessDays;
    if (days == null || days <= 0) {
      return null;
    }
    return days === 1 ? '1 día hábil' : `${days} días hábiles`;
  });

  protected emitStatus(status: RequestStatus, event: Event): void {
    this.changeStatus.emit({ status, trigger: event.currentTarget as HTMLButtonElement });
  }

  protected emitAssign(event: Event): void {
    this.assign.emit(event.currentTarget as HTMLButtonElement);
  }

  protected emitGestion(event: Event): void {
    this.registerGestion.emit(event.currentTarget as HTMLButtonElement);
  }
}
