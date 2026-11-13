import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  TemplateRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  FormGroupDirective,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDivider } from '@angular/material/divider';
import {
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort, MatSortHeader, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, finalize, map, of, switchMap, tap } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { CatalogService } from '../../core/catalog/catalog.service';
import { ProcedureType } from '../../shared/models/procedure-type.model';
import {
  CreateRequestPayload,
  Request,
  RequestStatus,
  RequestTransitions,
} from '../../shared/models/request.model';
import { Role, resolveViewerRole } from '../../shared/models/role';
import { assignmentFailure } from './assignment-errors';
import { MUNICIPALITY_SINCE, toDateKey } from './date-key';
import {
  RequestFiltersForm,
  RequestListFiltersComponent,
} from './request-list-filters/request-list-filters.component';
import {
  DEFAULT_REQUEST_QUERY,
  REQUEST_PAGE_SIZES,
  RequestListQuery,
  RequestQueue,
  RequestSortDirection,
  RequestSortField,
  SEARCH_DEBOUNCE_MS,
  activeFilterCount,
  parseDateKey,
  parseRequestListParams,
  serializeRequestListQuery,
  toRequestListParams,
} from './request-list-query';
import {
  RequestActionsComponent,
  RequestRowMode,
  RequestStatusAction,
} from './request-actions/request-actions.component';
import {
  RequestAssignDialogComponent,
  RequestAssignDialogData,
  RequestAssignDialogResult,
} from './request-assign-dialog/request-assign-dialog.component';
import { RequestAssigneeComponent } from './request-assignee/request-assignee.component';
import { RequestDescriptionComponent } from './request-description/request-description.component';
import {
  RequestQueueComponent,
  RequestQueueOption,
} from './request-queue/request-queue.component';
import {
  RequestActivityDialogComponent,
  RequestActivityDialogData,
} from './request-activity-dialog/request-activity-dialog.component';
import {
  RequestRejectionReasonDialogComponent,
  RequestRejectionReasonDialogData,
} from './request-rejection-reason-dialog/request-rejection-reason-dialog.component';
import {
  RequestStatusDialogComponent,
  RequestStatusDialogData,
  RequestStatusDialogResult,
} from './request-status-dialog/request-status-dialog.component';
import { RequestStatusBadgeComponent } from './request-status-badge/request-status-badge.component';
import { isClosedStatus } from './requests.constants';
import { RequestsService } from './requests.service';
import { RequestLocationMapComponent } from './request-location-map.component';
import {
  COMMUNE_SECTORS,
  LocationMode,
  isInsideCommune,
  locationPointValidator,
  mapUrl,
  roundCoordinate,
} from './request-location';

type LoadState = 'loading' | 'ready' | 'error';
type LoadQuery = 'catalog' | 'requests' | 'transitions';
type AttachmentPreview = { requestId: string; url: string; imageType: string; extension: string };

