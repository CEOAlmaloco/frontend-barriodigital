import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';

import { RequestStatus } from '../../../shared/models/request.model';
import { REQUEST_ACTION_LABELS } from '../requests.constants';

export interface RequestStatusAction {
  status: RequestStatus;
  trigger: HTMLButtonElement;
}

@Component({
  selector: 'app-request-actions',
  imports: [MatButton, MatIcon, MatMenu, MatMenuItem, MatMenuTrigger],
  templateUrl: './request-actions.component.html',
  styleUrl: './request-actions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestActionsComponent {
  private readonly menuButton = viewChild.required<MatButton, ElementRef<HTMLButtonElement>>(
    'menuButton',
    {
      read: ElementRef,
    },
  );

  readonly requestId = input.required<string>();
  readonly status = input.required<RequestStatus>();
  readonly allowedStatuses = input.required<readonly RequestStatus[]>();
  readonly changeStatus = output<RequestStatusAction>();

  protected readonly actionLabels = REQUEST_ACTION_LABELS;
  protected readonly isTerminal = computed(
    () => this.status() === 'RESUELTO' || this.status() === 'RECHAZADO',
  );
  protected readonly canReject = computed(() => this.allowedStatuses().includes('RECHAZADO'));
  protected readonly primaryAction = computed(() =>
    this.allowedStatuses().find((status) => status !== 'RECHAZADO' && status !== 'INGRESADO'),
  );

  protected selectAction(status: RequestStatus, event: Event, menu?: MatMenuTrigger): void {
    const trigger = menu
      ? this.menuButton().nativeElement
      : (event.currentTarget as HTMLButtonElement);
    if (menu) {
      // El diálogo toma el foco antes de que termine de cerrarse el menú.
      menu.restoreFocus = false;
    }
    this.changeStatus.emit({ status, trigger });
  }
}
