import { LiveAnnouncer } from '@angular/cdk/a11y';
import { BreakpointObserver } from '@angular/cdk/layout';
import { HttpErrorResponse } from '@angular/common/http';
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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Subject, catchError, map, of, switchMap, tap } from 'rxjs';

import { AuditService } from '../../../core/audit/audit.service';
import {
  AUDIT_EVENT_TYPES,
  AUDIT_RESOURCE_TYPES,
  AuditEvent,
  AuditResourceType,
} from '../../../shared/models/audit.model';
import { Page } from '../../../shared/models/page.model';
import { ROLE_LABELS, Role } from '../../../shared/models/role';
import { failureKind } from '../../../shared/utils/http-failure';
import { toDateKey } from '../../requests/date-key';
import { ActorFilter } from '../audit-event-detail/audit-event-detail.component';
import { AuditEventResultsComponent } from '../audit-event-results/audit-event-results.component';
import {
  AuditEventView,
  EVENT_TYPE_LABELS,
  RESOURCE_LABELS,
  toAuditEventView,
} from '../audit-event-view';
import { AuditRefreshComponent } from '../audit-refresh/audit-refresh.component';
import { AuditStateComponent } from '../audit-state/audit-state.component';
import {
  ACTOR_ROLES,
  AUDIT_PAGE_SIZES,
  AuditEventsQuery,
  DEFAULT_EVENTS_QUERY,
  RECENT_DAYS,
  activeEventsFilterCount,
  eventTypesFor,
  paramsKey,
  parseEventsParams,
  readView,
  toEventsApiParams,
  toEventsUrlParams,
} from '../audit-query';
import { chileDateKey, chileDateTime } from '../audit-time';

export type EventsFailure = 'unavailable' | 'forbidden' | 'invalid' | 'generic';

type ResultState =
  { status: 'loading' } | { status: 'ready' } | { status: 'error'; kind: EventsFailure };

type LoadResult = { page: Page<AuditEvent> } | { error: unknown };

const DESKTOP_QUERY = '(min-width: 768px)';

const EVENTS_FAILURES: Readonly<
  Record<EventsFailure, { icon: string; heading: string; message: string }>
> = {
  unavailable: {
    icon: 'cloud_off',
    heading: 'La auditoría no está disponible',
    message: 'El servicio de auditoría no responde. Tus filtros se mantienen.',
  },
  forbidden: {
    icon: 'lock',
    heading: 'No tienes acceso a la auditoría',
    message: 'Tu rol no permite consultar esta información.',
  },
  invalid: {
    icon: 'filter_alt_off',
    heading: 'No se pudo aplicar la búsqueda',
    message: 'Algún filtro no es válido. Límpialos e inténtalo de nuevo.',
  },
  generic: {
    icon: 'cloud_off',
    heading: 'No pudimos cargar los eventos',
    message: 'Revisa tu conexión e inténtalo de nuevo.',
  },
};

/**
 * Búsqueda de eventos de audit (EP3-07, sección 5.4). La URL es la fuente del estado: los filtros navegan y la
 * consulta se arma al leer la URL, así recargar o compartir el enlace muestra lo mismo.
 */
