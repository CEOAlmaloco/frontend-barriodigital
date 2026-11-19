import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

import { personInitials } from '../../../shared/utils/person-initials';

/** Responsable de un trámite para el staff: avatar con iniciales, o "Sin asignar". */
@Component({
  selector: 'app-request-assignee',
  imports: [MatIcon],
  template: `
    @if (assigned()) {
      <span class="assignee__avatar" [class.assignee__avatar--mine]="mine()" aria-hidden="true">
        {{ initials() }}
      </span>
      <span class="assignee__name">
        {{ displayName() }}
        @if (mine()) {
          <span class="assignee__me"
            ><span aria-hidden="true">Tú</span><span class="cdk-visually-hidden">(tú)</span></span
          >
        }
      </span>
    } @else {
      <span class="assignee__avatar assignee__avatar--empty" aria-hidden="true">
        <mat-icon>person</mat-icon>
      </span>
      <span class="assignee__name assignee__name--empty">Sin asignar</span>
    }
  `,
  styleUrl: './request-assignee.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestAssigneeComponent {
  readonly assigned = input.required<boolean>();
  readonly name = input<string | null | undefined>(null);
  readonly mine = input(false);

  protected readonly displayName = computed(() => this.name()?.trim() || 'Funcionario asignado');
  protected readonly initials = computed(() => personInitials(this.name()) || '?');
}
