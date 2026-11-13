import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatProgressBar } from '@angular/material/progress-bar';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { Subject, catchError, map, of, switchMap, tap } from 'rxjs';

import { AuditService } from '../../../core/audit/audit.service';
import { AuditEvent } from '../../../shared/models/audit.model';
import { Page } from '../../../shared/models/page.model';
import { FailureKind, failureKind } from '../../../shared/utils/http-failure';
import { RequestStatusBadgeComponent } from '../../requests/request-status-badge/request-status-badge.component';
import { AuditEventTagsComponent } from '../audit-event-tags/audit-event-tags.component';
import { AuditEventView, toAuditEventView } from '../audit-event-view';
import {
  AUDIT_PAGE_SIZES,
  AuditTimelineQuery,
  DEFAULT_TIMELINE_QUERY,
  FOLIO_PATTERN,
  normalizeFolio,
  paramsKey,
  parseTimelineParams,
  readView,
  toTimelineApiParams,
  toTimelineUrlParams,
} from '../audit-query';
import { AuditInterventionComponent } from '../audit-intervention/audit-intervention.component';
import { AuditRawDataComponent } from '../audit-raw-data/audit-raw-data.component';
import { AuditRefreshComponent } from '../audit-refresh/audit-refresh.component';
import { AuditStateComponent } from '../audit-state/audit-state.component';
import { chileDateTime } from '../audit-time';

type TimelineState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; kind: FailureKind };

type LoadResult = { page: Page<AuditEvent> } | { error: unknown };

const TIMELINE_FAILURES: Readonly<
  Record<FailureKind, { icon: string; heading: string; message: string; retry: boolean }>
> = {
  unavailable: {
    icon: 'cloud_off',
    heading: 'La auditoría no está disponible',
    message: 'El servicio de auditoría no responde.',
    retry: true,
  },
  forbidden: {
    icon: 'lock',
    heading: 'No tienes acceso a la auditoría',
    message: 'Tu rol no permite consultar esta información.',
    retry: false,
  },
  generic: {
    icon: 'cloud_off',
    heading: 'No pudimos cargar el historial',
    message: 'Revisa tu conexión e inténtalo de nuevo.',
    retry: true,
  },
};

function folioValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = normalizeFolio(control.value ?? '');
  if (!value) return { required: true };
  return FOLIO_PATTERN.test(value) ? null : { format: true };
}

/**
 * Historial completo de un trámite (EP3-07, sección 5.3), por folio o, desde el detalle de un trámite sin
 * folio, por su id. Sin filtro de fechas: muestra todo lo que audit tiene registrado.
 */
