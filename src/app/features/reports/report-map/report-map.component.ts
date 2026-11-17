import { LiveAnnouncer } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import { Subscription } from 'rxjs';

import { CatalogService } from '../../../core/catalog/catalog.service';
import { ReportService } from '../../../core/report/report.service';
import { ProcedureType } from '../../../shared/models/procedure-type.model';
import { MapPointsQuery, ReportMapPoints, ReportRange } from '../../../shared/models/report.model';
import { RequestStatus } from '../../../shared/models/request.model';
import { FailureKind, failureKind } from '../../../shared/utils/http-failure';
import { polledResource } from '../../../shared/utils/polled-resource';
import { RANGE_PHRASES, formatClock, formatCount, plural } from '../report-format';
import {
  CatalogStatus,
  MapTypeOption,
  ReportMapFiltersComponent,
} from '../report-map-filters/report-map-filters.component';
import { ReportMapLegendComponent } from '../report-map-legend/report-map-legend.component';
import { ReportMapListComponent } from '../report-map-list/report-map-list.component';
import { ReportMapSummaryComponent } from '../report-map-summary/report-map-summary.component';
import { RankingItem, ReportRankingComponent } from '../report-ranking/report-ranking.component';
import { ReportSkeletonComponent } from '../report-skeleton/report-skeleton.component';
import {
  ReportFreshness,
  ReportToolbarComponent,
} from '../report-toolbar/report-toolbar.component';
import { RequestsMapComponent } from '../requests-map/requests-map.component';
import { MapPointView, sectorName, toPointView } from './map-point-view';
import {
  EMPTY_MAP_QUERY,
  activeFilterCount,
  mapQueryKey,
  mapQueryParams,
  readMapQuery,
} from './report-map-query';

/**
 * Cada 30 s y no cada 5 s como los indicadores: la respuesta trae hasta 1000 puntos y la vista se usa para
 * explorar, así que un redibujo frecuente no aporta y distrae.
 */
export const MAP_POLL_INTERVAL_MS = 30_000;

export type MapView = 'map' | 'list';

/** Los datos de otro filtro nunca se muestran como del actual: mientras llega la respuesta solo se atenúan. */
type MapState =
  | { status: 'loading'; previous: ReportMapPoints | null }
  | { status: 'error'; kind: FailureKind; retrying: boolean }
  | { status: 'ready'; data: ReportMapPoints; fetchedAt: Date; stale: boolean };

type Pending = 'refresh' | 'filter' | null;

