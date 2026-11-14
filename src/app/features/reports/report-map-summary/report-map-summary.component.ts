import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

import { ReportMapPoints, ReportRange } from '../../../shared/models/report.model';
import { RANGE_LABELS, formatCount, formatPercent } from '../report-format';
import { ReportSkeletonComponent } from '../report-skeleton/report-skeleton.component';

type Tone = 'primary' | 'secondary' | 'accent' | 'neutral';

interface SummaryTile {
  label: string;
  icon: string;
  tone: Tone;
  value: string;
  meta: string;
}

/** Totales del mapa: cuántos trámites cumplen los filtros y cuántos se pueden ubicar. */
@Component({
  selector: 'app-report-map-summary',
  imports: [MatIcon, ReportSkeletonComponent],
  template: `
    @if (tiles(); as tiles) {
      <dl class="summary">
        @for (tile of tiles; track tile.label) {
          <div class="summary__tile summary__tile--{{ tile.tone }}">
            <span class="summary__icon" aria-hidden="true"
              ><mat-icon>{{ tile.icon }}</mat-icon></span
            >
            <div class="summary__text">
              <dt>{{ tile.label }}</dt>
              <dd class="summary__value">{{ tile.value }}</dd>
              <dd>{{ tile.meta }}</dd>
            </div>
          </div>
        }
      </dl>
    } @else {
      <div class="summary">
        @for (tile of [1, 2, 3]; track tile) {
          <div class="summary__tile"><app-report-skeleton shape="tile" /></div>
        }
      </div>
    }
  `,
  styleUrl: './report-map-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportMapSummaryComponent {
  /** null mientras carga: la región que lo contiene marca aria-busy. */
  readonly data = input.required<ReportMapPoints | null>();
  readonly range = input.required<ReportRange>();

  protected readonly tiles = computed<SummaryTile[] | null>(() => {
    const data = this.data();
    if (!data) {
      return null;
    }
    const located = data.locatedTotal;
    const without = data.withoutLocation;
    const total = located + without;
    const percent = (count: number) => `${formatPercent(count / total)} del total`;
    const shown = data.items.length;

    return [
      {
        label: 'Trámites',
        icon: 'assignment',
        tone: 'primary',
        value: formatCount(total),
        meta: RANGE_LABELS[this.range()],
      },
      {
        label: 'Con ubicación',
        icon: 'location_on',
        tone: 'secondary',
        value: formatCount(located),
        meta:
          total === 0
            ? 'Sin trámites'
            : shown < located
              ? `${percent(located)} · ${formatCount(shown)} en el mapa`
              : percent(located),
      },
      {
        label: 'Sin ubicación',
        icon: 'location_off',
        tone: without > 0 ? 'accent' : 'neutral',
        value: formatCount(without),
        meta:
          total === 0
            ? 'Sin trámites'
            : without === 0
              ? 'Todos se ven en el mapa'
              : without === 1
                ? 'No aparece en el mapa'
                : 'No aparecen en el mapa',
      },
    ];
  });
}