@Component({
  selector: 'app-audit-timeline',
  imports: [
    AuditEventTagsComponent,
    AuditInterventionComponent,
    AuditRawDataComponent,
    AuditRefreshComponent,
    AuditStateComponent,
    MatButton,
    MatFormFieldModule,
    MatIconButton,
    MatIcon,
    MatInputModule,
    MatPaginator,
    MatProgressBar,
    ReactiveFormsModule,
    RequestStatusBadgeComponent,
    RouterLink,
  ],
  templateUrl: './audit-timeline.component.html',
  styleUrl: './audit-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditTimelineComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auditService = inject(AuditService);
  private readonly injector = inject(Injector);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  protected readonly pageSizes = AUDIT_PAGE_SIZES;
  protected readonly folio = new FormControl('', {
    nonNullable: true,
    validators: folioValidator,
  });

  protected readonly query = signal<AuditTimelineQuery>(DEFAULT_TIMELINE_QUERY);
  protected readonly state = signal<TimelineState>({ status: 'idle' });
  protected readonly page = signal<Page<AuditEvent> | null>(null);
  protected readonly consultedAt = signal<string | null>(null);

  protected readonly views = computed<AuditEventView[]>(() =>
    (this.page()?.content ?? []).map(toAuditEventView),
  );
  protected readonly failure = computed(() => {
    const state = this.state();
    return state.status === 'error' ? state.kind : null;
  });
  protected readonly failureText = computed(() => {
    const kind = this.failure();
    return kind ? TIMELINE_FAILURES[kind] : null;
  });
  protected readonly loading = computed(() => this.state().status === 'loading');

  protected readonly subject = computed(() => this.query().folio || null);
  protected readonly requestId = computed(
    () => this.query().requestId || this.views().find((view) => view.requestId)?.requestId || null,
  );
  protected readonly procedure = computed(() => {
    const created = this.views().find((view) => view.event.eventType === 'request.created');
    return created?.fields.find((field) => field.label === 'Tipo')?.value ?? null;
  });

  /** Solo en la última página se sabe cuál es el último cambio de estado registrado. */
  protected readonly lastStatus = computed(() => {
    const page = this.page();
    if (!page || page.page < page.totalPages - 1) return null;
    return (
      this.views()
        .map((view) => view.transition?.to ?? null)
        .filter((status) => status !== null)
        .at(-1) ?? null
    );
  });

  protected readonly countText = computed(() => {
    const total = this.page()?.totalElements ?? 0;
    return `${new Intl.NumberFormat('es-CL').format(total)} ${total === 1 ? 'evento' : 'eventos'}`;
  });

  protected readonly announcement = computed(() => {
    const state = this.state();
    if (state.status === 'error') return 'No se pudo cargar el historial.';
    if (state.status !== 'ready') return '';
    return this.page()?.totalElements
      ? `${this.countText()} en el historial.`
      : 'Sin eventos registrados para este trámite.';
  });

  private readonly load$ = new Subject<void>();
  private started = false;
  private refreshing = false;

  constructor() {
    this.load$
      .pipe(
        tap(() => this.state.set({ status: 'loading' })),
        // switchMap: si se consulta otro folio antes de que responda el anterior, la respuesta vieja se descarta
        switchMap(() =>
          this.auditService.getTimeline(toTimelineApiParams(this.query())).pipe(
            map((page): LoadResult => ({ page })),
            catchError((error: unknown) => of<LoadResult>({ error })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => this.applyResult(result));

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => this.readUrl(params));
  }

  /** Una consulta nueva es una navegación: Atrás vuelve al folio anterior. */
  protected submit(event: Event): void {
    event.preventDefault();
    this.folio.markAsTouched();
    if (this.folio.invalid) {
      return;
    }
    const folio = normalizeFolio(this.folio.value);
    this.folio.setValue(folio);
    if (folio === this.query().folio && this.state().status !== 'error') {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toTimelineUrlParams({ ...DEFAULT_TIMELINE_QUERY, folio }),
    });
  }

  protected retry(): void {
    this.load$.next();
  }

  protected refresh(): void {
    this.refreshing = true;
    this.load$.next();
  }

  protected changePage(event: PageEvent): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toTimelineUrlParams({
        ...this.query(),
        page: event.pageIndex,
        size: event.pageSize,
      }),
      replaceUrl: true,
    });
    afterNextRender(() => this.heading()?.nativeElement.focus(), { injector: this.injector });
  }

  private readUrl(params: ParamMap): void {
    if (readView((key) => params.get(key)) !== 'timeline') {
      return;
    }
    const query = parseTimelineParams((key) => params.get(key));
    const canonical = toTimelineUrlParams(query);
    const current = Object.fromEntries(params.keys.map((key) => [key, params.get(key) ?? '']));
    if (paramsKey(current) !== paramsKey(canonical)) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: canonical,
        replaceUrl: true,
      });
      return;
    }
    if (this.started && paramsKey(canonical) === paramsKey(toTimelineUrlParams(this.query()))) {
      return;
    }
    this.started = true;
    const previous = this.query();
    this.query.set(query);
    if (query.folio) {
      this.folio.setValue(query.folio);
    }
    if (!query.folio && !query.requestId) {
      this.page.set(null);
      this.state.set({ status: 'idle' });
      return;
    }
    // Cambiar de página conserva la anterior a la vista mientras carga; otro trámite no
    if (query.folio !== previous.folio || query.requestId !== previous.requestId) {
      this.page.set(null);
    }
    this.load$.next();
  }

  private applyResult(result: LoadResult): void {
    const refreshed = this.refreshing;
    this.refreshing = false;
    if ('error' in result) {
      this.page.set(null);
      this.state.set({ status: 'error', kind: failureKind(result.error) });
      return;
    }
    const { page } = result;
    const query = this.query();
    if (page.content.length === 0 && page.totalElements > 0 && query.page > 0) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: toTimelineUrlParams({ ...query, page: Math.max(page.totalPages - 1, 0) }),
        replaceUrl: true,
      });
      return;
    }
    this.page.set(page);
    this.consultedAt.set(chileDateTime(new Date().toISOString())?.time ?? null);
    this.state.set({ status: 'ready' });
    if (refreshed) {
      this.announcer.announce('Historial actualizado.');
    }
  }
}
