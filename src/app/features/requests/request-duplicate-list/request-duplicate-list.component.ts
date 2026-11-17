import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { DuplicateCandidate } from '../../../shared/models/request.model';
import { formatCivilDay } from '../request-date.pipe';
import { sectorLabel } from '../request-location';
import { RequestStatusBadgeComponent } from '../request-status-badge/request-status-badge.component';

/** Con más de esta cantidad, la lista parte plegada en COLLAPSED_COUNT: plegar uno solo no ahorra espacio. */
const COLLAPSE_ABOVE = 3;
const COLLAPSED_COUNT = 2;

let nextId = 0;

/** Lista de posibles duplicados: tipo, estado, folio, cercanía y fecha, sin datos del solicitante. */
@Component({
  selector: 'app-request-duplicate-list',
  imports: [MatButton, MatIcon, RequestStatusBadgeComponent, RouterLink],
  templateUrl: './request-duplicate-list.component.html',
  styleUrl: './request-duplicate-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestDuplicateListComponent {
  readonly candidates = input.required<readonly DuplicateCandidate[]>();

  protected readonly listId = `duplicate-list-${nextId++}`;
  /** Una lista nueva vuelve a partir plegada. */
  protected readonly expanded = linkedSignal({ source: this.candidates, computation: () => false });
  protected readonly collapsible = computed(() => this.candidates().length > COLLAPSE_ABOVE);
  protected readonly hiddenCount = computed(() => this.candidates().length - COLLAPSED_COUNT);
  protected readonly visible = computed(() =>
    this.collapsible() && !this.expanded()
      ? this.candidates().slice(0, COLLAPSED_COUNT)
      : this.candidates(),
  );

  protected readonly proximity = duplicateProximity;
  protected readonly date = duplicateDate;

  protected toggle(): void {
    this.expanded.update((expanded) => !expanded);
  }
}

/** «a 40 m», «a menos de 10 m», «a 1,2 km» o, si coincidió por sector, «en el sector Ralco». */
export function duplicateProximity(candidate: DuplicateCandidate): string {
  const meters = candidate.distanceMeters;
  if (meters === null) {
    const sector = sectorLabel(candidate.sector);
    return sector ? `en el sector ${sector}` : 'en el mismo sector';
  }
  if (meters < 10) {
    return 'a menos de 10 m';
  }
  if (meters < 1000) {
    return `a ${meters} m`;
  }
  return `a ${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

/** createdDate ya es el día civil en Santiago, YYYY-MM-DD. */
export function duplicateDate(createdDate: string): string {
  const [year, month, day] = createdDate.split('-').map(Number);
  return year && month >= 1 && month <= 12 && day
    ? formatCivilDay(year, month - 1, day)
    : createdDate;
}
