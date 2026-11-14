import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatOptgroup, MatOption } from '@angular/material/core';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatSelect, MatSelectTrigger } from '@angular/material/select';

import { MapPointsQuery } from '../../../shared/models/report.model';
import { RequestStatus } from '../../../shared/models/request.model';
import {
  CLOSED_STATUSES,
  OPEN_STATUSES,
  REQUEST_STATUS_VIEW,
} from '../../requests/requests.constants';
import { activeFilterCount, sortStatuses } from '../report-map/report-map-query';

export interface MapTypeOption {
  value: string;
  label: string;
}

export type CatalogStatus = 'loading' | 'ready' | 'failed';

const STATUS_GROUPS = [
  { label: 'Abiertos', statuses: OPEN_STATUSES },
  { label: 'Cerrados', statuses: CLOSED_STATUSES },
];

function sameStatuses(a: readonly RequestStatus[], b: readonly RequestStatus[]): boolean {
  return a.length === b.length && a.every((status) => b.includes(status));
}

/**
 * Estado y tipo del mapa. Los tipos vienen del catálogo; si no carga, el selector se deshabilita pero conserva
 * el tipo activo con su nombre conocido, que se puede quitar con «Limpiar filtros».
 */
@Component({
  selector: 'app-report-map-filters',
  imports: [
    MatButton,
    MatFormField,
    MatHint,
    MatIcon,
    MatLabel,
    MatOptgroup,
    MatOption,
    MatSelect,
    MatSelectTrigger,
  ],
  templateUrl: './report-map-filters.component.html',
  styleUrl: './report-map-filters.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportMapFiltersComponent {
  readonly query = input.required<MapPointsQuery>();
  readonly types = input.required<readonly MapTypeOption[]>();
  readonly catalogStatus = input.required<CatalogStatus>();

  readonly statusChange = output<RequestStatus[]>();
  readonly typeChange = output<string | null>();
  readonly clear = output<void>();
  readonly retryCatalog = output<void>();

  protected readonly statusGroups = STATUS_GROUPS;
  protected readonly statusView = REQUEST_STATUS_VIEW;
  protected readonly active = computed(() => activeFilterCount(this.query()) > 0);

  protected readonly statusSummary = computed(() => {
    const selected = this.query().status;
    if (sameStatuses(selected, OPEN_STATUSES)) return 'Abiertos';
    if (sameStatuses(selected, CLOSED_STATUSES)) return 'Cerrados';
    if (selected.length === 1) return REQUEST_STATUS_VIEW[selected[0]].label;
    return `${selected.length} estados`;
  });

  protected selectStatuses(statuses: RequestStatus[]): void {
    this.statusChange.emit(sortStatuses(statuses));
  }
}