/** Mapa de trámites de reportería (EP3-62): puntos, totales y concentración por sector de report. */
@Component({
  selector: 'app-report-map',
  imports: [
    MatButton,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatIcon,
    NgTemplateOutlet,
    ReportMapFiltersComponent,
    ReportMapLegendComponent,
    ReportMapListComponent,
    ReportMapSummaryComponent,
    ReportRankingComponent,
    ReportSkeletonComponent,
    ReportToolbarComponent,
    RequestsMapComponent,
  ],
  templateUrl: './report-map.component.html',
  styleUrl: './report-map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportMapComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reportService = inject(ReportService);
  private readonly catalogService = inject(CatalogService);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly destroyRef = inject(DestroyRef);

  private readonly source = polledResource<MapPointsQuery, ReportMapPoints>({
    key: EMPTY_MAP_QUERY,
    load: (query) => this.reportService.getMapPoints(query),
    interval: MAP_POLL_INTERVAL_MS,
  });
  private readonly pending = signal<Pending>(null);
  private readonly catalogTypes = signal<readonly ProcedureType[]>([]);
  private catalogRequest: Subscription | null = null;
  private started = false;

  protected readonly intervalSeconds = MAP_POLL_INTERVAL_MS / 1000;
  protected readonly query = this.source.key;
  protected readonly paused = this.source.paused;
  protected readonly view = signal<MapView>('map');
  protected readonly catalogStatus = signal<CatalogStatus>('loading');
  protected readonly fitKey = computed(() => mapQueryKey(this.query()));
  protected readonly filtered = computed(() => activeFilterCount(this.query()) > 0);
  protected readonly periodPhrase = computed(() => RANGE_PHRASES[this.query().range]);
  protected readonly formatClock = formatClock;
  protected readonly formatCount = formatCount;

  protected readonly state = computed<MapState>(() => {
    const state = this.source.state();
    if (state.data !== null && state.fetchedAt && state.dataKey === this.query()) {
      return { status: 'ready', data: state.data, fetchedAt: state.fetchedAt, stale: state.failed };
    }
    if (state.failed) {
      return { status: 'error', kind: failureKind(state.error), retrying: state.loading };
    }
    return { status: 'loading', previous: state.data };
  });

  protected readonly data = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.data : null;
  });
  protected readonly busy = computed(() => this.state().status === 'loading');

  private readonly catalogLabels = computed(
    () => new Map(this.catalogTypes().map((type) => [type.value, type.label])),
  );

  protected readonly points = computed<MapPointView[]>(() => {
    const state = this.state();
    const data =
      state.status === 'ready' ? state.data : state.status === 'loading' ? state.previous : null;
    const labels = this.catalogLabels();
    return (data?.items ?? []).map((point) => toPointView(point, labels.get(point.procedureType)));
  });

  /** El tipo activo siempre está entre las opciones, aunque el catálogo no cargue o ya no lo tenga. */
  protected readonly typeOptions = computed<MapTypeOption[]>(() => {
    const options = [...this.catalogTypes()]
      .map((type) => ({ value: type.value, label: type.label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
    const active = this.query().procedureType;
    if (active && !options.some((option) => option.value === active)) {
      const known = this.data()?.items.find((point) => point.procedureType === active);
      options.unshift({ value: active, label: known?.procedureLabel?.trim() || active });
    }
    return options;
  });

  protected readonly freshness = computed<ReportFreshness | null>(() => {
    const state = this.state();
    return state.status === 'ready'
      ? { dataAt: state.data.lastEventAt, consultedAt: formatClock(state.fetchedAt) }
      : null;
  });

  /** El mapa recibe como máximo MAP_POINTS_MAX puntos; los totales y sectores consideran todos. */
  protected readonly clipped = computed(() => {
    const data = this.data();
    return data !== null && data.locatedTotal > data.items.length;
  });

  protected readonly emptyReason = computed<'none' | 'unlocated' | null>(() => {
    const data = this.data();
    if (!data || data.items.length > 0) {
      return null;
    }
    return data.withoutLocation > 0 ? 'unlocated' : 'none';
  });

  protected readonly sectors = computed<RankingItem[]>(() =>
    (this.data()?.bySector ?? []).map((item) => ({
      label: sectorName(item.sector),
      value: item.count,
    })),
  );

  protected readonly retryHint = computed(() =>
    this.paused()
      ? 'Usa Actualizar para volver a intentarlo.'
      : 'Se volverá a intentar automáticamente.',
  );

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const get = (key: string) => params.get(key);
      const query = readMapQuery(get);
      this.view.set(get('view') === 'list' ? 'list' : 'map');
      const canonical = mapQueryParams(query);
      if (
        Object.entries(canonical).some(([key, value]) => (get(key) ?? null) !== (value ?? null))
      ) {
        this.writeQuery(query);
      }
      if (!this.started || mapQueryKey(query) !== mapQueryKey(this.query())) {
        if (this.started) {
          this.pending.set('filter');
        }
        this.started = true;
        this.source.setKey(query);
      }
    });

    this.loadCatalog();
    this.announceChanges();
  }

  protected selectRange(range: ReportRange): void {
    this.writeQuery({ ...this.query(), range });
  }

  protected selectStatuses(status: RequestStatus[]): void {
    this.writeQuery({ ...this.query(), status });
  }

  protected selectType(procedureType: string | null): void {
    this.writeQuery({ ...this.query(), procedureType });
  }

  protected clearFilters(): void {
    this.writeQuery({ ...this.query(), status: [], procedureType: null });
  }

  protected selectView(view: MapView): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: view === 'list' ? 'list' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected refresh(): void {
    this.pending.set('refresh');
    this.source.refresh();
    if (this.catalogStatus() === 'failed') {
      this.loadCatalog();
    }
  }

  protected retry(): void {
    this.source.refresh();
  }

  protected togglePause(): void {
    const paused = !this.paused();
    this.source.setPaused(paused);
    this.announcer.announce(
      paused ? 'Actualización automática en pausa.' : 'Actualización automática reanudada.',
    );
  }

  protected loadCatalog(): void {
    if (this.catalogRequest) {
      return;
    }
    this.catalogStatus.set('loading');
    this.catalogRequest = this.catalogService
      .getProcedures()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (types) => {
          this.catalogTypes.set(types);
          this.catalogStatus.set('ready');
        },
        error: () => {
          this.catalogStatus.set('failed');
          this.catalogRequest = null;
        },
        complete: () => (this.catalogRequest = null),
      });
  }

  /** replaceUrl: los filtros son parte de la vista, como en el listado (EP3-48). */
  private writeQuery(query: MapPointsQuery): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: mapQueryParams(query),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /**
   * Se anuncia el resultado de una acción de la persona y cada cambio entre fallo y recuperación, no cada ciclo
   * del polling.
   */
  private announceChanges(): void {
    let lastFailed = false;
    effect(() => {
      const state = this.source.state();
      const pending = this.pending();
      untracked(() => {
        if (pending) {
          if (state.loading) return;
          this.pending.set(null);
          lastFailed = state.failed;
          const data = this.data();
          this.announcer.announce(
            state.failed || !data
              ? 'No se pudo actualizar el mapa.'
              : `Mapa actualizado: ${plural(data.locatedTotal, 'trámite', 'trámites')} con ubicación.`,
          );
          return;
        }
        if (state.failed !== lastFailed) {
          this.announcer.announce(
            state.failed ? 'No se pudo actualizar el mapa.' : 'El mapa se actualizó nuevamente.',
          );
          lastFailed = state.failed;
        }
      });
    });
  }
}
