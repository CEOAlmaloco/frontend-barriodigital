import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { RequestStatus } from '../../../shared/models/request.model';
import { REQUEST_STATUS_VIEW } from '../requests.constants';

@Component({
  selector: 'app-request-status-badge',
  template: `<span class="badge badge--{{ view().tone }}">{{ view().label }}</span>`,
  styleUrl: './request-status-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestStatusBadgeComponent {
  readonly status = input.required<RequestStatus>();

  protected readonly view = computed(
    () => REQUEST_STATUS_VIEW[this.status()] ?? { label: this.status(), tone: 'neutral' },
  );
}