const COLUMNS = ['tipo', 'descripcion', 'estado', 'fecha'];
const STAFF_COLUMNS = ['tipo', 'descripcion', 'solicitante', 'responsable', 'estado', 'fecha'];
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 12_000_000;
const MAX_IMAGE_DIMENSION = 6000;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Component({
  selector: 'app-requests',
  imports: [
    DatePipe,
    NgTemplateOutlet,
    MatButton,
    MatDivider,
    MatIconButton,
    MatIcon,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatPaginator,
    MatSort,
    MatSortHeader,
    MatDatepickerModule,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinner,
    MatSelectModule,
    MatCheckbox,
    MatTableModule,
    ReactiveFormsModule,
    RequestActionsComponent,
    RequestAssigneeComponent,
    RequestDescriptionComponent,
    RequestListFiltersComponent,
    RequestQueueComponent,
    RequestLocationMapComponent,
    RequestStatusBadgeComponent,
    RouterLink,
  ],
  providers: [provideNativeDateAdapter(), { provide: MAT_DATE_LOCALE, useValue: 'es-CL' }],
  templateUrl: './requests.component.html',
  styleUrl: './requests.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestsComponent {
  private readonly auth = inject(AuthService);
  private readonly requestsService = inject(RequestsService);
  private readonly catalogService = inject(CatalogService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly listTitle = viewChild.required<ElementRef<HTMLElement>>('listTitle');
  private readonly descriptionDialogTemplate =
    viewChild.required<TemplateRef<{ $implicit: string }>>('descriptionDialog');
  private readonly attachmentPreviewTemplate =
    viewChild.required<TemplateRef<{ $implicit: AttachmentPreview }>>('attachmentPreview');
  /** El ítem del menú se destruye al cerrarse. El foco vuelve a los tres puntos. */
  private detailsAnchor: HTMLButtonElement | null = null;
  private readonly reload$ = new Subject<void>();
  private readonly transitionsReload$ = new Subject<void>();
  private readonly catalogReload$ = new Subject<void>();
  private statusDialog: MatDialogRef<
    RequestStatusDialogComponent,
    RequestStatusDialogResult
  > | null = null;
  private rejectionReasonDialog: MatDialogRef<RequestRejectionReasonDialogComponent, void> | null =
    null;
  private activityDialog: MatDialogRef<RequestActivityDialogComponent, void> | null = null;
  private descriptionDialog: MatDialogRef<unknown, void> | null = null;
  private attachmentPreviewDialog: MatDialogRef<unknown, void> | null = null;
  private assignDialog: MatDialogRef<RequestAssignDialogComponent, RequestAssignDialogResult> | null =
    null;
  private reloadAfterStatusChange = false;
  private readonly recoveryPending = signal<LoadQuery[]>([]);

  protected readonly catalog = signal<ProcedureType[]>([]);
  protected readonly catalogState = signal<LoadState>('loading');
  protected readonly selectionChanged = signal(false);
  protected readonly tiposTramite = computed(() =>
    this.catalog().filter((type) => type.active === true),
  );
  private readonly typeLabels = computed(
    () => new Map(this.catalog().map((type) => [type.value, type.label])),
  );
  protected readonly catalogAvailable = computed(
    () => this.catalogState() === 'ready' && this.tiposTramite().length > 0,
  );

  /** El roleGuard decide quién entra; aquí el rol define columnas, bandeja y acciones. */
  protected readonly viewer = computed(() => resolveViewerRole((role) => this.auth.hasRole(role)));
  protected readonly isFuncionario = computed(() => this.viewer() === Role.Funcionario);
  protected readonly isStaff = computed(() => this.viewer() !== Role.Vecino);
  /** El Auditor solo lee; el Admin deriva desde la fila (asignar o reasignar). */
  protected readonly canAct = computed(
    () => this.viewer() === Role.Funcionario || this.viewer() === Role.Admin,
  );
  protected readonly columns = computed(() =>
    this.isStaff() ? [...STAFF_COLUMNS, ...(this.canAct() ? ['acciones'] : [])] : COLUMNS,
  );
  /** "Mis asignados" no existe para Admin ni Auditor: nunca son responsables (EP3-05, sección 8). */
  protected readonly queues = computed(() => {
    if (!this.isStaff()) {
      return [];
    }
    const queues: RequestQueueOption[] = [
      { value: '', label: 'Todos', icon: 'inbox' },
    ];
    if (this.isFuncionario()) {
      queues.push({ value: 'me', label: 'Mis asignados', icon: 'person' });
    }
    queues.push({ value: 'none', label: 'Sin asignar', icon: 'person_off' });
    return queues;
  });
  /** Trámite en curso de toma, para mostrar el spinner en su botón. */
  protected readonly takingId = signal<string | null>(null);

  protected readonly listState = signal<LoadState>('loading');
  private readonly hasLoaded = signal(false);
  /** Al paginar o filtrar se mantienen las filas anteriores atenuadas, sin saltos de layout. */
  protected readonly showResults = computed(
    () => this.listState() === 'ready' || (this.listState() === 'loading' && this.hasLoaded()),
  );
  protected readonly statusChangeReloadFailed = signal(false);
  /** Tal como llegan del BFF: el servidor filtra al Vecino por su oid, ordena y pagina. */
  protected readonly requests = signal<Request[]>([]);
  protected readonly totalElements = signal(0);
  /** Estado del listado; la URL es su copia para compartir o recargar la vista. */
  protected readonly query = signal<RequestListQuery>(DEFAULT_REQUEST_QUERY);
  protected readonly pageSizes = REQUEST_PAGE_SIZES;
  protected readonly sortValue = computed(() => `${this.query().sort},${this.query().direction}`);
  protected readonly activeFilters = computed(() => activeFilterCount(this.query()));
  protected readonly isNarrowed = computed(() => this.activeFilters() > 0 || !!this.query().q);
  /** Navegaciones propias en curso: su emisión de queryParamMap no es un cambio externo. */
  private readonly ownNavigations = new Set<string>();
  protected readonly transitionsState = signal<LoadState>('loading');
  protected readonly transitions = signal<RequestTransitions | null>(null);
  protected readonly isRecovering = computed(() => this.recoveryPending().length > 0);
  protected readonly informationLoading = computed(
    () =>
      this.isRecovering() ||
      this.listState() === 'loading' ||
      this.catalogState() === 'loading' ||
      (this.isFuncionario() && this.transitionsState() === 'loading'),
  );
  protected readonly informationFailed = computed(
    () =>
      this.listState() === 'error' ||
      this.catalogState() === 'error' ||
      (this.isFuncionario() && this.transitionsState() === 'error'),
  );

  protected readonly isSubmitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly submittedTypeUnavailable = signal(false);
  protected readonly selectedAttachment = signal<File | null>(null);
  protected readonly attachmentError = signal<string | null>(null);
  protected readonly isProcessingAttachment = signal(false);
  private attachmentSelection = 0;

  protected readonly createForm = this.formBuilder.group({
    procedureType: ['', Validators.required],
    description: ['', Validators.required],
    address: ['', Validators.required],
  });

  protected readonly sectors = COMMUNE_SECTORS;

  protected readonly locationForm = new FormGroup(
    {
      sector: new FormControl('', { nonNullable: true }),
      locationReference: new FormControl('', { nonNullable: true }),
      locationMode: new FormControl<LocationMode>('ninguno', { nonNullable: true }),
      approximate: new FormControl(false, { nonNullable: true }),
      latitude: new FormControl<number | null>(null),
      longitude: new FormControl<number | null>(null),
    },
    { validators: locationPointValidator },
  );

  protected readonly locationError = signal<string | null>(null);

  protected readonly filters: RequestFiltersForm = this.formBuilder.group({
    status: this.formBuilder.control<RequestStatus | ''>(''),
    procedureType: [''],
    sector: [''],
    from: this.formBuilder.control<Date | null>(null),
    to: this.formBuilder.control<Date | null>(null),
  });

  protected readonly search = this.formBuilder.control('');

  /** Hasta no puede caer antes de Desde ni antes de la municipalidad. */
  protected readonly toMin = signal(MUNICIPALITY_SINCE);

  constructor() {
    this.locationForm.controls.locationMode.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((mode) => {
        this.locationError.set(null);
        if (mode === 'ninguno') {
          this.locationForm.patchValue(
            { latitude: null, longitude: null, approximate: false },
            { emitEvent: false },
          );
          return;
        }
        if (mode === 'gps') {
          this.readCurrentLocation();
        }
      });

    this.catalogReload$
      .pipe(
        tap(() => {
          this.catalogState.set('loading');
          this.updateCreateControls();
        }),
        switchMap(() =>
          this.catalogService.getProcedures().pipe(
            catchError(() => of(null)),
            finalize(() => this.finishRecovery('catalog')),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((catalog) => {
        if (catalog !== null) {
          this.catalog.set(catalog);
          this.catalogState.set('ready');
          const control = this.createForm.controls.procedureType;
          if (control.value && !this.tiposTramite().some((type) => type.value === control.value)) {
            control.setValue('', { emitEvent: false });
            this.selectionChanged.set(true);
          }
        } else {
          this.catalogState.set('error');
        }
        this.updateCreateControls();
      });

    this.reload$
      .pipe(
        tap(() => this.listState.set('loading')),
        // switchMap descarta respuestas viejas si los filtros cambian antes de que llegue la anterior
        switchMap(() =>
          this.requestsService.getRequests(toRequestListParams(this.query())).pipe(
            catchError(() => of(null)),
            finalize(() => this.finishRecovery('requests')),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        if (page) {
          // Un enlace viejo o un trámite que salió del filtro puede dejar la página fuera de rango
          if (page.content.length === 0 && page.totalElements > 0 && this.query().page > 0) {
            this.applyQuery({ page: Math.max(page.totalPages - 1, 0) }, false);
            return;
          }
          this.requests.set(page.content);
          this.totalElements.set(page.totalElements);
          this.hasLoaded.set(true);
          this.listState.set('ready');
          this.reloadAfterStatusChange = false;
          this.statusChangeReloadFailed.set(false);
        } else {
          this.listState.set('error');
          this.statusChangeReloadFailed.set(this.reloadAfterStatusChange);
        }
      });

    this.transitionsReload$
      .pipe(
        tap(() => {
          this.transitionsState.set('loading');
          this.transitions.set(null);
        }),
        switchMap(() =>
          this.requestsService.getTransitions().pipe(
            catchError(() => of(null)),
            finalize(() => this.finishRecovery('transitions')),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((transitions) => {
        this.transitions.set(transitions);
        this.transitionsState.set(transitions ? 'ready' : 'error');
      });

    this.destroyRef.onDestroy(() => {
      this.statusDialog?.close();
      this.rejectionReasonDialog?.close();
      this.activityDialog?.close();
      this.assignDialog?.close();
    });
    this.filters.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const from = this.filters.controls.from.value;
      if (from && isBeforeDay(from, MUNICIPALITY_SINCE)) {
        this.filters.controls.from.setValue(null, { emitEvent: false });
      }
      const floor = laterDay(this.filters.controls.from.value, MUNICIPALITY_SINCE);
      this.toMin.set(floor);
      const to = this.filters.controls.to.value;
      if (to && isBeforeDay(to, floor)) {
        this.filters.controls.to.setValue(null, { emitEvent: false });
      }
      this.applyQuery(this.filtersFromForm());
    });
    this.search.valueChanges
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        map((value) => value.trim()),
        takeUntilDestroyed(),
      )
      .subscribe((q) => {
        if (q !== this.query().q) {
          this.applyQuery({ q });
        }
      });

    const initial = this.readQuery((key) => this.route.snapshot.queryParamMap.get(key));
    this.query.set(initial);
    this.patchControls(initial);
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const next = this.readQuery((key) => params.get(key));
      const key = serializeRequestListQuery(next);
      if (this.ownNavigations.has(key) || key === serializeRequestListQuery(this.query())) {
        return;
      }
      // Navegación externa, como el enlace "Trámites" del header estando ya en /tramites
      this.query.set(next);
      this.patchControls(next);
      this.loadRequests();
    });
    this.createForm.controls.procedureType.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.selectionChanged.set(false));
    this.loadCatalog();
    this.loadRequests();
    if (this.isFuncionario()) {
      this.loadTransitions();
    }
  }

  protected loadCatalog(): void {
    this.catalogReload$.next();
  }

  protected retryFailedLoads(): void {
    if (this.isRecovering()) {
      return;
    }
    const failed: LoadQuery[] = [];
    if (this.catalogState() === 'error') failed.push('catalog');
    if (this.listState() === 'error') failed.push('requests');
    if (this.isFuncionario() && this.transitionsState() === 'error') failed.push('transitions');
    this.recoveryPending.set(failed);
    for (const query of failed) {
      switch (query) {
        case 'catalog':
          this.loadCatalog();
          break;
        case 'requests':
          this.loadRequests();
          break;
        case 'transitions':
          this.loadTransitions();
          break;
      }
    }
  }

  private finishRecovery(query: LoadQuery): void {
    this.recoveryPending.update((pending) => pending.filter((item) => item !== query));
  }

  protected loadRequests(afterStatusChange = false): void {
    if (afterStatusChange) {
      this.reloadAfterStatusChange = true;
    }
    this.reload$.next();
  }

  protected loadTransitions(): void {
    if (this.isFuncionario() && this.transitionsState() !== 'ready') {
      this.transitionsReload$.next();
    }
  }

  protected transitionsFor(request: Request): readonly RequestStatus[] {
    return this.transitions()?.[request.status] ?? [];
  }

  protected openStatusDialog(request: Request, action: RequestStatusAction): void {
    if (
      !this.isFuncionario() ||
      this.statusDialog ||
      this.rejectionReasonDialog ||
      this.activityDialog ||
      this.descriptionDialog ||
      !this.transitionsFor(request).includes(action.status)
    ) {
      return;
    }

    this.statusDialog = this.dialog.open<
      RequestStatusDialogComponent,
      RequestStatusDialogData,
      RequestStatusDialogResult
    >(RequestStatusDialogComponent, {
      data: {
        request,
        status: action.status,
        procedureTypeLabel: this.getTipoLabel(request.procedureType),
      },
      autoFocus: 'first-heading',
      panelClass: 'request-dialog',
      restoreFocus: false,
      ariaDescribedBy: 'request-status-description',
    });

    this.statusDialog
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.statusDialog = null;
        if (result) {
          // La recarga puede quitar la fila; el título del listado conserva el foco.
          this.listTitle().nativeElement.focus({ preventScroll: true });
          if (result.kind === 'saved') {
            const message =
              result.request.status === 'ADMITIDO' ||
              result.request.status === 'EN_TERRENO' ||
              result.request.status === 'RESUELTO'
                ? 'Estado actualizado. La notificación al vecino se procesa en segundo plano.'
                : 'Estado actualizado.';
            this.snackBar.open(message, undefined, { duration: 3000 });
            this.loadRequests(true);
          } else {
            this.reloadAfterStatusChange = false;
            this.loadRequests();
          }
        } else if (action.trigger.isConnected && action.trigger.getClientRects().length) {
          action.trigger.focus({ preventScroll: true });
        } else {
          this.listTitle().nativeElement.focus({ preventScroll: true });
        }
      });
  }

  /** Nombre del trámite en etiquetas accesibles: el folio, o el id si es anterior al folio. */
  protected requestName(request: Request): string {
    return request.folio?.trim() || request.id;
  }

  protected isMine(request: Request): boolean {
    const userId = this.auth.userId();
    return !!userId && request.assigneeId === userId;
  }

  /** Acción de la fila según el rol y el responsable (EP3-04, sección 3). */
  protected rowMode(request: Request): RequestRowMode {
    const assigned = request.hasAssignee === true;
    if (this.viewer() === Role.Admin) {
      return assigned ? 'reassign' : 'assign';
    }
    if (!assigned) {
      return 'take';
    }
    return this.isMine(request) ? 'operate' : 'readonly';
  }

  protected changeQueue(assignee: RequestQueue): void {
    this.applyQuery({ assignee });
  }

  protected take(request: Request, trigger: HTMLButtonElement): void {
    if (this.takingId() || this.anyDialogOpen() || this.rowMode(request) !== 'take') {
      return;
    }
    this.takingId.set(request.id);
    this.requestsService
      .take(request.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (taken) => {
          this.takingId.set(null);
          this.snackBar.open(
            `Tomaste el trámite ${this.requestName(taken)}. Ahora eres responsable.`,
            undefined,
            { duration: 4000 },
          );
          this.afterAssignmentChange(trigger);
        },
        error: (error: unknown) => {
          this.takingId.set(null);
          const failure = assignmentFailure(error, 'take');
          this.snackBar.open(failure.message, undefined, { duration: 5000 });
          if (failure.refresh) {
            this.afterAssignmentChange(trigger);
          }
        },
      });
  }

  protected openAssignDialog(request: Request, trigger: HTMLButtonElement): void {
    const mode = this.rowMode(request);
    if (this.anyDialogOpen() || (mode !== 'assign' && mode !== 'reassign' && mode !== 'operate')) {
      return;
    }
    this.assignDialog = this.dialog.open<
      RequestAssignDialogComponent,
      RequestAssignDialogData,
      RequestAssignDialogResult
    >(RequestAssignDialogComponent, {
      data: {
        request,
        procedureTypeLabel: this.getTipoLabel(request.procedureType),
        currentUserId: this.auth.userId(),
      },
      panelClass: 'request-dialog',
      autoFocus: 'first-heading',
      restoreFocus: false,
      width: '34rem',
      maxWidth: 'calc(100vw - 2rem)',
      ariaDescribedBy: 'request-assign-description',
    });
    this.assignDialog
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.assignDialog = null;
        if (!result) {
          this.restoreDetailsFocus(trigger);
          return;
        }
        if (result.kind === 'saved') {
          const name = result.request.assigneeName?.trim() || 'el funcionario elegido';
          this.snackBar.open(
            `Trámite ${this.requestName(result.request)} ${result.reassigned ? 'reasignado' : 'asignado'} a ${name}.`,
            undefined,
            { duration: 4000 },
          );
        } else {
          this.snackBar.open(result.message, undefined, { duration: 5000 });
        }
        this.afterAssignmentChange(trigger);
      });
  }

  /** La fila puede cambiar de acción o salir de la bandeja: el foco vuelve al título si su botón desaparece. */
  private afterAssignmentChange(trigger: HTMLButtonElement): void {
    this.loadRequests();
    afterNextRender(() => this.restoreDetailsFocus(trigger), { injector: this.injector });
  }

  private anyDialogOpen(): boolean {
    return !!(
      this.statusDialog ||
      this.rejectionReasonDialog ||
      this.activityDialog ||
      this.descriptionDialog ||
      this.attachmentPreviewDialog ||
      this.assignDialog
    );
  }

  protected openDescription(request: Request): void {
    if (
      this.statusDialog ||
      this.rejectionReasonDialog ||
      this.activityDialog ||
      this.descriptionDialog
    ) {
      return;
    }
    this.descriptionDialog = this.dialog.open(this.descriptionDialogTemplate(), {
      data: request.description,
      panelClass: 'request-dialog',
      autoFocus: 'first-heading',
      width: '36rem',
      maxWidth: 'calc(100vw - 2rem)',
    });
    this.descriptionDialog
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.descriptionDialog = null;
      });
  }

  protected previewAttachment(request: Request): void {
    if (
      !this.isStaff() ||
      !request.hasAttachment ||
      this.statusDialog ||
      this.rejectionReasonDialog ||
      this.activityDialog ||
      this.descriptionDialog ||
      this.attachmentPreviewDialog
    ) {
      return;
    }

    this.requestsService
      .getAttachment(request.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (image) => {
          if (image.type !== 'image/jpeg' && image.type !== 'image/png') {
            this.snackBar.open('El archivo adjunto no es una imagen válida.', undefined, {
              duration: 3000,
            });
            return;
          }
          const url = URL.createObjectURL(image);
          const extension = image.type === 'image/jpeg' ? 'jpg' : 'png';
          this.attachmentPreviewDialog = this.dialog.open(this.attachmentPreviewTemplate(), {
            data: {
              requestId: request.id,
              url,
              imageType: image.type,
              extension,
            } satisfies AttachmentPreview,
            panelClass: 'request-dialog',
            autoFocus: 'first-heading',
            width: '56rem',
            maxWidth: 'calc(100vw - 2rem)',
          });
          this.attachmentPreviewDialog
            .afterClosed()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
              URL.revokeObjectURL(url);
              this.attachmentPreviewDialog = null;
            });
        },
        error: () =>
          this.snackBar.open('No se pudo abrir la imagen del trámite.', undefined, {
            duration: 3000,
          }),
      });
  }

  protected isClosed(request: Request): boolean {
    return isClosedStatus(request.status);
  }

  protected hasRejectionReason(request: Request): boolean {
    return request.status === 'RECHAZADO' && !!request.rejectionReason?.trim();
  }

  protected rememberDetails(event: Event): void {
    this.detailsAnchor = event.currentTarget as HTMLButtonElement;
  }

  protected openActivityDialog(request: Request, menu: MatMenuTrigger): void {
    if (
      this.statusDialog ||
      this.rejectionReasonDialog ||
      this.activityDialog ||
      this.descriptionDialog
    ) {
      return;
    }
    menu.restoreFocus = false;
    menu.closeMenu();
    const trigger = this.detailsAnchor;
    this.activityDialog = this.dialog.open<
      RequestActivityDialogComponent,
      RequestActivityDialogData,
      void
    >(RequestActivityDialogComponent, {
      data: { requestId: request.id, canRegister: this.rowMode(request) === 'operate' },
      panelClass: 'request-dialog',
      autoFocus: 'first-heading',
      restoreFocus: false,
      width: '52rem',
      maxWidth: 'calc(100vw - 2rem)',
    });
    this.activityDialog
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.activityDialog = null;
        this.restoreDetailsFocus(trigger);
      });
  }

  protected openRejectionReasonDialog(request: Request, menu: MatMenuTrigger): void {
    if (
      !this.hasRejectionReason(request) ||
      this.statusDialog ||
      this.rejectionReasonDialog ||
      this.activityDialog ||
      this.descriptionDialog
    ) {
      return;
    }

    menu.restoreFocus = false;
    menu.closeMenu();
    const trigger = this.detailsAnchor;
    this.rejectionReasonDialog = this.dialog.open<
      RequestRejectionReasonDialogComponent,
      RequestRejectionReasonDialogData,
      void
    >(RequestRejectionReasonDialogComponent, {
      data: {
        request,
        procedureTypeLabel: this.getTipoLabel(request.procedureType),
      },
      panelClass: 'request-dialog',
      autoFocus: 'first-heading',
      restoreFocus: false,
    });

    this.rejectionReasonDialog
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.rejectionReasonDialog = null;
        this.restoreDetailsFocus(trigger);
      });
  }

  private restoreDetailsFocus(trigger: HTMLButtonElement | null): void {
    if (trigger?.isConnected && trigger.getClientRects().length) {
      trigger.focus({ preventScroll: true });
    } else {
      this.listTitle().nativeElement.focus({ preventScroll: true });
    }
  }

  /** Resuelve con el catálogo completo, incluidos inactivos. Sin coincidencia, muestra el código. */
  protected getTipoLabel(value: string): string {
    return this.typeLabels().get(value) ?? value;
  }

  protected getSolicitanteNombre(request: Request): string {
    return request.solicitanteNombre?.trim() || 'Sin nombre';
  }

  protected submit(formDirective: FormGroupDirective): void {
    if (
      this.isSubmitting() ||
      this.isProcessingAttachment() ||
      this.attachmentError() !== null ||
      !this.catalogAvailable() ||
      this.createForm.invalid ||
      this.locationForm.invalid ||
      !this.tiposTramite().some(
        (type) => type.value === this.createForm.controls.procedureType.value,
      )
    ) {
      this.locationForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);
    this.submittedTypeUnavailable.set(false);
    this.updateCreateControls();

    const payload = this.creationPayload();
    const attachment = this.selectedAttachment();
    const creation = attachment
      ? this.requestsService.createRequestWithAttachment(payload, attachment)
      : this.requestsService.createRequest(payload);
    creation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        formDirective.resetForm();
        this.selectedAttachment.set(null);
        this.attachmentError.set(null);
        this.locationForm.reset({
          sector: '',
          locationReference: '',
          locationMode: 'ninguno',
          approximate: false,
          latitude: null,
          longitude: null,
        });
        this.locationError.set(null);
        this.isSubmitting.set(false);
        this.updateCreateControls();
        this.snackBar.open('Trámite ingresado.', undefined, { duration: 3000 });
        this.loadRequests();
      },
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        this.updateCreateControls();
        const message = this.backendMessage(error);
        this.submitError.set(message ?? 'No se pudo ingresar el trámite. Intenta nuevamente.');
        this.submittedTypeUnavailable.set(
          error instanceof HttpErrorResponse &&
            error.status === 400 &&
            (message === 'procedureType invalido' ||
              message === 'El tipo de tramite no esta disponible'),
        );
      },
    });
  }

  private updateCreateControls(): void {
    if (this.isSubmitting()) {
      this.createForm.disable({ emitEvent: false });
      this.locationForm.disable({ emitEvent: false });
      return;
    }
    this.createForm.controls.description.enable({ emitEvent: false });
    this.createForm.controls.address.enable({ emitEvent: false });
    this.locationForm.enable({ emitEvent: false });
    const control = this.createForm.controls.procedureType;
    if (this.catalogAvailable()) {
      control.enable({ emitEvent: false });
    } else {
      control.disable({ emitEvent: false });
    }
  }

  protected hasPoint(request: Request): boolean {
    return request.latitude != null && request.longitude != null;
  }

  protected mapLink(request: Request): string {
    return mapUrl(request) ?? '';
  }

  protected async selectAttachment(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    const selection = ++this.attachmentSelection;
    this.selectedAttachment.set(null);
    this.attachmentError.set(null);
    if (!file) {
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      this.attachmentError.set('La imagen no puede superar 5 MB.');
      input.value = '';
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      this.attachmentError.set('Adjunta una imagen JPEG, PNG o WebP.');
      input.value = '';
      return;
    }

    this.isProcessingAttachment.set(true);
    try {
      const bitmap = await createImageBitmap(file);
      let normalized: File;
      try {
        if (
          bitmap.width <= 0 ||
          bitmap.height <= 0 ||
          bitmap.width > MAX_IMAGE_DIMENSION ||
          bitmap.height > MAX_IMAGE_DIMENSION ||
          bitmap.width * bitmap.height > MAX_IMAGE_PIXELS
        ) {
          throw new Error('La imagen supera las dimensiones permitidas.');
        }
        normalized = file.type === 'image/webp' ? await this.convertWebpToPng(bitmap) : file;
      } finally {
        bitmap.close();
      }
      if (selection !== this.attachmentSelection) {
        return;
      }
      if (normalized.size > MAX_ATTACHMENT_BYTES) {
        this.attachmentError.set('La imagen procesada no puede superar 5 MB.');
        return;
      }
      this.selectedAttachment.set(normalized);
    } catch (error: unknown) {
      if (selection === this.attachmentSelection) {
        this.attachmentError.set(
          error instanceof Error && error.message === 'La imagen supera las dimensiones permitidas.'
            ? error.message
            : 'No se pudo leer la imagen. Elige un archivo JPEG, PNG o WebP válido.',
        );
      }
    } finally {
      input.value = '';
      if (selection === this.attachmentSelection) {
        this.isProcessingAttachment.set(false);
      }
    }
  }

  protected removeAttachment(): void {
    this.attachmentSelection += 1;
    this.selectedAttachment.set(null);
    this.attachmentError.set(null);
    this.isProcessingAttachment.set(false);
  }

  private convertWebpToPng(bitmap: ImageBitmap): Promise<File> {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) {
      return Promise.reject(new Error('No se pudo procesar la imagen.'));
    }
    context.drawImage(bitmap, 0, 0);
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(new File([blob], 'evidencia.png', { type: 'image/png' }));
        } else {
          reject(new Error('No se pudo procesar la imagen.'));
        }
      }, 'image/png');
    });
  }

  protected downloadAttachment(request: Request): void {
    if (!request.hasAttachment) {
      return;
    }
    this.requestsService
      .getAttachment(request.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (image) => {
          const extension = image.type === 'image/jpeg' ? 'jpg' : 'png';
          const url = URL.createObjectURL(image);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `evidencia.${extension}`;
          anchor.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        error: () =>
          this.snackBar.open('No se pudo descargar la imagen del trámite.', undefined, {
            duration: 3000,
          }),
      });
  }

  protected placePoint(point: { latitude: number; longitude: number }): void {
    this.locationError.set(
      isInsideCommune(point.latitude, point.longitude) ? null : 'El punto está fuera de la comuna.',
    );
    this.locationForm.patchValue({
      latitude: point.latitude,
      longitude: point.longitude,
    });
  }

  protected readCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.locationError.set(
        'Este navegador no entrega la ubicación. Márcala en el mapa o escribe las coordenadas.',
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = roundCoordinate(position.coords.latitude);
        const longitude = roundCoordinate(position.coords.longitude);
        if (!isInsideCommune(latitude, longitude)) {
          this.locationError.set('La ubicación está fuera de la comuna.');
          this.locationForm.patchValue({ latitude: null, longitude: null });
          return;
        }
        this.locationError.set(null);
        this.locationForm.patchValue({
          latitude,
          longitude,
          approximate: position.coords.accuracy > 100,
        });
      },
      () => {
        this.locationError.set(
          'No se pudo obtener la ubicación. Márcala en el mapa o escribe las coordenadas.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  private creationPayload(): CreateRequestPayload {
    const raw = this.createForm.getRawValue();
    const location = this.locationForm.getRawValue();
    const payload: CreateRequestPayload = {
      procedureType: raw.procedureType,
      description: raw.description,
      address: raw.address,
    };
    const sector = location.sector.trim();
    if (sector) {
      payload.sector = sector;
    }
    const reference = location.locationReference.trim();
    if (reference) {
      payload.locationReference = reference;
    }
    const latitude = location.latitude;
    const longitude = location.longitude;
    if (location.locationMode !== 'ninguno' && latitude != null && longitude != null) {
      payload.latitude = Number(latitude);
      payload.longitude = Number(longitude);
      payload.locationPrecision = location.approximate ? 'APROXIMADO' : 'EXACTO';
    }
    return payload;
  }

  private backendMessage(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse) || typeof error.error?.message !== 'string') {
      return null;
    }
    const message = error.error.message;
    const validationMessages = [
      'procedureType invalido',
      'El tipo de tramite no esta disponible',
      'procedureType invalido. Debe ser minusculas, numeros, guion o guion bajo (maximo 40 caracteres)',
      'sector invalido.',
      'La latitud y la longitud van juntas.',
      'El punto esta fuera de la comuna.',
      'locationPrecision invalido.',
      'Indica si el punto es exacto o aproximado.',
    ];
    if (error.status === 400 && validationMessages.includes(message)) return message;
    if (
      error.status === 503 &&
      message ===
        'El catalogo de tipos de tramite no esta disponible. Intenta nuevamente en unos minutos.'
    ) {
      return message;
    }
    return null;
  }

  protected changePage(event: PageEvent): void {
    this.applyQuery({ page: event.pageIndex, size: event.pageSize }, false);
    const title = this.listTitle().nativeElement;
    if (title.getBoundingClientRect().top < 0) {
      title.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  }

  protected changeSort(sort: Sort): void {
    this.applyQuery({
      sort: sort.active as RequestSortField,
      direction: sort.direction || 'asc',
    });
  }

  protected changeSortValue(value: string): void {
    const [sort, direction] = value.split(',') as [RequestSortField, RequestSortDirection];
    this.applyQuery({ sort, direction });
  }

  protected clearFilters(): void {
    this.filters.reset(
      { status: '', procedureType: '', sector: '', from: null, to: null },
      { emitEvent: false },
    );
    this.toMin.set(MUNICIPALITY_SINCE);
    this.listTitle().nativeElement.focus({ preventScroll: true });
    this.applyQuery({ status: '', procedureType: '', sector: '', from: '', to: '' });
  }

  protected clearSearchAndFilters(): void {
    this.search.setValue('', { emitEvent: false });
    this.query.update((query) => ({ ...query, q: '' }));
    this.clearFilters();
  }

  /** Cambiar búsqueda, filtros u orden vuelve a la primera página. */
  private applyQuery(changes: Partial<RequestListQuery>, resetPage = true): void {
    this.query.update((query) => ({ ...query, ...changes, ...(resetPage ? { page: 0 } : {}) }));
    this.syncUrl();
    this.loadRequests();
  }

  private syncUrl(): void {
    const key = serializeRequestListQuery(this.query());
    const current = serializeRequestListQuery(
      parseRequestListParams((name) => this.route.snapshot.queryParamMap.get(name)),
    );
    if (key === current) {
      return;
    }
    this.ownNavigations.add(key);
    // replaceUrl: cada tecla de la búsqueda no debe sumar una entrada al historial
    void this.router
      .navigate([], {
        relativeTo: this.route,
        queryParams: toRequestListParams(this.query()),
        replaceUrl: true,
      })
      .catch(() => false)
      .finally(() => this.ownNavigations.delete(key));
  }

  /** La bandeja es solo de staff: al Vecino el backend le respondería 403. */
  private readQuery(get: (key: string) => string | null): RequestListQuery {
    const query = parseRequestListParams(get);
    return this.isStaff() || !query.assignee ? query : { ...query, assignee: '' };
  }

  private filtersFromForm(): Partial<RequestListQuery> {
    const { status, procedureType, sector, from, to } = this.filters.getRawValue();
    const fromOk = from && !isBeforeDay(from, MUNICIPALITY_SINCE) ? from : null;
    const floor = laterDay(fromOk, MUNICIPALITY_SINCE);
    const toOk = to && !isBeforeDay(to, floor) ? to : null;
    return {
      status,
      procedureType,
      sector,
      from: fromOk ? toDateKey(fromOk) : '',
      to: toOk ? toDateKey(toOk) : '',
    };
  }

  private patchControls(query: RequestListQuery): void {
    const from = parseDateKey(query.from);
    this.filters.setValue(
      {
        status: query.status,
        procedureType: query.procedureType,
        sector: query.sector,
        from,
        to: parseDateKey(query.to),
      },
      { emitEvent: false },
    );
    this.toMin.set(laterDay(from, MUNICIPALITY_SINCE));
    this.search.setValue(query.q, { emitEvent: false });
  }
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Compara el día civil local. La misma fecha es válida en los dos extremos. */
function isBeforeDay(value: Date, limit: Date): boolean {
  if (Number.isNaN(value.getTime()) || Number.isNaN(limit.getTime())) {
    return false;
  }
  const valueDay = new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const limitDay = new Date(limit.getFullYear(), limit.getMonth(), limit.getDate()).getTime();
  return valueDay < limitDay;
}

function laterDay(value: Date | null, floor: Date): Date {
  if (!value || isBeforeDay(value, floor)) {
    return floor;
  }
  return value;
}
