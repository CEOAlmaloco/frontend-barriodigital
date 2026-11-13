import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import {
  OPEN_REQUEST_STATUSES,
  ReportKpis,
  ReportRange,
} from '../../../shared/models/report.model';
import { formatDuration } from '../../requests/duration';
import { RANGE_LABELS, RANGE_PHRASES, formatCount, formatPercent, plural } from '../report-format';
import { ReportSkeletonComponent } from '../report-skeleton/report-skeleton.component';

interface Tile {
  label: string;
  value: string | null;
  empty: string;
  meta: string;
}

/** Indicadores resumidos de report. Sin `kpis` muestra la silueta; la región que lo contiene marca aria-busy. */
@Component({
  selector: 'app-report-kpi-tiles',
  imports: [ReportSkeletonComponent],
  template: `
    @if (kpis()) {
      <dl class="kpi-tiles">
        @for (tile of tiles(); track tile.label) {
          <div class="kpi-tile">
            <dt>{{ tile.label }}</dt>
            @if (tile.value !== null) {
              <dd class="kpi-tile__value">{{ tile.value }}</dd>
            } @else {
              <dd class="kpi-tile__value kpi-tile__value--empty">{{ tile.empty }}</dd>
            }
            <dd>{{ tile.meta }}</dd>
          </div>
        }
      </dl>
    } @else {
      <div class="kpi-tiles">
        @for (tile of [1, 2, 3, 4]; track tile) {
          <div class="kpi-tile"><app-report-skeleton shape="tile" /></div>
        }
      </div>
    }
  `,
  styleUrl: './report-kpi-tiles.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportKpiTilesComponent {
  readonly kpis = input.required<ReportKpis | null>();
  readonly range = input.required<ReportRange>();

  protected readonly tiles = computed<Tile[]>(() => {
    const data = this.kpis();
    if (!data) {
      return [];
    }
    const range = this.range();
    const period = RANGE_PHRASES[range];
    const open = OPEN_REQUEST_STATUSES.reduce(
      (sum, status) => sum + (data.activeByStatus[status] ?? 0),
      0,
    );
    const created = data.requestsOverTime.points.reduce((sum, point) => sum + point.count, 0);
    const { rate, onTime, late } = data.slaCompliance;
    const hours = data.averageResolutionHours;
    return [
      { label: 'Trámites abiertos', value: formatCount(open), empty: '', meta: 'Ahora' },
      { label: 'Ingresados', value: formatCount(created), empty: '', meta: RANGE_LABELS[range] },
      {
        label: 'Tiempo medio de resolución',
        value: hours === null ? null : formatDuration(hours * 3600),
        empty: 'Sin resueltos',
        meta:
          hours === null
            ? `Ninguno en ${period}`
            : plural(data.resolvedCount, 'trámite resuelto', 'trámites resueltos'),
      },
      {
        // El denominador es el de report: cierres del período con plazo evaluable (onTime + late).
        label: 'Cumplimiento de plazo',
        value: rate === null ? null : formatPercent(rate),
        empty: 'Sin cierres evaluables',
        meta:
          rate === null
            ? `Ningún cierre con plazo en ${period}`
            : `${formatCount(onTime)} de ${plural(onTime + late, 'cierre', 'cierres')} dentro de plazo`,
      },
    ];
  });
}
