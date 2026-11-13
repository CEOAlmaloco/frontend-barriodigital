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
import { MatDivider } from '@angular/material/divider';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

import { RequestStatus } from '../../../shared/models/request.model';
import { actionLabel, isClosedStatus } from '../requests.constants';

export interface RequestStatusAction {
  status: RequestStatus;
  trigger: HTMLButtonElement;
}

/**
 * Qué puede hacer quien mira la fila (EP3-04, regla de operación, y EP3-05):
 * - `take`: Funcionario ante un trámite sin responsable.
 * - `operate`: Funcionario responsable; cambia el estado y puede reasignar.
 * - `readonly`: Funcionario que no es el responsable.
 * - `assign` y `reassign`: Admin, que deriva trámites; los cambios de estado los hace en el detalle.
 */
export type RequestRowMode = 'take' | 'operate' | 'readonly' | 'assign' | 'reassign';

@Component({
  selector: 'app-request-actions',
  imports: [MatButton, MatDivider, MatIcon, MatMenu, MatMenuItem, MatMenuTrigger, MatProgressSpinner],
  templateUrl: './request-actions.component.html',
  styleUrl: './request-actions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestActionsComponent {
  private readonly menuButton = viewChild<MatButton, ElementRef<HTMLButtonElement>>('menuButton', {
    read: ElementRef,
  });

  /** Nombre del trámite en las etiquetas accesibles: su folio, o su id si es anterior al folio. */
  readonly requestId = input.required<string>();
  readonly status = input.required<RequestStatus>();
  readonly allowedStatuses = input.required<readonly RequestStatus[]>();
  readonly mode = input<RequestRowMode>('operate');
  readonly busy = input(false);

  readonly changeStatus = output<RequestStatusAction>();
  readonly take = output<HTMLButtonElement>();
  readonly assign = output<HTMLButtonElement>();

  protected readonly actionLabel = actionLabel;
  protected readonly isTerminal = computed(() => isClosedStatus(this.status()));
  protected readonly canReject = computed(() => this.allowedStatuses().includes('RECHAZADO'));
  protected readonly primaryAction = computed(() =>
    this.allowedStatuses().find(
      (status) => status !== 'RECHAZADO' && status !== 'INGRESADO' && status !== 'CANCELADO',
    ),
  );

  protected selectAction(status: RequestStatus, event: Event, menu?: MatMenuTrigger): void {
    const trigger = this.triggerFor(event, menu);
    this.changeStatus.emit({ status, trigger });
  }

  protected reassignFromMenu(event: Event, menu: MatMenuTrigger): void {
    this.assign.emit(this.triggerFor(event, menu));
  }

  protected emit(target: 'take' | 'assign', event: Event): void {
    const trigger = event.currentTarget as HTMLButtonElement;
    if (target === 'take') {
      this.take.emit(trigger);
    } else {
      this.assign.emit(trigger);
    }
  }

  private triggerFor(event: Event, menu?: MatMenuTrigger): HTMLButtonElement {
    if (!menu) {
      return event.currentTarget as HTMLButtonElement;
    }
    // El diálogo toma el foco antes de que termine de cerrarse el menú
    menu.restoreFocus = false;
    return this.menuButton()?.nativeElement ?? (event.currentTarget as HTMLButtonElement);
  }
}
