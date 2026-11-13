import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  Signal,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatIcon } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';

import { ReportService } from '../../core/report/report.service';
import {
  DEFAULT_REPORT_RANGE,
  OPEN_REQUEST_STATUSES,
  REPORT_RANGES,
  ReportKpis,
  ReportRange,
  ReportTopProcedures,
  isReportRange,
} from '../../shared/models/report.model';
import { FailureKind, failureKind } from '../../shared/utils/http-failure';
import { PolledResource, polledResource } from '../../shared/utils/polled-resource';
import { RequestDatePipe } from '../requests/request-date.pipe';
import { REQUEST_STATUS_VIEW } from '../requests/requests.constants';
import { RANGE_LABELS, RANGE_PHRASES, formatClock } from './report-format';
import { ReportKpiTilesComponent } from './report-kpi-tiles/report-kpi-tiles.component';
import { RankingItem, ReportRankingComponent } from './report-ranking/report-ranking.component';
import { ReportSkeletonComponent } from './report-skeleton/report-skeleton.component';
import { ReportTrendChartComponent } from './report-trend-chart/report-trend-chart.component';

/**
 * Vista de una fuente para el período elegido. Los datos de otro período nunca se muestran como del actual:
 * si la consulta del período nuevo falla, la fuente queda en error aunque conserve datos del anterior.
 */
type SourceView<T> =
  | { status: 'loading' }
  | { status: 'error'; kind: FailureKind; retrying: boolean }
  | { status: 'ready'; data: T; fetchedAt: Date; stale: boolean };

type Pending = 'refresh' | 'range' | null;

function sourceView<T>(resource: PolledResource<ReportRange, T>): SourceView<T> {
  const state = resource.state();
  if (state.data !== null && state.fetchedAt && state.dataKey === resource.key()) {
    return { status: 'ready', data: state.data, fetchedAt: state.fetchedAt, stale: state.failed };
  }
  if (state.failed) {
    return { status: 'error', kind: failureKind(state.error), retrying: state.loading };
  }
  return { status: 'loading' };
}

