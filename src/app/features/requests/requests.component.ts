import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  TemplateRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormGroupDirective,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
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
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { Subject, catchError, finalize, of, switchMap, tap } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { CatalogService } from '../../core/catalog/catalog.service';
import { ProcedureType } from '../../shared/models/procedure-type.model';
import { Request, RequestStatus, RequestTransitions } from '../../shared/models/request.model';
import { Role } from '../../shared/models/role';
import { MUNICIPALITY_SINCE, toDateKey } from './date-key';
import {
  RequestActionsComponent,
  RequestStatusAction,
} from './request-actions/request-actions.component';
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
import { REQUEST_STATUSES, REQUEST_STATUS_VIEW } from './requests.constants';
import { RequestsService } from './requests.service';

type LoadState = 'loading' | 'ready' | 'error';
type LoadQuery = 'catalog' | 'requests' | 'transitions';

const COLUMNS = ['tipo', 'descripcion', 'estado', 'fecha'];
/** A partir de aquí «Ver» sigue al texto y el resto se abre aparte. */
const DESCRIPTION_PREVIEW_CHARS = 72;

@Component({
  selector: 'app-requests',
  imports: [
    DatePipe,
    NgTemplateOutlet,
    MatButton,
    MatIconButton,
    MatIcon,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatDatepickerModule,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinner,
    MatSelectModule,
    MatTableModule,
    ReactiveFormsModule,
    RequestActionsComponent,
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
  private readonly listTitle = viewChild.required<ElementRef<HTMLElement>>('listTitle');
  private readonly descriptionDialogTemplate =
    viewChild.required<TemplateRef<{ $implicit: string }>>('descriptionDialog');
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
  protected readonly statuses = REQUEST_STATUSES;
  protected readonly statusView = REQUEST_STATUS_VIEW;

  /** Admin y Auditor no llegan a esta vista (roleGuard), así que quien no es Funcionario es Vecino. */
  protected readonly isFuncionario = computed(() => this.auth.hasRole(Role.Funcionario));
  protected readonly columns = computed(() =>
    this.isFuncionario()
      ? ['tipo', 'descripcion', 'solicitante', 'estado', 'fecha', 'acciones']
      : COLUMNS,
  );

  protected readonly listState = signal<LoadState>('loading');
  protected readonly statusChangeReloadFailed = signal(false);
  /** Tal como llegan del BFF: el servidor ya filtra al Vecino por su oid y ordena por fecha descendente. */
  protected readonly requests = signal<Request[]>([]);
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

  protected readonly createForm = this.formBuilder.group({
    procedureType: ['', Validators.required],
    description: ['', Validators.required],
    address: ['', Validators.required],
  });

  protected readonly filters = this.formBuilder.group({
    status: [''],
    from: this.formBuilder.control<Date | null>(null),
    to: this.formBuilder.control<Date | null>(null),
  });

  /** Ningún filtro puede ser anterior a la instalación de la municipalidad. */
  protected readonly municipalitySince = MUNICIPALITY_SINCE;

  /** Hasta no puede caer antes de Desde ni antes de la municipalidad. */
  protected readonly toMin = signal(MUNICIPALITY_SINCE);

  constructor() {
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
          this.requestsService.getRequests(this.currentFilters()).pipe(
            catchError(() => of(null)),
            finalize(() => this.finishRecovery('requests')),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((requests) => {
        if (requests) {
          this.requests.set(requests);
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

  protected isLongDescription(request: Request): boolean {
    return (request.description?.trim().length ?? 0) > DESCRIPTION_PREVIEW_CHARS;
  }

  /** Corta en una palabra. La última se desvanece y «Ver más» sigue pegado. */
  protected descriptionLead(request: Request): string {
    const preview = this.cutDescription(request);
    const space = preview.lastIndexOf(' ');
    return space < 0 ? '' : preview.slice(0, space + 1);
  }

  protected descriptionFade(request: Request): string {
    const preview = this.cutDescription(request);
    const space = preview.lastIndexOf(' ');
    return space < 0 ? preview : preview.slice(space + 1);
  }

  private cutDescription(request: Request): string {
    const text = request.description?.trim() ?? '';
    const slice = text.slice(0, DESCRIPTION_PREVIEW_CHARS - 8);
    const space = slice.lastIndexOf(' ');
    return (space > 24 ? slice.slice(0, space) : slice).trim();
  }

  protected openDescription(request: Request): void {
    if (this.statusDialog || this.rejectionReasonDialog || this.activityDialog || this.descriptionDialog) {
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

  protected hasRejectionReason(request: Request): boolean {
    return request.status === 'RECHAZADO' && !!request.rejectionReason?.trim();
  }

  protected rememberDetails(event: Event): void {
    this.detailsAnchor = event.currentTarget as HTMLButtonElement;
  }

  protected openActivityDialog(request: Request, menu: MatMenuTrigger): void {
    if (this.statusDialog || this.rejectionReasonDialog || this.activityDialog || this.descriptionDialog) {
      return;
    }
    menu.restoreFocus = false;
    menu.closeMenu();
    const trigger = this.detailsAnchor;
    this.activityDialog = this.dialog.open<RequestActivityDialogComponent, RequestActivityDialogData, void>(
      RequestActivityDialogComponent,
      {
        data: { requestId: request.id, canRegister: this.isFuncionario() },
        panelClass: 'request-dialog',
        autoFocus: 'first-heading',
        restoreFocus: false,
        width: '52rem',
        maxWidth: 'calc(100vw - 2rem)',
      },
    );
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

  /** Etiqueta y tono del badge. Método tipado porque en las celdas de mat-table la fila llega como any. */
  protected statusOf(
    request: Request,
  ): (typeof REQUEST_STATUS_VIEW)[keyof typeof REQUEST_STATUS_VIEW] {
    return REQUEST_STATUS_VIEW[request.status];
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
      !this.catalogAvailable() ||
      this.createForm.invalid ||
      !this.tiposTramite().some(
        (type) => type.value === this.createForm.controls.procedureType.value,
      )
    ) {
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);
    this.submittedTypeUnavailable.set(false);
    this.updateCreateControls();

    this.requestsService
      .createRequest(this.createForm.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          formDirective.resetForm();
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
      return;
    }
    this.createForm.controls.description.enable({ emitEvent: false });
    this.createForm.controls.address.enable({ emitEvent: false });
    const control = this.createForm.controls.procedureType;
    if (this.catalogAvailable()) {
      control.enable({ emitEvent: false });
    } else {
      control.disable({ emitEvent: false });
    }
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

  /** Query params de GET /api/requests. El Vecino no filtra. */
  private currentFilters(): { status?: string; from?: string; to?: string } | undefined {
    if (!this.isFuncionario()) {
      return undefined;
    }

    const { status, from, to } = this.filters.getRawValue();
    const fromOk = from && !isBeforeDay(from, MUNICIPALITY_SINCE) ? from : null;
    const floor = laterDay(fromOk, MUNICIPALITY_SINCE);
    const toOk = to && !isBeforeDay(to, floor) ? to : null;
    return {
      ...(status ? { status } : {}),
      ...(fromOk ? { from: toDateKey(fromOk) } : {}),
      ...(toOk ? { to: toDateKey(toOk) } : {}),
    };
  }
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
