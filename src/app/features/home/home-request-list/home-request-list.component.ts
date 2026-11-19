import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { CatalogService } from '../../../core/catalog/catalog.service';
import { Request } from '../../../shared/models/request.model';
import { formatElapsed } from '../../requests/duration';
import { procedureTypeLabel } from '../../requests/procedure-label';
import { RequestDatePipe } from '../../requests/request-date.pipe';
import { RequestStatusBadgeComponent } from '../../requests/request-status-badge/request-status-badge.component';

interface RequestRow {
  request: Request;
  label: string;
}

/**
 * Trámites resumidos que enlazan al detalle. Para el Vecino, la fecha de ingreso y "En atención"
 * (EP3-04, sección 6.1); para el staff, la antigüedad, que es el orden de la bandeja.
 */
@Component({
  selector: 'app-home-request-list',
  imports: [MatIcon, RequestDatePipe, RequestStatusBadgeComponent, RouterLink],
  template: `
    <ul class="list">
      @for (row of rows(); track row.request.id) {
        <li>
          <a class="list__row" [routerLink]="['/tramites', row.request.id]">
            <span class="list__main">
              <span class="list__folio">{{ row.request.folio || 'Sin folio' }}</span>
              <span class="list__label">{{ row.label }}</span>
              <span class="list__sub">
                @if (citizen()) {
                  Ingresado el {{ row.request.createdAt | requestDate: 'short' }}
                } @else {
                  Ingresado {{ elapsed(row.request.createdAt) }}
                }
              </span>
            </span>
            <span class="list__end">
              <app-request-status-badge [status]="row.request.status" />
              @if (citizen() && row.request.hasAssignee) {
                <span class="list__attention">
                  <mat-icon aria-hidden="true">support_agent</mat-icon>En atención
                </span>
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
export class HomeRequestListComponent {
  private readonly catalogLabels = inject(CatalogService).labels;

  readonly requests = input.required<readonly Request[]>();
  readonly citizen = input(false);
  /** Instante de referencia para la antigüedad; se fija por carga para que no cambie entre filas. */
  readonly now = input<Date>(new Date());

  protected readonly rows = computed<RequestRow[]>(() =>
    this.requests().map((request) => ({
      request,
      label: procedureTypeLabel(
        request.procedureType,
        request.procedureLabel,
        this.catalogLabels(),
      ),
    })),
  );

  protected elapsed(createdAt: string): string {
    return formatElapsed(createdAt, this.now());
  }
}