@Component({
  selector: 'app-audit-events',
  imports: [
    AuditEventResultsComponent,
    AuditRefreshComponent,
    AuditStateComponent,
    MatButton,
    MatChipsModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIcon,
    MatInputModule,
    MatPaginator,
    MatProgressBar,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  providers: [provideNativeDateAdapter(), { provide: MAT_DATE_LOCALE, useValue: 'es-CL' }],
  templateUrl: './audit-events.component.html',
  styleUrl: './audit-events.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditEventsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auditService = inject(AuditService);
  private readonly injector = inject(Injector);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly resultsTitle = viewChild<ElementRef<HTMLElement>>('resultsTitle');

  protected readonly wide = toSignal(
    inject(BreakpointObserver)
      .observe(DESKTOP_QUERY)
      .pipe(map((state) => state.matches)),
    { initialValue: true },
  );

  protected readonly pageSizes = AUDIT_PAGE_SIZES;
  protected readonly actorRoles = ACTOR_ROLES;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly resourceTypes = AUDIT_RESOURCE_TYPES;
  protected readonly resourceLabels = RESOURCE_LABELS;
  protected readonly recentDays = RECENT_DAYS;
  protected readonly today = chileToday();

  protected readonly query = signal<AuditEventsQuery>(DEFAULT_EVENTS_QUERY);
  protected readonly state = signal<ResultState>({ status: 'loading' });
  protected readonly page = signal<Page<AuditEvent> | null>(null);
  protected readonly expanded = signal<string | null>(null);
  protected readonly filtersOpen = signal(false);
  protected readonly consultedAt = signal<string | null>(null);
  private readonly selectedActorName = signal<{ id: string; name: string } | null>(null);

  protected readonly failure = computed(() => {
    const state = this.state();
    return state.status === 'error' ? state.kind : null;
  });
  protected readonly failureText = computed(() => {
    const kind = this.failure();
    return kind ? EVENTS_FAILURES[kind] : null;
  });
  protected readonly views = computed<AuditEventView[]>(() =>
    (this.page()?.content ?? []).map(toAuditEventView),
  );
  protected readonly activeCount = computed(() => activeEventsFilterCount(this.query()));

  protected readonly typeGroups = computed(() => {
    const selected = this.query().resourceType;
    return (selected ? [selected] : AUDIT_RESOURCE_TYPES).map((resource) => ({
      label: RESOURCE_LABELS[resource],
      types: AUDIT_EVENT_TYPES[resource].map((value) => ({
        value,
        label: EVENT_TYPE_LABELS[value],
      })),
    }));
  });

  protected readonly typeTrigger = computed(() => {
    const types = this.query().eventTypes;
    return types.length === 1 ? EVENT_TYPE_LABELS[types[0]] : `${types.length} tipos`;
  });

  /** El nombre sale de los resultados; si no hay, del evento donde se eligió al actor. */
  protected readonly actorName = computed(() => {
    const id = this.query().actorId;
    if (!id) return null;
    const fromResults = this.views().find((view) => view.actorId === id)?.actorName;
    const selected = this.selectedActorName();
    return fromResults ?? (selected?.id === id ? selected.name : 'Actor seleccionado');
  });

  protected readonly periodText = computed(() => {
    const { period, from, to } = this.query();
    if (period === 'recent') return `en los últimos ${RECENT_DAYS} días`;
    if (period === 'all') return '';
    if (from && to) return `del ${displayDate(from)} al ${displayDate(to)}`;
    return from ? `desde el ${displayDate(from)}` : `hasta el ${displayDate(to)}`;
  });

  protected readonly countText = computed(() => {
    const total = this.page()?.totalElements ?? 0;
    return `${new Intl.NumberFormat('es-CL').format(total)} ${total === 1 ? 'evento' : 'eventos'}`;
  });

  protected readonly announcement = computed(() => {
    const state = this.state();
    if (state.status === 'loading') return '';
    if (state.status === 'error') return 'No se pudieron cargar los eventos.';
    const total = this.page()?.totalElements ?? 0;
    if (total === 0) return 'Sin eventos para estos filtros.';
    return `${this.countText()} ${total === 1 ? 'encontrado' : 'encontrados'}.`;
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    actorRole: '' as Role | '',
    resourceType: '' as AuditResourceType | '',
    eventTypes: [[] as string[]],
    from: null as Date | null,
    to: null as Date | null,
  });

  private readonly load$ = new Subject<void>();
  private started = false;
  private refreshing = false;

  constructor() {
    this.load$
      .pipe(
        tap(() => this.state.set({ status: 'loading' })),
        // switchMap cancela la consulta anterior: una respuesta lenta no reemplaza a la de filtros nuevos
        switchMap(() =>
          this.auditService.searchEvents(toEventsApiParams(this.query(), new Date())).pipe(
            map((page): LoadResult => ({ page })),
            catchError((error: unknown) => of<LoadResult>({ error })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => this.applyResult(result));

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => this.readUrl(params));
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.applyForm());
  }

  protected retry(): void {
    this.load$.next();
  }

  protected refresh(): void {
    this.refreshing = true;
    this.load$.next();
  }

  protected toggle(view: AuditEventView): void {
    this.expanded.update((id) => (id === view.event.eventId ? null : view.event.eventId));
  }

  protected changePage(event: PageEvent): void {
    this.navigate({ ...this.query(), page: event.pageIndex, size: event.pageSize });
    this.focusResults();
  }

  protected filterActor(actor: ActorFilter): void {
    this.selectedActorName.set(actor);
    this.navigate({ ...this.query(), actorId: actor.id, page: 0 });
    this.focusResults();
  }

  protected removeActor(): void {
    this.navigate({ ...this.query(), actorId: '', page: 0 });
  }

  protected removePeriod(): void {
    this.navigate({ ...this.query(), period: 'all', from: '', to: '', page: 0 });
  }

  protected clearFilters(): void {
    this.navigate({ ...DEFAULT_EVENTS_QUERY, period: 'all', size: this.query().size });
    this.focusResults();
  }

  private readUrl(params: ParamMap): void {
    // Al cambiar de pestaña esta vista recibe la URL de la otra antes de destruirse: no es suya
    if (readView((key) => params.get(key)) !== 'events') {
      return;
    }
    const query = parseEventsParams((key) => params.get(key));
    const canonical = toEventsUrlParams(query);
    const current = Object.fromEntries(
      params.keys.filter((key) => key !== 'view').map((key) => [key, params.get(key) ?? '']),
    );
    if (paramsKey(current) !== paramsKey(canonical)) {
      // Un valor inválido de la URL se reemplaza por el que realmente se consulta
      this.navigate(query);
      return;
    }
    if (this.started && paramsKey(canonical) === paramsKey(toEventsUrlParams(this.query()))) {
      return;
    }
    this.started = true;
    this.query.set(query);
    this.patchForm(query);
    this.load$.next();
  }

  private applyResult(result: LoadResult): void {
    const refreshed = this.refreshing;
    this.refreshing = false;
    if ('error' in result) {
      this.page.set(null);
      this.state.set({ status: 'error', kind: eventsFailure(result.error) });
      return;
    }
    const { page } = result;
    const query = this.query();
    // Un enlace viejo puede apuntar a una página que ya no existe con estos filtros
    if (page.content.length === 0 && page.totalElements > 0 && query.page > 0) {
      this.navigate({ ...query, page: Math.max(page.totalPages - 1, 0) });
      return;
    }
    this.page.set(page);
    if (!page.content.some((event) => event.eventId === this.expanded())) {
      this.expanded.set(null);
    }
    this.consultedAt.set(chileDateTime(new Date().toISOString())?.time ?? null);
    this.state.set({ status: 'ready' });
    if (refreshed) {
      this.announcer.announce('Eventos actualizados.');
    }
  }

  private applyForm(): void {
    const { actorRole, resourceType, eventTypes, from, to } = this.form.getRawValue();
    const controls = this.form.controls;

    const allowed = eventTypesFor(resourceType);
    const types = eventTypes.filter((type) => allowed.includes(type));
    if (types.length !== eventTypes.length) {
      controls.eventTypes.setValue(types, { emitEvent: false });
    }

    const fromKey = from ? toDateKey(from) : '';
    const toKey = to ? toDateKey(to) : '';
    const inverted = Boolean(fromKey && toKey && toKey < fromKey);
    if (inverted) {
      controls.to.setErrors({ range: true });
      controls.to.markAsTouched();
    } else if (controls.to.hasError('range')) {
      controls.to.setErrors(null);
    }
    // Un rango invertido o una fecha escrita a mano que no se pudo leer no llegan a audit
    if (
      inverted ||
      controls.from.hasError('matDatepickerParse') ||
      controls.to.hasError('matDatepickerParse')
    ) {
      return;
    }

    const current = this.query();
    const period =
      fromKey || toKey ? 'custom' : current.period === 'custom' ? 'all' : current.period;
    this.navigate({
      ...current,
      actorRole,
      resourceType,
      eventTypes: types,
      period,
      from: fromKey,
      to: toKey,
      page: 0,
    });
  }

  private patchForm(query: AuditEventsQuery): void {
    this.form.setValue(
      {
        actorRole: query.actorRole,
        resourceType: query.resourceType,
        eventTypes: [...query.eventTypes],
        from: query.period === 'custom' && query.from ? fromDateKey(query.from) : null,
        to: query.period === 'custom' && query.to ? fromDateKey(query.to) : null,
      },
      { emitEvent: false },
    );
  }

  /** replaceUrl: los filtros son estado de la vista, como en /tramites. */
  private navigate(query: AuditEventsQuery): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toEventsUrlParams(query),
      replaceUrl: true,
    });
  }

  private focusResults(): void {
    afterNextRender(() => this.resultsTitle()?.nativeElement.focus({ preventScroll: false }), {
      injector: this.injector,
    });
  }
}

function eventsFailure(error: unknown): EventsFailure {
  if (error instanceof HttpErrorResponse && error.status === 400) {
    return 'invalid';
  }
  return failureKind(error);
}

function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function displayDate(key: string): string {
  const [year, month, day] = key.split('-');
  return `${day}/${month}/${year}`;
}

/** Hoy en Chile, para el máximo de los selectores de fecha. */
function chileToday(): Date {
  return fromDateKey(chileDateKey(new Date()));
}