@Component({
  selector: 'app-reports',
  imports: [
    MatButton,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatIcon,
    ReportKpiTilesComponent,
    ReportRankingComponent,
    ReportSkeletonComponent,
    ReportTrendChartComponent,
    RequestDatePipe,
  ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reportService = inject(ReportService);
  private readonly announcer = inject(LiveAnnouncer);

  private readonly kpisSource = polledResource<ReportRange, ReportKpis>({
    key: DEFAULT_REPORT_RANGE,
    load: (range) => this.reportService.getKpis(range),
  });
  private readonly topSource = polledResource<ReportRange, ReportTopProcedures>({
    key: DEFAULT_REPORT_RANGE,
    load: (range) => this.reportService.getTopProcedures(range),
  });
  private readonly sources = [this.kpisSource, this.topSource];
  private readonly pending = signal<Pending>(null);
  private started = false;

  protected readonly ranges = REPORT_RANGES;
  protected readonly rangeLabels = RANGE_LABELS;
  protected readonly range = this.kpisSource.key;
  protected readonly periodPhrase = computed(() => RANGE_PHRASES[this.range()]);
  protected readonly paused = this.kpisSource.paused;
  protected readonly formatClock = formatClock;

  protected readonly kpis: Signal<SourceView<ReportKpis>> = computed(() =>
    sourceView(this.kpisSource),
  );
  protected readonly top: Signal<SourceView<ReportTopProcedures>> = computed(() =>
    sourceView(this.topSource),
  );

  /** Las dos fuentes fallaron sin datos del período: un solo aviso en vez de dos bloques de error. */
  protected readonly pageFailure = computed<FailureKind | null>(() => {
    const kpis = this.kpis();
    const top = this.top();
    if (kpis.status !== 'error' || top.status !== 'error') {
      return null;
    }
    if (kpis.kind === 'forbidden' || top.kind === 'forbidden') return 'forbidden';
    return kpis.kind === 'unavailable' && top.kind === 'unavailable' ? 'unavailable' : 'generic';
  });
  protected readonly retrying = computed(() =>
    this.sources.some((source) => source.state().loading),
  );

  /**
   * Frescura conservadora de lo que está en pantalla: el evento más antiguo y la consulta más antigua entre
   * las fuentes con datos del período, para que el éxito de una no oculte el atraso de la otra.
   */
  protected readonly freshness = computed(() => {
    const ready = [this.kpis(), this.top()].flatMap((view) =>
      view.status === 'ready' ? [view] : [],
    );
    if (ready.length === 0) {
      return null;
    }
    const events = ready
      .map((view) => view.data.lastEventAt)
      .filter((value): value is string => value !== null)
      .sort((a, b) => Date.parse(a) - Date.parse(b));
    const consulted = Math.min(...ready.map((view) => view.fetchedAt.getTime()));
    return { dataAt: events[0] ?? null, consultedAt: formatClock(new Date(consulted)) };
  });

  protected readonly retryHint = computed(() =>
    this.paused()
      ? 'Usa Actualizar para volver a intentarlo.'
      : 'Se volverá a intentar automáticamente.',
  );

  protected readonly activeItems = computed<RankingItem[]>(() => {
    const view = this.kpis();
    if (view.status !== 'ready') {
      return [];
    }
    return OPEN_REQUEST_STATUSES.map((status) => ({
      label: REQUEST_STATUS_VIEW[status].label,
      value: view.data.activeByStatus[status] ?? 0,
    }));
  });
  protected readonly hasActive = computed(() => this.activeItems().some((item) => item.value > 0));

  protected readonly topItems = computed<RankingItem[]>(() => {
    const view = this.top();
    if (view.status !== 'ready') {
      return [];
    }
    return view.data.items.map((item) => ({
      label: item.procedureLabel?.trim() || item.procedureType,
      value: item.count,
    }));
  });

  private readonly failureMessage = computed(() => {
    const failing = [
      this.kpisSource.state().failed ? 'los indicadores' : null,
      this.topSource.state().failed ? 'los tipos más demandados' : null,
    ].filter((name) => name !== null);
    return failing.length ? `No se pudieron actualizar ${failing.join(' ni ')}.` : null;
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const value = params.get('range');
      const range = isReportRange(value) ? value : DEFAULT_REPORT_RANGE;
      if (value !== null && !isReportRange(value)) {
        this.writeRange(range);
      }
      if (!this.started || range !== this.range()) {
        if (this.started) {
          this.pending.set('range');
        }
        this.started = true;
        this.sources.forEach((source) => source.setKey(range));
      }
    });

    this.announceChanges();
  }

  protected selectRange(range: ReportRange): void {
    if (range !== this.range()) {
      this.writeRange(range);
    }
  }

  protected refresh(): void {
    this.pending.set('refresh');
    this.sources.forEach((source) => source.refresh());
  }

  protected retry(): void {
    this.sources.forEach((source) => {
      if (source.state().failed) {
        source.refresh();
      }
    });
  }

  protected retryKpis(): void {
    this.kpisSource.refresh();
  }

  protected retryTop(): void {
    this.topSource.refresh();
  }

  protected togglePause(): void {
    const paused = !this.paused();
    this.sources.forEach((source) => source.setPaused(paused));
    this.announcer.announce(
      paused ? 'Actualización automática en pausa.' : 'Actualización automática reanudada.',
    );
  }

  /** replaceUrl: el período es un filtro de la vista, como los del listado (EP3-48). */
  private writeRange(range: ReportRange): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { range: range === DEFAULT_REPORT_RANGE ? null : range },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /**
   * Los números no se anuncian en cada ciclo: interrumpirían al lector de pantalla cada 5 s. Se anuncia el
   * resultado de una acción de la persona y cada cambio entre fallo y recuperación.
   */
  private announceChanges(): void {
    let lastFailure: string | null = null;
    effect(() => {
      const failure = this.failureMessage();
      const pending = this.pending();
      const settled = this.sources.every((source) => !source.state().loading);
      untracked(() => {
        if (pending) {
          if (!settled) return;
          this.pending.set(null);
          lastFailure = failure;
          const period = this.periodPhrase();
          if (pending === 'range') {
            this.announcer.announce(
              failure
                ? `No se pudieron cargar todos los reportes de ${period}.`
                : `Reportes de ${period} cargados.`,
            );
          } else {
            this.announcer.announce(failure ?? 'Reportes actualizados.');
          }
          return;
        }
        if (failure !== lastFailure) {
          if (failure) {
            this.announcer.announce(failure);
          } else if (lastFailure) {
            this.announcer.announce('Los reportes se actualizaron nuevamente.');
          }
          lastFailure = failure;
        }
      });
    });
  }
}
