import { LiveAnnouncer } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { forkJoin, map } from 'rxjs';

import { ReportService } from '../../../core/report/report.service';
import { ReportRange } from '../../../shared/models/report.model';
import { polledResource } from '../../../shared/utils/polled-resource';
import { formatClock, formatCount } from '../../reports/report-format';
import { ReportTrendChartComponent } from '../../reports/report-trend-chart/report-trend-chart.component';
import { RequestDatePipe } from '../../requests/request-date.pipe';
import { blockView } from '../home-block-view';
import { HomeStateComponent } from '../home-state/home-state.component';
import {
  HomeOpsSnapshot,
  openTotal,
  toOpsTiles,
  toPerfMetrics,
  toStatusRows,
} from './home-ops-tiles';

/** Ventana operativa de /inicio: coincidente con el default de report. */
const RANGE: ReportRange = 'last24h';

/**
 * Resumen operativo del Admin (K8): polling cada 5 s, pausa con pestaña oculta y al salir de /inicio.
 * No reutiliza los tiles de /reports: aquí la foto es de gestión, no de análisis del período.
 */
@Component({
  selector: 'app-home-kpis',
  imports: [
    HomeStateComponent,
    MatButton,
    MatIcon,
    NgTemplateOutlet,
    ReportTrendChartComponent,
    RequestDatePipe,
    RouterLink,
  ],
  templateUrl: './home-kpis.component.html',
  styleUrls: ['./home-kpis.component.scss', '../home-link.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeKpisComponent {
  private readonly reportService = inject(ReportService);
  private readonly announcer = inject(LiveAnnouncer);

  protected readonly range = RANGE;
  protected readonly formatClock = formatClock;
  protected readonly formatCount = formatCount;
  protected readonly source = polledResource<ReportRange, HomeOpsSnapshot>({
    key: RANGE,
    load: (range) =>
      forkJoin({
        kpis: this.reportService.getKpis(range),
        overdue: this.reportService.getSlaAlerts({ status: ['VENCIDO'], page: 0, size: 1 }),
      }).pipe(map((snapshot) => snapshot)),
  });
  protected readonly view = computed(() => blockView(this.source.state(), this.source.key()));
  protected readonly ready = computed(() => {
    const view = this.view();
    return view.status === 'ready' ? view : null;
  });
  protected readonly failure = computed(() => {
    const view = this.view();
    return view.status === 'error' ? view : null;
  });
  protected readonly paused = this.source.paused;
  protected readonly tiles = computed(() => {
    const ready = this.ready();
    return ready ? toOpsTiles(ready.data) : [];
  });
  protected readonly statusRows = computed(() => {
    const ready = this.ready();
    return ready ? toStatusRows(ready.data.kpis) : [];
  });
  protected readonly openTotal = computed(() => {
    const ready = this.ready();
    return ready ? openTotal(ready.data.kpis) : 0;
  });
  protected readonly statusMax = computed(() =>
    Math.max(1, ...this.statusRows().map((row) => row.count)),
  );
  protected readonly perfMetrics = computed(() => {
    const ready = this.ready();
    return ready ? toPerfMetrics(ready.data.kpis) : [];
  });
  protected readonly incomingTotal = computed(() => {
    const ready = this.ready();
    if (!ready) {
      return 0;
    }
    return ready.data.kpis.requestsOverTime.points.reduce((sum, point) => sum + point.count, 0);
  });
  protected readonly retryHint = computed(() =>
    this.paused()
      ? 'Usa Reintentar para volver a consultar.'
      : 'Se volverá a intentar automáticamente.',
  );

  constructor() {
    this.source.setKey(RANGE);
    this.announceFailures();
  }

  protected togglePause(): void {
    const paused = !this.paused();
    this.source.setPaused(paused);
    this.announcer.announce(
      paused ? 'Actualización automática en pausa.' : 'Actualización automática reanudada.',
    );
  }

  protected retry(): void {
    this.source.refresh();
  }

  /** Los números no se anuncian en cada ciclo: se anuncia el paso entre fallo y recuperación. */
  private announceFailures(): void {
    let failed = false;
    effect(() => {
      const state = this.source.state();
      untracked(() => {
        if (state.loading || state.failed === failed) {
          return;
        }
        failed = state.failed;
        this.announcer.announce(
          failed
            ? 'No se pudieron actualizar los indicadores.'
            : 'Los indicadores se actualizaron nuevamente.',
        );
      });
    });
  }
}
